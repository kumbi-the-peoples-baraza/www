package services

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"

	"kumbi/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/net/html"
)

// EmailService handles sending emails via SMTP.
type EmailService struct {
	cfg *config.Config
	db  *pgxpool.Pool
}

func NewEmailService(cfg *config.Config, db *pgxpool.Pool) *EmailService {
	return &EmailService{cfg: cfg, db: db}
}

// kumbiLogoSVG is an inline (no external load) brand mark with an indigo→sky
// gradient, used as a fallback when no hosted logo URL is available.
func kumbiLogoSVG() string {
	return `<svg width="44" height="44" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Kumbi">
  <defs>
    <linearGradient id="kumbiGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f46e5"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="48" height="48" rx="12" fill="url(#kumbiGrad)"/>
  <path d="M14 13h6v10l8.5-10H35l-9.2 10.8L35.5 35H27l-7-9.6V35h-6z" fill="#ffffff"/>
</svg>`
}

// logoHTML returns the brand logo as an <img> pointing at a hosted PNG so it
// renders in clients (e.g. Gmail) that strip inline SVG. Falls back to the
// inline SVG when FrontendURL is not configured.
func (s *EmailService) logoHTML() string {
	base := strings.TrimRight(s.cfg.FrontendURL, "/")
	if base == "" {
		return kumbiLogoSVG()
	}
	return fmt.Sprintf(`<img src="%s/logo.png" alt="Kumbi" width="44" height="44" style="width:44px;height:44px;border-radius:10px;display:block;" />`, base)
}

// ctaButton renders a branded call-to-action button.
func ctaButton(href, label string) string {
	return fmt.Sprintf(
		`<a href="%s" target="_blank" rel="noopener" style="display:inline-block;background:#4f46e5;background:linear-gradient(135deg,#4f46e5 0%%,#0ea5e9 100%%);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 30px;border-radius:10px;font-family:inherit;">%s</a>`,
		href, label)
}

// codeBox renders a prominent monospaced code (e.g. OTP).
func codeBox(code string) string {
	return fmt.Sprintf(
		`<div style="font-family:'Courier New',Courier,monospace;font-size:30px;letter-spacing:10px;font-weight:800;color:#4f46e5;background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:18px 12px;text-align:center;margin:18px 0;">%s</div>`,
		code)
}

// emailSiteConfig is the subset of the database site_config row used to
// populate email footers. Contact details and social links are owned by the CMS
// (Site Content → Footer / Social Links) and must be fetched from the database,
// never hard-coded.
type emailSiteConfig struct {
	Nav struct {
		Brand   string `json:"brand"`
		Tagline string `json:"tagline"`
	} `json:"nav"`
	Footer struct {
		Email     string `json:"email"`
		Phone     string `json:"phone"`
		Address   string `json:"address"`
		City      string `json:"city"`
		Twitter   string `json:"twitter"`
		Instagram string `json:"instagram"`
		Facebook  string `json:"facebook"`
		Copyright string `json:"copyright"`
		About     string `json:"about"`
	} `json:"footer"`
	// CorrespondenceEmail is the address volunteer & contact form submissions
	// are emailed to. Falls back to configured contact email / SMTP user.
	CorrespondenceEmail string `json:"correspondenceEmail"`
}

// loadSiteConfig reads contact/social details from the database site_config row.
// Any persisted HTML entities (e.g. &#39;) are decoded so emails never render
// raw character references.
func (s *EmailService) loadSiteConfig() *emailSiteConfig {
	sc := &emailSiteConfig{}
	var raw []byte
	if err := s.db.QueryRow(context.Background(), `SELECT data FROM site_config WHERE id='default'`).Scan(&raw); err != nil {
		return sc
	}
	if err := json.Unmarshal(raw, sc); err != nil {
		return sc
	}
	sc.Nav.Brand = html.UnescapeString(sc.Nav.Brand)
	sc.Nav.Tagline = html.UnescapeString(sc.Nav.Tagline)
	sc.Footer.Email = html.UnescapeString(sc.Footer.Email)
	sc.Footer.Phone = html.UnescapeString(sc.Footer.Phone)
	sc.Footer.Address = html.UnescapeString(sc.Footer.Address)
	sc.Footer.City = html.UnescapeString(sc.Footer.City)
	sc.Footer.Twitter = html.UnescapeString(sc.Footer.Twitter)
	sc.Footer.Instagram = html.UnescapeString(sc.Footer.Instagram)
	sc.Footer.Facebook = html.UnescapeString(sc.Footer.Facebook)
	sc.Footer.Copyright = html.UnescapeString(sc.Footer.Copyright)
	sc.Footer.About = html.UnescapeString(sc.Footer.About)
	return sc
}

