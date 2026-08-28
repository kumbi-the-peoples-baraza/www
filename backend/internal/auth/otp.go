package auth

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"time"
)

// GenerateOTP generates a 6-digit one-time password.
func GenerateOTP() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", fmt.Errorf("generate otp: %w", err)
	}
	code := fmt.Sprintf("%06d", n.Int64())
	// Avoid trivial 000000 which is more guessable and confusing
	if code == "000000" {
		return GenerateOTP()
	}
	return code, nil
}

// GenerateResetToken generates an 8-character alphanumeric token for password resets.
func GenerateResetToken() (string, error) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 8)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", fmt.Errorf("generate token: %w", err)
		}
		b[i] = chars[n.Int64()]
	}
	return string(b), nil
}

// GeneratePassword generates a cryptographically random password of the given
// length using a mixed-case alphanumeric + symbol charset. Intended for
// temporary credentials that are force-reset on first login.
func GeneratePassword(length int) (string, error) {
	const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%"
	b := make([]byte, length)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", fmt.Errorf("generate password: %w", err)
		}
		b[i] = chars[n.Int64()]
	}
	return string(b), nil
}

// OTPExpiry returns the expiry time for an OTP (10 minutes).
func OTPExpiry() time.Time {
	return time.Now().Add(10 * time.Minute)
}

// TokenExpiry returns the expiry time for a password reset token (1 hour).
func TokenExpiry() time.Time {
	return time.Now().Add(1 * time.Hour)
}
