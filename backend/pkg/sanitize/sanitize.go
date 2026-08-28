package sanitize

import (
	"bytes"
	"strings"

	"github.com/microcosm-cc/bluemonday"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/renderer/html"
)

// policy is a strict UGC allowlist: common formatting, lists, headings,
// blockquote, code, hr, links (http/https/mailto only).
var policy = func() *bluemonday.Policy {
	p := bluemonday.NewPolicy()
	// Core text + block
	p.AllowElements("p", "br", "span", "div")
	p.AllowElements("h1", "h2", "h3", "h4", "h5", "h6")
	p.AllowElements("strong", "b", "em", "i", "u", "s", "strike", "del", "ul", "ol", "li", "blockquote", "code", "pre", "hr")
	p.AllowElements("a")
	p.AllowAttrs("href").Matching(bluemonday.Paragraph).OnElements("a")
	p.AllowURLSchemes("mailto", "http", "https")
	p.RequireParseableURLs(true)
	p.AllowAttrs("target").OnElements("a") // kept but stripped later if not _blank?
	p.AllowAttrs("rel").OnElements("a")
	// Tiptap adds class attributes; strip them
	// No style, no on* handlers, no script/style/iframe/img
	return p
}()

// HTML sanitizes a TipTap/HTML fragment and returns safe HTML.
// Empty input returns empty string. If the sanitized result is empty but input wasn't, returns "" (caller can decide).
func HTML(input string) string {
	if strings.TrimSpace(input) == "" {
		return ""
	}
	// 8KB-ish limit for rich fields — caller enforces length, we truncate aggressively
	const maxLen = 100_000
	if len(input) > maxLen {
		input = input[:maxLen]
	}
	out := policy.Sanitize(input)
	// Enforce link safety
	out = strings.ReplaceAll(out, ` target="_blank"`, ` target="_blank" rel="noopener noreferrer"`)
	return strings.TrimSpace(out)
}

// MarkdownToHTML converts markdown to HTML via goldmark then sanitizes the result.
func MarkdownToHTML(md string) string {
	if strings.TrimSpace(md) == "" {
		return ""
	}
	const maxLen = 100_000
	if len(md) > maxLen {
		md = md[:maxLen]
	}
	mdParser := goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithRendererOptions(html.WithUnsafe()), // we sanitize afterwards, so allow raw html in markdown source but it will be stripped
	)
	var buf bytes.Buffer
	if err := mdParser.Convert([]byte(md), &buf); err != nil {
		return HTML(md) // fallback: treat as html fragment
	}
	return HTML(buf.String())
}

// IsMarkdown heuristically detects markdown vs HTML.
// If input contains HTML block tags, prefer HTML sanitization path.
func IsMarkdown(s string) bool {
	if strings.Contains(s, "<p>") || strings.Contains(s, "<h") || strings.Contains(s, "<ul") || strings.Contains(s, "<ol") {
		return false
	}
	// Common markdown sigils
	for _, sig := range []string{"```", "## ", "# ", "- ", "* ", "1. ", "**", "__", "[", "]("} {
		if strings.Contains(s, sig) {
			return true
		}
	}
	return false
}

// NormalizeContent accepts either HTML or Markdown and returns sanitized HTML for storage/display.
// Stores as sanitized HTML regardless — markdown is rendered to sanitized HTML at write time so reads are cheap and DB stays HTML.
func NormalizeContent(input string) string {
	if strings.TrimSpace(input) == "" {
		return ""
	}
	if IsMarkdown(input) {
		return MarkdownToHTML(input)
	}
	return HTML(input)
}
