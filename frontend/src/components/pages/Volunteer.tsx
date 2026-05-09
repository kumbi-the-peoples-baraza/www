import { motion } from 'framer-motion'
import { Heart, Code, Megaphone, Handshake } from 'lucide-react'
import { useVolunteerStore } from '@/store/volunteerStore'
import PageHero from '@/components/ui/PageHero'

const roles = [
  { icon: Code,       title: 'Technology',    desc: 'Developers, designers, data scientists — help us build and improve our platforms.' },
  { icon: Megaphone,  title: 'Outreach',      desc: 'Community organisers and communicators who can spread the word and mobilise people.' },
  { icon: Heart,      title: 'Social Work',   desc: 'Trained social workers and counsellors supporting families and communities in need.' },
  { icon: Handshake,  title: 'Legal Support', desc: 'Lawyers and paralegals helping families navigate the legal system.' },
]

export default function Volunteer() {
  const { open } = useVolunteerStore()

  return (
    <>
      <PageHero
        title="Volunteer with Kumbi"
        subtitle="Join hundreds of changemakers already working to transform communities across Kenya."
        tag="Get Involved"
        img="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1400&q=80&auto=format&fit=crop"
      />
      <div className="section">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
          <h2 className="text-3xl font-black mb-4 tracking-tight">How You Can Help</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">We welcome volunteers from all backgrounds. Here are some of the ways you can contribute.</p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-7 mb-14">
          {roles.map((r, i) => (
            <motion.div key={r.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="glass-card p-7 flex gap-5"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <r.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-black text-lg mb-1">{r.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{r.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="text-center">
          <button onClick={open} className="btn-primary">
            <Heart className="w-5 h-5" /> Register to Volunteer
          </button>
        </div>
      </div>
    </>
  )
}
