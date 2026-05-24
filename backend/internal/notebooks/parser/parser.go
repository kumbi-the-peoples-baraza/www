package parser

import (
	"encoding/json"
	"fmt"
	"kumbi/internal/models"
	"strings"
)

// ipynbFormat is the raw .ipynb JSON structure (v4).
type ipynbFormat struct {
	NBFormat      int `json:"nbformat"`
	NBFormatMinor int `json:"nbformat_minor"`
	Metadata      struct {
		KernelInfo struct {
			Name string `json:"name"`
		} `json:"kernelspec"`
		LanguageInfo struct {
			Name string `json:"name"`
		} `json:"language_info"`
	} `json:"metadata"`
	Cells []rawCell `json:"cells"`
}

type rawCell struct {
	CellType string          `json:"cell_type"` // "code", "markdown", "raw"
	ID       string          `json:"id"`
	Source   multilineString `json:"source"`
	Outputs  []rawOutput     `json:"outputs"`
	Metadata json.RawMessage `json:"metadata"`
}

type rawOutput struct {
	OutputType string          `json:"output_type"`
	Data       json.RawMessage `json:"data"`
	Text       multilineString `json:"text"`
}

// multilineString handles both []string and plain string in .ipynb source fields.
type multilineString []string

func (m *multilineString) UnmarshalJSON(b []byte) error {
	// Try array first
	var arr []string
	if err := json.Unmarshal(b, &arr); err == nil {
		*m = arr
		return nil
	}
	// Fall back to plain string
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	*m = []string{s}
	return nil
}

func (m multilineString) Join() string {
	return strings.Join(m, "")
}

// NotebookMeta holds kernel/language info extracted during parsing.
type NotebookMeta struct {
	Kernel   string
	Language string
}

// Parse converts raw .ipynb JSON bytes into CellDTOs and metadata.
func Parse(raw []byte) ([]models.CellDTO, NotebookMeta, error) {
	var nb ipynbFormat
	if err := json.Unmarshal(raw, &nb); err != nil {
		return nil, NotebookMeta{}, fmt.Errorf("invalid .ipynb JSON: %w", err)
	}
	if nb.NBFormat < 4 {
		return nil, NotebookMeta{}, fmt.Errorf("only nbformat v4+ is supported (got v%d)", nb.NBFormat)
	}

	meta := NotebookMeta{
		Kernel:   nb.Metadata.KernelInfo.Name,
		Language: nb.Metadata.LanguageInfo.Name,
	}

	cells := make([]models.CellDTO, 0, len(nb.Cells))
	for i, rc := range nb.Cells {
		id := rc.ID
		if id == "" {
			id = fmt.Sprintf("cell-%d", i)
		}

		outputs := make([]models.OutputDTO, 0, len(rc.Outputs))
		for _, ro := range rc.Outputs {
			out := models.OutputDTO{
				OutputType: ro.OutputType,
				Data:       ro.Data,
				Text:       []string(ro.Text),
			}

			// Parse MIME bundle for display_data / execute_result
			if ro.Data != nil && len(ro.Data) > 2 {
				var mb map[string]any
				if err := json.Unmarshal(ro.Data, &mb); err == nil {
					out.MimeBundle = mb
				}
			}
			outputs = append(outputs, out)
		}

		cells = append(cells, models.CellDTO{
			ID:       id,
			Type:     rc.CellType,
			Source:   rc.Source.Join(),
			Outputs:  outputs,
			Metadata: rc.Metadata,
		})
	}

	return cells, meta, nil
}