// correspondenceRecipient returns the address form submissions are mailed to.
func (s *EmailService) correspondenceRecipient() string {
	sc := s.loadSiteConfig()
	if e := strings.TrimSpace(sc.CorrespondenceEmail); e != "" {
		return e
	}
	if e := strings.TrimSpace(s.cfg.ContactEmail); e != "" {
		return e
	}
	return s.cfg.SMTPUser
}

// SendFormSubmission emails a single, branded, tabulated notification for a
// volunteer or contact form interaction. `meta` carries request metadata
// (location, ip, userAgent, device) shown at the bottom of the message.
func (s *EmailService) SendFormSubmission(formType string, data map[string]interface{}, meta map[string]string) error {
	to := s.correspondenceRecipient()

	var subject string
	switch formType {
	case "volunteer":
		subject = "Offer to Volunteer"
	case "contact":
		subject = "New Inquiry"
	default:
		subject = "New " + titleCase(formType) + " submission"
	}

	// Tabulated form data
	var body strings.Builder
	body.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:inherit;font-size:14px;">`)
	keys := make([]string, 0, len(data))
	for k := range data {
		keys = append(keys, k)
	}
	sortStrings(keys)
	for _, k := range keys {
		label := titleCase(strings.ReplaceAll(k, "_", " "))
		value := html.EscapeString(fmt.Sprintf("%v", data[k]))
		body.WriteString(fmt.Sprintf(
			`<tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:600;width:38%%;vertical-align:top;">%s</td><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;">%s</td></tr>`,
			label, value))
	}
	body.WriteString(`</table>`)

	// Submission metadata footer
	var metaRows strings.Builder
	metaRows.WriteString(`<h3 style="margin:22px 0 10px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-family:inherit;">Submission Details</h3>`)
	metaRows.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:inherit;font-size:13px;">`)
	addMeta := func(label, val string) {
		if strings.TrimSpace(val) == "" {
			val = "—"
		}
		if label == "Location" && val != "—" && meta["ip"] != "" {
			val = val + " (" + meta["ip"] + ")"
		}
		metaRows.WriteString(fmt.Sprintf(
			`<tr><td style="padding:4px 10px;color:#64748b;font-weight:600;width:38%%;">%s</td><td style="padding:4px 10px;color:#334155;">%s</td></tr>`,
			label, html.EscapeString(val)))
	}
	addMeta("Location", meta["location"])
	addMeta("IP Address", meta["ip"])
	addMeta("User Agent", meta["userAgent"])
	addMeta("Device", meta["device"])
	metaRows.WriteString(`</table>`)

	return s.SendHTML(to, subject, s.renderEmail(subject, body.String()+metaRows.String()))
}

func titleCase(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		if len(w) > 0 {
			words[i] = strings.ToUpper(w[:1]) + w[1:]
		}
	}
	return strings.Join(words, " ")
}

func sortStrings(a []string) {
	for i := 1; i < len(a); i++ {
		for j := i; j > 0 && a[j-1] > a[j]; j-- {
			a[j-1], a[j] = a[j], a[j-1]
		}
	}
}

func (s *EmailService) footerHTML() string {
	sc := s.loadSiteConfig()
	email := strings.TrimSpace(sc.Footer.Email)
	phone := strings.TrimSpace(sc.Footer.Phone)
	addr := strings.TrimSpace(sc.Footer.Address)
	city := strings.TrimSpace(sc.Footer.City)
	twitter := strings.TrimSpace(sc.Footer.Twitter)
	instagram := strings.TrimSpace(sc.Footer.Instagram)
	facebook := strings.TrimSpace(sc.Footer.Facebook)

	// Config fallbacks keep emails functional if the DB row is missing.
	if email == "" {
		email = s.cfg.ContactEmail
	}
	if phone == "" {
		phone = s.cfg.ContactPhone
	}
	if addr == "" {
		addr = s.cfg.ContactAddress
	}
	if city == "" {
		city = s.cfg.ContactCity
	}

	var rows strings.Builder
	rows.WriteString(`<h3 style="margin:0 0 12px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#ffffff;font-family:inherit;">Get in Touch</h3>`)
	if email != "" {
		rows.WriteString(fmt.Sprintf(`<div style="margin:6px 0;"><a href="mailto:%s" style="color:#93c5fd;text-decoration:none;">%s</a></div>`, email, email))
	}
	if phone != "" {
		rows.WriteString(fmt.Sprintf(`<div style="margin:6px 0;color:#cbd5e1;font-family:inherit;">%s</div>`, phone))
	}
	loc := strings.TrimSpace(addr + ", " + city)
	if loc != "," && loc != "" {
		rows.WriteString(fmt.Sprintf(`<div style="margin:6px 0;color:#cbd5e1;font-family:inherit;">%s</div>`, strings.TrimLeft(loc, ", ")))
	}

	// Social links — only attached when a value is present (CMS Social Links).
	var social []string
	addSocial := func(label, rawURL string) {
		rawURL = strings.TrimSpace(rawURL)
		if rawURL == "" {
			return
		}
		link := rawURL
		if !strings.HasPrefix(link, "http://") && !strings.HasPrefix(link, "https://") {
			link = "https://" + strings.TrimPrefix(link, "www.")
		}
		social = append(social, fmt.Sprintf(`<a href="%s" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 8px;color:#93c5fd;text-decoration:none;font-weight:600;">%s</a>`, link, label))
	}
	addSocial("X", twitter)
	addSocial("Instagram", instagram)
	addSocial("Facebook", facebook)
	if len(social) > 0 {
		rows.WriteString(`<div style="margin-top:12px;">` + strings.Join(social, "") + `</div>`)
	}
	return rows.String()
}

