import { motion } from 'framer-motion'
import { Heart, Target, Eye } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import { useConfig } from '@/hooks/useConfig'

const values = [
  { icon: Heart,  title: 'Community First', desc: 'Every decision we make is guided by the needs and voices of the communities we serve.' },
  { icon: Target, title: 'Data-driven',      desc: 'We use evidence and data to design programmes that create measurable, lasting impact.' },
  { icon: Eye,    title: 'Transparency',     desc: 'We operate openly — our data, our methods, and our results are available to all.' },
]

export default function About() {
  const cfg = useConfig()
  const storyParagraphs = (cfg.pages.about.story || '').split('\n\n').filter(Boolean)
  return (
    <>
      <PageHero
        title="About Kumbi"
        subtitle="The People's Baraza — a civic technology organisation rooted in Nairobi, Kenya."
        tag="Who We Are"
        img={cfg.pages.about.heroImage}
      />

      <div className="section">
        {/* Story + values — two columns on large screens, stacked on small */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">

          {/* Story */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-black mb-6 tracking-tight">Our Story</h2>
            {storyParagraphs.length > 0
              ? storyParagraphs.map((p, i) => <p key={i} className="text-muted-foreground leading-relaxed mb-4">{p}</p>)
              : <>
                  <p className="text-muted-foreground leading-relaxed mb-4">Kumbi was founded in the wake of the 2024 Nairobi protests, when the scale of enforced disappearances made clear that communities needed better tools to protect themselves and hold power to account.</p>
                  <p className="text-muted-foreground leading-relaxed mb-4">We build civic technology that is open, accessible, and designed for the realities of life in Kenya.</p>
                </>
            }
          </motion.div>

          {/* Values */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col gap-6"
          >
            <h2 className="text-3xl font-black mb-2 tracking-tight">Our Values</h2>
            {values.map((v) => (
              <div key={v.title} className="glass-card p-6 flex gap-5 items-start">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <v.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-base mb-1.5">{v.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </>
  )
}
