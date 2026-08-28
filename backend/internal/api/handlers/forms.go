package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html"
	"kumbi/internal/auth"
	"kumbi/internal/config"
	"kumbi/internal/services"
	"math/rand"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jung-kurt/gofpdf"
)

type FormsHandler struct {
	db       *pgxpool.Pool
	cfg      *config.Config
	notifier *services.Notifier
	emailSvc *services.EmailService
	geoSvc   *services.GeoService
}

func NewFormsHandler(db *pgxpool.Pool, cfg *config.Config, emailSvc *services.EmailService, geoSvc *services.GeoService) *FormsHandler {
	return &FormsHandler{db: db, cfg: cfg, notifier: services.NewNotifier(cfg), emailSvc: emailSvc, geoSvc: geoSvc}
}

// ── Captcha ──────────────────────────────────────────────────────────────────

func (h *FormsHandler) CaptchaChallenge(c *gin.Context) {
	a := rand.Intn(20) + 1
	b := rand.Intn(20) + 1
	answer := strconv.Itoa(a + b)
	expiry := time.Now().Add(5 * time.Minute).Unix()
	token := h.captchaToken(answer, expiry)

	c.JSON(http.StatusOK, gin.H{
		"question": fmt.Sprintf("What is %d + %d?", a, b),
		"token":    token,
	})
}

func (h *FormsHandler) captchaToken(answer string, expiry int64) string {
	mac := hmac.New(sha256.New, []byte(h.cfg.CaptchaSecret))
	mac.Write([]byte(fmt.Sprintf("%s|%d", answer, expiry)))
	return fmt.Sprintf("%s|%d", hex.EncodeToString(mac.Sum(nil)), expiry)
}

func (h *FormsHandler) validateCaptcha(token, answer string) bool {
	parts := strings.SplitN(token, "|", 2)
	if len(parts) != 2 {
		return false
	}
	expiry, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return false
	}
	if time.Now().Unix() > expiry {
		return false
	}
	expected := h.captchaToken(answer, expiry)
	return hmac.Equal([]byte(expected), []byte(token))
}

// ── Input sanitization ───────────────────────────────────────────────────────

var dangerous = regexp.MustCompile(`[<>\'";\\]|(?:--)|(?:/\*)|(?:\*/)|(?:xp_)`)

func sanitize(s string) string {
	s = html.EscapeString(s)
	s = dangerous.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}

func sanitizeData(data map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(data))
	for k, v := range data {
		if s, ok := v.(string); ok {
			out[k] = sanitize(s)
		} else {
			out[k] = v
		}
	}
	return out
}

// ── Submit ────────────────────────────────────────────────────────────────────

func (h *FormsHandler) Submit(formType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var data map[string]interface{}
		if err := c.ShouldBindJSON(&data); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Validate Turnstile (preferred) or legacy math captcha fallback
		turnstileToken, _ := data["cf_turnstile_response"].(string)
		if turnstileToken == "" {
			turnstileToken, _ = data["_cf_turnstile_response"].(string)
		}
		// Legacy fallback keys still sent by old clients
		legacyToken, _ := data["_captcha_token"].(string)
		legacyAnswer, _ := data["_captcha_answer"].(string)

		valid := false
		if turnstileToken != "" && h.cfg.TurnstileSecret != "" {
			ip := c.ClientIP()
			if fwd := c.GetHeader("X-Forwarded-For"); fwd != "" {
				ip = strings.Split(fwd, ",")[0]
			}
			if auth.VerifyTurnstile(turnstileToken, strings.TrimSpace(ip), h.cfg.TurnstileSecret) {
				valid = true
			}
		} else if legacyToken != "" {
			if h.validateCaptcha(legacyToken, legacyAnswer) {
				valid = true
			}
		} else {
			// No token at all — if Turnstile is configured, require it; otherwise allow in dev without captcha
			if h.cfg.TurnstileSecret != "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Human verification required"})
				return
			}
			valid = true
		}
		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Human verification failed"})
			return
		}

		// Sanitize all string fields
		data = sanitizeData(data)

		// Honeypot check
		if hp, ok := data["_hp"].(string); ok && hp != "" {
			c.JSON(http.StatusOK, gin.H{"message": "submitted"})
			return
		}

		// Strip internal fields before storing
		delete(data, "_hp")
		delete(data, "_captcha_token")
		delete(data, "_captcha_answer")
		delete(data, "cf_turnstile_response")
		delete(data, "_cf_turnstile_response")
		delete(data, "cf-turnstile-response")

		b, _ := json.Marshal(data)
		_, err := h.db.Exec(
			c,
			`INSERT INTO form_submissions (form_type, data) VALUES ($1, $2)`,
			formType,
			string(b),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Capture request metadata for the correspondence email.
		ip := c.ClientIP()
		if fwd := c.GetHeader("X-Forwarded-For"); fwd != "" {
			ip = strings.Split(fwd, ",")[0]
		}
		ua := c.Request.UserAgent()
		location := ""
		if h.geoSvc != nil {
			if g, err := h.geoSvc.Lookup(strings.TrimSpace(ip)); err == nil && g != nil {
				location = strings.TrimSpace(strings.Trim(g.City+", ", " ") + g.Country)
			}
		}
		meta := map[string]string{
			"location":  location,
			"ip":        strings.TrimSpace(ip),
			"userAgent": ua,
			"device":    parseDevice(ua),
		}

		dataCopy := make(map[string]interface{}, len(data))
		for k, v := range data {
			dataCopy[k] = v
		}
		go func() {
			if h.emailSvc != nil {
				_ = h.emailSvc.SendFormSubmission(formType, dataCopy, meta)
			}
			h.notifier.Notify(formType, dataCopy)
		}()
		c.JSON(http.StatusCreated, gin.H{"message": "submitted"})
	}
}

