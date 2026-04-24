package config

import (
	"fmt"
	"os"

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
		DatabaseURL: mustEnv("DATABASE_URL"),
		JWTSecret:   mustEnv("JWT_SECRET"),
		SMTPHost:    getEnv("SMTP_HOST", ""),
		SMTPPort:    getEnv("SMTP_PORT", "587"),
		SMTPUser:    getEnv("SMTP_USER", ""),
		SMTPPass:    getEnv("SMTP_PASS", ""),
		WhatsAppURL: getEnv("WHATSAPP_WEBHOOK_URL", ""),
		StoragePath: getEnv("STORAGE_PATH", "./storage"),
		Env:         getEnv("ENV", "development"),
		AllowOrigin: getEnv("ALLOW_ORIGIN", "http://localhost:5173"),
	}

	if err := os.MkdirAll(cfg.StoragePath, 0755); err != nil {
		return nil, fmt.Errorf("create storage dir: %w", err)
	}

	return cfg, nil
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
