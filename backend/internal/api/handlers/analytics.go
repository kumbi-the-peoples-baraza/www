package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AnalyticsHandler struct{ db *pgxpool.Pool }

func NewAnalyticsHandler(db *pgxpool.Pool) *AnalyticsHandler { return &AnalyticsHandler{db: db} }

func (h *AnalyticsHandler) Get(c *gin.Context) {
	var id string
	var config interface{}
	var updatedAt interface{}
	err := h.db.QueryRow(c, `SELECT id, config, updated_at FROM analytics_config LIMIT 1`).
		Scan(&id, &config, &updatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "config": config, "updatedAt": updatedAt})
}

func (h *AnalyticsHandler) Update(c *gin.Context) {
	var req struct {
		Config map[string]interface{} `json:"config" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	b, _ := json.Marshal(req.Config)
	_, err := h.db.Exec(c,
		`UPDATE analytics_config SET config=$1, updated_at=NOW()`,
		string(b),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}
