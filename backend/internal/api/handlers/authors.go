package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuthorsHandler struct{ db *pgxpool.Pool }

func NewAuthorsHandler(db *pgxpool.Pool) *AuthorsHandler { return &AuthorsHandler{db: db} }

const authorCols = `id, name, bio, email, phone, created_at, updated_at`

func scanAuthor(rows interface{ Scan(...any) error }) gin.H {
	var id, name, bio, email, phone string
	var createdAt, updatedAt interface{}
	rows.Scan(&id, &name, &bio, &email, &phone, &createdAt, &updatedAt)
	return gin.H{
		"id": id, "name": name, "bio": bio, "email": email, "phone": phone,
		"createdAt": createdAt, "updatedAt": updatedAt,
	}
}

// Search returns async, up-to-date author suggestions matching name/email/phone.
func (h *AuthorsHandler) Search(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	var (
		rows interface {
			Next() bool
			Scan(...any) error
			Close()
		}
		err error
	)
	if q == "" {
		rows, err = h.db.Query(c, `SELECT `+authorCols+` FROM authors ORDER BY name LIMIT 12`)
	} else {
		like := "%" + q + "%"
		rows, err = h.db.Query(c,
			`SELECT `+authorCols+` FROM authors WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 ORDER BY name LIMIT 12`, like)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var authors []gin.H
	for rows.Next() {
		authors = append(authors, scanAuthor(rows))
	}
	if authors == nil {
		authors = []gin.H{}
	}
	c.JSON(http.StatusOK, authors)
}

func (h *AuthorsHandler) Get(c *gin.Context) {
	id := c.Param("id")
	row := h.db.QueryRow(c, `SELECT `+authorCols+` FROM authors WHERE id=$1`, id)
	var aID, name, bio, email, phone string
	var createdAt, updatedAt interface{}
	if err := row.Scan(&aID, &name, &bio, &email, &phone, &createdAt, &updatedAt); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "author not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id": aID, "name": name, "bio": bio, "email": email, "phone": phone,
		"createdAt": createdAt, "updatedAt": updatedAt,
	})
}
