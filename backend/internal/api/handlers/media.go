package handlers

import (
	"fmt"
	"image"
	"kumbi/internal/config"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rwcarlsen/goexif/exif"
	"github.com/rwcarlsen/goexif/mknote"
)

type MediaHandler struct {
	db  *pgxpool.Pool
	cfg *config.Config
}

func NewMediaHandler(db *pgxpool.Pool, cfg *config.Config) *MediaHandler {
	return &MediaHandler{db: db, cfg: cfg}
}

// ── helpers ────────────────────────────────────────────────────────────────

func isImage(mime string) bool {
	return strings.HasPrefix(mime, "image/")
}

func thumbPath(storage, orig string) string {
	ext := filepath.Ext(orig)
	return filepath.Join(storage, strings.TrimSuffix(orig, ext)+"_thumb.jpg")
}

// generateThumbnail creates a JPEG thumbnail (max 300 px on longest side).
func generateThumbnail(src, dst string) error {
	srcImg, err := imaging.Open(src)
	if err != nil {
		return err
	}
	thumb := imaging.Fit(srcImg, 300, 300, imaging.Lanczos)
	return imaging.Save(thumb, dst, imaging.JPEGQuality(80))
}

// extractExif decodes EXIF from a JPEG file and returns a flat map.
func extractExif(path string) map[string]interface{} {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	x, err := exif.Decode(f)
	if err != nil {
		return nil
	}

	// Register Nikon/Tags/etc.
	exif.RegisterParsers(mknote.All...)

	m := make(map[string]interface{})

	if tag, err := x.Get(exif.Make); err == nil {
		if v, err := tag.StringVal(); err == nil {
			m["make"] = v
		}
	}
	if tag, err := x.Get(exif.Model); err == nil {
		if v, err := tag.StringVal(); err == nil {
			m["model"] = v
		}
	}
	if tag, err := x.Get(exif.DateTimeOriginal); err == nil {
		if v, err := tag.StringVal(); err == nil {
			m["dateTimeOriginal"] = v
		}
	}
	if tag, err := x.Get(exif.ISOSpeedRatings); err == nil {
		if s, err := tag.StringVal(); err == nil {
			if v, err := strconv.ParseInt(s, 10, 64); err == nil {
				m["iso"] = v
			}
		}
	}
	if tag, err := x.Get(exif.FocalLength); err == nil {
		n, d, err := tag.Rat2(0)
		if err == nil && d != 0 {
			m["focalLength"] = fmt.Sprintf("%.1f mm", float64(n)/float64(d))
		}
	}
	if tag, err := x.Get(exif.FNumber); err == nil {
		n, d, err := tag.Rat2(0)
		if err == nil && d != 0 {
			m["aperture"] = fmt.Sprintf("%.1f", float64(n)/float64(d))
		}
	}
	if tag, err := x.Get(exif.ExposureTime); err == nil {
		n, d, err := tag.Rat2(0)
		if err == nil && d != 0 {
			m["exposureTime"] = fmt.Sprintf("%d/%d", n, d)
		}
	}
	if tag, err := x.Get(exif.PixelXDimension); err == nil {
		if s, err := tag.StringVal(); err == nil {
			if v, err := strconv.ParseInt(s, 10, 64); err == nil {
				m["width"] = v
			}
		}
	}
	if tag, err := x.Get(exif.PixelYDimension); err == nil {
		if s, err := tag.StringVal(); err == nil {
			if v, err := strconv.ParseInt(s, 10, 64); err == nil {
				m["height"] = v
			}
		}
	}
	if tag, err := x.Get(exif.Software); err == nil {
		if v, err := tag.StringVal(); err == nil {
			m["software"] = v
		}
	}

	// GPS
	lat, lng, err := x.LatLong()
	if err == nil {
		m["gpsLat"] = lat
		m["gpsLng"] = lng
	}

	return m
}

// ── Handlers ───────────────────────────────────────────────────────────────

