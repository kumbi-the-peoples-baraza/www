package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AppearanceHandler struct{ db *pgxpool.Pool }

func NewAppearanceHandler(db *pgxpool.Pool) *AppearanceHandler { return &AppearanceHandler{db: db} }

func (h *AppearanceHandler) Get(c *gin.Context) {
	var id, primaryColor, secondaryColor, gradientStart, gradientEnd, fontFamily string
	var backgroundImage, foregroundImage *string
	var darkMode bool
	var updatedAt interface{}
	err := h.db.QueryRow(c, `SELECT id, primary_color, secondary_color, gradient_start, gradient_end, background_image, foreground_image, dark_mode, font_family, updated_at FROM appearance LIMIT 1`).
		Scan(&id, &primaryColor, &secondaryColor, &gradientStart, &gradientEnd, &backgroundImage, &foregroundImage, &darkMode, &fontFamily, &updatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id": id, "primaryColor": primaryColor, "secondaryColor": secondaryColor,
		"gradientStart": gradientStart, "gradientEnd": gradientEnd,
		"backgroundImage": backgroundImage, "foregroundImage": foregroundImage,
		"darkMode": darkMode, "fontFamily": fontFamily, "updatedAt": updatedAt,
	})
}

func (h *AppearanceHandler) Update(c *gin.Context) {
	var req struct {
		PrimaryColor    *string `json:"primaryColor"`
		SecondaryColor  *string `json:"secondaryColor"`
		GradientStart   *string `json:"gradientStart"`
		GradientEnd     *string `json:"gradientEnd"`
		BackgroundImage *string `json:"backgroundImage"`
		ForegroundImage *string `json:"foregroundImage"`
		DarkMode        *bool   `json:"darkMode"`
		FontFamily      *string `json:"fontFamily"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_, err := h.db.Exec(c,
		`UPDATE appearance SET primary_color=COALESCE($1,primary_color), secondary_color=COALESCE($2,secondary_color), gradient_start=COALESCE($3,gradient_start), gradient_end=COALESCE($4,gradient_end), background_image=COALESCE($5,background_image), foreground_image=COALESCE($6,foreground_image), dark_mode=COALESCE($7,dark_mode), font_family=COALESCE($8,font_family), updated_at=NOW()`,
		req.PrimaryColor, req.SecondaryColor, req.GradientStart, req.GradientEnd, req.BackgroundImage, req.ForegroundImage, req.DarkMode, req.FontFamily,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}