// ── List ──────────────────────────────────────────────────────────────────────

func (h *FormsHandler) ListSubmissions(c *gin.Context) {
	formType := c.Param("type")
	rows, err := h.db.Query(
		c,
		`SELECT id, form_type, data, created_at FROM form_submissions WHERE form_type=$1 ORDER BY created_at DESC`,
		formType,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var submissions []gin.H
	for rows.Next() {
		var id, ft string
		var data interface{}
		var createdAt interface{}
		if err := rows.Scan(&id, &ft, &data, &createdAt); err != nil {
			continue
		}
		submissions = append(
			submissions,
			gin.H{"id": id, "formType": ft, "data": data, "createdAt": createdAt},
		)
	}
	if submissions == nil {
		submissions = []gin.H{}
	}
	c.JSON(http.StatusOK, submissions)
}

// ── CSV export ────────────────────────────────────────────────────────────────

func (h *FormsHandler) ExportCSV(c *gin.Context) {
	formType := c.Param("type")
	rows, err := h.db.Query(
		c,
		`SELECT data, created_at FROM form_submissions WHERE form_type=$1 ORDER BY created_at DESC`,
		formType,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="`+formType+`-submissions.csv"`)

	w := c.Writer
	w.Write([]byte("data,created_at\n"))
	for rows.Next() {
		var data interface{}
		var createdAt interface{}
		if err := rows.Scan(&data, &createdAt); err != nil {
			continue
		}
		b, _ := json.Marshal(data)
		w.Write([]byte(`"` + string(b) + `","` + fmt.Sprint(createdAt) + `"` + "\n"))
	}
}

// ── PDF export ────────────────────────────────────────────────────────────────

func (h *FormsHandler) ExportPDF(c *gin.Context) {
	formType := c.Param("type")
	rows, err := h.db.Query(
		c,
		`SELECT id, form_type, data, created_at FROM form_submissions WHERE form_type=$1 ORDER BY created_at DESC`,
		formType,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type submission struct {
		ID        string
		Data      []byte
		CreatedAt string
	}
	var submissions []submission
	for rows.Next() {
		var s submission
		var ft string
		var createdAt interface{}
		if err := rows.Scan(&s.ID, &ft, &s.Data, &createdAt); err != nil {
			continue
		}
		s.CreatedAt = fmt.Sprint(createdAt)
		submissions = append(submissions, s)
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 25)
	pdf.AddPage()

	// Dark blue / indigo palette
	indigo := []int{26, 59, 184}
	darkIndigo := []int{10, 26, 107}

	// ── Logo + brand header ──
	logoPath := "../frontend/src/assets/favicon.png"
	pdf.ImageOptions(logoPath, 14, 12, 10, 10, false, gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}, 0, "")
	pdf.SetXY(27, 12)
	pdf.SetFont("Helvetica", "B", 16)
	pdf.SetTextColor(darkIndigo[0], darkIndigo[1], darkIndigo[2])
	pdf.CellFormat(80, 10, "Kumbi", "", 1, "L", false, 0, "")

	// ── Title ──
	pdf.SetXY(14, 24)
	title := fmt.Sprintf("%s Submissions", titleStr(formType))
	pdf.SetFont("Helvetica", "B", 14)
	pdf.SetTextColor(indigo[0], indigo[1], indigo[2])
	pdf.CellFormat(190, 8, title, "", 1, "L", false, 0, "")

	// Decorative line under header
	pdf.SetDrawColor(indigo[0], indigo[1], indigo[2])
	pdf.SetLineWidth(0.5)
	pdf.Line(14, 34, 200, 34)
	pdf.SetLineWidth(0.2)
	pdf.Ln(8)

	for _, s := range submissions {
		// Check page space: if fewer than 40mm left, new page
		if pdf.GetY() > 247 {
			pdf.AddPage()
			// Re-draw logo + header on new page
			pdf.ImageOptions(logoPath, 14, 12, 10, 10, false, gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}, 0, "")
			pdf.SetXY(27, 12)
			pdf.SetFont("Helvetica", "B", 16)
			pdf.SetTextColor(darkIndigo[0], darkIndigo[1], darkIndigo[2])
			pdf.CellFormat(80, 10, "Kumbi", "", 1, "L", false, 0, "")
			pdf.SetXY(14, 24)
			pdf.SetFont("Helvetica", "B", 14)
			pdf.SetTextColor(indigo[0], indigo[1], indigo[2])
			pdf.CellFormat(190, 8, title+" (cont.)", "", 1, "L", false, 0, "")
			pdf.SetDrawColor(indigo[0], indigo[1], indigo[2])
			pdf.SetLineWidth(0.5)
			pdf.Line(14, 34, 200, 34)
			pdf.SetLineWidth(0.2)
			pdf.Ln(8)
		}

		// Timestamp
		pdf.SetFont("Helvetica", "I", 8)
		pdf.SetTextColor(100, 100, 130)
		pdf.CellFormat(190, 4, s.CreatedAt, "", 1, "R", false, 0, "")
		pdf.Ln(1)

		var parsed map[string]interface{}
		if err := json.Unmarshal(s.Data, &parsed); err != nil {
			continue
		}

		// Collect visible fields
		type field struct{ Label, Value string }
		var fields []field
		for k, v := range parsed {
			if k == "_hp" || k == "_captcha_token" || k == "_captcha_answer" {
				continue
			}
			fields = append(fields, field{
				Label: titleStr(strings.ReplaceAll(k, "_", " ")),
				Value: fmt.Sprintf("%v", v),
			})
		}

		if len(fields) == 0 {
			continue
		}

		// Determine column widths
		labelW := 50.0
		valueW := 136.0
		rowH := 6.0

		// Header row
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetFillColor(indigo[0], indigo[1], indigo[2])
		pdf.SetTextColor(255, 255, 255)
		pdf.CellFormat(labelW, rowH, "Field", "1", 0, "C", true, 0, "")
		pdf.CellFormat(valueW, rowH, "Value", "1", 1, "C", true, 0, "")

		// Data rows
		pdf.SetTextColor(darkIndigo[0], darkIndigo[1], darkIndigo[2])
		for _, f := range fields {
			pdf.SetFont("Helvetica", "B", 8)
			pdf.CellFormat(labelW, rowH, f.Label, "1", 0, "R", false, 0, "")
			pdf.SetFont("Helvetica", "", 8)
			pdf.CellFormat(valueW, rowH, truncate(f.Value, 90), "1", 1, "L", false, 0, "")
		}

		pdf.Ln(3)
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", `attachment; filename="`+formType+`-submissions.pdf"`)
	if err := pdf.Output(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "..."
}

func titleStr(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		if len(w) > 0 {
			words[i] = strings.ToUpper(w[:1]) + w[1:]
		}
	}
	return strings.Join(words, " ")
}

// parseDevice derives a coarse device class + OS from a User-Agent string.
func parseDevice(ua string) string {
	ua = strings.ToLower(ua)
	kind := "Desktop"
	switch {
	case strings.Contains(ua, "iphone"), strings.Contains(ua, "android") && !strings.Contains(ua, "tablet"):
		kind = "Mobile"
	case strings.Contains(ua, "ipad"), strings.Contains(ua, "tablet"):
		kind = "Tablet"
	}
	os := "Unknown OS"
	switch {
	case strings.Contains(ua, "windows"):
		os = "Windows"
	case strings.Contains(ua, "mac os") || strings.Contains(ua, "macintosh"):
		os = "macOS"
	case strings.Contains(ua, "android"):
		os = "Android"
	case strings.Contains(ua, "iphone") || strings.Contains(ua, "ipad"):
		os = "iOS"
	case strings.Contains(ua, "linux"):
		os = "Linux"
	case strings.Contains(ua, "cros"):
		os = "ChromeOS"
	}
	browser := "Unknown Browser"
	switch {
	case strings.Contains(ua, "edg"):
		browser = "Edge"
	case strings.Contains(ua, "chrome") && !strings.Contains(ua, "chromium"):
		browser = "Chrome"
	case strings.Contains(ua, "firefox"):
		browser = "Firefox"
	case strings.Contains(ua, "safari") && !strings.Contains(ua, "chrome"):
		browser = "Safari"
	}
	return fmt.Sprintf("%s · %s · %s", kind, os, browser)
}
