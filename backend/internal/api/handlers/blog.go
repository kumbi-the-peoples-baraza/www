package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	sanitizepkg "kumbi/pkg/sanitize"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BlogHandler struct{ db *pgxpool.Pool }

func NewBlogHandler(db *pgxpool.Pool) *BlogHandler { return &BlogHandler{db: db} }

// postCols is the shared column list; blog posts LEFT JOIN authors so byline
// details travel with the post. Order must match scanPost.
const postCols = `b.id, b.slug, b.title, b.excerpt, b.body, b.cover_image, b.cover_caption,
	b.status, b.blog_author_id,
	a.name, a.bio, a.email, a.phone,
	b.published_at, b.created_at, b.updated_at, b.gallery_images`

func scanPost(rows interface {
	Scan(...any) error
}) (gin.H, error) {
	var id, slug, title, excerpt, body, status string
	var coverImage, coverCaption, blogAuthorID, authorName, authorBio, authorEmail, authorPhone *string
	var publishedAt *time.Time
	var createdAt, updatedAt time.Time
	var galleryImages []byte
	err := rows.Scan(
		&id, &slug, &title, &excerpt, &body, &coverImage, &coverCaption,
		&status, &blogAuthorID,
		&authorName, &authorBio, &authorEmail, &authorPhone,
		&publishedAt, &createdAt, &updatedAt, &galleryImages,
	)
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

	var author interface{}
	if blogAuthorID != nil {
		author = gin.H{
			"id":     *blogAuthorID,
			"name":   deref(authorName),
			"bio":    deref(authorBio),
			"email":  deref(authorEmail),
			"phone":  deref(authorPhone),
		}
	}

	return gin.H{
		"id": id, "slug": slug, "title": title, "excerpt": excerpt, "body": body,
		"coverImage": coverImage, "coverCaption": coverCaption, "status": status,
		"authorId": blogAuthorID, "author": author,
		"publishedAt": publishedAt, "createdAt": createdAt, "updatedAt": updatedAt,
		"galleryImages": gallery,
	}, nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (h *BlogHandler) List(c *gin.Context) {
	filter := "WHERE b.status='published'"
	if c.GetBool("authenticated") {
		filter = ""
	}
	limit := 30
	offset := 0
	rows, err := h.db.Query(c, `
		SELECT `+postCols+` FROM blog_posts b
		LEFT JOIN authors a ON a.id = b.blog_author_id
		`+filter+` ORDER BY b.created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
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
		SELECT `+postCols+`, COUNT(pv.id) as view_count
		FROM blog_posts b
		LEFT JOIN authors a ON a.id = b.blog_author_id
		LEFT JOIN page_views pv ON pv.path = '/blog/' || b.slug
		WHERE b.status='published'
		GROUP BY b.id, a.id
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
		var coverImage, coverCaption, blogAuthorID, authorName, authorBio, authorEmail, authorPhone *string
		var publishedAt *time.Time
		var createdAt, updatedAt time.Time
		var galleryImages []byte
		var viewCount int
		if err := rows.Scan(
			&id, &slug, &title, &excerpt, &body, &coverImage, &coverCaption,
			&status, &blogAuthorID,
			&authorName, &authorBio, &authorEmail, &authorPhone,
			&publishedAt, &createdAt, &updatedAt, &galleryImages,
			&viewCount,
		); err != nil {
			continue
		}
		var gallery interface{}
		if len(galleryImages) > 0 {
			json.Unmarshal(galleryImages, &gallery)
		}
		if gallery == nil {
			gallery = []interface{}{}
		}
		var author interface{}
		if blogAuthorID != nil {
			author = gin.H{
				"id":     *blogAuthorID,
				"name":   deref(authorName),
				"bio":    deref(authorBio),
				"email":  deref(authorEmail),
				"phone":  deref(authorPhone),
			}
		}
		posts = append(posts, gin.H{
			"id": id, "slug": slug, "title": title, "excerpt": excerpt, "body": body,
			"coverImage": coverImage, "coverCaption": coverCaption, "status": status,
			"authorId": blogAuthorID, "author": author,
			"publishedAt": publishedAt, "createdAt": createdAt, "updatedAt": updatedAt,
			"galleryImages": gallery, "viewCount": viewCount,
		})
	}
	if posts == nil {
		posts = []gin.H{}
	}
	c.JSON(http.StatusOK, posts)
}

func (h *BlogHandler) Get(c *gin.Context) {
	slug := c.Param("slug")
	row := h.db.QueryRow(c, `
		SELECT `+postCols+` FROM blog_posts b
		LEFT JOIN authors a ON a.id = b.blog_author_id
		WHERE b.slug=$1`, slug)
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
		BlogAuthorID  string        `json:"blogAuthorId"`
		AuthorName    string        `json:"authorName"`
		AuthorBio     string        `json:"authorBio"`
		AuthorEmail   string        `json:"authorEmail"`
		AuthorPhone   string        `json:"authorPhone"`
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
	req.Title = sanitizepkg.HTML(req.Title)
	req.Excerpt = sanitizepkg.HTML(req.Excerpt)
	req.Body = sanitizepkg.NormalizeContent(req.Body)
	req.CoverCaption = sanitizepkg.HTML(req.CoverCaption)

	var coverImage, coverCaption, blogAuthorID *string
	if req.CoverImage != "" {
		coverImage = &req.CoverImage
	}
	if req.CoverCaption != "" {
		coverCaption = &req.CoverCaption
	}
	if aid, err := h.resolveAuthor(c, req.BlogAuthorID, req.AuthorName, req.AuthorBio, req.AuthorEmail, req.AuthorPhone); err == nil && aid != "" {
		blogAuthorID = &aid
	}

	var publishedAt *time.Time
	if req.Status == "published" {
		now := time.Now()
		publishedAt = &now
	}
	galleryJSON, _ := json.Marshal(req.GalleryImages)
	var id string
	err := h.db.QueryRow(c,
		`INSERT INTO blog_posts (slug, title, excerpt, body, cover_image, cover_caption, status, blog_author_id, published_at, gallery_images) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		req.Slug, req.Title, req.Excerpt, req.Body, coverImage, coverCaption, req.Status, blogAuthorID, publishedAt, galleryJSON,
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
		BlogAuthorID  *string       `json:"blogAuthorId"`
		AuthorName    *string       `json:"authorName"`
		AuthorBio     *string       `json:"authorBio"`
		AuthorEmail   *string       `json:"authorEmail"`
		AuthorPhone   *string       `json:"authorPhone"`
		Status        *string       `json:"status"`
		GalleryImages []interface{} `json:"galleryImages"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Title != nil {
		s := sanitizepkg.HTML(*req.Title)
		req.Title = &s
	}
	if req.Excerpt != nil {
		s := sanitizepkg.HTML(*req.Excerpt)
		req.Excerpt = &s
	}
	if req.Body != nil {
		s := sanitizepkg.NormalizeContent(*req.Body)
		req.Body = &s
	}
	if req.CoverCaption != nil {
		s := sanitizepkg.HTML(*req.CoverCaption)
		req.CoverCaption = &s
	}

	var blogAuthorID *string
	if req.BlogAuthorID != nil && *req.BlogAuthorID != "" {
		if aid, err := h.resolveAuthor(c, *req.BlogAuthorID,
			derefStr(req.AuthorName), derefStr(req.AuthorBio), derefStr(req.AuthorEmail), derefStr(req.AuthorPhone)); err == nil && aid != "" {
			blogAuthorID = &aid
		}
	} else if req.AuthorName != nil && *req.AuthorName != "" {
		if aid, err := h.resolveAuthor(c, "", *req.AuthorName, derefStr(req.AuthorBio), derefStr(req.AuthorEmail), derefStr(req.AuthorPhone)); err == nil && aid != "" {
			blogAuthorID = &aid
		}
	}

	// Track publication date independently: only set it when the post transitions
	// into the "published" state (not on every save of an already-published post).
	var oldStatus string
	h.db.QueryRow(c, `SELECT status FROM blog_posts WHERE id=$1`, id).Scan(&oldStatus)

	var publishedAt *time.Time
	if req.Status != nil && *req.Status == "published" && oldStatus != "published" {
		now := time.Now()
		publishedAt = &now
	}

	galleryJSON, _ := json.Marshal(req.GalleryImages)
	_, err := h.db.Exec(c,
		`UPDATE blog_posts SET
			title=COALESCE($1,title), slug=COALESCE($2,slug), excerpt=COALESCE($3,excerpt),
			body=COALESCE($4,body), cover_image=COALESCE($5,cover_image),
			cover_caption=COALESCE($6,cover_caption),
			blog_author_id=COALESCE($7,blog_author_id),
			status=COALESCE($8,status),
			published_at=CASE WHEN $9::timestamptz IS NOT NULL THEN $9 ELSE published_at END,
			gallery_images=CASE WHEN $10::jsonb IS NOT NULL THEN $10 ELSE gallery_images END,
			updated_at=NOW()
		 WHERE id=$11`,
		req.Title, req.Slug, req.Excerpt, req.Body, req.CoverImage, req.CoverCaption, blogAuthorID, req.Status, publishedAt, galleryJSON, id,
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

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// resolveAuthor upserts a blog author record from the editor fieldset and
// returns its id. If authorID is provided the existing row is updated (created
// if missing); otherwise a new row is inserted when a name is supplied.
func (h *BlogHandler) resolveAuthor(c *gin.Context, authorID, name, bio, email, phone string) (string, error) {
	if name == "" && authorID == "" {
		return "", nil
	}
	if authorID != "" {
		_, err := h.db.Exec(c,
			`UPDATE authors SET name=COALESCE(NULLIF($1,''),name), bio=$2, email=$3, phone=$4, updated_at=NOW() WHERE id=$5`,
			name, bio, email, phone, authorID)
		if err != nil {
			return "", err
		}
		var exists bool
		h.db.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM authors WHERE id=$1)`, authorID).Scan(&exists)
		if !exists {
			if _, err := h.db.Exec(c,
				`INSERT INTO authors (id, name, bio, email, phone) VALUES ($1,$2,$3,$4,$5)`,
				authorID, name, bio, email, phone); err != nil {
				return "", err
			}
		}
		return authorID, nil
	}
	// No linked id: only create if not already in the database (unique email/phone).
	var existingID string
	if email != "" {
		h.db.QueryRow(c, `SELECT id FROM authors WHERE email=$1`, email).Scan(&existingID)
	}
	if existingID == "" && phone != "" {
		h.db.QueryRow(c, `SELECT id FROM authors WHERE phone=$1`, phone).Scan(&existingID)
	}
	if existingID != "" {
		if _, err := h.db.Exec(c,
			`UPDATE authors SET name=COALESCE(NULLIF($1,''),name), bio=$2, email=$3, phone=$4, updated_at=NOW() WHERE id=$5`,
			name, bio, email, phone, existingID); err != nil {
			return "", err
		}
		return existingID, nil
	}
	var newID string
	err := h.db.QueryRow(c,
		`INSERT INTO authors (name, bio, email, phone) VALUES ($1,$2,$3,$4) RETURNING id`,
		name, bio, email, phone).Scan(&newID)
	return newID, err
}
