import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mediaApi, galleryApi, configApi } from '@/api/client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Upload, Trash2, Image, FileText, Film, Music, Settings, Save, ZoomIn, ZoomOut, RotateCw, RefreshCw, X, Pencil, Search, Lock, ChevronLeft, ChevronRight, Camera, Calendar, User, Eye, Maximize2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { MediaFile } from '@/types'

const iconFor = (url: string) => {
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) return Image
  if (/\.(mp4|webm|mov)$/i.test(url)) return Film
  if (/\.(mp3|wav|ogg)$/i.test(url)) return Music
  return FileText
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Client-side JPEG EXIF reader ─────────────────────────────────────────
interface ExifData {
  make?: string; model?: string; dateTimeOriginal?: string
  iso?: number; focalLength?: string; aperture?: string; exposureTime?: string
  software?: string; gpsLat?: number; gpsLng?: number
}

async function readExif(file: File): Promise<ExifData | null> {
  if (!/^image\/jpe?g$/i.test(file.type)) return null
  const buf = await file.slice(0, 128 * 1024).arrayBuffer()
  const dv = new DataView(buf)
  const exif: ExifData = {}
  const getString = (offset: number, length: number) => {
    const bytes = new Uint8Array(buf, offset, length)
    return String.fromCharCode(...bytes).replace(/\0+$/, '') || undefined
  }

  // Find APP1 (EXIF) marker
  let pos = 2
  while (pos + 8 < buf.byteLength) {
    if (dv.getUint16(pos) !== 0xFFE1) { pos += 2 + dv.getUint16(pos + 2); continue }
    const exifId = getString(pos + 4, 6)
    if (exifId !== 'Exif\0\0') break

    const little = dv.getUint8(pos + 10) === 0x49
    const read16 = (off: number) => little ? dv.getUint16(off, true) : dv.getUint16(off, false)
    const read32 = (off: number) => little ? dv.getUint32(off, true) : dv.getUint32(off, false)

    const ifd0Off = read32(pos + 14) + pos + 10
    const entries = read16(ifd0Off)

    const tags: Record<number, { type: number; count: number; off: number }> = {}
    for (let i = 0; i < entries; i++) {
      const entryOff = ifd0Off + 2 + i * 12
      tags[read16(entryOff)] = {
        type: read16(entryOff + 2),
        count: read32(entryOff + 4),
        off: read32(entryOff + 8),
      }
    }

    const readTag = (tagId: number): string | number | undefined => {
      const t = tags[tagId]
      if (!t) return undefined
      const base = pos + 10
      if (t.type === 2 && t.off < 0x10000) {
        const strOff = t.off + base
        if (strOff + t.count <= buf.byteLength) return getString(strOff, t.count)
      }
      if (t.type === 3 && t.count === 1) return dv.getUint16(base + t.off, little)
      if (t.type === 4 && t.count === 1) return dv.getUint32(base + t.off, little)
      if (t.type === 5 && t.count === 1) {
        const num = dv.getUint32(base + t.off, little)
        const den = dv.getUint32(base + t.off + 4, little)
        return den ? +(num / den).toFixed(1) : undefined
      }
      if (t.type === 10 && t.count === 3) {
        const v = (v: number) => dv.getUint32(base + t.off + v * 8, little) / dv.getUint32(base + t.off + v * 8 + 4, little)
        return `${v(0)}/${v(1)}/${v(2)}`
      }
      return undefined
    }

    exif.make = readTag(0x010F) as string | undefined
    exif.model = readTag(0x0110) as string | undefined
    exif.dateTimeOriginal = readTag(0x9003) as string | undefined
    exif.software = readTag(0x0131) as string | undefined
    exif.iso = readTag(0x8827) as number | undefined
    exif.focalLength = readTag(0x920A) as string | undefined
    exif.aperture = readTag(0x829D) as string | undefined
    exif.exposureTime = readTag(0x829A) as string | undefined

    // GPS sub-IFD
    const gpsIfdOff = tags[0x8825]?.off
    if (gpsIfdOff && gpsIfdOff < 0x10000) {
      const gpsOff = gpsIfdOff + pos + 10
      const gpsEntries = read16(gpsOff)
      for (let i = 0; i < gpsEntries; i++) {
        const eOff = gpsOff + 2 + i * 12
        const gpsTag = read16(eOff)
        const gpsType = read16(eOff + 2)
        const gpsVal = read32(eOff + 8)
        if (gpsTag === 2 && gpsType === 5) exif.gpsLat = dv.getUint32(pos + 10 + gpsVal, little) / dv.getUint32(pos + 10 + gpsVal + 4, little)
        if (gpsTag === 4 && gpsType === 5) exif.gpsLng = dv.getUint32(pos + 10 + gpsVal, little) / dv.getUint32(pos + 10 + gpsVal + 4, little)
      }
    }
    break
  }
  return Object.keys(exif).length ? exif : null
}

