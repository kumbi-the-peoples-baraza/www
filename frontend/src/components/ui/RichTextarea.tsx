import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import DOMPurify from 'dompurify'

// Turndown for HTML -> Markdown conversion (lazy)
let turndownInstance: any = null
function getTurndown() {
  if (turndownInstance) return turndownInstance
  // @ts-ignore
  const TurndownService = require('turndown')
  const svc = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  // Remove script/style before conversion
  turndownInstance = svc
  return svc
}

interface Props {
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  initialContent?: string
  minHeight?: string
}

export default function RichTextarea({ onChange, placeholder, className, initialContent, minHeight }: Props) {
  // If initialContent looks like markdown, convert to HTML for TipTap
  const initialHtml = useMemo(() => {
    if (!initialContent) return ''
    // Heuristic: if it has markdown sigils and no HTML block tags, render via simple markdown->html pre-pass
    const hasHtml = /<\s*(p|h[1-6]|ul|ol|li|blockquote|pre|code|a|strong|em)\b/i.test(initialContent)
    if (!hasHtml && /(^|\n)(#{1,6}\s|[-*]\s|\d+\.\s|>\s|```)/.test(initialContent)) {
      // Minimal inline markdown rendering for the editor initial state
      // Let backend-normalized HTML take over on next save; this is just preview
      let html = initialContent
        .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
        .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
        .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        .replace(/\n\n/g, '</p><p>')
      if (!html.startsWith('<')) html = '<p>' + html + '</p>'
      return html
    }
    return initialContent
  }, [initialContent])

  const emitMarkdown = (html: string) => {
    // Sanitize before converting so stored value is safe
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a'],
      ALLOWED_ATTR: ['href'],
    })
    try {
      const td = getTurndown()
      const md = td.turndown(clean).trim()
      // If turndown produces empty or overly stripped, fallback to clean html (server will normalize)
      onChange(md || clean)
    } catch {
      onChange(clean)
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
    ],
    content: initialHtml || '',
    editorProps: {
      attributes: {
        class: 'min-h-[160px] outline-none max-w-none px-4 py-3 rich-content',
        ...(minHeight ? { style: `min-height: ${minHeight}` } : {}),
      },
    },
    onUpdate: ({ editor }) => emitMarkdown(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && initialContent !== undefined) {
      const html = initialHtml
      if (editor.getHTML() !== html) {
        editor.commands.setContent(html || '')
      }
    }
  }, [editor, initialHtml])

  if (!editor) return null

  const setLink = () => {
    const url = window.prompt('URL', editor.getAttributes('link').href || 'https://')
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().setLink({ href: url }).run()
  }

  type Btn = { label: string; title: string; action: () => void; active?: boolean }
  const buttons: Btn[] = [
    { label: 'H1', title: 'Heading 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
    { label: 'H2', title: 'Heading 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
    { label: 'H3', title: 'Heading 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
    { label: '|', title: '', action: () => {} },
    { label: 'B',  title: 'Bold',      action: () => editor.chain().focus().toggleBold().run(),      active: editor.isActive('bold') },
    { label: 'I',  title: 'Italic',    action: () => editor.chain().focus().toggleItalic().run(),    active: editor.isActive('italic') },
    { label: 'U',  title: 'Underline', action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline') },
    { label: 'S',  title: 'Strike',    action: () => editor.chain().focus().toggleStrike().run(),    active: editor.isActive('strike') },
    { label: '`',  title: 'Code',      action: () => editor.chain().focus().toggleCode().run(),      active: editor.isActive('code') },
    { label: '|', title: '', action: () => {} },
    { label: '•',  title: 'Bullet list',   action: () => editor.chain().focus().toggleBulletList().run(),  active: editor.isActive('bulletList') },
    { label: '1.', title: 'Ordered list',  action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
    { label: '❝',  title: 'Blockquote',   action: () => editor.chain().focus().toggleBlockquote().run(),  active: editor.isActive('blockquote') },
    { label: '—',  title: 'Divider',      action: () => editor.chain().focus().setHorizontalRule().run() },
    { label: '|', title: '', action: () => {} },
    { label: '🔗', title: 'Link',   action: setLink,  active: editor.isActive('link') },
    { label: '|', title: '', action: () => {} },
    { label: '↩', title: 'Undo', action: () => editor.chain().focus().undo().run() },
    { label: '↪', title: 'Redo', action: () => editor.chain().focus().redo().run() },
  ]

  return (
    <div className={cn('rounded-xl border-2 border-primary/30 overflow-hidden bg-input', className)}>
      <div className="flex flex-wrap gap-0.5 px-2 py-1.5 border-b border-border bg-muted/40">
        {buttons.map((btn, i) =>
          btn.label === '|' ? (
            <span key={i} className="w-px h-5 bg-border mx-1 self-center" />
          ) : (
            <button key={i} type="button" title={btn.title} onClick={btn.action}
              className={cn(
                'px-2 py-0.5 rounded text-sm font-bold transition-colors min-w-[1.75rem] text-center',
                btn.active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground/70 hover:text-foreground'
              )}
            >{btn.label}</button>
          )
        )}
      </div>
      <div className="relative">
        {!editor.getText().trim() && placeholder && (
          <p className="absolute top-3 left-4 text-muted-foreground/55 text-sm pointer-events-none select-none">{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
