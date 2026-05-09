import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import { useConfig } from '@/hooks/useConfig'

export default function Projects() {
  const cfg = useConfig()

  return (
    <>
      <PageHero
        title={cfg.projects.heading}
        subtitle={cfg.projects.subheading}
        tag="Kumbi Initiatives"
        img={cfg.pages.projects.heroImage}
      />
      <div className="section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cfg.projects.items.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="glass-card overflow-hidden group hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col"
            >
              <div className="h-52 overflow-hidden shrink-0">
                <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              </div>
              <div className="p-6 flex flex-col flex-1 gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary/70">{p.tag}</span>
                <h3 className="text-xl font-black mt-1 mb-2">{p.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">{p.description}</p>
                <Link to={p.link} className="inline-flex items-center gap-1.5 text-sm font-bold text-primary group-hover:gap-2.5 transition-all mt-2">
                  Learn more <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  )
}
