import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Search, Vote, Heart } from 'lucide-react'
import { useVolunteerStore } from '@/store/volunteerStore'

// ── Nairobi aerial panoramic (Unsplash — Nairobi CBD skyline)
const HERO_IMG = 'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=1920&q=90&auto=format&fit=crop'

// ── Project card images — Black Africans / Kenya context
const IMGS = {
  trace:  'https://images.unsplash.com/photo-1591189863430-ab87e120f312?w=900&q=80&auto=format&fit=crop',
  vote:   'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=900&q=80&auto=format&fit=crop',
  social: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=900&q=80&auto=format&fit=crop',
  // Volunteer CTA — shared parallax background with projects strip
  cta:    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1600&q=80&auto=format&fit=crop',
}

const projects = [
  {
    id: 'trace', icon: Search, title: 'KumbiTrace', tag: 'Missing Persons · Data',
    description: 'Born from the 2024 Nairobi protests, KumbiTrace is a crowd-sourced platform for tracking enforced disappearances — gathering, verifying, and analysing data to bring people home.',
    link: '/projects/trace', img: IMGS.trace, accent: '#1123A1',
  },
  {
    id: 'vote', icon: Vote, title: 'KumbiVote', tag: 'Blockchain · Elections',
    description: 'A bulletproof, first-of-its-kind blockchain-based distributed elections management and polling platform — low latency, tamper-proof, and built for Africa.',
    link: '/projects', img: IMGS.vote, accent: '#3E61D8',
  },
  {
    id: 'social', icon: Heart, title: 'Social Work', tag: 'Community · Volunteers',
    description: 'Connecting volunteers with communities in need through coordinated social programmes across Nairobi and Kenya.',
    link: '/blog', img: IMGS.social, accent: '#08104D',
  },
]

// ── Shared parallax background used by both Projects and Volunteer sections
function SharedParallaxBg({ imgSrc, overlay }: { imgSrc: string; overlay: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['-15%', '15%'])
  return (
    <div ref={ref} className="absolute inset-0 -z-10 overflow-hidden">
      <motion.div style={{ y }} className="absolute inset-0 scale-125">
        <img src={imgSrc} alt="" className="w-full h-full object-cover" loading="lazy" aria-hidden />
        <div className="absolute inset-0" style={{ background: overlay }} />
      </motion.div>
    </div>
  )
}

function ParallaxHero() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const imgY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '12%'])
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0])

  return (
    <section ref={ref} className="relative h-screen flex items-center justify-center overflow-hidden">
      <motion.div style={{ y: imgY }} className="absolute inset-0 -z-10 scale-110">
        <img src={HERO_IMG} alt="Nairobi aerial" className="w-full h-full object-cover" loading="eager" />
        {/* Overlay: dark at top/centre, fades to page bg colour at bottom */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(8,16,77,0.72) 0%, rgba(8,16,77,0.60) 60%, rgba(8,16,77,0.10) 100%)'
        }} />
      </motion.div>

      <motion.div style={{ y: textY, opacity }} className="relative z-10 text-center px-6 sm:px-12 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <span className="inline-block px-5 py-2 rounded-full glass text-sm font-semibold mb-8 text-white/90">
            Nairobi · Community · Impact
          </span>
          <h1 className="text-5xl sm:text-7xl font-black mb-6 leading-[1.05] text-white tracking-tight">
            Building a Better{' '}
            <span className="text-[#93C1F1]">Community</span>{' '}
            Together
          </h1>
          <p className="text-lg sm:text-xl text-white/75 mb-10 max-w-2xl mx-auto leading-relaxed">
            Kumbi drives meaningful change across Kenya through data, democracy, and dedicated social work.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/projects" className="btn-primary">
              Explore Projects <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/about" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-white/50 text-white text-base font-bold hover:bg-white/15 transition-colors">
              Learn More
            </Link>
          </div>
        </motion.div>
      </motion.div>

      <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10" animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
        <div className="w-6 h-10 rounded-full border-2 border-white/40 flex items-start justify-center pt-2">
          <div className="w-1 h-2 rounded-full bg-white/70" />
        </div>
      </motion.div>
    </section>
  )
}

function ProjectCard({ project, index }: { project: typeof projects[0]; index: number }) {
  const Icon = project.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.12 }}
      className="glass-card overflow-hidden group hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col"
    >
      <div className="h-48 overflow-hidden relative">
        <img src={project.img} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
        <span className="absolute bottom-3 left-4 text-xs font-bold text-white/85 tracking-widest uppercase">{project.tag}</span>
      </div>
      <div className="p-7 flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: project.accent + '22' }}>
            <Icon className="w-5 h-5" style={{ color: project.accent }} />
          </div>
          <h3 className="text-xl font-black tracking-tight">{project.title}</h3>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed flex-1 mb-5">{project.description}</p>
        <Link to={project.link} className="inline-flex items-center gap-2 text-sm font-bold text-primary group-hover:gap-3 transition-all">
          Learn more <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </motion.div>
  )
}

export default function Home() {
  const { open: openVolunteer } = useVolunteerStore()

  return (
    <>
      {/* ── 1. Hero ── */}
      <ParallaxHero />

      {/* ── Fade from hero into projects ── */}
      <div className="h-24 -mt-24 relative z-10" style={{
        background: 'linear-gradient(to bottom, transparent, hsl(var(--background)))'
      }} />

      {/* ── 2. Projects section ── */}
      <section className="relative py-24 px-6 sm:px-8 lg:px-12">
        {/* Recessed parallax background — subtle, behind content */}
        <SharedParallaxBg imgSrc={IMGS.cta} overlay="linear-gradient(135deg, rgba(17,35,161,0.88) 0%, rgba(62,97,216,0.82) 100%)" />

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-white/60 text-sm font-semibold uppercase tracking-widest mb-3">
              Empowering communities — one project at a time
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">Our Projects</h2>
            <p className="text-white/70 max-w-xl mx-auto text-base">
              Three pillars of community transformation driving real, measurable impact across Kenya.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            {projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── Fade from projects into volunteer ── */}
      <div className="h-1" style={{
        background: 'linear-gradient(to right, hsl(232 85% 32% / 0.6), hsl(222 68% 52% / 0.6))'
      }} />

      {/* ── 3. Volunteer / CTA section — shares same image, different overlay ── */}
      <section className="relative py-28 px-6 sm:px-8 overflow-hidden">
        <SharedParallaxBg imgSrc={IMGS.cta} overlay="rgba(8,16,77,0.78)" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 max-w-2xl mx-auto text-center"
        >
          <span className="inline-block px-5 py-2 rounded-full glass text-sm font-semibold mb-8 text-white/85">
            Join the Movement
          </span>
          <h2 className="text-3xl sm:text-5xl font-black mb-6 text-white tracking-tight leading-tight">
            Ready to Make a<br />Difference?
          </h2>
          <p className="text-white/75 mb-10 text-base leading-relaxed">
            Join hundreds of volunteers already working with Kumbi to transform communities across Nairobi and Kenya.
          </p>
          <button
            onClick={openVolunteer}
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-white text-primary font-black text-base shadow-lg hover:bg-white/90 transition-colors border-2 border-white"
          >
            Volunteer with Kumbi <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </section>

      {/* ── Fade into footer ── */}
      <div className="h-16" style={{
        background: 'linear-gradient(to bottom, rgba(8,16,77,0.15), hsl(var(--nav-bg)))'
      }} />
    </>
  )
}
