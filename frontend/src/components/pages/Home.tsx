import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Vote, Heart } from 'lucide-react'
import { useVolunteerStore } from '@/store/volunteerStore'

const projects = [
  {
    id: 'trace',
    icon: BarChart3,
    title: 'Trace',
    description: 'Data-driven community tracking and analytics platform for measuring social impact.',
    color: 'from-violet-500 to-cyan-500',
    link: '/projects/trace',
  },
  {
    id: 'vote',
    icon: Vote,
    title: 'Vote',
    description: 'Transparent, accessible digital voting system empowering community decision-making.',
    color: 'from-pink-500 to-orange-500',
    link: '/projects',
  },
  {
    id: 'social',
    icon: Heart,
    title: 'Social Work',
    description: 'Connecting volunteers with communities in need through coordinated social programs.',
    color: 'from-green-500 to-teal-500',
    link: '/blog',
  },
]

function ParallaxHero() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '40%'])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <section ref={ref} className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Parallax background */}
      <motion.div style={{ y }} className="absolute inset-0 -z-10">
        <div className="absolute inset-0 gradient-bg opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        {/* Floating orbs */}
        {[
          { size: 'w-96 h-96', pos: '-top-20 -left-20', color: 'bg-primary/20' },
          { size: 'w-64 h-64', pos: 'top-1/3 right-10', color: 'bg-cyan-500/15' },
          { size: 'w-48 h-48', pos: 'bottom-20 left-1/4', color: 'bg-pink-500/15' },
        ].map((orb, i) => (
          <motion.div
            key={i}
            className={`absolute ${orb.size} ${orb.pos} ${orb.color} rounded-full blur-3xl`}
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </motion.div>

      <motion.div style={{ opacity }} className="text-center px-4 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full glass text-sm font-medium mb-6 text-primary">
            Community · Impact · Change
          </span>
          <h1 className="text-5xl sm:text-7xl font-extrabold mb-6 leading-tight">
            Building a Better{' '}
            <span className="gradient-text">Community</span>
            {' '}Together
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Kumbi drives meaningful change through data, democracy, and dedicated social work.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/projects" className="btn-primary flex items-center gap-2">
              Explore Projects <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/about" className="btn-ghost glass">
              Learn More
            </Link>
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-primary/40 flex items-start justify-center pt-2">
          <div className="w-1 h-2 rounded-full bg-primary" />
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
      transition={{ delay: index * 0.15 }}
      className="glass-card p-6 group hover:scale-[1.02] transition-transform cursor-pointer"
    >
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${project.color} flex items-center justify-center mb-4 shadow-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-xl font-bold mb-2">{project.title}</h3>
      <p className="text-muted-foreground text-sm mb-4">{project.description}</p>
      <Link to={project.link} className="flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
        Learn more <ArrowRight className="w-4 h-4" />
      </Link>
    </motion.div>
  )
}

export default function Home() {
  const { open: openVolunteer } = useVolunteerStore()

  return (
    <>
      <ParallaxHero />

      {/* Projects section */}
      <section className="section">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Our Projects</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Three pillars of community transformation driving real, measurable impact.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="glass-card p-10 sm:p-16 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 gradient-bg opacity-10" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 relative">Ready to Make a Difference?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto relative">
            Join hundreds of volunteers already working with Kumbi to transform communities.
          </p>
          <button onClick={openVolunteer} className="btn-primary relative">
            Volunteer with Kumbi
          </button>
        </motion.div>
      </section>
    </>
  )
}
