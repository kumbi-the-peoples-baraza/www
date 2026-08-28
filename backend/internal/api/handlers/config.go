package handlers

import (
	"encoding/json"
	"net/http"

	sanitizepkg "kumbi/pkg/sanitize"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/net/html"
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
	// Decode any persisted HTML entities (e.g. &#39;) so the CMS and site never
	// render raw character references. Sanitization on write keeps the DB clean
	// going forward; this is the read-side safety net.
	decodeEntities(data)
	c.JSON(http.StatusOK, data)
}

func (h *ConfigHandler) Update(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Sanitize all string leaves in site_config before storage
	sanitizeMap(body)
	bodyJSON, _ := json.Marshal(body)
	_, err := h.db.Exec(c,
		`UPDATE site_config SET data=$1, updated_at=NOW() WHERE id='default'`, bodyJSON,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func sanitizeMap(m map[string]interface{}) {
	for k, v := range m {
		switch vv := v.(type) {
		case string:
			m[k] = sanitizepkg.NormalizeContent(vv)
		case map[string]interface{}:
			sanitizeMap(vv)
		case []interface{}:
			for i, el := range vv {
				if s, ok := el.(string); ok {
					vv[i] = sanitizepkg.NormalizeContent(s)
				} else if mm, ok := el.(map[string]interface{}); ok {
					sanitizeMap(mm)
				}
			}
		}
	}
}

// decodeEntities recursively converts HTML character references (e.g. &#39;,
// &amp;) back into their corresponding characters before content is rendered.
func decodeEntities(v interface{}) interface{} {
	switch t := v.(type) {
	case string:
		return html.UnescapeString(t)
	case map[string]interface{}:
		for k, val := range t {
			t[k] = decodeEntities(val)
		}
		return t
	case []interface{}:
		for i, val := range t {
			t[i] = decodeEntities(val)
		}
		return t
	default:
		return v
	}
}
