import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Target, Eye, Star, X } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import { SafeHtml } from '@/components/ui/SafeHtml'
import { useConfig } from '@/hooks/useConfig'
import { peopleApi } from '@/api/client'
import { parseImageValue } from '@/lib/utils'
import type { Person } from '@/types'

const VALUE_ICONS: Record<string, React.ElementType> = {
  'community-first': Heart,
  'data-driven': Target,
  transparency: Eye,
}

export default function About() {
  const cfg = useConfig()
  const storyParagraphs = (cfg.pages.about.content || '').split('\n\n').filter(Boolean)

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => peopleApi.list().then(r => r.data as Person[]),
  })

  const [active, setActive] = useState<Person | null>(null)

  return (
    <>
      <PageHero title={cfg.pages.about.heading} subtitle={cfg.pages.about.subheading}
        tag={cfg.pages.about.heroTag} img={cfg.pages.about.heroImage} />

      <div className="px-[2%] sm:px-[4%] lg:px-[6%] max-w-7xl mx-auto py-16 flex flex-col gap-16">

        {/* Our Story — card, 50% on large screens */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="lg:w-1/2">
            <div className="glass-card p-8">
              <h2 className="text-3xl font-black mb-6 tracking-tight">Our Story</h2>
              {storyParagraphs.length > 0
                ? storyParagraphs.map((p, i) => (
                    <SafeHtml key={i} html={p} className="text-muted-foreground leading-relaxed mb-4 last:mb-0" as="p" />
                  ))
                : <>
                    <p className="text-muted-foreground leading-relaxed mb-4">Kumbi was founded in the wake of the 2024 Nairobi protests, when the scale of enforced disappearances made clear that communities needed better tools to protect themselves and hold power to account.</p>
                    <p className="text-muted-foreground leading-relaxed">We build civic technology that is open, accessible, and designed for the realities of life in Kenya.</p>
                  </>
              }
            </div>
          </div>
        </motion.section>

        {/* Our Values — cards with optional images like project cards */}
        <section>
          <h2 className="text-3xl font-black mb-8 tracking-tight">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            {cfg.pages.about.values.map((v, i) => {
              const Icon = VALUE_ICONS[v.id] || Star
              return (
                <motion.div key={v.id} initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="glass-card overflow-hidden flex flex-col"
                >
                  <div className="p-7 flex flex-col flex-1 gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-black text-lg">{v.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{v.description}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* Our People */}
        {people.length > 0 && (
          <section>
            <h2 className="text-3xl font-black mb-8 tracking-tight">Our People</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {people.map((person, i) => {
                const src = parseImageValue(person.portrait)
                const focal = (person.portrait || '').split('|')[1] || '50% 50%'
                return (
                  <motion.div key={person.id} initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                    className="glass-card overflow-hidden flex flex-col"
                  >
                    {/* Portrait (cropped & displayed in a circle) */}
                    <div className="flex justify-center items-center bg-muted p-8">
                      {src
                        ? <img src={src} alt={person.name} className="w-44 h-44 rounded-full object-cover"
                            style={{ objectPosition: focal }} loading="lazy" />
                        : <div className="w-44 h-44 rounded-full bg-muted flex items-center justify-center text-6xl font-black text-muted-foreground/30">
                            {person.name[0]}
                          </div>
                      }
                    </div>
                    <div className="p-6 flex flex-col gap-2">
                      <h3 className="font-black text-lg leading-tight">
                        <button onClick={() => setActive(person)} className="hover:text-primary transition-colors text-left">
                          {person.name}
                        </button>
                      </h3>
                      <p className="text-sm font-semibold text-primary">{person.position}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}

        {/* Profile overlay */}
        <AnimatePresence>
          {active && createPortal(
            <motion.div
              className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActive(null)}
            >
              <motion.div
                className="glass-card w-full max-w-lg max-h-[85vh] overflow-y-auto"
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="relative">
                  <div className="aspect-[3/4] max-h-80 bg-muted overflow-hidden">
                    {parseImageValue(active.portrait)
                      ? <img src={parseImageValue(active.portrait)} alt={active.name}
                          className="w-full h-full object-cover"
                          style={{ objectPosition: (active.portrait || '').split('|')[1] || '50% 50%' }} />
                      : <div className="w-full h-full flex items-center justify-center text-7xl font-black text-muted-foreground/30">{active.name[0]}</div>
                    }
                  </div>
                  <button
                    onClick={() => setActive(null)}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-6 flex flex-col gap-3">
                  <h3 className="font-black text-2xl leading-tight">{active.name}</h3>
                  <p className="text-sm font-semibold text-primary">{active.position}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{active.bio}</p>
                </div>
              </motion.div>
            </motion.div>,
            document.body
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
