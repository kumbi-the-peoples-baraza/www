import { motion } from 'framer-motion'
import { Vote, Shield, Zap, Globe } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import { useConfig } from '@/hooks/useConfig'

const features = [
  { icon: Shield,  title: 'Tamper-proof',       desc: 'Every vote is recorded on a distributed blockchain — immutable, verifiable, and transparent.' },
  { icon: Zap,     title: 'Low Latency',         desc: 'Results are tallied in real time with sub-second confirmation, even at national scale.' },
  { icon: Globe,   title: 'Built for Africa',    desc: 'Designed for low-bandwidth environments, feature phones, and offline-first operation.' },
  { icon: Vote,    title: 'Accessible to All',   desc: 'Multi-language, USSD-compatible, and accessible to voters without smartphones.' },
]

export default function KumbiVote() {
  const cfg = useConfig()

  return (
    <>
      <PageHero
        title="KumbiVote"
        subtitle="A bulletproof, first-of-its-kind blockchain-based distributed elections management and polling platform — low latency, tamper-proof, and built for Africa."
        tag="Blockchain · Elections"
        img={cfg.pages.vote.heroImage}
      />
      <div className="section">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-7 mb-16">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
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
          <p className="text-muted-foreground">KumbiVote is currently in development. Full platform details will be published here soon.</p>
        </div>
      </div>
    </>
  )
}
