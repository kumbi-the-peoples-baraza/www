package handlers

import (
	"fmt"
	"net/http"

	"kumbi/internal/auth"
	"kumbi/internal/config"
	"kumbi/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PasswordResetHandler struct {
	db    *pgxpool.Pool
	cfg   *config.Config
	email *services.EmailService
}

func NewPasswordResetHandler(db *pgxpool.Pool, cfg *config.Config, email *services.EmailService) *PasswordResetHandler {
	return &PasswordResetHandler{db: db, cfg: cfg, email: email}
}

// ForgotPassword generates a reset code (OTP) and emails it to the user.
func (h *PasswordResetHandler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var id string
	err := h.db.QueryRow(c, `SELECT id FROM users WHERE email=$1 AND active=true`, req.Email).Scan(&id)
	if err != nil {
		// Don't reveal if user exists
		c.JSON(http.StatusOK, gin.H{"message": "If an account exists, a verification code has been sent"})
		return
	}

	// Throttle: if a fresh reset code was already sent recently, don't resend.
	var recentCount int
	_ = h.db.QueryRow(c, `SELECT COUNT(*) FROM otp_codes WHERE user_id=$1 AND purpose='reset' AND used=false AND expires_at > NOW() AND created_at > NOW() - INTERVAL '60 seconds'`, &id).Scan(&recentCount)
	if recentCount == 0 {
		otp, err := auth.GenerateOTP()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate code"})
			return
		}
		if _, err = h.db.Exec(c, `INSERT INTO otp_codes (user_id, code, purpose, expires_at) VALUES ($1,$2,'reset',$3)`, &id, otp, auth.OTPExpiry()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store code"})
			return
		}
		if err := h.email.SendResetOTPEmail(req.Email, otp); err != nil {
			fmt.Printf("send reset OTP to %s failed: %v\n", req.Email, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "If an account exists, a verification code has been sent"})
}

// VerifyResetOTP verifies the password-reset code and returns a short-lived
// reset token that grants access to the password reset page.
func (h *PasswordResetHandler) VerifyResetOTP(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
		OTP   string `json:"otp" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var id string
	err := h.db.QueryRow(c, `SELECT id FROM users WHERE email=$1 AND active=true`, req.Email).Scan(&id)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired code"})
		return
	}

	var otpID string
	err = h.db.QueryRow(c, `
		SELECT id FROM otp_codes
		WHERE user_id=$1 AND code=$2 AND purpose='reset' AND used=false AND expires_at > NOW()`,
		&id, req.OTP).Scan(&otpID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired code"})
		return
	}

	// Mark the code as used so it can't be reused.
	h.db.Exec(c, `UPDATE otp_codes SET used=true WHERE id=$1`, otpID)

	// Issue a reset token the frontend uses to open the reset page.
	token, err := auth.GenerateResetToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}
	if _, err = h.db.Exec(c, `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1,$2,$3)`, &id, token, auth.TokenExpiry()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token})
}

// VerifyReset checks if a reset token is valid.
func (h *PasswordResetHandler) VerifyReset(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token required"})
		return
	}

	var id string
	err := h.db.QueryRow(c, `
		SELECT user_id FROM password_resets
		WHERE token=$1 AND used=false AND expires_at > NOW()`, token).Scan(&id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"valid": true})
}

// ResetPassword sets a new password using a valid token.
func (h *PasswordResetHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Token    string `json:"token" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate password strength
	if err := auth.ValidatePassword(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find token
	var id string
	err := h.db.QueryRow(c, `
		SELECT user_id FROM password_resets
		WHERE token=$1 AND used=false AND expires_at > NOW()`, req.Token).Scan(&id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired token"})
		return
	}

	// Hash new password
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	// Update password
	_, err = h.db.Exec(c, `
		UPDATE users SET password=$1, force_password_change=false WHERE id=$2`, hash, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
		return
	}

	// Mark token as used
	h.db.Exec(c, `UPDATE password_resets SET used=true WHERE token=$1`, req.Token)

	// Invalidate all existing sessions
	h.db.Exec(c, `DELETE FROM user_sessions WHERE user_id=$1`, id)

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}

// SetPassword sets a new password for users with force_password_change.
func (h *PasswordResetHandler) SetPassword(c *gin.Context) {
	var req struct {
		Token    string `json:"token" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate password strength
	if err := auth.ValidatePassword(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user by temp token
	var id string
	err := h.db.QueryRow(c, `
		SELECT id FROM users
		WHERE temp_token=$1 AND temp_token_expires > NOW()`, req.Token).Scan(&id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired token"})
		return
	}

	// Hash new password
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	// Update password and clear temp token
	_, err = h.db.Exec(c, `
		UPDATE users SET password=$1, force_password_change=false, temp_token=NULL, temp_token_expires=NULL
		WHERE id=$2`, hash, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password set successfully"})
}