// renderEmail wraps body content in the branded Kumbi HTML template.
func (s *EmailService) renderEmail(title, contentHTML string) string {
	brand := s.cfg.BrandName
	if brand == "" {
		brand = "Kumbi"
	}
	tagline := s.cfg.BrandTagline
	if tagline == "" {
		tagline = "The People's Baraza"
	}
	year := time.Now().Year()

	return fmt.Sprintf(emailShell,
		title,
		s.logoHTML(),
		brand,
		tagline,
		title,
		contentHTML,
		s.footerHTML(),
		year,
		brand,
		brand,
	)
}

const emailShell = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>%s</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.10);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5 0%%,#0ea5e9 100%%);padding:22px 32px;">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"><tr>
            <td style="width:44px;">%s</td>
            <td align="right" style="font-family:inherit;">
              <div style="font-size:20px;font-weight:800;color:#ffffff;line-height:1.1;">%s</div>
              <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,0.85);margin-top:2px;">%s</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a;font-family:inherit;">%s</h1>
          <div style="font-size:15px;line-height:1.65;color:#334155;font-family:inherit;">%s</div>
        </td></tr>
        <tr><td style="background:#0f172a;padding:26px 32px;">
          %s
          <div style="margin-top:16px;padding-top:14px;border-top:1px solid #1e293b;font-size:12px;color:#64748b;font-family:inherit;">&copy; %d %s. All rights reserved.</div>
        </td></tr>
      </table>
      <div style="text-align:center;font-size:11px;color:#94a3b8;padding:14px;font-family:inherit;">You received this email from %s.</div>
    </td></tr>
  </table>
</body>
</html>`

// Send sends a plain-text email via SMTP with STARTTLS support.
func (s *EmailService) Send(to, subject, body string) error {
	if s.cfg.SMTPHost == "" || s.cfg.SMTPUser == "" {
		return fmt.Errorf("SMTP not configured: set SMTP_HOST/SMTP_USER in secrets.yaml")
	}
	msg := fmt.Sprintf("From: Kumbi <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s",
		s.cfg.SMTPUser, to, subject, body)
	return s.sendMail(s.cfg.SMTPUser, []string{to}, []byte(msg))
}

// SendHTML sends an HTML email with STARTTLS support.
func (s *EmailService) SendHTML(to, subject, htmlBody string) error {
	if s.cfg.SMTPHost == "" || s.cfg.SMTPUser == "" {
		return fmt.Errorf("SMTP not configured: set SMTP_HOST/SMTP_USER in secrets.yaml")
	}
	msg := fmt.Sprintf("From: Kumbi <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n%s",
		s.cfg.SMTPUser, to, subject, htmlBody)
	return s.sendMail(s.cfg.SMTPUser, []string{to}, []byte(msg))
}

func (s *EmailService) sendMail(from string, to []string, msg []byte) error {
	addr := net.JoinHostPort(s.cfg.SMTPHost, s.cfg.SMTPPort)
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("smtp dial %s: %w", addr, err)
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, s.cfg.SMTPHost)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer c.Close()

	if ok, _ := c.Extension("STARTTLS"); ok {
		tlsCfg := &tls.Config{ServerName: s.cfg.SMTPHost}
		if err := c.StartTLS(tlsCfg); err != nil {
			return fmt.Errorf("smtp starttls: %w", err)
		}
	} else if s.cfg.SMTPPort == "465" {
		tlsCfg := &tls.Config{ServerName: s.cfg.SMTPHost}
		tlsConn := tls.Client(conn, tlsCfg)
		if err := tlsConn.Handshake(); err != nil {
			return fmt.Errorf("smtp tls handshake: %w", err)
		}
		c2, err := smtp.NewClient(tlsConn, s.cfg.SMTPHost)
		if err != nil {
			return fmt.Errorf("smtp tls client: %w", err)
		}
		c = c2
	}

	if s.cfg.SMTPUser != "" {
		auth := smtp.PlainAuth("", s.cfg.SMTPUser, s.cfg.SMTPPass, s.cfg.SMTPHost)
		if err := c.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}

	if err := c.Mail(from); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	for _, rcpt := range to {
		if err := c.Rcpt(rcpt); err != nil {
			return fmt.Errorf("smtp rcpt %s: %w", rcpt, err)
		}
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		_ = w.Close()
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp data close: %w", err)
	}
	return c.Quit()
}

// SendPasswordResetEmail sends a password reset link.
func (s *EmailService) SendPasswordResetEmail(to, token string) error {
	link := fmt.Sprintf("%s/reset-password/%s", s.cfg.FrontendURL, token)
	subject := "Kumbi - Reset your password"
	content := fmt.Sprintf(`<p style="margin:0 0 16px;">We received a request to reset your password. This link expires in 1 hour.</p>
