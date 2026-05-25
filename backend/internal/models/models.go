package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type (
	NotebookStatus string
	NotebookSource string
)

const (
	StatusActive   NotebookStatus = "active"
	StatusArchived NotebookStatus = "archived"
	StatusDeleted  NotebookStatus = "deleted"

	SourceGitHub NotebookSource = "github_url"
	SourceUpload NotebookSource = "local_upload"
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
	UpdatedAt   time.Time              `json:"updatedAt,omitempty" db:"updated_at"`
	// For pages with notebooks attached
	NotebookID *uuid.UUID `json:"notebook_id,omitempty" db:"notebook_id"`
	Notebook   *Notebook  `json:"notebook,omitempty" db:"-"`
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
	ID               uuid.UUID              `json:"id" db:"id"`
	Name             string                 `json:"name" db:"name"`
	URL              string                 `json:"url" db:"url"`
	ThumbnailURL     string                 `json:"thumbnailUrl" db:"thumbnail_url"`
	WebpURL          string                 `json:"webpUrl" db:"webp_url"`
	MimeType         string                 `json:"mimeType" db:"mime_type"`
	Size             int64                  `json:"size" db:"size"`
	Width            int                    `json:"width" db:"width"`
	Height           int                    `json:"height" db:"height"`
	GalleryPublished bool                   `json:"galleryPublished" db:"gallery_published"`
	Caption          string                 `json:"caption" db:"caption"`
	Photographer     string                 `json:"photographer" db:"photographer"`
	DateTaken        string                 `json:"dateTaken" db:"date_taken"`
	UploaderID       *uuid.UUID             `json:"uploaderId" db:"uploader_id"`
	Exif             map[string]interface{} `json:"exif" db:"exif"`
	Locked           bool                   `json:"locked" db:"locked"`
	Views            int                    `json:"views" db:"views"`
	CreatedAt        time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt        time.Time              `json:"updatedAt" db:"updated_at"`
}

type FormSubmission struct {
	ID        uuid.UUID              `json:"id" db:"id"`
	FormType  string                 `json:"formType" db:"form_type"`
	Data      map[string]interface{} `json:"data" db:"data"`
	CreatedAt time.Time              `json:"createdAt" db:"created_at"`
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

type Notebook struct {
	ID          uuid.UUID       `json:"id"          db:"id"`
	Title       string          `json:"title"       db:"title"`
	Description string          `json:"description" db:"description"`
	SourceType  string          `json:"sourceType"  db:"source_type"`
	SourceURL   string          `json:"sourceUrl"   db:"source_url"`
	CellsJSON   json.RawMessage `json:"cells"       db:"cells_json"`
	Readme      string          `json:"readme"      db:"readme"`
	Kernel      string          `json:"kernel"      db:"kernel"`
	Language    string          `json:"language"    db:"language"`
	Status      string          `json:"status"      db:"status"`
	CreatedAt   time.Time       `json:"createdAt"   db:"created_at"`
	UpdatedAt   time.Time       `json:"updatedAt"   db:"updated_at"`
}

type CellDTO struct {
	ID       string          `json:"id"`
	Type     string          `json:"type"` // "code" | "markdown" | "raw"
	Source   string          `json:"source"`
	Outputs  []OutputDTO     `json:"outputs"`
	Metadata json.RawMessage `json:"metadata,omitempty"`
}

type OutputDTO struct {
	OutputType string          `json:"outputType"`
	Data       json.RawMessage `json:"data,omitempty"`
	Text       []string        `json:"text,omitempty"`
	MimeBundle map[string]any  `json:"mimeBundle,omitempty"`
}

type CreateNotebookRequest struct {
	Title       string `json:"title"      binding:"required"`
	Description string `json:"description"`
	SourceType  string `json:"sourceType" binding:"required,oneof=github_url local_upload"`
	SourceURL   string `json:"sourceUrl"`
}

type AttachNotebookRequest struct {
	NotebookID uuid.UUID `json:"notebookId" binding:"required"`
}
