package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"kumbi/internal/auth"
	"kumbi/internal/config"
	"kumbi/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuthHandler struct {
	db    *pgxpool.Pool
	cfg   *config.Config
	email *services.EmailService
	geo   *services.GeoService
}

func NewAuthHandler(db *pgxpool.Pool, cfg *config.Config, email *services.EmailService, geo *services.GeoService) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg, email: email, geo: geo}
}

// LoginRequest represents the login request body.
type LoginRequest struct {
	Email                string `json:"email" binding:"required,email"`
	Password             string `json:"password" binding:"required"`
	TurnstileToken       string `json:"cf_turnstile_response"`
	RememberMe           bool   `json:"remember_me"`
	DeviceFingerprint    string `json:"device_fingerprint"`
}

// LoginResponse represents the login response.
type LoginResponse struct {
	Token           string      `json:"token,omitempty"`
	User            interface{} `json:"user,omitempty"`
	RequiresOTP     bool        `json:"requires_otp,omitempty"`
	RequiresPasswordChange bool  `json:"requires_password_change,omitempty"`
	Message         string      `json:"message,omitempty"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ip := h.getClientIP(c)
	geoResult, _ := h.geo.Lookup(ip)
	deviceInfo := h.parseDeviceInfo(c)

	// Check if IP is blocked
	if h.isIPBlocked(c, ip) {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "too many attempts",
			"message": "Your IP has been temporarily blocked. Please try again later.",
		})
		return
	}

	// Check if device is blocked
	if h.isDeviceBlocked(c, req.DeviceFingerprint) {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "device blocked",
			"message": "This device has been blocked. Please use a different device.",
		})
		return
	}

	// Look up user
	var id, name, role, hash string
	var locked bool
	var lockedUntil *time.Time
	var failedAttempts int
	err := h.db.QueryRow(c, `
		SELECT id, name, role, password, locked, locked_until, failed_attempts
		FROM users WHERE email=$1 AND active=true`, req.Email).
		Scan(&id, &name, &role, &hash, &locked, &lockedUntil, &failedAttempts)

	if err != nil {
		// Log failed attempt for non-existent user
		h.logLoginAttempt(c, nil, req.Email, false, ip, geoResult, deviceInfo, "user_not_found")
		h.incrementFailedAttempts(c, req.Email)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// Check if account is locked
	if locked && lockedUntil != nil && time.Now().Before(*lockedUntil) {
		h.logLoginAttempt(c, &id, req.Email, false, ip, geoResult, deviceInfo, "account_locked")
		c.JSON(http.StatusForbidden, gin.H{
			"error": "account_locked",
			"message": fmt.Sprintf("Account locked until %s", lockedUntil.Format("2006-01-02 15:04")),
		})
		return
	}

	// Check password
	if !auth.CheckPassword(hash, req.Password) {
		h.logLoginAttempt(c, &id, req.Email, false, ip, geoResult, deviceInfo, "wrong_password")
		h.incrementFailedLoginAttempts(c, &id, failedAttempts, name, req.Email, ip, geoResult, deviceInfo)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// Check if Turnstile verification is needed (after failed attempts)
	if failedAttempts >= 3 && req.TurnstileToken == "" {
		c.JSON(http.StatusOK, LoginResponse{
			RequiresOTP: false,
			Message:     "Additional verification required",
		})
		return
	}

	// Verify Turnstile if provided
	if req.TurnstileToken != "" && h.cfg.TurnstileSecret != "" {
		if !auth.VerifyTurnstile(req.TurnstileToken, ip, h.cfg.TurnstileSecret) {
			h.logLoginAttempt(c, &id, req.Email, false, ip, geoResult, deviceInfo, "turnstile_failed")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "verification failed"})
			return
		}
	}

	// Reset failed attempts on successful password check
	h.resetFailedAttempts(c, &id)

	// Check if this is a new device/location
	isNewDevice := h.isNewDevice(c, &id, req.DeviceFingerprint)
	isNewLocation := h.isNewLocation(c, &id, ip)

	// Check if password change is forced
	var forcePasswordChange bool
	h.db.QueryRow(c, `SELECT force_password_change FROM users WHERE id=$1`, &id).Scan(&forcePasswordChange)
	if forcePasswordChange {
		c.JSON(http.StatusOK, LoginResponse{
			RequiresPasswordChange: true,
			Message:                "Please change your password",
		})
		return
	}

	// Send OTP if new device or location
	if isNewDevice || isNewLocation {
		// Throttle: if a valid OTP was sent within last 60s, reuse its window and don't spam
		var recentCount int
		_ = h.db.QueryRow(c, `SELECT COUNT(*) FROM otp_codes WHERE user_id=$1 AND purpose='login' AND used=false AND expires_at > NOW() AND created_at > NOW() - INTERVAL '60 seconds'`, &id).Scan(&recentCount)
		if recentCount > 0 {
			c.JSON(http.StatusOK, LoginResponse{
				RequiresOTP: true,
				Message:     "Verification code already sent — please check your email (or wait 60s to resend)",
			})
			return
		}

		otp, err := auth.GenerateOTP()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate OTP"})
			return
		}

		// Store OTP
		_, err = h.db.Exec(c, `
			INSERT INTO otp_codes (user_id, code, purpose, expires_at)
			VALUES ($1, $2, 'login', $3)`, &id, otp, auth.OTPExpiry())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store OTP"})
			return
		}

		// Send OTP email — synchronous so caller knows if delivery failed
		location := "Unknown"
		device := "Unknown"
		if geoResult != nil {
			city := geoResult.City
			country := geoResult.Country
			if city != "" && country != "" {
				location = fmt.Sprintf("%s, %s", city, country)
			} else if country != "" {
				location = country
			} else if city != "" {
				location = city
			}
		}
		if deviceInfo != nil {
			browser := deviceInfo["browser"]
			osName := deviceInfo["os"]
			if browser != "" && osName != "" {
				device = fmt.Sprintf("%s on %s", browser, osName)
			} else if browser != "" {
				device = browser
			}
		}

		if err := h.email.SendOTPEmail(req.Email, otp, location, device); err != nil {
			// Allow login flow to continue but inform caller — frontend will show retry
			// Log server-side; don't leak SMTP details to client
			fmt.Printf("send OTP email to %s failed: %v\n", req.Email, err)
			c.JSON(http.StatusOK, LoginResponse{
				RequiresOTP: true,
				Message:     "Verification code generated but email delivery failed — please contact support or try again",
			})
			return
		}

		c.JSON(http.StatusOK, LoginResponse{
			RequiresOTP: true,
			Message:     "Verification code sent to your email",
		})
		return
	}

	// Check for remember me
	rememberMe := req.RememberMe
	sessionDuration := auth.DefaultSessionDuration
	if rememberMe {
		sessionDuration = auth.RememberMeDuration
	}

	// Generate JWT
	uid, _ := parseUUID(id)
	token, err := auth.GenerateToken(uid, role, h.cfg.JWTSecret, rememberMe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	// Store session
	tokenHash := sha256.Sum256([]byte(token))
	tokenHashHex := hex.EncodeToString(tokenHash[:])
	countryCode, city := "", ""
	if geoResult != nil {
		countryCode = geoResult.CountryCode
		city = geoResult.City
	}
	_, err = h.db.Exec(c, `
		INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address, country, city, isp, remember_me, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		&id, tokenHashHex, deviceInfo, ip,
		countryCode, city, services.GetISP(ip),
		rememberMe, time.Now().Add(sessionDuration))
	if err != nil {
		// Session storage failed, but login still works
		fmt.Printf("failed to store session: %v\n", err)
	}

	// Log successful login
	h.logLoginAttempt(c, &id, req.Email, true, ip, geoResult, deviceInfo, "success")

	c.JSON(http.StatusOK, LoginResponse{
		Token: token,
		User: gin.H{"id": id, "name": name, "email": req.Email, "role": role},
	})
}

