package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port             string
	DatabaseURL      string
	JWTSecret        string
	CaptchaSecret    string
	TurnstileSecret  string
	TurnstileSiteKey string
	SMTPHost         string
	SMTPPort         string
	SMTPUser         string
	SMTPPass         string
	WhatsAppURL      string
	StoragePath      string
	Env              string
	AllowOrigin      string
	FrontendURL      string
	BrandName        string
	BrandTagline     string
	ContactEmail     string
	ContactPhone     string
	ContactAddress   string
	ContactCity      string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      resolveDSN(),
		JWTSecret:        mustEnv("JWT_SECRET"),
		CaptchaSecret:    getEnv("CAPTCHA_SECRET", ""),
		TurnstileSecret:  coalesceEnv("TURNSTILE_SECRET", "TURNSTIAL_SECRET"),
		TurnstileSiteKey: coalesceEnv("TURNSTILE_SITE_KEY", "TURNSTIAL_SITE_KEY"),
		SMTPHost:         getEnv("SMTP_HOST", ""),
		SMTPPort:         getEnv("SMTP_PORT", "587"),
		SMTPUser:         getEnv("SMTP_USER", ""),
		SMTPPass:         getEnv("SMTP_PASS", ""),
		WhatsAppURL:      getEnv("WHATSAPP_WEBHOOK_URL", ""),
		StoragePath:      getEnv("STORAGE_PATH", "./app/storage"),
		Env:              getEnv("ENV", "development"),
		AllowOrigin:      getEnv("ALLOW_ORIGIN", "http://localhost:5173"),
		FrontendURL:      frontendURL(getEnv("FRONTEND_URL", ""), getEnv("ALLOW_ORIGIN", "https://kumbi.test")),
		BrandName:        getEnv("BRAND_NAME", "Kumbi"),
		BrandTagline:     getEnv("BRAND_TAGLINE", "The People's Baraza"),
		ContactEmail:     getEnv("CONTACT_EMAIL", "info@kumbi.org"),
		ContactPhone:     getEnv("CONTACT_PHONE", "+254 700 000 000"),
		ContactAddress:   getEnv("CONTACT_ADDRESS", "Ngong Road"),
		ContactCity:      getEnv("CONTACT_CITY", "Nairobi, Kenya"),
	}

	if err := os.MkdirAll(cfg.StoragePath, 0755); err != nil {
		return nil, fmt.Errorf("create storage dir: %w", err)
	}

	return cfg, nil
}

// resolveDSN returns DATABASE_URL if set, otherwise compiles it from PG vars.
// The compiled fallback handles k8s service-injected POSTGRES_PORT=tcp://ip:port.
func resolveDSN() string {
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		return dsn
	}
	return compileDSN()
}

func compileDSN() string {
	user := mustEnv("POSTGRES_USER")
	pass := mustEnv("POSTGRES_PASSWORD")
	db := mustEnv("POSTGRES_DB")
	host := getEnv("POSTGRES_HOST", "postgres")
	port := resolvePort(getEnv("POSTGRES_PORT", "5432"))
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", user, pass, host, port, db)
}

// resolvePort extracts the numeric port from values like "5432" or
// "tcp://10.43.35.212:5432" (Kubernetes service env injection).
func resolvePort(raw string) string {
	raw = strings.TrimSpace(raw)
	if idx := strings.LastIndex(raw, ":"); idx >= 0 {
		tail := raw[idx+1:]
		if _, err := strconv.Atoi(tail); err == nil {
			return tail
		}
	}
	return raw
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func coalesceEnv(keys ...string) string {
	for _, k := range keys {
		if v := os.Getenv(k); v != "" {
			return v
		}
	}
	return ""
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("required env var %s not set", key))
	}
	return v
}

// frontendURL returns an explicit FRONTEND_URL if set, otherwise the first
// origin from a (possibly comma-separated) ALLOW_ORIGIN list. ALLOW_ORIGIN may
// hold multiple CORS origins ("a,b,c"), which is invalid as a single base URL,
// so we take only the first entry.
func frontendURL(explicit, allowOrigin string) string {
	if explicit != "" {
		return strings.TrimRight(explicit, "/")
	}
	first := allowOrigin
	if idx := strings.Index(allowOrigin, ","); idx >= 0 {
		first = allowOrigin[:idx]
	}
	return strings.TrimRight(strings.TrimSpace(first), "/")
}
