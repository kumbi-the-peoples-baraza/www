import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mediaApi } from '@/api/client'
import { Upload, X, Check, RotateCcw, FlipHorizontal, FlipVertical, Move } from 'lucide-react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  value: string          // "url" or "url|x% y%" for focal point
  onChange: (url: string) => void
  label?: string
}

/** Parse stored value into url + focal point */
function parseValue(v: string): { url: string; focal: string } {
  const [url, focal = '50% 50%'] = v.split('|')
  return { url, focal }
}

// ── Focal point picker ────────────────────────────────────────────────────────
function FocalPicker({ src, focal, onSave, onCancel }: {
  src: string; focal: string
  onSave: (focal: string) => void; onCancel: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(() => {
    const [x, y] = focal.replace(/%/g, '').split(' ').map(Number)
    return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y }
  })
  const dragging = useRef(false)

  const updatePos = useCallback((e: MouseEvent | TouchEvent) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const x = Math.round(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)))
    const y = Math.round(Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)))
    setPos({ x, y })
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => { if (dragging.current) updatePos(e) }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [updatePos])

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center sidebar-overlay">
      <div className="glass-card p-6 max-w-2xl w-full mx-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-primary">Set Focal Point</h3>
            <p className="text-sm text-muted-foreground">Drag the crosshair to choose which part of the image is always visible</p>
          </div>
          <button onClick={onCancel}><X className="w-5 h-5" /></button>
        </div>

        {/* Preview with draggable focal point */}
        <div
          ref={containerRef}
          className="relative w-full h-72 overflow-hidden rounded-xl bg-muted cursor-crosshair select-none"
          onMouseDown={e => { dragging.current = true; updatePos(e.nativeEvent) }}
          onTouchStart={e => { dragging.current = true; updatePos(e.nativeEvent) }}
        >
          <img
            src={src} alt=""
            className="w-full h-full object-cover pointer-events-none"
            style={{ objectPosition: `${pos.x}% ${pos.y}%` }}
            draggable={false}
          />
          {/* Crosshair */}
          <div
            className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div className="absolute inset-0 rounded-full border-2 border-white shadow-lg" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/80" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/80" />
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Focal point: {pos.x}% {pos.y}% — the image will always show this area regardless of crop
        </p>

        <div className="flex gap-3">
          <button onClick={() => onSave(`${pos.x}% ${pos.y}%`)} className="btn-primary flex items-center gap-2">
            <Check className="w-4 h-4" /> Apply Focal Point
          </button>
          <button onClick={onCancel} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Canvas image editor (rotate/flip) ─────────────────────────────────────────
function ImageEditor({ src, onSave, onCancel }: { src: string; onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const rad = (rotation * Math.PI) / 180
    const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad))
    canvas.width  = img.width * cos + img.height * sin
    canvas.height = img.width * sin + img.height * cos
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(rad)
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    ctx.restore()
  }, [rotation, flipH, flipV])

  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; draw() }
    img.src = src
  }, [src])

  useEffect(() => { draw() }, [draw])

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center sidebar-overlay">
      <div className="glass-card p-6 max-w-2xl w-full mx-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-primary">Edit Image</h3>
          <button onClick={onCancel}><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-auto max-h-[50vh] flex items-center justify-center bg-muted rounded-xl p-2">
          <canvas ref={canvasRef} className="max-w-full max-h-[45vh] rounded" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setRotation(r => r - 90)} className="btn-ghost !py-2 !px-3 !text-sm flex items-center gap-1.5">
            <RotateCcw className="w-4 h-4" /> Left
          </button>
          <button onClick={() => setRotation(r => r + 90)} className="btn-ghost !py-2 !px-3 !text-sm flex items-center gap-1.5">
            <RotateCcw className="w-4 h-4 scale-x-[-1]" /> Right
          </button>
          <button onClick={() => setFlipH(v => !v)} className={`btn-ghost !py-2 !px-3 !text-sm flex items-center gap-1.5 ${flipH ? '!border-primary !text-primary' : ''}`}>
            <FlipHorizontal className="w-4 h-4" /> Flip H
          </button>
          <button onClick={() => setFlipV(v => !v)} className={`btn-ghost !py-2 !px-3 !text-sm flex items-center gap-1.5 ${flipV ? '!border-primary !text-primary' : ''}`}>
            <FlipVertical className="w-4 h-4" /> Flip V
          </button>
        </div>
        <div className="flex gap-3">
          <button onClick={() => onSave(canvasRef.current!.toDataURL('image/jpeg', 0.92))} className="btn-primary flex items-center gap-2">
            <Check className="w-4 h-4" /> Apply & Use
          </button>
          <button onClick={onCancel} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main ImagePicker ──────────────────────────────────────────────────────────
export default function ImagePicker({ value, onChange, label = 'Image' }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [pickingFocal, setPickingFocal] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { url, focal } = parseValue(value)

  const { data: files = [] } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaApi.list().then(r => r.data),
    enabled: open,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => mediaApi.upload(file),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['media'] })
      onChange(res.data.url)
      setOpen(false)
    },
  })

  const uploadDataUrl = async (dataUrl: string) => {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    uploadMutation.mutate(new File([blob], `edited-${Date.now()}.jpg`, { type: 'image/jpeg' }))
  }

  const images = (files as { id: string; url: string; name: string }[])
    .filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.url))

  return (
    <>
      {editing && (
        <ImageEditor src={editing}
          onSave={async (d) => { setEditing(null); await uploadDataUrl(d) }}
          onCancel={() => setEditing(null)} />
      )}
      {pickingFocal && url && (
        <FocalPicker src={url} focal={focal}
          onSave={(f) => { onChange(`${url}|${f}`); setPickingFocal(false) }}
          onCancel={() => setPickingFocal(false)} />
      )}

      <div className="flex flex-col gap-2">
        <label className="form-label">{label}</label>

        {url && (
          <div className="relative group w-full h-36 rounded-xl overflow-hidden bg-muted">
            <img src={url} alt="" className="w-full h-full object-cover"
              style={{ objectPosition: focal }} />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button onClick={() => setEditing(url)} className="btn-primary !py-1.5 !px-3 !text-xs flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Edit
              </button>
              <button onClick={() => setPickingFocal(true)} className="btn-primary !py-1.5 !px-3 !text-xs flex items-center gap-1">
                <Move className="w-3 h-3" /> Focal
              </button>
              <button onClick={() => onChange('')} className="btn-ghost !py-1.5 !px-3 !text-xs border-white/50 text-white hover:bg-white/20">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        <input value={url} onChange={e => onChange(e.target.value)} className="input-field"
          placeholder="https://... or select below" />

        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} className="btn-ghost !py-2 !px-3 !text-sm flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Upload from computer
          </button>
          <button onClick={() => setOpen(v => !v)} className="btn-ghost !py-2 !px-3 !text-sm">
            {open ? 'Hide library' : 'Select from media library'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f) }} />

        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2 max-h-64 overflow-y-auto">
                {images.map(f => (
                  <button key={f.id} onClick={() => { onChange(f.url); setOpen(false) }}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all hover:border-primary ${url === f.url ? 'border-primary' : 'border-transparent'}`}>
                    <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                  </button>
                ))}
                {images.length === 0 && (
                  <p className="col-span-full text-sm text-muted-foreground py-4 text-center">No images yet. Upload one above.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {uploadMutation.isPending && <p className="text-sm text-primary font-semibold">Uploading…</p>}
      </div>
    </>
  )
}
