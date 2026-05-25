package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BlogHandler struct{ db *pgxpool.Pool }

func NewBlogHandler(db *pgxpool.Pool) *BlogHandler { return &BlogHandler{db: db} }

func scanPost(rows interface {
	Scan(...any) error
}) (gin.H, error) {
	var id, slug, title, excerpt, body, status string
	var coverImage, coverCaption, authorID *string
	var publishedAt *time.Time
	var createdAt, updatedAt time.Time
	var galleryImages []byte
	err := rows.Scan(&id, &slug, &title, &excerpt, &body, &coverImage, &coverCaption, &status, &authorID, &publishedAt, &createdAt, &updatedAt, &galleryImages)
	if err != nil {
		return nil, err
	}
	var gallery interface{}
	if len(galleryImages) > 0 {
		json.Unmarshal(galleryImages, &gallery)
	}
	if gallery == nil {
		gallery = []interface{}{}
	}
	return gin.H{
		"id": id, "slug": slug, "title": title, "excerpt": excerpt, "body": body,
		"coverImage": coverImage, "coverCaption": coverCaption, "status": status,
		"authorId": authorID, "publishedAt": publishedAt, "createdAt": createdAt, "updatedAt": updatedAt,
		"galleryImages": gallery,
	}, nil
}

const selectCols = `id, slug, title, excerpt, body, cover_image, cover_caption, status, author_id, published_at, created_at, updated_at, gallery_images`

func (h *BlogHandler) List(c *gin.Context) {
	filter := "WHERE status='published'"
	if c.GetBool("authenticated") {
		filter = ""
	}
	// Pagination
	limit := 30
	offset := 0
	rows, err := h.db.Query(c,
		`SELECT `+selectCols+` FROM blog_posts `+filter+` ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var posts []gin.H
	for rows.Next() {
		if p, err := scanPost(rows); err == nil {
			posts = append(posts, p)
		}
	}
	if posts == nil {
		posts = []gin.H{}
	}
	c.JSON(http.StatusOK, posts)
}

// Popular returns posts ordered by page_views count
func (h *BlogHandler) Popular(c *gin.Context) {
	rows, err := h.db.Query(c, `
		SELECT b.`+selectCols+`, COUNT(pv.id) as view_count
		FROM blog_posts b
		LEFT JOIN page_views pv ON pv.path = '/blog/' || b.slug
		WHERE b.status='published'
		GROUP BY b.id
		ORDER BY view_count DESC
		LIMIT 20`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var posts []gin.H
	for rows.Next() {
		var id, slug, title, excerpt, body, status string
		var coverImage, coverCaption, authorID *string
		var publishedAt *time.Time
		var createdAt, updatedAt time.Time
		var viewCount int
		if rows.Scan(&id, &slug, &title, &excerpt, &body, &coverImage, &coverCaption, &status, &authorID, &publishedAt, &createdAt, &updatedAt, &viewCount) == nil {
			posts = append(posts, gin.H{
				"id": id, "slug": slug, "title": title, "excerpt": excerpt, "body": body,
				"coverImage": coverImage, "coverCaption": coverCaption, "status": status,
				"authorId": authorID, "publishedAt": publishedAt, "createdAt": createdAt, "updatedAt": updatedAt,
				"viewCount": viewCount,
			})
		}
	}
	if posts == nil {
		posts = []gin.H{}
	}
	c.JSON(http.StatusOK, posts)
}

func (h *BlogHandler) Get(c *gin.Context) {
	slug := c.Param("slug")
	row := h.db.QueryRow(c, `SELECT `+selectCols+` FROM blog_posts WHERE slug=$1`, slug)
	p, err := scanPost(row)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "post not found"})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *BlogHandler) Create(c *gin.Context) {
	var req struct {
		Slug          string        `json:"slug" binding:"required"`
		Title         string        `json:"title" binding:"required"`
		Excerpt       string        `json:"excerpt"`
		Body          string        `json:"body"`
		CoverImage    string        `json:"coverImage"`
		CoverCaption  string        `json:"coverCaption"`
		Status        string        `json:"status"`
		GalleryImages []interface{} `json:"galleryImages"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Status == "" {
		req.Status = "draft"
	}
	authorID, _ := c.Get("userID")
	var coverImage, coverCaption *string
	if req.CoverImage != "" {
		coverImage = &req.CoverImage
	}
	if req.CoverCaption != "" {
		coverCaption = &req.CoverCaption
	}
	var publishedAt *time.Time
	if req.Status == "published" {
		now := time.Now()
		publishedAt = &now
	}
	galleryJSON, _ := json.Marshal(req.GalleryImages)
	var id string
	err := h.db.QueryRow(c,
		`INSERT INTO blog_posts (slug, title, excerpt, body, cover_image, cover_caption, status, author_id, published_at, gallery_images) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		req.Slug, req.Title, req.Excerpt, req.Body, coverImage, coverCaption, req.Status, authorID, publishedAt, galleryJSON,
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
		Title         *string       `json:"title"`
		Slug          *string       `json:"slug"`
		Excerpt       *string       `json:"excerpt"`
		Body          *string       `json:"body"`
		CoverImage    *string       `json:"coverImage"`
		CoverCaption  *string       `json:"coverCaption"`
		Status        *string       `json:"status"`
		GalleryImages []interface{} `json:"galleryImages"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var publishedAt *time.Time
	if req.Status != nil && *req.Status == "published" {
		now := time.Now()
		publishedAt = &now
	}
	galleryJSON, _ := json.Marshal(req.GalleryImages)
	_, err := h.db.Exec(c,
		`UPDATE blog_posts SET
			title=COALESCE($1,title), slug=COALESCE($2,slug), excerpt=COALESCE($3,excerpt),
			body=COALESCE($4,body), cover_image=COALESCE($5,cover_image),
			cover_caption=COALESCE($6,cover_caption),
			status=COALESCE($7,status),
			published_at=CASE WHEN $8::timestamptz IS NOT NULL THEN $8 ELSE published_at END,
			gallery_images=CASE WHEN $10::jsonb IS NOT NULL THEN $10 ELSE gallery_images END,
			updated_at=NOW()
		 WHERE id=$9`,
		req.Title, req.Slug, req.Excerpt, req.Body, req.CoverImage, req.CoverCaption, req.Status, publishedAt, id, galleryJSON,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *BlogHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	h.db.Exec(c, `DELETE FROM blog_posts WHERE id=$1`, id)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
