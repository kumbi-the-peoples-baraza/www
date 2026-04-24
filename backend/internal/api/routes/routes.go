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

	// Static storage
	r.Static("/storage", cfg.StoragePath)

	// Health
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	// Handlers
	authH := handlers.NewAuthHandler(db, cfg)
	pagesH := handlers.NewPagesHandler(db)
	formsH := handlers.NewFormsHandler(db, cfg)
	mediaH := handlers.NewMediaHandler(db, cfg)
	notebooksH := handlers.NewNotebooksHandler(db, cfg)
	appearanceH := handlers.NewAppearanceHandler(db)

	v1 := r.Group("/api/v1")

	// Auth
	v1.POST("/auth/login", authH.Login)
	v1.POST("/auth/logout", authH.Logout)
	v1.GET("/auth/me", middleware.Auth(cfg.JWTSecret), authH.Me)

	// Public
	v1.GET("/pages", pagesH.List)
	v1.GET("/pages/:slug", pagesH.Get)
	v1.GET("/appearance", appearanceH.Get)
	v1.POST("/forms/contact", formsH.Submit("contact"))
	v1.POST("/forms/volunteer", formsH.Submit("volunteer"))

	// Protected CMS
	cms := v1.Group("/", middleware.Auth(cfg.JWTSecret))
	{
		cms.POST("/pages", middleware.RequireRole("admin", "editor"), pagesH.Create)
		cms.PUT("/pages/:id", middleware.RequireRole("admin", "editor"), pagesH.Update)
		cms.DELETE("/pages/:id", middleware.RequireRole("admin"), pagesH.Delete)

		cms.GET(
			"/forms/:type/submissions",
			middleware.RequireRole("admin", "editor"),
			formsH.ListSubmissions,
		)
		cms.GET(
			"/forms/:type/export/csv",
			middleware.RequireRole("admin", "editor"),
			formsH.ExportCSV,
		)

		cms.POST("/media", mediaH.Upload)
		cms.GET("/media", mediaH.List)
		cms.DELETE("/media/:id", middleware.RequireRole("admin"), mediaH.Delete)

		cms.POST("/notebooks", middleware.RequireRole("admin", "editor"), notebooksH.Upload)
		cms.GET("/notebooks", notebooksH.List)
		cms.GET("/notebooks/:id", notebooksH.Get)

		cms.PUT("/appearance", middleware.RequireRole("admin"), appearanceH.Update)
	}

	return r
}
