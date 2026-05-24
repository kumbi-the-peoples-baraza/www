import { motion } from 'framer-motion'
import { Search, BarChart3, Users, AlertTriangle, Loader2 } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import { useConfig } from '@/hooks/useConfig'
import { useEffect, useState } from 'react'
import { notebooksApi } from '@notebooks/api/notebooksApi'
import { NotebookRenderer } from '@notebooks/components/NotebookRenderer'
import type { Page } from '@/types'

const features = [
  { icon: Search,        title: 'Crowd-sourced Reports',   desc: 'Anyone can submit a missing persons report with photos, last known location, and circumstances.' },
  { icon: BarChart3,     title: 'Data Analysis',           desc: 'Pattern recognition and geospatial analysis to identify clusters and trends in disappearances.' },
  { icon: Users,         title: 'Community Verification',  desc: 'Community members verify and corroborate reports, building a trusted, tamper-resistant dataset.' },
  { icon: AlertTriangle, title: 'Real-time Alerts',        desc: 'Instant notifications to families, lawyers, and human rights organisations when new data emerges.' },
]

export default function TraceData() {
  const cfg = useConfig()
  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Slug for this page is 'trace'
    notebooksApi.getPageWithNotebook('trace')
      .then(setPage)
      .catch(() => {}) // Silently fail, just don't show notebook
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <PageHero
        title="KumbiTrace"
        subtitle="A crowd-sourced missing persons tracking and data analysis platform — born from the 2024 Nairobi protests."
        tag="Missing Persons · Data"
        img={cfg.pages.trace.heroImage}
      />
      <div className="section">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-7 mb-16">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="glass-card p-7 flex gap-5"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-black text-lg mb-1">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
          </div>
        ) : page?.notebook ? (
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/50 whitespace-nowrap">Live Analysis Data</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <NotebookRenderer notebook={page.notebook} />
          </div>
        ) : null}
      </div>
    </>
  )
}
