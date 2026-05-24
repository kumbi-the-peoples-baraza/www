package handlers

import (
	"io"
	"kumbi/internal/models"
	"kumbi/internal/notebooks/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type NotebookHandler struct {
	svc *services.NotebookService
}

func NewNotebookHandler(svc *services.NotebookService) *NotebookHandler {
	return &NotebookHandler{svc: svc}
}

func (h *NotebookHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	// Public render — returns page + notebook cells for a slug
	public.GET("/notebooks/page/:slug", h.GetPageWithNotebook)

	// Protected CMS routes
	nb := protected.Group("/notebooks")
	nb.GET("", h.List)
	nb.POST("", h.Create)
	nb.GET("/:id", h.Get)
	nb.POST("/:id/reload", h.Reload)
	nb.POST("/:id/archive", h.Archive)
	nb.DELETE("/:id", h.Delete)
	nb.POST("/:id/attach/:page", h.AttachToPage)
	nb.DELETE("/:id/attach/:page", h.DetachFromPage)
}

func (h *NotebookHandler) List(c *gin.Context) {
	nbs, err := h.svc.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, nbs)
}

func (h *NotebookHandler) Create(c *gin.Context) {
	// Multipart upload
	if c.ContentType() != "application/json" {
		title := c.PostForm("title")
		if title == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "title required"})
			return
		}
		file, fh, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
			return
		}
		defer file.Close()
		raw, err := io.ReadAll(file)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "reading file"})
			return
		}
		req := models.CreateNotebookRequest{
			Title:       title,
			Description: c.PostForm("description"),
			SourceType:  "local_upload",
			SourceURL:   fh.Filename,
		}
		nb, err := h.svc.CreateFromUpload(c.Request.Context(), req, raw)
		if err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, nb)
		return
	}

	// GitHub URL
	var req models.CreateNotebookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	nb, err := h.svc.CreateFromGitHub(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, nb)
}

func (h *NotebookHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	nb, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, nb)
}

func (h *NotebookHandler) Reload(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	nb, err := h.svc.Reload(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, nb)
}

func (h *NotebookHandler) Archive(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.svc.Archive(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *NotebookHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *NotebookHandler) AttachToPage(c *gin.Context) {
	nbID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid notebook id"})
		return
	}
	pageID, err := uuid.Parse(c.Param("page"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid page id"})
		return
	}
	if err := h.svc.AttachToPage(c.Request.Context(), pageID, nbID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *NotebookHandler) DetachFromPage(c *gin.Context) {
	pageID, err := uuid.Parse(c.Param("page"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid page id"})
		return
	}
	if err := h.svc.DetachFromPage(c.Request.Context(), pageID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *NotebookHandler) GetPageWithNotebook(c *gin.Context) {
	page, err := h.svc.GetPageWithNotebook(c.Request.Context(), c.Param("slug"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, page)
}