<p style="margin:0 0 20px;">If you didn't request this, you can safely ignore this email.</p>
<p style="margin:0;">%s</p>`, ctaButton(link, "Reset Password"))
	return s.SendHTML(to, subject, s.renderEmail("Reset your password", content))
}

// SendInviteEmail sends a one-time password-setup link to a newly created user.
// No temporary password is emailed; the link points at the same reset-password
// page used by the forgot-password flow, so no OTP is required.
func (s *EmailService) SendInviteEmail(to, name, token string) error {
	link := fmt.Sprintf("%s/reset-password/%s", s.cfg.FrontendURL, token)
	subject := "Kumbi - Set up your account"
	content := fmt.Sprintf(`<p style="margin:0 0 12px;">Hello %s,</p>
<p style="margin:0 0 12px;">An account has been created for you on Kumbi. Set your password to get started — this link expires in 1 hour.</p>
<p style="margin:0;">%s</p>`,
		name, ctaButton(link, "Set Password"))
	return s.SendHTML(to, subject, s.renderEmail("Set up your account", content))
}

// SendOTPEmail sends a one-time password for login verification.
func (s *EmailService) SendOTPEmail(to, otp, location, device string) error {
	subject := "Kumbi - Login verification code"
	var meta strings.Builder
	if location != "" || device != "" {
		meta.WriteString(`<p style="margin:14px 0 0;font-size:13px;color:#64748b;">Login attempt from:<br/>`)
		if location != "" {
			meta.WriteString(fmt.Sprintf("Location: %s<br/>", location))
		}
		if device != "" {
			meta.WriteString(fmt.Sprintf("Device: %s", device))
		}
		meta.WriteString(`</p>`)
	}
	content := fmt.Sprintf(`<p style="margin:0 0 8px;">Your verification code is:</p>%s
<p style="margin:16px 0 0;font-size:13px;color:#64748b;">This code expires in 10 minutes. If you didn't attempt to log in, please secure your account immediately.</p>%s`,
		codeBox(otp), meta.String())
	return s.SendHTML(to, subject, s.renderEmail("Login verification code", content))
}

// SendResetOTPEmail sends a one-time password for password-reset verification.
func (s *EmailService) SendResetOTPEmail(to, otp string) error {
	subject := "Kumbi - Password reset code"
	content := fmt.Sprintf(`<p style="margin:0 0 12px;">Use the code below to reset your password. It expires in 10 minutes.</p>%s
<p style="margin:16px 0 0;font-size:13px;color:#64748b;">If you didn't request a password reset, you can safely ignore this email.</p>`,
		codeBox(otp))
	return s.SendHTML(to, subject, s.renderEmail("Password reset code", content))
}

