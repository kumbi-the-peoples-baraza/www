import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'

const projects = [
  {
    title: 'KumbiTrace',
    tag: 'Missing Persons · Data',
    desc: 'Born from the 2024 Nairobi protests — a crowd-sourced platform for tracking enforced disappearances, gathering and analysing data to bring people home.',
    href: '/projects/trace',
    img: 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?w=800&q=80&auto=format&fit=crop',
  },
  {
    title: 'KumbiVote',
    tag: 'Blockchain · Elections',
    desc: 'A bulletproof, first-of-its-kind blockchain-based distributed elections management and polling platform — low latency, tamper-proof, built for Africa.',
    href: '/projects',
    img: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=800&q=80&auto=format&fit=crop',
  },
  {
    title: 'Social Work',
    tag: 'Community · Volunteers',
    desc: 'Connecting volunteers with communities in need through coordinated social programmes across Nairobi and Kenya.',
    href: '/blog',
    img: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=800&q=80&auto=format&fit=crop',
  },
]

export default function Projects() {
  return (
    <>
      <PageHero
        title="Our Projects"
        subtitle="Three pillars of community transformation driving real, measurable impact across Kenya."
        tag="Kumbi Initiatives"
        img="https://images.unsplash.com/photo-1611348586804-61bf6c080437?w=1400&q=80&auto=format&fit=crop"
      />

      <div className="section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {projects.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="glass-card overflow-hidden group hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col"
            >
              <div className="h-52 overflow-hidden shrink-0">
                <img
                  src={p.img} alt={p.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-7 flex flex-col flex-1 gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary/70">{p.tag}</span>
                <h3 className="text-xl font-black tracking-tight leading-snug">{p.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">{p.desc}</p>
                <Link
                  to={p.href}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-primary group-hover:gap-2.5 transition-all mt-2"
                >
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
