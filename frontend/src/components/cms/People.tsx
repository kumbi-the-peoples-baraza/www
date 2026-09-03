import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { peopleApi } from '@/api/client'
import { useState } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import ImagePicker from '@/components/ui/ImagePicker'
import type { Person } from '@/types'
import { parseImageValue } from '@/lib/utils'

type Draft = Partial<Person>

export default function CMSPeople() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Draft | null>(null)

  const { data: people = [], isLoading } = useQuery({
    queryKey: ['cms-people'],
    queryFn: () => peopleApi.listAll().then((r) => r.data as Person[]),
  })

  const createMutation = useMutation({
    mutationFn: (d: Draft) => peopleApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cms-people'] }); setEditing(null) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Draft }) => peopleApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cms-people'] }); setEditing(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => peopleApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-people'] }),
  })

  const save = () => {
    if (!editing) return
    if (editing.id) updateMutation.mutate({ id: editing.id, data: editing })
    else createMutation.mutate(editing)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Our People</h1>
        <button
          onClick={() => { setEditing({ name: '', position: '', bio: '', published: false, order: 0 }) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Person
        </button>
      </div>

      {editing && (
        <div className="glass-card p-6 flex flex-col gap-5">
          <h2 className="font-black text-lg">{editing.id ? 'Edit Person' : 'New Person'}</h2>

          <ImagePicker label="Portrait" value={editing.portrait || ''} onChange={(v) => setEditing({ ...editing, portrait: v })} />

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Name</label>
              <input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input-field" placeholder="Full name" />
            </div>
            <div>
              <label className="form-label">Position / Title</label>
              <input value={editing.position || ''} onChange={(e) => setEditing({ ...editing, position: e.target.value })} className="input-field" placeholder="e.g. Executive Director" />
            </div>
          </div>

          <div>
            <label className="form-label">Bio</label>
            <textarea value={editing.bio || ''} onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
              rows={4} className="input-field resize-none" placeholder="Short biography…" />
          </div>

          <div className="flex items-center gap-6">
            <div>
              <label className="form-label">Display Order</label>
              <input type="number" value={editing.order ?? 0} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })} className="input-field w-24" min={0} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-6">
              <input type="checkbox" checked={editing.published ?? false} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} className="w-4 h-4 accent-primary" />
              <span className="font-semibold text-sm">Published (visible on site)</span>
            </label>
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary">
              {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : people.length === 0 ? (
          <p className="p-6 text-muted-foreground text-sm">No people added yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Portrait', 'Name', 'Position', 'Published', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p: Person) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    {p.portrait
                      ? <img src={parseImageValue(p.portrait)} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-black" />
                      : <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center font-black text-white/80">{p.name[0]}</div>
                    }
                  </td>
                  <td className="px-4 py-3 font-semibold">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.position}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.published ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                      {p.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(p) }} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => updateMutation.mutate({ id: p.id, data: { published: !p.published } })} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                        {p.published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
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
