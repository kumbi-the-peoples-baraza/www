import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function OverlayPanel({ open, onClose, title, subtitle, children }: Props) {
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else { document.body.style.overflow = ''; setMinimized(false) }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              background: 'rgba(8,16,77,0.45)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="overlay-panel-responsive"
            style={{
              position: 'fixed',
              top: 0, right: 0, bottom: minimized ? 'auto' : 0,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              /* Bright, cheerful — vivid sky-blue tinted glass */
              background: 'linear-gradient(160deg, rgba(147,193,241,0.82) 0%, rgba(62,97,216,0.18) 100%)',
              backdropFilter: 'blur(32px) saturate(2.2) brightness(1.15)',
              WebkitBackdropFilter: 'blur(32px) saturate(2.2) brightness(1.15)',
              borderLeft: '1.5px solid rgba(255,255,255,0.65)',
              boxShadow: '-12px 0 60px rgba(17,35,161,0.18)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              padding: '1.75rem 2rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.45)',
            }}>
              <div>
                <h2 style={{
                  fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.025em',
                  color: '#1434A4', margin: 0, lineHeight: 1.1,
                }}>
                  {title}
                </h2>
                {subtitle && (
                  <p style={{ fontSize: '0.95rem', color: 'rgba(20,52,164,0.7)', marginTop: '0.35rem' }}>
                    {subtitle}
                  </p>
                )}
              </div>
              {/* Borderless icon buttons — no background box */}
              <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '1rem', flexShrink: 0 }}>
                <button
                  onClick={() => setMinimized(v => !v)}
                  aria-label={minimized ? 'Expand' : 'Minimise'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem',
                    color: 'hsl(var(--foreground) / 0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'hsl(var(--primary))')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'hsl(var(--foreground) / 0.6)')}
                >
                  <Minus size={20} strokeWidth={2} />
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem',
                    color: 'hsl(var(--foreground) / 0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'hsl(var(--destructive))')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'hsl(var(--foreground) / 0.6)')}
                >
                  <X size={20} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Scrollable body — hidden when minimized */}
            {!minimized && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                {children}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