// ── Client-side watermark application ──────────────────────────────────────
async function applyWatermark(file: File, wm: {
  text: string; font: string; size: number; weight: string; style: string;
  color: string; opacity: number; position: string
}): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new window.Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = URL.createObjectURL(file)
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  const px = wm.size * (canvas.width / 1200)
  ctx.font = `${wm.style} ${wm.weight} ${px}px "${wm.font}"`
  ctx.fillStyle = wm.color
  ctx.globalAlpha = wm.opacity
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  const pad = 24
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  const positions: Record<string, [number, number]> = {
    'top-left': [pad, pad],
    'top-center': [cx, pad],
    'top-right': [canvas.width - pad, pad],
    'center': [cx, cy],
    'bottom-left': [pad, canvas.height - pad],
    'bottom-center': [cx, canvas.height - pad],
    'bottom-right': [canvas.width - pad, canvas.height - pad],
  }
  const [x, y] = positions[wm.position] || positions['bottom-right']
  ctx.fillText(wm.text, x, y)

  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), file.type))
  URL.revokeObjectURL(img.src)
  return new File([blob], file.name, { type: file.type })
}

function ImageDonePreview({ result, caption, photographer, dateTaken, exif, fileSize, onClose, onReset }: {
  result: { id: string; url: string; name: string }; caption: string; photographer: string; dateTaken: string
  exif: ExifData | null; fileSize: number; onClose: () => void; onReset: () => void
}) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result.url)

  useEffect(() => {
    if (!isImg) return
    const img = new window.Image()
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = result.url
  }, [result.url])

  const aspectRatio = dims ? `${(dims.w / dims.h).toFixed(2)}:1` : null
  const camera = exif ? [exif.make, exif.model].filter(Boolean).join(' ') : null
  const exifDate = exif?.dateTimeOriginal

  return (
    <div className="p-5 flex flex-col gap-4">
      {isImg ? (
        <img src={result.url} alt={result.name} className="w-full h-48 object-cover rounded-xl" />
      ) : (
        <div className="w-full h-32 flex items-center justify-center rounded-xl bg-muted">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      {/* Primary metadata — always visible */}
      <div className="rounded-xl border border-border divide-y divide-border text-sm">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-muted-foreground">File size</span>
          <span className="font-semibold">{formatSize(fileSize)}</span>
        </div>
        {dims && (
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-muted-foreground">Dimensions</span>
            <span className="font-semibold">{dims.w} × {dims.h} px</span>
          </div>
        )}
        {aspectRatio && (
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-muted-foreground">Aspect ratio</span>
            <span className="font-semibold">{aspectRatio}</span>
          </div>
        )}
        {(exifDate || dateTaken) && (
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-muted-foreground">Date taken</span>
            <span className="font-semibold">{formatDate(exifDate || dateTaken)}</span>
          </div>
        )}
        {camera && (
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-muted-foreground">Camera</span>
            <span className="font-semibold">{camera}</span>
          </div>
        )}
        {caption && (
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-muted-foreground">Caption</span>
            <span className="font-semibold text-right truncate ml-4">{caption}</span>
          </div>
        )}
        {photographer && (
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-muted-foreground">Photographer</span>
            <span className="font-semibold">{photographer}</span>
          </div>
        )}
      </div>

      {/* Collapsible extra EXIF */}
      {exif && (exif.iso || exif.focalLength || exif.aperture || exif.exposureTime || exif.software || exif.gpsLat || exif.gpsLng) && (
        <details className="rounded-xl border border-border text-sm" open={moreOpen} onToggle={e => setMoreOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="px-4 py-2.5 font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
            More metadata
          </summary>
          <div className="border-t border-border divide-y divide-border">
            {exif.iso && <MetaRow label="ISO" value={String(exif.iso)} />}
            {exif.focalLength && <MetaRow label="Focal length" value={exif.focalLength} />}
            {exif.aperture && <MetaRow label="Aperture" value={`f/${exif.aperture}`} />}
            {exif.exposureTime && <MetaRow label="Exposure" value={`1/${Math.round(1 / Number(exif.exposureTime))}s`} />}
            {exif.software && <MetaRow label="Software" value={exif.software} />}
            {exif.gpsLat !== undefined && exif.gpsLng !== undefined && (
              <MetaRow label="GPS" value={`${exif.gpsLat.toFixed(4)}, ${exif.gpsLng.toFixed(4)}`} />
            )}
          </div>
        </details>
      )}

      <div className="flex gap-3 justify-center">
        <button onClick={onClose} className="btn-primary">Done</button>
        <button onClick={onReset} className="btn-ghost">Upload another</button>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

// ── Upload dialog overlay ─────────────────────────────────────────────────
function UploadDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const cfg = qc.getQueryData(['site-config']) as { watermark?: Record<string, unknown> } | undefined
  const wm = cfg?.watermark || {}
  const wmEnabled = !!(wm as { enabled?: boolean }).enabled

  const [selected, setSelected] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [caption, setCaption] = useState('')
  const [photographer, setPhotographer] = useState('')
  const [dateTaken, setDateTaken] = useState('')
  const [preview, setPreview] = useState('')
  const [watermark, setWatermark] = useState(wmEnabled)
  const [status, setStatus] = useState<'form' | 'uploading' | 'done'>('form')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ id: string; url: string; name: string } | null>(null)
  const [exif, setExif] = useState<ExifData | null>(null)

  useEffect(() => {
    if (!selected) { setPreview(''); return }
    const url = URL.createObjectURL(selected)
    setPreview(url)
    if (!name) setName(selected.name.replace(/\.[^.]+$/, ''))
    return () => URL.revokeObjectURL(url)
  }, [selected])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setSelected(f)
  }

  const submit = async () => {
    if (!selected || !name.trim()) return
    let file = selected
    if (watermark && /^image\//.test(file.type)) {
      setStatus('uploading')
      setProgress(0)
      file = await applyWatermark(file, wm as Parameters<typeof applyWatermark>[1])
    }
    // Extract EXIF before upload
    const exifData = await readExif(selected)
    setExif(exifData)

    setStatus('uploading')
    setProgress(0)
    try {
      const res = await mediaApi.upload(file, { name: name.trim(), caption, photographer, dateTaken }, setProgress)
      const data = res.data as { id: string; url: string; name: string }
      setResult(data)
      setStatus('done')
      qc.invalidateQueries({ queryKey: ['media'] })
    } catch {
      setStatus('form')
    }
  }

  const isImg = selected && /^image\//.test(selected.type)

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-black text-lg">
            {status === 'done' ? 'Upload Complete' : status === 'uploading' ? 'Uploading…' : 'Upload Media'}
          </h2>
          {status !== 'uploading' && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
          )}
        </div>

        {status === 'uploading' && (
          <div className="p-10 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <RefreshCw className="w-7 h-7 text-primary animate-spin" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">{watermark ? 'Watermarking & uploading…' : 'Uploading to server…'}</p>
            <div className="w-full max-w-xs h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs font-mono text-muted-foreground">{progress}%</p>
          </div>
        )}

        {status === 'done' && result && (
          <ImageDonePreview result={result} caption={caption} photographer={photographer} dateTaken={dateTaken} exif={exif} fileSize={selected?.size || 0} onClose={onClose} onReset={() => { setStatus('form'); setSelected(null); setName(''); setCaption(''); setPhotographer(''); setDateTaken(''); setPreview(''); setResult(null); setExif(null); setProgress(0) }} />
        )}

        {status === 'form' && (<>
          <div className="p-5 flex flex-col gap-4">
            {!selected ? (
              <label className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">Click to select a file</p>
                <input type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf" onChange={handleFileSelect} />
              </label>
            ) : (
              <div className="flex flex-col gap-4">
                {isImg && preview && (
                  <img src={preview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                )}
                {!isImg && (
                  <div className="flex items-center justify-center h-24 rounded-xl bg-muted">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">{selected.name}</span>
                  </div>
                )}
                <button onClick={() => setSelected(null)} className="text-xs text-primary font-semibold self-start hover:underline">Choose a different file</button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div>
                <label className="form-label">Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Image name" required />
              </div>
              <div>
                <label className="form-label">Caption</label>
                <input value={caption} onChange={e => setCaption(e.target.value)} className="input-field" placeholder="Optional caption" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Photographer</label>
                  <input value={photographer} onChange={e => setPhotographer(e.target.value)} className="input-field" placeholder="Optional" />
                </div>
                <div>
                  <label className="form-label">Date Taken</label>
                  <input type="date" value={dateTaken} onChange={e => setDateTaken(e.target.value)} className="input-field" />
                </div>
              </div>
            </div>

            {isImg && (
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border cursor-pointer hover:bg-muted/50 transition-colors select-none">
                <div className={`relative w-10 h-5 rounded-full transition-colors ${watermark ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${watermark ? 'translate-x-5' : ''}`} />
                  <input type="checkbox" checked={watermark} onChange={e => setWatermark(e.target.checked)} className="sr-only" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold leading-tight">Apply watermark</span>
                  {wmEnabled && <span className="text-[11px] text-muted-foreground">using settings from the Watermark tab</span>}
                </div>
              </label>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
            <button onClick={submit} disabled={!selected || !name.trim()} className="btn-primary flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload
            </button>
          </div>
        </>)}
      </div>
    </div>,
    document.body
  )
}

// ── Fullscreen lightbox viewer with zoom / rotate + metadata ─────────────
function LightboxViewer({ file, onClose }: { file: MediaFile; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)

  const zoomIn = () => setScale(s => Math.min(s + 0.25, 5))
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.25))
  const rotate = () => setRotation(r => r + 90)
  const reset = () => { setScale(1); setRotation(0) }

  const keydown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    window.addEventListener('keydown', keydown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', keydown)
      document.body.style.overflow = ''
    }
  }, [keydown])

  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        if (e.deltaY < 0) zoomIn()
        else zoomOut()
      }
    }
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [])

  const isImg = /^image\//.test(file.mimeType)
  const ext = file.name.split('.').pop()?.toUpperCase()
  const dims = file.width && file.height ? `${file.width} × ${file.height}` : null

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <p className="text-white font-semibold truncate">{file.name}</p>
          {file.locked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors shrink-0" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4" onClick={e => e.stopPropagation()}>
        {isImg ? (
          <img
            src={file.url}
            alt={file.caption || file.name}
            style={{ transform: `scale(${scale}) rotate(${rotation}deg)`, transition: 'transform 0.2s ease' }}
            className="max-w-full max-h-full object-contain rounded-lg"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-white/60">
            <Film className="w-16 h-16" />
            <p className="text-lg font-semibold">{ext} — {formatSize(file.size)}</p>
          </div>
        )}
      </div>

      {/* Bottom controls row */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0 gap-4 flex-wrap" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <button onClick={zoomOut} className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-white/70 text-xs font-mono min-w-[3ch] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="w-px h-4 bg-white/20 mx-1" />
          <button onClick={rotate} className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors" title="Rotate">
            <RotateCw className="w-4 h-4" />
          </button>
          {(scale !== 1 || rotation !== 0) && (
            <button onClick={reset} className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors" title="Reset">
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Metadata chips */}
        <div className="flex items-center gap-3 text-xs text-white/60 flex-wrap">
          {dims && <span className="flex items-center gap-1"><Maximize2 className="w-3 h-3" /> {dims}</span>}
          <span>{formatSize(file.size)}</span>
          {file.photographer && <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> {file.photographer}</span>}
          {file.dateTaken && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(file.dateTaken)}</span>}
          {file.views !== undefined && <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {file.views} views</span>}
          {file.uploaderName && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {file.uploaderName}</span>}
        </div>
      </div>

      {/* Caption + EXIF (if any) */}
      {file.caption && (
        <div className="px-5 pb-3 shrink-0" onClick={e => e.stopPropagation()}>
          <p className="text-white/70 text-sm text-center max-w-2xl mx-auto">{file.caption}</p>
        </div>
      )}
      {file.exif && Object.keys(file.exif).length > 0 && (
        <div className="px-5 pb-4 shrink-0" onClick={e => e.stopPropagation()}>
          <details className="max-w-md mx-auto">
            <summary className="text-white/40 text-xs cursor-pointer hover:text-white/60 transition-colors">EXIF metadata</summary>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-white/50">
              {Object.entries(file.exif).map(([k, v]) => (
                <span key={k} className="truncate"><span className="text-white/30">{k}:</span> {String(v)}</span>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>,
    document.body
  )
}

// ── Watermark settings ────────────────────────────────────────────────────
interface WatermarkConfig {
  enabled: boolean; text: string; font: string; size: number
  weight: string; style: string; color: string; opacity: number; position: string
}
const WM_DEFAULTS: WatermarkConfig = {
  enabled: false, text: '© Kumbi', font: 'Inter, sans-serif',
  size: 24, weight: 'bold', style: 'normal', color: '#ffffff',
  opacity: 0.6, position: 'bottom-right',
}
function WatermarkPanel() {
  const qc = useQueryClient()
  const { data: cfg } = useQuery({
    queryKey: ['site-config'],
    queryFn: () => configApi.get().then(r => r.data),
  })
  const wm: WatermarkConfig = { ...WM_DEFAULTS, ...(cfg?.watermark || {}) }
  const [local, setLocal] = useState<WatermarkConfig | null>(null)
  const current = local ?? wm
  const set = (k: keyof WatermarkConfig) => (v: unknown) => setLocal(prev => ({ ...(prev ?? current), [k]: v }))
  const saveMutation = useMutation({
    mutationFn: () => configApi.update({ ...cfg, watermark: current }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['site-config'] }); setLocal(null) },
  })
  const positions = ['top-left','top-center','top-right','center','bottom-left','bottom-center','bottom-right']
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-base flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> Watermark Preferences</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm font-semibold">Enable</span>
          <input type="checkbox" checked={current.enabled} onChange={e => set('enabled')(e.target.checked)} className="w-4 h-4 accent-primary" />
        </label>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="form-label">Text</label>
          <input value={current.text} onChange={e => set('text')(e.target.value)} className="input-field" placeholder="© Your Name" /></div>
        <div><label className="form-label">Font</label>
          <input value={current.font} onChange={e => set('font')(e.target.value)} className="input-field" placeholder="Inter, sans-serif" /></div>
        <div><label className="form-label">Size (px)</label>
          <input type="number" value={current.size} onChange={e => set('size')(Number(e.target.value))} className="input-field" min={8} max={120} /></div>
        <div><label className="form-label">Weight</label>
          <select value={current.weight} onChange={e => set('weight')(e.target.value)} className="input-field">
            {['normal','bold','600','700','800','900'].map(w => <option key={w} value={w}>{w}</option>)}
          </select></div>
        <div><label className="form-label">Style</label>
          <select value={current.style} onChange={e => set('style')(e.target.value)} className="input-field">
            {['normal','italic','oblique'].map(s => <option key={s} value={s}>{s}</option>)}
          </select></div>
        <div><label className="form-label">Colour</label>
          <div className="flex gap-2">
            <input type="color" value={current.color} onChange={e => set('color')(e.target.value)} className="h-[52px] w-16 rounded-xl border-2 border-border cursor-pointer" />
            <input value={current.color} onChange={e => set('color')(e.target.value)} className="input-field flex-1" />
          </div></div>
        <div><label className="form-label">Opacity ({Math.round(current.opacity * 100)}%)</label>
          <input type="range" min={0.05} max={1} step={0.05} value={current.opacity}
            onChange={e => set('opacity')(Number(e.target.value))} className="w-full accent-primary mt-2" /></div>
        <div><label className="form-label">Position</label>
          <select value={current.position} onChange={e => set('position')(e.target.value)} className="input-field">
            {positions.map(p => <option key={p} value={p}>{p.replace('-', ' ')}</option>)}
          </select></div>
      </div>
      <div className="relative h-24 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-xs">Preview area</span>
        {current.enabled && (
          <span className={`absolute text-sm pointer-events-none select-none
            ${current.position.includes('top') ? 'top-2' : current.position.includes('bottom') ? 'bottom-2' : 'top-1/2 -translate-y-1/2'}
            ${current.position.includes('left') ? 'left-3' : current.position.includes('right') ? 'right-3' : 'left-1/2 -translate-x-1/2'}
          `} style={{
            fontFamily: current.font, fontSize: current.size / 3,
            fontWeight: current.weight, fontStyle: current.style,
            color: current.color, opacity: current.opacity,
          }}>{current.text}</span>
        )}
      </div>
      <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary self-start">
        {saveMutation.isPending ? 'Saving…' : 'Save Watermark Settings'}
      </button>
      {saveMutation.isSuccess && <p className="text-green-600 text-sm font-semibold">✓ Saved.</p>}
    </div>
  )
}

// ── Media card — Netflix-style hover overlay ──────────────────────────────
function MediaCard({ file, onDelete, onEdit, onClick, onToggleGallery }: {
  file: MediaFile; onDelete: () => void; onEdit: () => void; onClick: () => void; onToggleGallery: () => void
}) {
  const Icon = iconFor(file.url)
  const isImg = Icon === Image
  const [imgError, setImgError] = useState(false)

  return (
    <div className="group relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer">
      {/* Image / icon */}
      {isImg && !imgError ? (
        <img
          src={file.thumbnailUrl || file.url}
          alt={file.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      {/* Lock badge (always visible) */}
      {file.locked && (
        <div className="absolute top-1.5 left-1.5 z-10 bg-amber-500/90 text-white p-1 rounded-lg">
          <Lock className="w-3 h-3" />
        </div>
      )}

      {/* Gallery badge */}
      {file.galleryPublished && (
        <div className="absolute top-1.5 right-1.5 z-10 bg-green-500/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
          ★
        </div>
      )}

      {/* Hover overlay — Netflix style */}
      <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
        <p className="text-white text-xs font-bold truncate leading-tight">{file.name}</p>
        {file.caption && <p className="text-white/60 text-[10px] truncate mt-0.5">{file.caption}</p>}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {file.photographer && <span className="text-white/50 text-[9px] flex items-center gap-0.5"><Camera className="w-2.5 h-2.5" /> {file.photographer}</span>}
          {file.dateTaken && <span className="text-white/50 text-[9px]">{formatDate(file.dateTaken)}</span>}
        </div>
        <div className="flex items-center gap-1 mt-2">
          <button onClick={e => { e.stopPropagation(); onClick() }} className="p-1 rounded-md bg-white/20 text-white hover:bg-white/30 transition-colors" title="View">
            <Eye className="w-3 h-3" />
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit() }} className="p-1 rounded-md bg-white/20 text-white hover:bg-white/30 transition-colors" title="Edit metadata">
            <Pencil className="w-3 h-3" />
          </button>
          {!file.locked && (
            <button onClick={e => { e.stopPropagation(); if (confirm('Delete this file?')) onDelete() }} className="p-1 rounded-md bg-red-500/60 text-white hover:bg-red-500/80 transition-colors" title="Delete">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onToggleGallery() }} className={`ml-auto p-1 rounded-md transition-colors ${file.galleryPublished ? 'bg-green-500/60 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`} title={file.galleryPublished ? 'Remove from gallery' : 'Add to gallery'}>
            <span className="text-[10px] font-bold px-0.5">{file.galleryPublished ? '★' : '☆'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit metadata dialog ──────────────────────────────────────────────────
function EditMetadataDialog({ file, onClose, onSave }: { file: MediaFile; onClose: () => void; onSave: (id: string, data: { name: string; caption: string; photographer: string; dateTaken: string }) => void }) {
  const [name, setName] = useState(file.name)
  const [caption, setCaption] = useState(file.caption || '')
  const [photographer, setPhotographer] = useState(file.photographer || '')
  const [dateTaken, setDateTaken] = useState(file.dateTaken || '')

  const submit = () => {
    if (!name.trim()) return
    onSave(file.id, { name: name.trim(), caption, photographer, dateTaken })
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-black text-lg">Edit Metadata</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div>
            <label className="form-label">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="form-label">Caption</label>
            <input value={caption} onChange={e => setCaption(e.target.value)} className="input-field" placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Photographer</label>
              <input value={photographer} onChange={e => setPhotographer(e.target.value)} className="input-field" placeholder="Optional" />
            </div>
            <div>
              <label className="form-label">Date Taken</label>
              <input type="date" value={dateTaken} onChange={e => setDateTaken(e.target.value)} className="input-field" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
          <button onClick={submit} disabled={!name.trim()} className="btn-primary"><Save className="w-4 h-4" /> Save</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Sort / search types ───────────────────────────────────────────────────
type SortField = 'name' | 'createdAt' | 'size' | 'views' | 'dateTaken' | 'photographer'
type SortOrder = 'asc' | 'desc'

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'createdAt', label: 'Upload date' },
  { value: 'size', label: 'Size' },
  { value: 'views', label: 'Views' },
  { value: 'dateTaken', label: 'Date taken' },
  { value: 'photographer', label: 'Photographer' },
]

const ITEMS_PER_PAGE = 50

// ── Main Media component ──────────────────────────────────────────────────
export default function Media() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'library' | 'watermark'>('library')
  const [lightboxFile, setLightboxFile] = useState<MediaFile | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [editFile, setEditFile] = useState<MediaFile | null>(null)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(1)

  const { data: raw = [], isLoading } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaApi.list().then(r => r.data),
  })
  const files: MediaFile[] = raw

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mediaApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  })

  const metadataMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; caption: string; photographer: string; dateTaken: string } }) =>
      mediaApi.updateMetadata(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  })

  // ── Filtered + sorted + paginated ──────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...files]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.caption || '').toLowerCase().includes(q) ||
        (f.photographer || '').toLowerCase().includes(q)
      )
    }
    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break
        case 'size': cmp = a.size - b.size; break
        case 'views': cmp = (a.views || 0) - (b.views || 0); break
        case 'dateTaken': cmp = (a.dateTaken || '').localeCompare(b.dateTaken || ''); break
        case 'photographer': cmp = (a.photographer || '').localeCompare(b.photographer || ''); break
      }
      return sortOrder === 'desc' ? -cmp : cmp
    })
    return result
  }, [files, search, sortField, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  useEffect(() => { setPage(1) }, [search, sortField, sortOrder])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortOrder('asc') }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Lightbox */}
      {lightboxFile && (
        <LightboxViewer file={lightboxFile} onClose={() => setLightboxFile(null)} />
      )}

      {/* Upload dialog */}
      {showUpload && (
        <UploadDialog onClose={() => setShowUpload(false)} />
      )}

      {/* Edit metadata dialog */}
      {editFile && (
        <EditMetadataDialog file={editFile} onClose={() => setEditFile(null)} onSave={(id, data) => metadataMutation.mutate({ id, data })} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black">Media Library</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl overflow-hidden border border-border">
            {(['library','watermark'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-semibold transition-colors capitalize ${tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                {t === 'watermark' ? '⚙ Watermark' : '🖼 Library'}
              </button>
            ))}
          </div>
          {tab === 'library' && (
            <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload
            </button>
          )}
        </div>
      </div>

      {tab === 'watermark' ? <WatermarkPanel /> : (
        <>
          {/* Search + sort bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-9"
                placeholder="Search by name, caption, photographer…"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Sort by</span>
              <select value={sortField} onChange={e => toggleSort(e.target.value as SortField)} className="input-field text-sm py-1.5 pr-8 min-w-[130px]">
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label} {sortField === o.value ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-muted-foreground font-medium">{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {[...Array(24)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
            </div>
          ) : paged.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <p className="text-muted-foreground">{search ? 'No files match your search.' : 'No files uploaded yet.'}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {paged.map((f: MediaFile) => (
                  <MediaCard
                    key={f.id}
                    file={f}
                    onDelete={() => deleteMutation.mutate(f.id)}
                    onEdit={() => setEditFile(f)}
                    onToggleGallery={() => galleryApi.setPublished(f.id, !f.galleryPublished).then(() => qc.invalidateQueries({ queryKey: ['media'] }))}
                    onClick={() => setLightboxFile(f)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
