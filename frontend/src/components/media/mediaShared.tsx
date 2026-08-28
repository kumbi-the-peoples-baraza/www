import { useQuery, useQueryClient } from '@tanstack/react-query'
import { mediaApi, configApi } from '@/api/client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Upload, Trash2, Image as ImageIcon, FileText, Film, Music, ZoomIn,
  RefreshCw, X, Pencil, Lock, Camera, Share2, Star, Info,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { parseImageValue } from '@/lib/utils'
import type { MediaFile } from '@/types'

// ── helpers ────────────────────────────────────────────────────────────────
export function iconFor(url: string) {
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) return ImageIcon
  if (/\.(mp4|webm|mov)$/i.test(url)) return Film
  if (/\.(mp3|wav|ogg)$/i.test(url)) return Music
  return FileText
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function formatDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function normalizeExifDate(s?: string) {
  if (!s) return ''
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s
}

// ── Client-side JPEG EXIF reader ─────────────────────────────────────────
export interface ExifData {
  make?: string; model?: string; dateTimeOriginal?: string
  iso?: number; focalLength?: string; aperture?: string; exposureTime?: string
  software?: string; gpsLat?: number; gpsLng?: number
}

export async function readExif(file: File): Promise<ExifData | null> {
  if (!/^image\/jpe?g$/i.test(file.type)) return null
  const buf = await file.arrayBuffer()
  const dv = new DataView(buf)
  const exif: ExifData = {}
  const getString = (offset: number, length: number) => {
    const bytes = new Uint8Array(buf, offset, length)
    return String.fromCharCode(...bytes).replace(/\0+$/, '') || undefined
  }

  let pos = 2
  while (pos + 8 < buf.byteLength) {
    if (dv.getUint16(pos) !== 0xFFE1) { pos += 2 + dv.getUint16(pos + 2); continue }
    const exifId = getString(pos + 4, 6)
    if (exifId !== 'Exif') break

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

    const gpsIfdOff = tags[0x8825]?.off
    if (gpsIfdOff && gpsIfdOff < 0x10000) {
      const gpsOff = gpsIfdOff + pos + 10
      const gpsEntries = read16(gpsOff)
      let latRef = ''
      let lngRef = ''
      for (let i = 0; i < gpsEntries; i++) {
        const eOff = gpsOff + 2 + i * 12
        const gpsTag = read16(eOff)
        const gpsType = read16(eOff + 2)
        const gpsVal = read32(eOff + 8)
        if (gpsTag === 1 && gpsType === 2) latRef = getString(pos + 10 + gpsVal, 2) || ''
        if (gpsTag === 3 && gpsType === 2) lngRef = getString(pos + 10 + gpsVal, 2) || ''
        if (gpsTag === 2 && gpsType === 5) exif.gpsLat = dv.getUint32(pos + 10 + gpsVal, little) / dv.getUint32(pos + 10 + gpsVal + 4, little)
        if (gpsTag === 4 && gpsType === 5) exif.gpsLng = dv.getUint32(pos + 10 + gpsVal, little) / dv.getUint32(pos + 10 + gpsVal + 4, little)
      }
      if (exif.gpsLat !== undefined && latRef.toUpperCase() === 'S') exif.gpsLat = -exif.gpsLat
      if (exif.gpsLng !== undefined && lngRef.toUpperCase() === 'W') exif.gpsLng = -exif.gpsLng
    }
    break
  }
  return Object.keys(exif).length ? exif : null
}

// ── Client-side watermark application ──────────────────────────────────────
export async function applyWatermark(file: File, wm: {
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
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  const pad = 15
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  const m = ctx.measureText(wm.text)
  const ascent = m.actualBoundingBoxAscent ?? px
  const descent = m.actualBoundingBoxDescent ?? px * 0.25
  const tw = m.width
  const topY = pad + ascent
  const bottomY = canvas.height - pad - descent
  const leftX = pad + tw / 2
  const rightX = canvas.width - pad - tw / 2
  ctx.textAlign = 'center'
  const positions: Record<string, [number, number]> = {
    'top-left': [leftX, topY],
    'top-center': [cx, topY],
    'top-right': [rightX, topY],
    'center': [cx, cy],
    'bottom-left': [leftX, bottomY],
    'bottom-right': [rightX, bottomY],
  }
  const [x, y] = positions[wm.position] || positions['bottom-right']
  ctx.fillText(wm.text, x, y)

  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), file.type))
  URL.revokeObjectURL(img.src)
  return new File([blob], file.name, { type: file.type })
}

