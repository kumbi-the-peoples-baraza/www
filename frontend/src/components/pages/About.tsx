import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Heart, Target, Eye, Star } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import { useConfig } from '@/hooks/useConfig'
import { peopleApi } from '@/api/client'
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
                    <p key={i} className="text-muted-foreground leading-relaxed mb-4 last:mb-0"
                      dangerouslySetInnerHTML={{ __html: p }} />
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
              {people.map((person, i) => (
                <motion.div key={person.id} initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="glass-card overflow-hidden flex flex-col"
                >
                  {/* Square portrait thumbnail */}
                  <div className="aspect-square bg-muted overflow-hidden">
                    {person.portrait
                      ? <img src={person.portrait} alt={person.name} className="w-full h-full object-cover" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center text-5xl font-black text-muted-foreground/30">
                          {person.name[0]}
                        </div>
                    }
                  </div>
                  <div className="p-6 flex flex-col gap-2">
                    <h3 className="font-black text-lg leading-tight">{person.name}</h3>
                    <p className="text-sm font-semibold text-primary">{person.position}</p>
                    <p className="text-muted-foreground text-sm leading-relaxed">{person.bio}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
