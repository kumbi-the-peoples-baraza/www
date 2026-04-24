package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kumbi/backend/internal/config"
	"github.com/kumbi/backend/internal/services"
)

type FormsHandler struct {
	db       *pgxpool.Pool
	cfg      *config.Config
	notifier *services.Notifier
}

func NewFormsHandler(db *pgxpool.Pool, cfg *config.Config) *FormsHandler {
	return &FormsHandler{db: db, cfg: cfg, notifier: services.NewNotifier(cfg)}
}

func (h *FormsHandler) Submit(formType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var data map[string]interface{}
		if err := c.ShouldBindJSON(&data); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		b, _ := json.Marshal(data)
		_, err := h.db.Exec(
			c,
			`INSERT INTO form_submissions (form_type, data) VALUES ($1, $2)`,
			formType,
			string(b),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		go h.notifier.Notify(formType, data)
		c.JSON(http.StatusCreated, gin.H{"message": "submitted"})
	}
}

func (h *FormsHandler) ListSubmissions(c *gin.Context) {
	formType := c.Param("type")
	rows, err := h.db.Query(
		c,
		`SELECT id, form_type, data, created_at FROM form_submissions WHERE form_type=$1 ORDER BY created_at DESC`,
		formType,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var submissions []gin.H
	for rows.Next() {
		var id, ft string
		var data interface{}
		var createdAt interface{}
		if err := rows.Scan(&id, &ft, &data, &createdAt); err != nil {
			continue
		}
		submissions = append(
			submissions,
			gin.H{"id": id, "formType": ft, "data": data, "createdAt": createdAt},
		)
	}
	if submissions == nil {
		submissions = []gin.H{}
	}
	c.JSON(http.StatusOK, submissions)
}

func (h *FormsHandler) ExportCSV(c *gin.Context) {
	formType := c.Param("type")
	rows, err := h.db.Query(
		c,
		`SELECT data, created_at FROM form_submissions WHERE form_type=$1 ORDER BY created_at DESC`,
		formType,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="`+formType+`-submissions.csv"`)

	w := c.Writer
	w.WriteString("data,created_at\n")
	for rows.Next() {
		var data interface{}
		var createdAt interface{}
		if err := rows.Scan(&data, &createdAt); err != nil {
			continue
		}
		b, _ := json.Marshal(data)
		w.WriteString(
			`"` + string(
				b,
			) + `","` + createdAt.(interface{ String() string }).String() + `"` + "\n",
		)
	}
}