// VerifyOTP verifies a one-time password for login.
func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		OTP      string `json:"otp" binding:"required"`
		RememberMe bool `json:"remember_me"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user
	var id, name, role string
	err := h.db.QueryRow(c, `SELECT id, name, role FROM users WHERE email=$1 AND active=true`, req.Email).
		Scan(&id, &name, &role)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// Verify OTP
	var otpID string
	err = h.db.QueryRow(c, `
		SELECT id FROM otp_codes
		WHERE user_id=$1 AND code=$2 AND purpose='login' AND used=false AND expires_at > NOW()`,
		&id, req.OTP).Scan(&otpID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired OTP"})
		return
	}

	// Mark OTP as used
	h.db.Exec(c, `UPDATE otp_codes SET used=true WHERE id=$1`, otpID)

	rememberMe := req.RememberMe

	// Generate JWT
	uid, _ := parseUUID(id)
	token, err := auth.GenerateToken(uid, role, h.cfg.JWTSecret, rememberMe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	// Store session
	ip := h.getClientIP(c)
	geoResult, _ := h.geo.Lookup(ip)
	deviceInfo := h.parseDeviceInfo(c)
	sessionDuration := auth.DefaultSessionDuration
	if rememberMe {
		sessionDuration = auth.RememberMeDuration
	}

	tokenHash := sha256.Sum256([]byte(token))
	tokenHashHex := hex.EncodeToString(tokenHash[:])
	countryCode, city := "", ""
	if geoResult != nil {
		countryCode = geoResult.CountryCode
		city = geoResult.City
	}
	_, _ = h.db.Exec(c, `
		INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address, country, city, isp, remember_me, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		&id, tokenHashHex, deviceInfo, ip,
		countryCode, city, services.GetISP(ip),
		rememberMe, time.Now().Add(sessionDuration))

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  gin.H{"id": id, "name": name, "email": req.Email, "role": role},
	})
}

