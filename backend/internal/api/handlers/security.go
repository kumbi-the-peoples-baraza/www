package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SecurityHandler struct {
	db *pgxpool.Pool
}

func NewSecurityHandler(db *pgxpool.Pool) *SecurityHandler {
	return &SecurityHandler{db: db}
}

// GetSessions returns all user sessions across the platform for admin view,
// joined with the owning user's name/email.
func (h *SecurityHandler) GetSessions(c *gin.Context) {
	rows, err := h.db.Query(c, `
		SELECT
			s.id,
			s.user_id,
			u.name as user_name,
			u.email as user_email,
			s.ip_address,
			s.country,
			s.city,
			s.isp,
			s.device_info,
			s.last_activity_at as last_activity,
			s.created_at,
			s.expires_at,
			s.expires_at > NOW() as is_active
		FROM user_sessions s
		LEFT JOIN users u ON u.id = s.user_id
		ORDER BY s.last_activity_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var sessions []map[string]interface{}
	for rows.Next() {
		var id string
		var userID, userName, userEmail, ipAddress, country, city, isp *string
		var deviceInfo map[string]interface{}
		var lastActivity, createdAt, expiresAt time.Time
		var isActive bool

		if err := rows.Scan(&id, &userID, &userName, &userEmail, &ipAddress, &country, &city, &isp, &deviceInfo, &lastActivity, &createdAt, &expiresAt, &isActive); err != nil {
			continue
		}

		sessions = append(sessions, map[string]interface{}{
			"id":            id,
			"user_id":       userID,
			"user_name":     userName,
			"user_email":    userEmail,
			"ip_address":    ipAddress,
			"country":       country,
			"city":          city,
			"isp":           isp,
			"device_info":   deviceInfo,
			"last_activity": lastActivity,
			"created_at":    createdAt,
			"expires_at":    expiresAt,
			"is_active":     isActive,
		})
	}

	c.JSON(http.StatusOK, sessions)
}

// GetUserSessions returns detailed sessions for a specific user.
func (h *SecurityHandler) GetUserSessions(c *gin.Context) {
	userID := c.Param("id")

	rows, err := h.db.Query(c, `
		SELECT
			id,
			device_info,
			ip_address,
			country,
			city,
			isp,
			remember_me,
			expires_at,
			last_activity_at,
			created_at
		FROM user_sessions
		WHERE user_id=$1
		ORDER BY last_activity_at DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var sessions []map[string]interface{}
	for rows.Next() {
		var id string
		var deviceInfo map[string]interface{}
		var ipAddress, country, city, isp string
		var rememberMe bool
		var expiresAt, lastActivity, createdAt time.Time

		if err := rows.Scan(&id, &deviceInfo, &ipAddress, &country, &city, &isp, &rememberMe, &expiresAt, &lastActivity, &createdAt); err != nil {
			continue
		}

		sessions = append(sessions, map[string]interface{}{
			"id":              id,
			"device_info":     deviceInfo,
			"ip_address":      ipAddress,
			"country":         country,
			"city":            city,
			"isp":             isp,
			"remember_me":     rememberMe,
			"expires_at":      expiresAt,
			"last_activity":   lastActivity,
			"created_at":      createdAt,
			"is_active":       expiresAt.After(time.Now()),
		})
	}

	c.JSON(http.StatusOK, sessions)
}

// GetSuspiciousLogins returns suspicious login attempts.
func (h *SecurityHandler) GetSuspiciousLogins(c *gin.Context) {
	rows, err := h.db.Query(c, `
		SELECT
			sl.id,
			u.name as user_name,
			u.email as user_email,
			sl.ip_address,
			sl.country,
			sl.city,
			sl.device_info,
			sl.status,
			sl.confirmed_by_user,
			sl.created_at
		FROM suspicious_logins sl
		LEFT JOIN users u ON u.id = sl.user_id
		ORDER BY sl.created_at DESC
		LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var id, userName, userEmail, status string
		var ipAddress, country, city string
		var deviceInfo map[string]interface{}
		var confirmedByUser *bool
		var createdAt time.Time

		if err := rows.Scan(&id, &userName, &userEmail, &ipAddress, &country, &city, &deviceInfo, &status, &confirmedByUser, &createdAt); err != nil {
			continue
		}

		results = append(results, map[string]interface{}{
			"id":               id,
			"user_name":        userName,
			"user_email":       userEmail,
			"ip_address":       ipAddress,
			"country":          country,
			"city":             city,
			"device_info":      deviceInfo,
			"status":           status,
			"confirmed_by_user": confirmedByUser,
			"created_at":       createdAt,
		})
	}

	c.JSON(http.StatusOK, results)
}

// GetLoginAttempts returns recent login attempts.
func (h *SecurityHandler) GetLoginAttempts(c *gin.Context) {
	rows, err := h.db.Query(c, `
		SELECT
			la.id,
			u.name as user_name,
			u.email as user_email,
			la.email_attempted,
			la.success,
			la.ip_address,
			la.country,
			la.city,
			la.device_info,
			la.failure_reason,
			la.created_at
		FROM login_attempts la
		LEFT JOIN users u ON u.id = la.user_id
		ORDER BY la.created_at DESC
		LIMIT 200`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var id, emailAttempted, failureReason string
		var userName, userEmail *string
		var success bool
		var ipAddress, country, city string
		var deviceInfo map[string]interface{}
		var createdAt time.Time

		if err := rows.Scan(&id, &userName, &userEmail, &emailAttempted, &success, &ipAddress, &country, &city, &deviceInfo, &failureReason, &createdAt); err != nil {
			continue
		}

		results = append(results, map[string]interface{}{
			"id":               id,
			"user_name":        userName,
			"user_email":       userEmail,
			"email_attempted":  emailAttempted,
			"success":          success,
			"ip_address":       ipAddress,
			"country":          country,
			"city":             city,
			"device_info":      deviceInfo,
			"failure_reason":   failureReason,
			"created_at":       createdAt,
		})
	}

	c.JSON(http.StatusOK, results)
}

// GetSecurityEvents returns security events.
func (h *SecurityHandler) GetSecurityEvents(c *gin.Context) {
	rows, err := h.db.Query(c, `
		SELECT
			se.id,
			u.name as user_name,
			u.email as user_email,
			se.event_type,
			se.details,
			se.ip_address,
			se.created_at
		FROM security_events se
		LEFT JOIN users u ON u.id = se.user_id
		ORDER BY se.created_at DESC
		LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var id, eventType string
		var userName, userEmail *string
		var details map[string]interface{}
		var ipAddress *string
		var createdAt time.Time

		if err := rows.Scan(&id, &userName, &userEmail, &eventType, &details, &ipAddress, &createdAt); err != nil {
			continue
		}

		results = append(results, map[string]interface{}{
			"id":          id,
			"user_name":   userName,
			"user_email":  userEmail,
			"event_type":  eventType,
			"details":     details,
			"ip_address":  ipAddress,
			"created_at":  createdAt,
		})
	}

	c.JSON(http.StatusOK, results)
}

// BlockIP blocks an IP address for 90 days.
func (h *SecurityHandler) BlockIP(c *gin.Context) {
	var req struct {
		IP     string `json:"ip" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	blockedUntil := time.Now().Add(90 * 24 * time.Hour)
	_, err := h.db.Exec(c, `
		INSERT INTO blocked_ips (ip_address, reason, blocked_until)
		VALUES ($1, $2, $3)
		ON CONFLICT (ip_address) DO UPDATE SET blocked_until=$3, reason=$2`,
		req.IP, req.Reason, blockedUntil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "IP blocked for 90 days"})
}

// BlockDevice blocks a device for 365 days.
func (h *SecurityHandler) BlockDevice(c *gin.Context) {
	var req struct {
		Fingerprint string `json:"fingerprint" binding:"required"`
		Reason      string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	blockedUntil := time.Now().Add(365 * 24 * time.Hour)
	_, err := h.db.Exec(c, `
		INSERT INTO blocked_devices (device_hash, reason, blocked_until)
		VALUES ($1, $2, $3)
		ON CONFLICT (device_hash) DO UPDATE SET blocked_until=$3, reason=$2`,
		req.Fingerprint, req.Reason, blockedUntil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Device blocked for 365 days"})
}

// GetBlockedIPs returns all blocked IPs.
func (h *SecurityHandler) GetBlockedIPs(c *gin.Context) {
	rows, err := h.db.Query(c, `
		SELECT id, ip_address, reason, blocked_until, created_at
		FROM blocked_ips
		WHERE blocked_until > NOW()
		ORDER BY blocked_until DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var id, ip, reason string
		var blockedUntil, createdAt time.Time
		if err := rows.Scan(&id, &ip, &reason, &blockedUntil, &createdAt); err != nil {
			continue
		}
		results = append(results, map[string]interface{}{
			"id":           id,
			"ip_address":   ip,
			"reason":       reason,
			"blocked_until": blockedUntil,
			"created_at":   createdAt,
		})
	}

	c.JSON(http.StatusOK, results)
}

// UnblockIP removes an IP block.
func (h *SecurityHandler) UnblockIP(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec(c, `DELETE FROM blocked_ips WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "IP unblocked"})
}

// GetLockedUsers returns all locked-out users for admin view.
func (h *SecurityHandler) GetLockedUsers(c *gin.Context) {
	rows, err := h.db.Query(c, `
		SELECT id, name, email, role, locked_until, failed_attempts, last_failed_at
		FROM users 
		WHERE locked=true
		ORDER BY last_failed_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var id, name, email, role string
		var lockedUntil *time.Time
		var failedAttempts int
		var lastFailedAt *time.Time

		if err := rows.Scan(&id, &name, &email, &role, &lockedUntil, &failedAttempts, &lastFailedAt); err != nil {
			continue
		}

		results = append(results, map[string]interface{}{
			"id":            id,
			"name":          name,
			"email":         email,
			"role":          role,
			"locked_until":  lockedUntil,
			"failed_attempts": failedAttempts,
			"last_failed_at": lastFailedAt,
		})
	}

	c.JSON(http.StatusOK, results)
}

// UnlockUser unlocks a locked user account by admin.
func (h *SecurityHandler) UnlockUser(c *gin.Context) {
	userID := c.Param("id")

	// Prevent unlocking admin accounts
	var isAdmin bool
	err := h.db.QueryRow(c, `SELECT role = 'admin' FROM users WHERE id=$1`, userID).Scan(&isAdmin)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot unlock admin account"})
		return
	}

	var result struct {
		WasLocked bool
	}
	row := h.db.QueryRow(c, `SELECT locked FROM users WHERE id=$1`, userID)
	if err := row.Scan(&result.WasLocked); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_, err = h.db.Exec(c, `
		UPDATE users 
		SET locked=false, locked_until=NULL, failed_attempts=0 
		WHERE id=$1`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Log the unlock event
	_, _ = h.db.Exec(c, `
		INSERT INTO security_events (user_id, event_type, details)
		VALUES ($1, 'account_unlocked', '{"admin_unlocked": true}')`, userID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Account unlocked",
		"was_locked_before": result.WasLocked,
	})
}

