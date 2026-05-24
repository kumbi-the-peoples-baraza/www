package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PagesHandler struct{ db *pgxpool.Pool }

func NewPagesHandler(db *pgxpool.Pool) *PagesHandler { return &PagesHandler{db: db} }

func (h *PagesHandler) List(c *gin.Context) {
	rows, err := h.db.Query(c, `SELECT id, slug, title, description, status, display_mode, "order", metadata, created_at, updated_at, notebook_id FROM pages ORDER BY "order"`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var pages []gin.H
	for rows.Next() {
		var id, slug, title, status, displayMode string
		var description *string
		var order int
		var metadata, createdAt, updatedAt interface{}
		var notebookID *string
		if err := rows.Scan(&id, &slug, &title, &description, &status, &displayMode, &order, &metadata, &createdAt, &updatedAt, &notebookID); err != nil {
			continue
		}
		pages = append(pages, gin.H{
			"id": id, "slug": slug, "title": title,
			"description": description, "status": status,
			"displayMode": displayMode, "order": order,
			"metadata": metadata, "createdAt": createdAt, "updatedAt": updatedAt,
			"notebookId": notebookID,
		})
	}
	if pages == nil {
		pages = []gin.H{}
	}
	c.JSON(http.StatusOK, pages)
}

func (h *PagesHandler) Get(c *gin.Context) {
	slug := c.Param("slug")
	var id, title, desc, status, displayMode string
	var order int
	var metadata interface{}
	var createdAt, updatedAt interface{}
	err := h.db.QueryRow(c, `SELECT id, title, description, status, display_mode, "order", metadata, created_at, updated_at FROM pages WHERE slug=$1`, slug).
		Scan(&id, &title, &desc, &status, &displayMode, &order, &metadata, &createdAt, &updatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "page not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id": id, "slug": slug, "title": title, "description": desc,
		"status": status, "displayMode": displayMode, "order": order,
		"metadata": metadata, "createdAt": createdAt, "updatedAt": updatedAt,
	})
}

func (h *PagesHandler) Create(c *gin.Context) {
	var req struct {
		Slug        string `json:"slug" binding:"required"`
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		Status      string `json:"status"`
		DisplayMode string `json:"displayMode"`
		Order       int    `json:"order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Status == "" { req.Status = "draft" }
	if req.DisplayMode == "" { req.DisplayMode = "full" }

	var id string
	err := h.db.QueryRow(c,
		`INSERT INTO pages (slug, title, description, status, display_mode, "order") VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		req.Slug, req.Title, req.Description, req.Status, req.DisplayMode, req.Order,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *PagesHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		Status      *string `json:"status"`
		DisplayMode *string `json:"displayMode"`
		Order       *int    `json:"order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_, err := h.db.Exec(c,
		`UPDATE pages SET title=COALESCE($1,title), description=COALESCE($2,description), status=COALESCE($3,status), display_mode=COALESCE($4,display_mode), "order"=COALESCE($5,"order"), updated_at=NOW() WHERE id=$6`,
		req.Title, req.Description, req.Status, req.DisplayMode, req.Order, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *PagesHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec(c, `DELETE FROM pages WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
