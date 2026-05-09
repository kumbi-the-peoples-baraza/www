package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ConfigHandler struct{ db *pgxpool.Pool }

func NewConfigHandler(db *pgxpool.Pool) *ConfigHandler { return &ConfigHandler{db: db} }

func (h *ConfigHandler) Get(c *gin.Context) {
	var data interface{}
	err := h.db.QueryRow(c, `SELECT data FROM site_config WHERE id='default'`).Scan(&data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *ConfigHandler) Update(c *gin.Context) {
	var body interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_, err := h.db.Exec(c,
		`UPDATE site_config SET data=$1, updated_at=NOW() WHERE id='default'`, body,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}