// SendSuspiciousLoginEmail sends a notification about suspicious login activity.
func (s *EmailService) SendSuspiciousLoginEmail(to, location, device, ip, timestamp string) error {
	subject := "Kumbi - Suspicious login attempt detected"
	details := fmt.Sprintf(`<p style="margin:0 0 12px;">We detected a login attempt to your account from an unrecognized device.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;color:#334155;font-family:inherit;">
  <tr><td style="padding:3px 0;color:#64748b;">Location:</td><td style="padding:3px 0 3px 12px;">%s</td></tr>
  <tr><td style="padding:3px 0;color:#64748b;">Device:</td><td style="padding:3px 0 3px 12px;">%s</td></tr>
  <tr><td style="padding:3px 0;color:#64748b;">IP Address:</td><td style="padding:3px 0 3px 12px;">%s</td></tr>
  <tr><td style="padding:3px 0;color:#64748b;">Time:</td><td style="padding:3px 0 3px 12px;">%s</td></tr>
</table>
<p style="margin:16px 0 0;">If this was you, no action is needed. If it wasn't you, please secure your account immediately and consider changing your password.</p>`,
		location, device, ip, timestamp)
	return s.SendHTML(to, subject, s.renderEmail("Suspicious login attempt", details))
}

// SendAccountLockedEmail sends a notification when an account is locked.
func (s *EmailService) SendAccountLockedEmail(to, reason string, unlockTime string) error {
	subject := "Kumbi - Account locked"
	content := fmt.Sprintf(`<p style="margin:0 0 12px;">Your account has been locked due to:</p>
<p style="margin:0 0 12px;font-weight:600;color:#0f172a;">%s</p>
<p style="margin:0 0 12px;">Your account will be automatically unlocked at:</p>
<p style="margin:0;font-weight:600;color:#0f172a;">%s</p>
<p style="margin:16px 0 0;">If you need immediate access, please contact your administrator.</p>`,
		reason, unlockTime)
	return s.SendHTML(to, subject, s.renderEmail("Account locked", content))
}

// SendWelcomeEmail sends a welcome email with temporary password.
func (s *EmailService) SendWelcomeEmail(to, name, tempPassword string) error {
	link := fmt.Sprintf("%s/login", s.cfg.FrontendURL)
	subject := "Welcome to Kumbi - Your account is ready"
	content := fmt.Sprintf(`<p style="margin:0 0 12px;">Hello %s,</p>
<p style="margin:0 0 12px;">Your account has been created. You can now log in using:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;color:#334155;font-family:inherit;">
  <tr><td style="padding:3px 0;color:#64748b;">Email:</td><td style="padding:3px 0 3px 12px;">%s</td></tr>
  <tr><td style="padding:3px 0;color:#64748b;">Temporary Password:</td><td style="padding:3px 0 0 12px;font-weight:600;color:#0f172a;">%s</td></tr>
</table>
<p style="margin:16px 0 0;">Please log in and change your password immediately.</p>
<p style="margin:16px 0 0;">%s</p>`,
		name, to, tempPassword, ctaButton(link, "Log In"))
	return s.SendHTML(to, subject, s.renderEmail("Welcome to Kumbi", content))
}

// SendSuspiciousLoginAlert sends a rich link for suspicious login confirmation.
func (s *EmailService) SendSuspiciousLoginAlert(to, confirmCode, location, device, ip, isp, timestamp string) error {
	link := fmt.Sprintf("%s/confirm-login?code=%s&action=block", s.cfg.FrontendURL, confirmCode)
	subject := "Kumbi - Was this you logging in?"
	content := fmt.Sprintf(`<p style="margin:0 0 12px;">We noticed a login attempt to your account.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;color:#334155;font-family:inherit;">
  <tr><td style="padding:3px 0;color:#64748b;">Location:</td><td style="padding:3px 0 3px 12px;">%s</td></tr>
  <tr><td style="padding:3px 0;color:#64748b;">Device:</td><td style="padding:3px 0 3px 12px;">%s</td></tr>
  <tr><td style="padding:3px 0;color:#64748b;">IP Address:</td><td style="padding:3px 0 3px 12px;">%s</td></tr>
  <tr><td style="padding:3px 0;color:#64748b;">ISP:</td><td style="padding:3px 0 3px 12px;">%s</td></tr>
  <tr><td style="padding:3px 0;color:#64748b;">Time:</td><td style="padding:3px 0 3px 12px;">%s</td></tr>
</table>
<p style="margin:16px 0;">If this was you, no action is needed. If this <strong>wasn't</strong> you, click below to secure your account — this will block the suspicious IP and device.</p>
<p style="margin:0;">%s</p>`,
		location, device, ip, isp, timestamp, ctaButton(link, "Secure my account"))
	return s.SendHTML(to, subject, s.renderEmail("Was this you?", content))
}

// ParseAddress extracts email from "Name <email>" format.
func ParseAddress(addr string) string {
	if idx := strings.Index(addr, "<"); idx >= 0 {
		if end := strings.Index(addr[idx:], ">"); end >= 0 {
			return addr[idx+1 : idx+end]
		}
	}
	return addr
}
