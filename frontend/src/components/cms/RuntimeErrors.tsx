import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { runtimeErrorsApi } from '@/api/client'
import { getRuntimeErrors, clearRuntimeErrors } from '@/lib/runtimeLog'
import { useState } from 'react'
import { Trash2, RefreshCw } from 'lucide-react'

export default function CMSRuntimeErrors() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'server' | 'local'>('server')

  const { data: serverErrors = [], isLoading, refetch } = useQuery({
    queryKey: ['runtime-errors'],
    queryFn: () => runtimeErrorsApi.list().then(r => r.data as { id: string; message: string; level: string; context: unknown; createdAt: string }[]),
    enabled: tab === 'server',
  })

  const clearMutation = useMutation({
    mutationFn: () => runtimeErrorsApi.clear(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['runtime-errors'] }),
  })

  const localErrors = getRuntimeErrors()

  const handleClearLocal = () => {
    if (confirm('Clear local runtime errors?')) {
      clearRuntimeErrors()
      // force re-render
      window.location.reload()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Runtime Errors</h1>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn-ghost flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          {tab === 'server' ? (
            <button onClick={() => { if (confirm('Clear all server errors?')) clearMutation.mutate() }} className="btn-ghost text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          ) : (
            <button onClick={handleClearLocal} className="btn-ghost text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Clear local
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('server')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === 'server' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Server ({serverErrors.length})</button>
        <button onClick={() => setTab('local')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === 'local' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>This browser ({localErrors.length})</button>
      </div>

      <div className="glass-card overflow-hidden">
        {tab === 'server' ? (
          isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : serverErrors.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No runtime errors logged. CAPTCHA and other client errors will appear here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Time', 'Level', 'Message', 'Context'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {serverErrors.map((e) => (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${e.level === 'warning' ? 'bg-amber-500/15 text-amber-600' : 'bg-destructive/10 text-destructive'}`}>{e.level}</span></td>
                      <td className="px-4 py-3 font-medium max-w-[320px] truncate">{e.message}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[320px] truncate">{JSON.stringify(e.context)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : localErrors.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No local errors.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Time', 'Level', 'Message', 'Context'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {localErrors.map((e) => (
                  <tr key={e.id} className="border-b border-border/50">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${e.level === 'warning' ? 'bg-amber-500/15 text-amber-600' : 'bg-destructive/10 text-destructive'}`}>{e.level}</span></td>
                    <td className="px-4 py-3 font-medium max-w-[320px] truncate">{e.message}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[320px] truncate">{JSON.stringify(e.context)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Server errors are POSTed to <code>/api/v1/runtime-errors</code> and visible to admins. Local errors are from this browser's <code>localStorage</code>.</p>
    </div>
  )
}
