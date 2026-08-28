import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { blogApi, authorsApi } from '@/api/client'
import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, X, ChevronDown, ChevronUp, Search, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import RichTextarea from '@/components/ui/RichTextarea'
import ImagePicker from '@/components/ui/ImagePicker'
import { MediaPickerDialog } from '@/components/media/mediaShared'
import type { BlogPost, BlogAuthor, GalleryImage, MediaFile } from '@/types'

type Draft = Partial<BlogPost>

function FoldableSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen !== false)
  return (
    <fieldset className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="p-4 border-t border-border">{children}</div>}
    </fieldset>
  )
}

function GalleryImageEditor({ images, onChange }: { images: GalleryImage[]; onChange: (v: GalleryImage[]) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const addImage = (file: MediaFile) => {
    onChange([...images, { url: file.url, caption: file.caption || '' }])
  }

  const updateCaption = (idx: number, caption: string) => {
    const copy = [...images]
    copy[idx] = { ...copy[idx], caption }
    onChange(copy)
  }

  const remove = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <label className="form-label">Gallery Images</label>
      <p className="text-xs text-muted-foreground mb-3">Add images that will appear in a gallery at the bottom of the post.</p>
      <div className="flex flex-wrap gap-3 mb-3">
        {images.map((img, i) => (
          <div key={i} className="relative group w-32">
            <img src={img.url} alt="" className="w-32 h-24 object-cover rounded-lg border border-border" />
            <button
              onClick={() => remove(i)}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
            <input
              value={img.caption || ''}
              onChange={e => updateCaption(i, e.target.value)}
              className="input-field text-xs mt-1 w-full"
              placeholder="Caption…"
            />
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setPickerOpen(true)} className="btn-ghost text-sm flex items-center gap-1.5">
        <Plus className="w-4 h-4" /> Add Image
      </button>
      {pickerOpen && (
        <MediaPickerDialog
          onClose={() => setPickerOpen(false)}
          onSelect={(file) => { addImage(file); setPickerOpen(false) }}
        />
      )}
    </div>
  )
}

export default function CMSBlog() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Draft | null>(null)

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['cms-blog'],
    queryFn: () => blogApi.listAll().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: Draft) => blogApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cms-blog'] }); setEditing(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Draft }) => blogApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cms-blog'] }); setEditing(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => blogApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-blog'] }),
  })

  const setAuthorField = (key: keyof BlogAuthor, value: string) => {
    const a: BlogAuthor = {
      id: editing?.author?.id || '',
      name: editing?.author?.name || '',
      bio: editing?.author?.bio || '',
      email: editing?.author?.email || '',
      phone: editing?.author?.phone || '',
      [key]: value,
    } as BlogAuthor
    setEditing({ ...editing, author: a, authorId: a.id || editing?.authorId })
  }

  // ── Async author search (up-to-date suggestions) ──
  const [authorQuery, setAuthorQuery] = useState('')
  const [authorSuggestions, setAuthorSuggestions] = useState<BlogAuthor[]>([])
  const [authorSearching, setAuthorSearching] = useState(false)
  const [showAuthorSuggest, setShowAuthorSuggest] = useState(false)
  const authorBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = authorQuery.trim()
    if (!q) { setAuthorSuggestions([]); return }
    const t = setTimeout(async () => {
      setAuthorSearching(true)
      try {
        const r = await authorsApi.search(q)
        setAuthorSuggestions((r.data as BlogAuthor[]) || [])
      } catch {
        setAuthorSuggestions([])
      } finally {
        setAuthorSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [authorQuery])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (authorBoxRef.current && !authorBoxRef.current.contains(e.target as Node)) {
        setShowAuthorSuggest(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const selectAuthor = (a: BlogAuthor) => {
    setEditing({ ...editing, author: { ...a }, authorId: a.id })
    setAuthorQuery('')
    setAuthorSuggestions([])
    setShowAuthorSuggest(false)
  }

  const clearAuthorSelection = () => {
    setEditing({ ...editing, author: { id: '', name: '', bio: '', email: '', phone: '' }, authorId: undefined })
    setAuthorQuery('')
    setAuthorSuggestions([])
  }

  const save = () => {
    if (!editing) return
    const payload: Draft & {
      blogAuthorId?: string
      authorName?: string
      authorBio?: string
      authorEmail?: string
      authorPhone?: string
    } = { ...editing }
    if (editing.authorId) payload.blogAuthorId = editing.authorId
    if (editing.author) {
      payload.authorName = editing.author.name
      payload.authorBio = editing.author.bio
      payload.authorEmail = editing.author.email
      payload.authorPhone = editing.author.phone
    }
    if (editing.id) updateMutation.mutate({ id: editing.id, data: payload })
    else createMutation.mutate(payload)
  }

  const autoSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Blog Posts</h1>
        <button
          onClick={() => setEditing({ title: '', slug: '', excerpt: '', body: '', status: 'draft', authorId: undefined })}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>

      {/* Editor */}
      {editing && (
        <div className="glass-card p-6 mb-8 flex flex-col gap-5">
          <h2 className="font-bold text-lg">{editing.id ? 'Edit Post' : 'New Post'}</h2>

          <FoldableSection title="Post details" defaultOpen={true}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Title</label>
                <input
                  value={editing.title || ''}
                  onChange={e => setEditing({ ...editing, title: e.target.value, slug: editing.id ? editing.slug : autoSlug(e.target.value) })}
                  className="input-field"
                  placeholder="Post title"
                />
              </div>
              <div>
                <label className="form-label">Slug</label>
                <input
                  value={editing.slug || ''}
                  readOnly={!editing.id}
                  onChange={e => setEditing({ ...editing, slug: e.target.value })}
                  className={`input-field ${!editing.id ? 'bg-muted cursor-not-allowed opacity-70' : ''}`}
                  placeholder={editing.id ? "url-friendly-slug" : "auto-generated from title"}
                />
                {!editing.id && <p className="text-xs text-muted-foreground mt-1">Auto-generated from title</p>}
              </div>
            </div>

            <div className="mt-4">
              <ImagePicker label="Cover Image" value={editing.coverImage || ''} onChange={v => setEditing({ ...editing, coverImage: v })} />
            </div>

            <div className="mt-4">
              <label className="form-label">Cover Image Caption</label>
              <input value={editing.coverCaption || ''} onChange={e => setEditing({ ...editing, coverCaption: e.target.value })}
                className="input-field" placeholder="Describe the image — people, location, context…" />
            </div>

            <div className="mt-4">
              <label className="form-label">Excerpt</label>
              <textarea
                value={editing.excerpt || ''}
                onChange={e => setEditing({ ...editing, excerpt: e.target.value })}
                rows={2}
                className="input-field resize-none"
                placeholder="Short summary shown in listings…"
              />
            </div>
          </FoldableSection>

          <div>
            <label className="form-label">Body</label>
            <RichTextarea
              key={editing.id || 'new'}
              initialContent={editing.body || ''}
              onChange={val => setEditing(prev => ({ ...prev, body: val }))}
              placeholder="Write your post here…"
              minHeight="60vh"
            />
          </div>

          <FoldableSection title="More" defaultOpen={false}>
            <GalleryImageEditor
              images={editing.galleryImages || []}
              onChange={v => setEditing({ ...editing, galleryImages: v })}
            />

            {/* Author fieldset */}
            <fieldset className="rounded-xl border border-border p-4 mt-4">
              <legend className="text-sm font-semibold text-muted-foreground px-2">Author</legend>

              {/* Async search for existing authors */}
              <div className="relative mt-2" ref={authorBoxRef}>
                <label className="form-label">Search existing authors</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  {authorSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                  )}
                  <input
                    value={authorQuery}
                    onChange={(e) => { setAuthorQuery(e.target.value); setShowAuthorSuggest(true) }}
                    onFocus={() => setShowAuthorSuggest(true)}
                    className="input-field !pl-10"
                    placeholder="Type a name, email or phone…"
                  />
                </div>
                {showAuthorSuggest && authorSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl max-h-60 overflow-y-auto">
                    {authorSuggestions.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => selectAuthor(a)}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border last:border-0"
                      >
                        <p className="text-sm font-semibold">{a.name}</p>
                        {a.email && <p className="text-xs text-muted-foreground">{a.email}</p>}
                      </button>
                    ))}
                  </div>
                )}
                {showAuthorSuggest && authorQuery.trim() && !authorSearching && authorSuggestions.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl px-3 py-2.5 text-sm text-muted-foreground">
                    No matching author — fill the details below to create a new one.
                  </div>
                )}
              </div>

              {editing.authorId && (
                <div className="flex items-center justify-between gap-2 mt-3 rounded-lg bg-primary/10 border border-primary/30 px-3 py-2">
                  <span className="text-xs font-semibold text-primary">
                    Linked to existing author: {editing.author?.name || '—'}
                  </span>
                  <button type="button" onClick={clearAuthorSelection} className="text-xs font-semibold text-muted-foreground hover:underline">
                    Create new instead
                  </button>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <div className="sm:col-span-2">
                  <label className="form-label">Name</label>
                  <input
                    value={editing.author?.name || ''}
                    onChange={(e) => setAuthorField('name', e.target.value)}
                    className="input-field"
                    placeholder="Author name"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Bio</label>
                  <textarea
                    value={editing.author?.bio || ''}
                    onChange={(e) => setAuthorField('bio', e.target.value)}
                    rows={3}
                    className="input-field resize-none"
                    placeholder="Short biography…"
                  />
                </div>
                <div>
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    value={editing.author?.email || ''}
                    onChange={(e) => setAuthorField('email', e.target.value)}
                    className="input-field"
                    placeholder="name@org.com"
                  />
                </div>
                <div>
                  <label className="form-label">Phone Number <span className="text-xs text-muted-foreground">(not published)</span></label>
                  <input
                    value={editing.author?.phone || ''}
                    onChange={(e) => setAuthorField('phone', e.target.value)}
                    className="input-field"
                    placeholder="+254…"
                  />
                </div>
              </div>
            </fieldset>

            <div className="mt-4">
              <label className="form-label">Status</label>
              <select
                value={editing.status || 'draft'}
                onChange={e => setEditing({ ...editing, status: e.target.value as BlogPost['status'] })}
                className="input-field"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </FoldableSection>

          <div className="flex gap-3">
            <button onClick={save} disabled={isPending} className="btn-primary">
              {isPending ? 'Saving…' : 'Save Post'}
            </button>
            <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
          </div>

          {(createMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-destructive font-semibold">Save failed. Please try again.</p>
          )}
        </div>
      )}

      {/* Posts table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : posts.length === 0 ? (
          <p className="p-6 text-muted-foreground text-sm">No posts yet. Create your first post above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Title', 'Author', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map((p: BlogPost) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-semibold max-w-xs truncate">{p.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.author?.name || 'Kumbi Editorial Team'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      p.status === 'published' ? 'bg-green-500/15 text-green-600'
                      : p.status === 'archived' ? 'bg-orange-500/15 text-orange-500'
                      : 'bg-muted text-muted-foreground'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(p)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => updateMutation.mutate({ id: p.id, data: { status: p.status === 'published' ? 'draft' : 'published' } })}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                        title={p.status === 'published' ? 'Unpublish' : 'Publish'}
                      >
                        {p.status === 'published' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => { if (confirm('Delete post?')) deleteMutation.mutate(p.id) }}
                        className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
