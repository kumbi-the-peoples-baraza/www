package handlers

import (
	"fmt"
	"kumbi/internal/config"
	"net/http"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MediaHandler struct {
	db  *pgxpool.Pool
	cfg *config.Config
}

func NewMediaHandler(db *pgxpool.Pool, cfg *config.Config) *MediaHandler {
	return &MediaHandler{db: db, cfg: cfg}
}

func (h *MediaHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file"})
		return
	}
	ext := filepath.Ext(file.Filename)
	name := uuid.New().String() + ext
	dst := filepath.Join(h.cfg.StoragePath, name)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save failed"})
		return
	}
	url := fmt.Sprintf("/app/storage/%s", name)
	var id string
	err = h.db.QueryRow(
		c,
		`INSERT INTO media_files (name, url, mime_type, size) VALUES ($1,$2,$3,$4) RETURNING id`,
		file.Filename, url, file.Header.Get("Content-Type"), file.Size,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "url": url, "name": file.Filename})
}

func (h *MediaHandler) List(c *gin.Context) {
	galleryOnly := c.Query("gallery") == "true"
	q := `SELECT id, name, url, mime_type, size, gallery_published, created_at FROM media_files ORDER BY created_at DESC`
	if galleryOnly {
		q = `SELECT id, name, url, mime_type, size, gallery_published, created_at FROM media_files WHERE gallery_published=true ORDER BY created_at DESC`
	}
	rows, err := h.db.Query(c, q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var files []gin.H
	for rows.Next() {
		var id, name, url, mimeType string
		var size int64
		var galleryPublished bool
		var createdAt interface{}
		if rows.Scan(&id, &name, &url, &mimeType, &size, &galleryPublished, &createdAt) == nil {
			files = append(files, gin.H{"id": id, "name": name, "url": url, "mimeType": mimeType, "size": size, "galleryPublished": galleryPublished, "createdAt": createdAt})
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
	h.db.Exec(c, `DELETE FROM media_files WHERE id=$1`, id)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
