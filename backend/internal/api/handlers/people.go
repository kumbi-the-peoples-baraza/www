package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PeopleHandler struct{ db *pgxpool.Pool }

func NewPeopleHandler(db *pgxpool.Pool) *PeopleHandler { return &PeopleHandler{db: db} }

const peopleCols = `id, name, position, bio, portrait, published, "order", created_at`

func scanPerson(rows interface {
	Scan(...any) error
}) gin.H {
	var id, name, position, bio string
	var portrait *string
	var published bool
	var order int
	var createdAt interface{}
	rows.Scan(&id, &name, &position, &bio, &portrait, &published, &order, &createdAt)
	return gin.H{
		"id": id, "name": name, "position": position, "bio": bio, "portrait": portrait,
		"published": published, "order": order, "createdAt": createdAt,
	}
}

func (h *PeopleHandler) List(c *gin.Context) {
	publishedOnly := !c.GetBool("authenticated")
	q := `SELECT ` + peopleCols + ` FROM people`
	if publishedOnly {
		q += " WHERE published=true"
	}
	q += ` ORDER BY "order", created_at`

	rows, err := h.db.Query(c, q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var people []gin.H
	for rows.Next() {
		people = append(people, scanPerson(rows))
	}
	if people == nil {
		people = []gin.H{}
	}
	c.JSON(http.StatusOK, people)
}

func (h *PeopleHandler) Create(c *gin.Context) {
	var req struct {
		Name       string `json:"name" binding:"required"`
		Position   string `json:"position"`
		Bio        string `json:"bio"`
		Portrait   string `json:"portrait"`
		Published  bool   `json:"published"`
		Order      int    `json:"order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var portrait *string
	if req.Portrait != "" {
		portrait = &req.Portrait
	}
	var id string
	err := h.db.QueryRow(c,
		`INSERT INTO people (name, position, bio, portrait, published, "order")
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		req.Name, req.Position, req.Bio, portrait, req.Published, req.Order,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *PeopleHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Name       *string `json:"name"`
		Position   *string `json:"position"`
		Bio        *string `json:"bio"`
		Portrait   *string `json:"portrait"`
		Published  *bool   `json:"published"`
		Order      *int    `json:"order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_, err := h.db.Exec(c,
		`UPDATE people SET
			name=COALESCE($1,name), position=COALESCE($2,position), bio=COALESCE($3,bio),
			portrait=COALESCE($4,portrait), published=COALESCE($5,published), "order"=COALESCE($6,"order"),
			updated_at=NOW() WHERE id=$7`,
		req.Name, req.Position, req.Bio, req.Portrait, req.Published, req.Order, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *PeopleHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	h.db.Exec(c, `DELETE FROM people WHERE id=$1`, id)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
