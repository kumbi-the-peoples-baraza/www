package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Email     string    `json:"email" db:"email"`
	Password  string    `json:"-" db:"password"`
	Role      string    `json:"role" db:"role"`
	Active    bool      `json:"active" db:"active"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

type Page struct {
	ID          uuid.UUID              `json:"id" db:"id"`
	Slug        string                 `json:"slug" db:"slug"`
	Title       string                 `json:"title" db:"title"`
	Description string                 `json:"description" db:"description"`
	Status      string                 `json:"status" db:"status"`
	DisplayMode string                 `json:"displayMode" db:"display_mode"`
	Order       int                    `json:"order" db:"order"`
	Metadata    map[string]interface{} `json:"metadata" db:"metadata"`
	CreatedAt   time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time              `json:"updatedAt" db:"updated_at"`
}

type ContentBlock struct {
	ID        uuid.UUID              `json:"id" db:"id"`
	PageID    uuid.UUID              `json:"pageId" db:"page_id"`
	Type      string                 `json:"type" db:"type"`
	Content   string                 `json:"content" db:"content"`
	MediaURL  *string                `json:"mediaUrl,omitempty" db:"media_url"`
	Order     int                    `json:"order" db:"order"`
	Settings  map[string]interface{} `json:"settings" db:"settings"`
	CreatedAt time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time              `json:"updatedAt" db:"updated_at"`
}

type MediaFile struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	URL       string    `json:"url" db:"url"`
	MimeType  string    `json:"mimeType" db:"mime_type"`
	Size      int64     `json:"size" db:"size"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type FormSubmission struct {
	ID        uuid.UUID              `json:"id" db:"id"`
	FormType  string                 `json:"formType" db:"form_type"`
	Data      map[string]interface{} `json:"data" db:"data"`
	CreatedAt time.Time              `json:"createdAt" db:"created_at"`
}

type Notebook struct {
	ID         uuid.UUID `json:"id" db:"id"`
	Name       string    `json:"name" db:"name"`
	Path       string    `json:"path" db:"path"`
	UploadedAt time.Time `json:"uploadedAt" db:"uploaded_at"`
}

type Appearance struct {
	ID              uuid.UUID `json:"id" db:"id"`
	PrimaryColor    string    `json:"primaryColor" db:"primary_color"`
	SecondaryColor  string    `json:"secondaryColor" db:"secondary_color"`
	GradientStart   string    `json:"gradientStart" db:"gradient_start"`
	GradientEnd     string    `json:"gradientEnd" db:"gradient_end"`
	BackgroundImage *string   `json:"backgroundImage,omitempty" db:"background_image"`
	ForegroundImage *string   `json:"foregroundImage,omitempty" db:"foreground_image"`
	DarkMode        bool      `json:"darkMode" db:"dark_mode"`
	FontFamily      string    `json:"fontFamily" db:"font_family"`
	UpdatedAt       time.Time `json:"updatedAt" db:"updated_at"`
}
