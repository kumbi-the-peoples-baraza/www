package handlers

import (
	"fmt"
	"kumbi/internal/auth"
	"kumbi/internal/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UsersHandler struct {
	db   *pgxpool.Pool
	mail *services.EmailService
}

func NewUsersHandler(db *pgxpool.Pool, mail *services.EmailService) *UsersHandler {
	return &UsersHandler{db: db, mail: mail}
}

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
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Role == "" {
		req.Role = "viewer"
	}

	// When no password is supplied we still store a random one so the account
	// cannot be logged into with a known/empty value. The user receives a
	// one-time setup link (never the password) and sets their own on first use.
	password := req.Password
	if password == "" {
		generated, err := auth.GeneratePassword(16)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "password generation failed"})
			return
		}
		password = generated
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "hash failed"})
		return
	}
	var id string
	err = h.db.QueryRow(
		c,
		`INSERT INTO users (name, email, password, role, force_password_change) VALUES ($1,$2,$3,$4,false) RETURNING id`,
		req.Name, req.Email, hash, req.Role,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Email a setup link when no password was supplied. The link reuses the
	// forgot-password / reset-password flow, so no OTP is required.
	invited := false
	if req.Password == "" && h.mail != nil {
		if token, terr := auth.GenerateResetToken(); terr == nil {
			if _, derr := h.db.Exec(c,
				`INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1,$2,$3)`,
				id, token, auth.TokenExpiry()); derr == nil {
				if err := h.mail.SendInviteEmail(req.Email, req.Name, token); err != nil {
					fmt.Printf("invite email to %s failed: %v\n", req.Email, err)
				} else {
					invited = true
				}
			}
		}
	}

	c.JSON(http.StatusCreated, gin.H{"id": id, "invited": invited})
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
