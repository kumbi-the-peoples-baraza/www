import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { cn } from '@/lib/utils'

interface Props {
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  initialContent?: string
}

export default function RichTextarea({ onChange, placeholder, className, initialContent }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: 'min-h-[120px] outline-none prose prose-sm dark:prose-invert max-w-none',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  return (
    <div className={cn('input-field !p-0 overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex gap-1 p-2 border-b border-white/10 flex-wrap">
        {[
          { label: 'B', action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
          { label: 'I', action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
          { label: '•', action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.action}
            className={cn('px-2 py-0.5 rounded text-xs font-bold transition-colors', btn.active ? 'bg-primary text-white' : 'hover:bg-muted')}
          >
            {btn.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const emoji = ['😊', '🌟', '💪', '🤝', '❤️', '🌍'][Math.floor(Math.random() * 6)]
            editor?.chain().focus().insertContent(emoji).run()
          }}
          className="px-2 py-0.5 rounded text-xs hover:bg-muted transition-colors"
        >
          😊
        </button>
      </div>
      <div className="p-3">
        {!editor?.getText() && (
          <p className="text-muted-foreground text-sm absolute pointer-events-none">{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
