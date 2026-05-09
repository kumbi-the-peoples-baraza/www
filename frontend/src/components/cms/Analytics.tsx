import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/api/client'
import { Skeleton } from '@/components/ui/Skeleton'
import { Eye, Users, TrendingUp, Globe } from 'lucide-react'

export default function Analytics() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: () => analyticsApi.stats().then(r => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) return <Skeleton className="h-96 w-full" />

  const noData = !stats?.totalViews

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Analytics</h1>
        <span className="text-sm text-muted-foreground">Last {stats?.days || 30} days · refreshes every 60s</span>
      </div>

      {noData && (
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">No page views recorded yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Visit <a href="http://localhost" target="_blank" rel="noreferrer" className="text-primary underline">http://localhost</a> to start generating data.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Page Views', value: stats?.totalViews ?? 0, icon: Eye },
          { label: 'Unique Sessions (approx)', value: stats?.uniqueSessions ?? 0, icon: Users },
        ].map(t => (
          <div key={t.label} className="glass-card p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <t.icon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-black text-primary">{t.value.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">{t.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top pages */}
        <div className="glass-card p-6">
          <h2 className="font-black mb-5 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Top Pages</h2>
          <div className="flex flex-col gap-2">
            {(stats?.topPages || []).length === 0
              ? <p className="text-sm text-muted-foreground">No data yet.</p>
              : (stats?.topPages || []).map((p: { path: string; views: number }, i: number) => {
                  const max = stats.topPages[0]?.views || 1
                  return (
                    <div key={p.path} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-sm font-medium flex-1 truncate">{p.path}</span>
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(p.views / max * 100)}%` }} />
                      </div>
                      <span className="text-sm font-black text-primary w-10 text-right">{p.views}</span>
                    </div>
                  )
                })}
          </div>
        </div>

        {/* Browsers */}
        <div className="glass-card p-6">
          <h2 className="font-black mb-5 flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> Browsers</h2>
          <div className="flex flex-col gap-3">
            {Object.entries(stats?.browsers || {}).length === 0
              ? <p className="text-sm text-muted-foreground">No data yet.</p>
              : Object.entries(stats?.browsers || {})
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .map(([browser, count]) => (
                    <div key={browser} className="flex items-center gap-3">
                      <span className="text-sm font-semibold w-16">{browser}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.round((count as number) / (stats?.totalViews || 1) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-black text-primary w-10 text-right">
                        {Math.round((count as number) / (stats?.totalViews || 1) * 100)}%
                      </span>
                    </div>
                  ))}
          </div>
        </div>

        {/* Daily bar chart */}
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="font-black mb-5">Page Views — Last 14 Days</h2>
          {(stats?.dailyViews || []).length === 0
            ? <p className="text-sm text-muted-foreground">No data yet.</p>
            : (() => {
                const max = Math.max(...(stats.dailyViews || []).map((d: { views: number }) => d.views), 1)
                return (
                  <div className="flex items-end gap-2 h-32">
                    {(stats.dailyViews || []).map((d: { day: string; views: number }) => (
                      <div key={String(d.day)} className="flex-1 flex flex-col items-center gap-1 group">
                        <span className="text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">{d.views}</span>
                        <div className="w-full bg-primary/80 rounded-t"
                          style={{ height: `${Math.max(Math.round(d.views / max * 100), 2)}px` }} />
                        <span className="text-[9px] text-muted-foreground">{String(d.day).slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )
              })()
          }
        </div>

        {/* Referrers */}
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="font-black mb-5">Top Referrers</h2>
          {(stats?.topReferrers || []).length === 0
            ? <p className="text-sm text-muted-foreground">No data yet.</p>
            : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(stats.topReferrers || []).map((r: { referrer: string; views: number }) => (
                  <div key={r.referrer} className="glass-card p-4">
                    <p className="text-xs text-muted-foreground truncate mb-1">{r.referrer}</p>
                    <p className="text-xl font-black text-primary">{r.views}</p>
                    <p className="text-xs text-muted-foreground">views</p>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
