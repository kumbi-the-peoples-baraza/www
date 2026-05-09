import { motion } from 'framer-motion'
import { Search, BarChart3, Users, AlertTriangle } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'

const features = [
  { icon: Search,        title: 'Crowd-sourced Reports',   desc: 'Anyone can submit a missing persons report with photos, last known location, and circumstances.' },
  { icon: BarChart3,     title: 'Data Analysis',           desc: 'Pattern recognition and geospatial analysis to identify clusters and trends in disappearances.' },
  { icon: Users,         title: 'Community Verification',  desc: 'Community members verify and corroborate reports, building a trusted, tamper-resistant dataset.' },
  { icon: AlertTriangle, title: 'Real-time Alerts',        desc: 'Instant notifications to families, lawyers, and human rights organisations when new data emerges.' },
]

export default function TraceData() {
  return (
    <>
      <PageHero
        title="KumbiTrace"
        subtitle="A crowd-sourced missing persons tracking and data analysis platform — born from the 2024 Nairobi protests."
        tag="Missing Persons · Data"
        img="https://images.unsplash.com/photo-1591189863430-ab87e120f312?w=1400&q=80&auto=format&fit=crop"
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
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground text-base">Jupyter notebook data visualisations and live data will appear here once connected to the CMS.</p>
        </div>
      </div>
    </>
  )
}
