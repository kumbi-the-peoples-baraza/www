package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ContentHandler struct{ db *pgxpool.Pool }

func NewContentHandler(db *pgxpool.Pool) *ContentHandler { return &ContentHandler{db: db} }

func (h *ContentHandler) List(c *gin.Context) {
	pageID := c.Param("pageId")
	rows, err := h.db.Query(c,
		`SELECT id, page_id, type, content, media_url, "order", settings, created_at, updated_at FROM content_blocks WHERE page_id=$1 ORDER BY "order"`,
		pageID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var blocks []gin.H
	for rows.Next() {
		var id, pid, btype, content string
		var mediaURL *string
		var order int
		var settings interface{}
		var createdAt, updatedAt interface{}
		if err := rows.Scan(&id, &pid, &btype, &content, &mediaURL, &order, &settings, &createdAt, &updatedAt); err != nil {
			continue
		}
		blocks = append(blocks, gin.H{
			"id": id, "pageId": pid, "type": btype, "content": content,
			"mediaUrl": mediaURL, "order": order, "settings": settings,
			"createdAt": createdAt, "updatedAt": updatedAt,
		})
	}
	if blocks == nil {
		blocks = []gin.H{}
	}
	c.JSON(http.StatusOK, blocks)
}

func (h *ContentHandler) Create(c *gin.Context) {
	pageID := c.Param("pageId")
	var req struct {
		Type     string `json:"type" binding:"required"`
		Content  string `json:"content"`
		MediaURL string `json:"mediaUrl"`
		Order    int    `json:"order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var mediaURL *string
	if req.MediaURL != "" {
		mediaURL = &req.MediaURL
	}
	var id string
	err := h.db.QueryRow(c,
		`INSERT INTO content_blocks (page_id, type, content, media_url, "order") VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		pageID, req.Type, req.Content, mediaURL, req.Order,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *ContentHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Content  *string `json:"content"`
		MediaURL *string `json:"mediaUrl"`
		Order    *int    `json:"order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_, err := h.db.Exec(c,
		`UPDATE content_blocks SET content=COALESCE($1,content), media_url=COALESCE($2,media_url), "order"=COALESCE($3,"order"), updated_at=NOW() WHERE id=$4`,
		req.Content, req.MediaURL, req.Order, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *ContentHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec(c, `DELETE FROM content_blocks WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
