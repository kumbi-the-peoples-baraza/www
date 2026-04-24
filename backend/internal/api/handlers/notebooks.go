package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kumbi/backend/internal/config"
)

type NotebooksHandler struct {
	db  *pgxpool.Pool
	cfg *config.Config
}

func NewNotebooksHandler(db *pgxpool.Pool, cfg *config.Config) *NotebooksHandler {
	return &NotebooksHandler{db: db, cfg: cfg}
}

func (h *NotebooksHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("notebook")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file"})
		return
	}

	name := uuid.New().String() + ".ipynb"
	dst := filepath.Join(h.cfg.StoragePath, "notebooks", name)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save failed"})
		return
	}

	var id string
	err = h.db.QueryRow(c,
		`INSERT INTO notebooks (name, path) VALUES ($1,$2) RETURNING id`,
		file.Filename, fmt.Sprintf("/storage/notebooks/%s", name),
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "name": file.Filename})
}

func (h *NotebooksHandler) List(c *gin.Context) {
	rows, err := h.db.Query(
		c,
		`SELECT id, name, path, uploaded_at FROM notebooks ORDER BY uploaded_at DESC`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var notebooks []gin.H
	for rows.Next() {
		var id, name, path string
		var uploadedAt interface{}
		if err := rows.Scan(&id, &name, &path, &uploadedAt); err != nil {
			continue
		}
		notebooks = append(
			notebooks,
			gin.H{"id": id, "name": name, "path": path, "uploadedAt": uploadedAt},
		)
	}
	if notebooks == nil {
		notebooks = []gin.H{}
	}
	c.JSON(http.StatusOK, notebooks)
}

func (h *NotebooksHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var name, path string
	var uploadedAt interface{}
	err := h.db.QueryRow(c, `SELECT name, path, uploaded_at FROM notebooks WHERE id=$1`, id).
		Scan(&name, &path, &uploadedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "name": name, "path": path, "uploadedAt": uploadedAt})
}
