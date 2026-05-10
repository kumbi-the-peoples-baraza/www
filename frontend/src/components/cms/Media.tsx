import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mediaApi, galleryApi, configApi } from '@/api/client'
import { useRef, useState } from 'react'
import { Upload, Trash2, Image, FileText, Film, Music, Copy, Check, Settings } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

const iconFor = (url: string) => {
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) return Image
  if (/\.(mp4|webm|mov)$/i.test(url)) return Film
  if (/\.(mp3|wav|ogg)$/i.test(url)) return Music
  return FileText
}

// ── Watermark settings ────────────────────────────────────────────────────────
interface WatermarkConfig {
  enabled: boolean
  text: string
  font: string
  size: number
  weight: string
  style: string
  color: string
  opacity: number
  position: string
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

      {/* Preview */}
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

// ── Media grid ────────────────────────────────────────────────────────────────
function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} title="Copy URL"
      className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : 'Copy URL'}
    </button>
  )
}

export default function Media() {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'library' | 'watermark'>('library')

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaApi.list().then(r => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => mediaApi.upload(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mediaApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
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
            <button onClick={() => inputRef.current?.click()} className="btn-primary flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" className="hidden" multiple accept="image/*,video/*,audio/*,.pdf"
          onChange={e => Array.from(e.target.files || []).forEach(f => uploadMutation.mutate(f))} />
      </div>

      {tab === 'watermark' ? <WatermarkPanel /> : (
        isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
          </div>
        ) : files.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-muted-foreground">No files uploaded yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            {files.map((f: { id: string; url: string; name: string; galleryPublished: boolean }) => {
              const Icon = iconFor(f.url)
              const isImg = Icon === Image
              return (
                <div key={f.id} className="glass-card p-2 group flex flex-col gap-2 overflow-hidden">
                  <div className="relative aspect-square">
                    {isImg
                      ? <img src={f.url} alt={f.name} className="w-full h-full object-cover rounded-lg" />
                      : <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg"><Icon className="w-8 h-8 text-muted-foreground" /></div>
                    }
                    <button
                      onClick={() => { if (confirm('Delete file?')) deleteMutation.mutate(f.id) }}
                      className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-destructive/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground truncate px-1">{f.name}</p>
                  <div className="px-1 pb-1 flex items-center justify-between gap-1">
                    <CopyButton url={f.url} />
                    <button
                      onClick={() => galleryApi.setPublished(f.id, !f.galleryPublished).then(() => qc.invalidateQueries({ queryKey: ['media'] }))}
                      title={f.galleryPublished ? 'Remove from gallery' : 'Add to gallery'}
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded transition-colors ${f.galleryPublished ? 'bg-green-500/15 text-green-600' : 'text-muted-foreground hover:text-primary'}`}
                    >
                      {f.galleryPublished ? '★' : '☆'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
