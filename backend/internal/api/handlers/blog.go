package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BlogHandler struct{ db *pgxpool.Pool }

func NewBlogHandler(db *pgxpool.Pool) *BlogHandler { return &BlogHandler{db: db} }

func (h *BlogHandler) List(c *gin.Context) {
	// Public: only published; CMS: all
	filter := "WHERE status='published'"
	if c.GetBool("authenticated") {
		filter = ""
	}
	rows, err := h.db.Query(c,
		`SELECT id, slug, title, excerpt, body, cover_image, status, author_id, published_at, created_at, updated_at
		 FROM blog_posts `+filter+` ORDER BY created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var posts []gin.H
	for rows.Next() {
		var id, slug, title, excerpt, body, status string
		var coverImage, authorID *string
		var publishedAt *time.Time
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &slug, &title, &excerpt, &body, &coverImage, &status, &authorID, &publishedAt, &createdAt, &updatedAt); err != nil {
			continue
		}
		posts = append(posts, gin.H{
			"id": id, "slug": slug, "title": title, "excerpt": excerpt, "body": body,
			"coverImage": coverImage, "status": status, "authorId": authorID,
			"publishedAt": publishedAt, "createdAt": createdAt, "updatedAt": updatedAt,
		})
	}
	if posts == nil {
		posts = []gin.H{}
	}
	c.JSON(http.StatusOK, posts)
}

func (h *BlogHandler) Get(c *gin.Context) {
	slug := c.Param("slug")
	var id, title, excerpt, body, status string
	var coverImage, authorID *string
	var publishedAt *time.Time
	var createdAt, updatedAt time.Time
	err := h.db.QueryRow(c,
		`SELECT id, title, excerpt, body, cover_image, status, author_id, published_at, created_at, updated_at FROM blog_posts WHERE slug=$1`, slug,
	).Scan(&id, &title, &excerpt, &body, &coverImage, &status, &authorID, &publishedAt, &createdAt, &updatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "post not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id": id, "slug": slug, "title": title, "excerpt": excerpt, "body": body,
		"coverImage": coverImage, "status": status, "authorId": authorID,
		"publishedAt": publishedAt, "createdAt": createdAt, "updatedAt": updatedAt,
	})
}

func (h *BlogHandler) Create(c *gin.Context) {
	var req struct {
		Slug       string `json:"slug" binding:"required"`
		Title      string `json:"title" binding:"required"`
		Excerpt    string `json:"excerpt"`
		Body       string `json:"body"`
		CoverImage string `json:"coverImage"`
		Status     string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Status == "" {
		req.Status = "draft"
	}
	authorID, _ := c.Get("userID")
	var coverImage *string
	if req.CoverImage != "" {
		coverImage = &req.CoverImage
	}
	var publishedAt *time.Time
	if req.Status == "published" {
		now := time.Now()
		publishedAt = &now
	}
	var id string
	err := h.db.QueryRow(c,
		`INSERT INTO blog_posts (slug, title, excerpt, body, cover_image, status, author_id, published_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		req.Slug, req.Title, req.Excerpt, req.Body, coverImage, req.Status, authorID, publishedAt,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *BlogHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Title      *string `json:"title"`
		Slug       *string `json:"slug"`
		Excerpt    *string `json:"excerpt"`
		Body       *string `json:"body"`
		CoverImage *string `json:"coverImage"`
		Status     *string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Set published_at when first publishing
	var publishedAt *time.Time
	if req.Status != nil && *req.Status == "published" {
		now := time.Now()
		publishedAt = &now
	}
	_, err := h.db.Exec(c,
		`UPDATE blog_posts SET
			title=COALESCE($1,title), slug=COALESCE($2,slug), excerpt=COALESCE($3,excerpt),
			body=COALESCE($4,body), cover_image=COALESCE($5,cover_image),
			status=COALESCE($6,status),
			published_at=CASE WHEN $7::timestamptz IS NOT NULL THEN $7 ELSE published_at END,
			updated_at=NOW()
		 WHERE id=$8`,
		req.Title, req.Slug, req.Excerpt, req.Body, req.CoverImage, req.Status, publishedAt, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *BlogHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec(c, `DELETE FROM blog_posts WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
