import { useQuery } from '@tanstack/react-query'
import { dashboardApi, analyticsApi } from '@/api/client'
import { FileText, FormInput, Users, BarChart3, Eye, TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Dashboard() {
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats().then(r => r.data),
  })
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: () => analyticsApi.stats().then(r => r.data),
  })

  const tiles = [
    { label: 'Pages', value: counts?.pages ?? '—', icon: FileText, color: 'bg-primary/15 text-primary' },
    { label: 'Users', value: counts?.users ?? '—', icon: Users, color: 'bg-secondary/15 text-secondary' },
    { label: 'Form Submissions', value: counts?.formSubmissions ?? '—', icon: FormInput, color: 'bg-green-500/15 text-green-600' },
    { label: 'Page Views (30d)', value: counts?.pageViews30d ?? '—', icon: Eye, color: 'bg-orange-500/15 text-orange-500' },
  ]

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-black">Dashboard</h1>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map(s => (
          <div key={s.label} className="glass-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            {countsLoading ? <Skeleton className="h-7 w-16 mb-1" /> : <p className="text-2xl font-black">{s.value}</p>}
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top pages */}
        <div className="glass-card p-6">
          <h2 className="font-black mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Top Pages (30d)</h2>
          {statsLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="flex flex-col gap-2">
              {(stats?.topPages || []).length === 0
                ? <p className="text-muted-foreground text-sm">No data yet — visit the site to start tracking.</p>
                : (stats?.topPages || []).map((p: { path: string; views: number }) => (
                  <div key={p.path} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm font-medium truncate max-w-[70%]">{p.path}</span>
                    <span className="text-sm font-black text-primary">{p.views}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Browsers */}
        <div className="glass-card p-6">
          <h2 className="font-black mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Browsers (30d)</h2>
          {statsLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="flex flex-col gap-2">
              {Object.keys(stats?.browsers || {}).length === 0
                ? <p className="text-muted-foreground text-sm">No data yet.</p>
                : Object.entries(stats?.browsers || {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([browser, count]) => (
                  <div key={browser} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-20">{browser}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((count as number) / (stats?.totalViews || 1) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-black text-primary w-8 text-right">{count as number}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Daily views */}
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="font-black mb-4 flex items-center gap-2"><Eye className="w-4 h-4 text-primary" /> Daily Views (14d)</h2>
          {statsLoading ? <Skeleton className="h-24 w-full" /> : (
            <div className="flex items-end gap-1 h-24">
              {(stats?.dailyViews || []).length === 0
                ? <p className="text-muted-foreground text-sm self-center">No data yet.</p>
                : (() => {
                    const max = Math.max(...(stats?.dailyViews || []).map((d: { views: number }) => d.views), 1)
                    return (stats?.dailyViews || []).map((d: { day: string; views: number }) => (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{d.views}</span>
                        <div className="w-full bg-primary rounded-t" style={{ height: `${Math.round(d.views / max * 80)}px`, minHeight: 2 }} />
                        <span className="text-[9px] text-muted-foreground">{String(d.day).slice(5)}</span>
                      </div>
                    ))
                  })()
              }
            </div>
          )}
        </div>

        {/* Top referrers */}
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="font-black mb-4">Top Referrers (30d)</h2>
          {statsLoading ? <Skeleton className="h-32 w-full" /> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(stats?.topReferrers || []).length === 0
                ? <p className="text-muted-foreground text-sm">No data yet.</p>
                : (stats?.topReferrers || []).map((r: { referrer: string; views: number }) => (
                  <div key={r.referrer} className="glass-card p-3">
                    <p className="text-xs text-muted-foreground truncate">{r.referrer}</p>
                    <p className="text-lg font-black text-primary">{r.views}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
