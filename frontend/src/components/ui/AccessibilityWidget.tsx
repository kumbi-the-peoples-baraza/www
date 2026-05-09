import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'

function IconAccessibility() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M5 8.5h14M12 8.5v10M8.5 13l-2 5.5M15.5 13l2 5.5" />
    </svg>
  )
}

function IconTextSmaller() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <text x="3" y="17" fontSize="13" fontFamily="system-ui" fontWeight="600">A</text>
      <text x="14" y="14" fontSize="9" fontFamily="system-ui" fontWeight="500">A</text>
    </svg>
  )
}

function IconTextLarger() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <text x="1" y="14" fontSize="9" fontFamily="system-ui" fontWeight="500">A</text>
      <text x="10" y="17" fontSize="13" fontFamily="system-ui" fontWeight="600">A</text>
    </svg>
  )
}

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false)
  const { textZoom, setTextZoom } = useThemeStore()

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="glass-card p-3 flex flex-col gap-2 min-w-[148px]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">Text Size</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTextZoom(textZoom - 0.1)}
                disabled={textZoom <= 0.75}
                className="flex-1 flex items-center justify-center py-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"
                title="Decrease text size"
              >
                <IconTextSmaller />
              </button>
              <span className="text-xs font-mono text-muted-foreground w-8 text-center">
                {Math.round(textZoom * 100)}%
              </span>
              <button
                onClick={() => setTextZoom(textZoom + 0.1)}
                disabled={textZoom >= 1.5}
                className="flex-1 flex items-center justify-center py-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"
                title="Increase text size"
              >
                <IconTextLarger />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-all',
          open ? 'bg-primary text-white' : 'glass text-foreground hover:scale-105'
        )}
        title="Text size"
        aria-label="Adjust text size"
      >
        <IconAccessibility />
      </button>
    </div>
  )
}