// Logout invalidates the current session.
func (h *AuthHandler) Logout(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
		tokenHash := sha256.Sum256([]byte(token))
		tokenHashHex := hex.EncodeToString(tokenHash[:])
		h.db.Exec(c, `DELETE FROM user_sessions WHERE token_hash=$1`, tokenHashHex)
	}
	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

// UnlockUser unlocks a locked-out user by an admin.
func (h *AuthHandler) UnlockUser(c *gin.Context) {
	var req struct {
		UserID string `json:"user_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := h.db.Exec(c, `UPDATE users SET locked=false, locked_until=NULL WHERE id=$1 AND role != 'admin'`, req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unlock user"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "User unlocked"})
}

// ListLockedUsers returns all locked-out users for an admin.
func (h *AuthHandler) ListLockedUsers(c *gin.Context) {
	rows, err := h.db.Query(c, `SELECT id, name, email, role, locked_until FROM users WHERE locked=true AND locked_until > NOW() ORDER BY locked_until DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var users []gin.H
	for rows.Next() {
		var id, name, email, role string
		var lockedUntil *time.Time
		rows.Scan(&id, &name, &email, &role, &lockedUntil)
		users = append(users, gin.H{"id": id, "name": name, "email": email, "role": role, "locked_until": lockedUntil})
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}

// Me returns the current user.
func (h *AuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("userID")
	var id, name, email, role string
	err := h.db.QueryRow(c, `SELECT id, name, email, role FROM users WHERE id=$1`, userID).
		Scan(&id, &name, &email, &role)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "name": name, "email": email, "role": role})
}

// CaptchaConfig returns the public Turnstile site key for the frontend.
// Supports both snake_case (legacy) and camelCase for frontend compatibility.
func (h *AuthHandler) CaptchaConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"site_key":         h.cfg.TurnstileSiteKey,
		"turnstileSiteKey": h.cfg.TurnstileSiteKey,
		"siteKey":          h.cfg.TurnstileSiteKey,
	})
}

// Helper functions

func (h *AuthHandler) getClientIP(c *gin.Context) string {
	if ip := c.GetHeader("X-Forwarded-For"); ip != "" {
		return strings.Split(ip, ",")[0]
	}
	if ip := c.GetHeader("X-Real-IP"); ip != "" {
		return ip
	}
	return c.ClientIP()
}

func (h *AuthHandler) parseDeviceInfo(c *gin.Context) map[string]string {
	ua := c.GetHeader("User-Agent")
	return map[string]string{
		"user_agent": ua,
		"browser":    h.detectBrowser(ua),
		"os":         h.detectOS(ua),
	}
}