export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-right break-all">{value}</span>
    </div>
  )
}

// ── Watermark config ───────────────────────────────────────────────────────
export interface WatermarkConfig {
  enabled: boolean; text: string; font: string; size: number
  weight: string; style: string; color: string; opacity: number; position: string
}
export const WM_DEFAULTS: WatermarkConfig = {
  enabled: false, text: '© Kumbi', font: 'Inter, sans-serif',
  size: 24, weight: 'bold', style: 'normal', color: '#ffffff',
  opacity: 0.6, position: 'bottom-right',
}

// ── Done / preview after single upload ────────────────────────────────────
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
  }, [result.url, isImg])

  const megapixels = dims ? (dims.w * dims.h) / 1_000_000 : null
  const camera = exif ? [exif.make, exif.model].filter(Boolean).join(' ') : null
  const exifDate = exif?.dateTimeOriginal
  const hasExif = !!exif && Object.keys(exif).length > 0

  return (
    <div className="p-5 flex flex-col gap-4">
      {hasExif && (
        <div className="flex items-center gap-2 rounded-xl bg-green-500/10 text-green-700 dark:text-green-400 px-4 py-2.5 text-sm font-semibold">
          <Camera className="w-4 h-4" /> Image Metadata Extracted
        </div>
      )}

      {isImg ? (
        <img src={result.url} alt={result.name} className="w-full max-h-[360px] object-contain bg-muted rounded-xl" />
      ) : (
        <div className="w-full h-32 flex items-center justify-center rounded-xl bg-muted">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      {/* Primary metadata — always visible at top */}
      <div className="rounded-xl border border-border divide-y divide-border text-sm">
        <MetaRow label="Image Name" value={result.name} />
        {caption && <MetaRow label="Caption" value={caption} />}
        {photographer && <MetaRow label="Photographer" value={photographer} />}
        {(exifDate || dateTaken) && (
          <MetaRow label="Date Captured" value={formatDate(normalizeExifDate(exifDate) || dateTaken)} />
        )}
        <MetaRow label="Size" value={formatSize(fileSize)} />
      </div>

      {/* Folded metadata card */}
      <details className="rounded-xl border border-border text-sm" open={moreOpen} onToggle={e => setMoreOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="px-4 py-2.5 font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
          Image Metadata
        </summary>
        <div className="border-t border-border divide-y divide-border">
          <MetaRow label="Size" value={formatSize(fileSize)} />
          {dims && (
            <>
              <MetaRow label="Dimensions" value={`${dims.w} × ${dims.h} px`} />
              {megapixels !== null && <MetaRow label="Megapixels" value={`${megapixels.toFixed(1)} MP`} />}
            </>
          )}
          {(exifDate || dateTaken) && (
            <MetaRow label="Date Captured" value={formatDate(normalizeExifDate(exifDate) || dateTaken)} />
          )}
          {camera && <MetaRow label="Camera" value={camera} />}
          {exif?.iso && <MetaRow label="ISO" value={String(exif.iso)} />}
          {exif?.focalLength && <MetaRow label="Focal length" value={exif.focalLength} />}
          {exif?.aperture && <MetaRow label="Aperture" value={`f/${exif.aperture}`} />}
          {exif?.exposureTime && <MetaRow label="Exposure" value={`1/${Math.round(1 / Number(exif.exposureTime))}s`} />}
          {exif?.software && <MetaRow label="Software" value={exif.software} />}
          {exif?.gpsLat !== undefined && exif?.gpsLng !== undefined && (
            <MetaRow label="GeoLocation" value={`${exif.gpsLat.toFixed(4)}, ${exif.gpsLng.toFixed(4)}`} />
          )}
        </div>
      </details>

      <div className="flex gap-3 justify-center">
        <button onClick={onClose} className="btn-primary">Done</button>
        <button onClick={onReset} className="btn-ghost">Upload another</button>
      </div>
    </div>
  )
}

// ── Upload dialog (single upload flow) ────────────────────────────────────
export function MediaUploadDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: cfg } = useQuery({
    queryKey: ['site-config'],
    queryFn: () => configApi.get().then(r => r.data),
  })
  const wm: WatermarkConfig = { ...WM_DEFAULTS, ...((cfg as { watermark?: Partial<WatermarkConfig> } | undefined)?.watermark || {}) }
  const wmEnabled = wm.enabled

  const [selected, setSelected] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [caption, setCaption] = useState('')
  const [photographer, setPhotographer] = useState('')
  const [preview, setPreview] = useState('')
  const [watermark, setWatermark] = useState(false)
  const watermarkTouched = useRef(false)
  const [status, setStatus] = useState<'form' | 'uploading' | 'done'>('form')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ id: string; url: string; name: string } | null>(null)
  const [exif, setExif] = useState<ExifData | null>(null)

  useEffect(() => {
    if (wmEnabled && !watermarkTouched.current) setWatermark(true)
  }, [wmEnabled])

  useEffect(() => {
    if (!selected) { setPreview(''); setExif(null); return }
    const url = URL.createObjectURL(selected)
    setPreview(url)
    if (!name) setName(selected.name.replace(/\.[^.]+$/, ''))
    readExif(selected).then(data => setExif(data))
    return () => URL.revokeObjectURL(url)
  }, [selected])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setSelected(f)
  }

  const dateTaken = normalizeExifDate(exif?.dateTimeOriginal || '')

  const submit = async () => {
    if (!selected || !name.trim()) return
    let file = selected
    if (watermark && /^image\//.test(file.type)) {
      setStatus('uploading')
      setProgress(0)
      file = await applyWatermark(file, wm)
    }
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
          <ImageDonePreview result={result} caption={caption} photographer={photographer} dateTaken={dateTaken} exif={exif} fileSize={selected?.size || 0} onClose={onClose} onReset={() => { setStatus('form'); setSelected(null); setName(''); setCaption(''); setPhotographer(''); setPreview(''); setResult(null); setExif(null); setProgress(0); watermarkTouched.current = false }} />
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
                  <img src={preview} alt="Preview" className="w-full max-h-[300px] object-contain bg-muted rounded-xl" />
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
              <div>
                <label className="form-label">Photographer</label>
                <input value={photographer} onChange={e => setPhotographer(e.target.value)} className="input-field" placeholder="Optional" />
              </div>
              {isImg && (
                <div className="rounded-xl border border-border divide-y divide-border text-sm">
                  <MetaRow label="Date Captured" value={dateTaken ? formatDate(dateTaken) : 'Not detected from file'} />
                  {exif?.gpsLat !== undefined && exif?.gpsLng !== undefined && (
                    <MetaRow label="GPS Coordinates" value={`${exif.gpsLat.toFixed(4)}, ${exif.gpsLng.toFixed(4)}`} />
                  )}
                </div>
              )}
            </div>

            {isImg && (
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border cursor-pointer hover:bg-muted/50 transition-colors select-none">
                <div className={`relative w-10 h-5 rounded-full transition-colors ${watermark ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${watermark ? 'translate-x-5' : ''}`} />
                  <input type="checkbox" checked={watermark} onChange={e => { watermarkTouched.current = true; setWatermark(e.target.checked) }} className="sr-only" />
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

// ── Picker dialog (library + upload) — used by Blog gallery editor ────────
export function MediaPickerDialog({ onClose, onSelect }: { onClose: () => void; onSelect: (file: MediaFile) => void }) {
  const [showUpload, setShowUpload] = useState(false)
  const { data: raw = [], isLoading } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaApi.list().then(r => r.data as MediaFile[]),
  })
  const files: MediaFile[] = raw

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-black text-lg">Select Image</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {showUpload ? (
          <MediaUploadDialogInline
            onClose={() => setShowUpload(false)}
            onUploaded={(file) => { onSelect(file); setShowUpload(false) }}
          />
        ) : (
          <>
            <div className="p-5 overflow-y-auto">
              {isLoading ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {[...Array(18)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
                </div>
              ) : files.filter(f => f.mimeType.startsWith('image/')).length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-10">No images yet. Upload one below.</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {files.filter(f => f.mimeType.startsWith('image/')).map((f: MediaFile) => (
                    <button key={f.id} type="button" onClick={() => onSelect(f)}
                      className="aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-primary transition-all group">
                      <img src={parseImageValue(f.url)} alt={f.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload Image
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// Inline upload variant that reports the resulting URL (used inside the picker).
function MediaUploadDialogInline({ onClose, onUploaded }: { onClose: () => void; onUploaded: (file: MediaFile) => void }) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [caption, setCaption] = useState('')
  const [photographer, setPhotographer] = useState('')
  const [preview, setPreview] = useState('')
  const [status, setStatus] = useState<'form' | 'uploading' | 'done'>('form')
  const [result, setResult] = useState<{ id: string; url: string; name: string } | null>(null)

  useEffect(() => {
    if (!selected) { setPreview(''); return }
    const url = URL.createObjectURL(selected)
    setPreview(url)
    if (!name) setName(selected.name.replace(/\.[^.]+$/, ''))
    return () => URL.revokeObjectURL(url)
  }, [selected])

  const submit = async () => {
    if (!selected || !name.trim()) return
    setStatus('uploading')
    try {
      const res = await mediaApi.upload(selected, { name: name.trim(), caption, photographer }, () => {})
      const data = res.data as MediaFile
      setResult({ id: data.id, url: data.url, name: data.name })
      setStatus('done')
      qc.invalidateQueries({ queryKey: ['media'] })
      onUploaded(data)
    } catch {
      setStatus('form')
    }
  }

  const isImg = selected && /^image\//.test(selected.type)

  return (
    <div className="flex flex-col">
      <div className="p-5 flex flex-col gap-4">
        {status === 'done' && result ? (
          <div className="flex flex-col items-center gap-3">
            <img src={result.url} alt={result.name} className="w-full max-h-[200px] object-contain bg-muted rounded-xl" />
            <p className="text-sm font-semibold text-green-600">Uploaded. Adding to selection…</p>
          </div>
        ) : status === 'uploading' ? (
          <div className="p-6 flex flex-col items-center gap-4">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading…</p>
          </div>
        ) : !selected ? (
          <label className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">Click to select a file</p>
            <input type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) setSelected(f) }} />
          </label>
        ) : (
          <div className="flex flex-col gap-4">
            {isImg && preview && <img src={preview} alt="Preview" className="w-full max-h-[240px] object-contain bg-muted rounded-xl" />}
            <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Image name *" />
            <input value={caption} onChange={e => setCaption(e.target.value)} className="input-field" placeholder="Caption" />
            <input value={photographer} onChange={e => setPhotographer(e.target.value)} className="input-field" placeholder="Photographer" />
            <button onClick={submit} disabled={!name.trim()} className="btn-primary">Upload</button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">Back to library</button>
      </div>
    </div>
  )
}

// ── Google Photos-style lightbox with info panel + actions ────────────────
export function LightboxViewer({ file, onClose, onDelete, onEdit, onToggleGallery }: {
  file: MediaFile; onClose: () => void; onDelete?: () => void; onEdit?: () => void; onToggleGallery?: () => void
}) {
  const [scale, setScale] = useState(1)
  const [showInfo, setShowInfo] = useState(true)

  const zoomIn = () => setScale(s => Math.min(s + 0.25, 5))
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.25))

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
  const megapixels = (file.width && file.height) ? ((file.width * file.height) / 1_000_000).toFixed(1) : null
  const exif = file.exif as Record<string, string | number | undefined> | undefined
  const camera = exif ? [exif.make, exif.model].filter(Boolean).join(' ') : null
  const exifEntries = exif ? Object.entries(exif).map(([k, v]) => [k, String(v)]) : []

  const copyUrl = () => {
    const raw = parseImageValue(file.url)
    if (navigator.clipboard) navigator.clipboard.writeText(location.origin + raw).catch(() => {})
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/95 flex" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {/* Image area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4 relative" onClick={e => e.stopPropagation()}>
        {isImg ? (
          <img
            src={parseImageValue(file.url)}
            alt={file.caption || file.name}
            className="max-w-full max-h-full object-contain rounded-lg"
            style={{ transform: `scale(${scale})`, transition: 'transform 0.2s ease' }}
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-white/60">
            <Film className="w-16 h-16" />
            <p className="text-lg font-semibold">{ext} — {formatSize(file.size)}</p>
          </div>
        )}

        {showInfo && (
          <button onClick={() => setShowInfo(false)} className="absolute top-4 left-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10" title="Hide info">
            <X className="w-5 h-5" />
          </button>
        )}
        {!showInfo && (
          <button onClick={() => setShowInfo(true)} className="absolute top-4 left-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10" title="Show info">
            <Info className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Info panel (Google Photos style) */}
      {showInfo && (
        <div className="w-full max-w-sm bg-zinc-900 text-white overflow-y-auto p-5 flex flex-col gap-5 shrink-0 border-l border-white/10" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold truncate">{file.name}</p>
            {file.locked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          </div>

          {/* Actions menu */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={copyUrl} className="flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-white/10 transition-colors text-xs">
              <Share2 className="w-5 h-5" /> Share
            </button>
            {onEdit && (
              <button onClick={onEdit} className="flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-white/10 transition-colors text-xs">
                <Pencil className="w-5 h-5" /> Edit
              </button>
            )}
            <button onClick={zoomIn} className="flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-white/10 transition-colors text-xs">
              <ZoomIn className="w-5 h-5" /> Zoom
            </button>
            <button onClick={() => setShowInfo(s => !s)} className="flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-white/10 transition-colors text-xs">
              <Info className="w-5 h-5" /> Info
            </button>
            {onToggleGallery && (
              <button onClick={onToggleGallery} className="flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-white/10 transition-colors text-xs">
                <Star className={`w-5 h-5 ${file.galleryPublished ? 'text-amber-400 fill-amber-400' : ''}`} />
                {file.galleryPublished ? 'In Gallery' : 'Add Gallery'}
              </button>
            )}
            {onDelete && !file.locked && (
              <button onClick={onDelete} className="flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-red-500/20 text-red-400 transition-colors text-xs">
                <Trash2 className="w-5 h-5" /> Delete
              </button>
            )}
          </div>

          {/* System info */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2">Image Info</h3>
            <div className="rounded-xl bg-white/5 divide-y divide-white/10 text-sm">
              <MetaRow label="Name" value={file.name} />
              <MetaRow label="Type" value={file.mimeType} />
              <MetaRow label="Size" value={formatSize(file.size)} />
              {dims && <MetaRow label="Dimensions" value={dims} />}
              {megapixels && <MetaRow label="Megapixels" value={`${megapixels} MP`} />}
              {file.createdAt && <MetaRow label="Uploaded" value={formatDate(file.createdAt)} />}
              {file.views !== undefined && <MetaRow label="Views" value={String(file.views)} />}
              {file.photographer && <MetaRow label="Photographer" value={file.photographer} />}
              {file.uploaderName && <MetaRow label="Uploader" value={file.uploaderName} />}
            </div>
          </div>

          {/* EXIF info */}
          {exifEntries.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2">Camera / EXIF</h3>
              <div className="rounded-xl bg-white/5 divide-y divide-white/10 text-sm">
                {camera && <MetaRow label="Camera" value={camera} />}
                 {exif?.dateTimeOriginal && <MetaRow label="Date Taken" value={formatDate(normalizeExifDate(String(exif.dateTimeOriginal)))} />}
                {exif?.iso && <MetaRow label="ISO" value={String(exif.iso)} />}
                {exif?.focalLength && <MetaRow label="Focal length" value={String(exif.focalLength)} />}
                {exif?.aperture && <MetaRow label="Aperture" value={`f/${exif.aperture}`} />}
                {exif?.exposureTime && <MetaRow label="Exposure" value={`1/${Math.round(1 / Number(exif.exposureTime))}s`} />}
                {exif?.software && <MetaRow label="Software" value={String(exif.software)} />}
                {exif?.gpsLat !== undefined && exif?.gpsLng !== undefined && (
                  <MetaRow label="GeoLocation" value={`${Number(exif.gpsLat).toFixed(4)}, ${Number(exif.gpsLng).toFixed(4)}`} />
                )}
              </div>
            </div>
          )}

          {file.caption && (
            <p className="text-white/70 text-sm leading-relaxed">{file.caption}</p>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}