func (h *MediaHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file"})
		return
	}

	caption := c.PostForm("caption")
	photographer := c.PostForm("photographer")
	dateTaken := c.PostForm("date_taken")
	fileName := c.PostForm("name")

	ext := filepath.Ext(file.Filename)
	name := uuid.New().String() + ext
	if fileName == "" {
		fileName = name
	}
	dst := filepath.Join(h.cfg.StoragePath, name)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save failed"})
		return
	}

	url := fmt.Sprintf("/app/storage/%s", name)
	mime := file.Header.Get("Content-Type")
	thumbnailURL := ""
	webpURL := ""
	width := 0
	height := 0
	var exifData map[string]interface{}

	if isImage(mime) {
		// Dimensions
		if f, err := os.Open(dst); err == nil {
			cfg, _, err := image.DecodeConfig(f)
			f.Close()
			if err == nil {
				width = cfg.Width
				height = cfg.Height
			}
		}

		// Thumbnail
		thumbDst := thumbPath(h.cfg.StoragePath, name)
		if err := generateThumbnail(dst, thumbDst); err == nil {
			thumbName := filepath.Base(thumbDst)
			thumbnailURL = fmt.Sprintf("/app/storage/%s", thumbName)
		}

		// EXIF (JPEG only — handled by goexif)
		if strings.HasPrefix(mime, "image/jpeg") {
			exifData = extractExif(dst)
		}
	}

	// Uploader from JWT context (set by auth middleware)
	var uploaderID *uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		if parsed, err := uuid.Parse(uid.(string)); err == nil {
			uploaderID = &parsed
		}
	}

	var id string
	err = h.db.QueryRow(
		c,
		`INSERT INTO media_files
			(name, url, thumbnail_url, webp_url, mime_type, size, width, height,
			 caption, photographer, date_taken, uploader_id, exif)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
		fileName, url, thumbnailURL, webpURL, mime, file.Size,
		width, height, caption, photographer, dateTaken, uploaderID, toJSON(exifData),
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id": id, "url": url, "name": fileName, "caption": caption,
		"thumbnailUrl": thumbnailURL, "webpUrl": webpURL,
		"width": width, "height": height,
	})
}

func (h *MediaHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var m MediaFile
	err := h.db.QueryRow(c, `
		SELECT id, name, url, thumbnail_url, webp_url, mime_type, size,
		       width, height, gallery_published, caption, photographer,
		       date_taken, uploader_id, exif, locked, views, created_at, updated_at
		FROM media_files WHERE id=$1`, id,
	).Scan(
		&m.ID, &m.Name, &m.URL, &m.ThumbnailURL, &m.WebpURL,
		&m.MimeType, &m.Size, &m.Width, &m.Height,
		&m.GalleryPublished, &m.Caption, &m.Photographer,
		&m.DateTaken, &m.UploaderID, &m.Exif, &m.Locked,
		&m.Views, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, m)
}

func (h *MediaHandler) List(c *gin.Context) {
	galleryOnly := c.Query("gallery") == "true"
	q := `
		SELECT id, name, url, thumbnail_url, webp_url, mime_type, size,
		       width, height, gallery_published, caption, photographer,
		       date_taken, uploader_id, exif, locked, views, created_at, updated_at
		FROM media_files`
	if galleryOnly {
		q += " WHERE gallery_published=true"
	}
	q += " ORDER BY created_at DESC"

	rows, err := h.db.Query(c, q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var files []gin.H
	for rows.Next() {
		var m MediaFile
		if rows.Scan(
			&m.ID, &m.Name, &m.URL, &m.ThumbnailURL, &m.WebpURL,
			&m.MimeType, &m.Size, &m.Width, &m.Height,
			&m.GalleryPublished, &m.Caption, &m.Photographer,
			&m.DateTaken, &m.UploaderID, &m.Exif, &m.Locked,
			&m.Views, &m.CreatedAt, &m.UpdatedAt,
		) == nil {
			files = append(files, gin.H{
				"id": m.ID, "name": m.Name, "url": m.URL,
				"thumbnailUrl": m.ThumbnailURL, "webpUrl": m.WebpURL,
				"mimeType": m.MimeType, "size": m.Size,
				"width": m.Width, "height": m.Height,
				"galleryPublished": m.GalleryPublished,
				"caption": m.Caption, "photographer": m.Photographer,
				"dateTaken": m.DateTaken, "uploaderId": m.UploaderID,
				"exif": m.Exif, "locked": m.Locked, "views": m.Views,
				"createdAt": m.CreatedAt, "updatedAt": m.UpdatedAt,
			})
		}
	}
	if files == nil {
		files = []gin.H{}
	}
	c.JSON(http.StatusOK, files)
}

func (h *MediaHandler) SetGallery(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Published bool `json:"published"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Exec(c, `UPDATE media_files SET gallery_published=$1 WHERE id=$2`, req.Published, id)
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *MediaHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	// Prevent deletion if locked
	var locked bool
	h.db.QueryRow(c, `SELECT locked FROM media_files WHERE id=$1`, id).Scan(&locked)
	if locked {
		c.JSON(http.StatusForbidden, gin.H{"error": "file is locked — remove it from the UI first"})
		return
	}

	h.db.Exec(c, `DELETE FROM media_files WHERE id=$1`, id)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *MediaHandler) UpdateName(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	_, err := h.db.Exec(c, `UPDATE media_files SET name=$1, updated_at=NOW() WHERE id=$2`, req.Name, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *MediaHandler) UpdateCaption(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Caption string `json:"caption"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_, err := h.db.Exec(c, `UPDATE media_files SET caption=$1, updated_at=NOW() WHERE id=$2`, req.Caption, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *MediaHandler) UpdateMetadata(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Name         *string `json:"name"`
		Caption      *string `json:"caption"`
		Photographer *string `json:"photographer"`
		DateTaken    *string `json:"dateTaken"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Build dynamic UPDATE
	set := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.Name != nil {
		set = append(set, fmt.Sprintf("name=$%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Caption != nil {
		set = append(set, fmt.Sprintf("caption=$%d", argIdx))
		args = append(args, *req.Caption)
		argIdx++
	}
	if req.Photographer != nil {
		set = append(set, fmt.Sprintf("photographer=$%d", argIdx))
		args = append(args, *req.Photographer)
		argIdx++
	}
	if req.DateTaken != nil {
		set = append(set, fmt.Sprintf("date_taken=$%d", argIdx))
		args = append(args, *req.DateTaken)
		argIdx++
	}

	if len(set) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	set = append(set, fmt.Sprintf("updated_at=NOW()"))
	args = append(args, id)
	q := fmt.Sprintf("UPDATE media_files SET %s WHERE id=$%d", strings.Join(set, ", "), argIdx)

	_, err := h.db.Exec(c, q, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// ── MediaFile scan helper ──────────────────────────────────────────────────
type MediaFile struct {
	ID               uuid.UUID              `json:"id"`
	Name             string                 `json:"name"`
	URL              string                 `json:"url"`
	ThumbnailURL     string                 `json:"thumbnailUrl,omitempty"`
	WebpURL          string                 `json:"webpUrl,omitempty"`
	MimeType         string                 `json:"mimeType"`
	Size             int64                  `json:"size"`
	Width            int                    `json:"width,omitempty"`
	Height           int                    `json:"height,omitempty"`
	GalleryPublished bool                   `json:"galleryPublished"`
	Caption          string                 `json:"caption,omitempty"`
	Photographer     string                 `json:"photographer,omitempty"`
	DateTaken        string                 `json:"dateTaken,omitempty"`
	UploaderID       *uuid.UUID             `json:"uploaderId,omitempty"`
	Exif             map[string]interface{} `json:"exif,omitempty"`
	Locked           bool                   `json:"locked"`
	Views            int                    `json:"views,omitempty"`
	CreatedAt        time.Time              `json:"createdAt"`
	UpdatedAt        time.Time              `json:"updatedAt"`
}

// toJSON converts a map to JSON bytes (nil-safe).
func toJSON(m map[string]interface{}) interface{} {
	if m == nil {
		m = map[string]interface{}{}
	}
	return m
}
