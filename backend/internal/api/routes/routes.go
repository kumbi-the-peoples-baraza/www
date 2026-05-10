package routes

import (
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kumbi/backend/internal/api/handlers"
	"github.com/kumbi/backend/internal/api/middleware"
	"github.com/kumbi/backend/internal/config"
	"github.com/rs/zerolog"
)

func Setup(cfg *config.Config, db *pgxpool.Pool, log zerolog.Logger) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.Recovery(log))
	r.Use(middleware.Logger(log))
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.AllowOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	r.Static("/storage", cfg.StoragePath)
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	authH       := handlers.NewAuthHandler(db, cfg)
	pagesH      := handlers.NewPagesHandler(db)
	formsH      := handlers.NewFormsHandler(db, cfg)
	mediaH      := handlers.NewMediaHandler(db, cfg)
	notebooksH  := handlers.NewNotebooksHandler(db, cfg)
	appearanceH := handlers.NewAppearanceHandler(db)
	usersH      := handlers.NewUsersHandler(db)
	analyticsH  := handlers.NewAnalyticsHandler(db)
	contentH    := handlers.NewContentHandler(db)
	blogH       := handlers.NewBlogHandler(db)
	configH     := handlers.NewConfigHandler(db)
	peopleH     := handlers.NewPeopleHandler(db)

	v1 := r.Group("/api/v1")

	// ── Public ──────────────────────────────────────────────────────────────
	v1.POST("/auth/login", authH.Login)
	v1.POST("/auth/logout", authH.Logout)
	v1.GET("/auth/me", middleware.Auth(cfg.JWTSecret), authH.Me)

	v1.GET("/pages", pagesH.List)
	v1.GET("/pages/:slug", pagesH.Get)
	v1.GET("/appearance", appearanceH.Get)
	v1.GET("/analytics", analyticsH.Get)
	v1.GET("/config", configH.Get)
	v1.POST("/track", analyticsH.Track)
	v1.POST("/forms/contact", formsH.Submit("contact"))
	v1.POST("/forms/volunteer", formsH.Submit("volunteer"))

	v1.GET("/blog", blogH.List)
	v1.GET("/blog/popular", blogH.Popular)
	v1.GET("/blog/:slug", blogH.Get)

	v1.GET("/media/gallery", func(c *gin.Context) {
		c.Request.URL.RawQuery = "gallery=true"
		mediaH.List(c)
	})

	// Public people (published only)
	v1.GET("/people", peopleH.List)

	// ── Protected CMS ────────────────────────────────────────────────────────
	cms := v1.Group("/", middleware.Auth(cfg.JWTSecret))
	{
		cms.POST("/pages", middleware.RequireRole("admin", "editor"), pagesH.Create)
		cms.PUT("/pages/:id", middleware.RequireRole("admin", "editor"), pagesH.Update)
		cms.DELETE("/pages/:id", middleware.RequireRole("admin"), pagesH.Delete)

		cms.GET("/forms/:type/submissions", middleware.RequireRole("admin", "editor"), formsH.ListSubmissions)
		cms.GET("/forms/:type/export/csv", middleware.RequireRole("admin", "editor"), formsH.ExportCSV)

		cms.POST("/media", mediaH.Upload)
		cms.GET("/media", mediaH.List)
		cms.PUT("/media/:id/gallery", middleware.RequireRole("admin", "editor"), mediaH.SetGallery)
		cms.DELETE("/media/:id", middleware.RequireRole("admin"), mediaH.Delete)

		cms.POST("/notebooks", middleware.RequireRole("admin", "editor"), notebooksH.Upload)
		cms.POST("/notebooks/import-github", middleware.RequireRole("admin", "editor"), notebooksH.ImportFromGitHub)
		cms.GET("/notebooks", notebooksH.List)
		cms.GET("/notebooks/:id", notebooksH.Get)

		cms.PUT("/appearance", middleware.RequireRole("admin"), appearanceH.Update)
		cms.PUT("/config", middleware.RequireRole("admin", "editor"), configH.Update)

		cms.GET("/users", middleware.RequireRole("admin"), usersH.List)
		cms.POST("/users", middleware.RequireRole("admin"), usersH.Create)
		cms.PUT("/users/:id", middleware.RequireRole("admin"), usersH.Update)
		cms.DELETE("/users/:id", middleware.RequireRole("admin"), usersH.Delete)

		cms.PUT("/analytics", middleware.RequireRole("admin"), analyticsH.Update)
		cms.GET("/analytics/stats", middleware.RequireRole("admin", "editor"), analyticsH.Stats)

		cms.GET("/dashboard/stats", func(c *gin.Context) {
			var pages, users, submissions, views int
			db.QueryRow(c, `SELECT COUNT(*) FROM pages`).Scan(&pages)
			db.QueryRow(c, `SELECT COUNT(*) FROM users`).Scan(&users)
			db.QueryRow(c, `SELECT COUNT(*) FROM form_submissions`).Scan(&submissions)
			db.QueryRow(c, `SELECT COUNT(*) FROM page_views WHERE ts > NOW() - INTERVAL '30 days'`).Scan(&views)
			c.JSON(http.StatusOK, gin.H{"pages": pages, "users": users, "formSubmissions": submissions, "pageViews30d": views})
		})

		cms.GET("/blog/all", func(c *gin.Context) { c.Set("authenticated", true); blogH.List(c) })
		cms.POST("/blog", middleware.RequireRole("admin", "editor"), blogH.Create)
		cms.PUT("/blog/:id", middleware.RequireRole("admin", "editor"), blogH.Update)
		cms.DELETE("/blog/:id", middleware.RequireRole("admin"), blogH.Delete)

		cms.GET("/content/:pageId", contentH.List)
		cms.POST("/content/:pageId", middleware.RequireRole("admin", "editor"), contentH.Create)
		cms.PUT("/content/:id", middleware.RequireRole("admin", "editor"), contentH.Update)
		cms.DELETE("/content/:id", middleware.RequireRole("admin", "editor"), contentH.Delete)

		// People / team
		cms.GET("/people/all", func(c *gin.Context) { c.Set("authenticated", true); peopleH.List(c) })
		cms.POST("/people", middleware.RequireRole("admin", "editor"), peopleH.Create)
		cms.PUT("/people/:id", middleware.RequireRole("admin", "editor"), peopleH.Update)
		cms.DELETE("/people/:id", middleware.RequireRole("admin"), peopleH.Delete)
	}

	return r
}
