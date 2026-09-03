package routes

import (
	"kumbi/internal/api/handlers"
	"kumbi/internal/api/middleware"
	"kumbi/internal/config"
	"kumbi/internal/services"
	"net/http"
	"strings"

	nbhandlers "kumbi/internal/notebooks/handlers"
	nbservices "kumbi/internal/notebooks/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

func Setup(cfg *config.Config, db *pgxpool.Pool, log zerolog.Logger) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.Recovery(log))
	r.Use(middleware.Logger(log))
	r.Use(middleware.RateLimit())
	r.MaxMultipartMemory = 10 << 20 // 10 MB upload limit
	// ALLOW_ORIGIN may be a comma-separated list (e.g. dev NodePorts differ
	// from the canonical https://kumbi.test origin).
	var origins []string
	for _, o := range strings.Split(cfg.AllowOrigin, ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	r.Static("/app/storage", cfg.StoragePath)
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	// Initialize services
	emailSvc := services.NewEmailService(cfg, db)
	geoSvc, err := services.NewGeoService("GeoLite2-Country.mmdb")
	if err != nil {
		log.Warn().Err(err).Msg("geo service disabled — GeoLite2-Country.mmdb not found")
	}

	// Initialize handlers
	authH := handlers.NewAuthHandler(db, cfg, emailSvc, geoSvc)
	pagesH := handlers.NewPagesHandler(db)
	formsH := handlers.NewFormsHandler(db, cfg, emailSvc, geoSvc)
	mediaH := handlers.NewMediaHandler(db, cfg)
	appearanceH := handlers.NewAppearanceHandler(db)
	usersH := handlers.NewUsersHandler(db, emailSvc)
	analyticsH := handlers.NewAnalyticsHandler(db)
	contentH := handlers.NewContentHandler(db)
	blogH := handlers.NewBlogHandler(db)
	configH := handlers.NewConfigHandler(db)
	peopleH := handlers.NewPeopleHandler(db)
	authorsH := handlers.NewAuthorsHandler(db)
	passwordResetH := handlers.NewPasswordResetHandler(db, cfg, emailSvc)
	securityH := handlers.NewSecurityHandler(db)
	runtimeH := handlers.NewRuntimeHandler(db)

	v1 := r.Group("/api/v1")

	// ── Public ──────────────────────────────────────────────────────────────
	v1.POST("/auth/login", authH.Login)
	v1.POST("/auth/logout", authH.Logout)
	v1.GET("/auth/me", middleware.Auth(cfg.JWTSecret), authH.Me)
	v1.GET("/auth/captcha-config", authH.CaptchaConfig)
	v1.POST("/auth/verify-otp", authH.VerifyOTP)
	v1.POST("/auth/refresh", middleware.Auth(cfg.JWTSecret), authH.Refresh)
	v1.POST("/auth/forgot-password", passwordResetH.ForgotPassword)
	v1.POST("/auth/verify-reset-otp", passwordResetH.VerifyResetOTP)
	v1.GET("/auth/verify-reset/:token", passwordResetH.VerifyReset)
	v1.POST("/auth/reset-password", passwordResetH.ResetPassword)
	v1.POST("/auth/set-password", passwordResetH.SetPassword)

	v1.GET("/pages", pagesH.List)
	v1.GET("/pages/:slug", pagesH.Get)
	v1.GET("/appearance", appearanceH.Get)
	v1.GET("/analytics", analyticsH.Get)
	v1.GET("/config", configH.Get)
	v1.POST("/track", analyticsH.Track)
	v1.GET("/captcha/challenge", formsH.CaptchaChallenge)
	v1.POST("/forms/contact", formsH.Submit("contact"))
	v1.POST("/forms/volunteer", formsH.Submit("volunteer"))

	v1.GET("/blog", blogH.List)
	v1.GET("/blog/popular", blogH.Popular)
	v1.GET("/blog/:slug", blogH.Get)

	v1.GET("/media/gallery", func(c *gin.Context) {
		c.Request.URL.RawQuery = "gallery=true"
		mediaH.List(c)
	})

	v1.POST("/runtime-errors", runtimeH.Record)

	// Public people (published only)
	v1.GET("/people", peopleH.List)
	v1.GET("/people/:id", peopleH.Get)

	// ── Protected CMS ────────────────────────────────────────────────────────
	cms := v1.Group("/", middleware.Auth(cfg.JWTSecret))
	{
		cms.POST("/pages", middleware.RequireRole("admin", "editor"), pagesH.Create)
		cms.PUT("/pages/:id", middleware.RequireRole("admin", "editor"), pagesH.Update)
		cms.DELETE("/pages/:id", middleware.RequireRole("admin"), pagesH.Delete)

		cms.GET("/forms/:type/submissions", middleware.RequireRole("admin", "editor"), formsH.ListSubmissions)
		cms.GET("/forms/:type/export/csv", middleware.RequireRole("admin", "editor"), formsH.ExportCSV)
		cms.GET("/forms/:type/export/pdf", middleware.RequireRole("admin", "editor"), formsH.ExportPDF)

		cms.POST("/media", mediaH.Upload)
		cms.GET("/media", mediaH.List)
		cms.GET("/media/:id", mediaH.Get)
		cms.PUT("/media/:id/gallery", middleware.RequireRole("admin", "editor"), mediaH.SetGallery)
		cms.PUT("/media/:id/name", middleware.RequireRole("admin", "editor"), mediaH.UpdateName)
		cms.PUT("/media/:id/caption", middleware.RequireRole("admin", "editor"), mediaH.UpdateCaption)
		cms.PUT("/media/:id/metadata", middleware.RequireRole("admin", "editor"), mediaH.UpdateMetadata)
		cms.DELETE("/media/:id", middleware.RequireRole("admin"), mediaH.Delete)

		cms.PUT("/appearance", middleware.RequireRole("admin"), appearanceH.Update)
		cms.PUT("/config", middleware.RequireRole("admin", "editor"), configH.Update)

		cms.GET("/users", middleware.RequireRole("admin"), usersH.List)
		cms.POST("/users", middleware.RequireRole("admin"), usersH.Create)
		cms.PUT("/users/:id", middleware.RequireRole("admin"), usersH.Update)
		cms.DELETE("/users/:id", middleware.RequireRole("admin"), usersH.Delete)

		cms.PUT("/analytics", middleware.RequireRole("admin"), analyticsH.Update)
		cms.GET("/analytics/stats", middleware.RequireRole("admin", "editor"), analyticsH.Stats)

		nbSvc := nbservices.NewNotebookService(db)
		nbHandler := nbhandlers.NewNotebookHandler(nbSvc)

		nbHandler.RegisterRoutes(v1, cms)

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

		// Authors (searchable, create-if-not-found)
		cms.GET("/authors", authorsH.Search)
		cms.GET("/authors/:id", authorsH.Get)

		// Runtime errors (admin only) — super simple viewer for client-side errors like CAPTCHA
		cms.GET("/runtime-errors", middleware.RequireRole("admin"), runtimeH.List)
		cms.DELETE("/runtime-errors", middleware.RequireRole("admin"), runtimeH.Clear)

		// Security (admin only)
		cms.GET("/security/sessions", middleware.RequireRole("admin"), securityH.GetSessions)
		cms.GET("/security/sessions/:id", middleware.RequireRole("admin"), securityH.GetUserSessions)
		cms.GET("/security/suspicious-logins", middleware.RequireRole("admin"), securityH.GetSuspiciousLogins)
		cms.GET("/security/login-attempts", middleware.RequireRole("admin"), securityH.GetLoginAttempts)
		cms.GET("/security/events", middleware.RequireRole("admin"), securityH.GetSecurityEvents)
		cms.GET("/security/locked-users", middleware.RequireRole("admin"), securityH.GetLockedUsers)
		cms.POST("/security/unlock/:id", middleware.RequireRole("admin"), securityH.UnlockUser)
		cms.GET("/security/otp-status", middleware.RequireRole("admin"), securityH.GetOTPStatus)
		cms.POST("/security/block-ip", middleware.RequireRole("admin"), securityH.BlockIP)
		cms.POST("/security/block-device", middleware.RequireRole("admin"), securityH.BlockDevice)
		cms.GET("/security/blocked-ips", middleware.RequireRole("admin"), securityH.GetBlockedIPs)
		cms.DELETE("/security/unblock-ip/:id", middleware.RequireRole("admin"), securityH.UnblockIP)
	}

	return r
}
