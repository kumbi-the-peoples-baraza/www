package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RuntimeHandler struct{ db *pgxpool.Pool }

func NewRuntimeHandler(db *pgxpool.Pool) *RuntimeHandler { return &RuntimeHandler{db: db} }

func ensureRuntimeTable(c *gin.Context, db *pgxpool.Pool) {
	db.Exec(c, `CREATE TABLE IF NOT EXISTS runtime_errors (
		id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
		message TEXT NOT NULL,
		level TEXT NOT NULL DEFAULT 'error',
		context JSONB NOT NULL DEFAULT '{}',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
}

func (h *RuntimeHandler) Record(c *gin.Context) {
	ensureRuntimeTable(c, h.db)
	var req struct {
		Message   string                 `json:"message"`
		Level     string                 `json:"level"`
		Context   map[string]interface{} `json:"context"`
		Timestamp string                 `json:"timestamp"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Message == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message required"})
		return
	}
	if req.Level == "" {
		req.Level = "error"
	}
	ctxJSON, _ := json.Marshal(req.Context)
	if len(ctxJSON) == 0 {
		ctxJSON = []byte("{}")
	}
	_, err := h.db.Exec(c, `INSERT INTO runtime_errors (message, level, context) VALUES ($1,$2,$3)`, req.Message, req.Level, ctxJSON)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "logged"})
}

func (h *RuntimeHandler) List(c *gin.Context) {
	ensureRuntimeTable(c, h.db)
	rows, err := h.db.Query(c, `SELECT id, message, level, context, created_at FROM runtime_errors ORDER BY created_at DESC LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	type row struct {
		ID        string          `json:"id"`
		Message   string          `json:"message"`
		Level     string          `json:"level"`
		Context   json.RawMessage `json:"context"`
		CreatedAt interface{}     `json:"createdAt"`
	}
	var out []row
	for rows.Next() {
		var r row
		var ctx []byte
		if err := rows.Scan(&r.ID, &r.Message, &r.Level, &ctx, &r.CreatedAt); err != nil {
			continue
		}
		r.Context = json.RawMessage(ctx)
		out = append(out, r)
	}
	if out == nil {
		out = []row{}
	}
	c.JSON(http.StatusOK, out)
}

func (h *RuntimeHandler) Clear(c *gin.Context) {
	ensureRuntimeTable(c, h.db)
	h.db.Exec(c, `DELETE FROM runtime_errors`)
	c.JSON(http.StatusOK, gin.H{"status": "cleared"})
}