func (h *AuthHandler) detectBrowser(ua string) string {
	ua = strings.ToLower(ua)
	switch {
	case strings.Contains(ua, "chrome") && !strings.Contains(ua, "edg"):
		return "Chrome"
	case strings.Contains(ua, "firefox"):
		return "Firefox"
	case strings.Contains(ua, "safari") && !strings.Contains(ua, "chrome"):
		return "Safari"
	case strings.Contains(ua, "edg"):
		return "Edge"
	default:
		return "Unknown"
	}
}

func (h *AuthHandler) detectOS(ua string) string {
	ua = strings.ToLower(ua)
	switch {
	case strings.Contains(ua, "windows"):
		return "Windows"
	case strings.Contains(ua, "mac"):
		return "macOS"
	case strings.Contains(ua, "linux"):
		return "Linux"
	case strings.Contains(ua, "android"):
		return "Android"
	case strings.Contains(ua, "iphone") || strings.Contains(ua, "ipad"):
		return "iOS"
	default:
		return "Unknown"
	}
}

func (h *AuthHandler) isIPBlocked(c *gin.Context, ip string) bool {
	var count int
	h.db.QueryRow(c, `SELECT COUNT(*) FROM blocked_ips WHERE ip_address=$1 AND blocked_until > NOW()`, ip).Scan(&count)
	return count > 0
}

func (h *AuthHandler) isDeviceBlocked(c *gin.Context, fingerprint string) bool {
	if fingerprint == "" {
		return false
	}
	hash := sha256.Sum256([]byte(fingerprint))
	hashHex := hex.EncodeToString(hash[:])
	var count int
	h.db.QueryRow(c, `SELECT COUNT(*) FROM blocked_devices WHERE device_hash=$1 AND blocked_until > NOW()`, hashHex).Scan(&count)
	return count > 0
}

func (h *AuthHandler) isNewDevice(c *gin.Context, userID *string, fingerprint string) bool {
	if fingerprint == "" {
		return false
	}
	var count int
	h.db.QueryRow(c, `SELECT COUNT(*) FROM user_sessions WHERE user_id=$1 AND device_info->>'fingerprint'=$2`, userID, fingerprint).Scan(&count)
	return count == 0
}

func (h *AuthHandler) isNewLocation(c *gin.Context, userID *string, ip string) bool {
	geoResult, _ := h.geo.Lookup(ip)
	if geoResult == nil {
		return false
	}
	var count int
	h.db.QueryRow(c, `SELECT COUNT(*) FROM user_sessions WHERE user_id=$1 AND country=$2`, userID, geoResult.CountryCode).Scan(&count)
	return count == 0
}

