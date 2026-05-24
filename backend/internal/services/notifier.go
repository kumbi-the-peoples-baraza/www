package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"kumbi/internal/config"
	"net/http"
	"net/smtp"
)

type Notifier struct{ cfg *config.Config }

func NewNotifier(cfg *config.Config) *Notifier { return &Notifier{cfg: cfg} }

func (n *Notifier) Notify(formType string, data map[string]interface{}) {
	body, _ := json.MarshalIndent(data, "", "  ")
	subject := fmt.Sprintf("New %s submission - Kumbi", formType)

	if n.cfg.SMTPHost != "" && n.cfg.SMTPUser != "" {
		auth := smtp.PlainAuth("", n.cfg.SMTPUser, n.cfg.SMTPPass, n.cfg.SMTPHost)
		msg := fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s", n.cfg.SMTPUser, subject, string(body))
		_ = smtp.SendMail(
			n.cfg.SMTPHost+":"+n.cfg.SMTPPort,
			auth,
			n.cfg.SMTPUser,
			[]string{n.cfg.SMTPUser},
			[]byte(msg),
		)
	}

	if n.cfg.WhatsAppURL != "" {
		payload, _ := json.Marshal(map[string]interface{}{
			"text": fmt.Sprintf("*%s*\n\n%s", subject, string(body)),
		})
		_, _ = http.Post(n.cfg.WhatsAppURL, "application/json", bytes.NewReader(payload))
	}
}
