import { motion } from 'framer-motion'
import { Shield, Zap, Globe, Vote, Star } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import { useConfig } from '@/hooks/useConfig'

const FEATURE_ICONS: Record<string, React.ElementType> = {
  'tamper-proof': Shield,
  'low-latency': Zap,
  'built-for-africa': Globe,
  accessible: Vote,
}

export default function KumbiVote() {
  const cfg = useConfig()

  return (
    <>
      <PageHero
        title={cfg.pages.vote.heading}
        subtitle={cfg.pages.vote.subheading}
        tag={cfg.pages.vote.heroTag}
        img={cfg.pages.vote.heroImage}
      />
      <div className="section">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-7 mb-16">
          {cfg.pages.vote.features.map((f, i) => {
            const Icon = FEATURE_ICONS[f.id] || Star
            return (
              <motion.div key={f.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glass-card p-7 flex gap-5"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-lg mb-1">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">KumbiVote is currently in development. Full platform details will be published here soon.</p>
        </div>
      </div>
    </>
  )
}