func (h *AuthHandler) logLoginAttempt(c *gin.Context, userID *string, email string, success bool, ip string, geo *services.GeoResult, deviceInfo map[string]string, reason string) {
	var country, city string
	if geo != nil {
		country = geo.CountryCode
		city = geo.City
	}
	_, _ = h.db.Exec(c, `
		INSERT INTO login_attempts (user_id, email_attempted, success, ip_address, country, city, device_info, failure_reason)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		userID, email, success, ip, country, city, deviceInfo, reason)
}

func (h *AuthHandler) incrementFailedLoginAttempts(c *gin.Context, userID *string, currentAttempts int, name, email, ip string, geo *services.GeoResult, deviceInfo map[string]string) {
	newAttempts := currentAttempts + 1
	_, _ = h.db.Exec(c, `
		UPDATE users SET failed_attempts=$1, last_failed_at=NOW() WHERE id=$2`,
		newAttempts, userID)

	// Lock account after 5 failed attempts
	if newAttempts >= 5 {
		lockUntil := time.Now().Add(6 * time.Hour)
		_, _ = h.db.Exec(c, `
			UPDATE users SET locked=true, locked_until=$1 WHERE id=$2`,
			lockUntil, userID)

		// Schedule an automatic unlock shortly after the lockout expires so the
		// account is restored without manual admin intervention.
		h.scheduleUnlock(userID, lockUntil)

		// Send account locked email
		go h.email.SendAccountLockedEmail(email, "too many failed login attempts", lockUntil.Format("2006-01-02 15:04"))

		// Log security event
		_, _ = h.db.Exec(c, `
			INSERT INTO security_events (user_id, event_type, details, ip_address)
			VALUES ($1, 'account_locked', $2, $3)`,
			userID, fmt.Sprintf(`{"reason": "5 failed attempts", "locked_until": "%s"}`, lockUntil.Format(time.RFC3339)), ip)

			// Send suspicious login alert if valid username
			if geo != nil {
				device := fmt.Sprintf("%s on %s", deviceInfo["browser"], deviceInfo["os"])
				location := fmt.Sprintf("%s, %s", geo.City, geo.Country)
				isp := services.GetISP(ip)
				code, _ := auth.GenerateResetToken()
				go h.email.SendSuspiciousLoginAlert(email, code, location, device, ip, isp, time.Now().Format("2006-01-02 15:04:05"))
			}
	}
}

// scheduleUnlock schedules a one-shot worker that automatically unlocks the
// account shortly after its lockout expires (lockUntil + 30s). This keeps locks
// self-healing without requiring manual admin intervention. The user id is
// copied by value into the closure to avoid capturing a dangling pointer from
// the request scope.
func (h *AuthHandler) scheduleUnlock(userID *string, lockUntil time.Time) {
	if userID == nil {
		return
	}
	id := *userID
	delay := time.Until(lockUntil) + 30*time.Second
	if delay < 0 {
		delay = 0
	}
	time.AfterFunc(delay, func() {
		// Only unlock if the account is still locked (and not an admin) so a
		// manual re-lock or admin change isn't undone unexpectedly.
		_, err := h.db.Exec(context.Background(),
			`UPDATE users SET locked=false, locked_until=NULL, failed_attempts=0 WHERE id=$1 AND locked=true AND role != 'admin'`,
			id)
		if err != nil {
			fmt.Printf("auto-unlock worker failed for user %s: %v\n", id, err)
		}
	})
}

func (h *AuthHandler) incrementFailedAttempts(c *gin.Context, email string) {
	_, _ = h.db.Exec(c, `
		INSERT INTO login_attempts (email_attempted, success, failure_reason)
		VALUES ($1, false, 'user_not_found')`, email)
}

func (h *AuthHandler) resetFailedAttempts(c *gin.Context, userID *string) {
	_, _ = h.db.Exec(c, `
		UPDATE users SET failed_attempts=0, locked=false, locked_until=NULL WHERE id=$1`, userID)
}

// Refresh generates a new JWT for the current user and invalidates all other
// sessions (cascading reset). This ensures that when a user refreshes, any
// previously stolen or leaked tokens become useless.
func (h *AuthHandler) Refresh(c *gin.Context) {
	userID, _ := c.Get("userID")
	userIDStr := userID.(string)

	uid, _ := parseUUID(userIDStr)

	// Look up the user's role
	var role string
	if err := h.db.QueryRow(c, `SELECT role FROM users WHERE id=$1`, uid).Scan(&role); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Check if remember_me was set on the original session
	var rememberMe bool
	_ = h.db.QueryRow(c, `SELECT remember_me FROM user_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, uid).Scan(&rememberMe)

	// Generate new token
	token, err := auth.GenerateToken(uid, role, h.cfg.JWTSecret, rememberMe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	// Invalidate ALL existing sessions for this user (cascading reset)
	_, _ = h.db.Exec(c, `DELETE FROM user_sessions WHERE user_id=$1`, uid)

	// Store the new session
	tokenHash := sha256.Sum256([]byte(token))
	tokenHashHex := hex.EncodeToString(tokenHash[:])
	ip := h.getClientIP(c)
	geoResult, _ := h.geo.Lookup(ip)
	deviceInfo := h.parseDeviceInfo(c)
	sessionDuration := auth.DefaultSessionDuration
	if rememberMe {
		sessionDuration = auth.RememberMeDuration
	}
	countryCode, city := "", ""
	if geoResult != nil {
		countryCode = geoResult.CountryCode
		city = geoResult.City
	}
	_, _ = h.db.Exec(c, `
		INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address, country, city, isp, remember_me, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		uid, tokenHashHex, deviceInfo, ip,
		countryCode, city, services.GetISP(ip),
		rememberMe, time.Now().Add(sessionDuration))

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  gin.H{"id": userIDStr, "role": role},
	})
}
