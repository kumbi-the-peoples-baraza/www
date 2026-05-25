import { useEffect, useCallback, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { GalleryImage } from '@/types'

interface Props {
  images: GalleryImage[]
  initialIndex?: number
  onClose: () => void
}

export default function ImageGallery({ images, initialIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef(0)

  const prev = useCallback(() => setIndex(i => (i > 0 ? i - 1 : images.length - 1)), [images.length])
  const next = useCallback(() => setIndex(i => (i < images.length - 1 ? i + 1 : 0)), [images.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose, prev, next])

  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (e.deltaY > 0) next()
      else prev()
    }
    window.addEventListener('wheel', handler, { passive: true })
    return () => window.removeEventListener('wheel', handler)
  }, [prev, next])

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev()
  }

  const img = images[index]

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
        aria-label="Close gallery"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="absolute top-4 left-4 text-white/70 text-sm font-semibold">
        {index + 1} / {images.length}
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); prev() }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); next() }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Next image"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      <div className="flex flex-col items-center gap-4 max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <img
          src={img.url}
          alt={img.caption || ''}
          className="max-w-full max-h-[75vh] object-contain rounded-lg"
        />
        {img.caption && (
          <p className="text-white/80 text-sm text-center max-w-lg leading-relaxed">
            {img.caption}
          </p>
        )}
      </div>
    </div>,
    document.body
  )
}