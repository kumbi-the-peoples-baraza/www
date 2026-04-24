import { useQuery } from '@tanstack/react-query'
import { pagesApi, formsApi } from '@/api/client'
import { FileText, FormInput, Users, BarChart3 } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Dashboard() {
  const { data: pages, isLoading } = useQuery({
    queryKey: ['cms-pages'],
    queryFn: () => pagesApi.list().then((r) => r.data),
  })

  const stats = [
    { label: 'Pages', value: pages?.length ?? 0, icon: FileText, color: 'from-violet-500 to-purple-600' },
    { label: 'Form Submissions', value: '—', icon: FormInput, color: 'from-pink-500 to-rose-600' },
    { label: 'Users', value: '—', icon: Users, color: 'from-cyan-500 to-blue-600' },
    { label: 'Page Views', value: '—', icon: BarChart3, color: 'from-green-500 to-emerald-600' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="glass-card p-5">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            {isLoading ? <Skeleton className="h-7 w-16 mb-1" /> : <p className="text-2xl font-bold">{s.value}</p>}
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="glass-card p-6">
        <h2 className="font-semibold mb-4">Recent Pages</h2>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(pages || []).map((p: { id: string; title: string; status: string; updatedAt: string }) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="font-medium text-sm">{p.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'published' ? 'bg-green-500/15 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
