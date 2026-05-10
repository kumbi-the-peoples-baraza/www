import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  initialContent?: string
}

export default function RichTextarea({ onChange, placeholder, className, initialContent }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        // prose classes make headings/lists render visually in real time
        class: 'min-h-[160px] outline-none max-w-none px-4 py-3 rich-content',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && initialContent !== undefined && editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent || '')
    }
  }, [initialContent])

  if (!editor) return null

  const setLink = () => {
    const url = window.prompt('URL', editor.getAttributes('link').href || 'https://')
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().setLink({ href: url }).run()
  }

  const addImage = () => {
    const url = window.prompt('Image URL')
    if (url) editor.chain().focus().setImage({ src: url }).run()
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
    { label: '🖼',  title: 'Image',  action: addImage },
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
