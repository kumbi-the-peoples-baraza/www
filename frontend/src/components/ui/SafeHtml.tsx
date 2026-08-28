import DOMPurify from 'dompurify'
import { useMemo } from 'react'

interface Props {
  html: string
  as?: 'div' | 'p' | 'span'
  className?: string
  style?: React.CSSProperties
}

/**
 * SafeHtml renders sanitized HTML. It never shows raw tags —
 * it strips disallowed elements and escapes the rest via DOMPurify.
 * Markdown that was normalized server-side arrives here as clean HTML.
 */
export function SafeHtml({ html, as: Tag = 'div', className, style }: Props) {
  const clean = useMemo(() => {
    if (!html) return ''
    // DOMPurify config mirrors backend bluemonday allowlist
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'img', 'svg', 'math'],
    })
  }, [html])

  if (!clean) return null
  return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: clean }} />
}

/** Imperative helper for places that need a string instead of a component. */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'img', 'svg', 'math'],
  })
}
