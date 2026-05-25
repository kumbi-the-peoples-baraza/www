import { motion } from 'framer-motion'
import { Heart, Code, Megaphone, Handshake, Star, ArrowRight } from 'lucide-react'
import { useVolunteerStore } from '@/store/volunteerStore'
import PageHero from '@/components/ui/PageHero'
import { useConfig } from '@/hooks/useConfig'

const ROLE_ICONS: Record<string, React.ElementType> = {
  technology: Code,
  outreach: Megaphone,
  'social-work': Heart,
  'legal-support': Handshake,
}

export default function Volunteer() {
  const { open } = useVolunteerStore()
  const cfg = useConfig()
  const contentParagraphs = (cfg.pages.volunteer.content || '').split('\n\n').filter(Boolean)

  return (
    <>
      <PageHero
        title={cfg.pages.volunteer.heading}
        subtitle={cfg.pages.volunteer.subheading}
        tag={cfg.pages.volunteer.heroTag}
        img={cfg.pages.volunteer.heroImage}
      />
      <div className="section">

        {/* Page body content from config */}
        {contentParagraphs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="max-w-3xl mx-auto mb-14 rich-content text-muted-foreground leading-relaxed space-y-4">
            {contentParagraphs.map((p, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
            ))}
          </motion.div>
        )}

        {/* Volunteer CTA — top */}
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-14">
          <button onClick={open} className="btn-primary">
            <Heart className="w-5 h-5" /> Register to Volunteer <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Role cards */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
          <h2 className="text-3xl font-black mb-4 tracking-tight">How You Can Help</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">We welcome volunteers from all backgrounds. Here are some of the ways you can contribute.</p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-7 mb-14">
          {cfg.pages.volunteer.roles.map((r, i) => {
            const Icon = ROLE_ICONS[r.id] || Star
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glass-card p-7 flex gap-5"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-lg mb-1">{r.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{r.description}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Volunteer CTA — bottom */}
        <div className="text-center">
          <button onClick={open} className="btn-primary">
            <Heart className="w-5 h-5" /> Register to Volunteer <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  )
}
