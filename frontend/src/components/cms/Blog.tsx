import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { blogApi, mediaApi } from '@/api/client'
import { useState, useRef } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, Image, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import RichTextarea from '@/components/ui/RichTextarea'
import ImagePicker from '@/components/ui/ImagePicker'
import type { BlogPost, GalleryImage, MediaFile } from '@/types'

type Draft = Partial<BlogPost>

function GalleryImageEditor({ images, onChange }: { images: GalleryImage[]; onChange: (v: GalleryImage[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)

  const { data: libraryFiles = [] } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaApi.list().then(r => r.data as MediaFile[]),
    enabled: libraryOpen,
  })

  const libraryImages = libraryFiles.filter((f: MediaFile) => f.mimeType.startsWith('image/'))

  const addFromLibrary = (url: string) => {
    onChange([...images, { url, caption: '' }])
  }

  const uploadAndAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await mediaApi.upload(file, {}).then(r => r.data as { id: string; url: string })
    onChange([...images, { url: result.url, caption: '' }])
    if (fileRef.current) fileRef.current.value = ''
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
      <div className="flex gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Upload Image
        </button>
        <button type="button" onClick={() => setLibraryOpen(v => !v)} className="btn-ghost text-sm flex items-center gap-1.5">
          <Image className="w-4 h-4" /> {libraryOpen ? 'Hide library' : 'Select from media library'}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAndAdd} />
      {libraryOpen && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3 max-h-48 overflow-y-auto p-2 rounded-xl border border-border bg-muted/30">
          {libraryImages.map((f: MediaFile) => (
            <button key={f.id} type="button" onClick={() => addFromLibrary(f.url)}
              className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all">
              <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
            </button>
          ))}
          {libraryImages.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground py-4 text-center">No images yet. Upload one above.</p>
          )}
        </div>
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

  const save = () => {
    if (!editing) return
    if (editing.id) updateMutation.mutate({ id: editing.id, data: editing })
    else createMutation.mutate(editing)
  }

  const autoSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Blog Posts</h1>
        <button
          onClick={() => setEditing({ title: '', slug: '', excerpt: '', body: '', status: 'draft' })}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>

      {/* Editor */}
      {editing && (
        <div className="glass-card p-6 mb-8 flex flex-col gap-5">
          <h2 className="font-bold text-lg">{editing.id ? 'Edit Post' : 'New Post'}</h2>

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
                onChange={e => setEditing({ ...editing, slug: e.target.value })}
                className="input-field"
                placeholder="url-friendly-slug"
              />
            </div>
          </div>

          <ImagePicker label="Cover Image" value={editing.coverImage || ''} onChange={v => setEditing({ ...editing, coverImage: v })} />

          <div>
            <label className="form-label">Cover Image Caption</label>
            <input value={editing.coverCaption || ''} onChange={e => setEditing({ ...editing, coverCaption: e.target.value })}
              className="input-field" placeholder="Describe the image — people, location, context…" />
          </div>

          <div>
            <label className="form-label">Excerpt</label>
            <textarea
              value={editing.excerpt || ''}
              onChange={e => setEditing({ ...editing, excerpt: e.target.value })}
              rows={2}
              className="input-field resize-none"
              placeholder="Short summary shown in listings…"
            />
          </div>

          <div>
            <label className="form-label">Body</label>
            <RichTextarea
              key={editing.id || 'new'}
              initialContent={editing.body || ''}
              onChange={val => setEditing(prev => ({ ...prev, body: val }))}
              placeholder="Write your post here…"
            />
          </div>

          <GalleryImageEditor
            images={editing.galleryImages || []}
            onChange={v => setEditing({ ...editing, galleryImages: v })}
          />

          <div className="flex items-center gap-4">
            <div>
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
          </div>

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
                {['Title', 'Slug', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map((p: BlogPost) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-semibold max-w-xs truncate">{p.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">/{p.slug}</td>
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