// GetOTPStatus returns OTP codes with their usage and expiry status.
func (h *SecurityHandler) GetOTPStatus(c *gin.Context) {
	rows, err := h.db.Query(c, `
		SELECT 
			oc.id,
			oc.user_id,
			oc.code,
			oc.purpose,
			oc.used,
			oc.expires_at,
			oc.created_at,
			u.name as user_name,
			u.email as user_email
		FROM otp_codes oc
		LEFT JOIN users u ON u.id = oc.user_id
		ORDER BY oc.created_at DESC
		LIMIT 500`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var id, userID, code, purpose, userName, userEmail string
		var used bool
		var expiresAt, createdAt time.Time
		var userNamePtr, userEmailPtr *string

		if err := rows.Scan(&id, &userID, &code, &purpose, &used, &expiresAt, &createdAt, &userNamePtr, &userEmailPtr); err != nil {
			continue
		}
		if userNamePtr != nil {
			userName = *userNamePtr
		}
		if userEmailPtr != nil {
			userEmail = *userEmailPtr
		}

		// Mask OTP code - only show last 3 digits
		maskedCode := "***"
		if len(code) >= 3 {
			maskedCode = code[len(code)-3:]
		}

		// Determine OTP status
		var status string
		now := time.Now()
		if used {
			status = "used"
		} else if now.After(expiresAt) {
			status = "expired"
		} else {
			status = "sent"
		}

		results = append(results, map[string]interface{}{
			"id":         id,
			"user_id":    userID,
			"masked_code": "***" + maskedCode,
			"purpose":    purpose,
			"status":     status,
			"created_at": createdAt,
			"expires_at": expiresAt,
			"user_name":  userName,
			"user_email": userEmail,
		})
	}

	c.JSON(http.StatusOK, results)
}
