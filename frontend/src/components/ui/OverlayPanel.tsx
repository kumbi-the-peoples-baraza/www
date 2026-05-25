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
          <motion.div
            key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[9998]"
            style={{
              background: 'rgba(8,12,50,0.5)',
              backdropFilter: 'blur(10px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(10px) saturate(1.3)',
            }}
          />

          <motion.div
            key="panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 290 }}
            onClick={e => e.stopPropagation()}
            className="overlay-panel-responsive overlay-panel"
            style={{
              position: 'fixed',
              top: 0, right: 0, bottom: minimized ? 'auto' : 0,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              background: `
                radial-gradient(ellipse 70% 40% at 50% 0%, rgba(255,255,255,0.4) 0%, transparent 100%),
                linear-gradient(170deg,
                  rgba(255,255,255,0.96) 0%,
                  rgba(235,245,255,0.92) 35%,
                  rgba(210,232,255,0.85) 65%,
                  rgba(190,222,255,0.78) 100%
                )
              `,
              backdropFilter: 'blur(48px) saturate(2.8) brightness(1.25)',
              WebkitBackdropFilter: 'blur(48px) saturate(2.8) brightness(1.25)',
              borderLeft: '1.5px solid rgba(255,255,255,0.85)',
              borderRadius: '0 0 0 0',
              boxShadow: `
                -1px 0 0 rgba(255,255,255,0.5),
                -4px 0 16px rgba(17,35,161,0.08),
                -12px 0 48px rgba(17,35,161,0.10),
                -24px 0 96px rgba(17,35,161,0.05),
                inset 0 0 0 1px rgba(255,255,255,0.3)
              `,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              padding: '2rem 2.25rem 1.25rem',
              borderBottom: '1px solid rgba(26,59,184,0.08)',
              position: 'relative',
            }}>
              <div>
                <h2 style={{
                  fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.025em',
                  background: 'linear-gradient(135deg, #0A1A6B 0%, #1A3BB8 60%, #3B6FE0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  margin: 0, lineHeight: 1.15,
                }}>
                  {title}
                </h2>
                {subtitle && (
                  <p style={{
                    fontSize: '0.9rem',
                    color: 'rgba(26,59,184,0.55)',
                    marginTop: '0.3rem',
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                  }}>
                    {subtitle}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.125rem', marginLeft: '1rem', flexShrink: 0 }}>
                <button
                  onClick={() => setMinimized(v => !v)}
                  aria-label={minimized ? 'Expand' : 'Minimise'}
                  className="flex items-center justify-center rounded-lg transition-all duration-150"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem',
                    color: 'rgba(26,59,184,0.4)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#1A3BB8'; e.currentTarget.style.background = 'rgba(26,59,184,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(26,59,184,0.4)'; e.currentTarget.style.background = 'none' }}
                >
                  <Minus size={18} strokeWidth={2.5} />
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="flex items-center justify-center rounded-lg transition-all duration-150"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem',
                    color: 'rgba(26,59,184,0.4)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(26,59,184,0.4)'; e.currentTarget.style.background = 'none' }}
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {!minimized && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2.25rem 2.5rem', position: 'relative' }}>
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