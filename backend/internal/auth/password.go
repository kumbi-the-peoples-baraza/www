package auth

import (
	"errors"
	"unicode"
)

// ValidatePassword enforces strong password rules for admin UI users.
// Must be at least 10 characters with uppercase, lowercase, digits, and symbols.
func ValidatePassword(password string) error {
	if len(password) < 10 {
		return errors.New("password must be at least 10 characters")
	}
	var hasUpper, hasLower, hasDigit, hasSymbol bool
	for _, c := range password {
		switch {
		case unicode.IsUpper(c):
			hasUpper = true
		case unicode.IsLower(c):
			hasLower = true
		case unicode.IsDigit(c):
			hasDigit = true
		case unicode.IsPunct(c) || unicode.IsSymbol(c):
			hasSymbol = true
		}
	}
	if !hasUpper {
		return errors.New("password must include uppercase letters")
	}
	if !hasLower {
		return errors.New("password must include lowercase letters")
	}
	if !hasDigit {
		return errors.New("password must include digits")
	}
	if !hasSymbol {
		return errors.New("password must include symbols (!@#$%^&*)")
	}
	return nil
}
