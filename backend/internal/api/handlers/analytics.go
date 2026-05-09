package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AnalyticsHandler struct{ db *pgxpool.Pool }

func NewAnalyticsHandler(db *pgxpool.Pool) *AnalyticsHandler { return &AnalyticsHandler{db: db} }

// Track records a page view. Called by the frontend on every route change.
func (h *AnalyticsHandler) Track(c *gin.Context) {
	var req struct {
		Path     string `json:"path" binding:"required"`
		Referrer string `json:"referrer"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ua := c.GetHeader("User-Agent")
	_, err := h.db.Exec(c,
		`INSERT INTO page_views (path, referrer, ua) VALUES ($1,$2,$3)`,
		req.Path, req.Referrer, ua,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Stats returns aggregated analytics for the CMS dashboard.
func (h *AnalyticsHandler) Stats(c *gin.Context) {
	days := 30

	// Total views
	var totalViews int
	h.db.QueryRow(c, `SELECT COUNT(*) FROM page_views WHERE ts > NOW() - INTERVAL '30 days'`).Scan(&totalViews)

	// Unique sessions (approximate by distinct UA+day)
	var uniqueSessions int
	h.db.QueryRow(c, `SELECT COUNT(DISTINCT (ua, ts::date)) FROM page_views WHERE ts > NOW() - INTERVAL '30 days'`).Scan(&uniqueSessions)

	// Top pages
	topPages := []gin.H{}
	rows, _ := h.db.Query(c,
		`SELECT path, COUNT(*) as views FROM page_views WHERE ts > NOW() - INTERVAL '30 days' GROUP BY path ORDER BY views DESC LIMIT 10`)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var path string
			var views int
			if rows.Scan(&path, &views) == nil {
				topPages = append(topPages, gin.H{"path": path, "views": views})
			}
		}
	}

	// Top referrers
	topReferrers := []gin.H{}
	rows2, _ := h.db.Query(c,
		`SELECT COALESCE(NULLIF(referrer,''), 'Direct'), COUNT(*) as views FROM page_views WHERE ts > NOW() - INTERVAL '30 days' GROUP BY 1 ORDER BY views DESC LIMIT 10`)
	if rows2 != nil {
		defer rows2.Close()
		for rows2.Next() {
			var ref string
			var views int
			if rows2.Scan(&ref, &views) == nil {
				topReferrers = append(topReferrers, gin.H{"referrer": ref, "views": views})
			}
		}
	}

	// Browser breakdown
	browsers := map[string]int{}
	rows3, _ := h.db.Query(c, `SELECT ua FROM page_views WHERE ts > NOW() - INTERVAL '30 days'`)
	if rows3 != nil {
		defer rows3.Close()
		for rows3.Next() {
			var ua string
			if rows3.Scan(&ua) == nil {
				browsers[parseBrowser(ua)]++
			}
		}
	}

	// Views per day (last 14 days)
	dailyViews := []gin.H{}
	rows4, _ := h.db.Query(c,
		`SELECT ts::date as day, COUNT(*) FROM page_views WHERE ts > NOW() - INTERVAL '14 days' GROUP BY day ORDER BY day`)
	if rows4 != nil {
		defer rows4.Close()
		for rows4.Next() {
			var day interface{}
			var count int
			if rows4.Scan(&day, &count) == nil {
				dailyViews = append(dailyViews, gin.H{"day": day, "views": count})
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"totalViews":     totalViews,
		"uniqueSessions": uniqueSessions,
		"topPages":       topPages,
		"topReferrers":   topReferrers,
		"browsers":       browsers,
		"dailyViews":     dailyViews,
		"days":           days,
	})
}

// Get / Update kept for backward compat (config blob)
func (h *AnalyticsHandler) Get(c *gin.Context) {
	var id string
	var config interface{}
	var updatedAt interface{}
	h.db.QueryRow(c, `SELECT id, config, updated_at FROM analytics_config LIMIT 1`).Scan(&id, &config, &updatedAt)
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
	h.db.Exec(c, `UPDATE analytics_config SET config=$1, updated_at=NOW()`, req.Config)
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func parseBrowser(ua string) string {
	ua = strings.ToLower(ua)
	switch {
	case strings.Contains(ua, "edg/"):
		return "Edge"
	case strings.Contains(ua, "chrome") && !strings.Contains(ua, "chromium"):
		return "Chrome"
	case strings.Contains(ua, "firefox"):
		return "Firefox"
	case strings.Contains(ua, "safari") && !strings.Contains(ua, "chrome"):
		return "Safari"
	case strings.Contains(ua, "opera") || strings.Contains(ua, "opr/"):
		return "Opera"
	default:
		return "Other"
	}
}
