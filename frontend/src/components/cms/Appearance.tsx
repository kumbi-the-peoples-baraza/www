import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appearanceApi } from '@/api/client'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Appearance() {
  const qc = useQueryClient()

  const { data: appearance, isLoading } = useQuery({
    queryKey: ['appearance'],
    queryFn: () => appearanceApi.get().then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => appearanceApi.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appearance'] }),
  })

  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Appearance</h1>
      <div className="glass-card p-6">
        <p className="text-muted-foreground mb-4">Manage colors, gradients, backgrounds, themes, and display modes.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Primary Color</label>
            <input type="color" value={appearance?.primaryColor || '#8b5cf6'} onChange={(e) => updateMutation.mutate({ ...appearance, primaryColor: e.target.value })} className="w-full h-10 rounded-lg" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Secondary Color</label>
            <input type="color" value={appearance?.secondaryColor || '#06b6d4'} onChange={(e) => updateMutation.mutate({ ...appearance, secondaryColor: e.target.value })} className="w-full h-10 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
