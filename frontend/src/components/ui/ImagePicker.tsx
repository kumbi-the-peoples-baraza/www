import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mediaApi } from '@/api/client'
import { Upload, X, Check, RotateCcw, FlipHorizontal, FlipVertical, ZoomIn, ZoomOut, Move, Square, RectangleHorizontal, RectangleVertical } from 'lucide-react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  value: string          // "url" or "url|x% y%" for focal point
  onChange: (url: string) => void
  label?: string
  circle?: boolean       // crop/display as a circle (people portraits)
}

/** Parse stored value into url + focal point */
function parseValue(v: string): { url: string; focal: string } {
  const [url, focal = '50% 50%'] = v.split('|')
  return { url, focal }
}

// ── Unified image editor (transform + crop + focal) ─────────────────────────
function UnifiedImageEditor({ src, shape = 'rect', onSave, onCancel }: {
  src: string; shape?: 'rect' | 'circle'
  onSave: (dataUrl: string) => void; onCancel: () => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const thumbRef = useRef<HTMLCanvasElement>(null)
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [aspect, setAspect] = useState<'portrait' | 'landscape' | 'square'>('portrait')
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const aspectRatio = shape === 'circle' ? 1 : aspect === 'portrait' ? 3 / 4 : aspect === 'landscape' ? 4 / 3 : 1

  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setNat({ w: img.naturalWidth, h: img.naturalHeight })
      setScale(1); setOff({ x: 0, y: 0 }); setRotation(0); setFlipH(false); setFlipV(false)
    }
    img.src = src
  }, [src])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setStage({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const cover = nat.w > 0 && stage.w > 0 ? Math.max(stage.w / nat.w, stage.h / nat.h) : 1

  const draw = useCallback((canvas: HTMLCanvasElement, outW: number) => {
    const img = imgRef.current
    if (!img || nat.w === 0 || stage.w === 0) return
    const outH = Math.round((outW * stage.h) / stage.w)
    canvas.width = outW; canvas.height = outH
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, outW, outH)
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, outW, outH)
    const K = outW / stage.w
    const drawW = stage.w * cover
    const drawH = stage.h * cover
    ctx.save()
    if (shape === 'circle') {
      ctx.beginPath()
      ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2)
      ctx.clip()
    }
    ctx.translate(outW / 2 + off.x * K, outH / 2 + off.y * K)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
    ctx.scale(scale, scale)
    ctx.scale(K, K)
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()
  }, [nat, stage, cover, off, rotation, flipH, flipV, scale, shape])

  useEffect(() => {
    if (thumbRef.current) draw(thumbRef.current, 160)
  }, [draw])

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    const p = 'touches' in e ? e.touches[0] : e
    drag.current = { x: p.clientX, y: p.clientY, ox: off.x, oy: off.y }
  }
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drag.current) return
    const p = 'touches' in e ? e.touches[0] : e
    setOff({
      x: drag.current.ox + (p.clientX - drag.current.x),
      y: drag.current.oy + (p.clientY - drag.current.y),
    })
  }
  const onUp = () => { drag.current = null }

  const save = () => {
    const out = document.createElement('canvas')
    draw(out, 1200)
    const dataUrl = shape === 'circle'
      ? out.toDataURL('image/png')
      : out.toDataURL('image/jpeg', 0.92)
    onSave(dataUrl)
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center sidebar-overlay">
      <div className="glass-card p-6 max-w-3xl w-full mx-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-primary">{shape === 'circle' ? 'Crop Portrait' : 'Edit & Crop Image'}</h3>
            <p className="text-sm text-muted-foreground">Zoom, rotate, flip and drag to position. The dark frame shows the visible part.</p>
          </div>
          <button onClick={onCancel}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div
            ref={stageRef}
            className="relative flex-1 overflow-hidden bg-black select-none touch-none cursor-move"
            style={{ aspectRatio: String(1 / aspectRatio) }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
          >
            {nat.w > 0 && (
              <img
                src={src} alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: stage.w * cover,
                  height: stage.h * cover,
                  transform: `translate(-50%,-50%) translate(${off.x}px,${off.y}px) rotate(${rotation}deg) scale(${scale}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                }}
              />
            )}
            {shape === 'circle' && (
              <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/70" />
            )}
          </div>

          <div className="md:w-44 flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visible part</p>
            <canvas ref={thumbRef} className="w-40 rounded-lg border border-border bg-black" style={{ aspectRatio: String(1 / aspectRatio) }} />
          </div>
        </div>

        {shape !== 'circle' && (
          <div className="flex flex-wrap gap-2">
            {([['portrait', RectangleVertical], ['landscape', RectangleHorizontal], ['square', Square]] as const).map(([a, Icon]) => (
              <button key={a} onClick={() => setAspect(a)} className={`btn-ghost !py-2 !px-3 !text-sm flex items-center gap-1.5 ${aspect === a ? '!border-primary !text-primary' : ''}`}>
                <Icon className="w-4 h-4" /> {a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setScale(s => Math.min(5, s * 1.2))} className="btn-ghost !py-2 !px-3 !text-sm flex items-center gap-1.5"><ZoomIn className="w-4 h-4" /> Zoom in</button>
          <button onClick={() => setScale(s => Math.max(0.3, s / 1.2))} className="btn-ghost !py-2 !px-3 !text-sm flex items-center gap-1.5"><ZoomOut className="w-4 h-4" /> Zoom out</button>
          <button onClick={() => setRotation(r => r - 90)} className="btn-ghost !py-2 !px-3 !text-sm flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> Left</button>
          <button onClick={() => setRotation(r => r + 90)} className="btn-ghost !py-2 !px-3 !text-sm flex items-center gap-1.5"><RotateCcw className="w-4 h-4 scale-x-[-1]" /> Right</button>
          <button onClick={() => setFlipH(v => !v)} className={`btn-ghost !py-2 !px-3 !text-sm flex items-center gap-1.5 ${flipH ? '!border-primary !text-primary' : ''}`}><FlipHorizontal className="w-4 h-4" /> Flip H</button>
          <button onClick={() => setFlipV(v => !v)} className={`btn-ghost !py-2 !px-3 !text-sm flex items-center gap-1.5 ${flipV ? '!border-primary !text-primary' : ''}`}><FlipVertical className="w-4 h-4" /> Flip V</button>
        </div>

        <div className="flex gap-3">
          <button onClick={save} className="btn-primary flex items-center gap-2"><Check className="w-4 h-4" /> Apply &amp; Use</button>
          <button onClick={onCancel} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main ImagePicker ──────────────────────────────────────────────────────────
export default function ImagePicker({ value, onChange, label = 'Image', circle = false }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { url, focal } = parseValue(value)

  const { data: files = [] } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaApi.list().then(r => r.data),
    enabled: open,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => mediaApi.upload(file, {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['media'] })
      onChange(res.data.url)
      setOpen(false)
    },
  })

  const uploadDataUrl = async (dataUrl: string) => {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    uploadMutation.mutate(new File([blob], `edited-${Date.now()}.${circle ? 'png' : 'jpg'}`, { type: circle ? 'image/png' : 'image/jpeg' }))
  }

  const images = (files as { id: string; url: string; name: string }[])
    .filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.url))

  return (
    <>
      {editing && (
        <UnifiedImageEditor src={editing} shape={circle ? 'circle' : 'rect'}
          onSave={async (d) => { setEditing(null); await uploadDataUrl(d) }}
          onCancel={() => setEditing(null)} />
      )}

      <div className="flex flex-col gap-2">
        <label className="form-label">{label}</label>

        {url && (
          <div className={`relative group w-full h-36 overflow-hidden bg-muted ${circle ? 'rounded-full' : 'rounded-xl'}`}>
            <img src={url} alt="" className="w-full h-full object-cover"
              style={circle ? undefined : { objectPosition: focal }} />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button onClick={() => setEditing(url)} className="btn-primary !py-1.5 !px-3 !text-xs flex items-center gap-1">
                <Move className="w-3 h-3" /> Edit &amp; Crop
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
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2 max-h-72 overflow-y-auto">
                {images.map(f => (
                  <button key={f.id} onClick={() => { onChange(f.url); setOpen(false) }}
                    className={`group relative aspect-square rounded-lg overflow-hidden transition-all ${url === f.url ? 'ring-2 ring-primary' : ''}`}>
                    <img src={f.url} alt={f.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    {url === f.url && (
                      <div className="absolute top-1 right-1 z-10 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">✓</div>
                    )}
                    <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2">
                      <p className="text-white text-[11px] font-bold truncate leading-tight">{f.name}</p>
                    </div>
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
