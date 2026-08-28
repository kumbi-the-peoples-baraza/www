package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"kumbi/internal/config"
	"net/http"
)

type Notifier struct{ cfg *config.Config }

func NewNotifier(cfg *config.Config) *Notifier { return &Notifier{cfg: cfg} }

func (n *Notifier) Notify(formType string, data map[string]interface{}) {
	// Email delivery for form submissions is handled by EmailService
	// (branded, tabulated, with submission metadata). The notifier only
	// forwards to WhatsApp if configured.
	if n.cfg.WhatsAppURL == "" {
		return
	}
	body, _ := json.MarshalIndent(data, "", "  ")
	subject := fmt.Sprintf("New %s submission - Kumbi", formType)
	payload, _ := json.Marshal(map[string]interface{}{
		"text": fmt.Sprintf("*%s*\n\n%s", subject, string(body)),
	})
	_, _ = http.Post(n.cfg.WhatsAppURL, "application/json", bytes.NewReader(payload))
}
