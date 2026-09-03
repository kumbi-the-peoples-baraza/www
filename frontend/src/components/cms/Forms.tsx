import { useQuery } from '@tanstack/react-query'
import { formsApi } from '@/api/client'
import { Download, FileText, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { downloadBlob } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useEffect } from 'react'

const FORM_TYPES = ['contact', 'volunteer'] as const

const FORM_LABELS: Record<string, string> = {
  contact: 'Contact Us',
  volunteer: 'Volunteer',
}

const HIDDEN_KEYS = new Set(['_hp', '_captcha_token', '_captcha_answer', 'cf_turnstile_response', '_cf_turnstile_response'])
const ITEMS_PER_PAGE = 20

function SubmissionView({ submission, onClose }: { submission: { id: string; data: Record<string, unknown>; createdAt: string; formType: string } | null; onClose: () => void }) {
  useEffect(() => {
    if (submission) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [submission])

  if (!submission) return null

  const entries = Object.entries(submission.data).filter(([k]) => !HIDDEN_KEYS.has(k))

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px) saturate(1.3)' }}>
      <div onClick={e => e.stopPropagation()}
        className="glass-card"
        style={{
          width: 'min(90%, 900px)',
          display: 'flex', flexDirection: 'column', maxHeight: '90vh',
          borderRadius: 20,
          padding: 0,
        }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '1.75rem 2rem 1.25rem',
          borderBottom: '1px solid hsl(var(--border))',
        }}>
          <div>
            <h2 className="text-xl font-bold" style={{ margin: 0, color: 'hsl(var(--primary))' }}>
              {(FORM_LABELS[submission.formType] || submission.formType)} Submission
            </h2>
            <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem', fontWeight: 500 }}>
              {new Date(submission.createdAt).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose}
            className="flex items-center justify-center rounded-lg transition-all duration-150 shrink-0 hover:bg-destructive/10 hover:text-destructive"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', color: 'hsl(var(--muted-foreground))' }}>
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: '1.25rem 2rem 1.5rem' }}>
          <div className="flex flex-col gap-3">
            {entries.map(([key, value]) => (
              <div key={key}>
                <label className="form-label capitalize" style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed input-field" style={{ fontWeight: 500 }}>
                  {String(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{
          padding: '1rem 2rem 1.5rem',
          borderTop: '1px solid hsl(var(--border))',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} className="btn-primary" style={{ minHeight: 44, padding: '0.65rem 1.75rem', fontSize: '0.95rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Forms() {
  const [activeForm, setActiveForm] = useState<typeof FORM_TYPES[number]>('contact')
  const [viewing, setViewing] = useState<{ id: string; data: Record<string, unknown>; createdAt: string; formType: string } | null>(null)
  const [page, setPage] = useState(1)

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['form-submissions', activeForm],
    queryFn: () => formsApi.listSubmissions(activeForm).then((r) => r.data),
  })

  useEffect(() => { setPage(1) }, [activeForm])

  const totalPages = Math.max(1, Math.ceil(submissions.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paged = submissions.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  const exportCsv = async () => {
    const res = await formsApi.exportCsv(activeForm)
    downloadBlob(res.data, `${activeForm}-submissions.csv`)
  }

  const exportPdf = async () => {
    const res = await formsApi.exportPdf(activeForm)
    downloadBlob(res.data, `${activeForm}-submissions.pdf`)
  }

  const visibleColumns = submissions.length > 0
    ? Object.keys(submissions[0].data).filter(k => !HIDDEN_KEYS.has(k)).concat(['Date'])
    : ['Date']

  return (
    <div>
      <SubmissionView submission={viewing} onClose={() => setViewing(null)} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Feedback</h1>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn-ghost flex items-center gap-2 glass">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={exportPdf} className="btn-ghost flex items-center gap-2 glass">
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {FORM_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setActiveForm(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${activeForm === t ? 'bg-primary/15 text-primary' : 'btn-ghost'}`}
          >
            {FORM_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No submissions yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {visibleColumns.map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium capitalize">{h}</th>
                  ))}
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((s: { id: string; data: Record<string, unknown>; createdAt: string; formType: string }) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-muted/30">
                    {Object.entries(s.data).filter(([key]) => !HIDDEN_KEYS.has(key)).map(([, v], i) => (
                      <td key={i} className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{String(v)}</td>
                    ))}
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setViewing(s)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-white/10">
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
          </div>
        )}
      </div>
    </div>
  )
}
