package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"kumbi/internal/models"
	"kumbi/internal/notebooks/parser"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NotebookService struct {
	db *pgxpool.Pool
}

func NewNotebookService(db *pgxpool.Pool) *NotebookService {
	return &NotebookService{db: db}
}

func (s *NotebookService) CreateFromGitHub(ctx context.Context, req models.CreateNotebookRequest) (*models.Notebook, error) {
	rawURL, err := toRawGitHubURL(ctx, req.SourceURL)
	if err != nil {
		return nil, err
	}
	raw, err := fetchURL(ctx, rawURL)
	if err != nil {
		return nil, fmt.Errorf("fetching notebook: %w", err)
	}
	readme := fetchReadme(ctx, req.SourceURL)
	return s.storeWithReadme(ctx, req, raw, req.SourceURL, readme)
}

func (s *NotebookService) CreateFromUpload(ctx context.Context, req models.CreateNotebookRequest, raw []byte) (*models.Notebook, error) {
	return s.storeWithReadme(ctx, req, raw, "", "")
}

func (s *NotebookService) storeWithReadme(ctx context.Context, req models.CreateNotebookRequest, raw []byte, sourceURL, readme string) (*models.Notebook, error) {
	cells, meta, err := parser.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("parsing notebook: %w", err)
	}
	cellsJSON, err := json.Marshal(cells)
	if err != nil {
		return nil, err
	}
	nb := &models.Notebook{
		ID:          uuid.New(),
		Title:       req.Title,
		Description: req.Description,
		SourceType:  req.SourceType,
		SourceURL:   sourceURL,
		CellsJSON:   cellsJSON,
		Readme:      readme,
		Kernel:      meta.Kernel,
		Language:    meta.Language,
		Status:      "active",
	}
	_, err = s.db.Exec(ctx, `
		INSERT INTO notebooks (id, title, description, source_type, source_url, cells_json, readme, kernel, language, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		nb.ID, nb.Title, nb.Description, nb.SourceType, nb.SourceURL,
		nb.CellsJSON, nb.Readme, nb.Kernel, nb.Language, nb.Status,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting notebook: %w", err)
	}
	return nb, nil
}

func (s *NotebookService) List(ctx context.Context) ([]models.Notebook, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, title, description, source_type, source_url, cells_json, readme, kernel, language, status, created_at, updated_at
		 FROM notebooks WHERE status != 'deleted' ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var nbs []models.Notebook
	for rows.Next() {
		var nb models.Notebook
		if err := rows.Scan(&nb.ID, &nb.Title, &nb.Description, &nb.SourceType,
			&nb.SourceURL, &nb.CellsJSON, &nb.Readme, &nb.Kernel, &nb.Language,
			&nb.Status, &nb.CreatedAt, &nb.UpdatedAt); err != nil {
			return nil, err
		}
		nbs = append(nbs, nb)
	}
	return nbs, nil
}

func (s *NotebookService) GetByID(ctx context.Context, id uuid.UUID) (*models.Notebook, error) {
	var nb models.Notebook
	err := s.db.QueryRow(ctx,
		`SELECT id, title, description, source_type, source_url, cells_json, readme, kernel, language, status, created_at, updated_at
		 FROM notebooks WHERE id=$1 AND status != 'deleted'`, id).
		Scan(&nb.ID, &nb.Title, &nb.Description, &nb.SourceType,
			&nb.SourceURL, &nb.CellsJSON, &nb.Readme, &nb.Kernel, &nb.Language,
			&nb.Status, &nb.CreatedAt, &nb.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &nb, nil
}

func (s *NotebookService) Reload(ctx context.Context, id uuid.UUID) (*models.Notebook, error) {
	nb, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if nb.SourceType != "github_url" || nb.SourceURL == "" {
		return nil, fmt.Errorf("notebook %s is not GitHub-sourced", id)
	}
	rawURL, err := toRawGitHubURL(ctx, nb.SourceURL)
	if err != nil {
		return nil, err
	}
	raw, err := fetchURL(ctx, rawURL)
	if err != nil {
		return nil, err
	}
	cells, meta, err := parser.Parse(raw)
	if err != nil {
		return nil, err
	}
	cellsJSON, _ := json.Marshal(cells)
	readme := fetchReadme(ctx, nb.SourceURL)
	_, err = s.db.Exec(ctx,
		`UPDATE notebooks SET cells_json=$1, readme=$2, kernel=$3, language=$4 WHERE id=$5`,
		cellsJSON, readme, meta.Kernel, meta.Language, id)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *NotebookService) Archive(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.Exec(ctx,
		`UPDATE notebooks SET status='archived' WHERE id=$1`, id)
	return err
}

func (s *NotebookService) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.Exec(ctx,
		`UPDATE notebooks SET status='deleted' WHERE id=$1`, id)
	return err
}

// AttachToPage sets the notebook_id FK on a page row.
func (s *NotebookService) AttachToPage(ctx context.Context, pageID, notebookID uuid.UUID) error {
	_, err := s.db.Exec(ctx,
		`UPDATE pages SET notebook_id=$1 WHERE id=$2`, notebookID, pageID)
	return err
}

// DetachFromPage clears the notebook_id FK on a page row.
func (s *NotebookService) DetachFromPage(ctx context.Context, pageID uuid.UUID) error {
	_, err := s.db.Exec(ctx,
		`UPDATE pages SET notebook_id=NULL WHERE id=$1`, pageID)
	return err
}

// GetPageWithNotebook loads a page and joins its notebook if attached.
func (s *NotebookService) GetPageWithNotebook(ctx context.Context, slug string) (*models.Page, error) {
	var p models.Page
	var description *string
	var metadata, createdAt, updatedAt interface{}
	err := s.db.QueryRow(ctx,
		`SELECT id, slug, title, description, status, display_mode, "order", metadata, created_at, updated_at, notebook_id
		 FROM pages WHERE slug=$1`, slug).
		Scan(&p.ID, &p.Slug, &p.Title, &description, &p.Status,
			&p.DisplayMode, &p.Order, &metadata, &createdAt, &updatedAt, &p.NotebookID)
	if err != nil {
		return nil, fmt.Errorf("page not found: %w", err)
	}
	if description != nil {
		p.Description = *description
	}
	p.CreatedAt, _ = createdAt.(time.Time)
	p.UpdatedAt, _ = updatedAt.(time.Time)
	if p.NotebookID != nil {
		nb, err := s.GetByID(ctx, *p.NotebookID)
		if err == nil {
			p.Notebook = nb
		}
	}
	return &p, nil
}

func fetchURL(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}
	return io.ReadAll(resp.Body)
}

func toRawGitHubURL(ctx context.Context, u string) (string, error) {
	// Already a raw URL
	if strings.Contains(u, "raw.githubusercontent.com") {
		return u, nil
	}

	// Blob URL: https://github.com/owner/repo/blob/branch/path.ipynb
	if strings.Contains(u, "/blob/") {
		raw := strings.Replace(u, "https://github.com/", "https://raw.githubusercontent.com/", 1)
		raw = strings.Replace(raw, "/blob/", "/", 1)
		return raw, nil
	}

	// Repo root URL: https://github.com/owner/repo
	// Use GitHub API to find the first .ipynb file
	u = strings.TrimSuffix(u, "/")
	parts := strings.Split(strings.TrimPrefix(u, "https://github.com/"), "/")
	if len(parts) < 2 {
		return "", fmt.Errorf("cannot resolve GitHub URL: %s", u)
	}
	owner, repo := parts[0], parts[1]
	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/", owner, repo)

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("GitHub API error: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("GitHub API returned %d for %s", resp.StatusCode, apiURL)
	}

	var files []struct {
		Name        string `json:"name"`
		DownloadURL string `json:"download_url"`
		Type        string `json:"type"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&files); err != nil {
		return "", fmt.Errorf("parsing GitHub API response: %w", err)
	}
	for _, f := range files {
		if f.Type == "file" && strings.HasSuffix(strings.ToLower(f.Name), ".ipynb") && f.DownloadURL != "" {
			return f.DownloadURL, nil
		}
	}
	return "", fmt.Errorf("no .ipynb file found in repo %s/%s", owner, repo)
}

// fetchReadme tries to fetch README.md from a GitHub repo URL. Returns empty string on failure.
func fetchReadme(ctx context.Context, sourceURL string) string {
	// Only works for github.com repo URLs
	u := strings.TrimSuffix(sourceURL, "/")
	if !strings.Contains(u, "github.com") {
		return ""
	}
	// Normalise to repo root (strip /blob/... or /tree/... paths)
	parts := strings.Split(strings.TrimPrefix(u, "https://github.com/"), "/")
	if len(parts) < 2 {
		return ""
	}
	rawURL := fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/main/README.md", parts[0], parts[1])
	raw, err := fetchURL(ctx, rawURL)
	if err != nil {
		// Try master branch
		rawURL = fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/master/README.md", parts[0], parts[1])
		raw, err = fetchURL(ctx, rawURL)
		if err != nil {
			return ""
		}
	}
	return string(raw)
}
