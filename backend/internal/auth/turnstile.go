package auth

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"time"
)

type turnstileResponse struct {
	Success     bool    `json:"success"`
	Score       float64 `json:"score"`
	Action      string  `json:"action"`
	ChallengeTS string  `json:"challenge_ts"`
	Hostname    string  `json:"hostname"`
	ErrorCodes  []string `json:"error-codes"`
}

// VerifyTurnstile validates a Cloudflare Turnstile token.
// Returns true if Cloudflare confirms success. Score field (reCAPTCHA) is ignored.
func VerifyTurnstile(token, remoteIP, secretKey string) bool {
	if secretKey == "" || token == "" {
		return false
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	form := url.Values{
		"secret":   {secretKey},
		"response": {token},
	}
	if remoteIP != "" {
		form.Set("remoteip", remoteIP)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://challenges.cloudflare.com/turnstile/v0/siteverify", nil)
	if err != nil {
		return false
	}
	req.PostForm = form
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		// Fallback to PostForm for environments where NewRequestWithContext handling differs
		resp2, err2 := http.PostForm("https://challenges.cloudflare.com/turnstile/v0/siteverify", form)
		if err2 != nil {
			return false
		}
		resp = resp2
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false
	}

	var result turnstileResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return false
	}

	return result.Success
}
