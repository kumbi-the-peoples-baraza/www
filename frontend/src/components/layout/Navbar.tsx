import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Moon, Sun, Menu, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import { useVolunteerStore } from '@/store/volunteerStore'
import { cn } from '@/lib/utils'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/projects', label: 'Projects' },
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, toggleTheme, textZoom, setTextZoom } = useThemeStore()
  const { open: openVolunteer } = useVolunteerStore()
  const location = useLocation()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => setMobileOpen(false), [location])

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-40 transition-all duration-300',
        scrolled ? 'glass shadow-lg shadow-black/10 py-2' : 'py-4 bg-transparent'
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl gradient-bg flex items-center justify-center text-white font-bold text-sm">J</div>
          <span className="font-bold text-lg gradient-text">Kumbi</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                location.pathname === l.to
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={openVolunteer}
            className="ml-2 px-4 py-1.5 rounded-xl gradient-bg text-white text-sm font-semibold shadow-md hover:opacity-90 transition-opacity"
          >
            Volunteer
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button onClick={() => setTextZoom(textZoom - 0.1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={() => setTextZoom(textZoom + 0.1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={toggleTheme} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-white/10 px-4 pb-4 pt-2 flex flex-col gap-1"
          >
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname === l.to ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
                )}
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={openVolunteer}
              className="mt-2 px-4 py-2 rounded-xl gradient-bg text-white text-sm font-semibold"
            >
              Volunteer with Kumbi
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
