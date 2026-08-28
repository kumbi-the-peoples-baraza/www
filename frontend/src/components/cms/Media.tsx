import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { mediaApi, galleryApi, configApi } from '@/api/client'
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Upload, Trash2, Settings, Save, X, Pencil, Search, Lock, ChevronLeft, ChevronRight, Camera, ArrowUpDown, Star, Check, Eye } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { MediaFile } from '@/types'
import {
  MediaUploadDialog, LightboxViewer, iconFor, formatDate,
} from '@/components/media/mediaShared'

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
  const wm: WatermarkConfig = { ...WM_DEFAULTS, ...((cfg as { watermark?: Partial<WatermarkConfig> } | undefined)?.watermark || {}) }
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
            ${current.position.includes('top') ? 'top-[15px]' : current.position.includes('bottom') ? 'bottom-[15px]' : 'top-1/2 -translate-y-1/2'}
            ${current.position.includes('left') ? 'left-[15px]' : current.position.includes('right') ? 'right-[15px]' : 'left-1/2 -translate-x-1/2'}
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

// ── Media card — Google Photos style with selection ───────────────────────
function MediaCard({ file, onDelete, onEdit, onOpen, onToggleGallery, selected, selectMode, onToggleSelect }: {
  file: MediaFile; onDelete: () => void; onEdit: () => void; onOpen: () => void; onToggleGallery: () => void
  selected: boolean; selectMode: boolean; onToggleSelect: () => void
}) {
  const Icon = iconFor(file.url)
  const isImg = /^image\//.test(file.mimeType) || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.url)
  const [imgError, setImgError] = useState(false)

  const handleClick = () => {
    if (selectMode) onToggleSelect()
    else onOpen()
  }

  return (
    <div
      onClick={handleClick}
      className={`group relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer transition-all ${selected ? 'ring-4 ring-primary' : ''}`}
    >
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

      {/* Selection checkbox */}
      {selectMode && (
        <div className={`absolute top-2 left-2 z-30 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? 'bg-primary border-primary text-white' : 'bg-black/40 border-white'}`}>
          {selected && <Check className="w-4 h-4" />}
        </div>
      )}

      {file.locked && (
        <div className="absolute top-1.5 left-1.5 z-10 bg-amber-500/90 text-white p-1 rounded-lg">
          <Lock className="w-3 h-3" />
        </div>
      )}

      {file.galleryPublished && !selectMode && (
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
          {!selectMode && (
            <button onClick={e => { e.stopPropagation(); onOpen() }} className="p-1 rounded-md bg-white/20 text-white hover:bg-white/30 transition-colors" title="View">
              <Eye className="w-3 h-3" />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onEdit() }} className="p-1 rounded-md bg-white/20 text-white hover:bg-white/30 transition-colors" title="Edit metadata">
            <Pencil className="w-3 h-3" />
          </button>
          {!file.locked && (
            <button onClick={e => { e.stopPropagation(); if (confirm('Delete this file?')) onDelete() }} className="p-1 rounded-md bg-red-500/60 text-white hover:bg-red-500/80 transition-colors" title="Delete">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onToggleGallery() }} className={`ml-auto p-1 rounded-md transition-colors ${file.galleryPublished ? 'bg-green-500/60 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`} title={file.galleryPublished ? 'Remove from gallery' : 'Add to gallery'}>
            <Star className={`w-3 h-3 ${file.galleryPublished ? 'fill-white' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit metadata dialog ──────────────────────────────────────────────────
function EditMetadataDialog({ file, onClose, onSave }: { file: MediaFile; onClose: () => void; onSave: (id: string, data: { name: string; caption: string; photographer: string }) => void }) {
  const [name, setName] = useState(file.name)
  const [caption, setCaption] = useState(file.caption || '')
  const [photographer, setPhotographer] = useState(file.photographer || '')

  const submit = () => {
    if (!name.trim() || !photographer.trim()) return
    onSave(file.id, { name: name.trim(), caption, photographer })
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
          <div>
            <label className="form-label">Photographer *</label>
            <input
              value={photographer}
              onChange={e => setPhotographer(e.target.value)}
              className="input-field"
              placeholder="Photographer name"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
          <button onClick={submit} disabled={!name.trim() || !photographer.trim()} className="btn-primary"><Save className="w-4 h-4" /> Save</button>
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

function groupByMonthFiles(files: MediaFile[]): { label: string; items: MediaFile[] }[] {
  const groups = new Map<string, MediaFile[]>()
  for (const f of files) {
    const d = new Date(f.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const existing = groups.get(key) || []
    existing.push(f)
    groups.set(key, existing)
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, items]) => ({
      label: new Date(items[0].createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      items,
    }))
}

// ── Main Media component ──────────────────────────────────────────────────
export default function Media() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'library' | 'watermark'>('library')
  const [lightboxFile, setLightboxFile] = useState<MediaFile | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [editFile, setEditFile] = useState<MediaFile | null>(null)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField | ''>('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(1)
  const [groupByMonth, setGroupByMonth] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const selectMode = selected.size > 0

  const { data: raw = [], isLoading } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaApi.list().then(r => r.data),
  })
  const files: MediaFile[] = raw

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mediaApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['media'] }); setSelected(new Set()) },
  })

  const metadataMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; caption: string; photographer: string } }) =>
      mediaApi.updateMetadata(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  })

  const batchGallery = (published: boolean) => {
    Promise.all(Array.from(selected).map(id => galleryApi.setPublished(id, published)))
      .then(() => { qc.invalidateQueries({ queryKey: ['media'] }); setSelected(new Set()) })
  }
  const batchDelete = () => {
    if (!confirm(`Delete ${selected.size} file(s)?`)) return
    Promise.all(Array.from(selected).map(id => mediaApi.delete(id)))
      .then(() => { qc.invalidateQueries({ queryKey: ['media'] }); setSelected(new Set()) })
  }
  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(f => f.id)))
  }

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

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const gridCards = (items: MediaFile[]) => items.map((f: MediaFile) => (
    <MediaCard
      key={f.id}
      file={f}
      selected={selected.has(f.id)}
      selectMode={selectMode}
      onToggleSelect={() => toggleSelect(f.id)}
      onDelete={() => deleteMutation.mutate(f.id)}
      onEdit={() => setEditFile(f)}
      onToggleGallery={() => galleryApi.setPublished(f.id, !f.galleryPublished).then(() => qc.invalidateQueries({ queryKey: ['media'] }))}
      onOpen={() => setLightboxFile(f)}
    />
  ))

  return (
    <div className="flex flex-col gap-6">
      {lightboxFile && (
        <LightboxViewer
          file={lightboxFile}
          onClose={() => setLightboxFile(null)}
          onDelete={() => { if (confirm('Delete this file?')) { deleteMutation.mutate(lightboxFile.id); setLightboxFile(null) } }}
          onEdit={() => { setEditFile(lightboxFile); setLightboxFile(null) }}
          onToggleGallery={() => { galleryApi.setPublished(lightboxFile.id, !lightboxFile.galleryPublished).then(() => { qc.invalidateQueries({ queryKey: ['media'] }); setLightboxFile(null) }) }}
        />
      )}

      {showUpload && <MediaUploadDialog onClose={() => setShowUpload(false)} />}

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
          {/* Selection toolbar */}
          {selectMode && (
            <div className="flex items-center justify-between gap-3 flex-wrap bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm">{selected.size} selected</span>
                <button onClick={toggleSelectAll} className="text-xs font-semibold text-primary hover:underline">
                  {selected.size === filtered.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => batchGallery(true)} className="btn-primary flex items-center gap-1.5 text-xs"><Star className="w-3.5 h-3.5" /> Add to Gallery</button>
                <button onClick={() => batchGallery(false)} className="btn-ghost flex items-center gap-1.5 text-xs">Remove from Gallery</button>
                <button onClick={batchDelete} className="btn-ghost flex items-center gap-1.5 text-xs text-red-600"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              </div>
            </div>
          )}

          {/* Search + sort bar */}
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <div className="relative w-full lg:w-[60%]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field !pl-10"
                placeholder="Search Images"
              />
            </div>
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select value={sortField} onChange={e => toggleSort(e.target.value as SortField)} className="input-field text-sm py-1.5 !pl-9 pr-8 min-w-[160px]">
                <option value="" disabled>Sort By</option>
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label} {sortField === o.value ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setGroupByMonth(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${groupByMonth ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {groupByMonth ? 'Grouped' : 'By Month'}
            </button>
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
          ) : groupByMonth ? (
            (() => {
              const groups = groupByMonthFiles(filtered)
              return groups.map(group => (
                <div key={group.label} className="mb-6">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">{group.label} ({group.items.length})</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                    {gridCards(group.items)}
                  </div>
                </div>
              ))
            })()
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {gridCards(paged)}
              </div>

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
