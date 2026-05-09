import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mediaApi } from '@/api/client'
import { Upload, X, Check, RotateCcw, FlipHorizontal, FlipVertical, Crop } from 'lucide-react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  value: string
  onChange: (url: string) => void
  label?: string
}

// ── Canvas image editor ───────────────────────────────────────────────────────
function ImageEditor({ src, onSave, onCancel }: { src: string; onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; draw() }
    img.src = src
  }, [src])

  const draw = () => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const rad = (rotation * Math.PI) / 180
    const sin = Math.abs(Math.sin(rad))
    const cos = Math.abs(Math.cos(rad))
    canvas.width  = img.width  * cos + img.height * sin
    canvas.height = img.width  * sin + img.height * cos
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(rad)
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    ctx.restore()
  }

  useEffect(() => { draw() }, [rotation, flipH, flipV])

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onSave(canvas.toDataURL('image/jpeg', 0.92))
  }

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
          <button onClick={() => setRotation(r => r - 90)} className="btn-ghost flex items-center gap-1.5 !py-2 !px-3 !text-sm">
            <RotateCcw className="w-4 h-4" /> Rotate Left
          </button>
          <button onClick={() => setRotation(r => r + 90)} className="btn-ghost flex items-center gap-1.5 !py-2 !px-3 !text-sm">
            <RotateCcw className="w-4 h-4 scale-x-[-1]" /> Rotate Right
          </button>
          <button onClick={() => setFlipH(v => !v)} className={`btn-ghost flex items-center gap-1.5 !py-2 !px-3 !text-sm ${flipH ? '!border-primary !text-primary' : ''}`}>
            <FlipHorizontal className="w-4 h-4" /> Flip H
          </button>
          <button onClick={() => setFlipV(v => !v)} className={`btn-ghost flex items-center gap-1.5 !py-2 !px-3 !text-sm ${flipV ? '!border-primary !text-primary' : ''}`}>
            <FlipVertical className="w-4 h-4" /> Flip V
          </button>
        </div>
        <div className="flex gap-3">
          <button onClick={save} className="btn-primary flex items-center gap-2"><Check className="w-4 h-4" /> Apply & Use</button>
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
  const fileRef = useRef<HTMLInputElement>(null)

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

  // Upload a data URL (from editor) as a file
  const uploadDataUrl = async (dataUrl: string) => {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const file = new File([blob], `edited-${Date.now()}.jpg`, { type: 'image/jpeg' })
    uploadMutation.mutate(file)
  }

  const images = (files as { id: string; url: string; name: string }[])
    .filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.url))

  return (
    <>
      {editing && (
        <ImageEditor
          src={editing}
          onSave={async (dataUrl) => { setEditing(null); await uploadDataUrl(dataUrl) }}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="flex flex-col gap-2">
        <label className="form-label">{label}</label>

        {/* Current image preview */}
        {value && (
          <div className="relative group w-full h-36 rounded-xl overflow-hidden bg-muted">
            <img src={value} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button onClick={() => setEditing(value)} className="btn-primary !py-1.5 !px-3 !text-xs flex items-center gap-1">
                <Crop className="w-3 h-3" /> Edit
              </button>
              <button onClick={() => onChange('')} className="btn-ghost !py-1.5 !px-3 !text-xs border-white/50 text-white hover:bg-white/20">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* URL input */}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="input-field"
          placeholder="https://... or select below"
        />

        {/* Actions */}
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

        {/* Media library picker */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2 max-h-64 overflow-y-auto">
                {images.map(f => (
                  <button
                    key={f.id}
                    onClick={() => { onChange(f.url); setOpen(false) }}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all hover:border-primary ${value === f.url ? 'border-primary' : 'border-transparent'}`}
                  >
                    <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                  </button>
                ))}
                {images.length === 0 && (
                  <p className="col-span-full text-sm text-muted-foreground py-4 text-center">No images in library yet. Upload one above.</p>
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
