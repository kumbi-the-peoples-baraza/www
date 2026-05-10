package handlers

import (
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

func writeFile(dst string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}
