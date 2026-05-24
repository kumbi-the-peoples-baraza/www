package handlers

import (
	"kumbi/internal/auth"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UsersHandler struct{ db *pgxpool.Pool }

func NewUsersHandler(db *pgxpool.Pool) *UsersHandler { return &UsersHandler{db: db} }

func (h *UsersHandler) List(c *gin.Context) {
	rows, err := h.db.Query(c, `SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var users []gin.H
	for rows.Next() {
		var id, name, email, role string
		var active bool
		var createdAt interface{}
		if err := rows.Scan(&id, &name, &email, &role, &active, &createdAt); err != nil {
			continue
		}
		users = append(users, gin.H{"id": id, "name": name, "email": email, "role": role, "active": active, "createdAt": createdAt})
	}
	if users == nil {
		users = []gin.H{}
	}
	c.JSON(http.StatusOK, users)
}

func (h *UsersHandler) Create(c *gin.Context) {
	var req struct {
		Name     string `json:"name" binding:"required"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Role == "" {
		req.Role = "viewer"
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "hash failed"})
		return
	}
	var id string
	err = h.db.QueryRow(
		c,
		`INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id`,
		req.Name, req.Email, hash, req.Role,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *UsersHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Name     *string `json:"name"`
		Role     *string `json:"role"`
		Active   *bool   `json:"active"`
		Password *string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var hash *string
	if req.Password != nil {
		h, err := auth.HashPassword(*req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "hash failed"})
			return
		}
		hash = &h
	}

	_, err := h.db.Exec(
		c,
		`UPDATE users SET name=COALESCE($1,name), role=COALESCE($2,role), active=COALESCE($3,active), password=COALESCE($4,password), updated_at=NOW() WHERE id=$5`,
		req.Name, req.Role, req.Active, hash, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *UsersHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec(c, `DELETE FROM users WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
