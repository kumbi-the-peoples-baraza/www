import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pagesApi } from '@/api/client'
import { useState } from 'react'
import { Plus, Pencil, Trash2, Archive } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Page } from '@/types'

const DISPLAY_MODES = ['full', 'modal', 'overlay', 'carousel', 'hero', 'link'] as const

export default function Pages() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<Page> | null>(null)

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['cms-pages'],
    queryFn: () => pagesApi.list().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Page>) => pagesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cms-pages'] }); setEditing(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Page> }) => pagesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cms-pages'] }); setEditing(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pagesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-pages'] }),
  })

  const save = () => {
    if (!editing) return
    if (editing.id) updateMutation.mutate({ id: editing.id, data: editing })
    else createMutation.mutate(editing)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Pages</h1>
        <button onClick={() => setEditing({ title: '', slug: '', status: 'draft', displayMode: 'full' })} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Page
        </button>
      </div>

      {editing && (
        <div className="glass-card p-6 mb-6">
          <h2 className="font-semibold mb-4">{editing.id ? 'Edit Page' : 'New Page'}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Slug</label>
              <input value={editing.slug || ''} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Status</label>
              <select value={editing.status || 'draft'} onChange={(e) => setEditing({ ...editing, status: e.target.value as Page['status'] })} className="input-field">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Display Mode</label>
              <select value={editing.displayMode || 'full'} onChange={(e) => setEditing({ ...editing, displayMode: e.target.value as Page['displayMode'] })} className="input-field">
                {DISPLAY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} className="input-field" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} className="btn-primary">Save</button>
            <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {['Title', 'Slug', 'Status', 'Display', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pages.map((p: Page) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">/{p.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'published' ? 'bg-green-500/15 text-green-500' : p.status === 'archived' ? 'bg-orange-500/15 text-orange-500' : 'bg-muted text-muted-foreground'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.displayMode}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(p)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'archived' } })} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Archive className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(p.id) }} className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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
