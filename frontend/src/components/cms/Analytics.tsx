import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { analyticsApi } from '@/api/client'
import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Analytics() {
  const qc = useQueryClient()
  const [raw, setRaw] = useState('')
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.get().then((r) => r.data),
  })

  useEffect(() => {
    if (data?.config) setRaw(JSON.stringify(data.config, null, 2))
  }, [data])

  const updateMutation = useMutation({
    mutationFn: (config: Record<string, unknown>) => analyticsApi.update(config),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics'] }),
  })

  const save = () => {
    try {
      const parsed = JSON.parse(raw)
      setError('')
      updateMutation.mutate(parsed)
    } catch {
      setError('Invalid JSON')
    }
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <button onClick={save} disabled={updateMutation.isPending} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" /> Save
        </button>
      </div>

      <div className="glass-card p-6">
        <p className="text-sm text-muted-foreground mb-4">
          Store any JSON configuration for your analytics integration (e.g. Google Analytics, Plausible, Mixpanel).
          The config is available via <code className="bg-muted px-1 rounded text-xs">GET /api/v1/analytics</code>.
        </p>
        <label className="text-sm font-medium mb-1.5 block">Configuration (JSON)</label>
        <textarea
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setError('') }}
          rows={16}
          spellCheck={false}
          className="input-field font-mono text-sm"
        />
        {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        {updateMutation.isSuccess && <p className="text-green-500 text-sm mt-2">Saved.</p>}
      </div>
    </div>
  )
}
