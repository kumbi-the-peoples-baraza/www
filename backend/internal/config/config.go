package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	SMTPHost    string
	SMTPPort    string
	SMTPUser    string
	SMTPPass    string
	WhatsAppURL string
	StoragePath string
	Env         string
	AllowOrigin string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: resolveDSN(),
		JWTSecret:   mustEnv("JWT_SECRET"),
		SMTPHost:    getEnv("SMTP_HOST", ""),
		SMTPPort:    getEnv("SMTP_PORT", "587"),
		SMTPUser:    getEnv("SMTP_USER", ""),
		SMTPPass:    getEnv("SMTP_PASS", ""),
		WhatsAppURL: getEnv("WHATSAPP_WEBHOOK_URL", ""),
		StoragePath: getEnv("STORAGE_PATH", "./app/storage"),
		Env:         getEnv("ENV", "development"),
		AllowOrigin: getEnv("ALLOW_ORIGIN", "http://localhost:5173"),
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

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("required env var %s not set", key))
	}
	return v
}
