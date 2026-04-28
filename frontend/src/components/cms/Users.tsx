import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/api/client'
import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { User } from '@/types'

const ROLES = ['admin', 'editor', 'viewer'] as const

export default function Users() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<User & { password: string }> | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: unknown) => usersApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditing(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditing(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const toggleActive = (u: User) =>
    updateMutation.mutate({ id: u.id, data: { active: !u.active } })

  const save = () => {
    if (!editing) return
    if (editing.id) {
      const { id, password, name, role, active } = editing
      updateMutation.mutate({ id: id!, data: { name, role, active, ...(password ? { password } : {}) } })
    } else {
      createMutation.mutate(editing)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <button
          onClick={() => setEditing({ name: '', email: '', password: '', role: 'viewer' })}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New User
        </button>
      </div>

      {editing && (
        <div className="glass-card p-6 mb-6">
          <h2 className="font-semibold mb-4">{editing.id ? 'Edit User' : 'New User'}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input-field" />
            </div>
            {!editing.id && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <input type="email" value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="input-field" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1.5 block">{editing.id ? 'New Password (leave blank to keep)' : 'Password'}</label>
              <input type="password" value={editing.password || ''} onChange={(e) => setEditing({ ...editing, password: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Role</label>
              <select value={editing.role || 'viewer'} onChange={(e) => setEditing({ ...editing, role: e.target.value as User['role'] })} className="input-field">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
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
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {['Name', 'Email', 'Role', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u: User) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${u.role === 'admin' ? 'bg-violet-500/15 text-violet-400' : u.role === 'editor' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-muted text-muted-foreground'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(u)} className={`px-2 py-0.5 rounded-full text-xs ${u.active ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-400'}`}>
                      {u.active ? 'active' : 'inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(u)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { if (confirm('Delete user?')) deleteMutation.mutate(u.id) }} className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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
