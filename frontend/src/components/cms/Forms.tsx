import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formsApi } from '@/api/client'
import { Download, FileText } from 'lucide-react'
import { downloadBlob } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { useState } from 'react'

const FORM_TYPES = ['contact', 'volunteer'] as const

export default function Forms() {
  const [activeForm, setActiveForm] = useState<typeof FORM_TYPES[number]>('contact')

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['form-submissions', activeForm],
    queryFn: () => formsApi.listSubmissions(activeForm).then((r) => r.data),
  })

  const exportCsv = async () => {
    const res = await formsApi.exportCsv(activeForm)
    downloadBlob(res.data, `${activeForm}-submissions.csv`)
  }

  const exportPdf = async () => {
    const res = await formsApi.exportPdf(activeForm)
    downloadBlob(res.data, `${activeForm}-submissions.pdf`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Form Submissions</h1>
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
            {t}
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
                  {Object.keys(submissions[0]?.data || {}).concat(['Date']).map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium capitalize">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map((s: { id: string; data: Record<string, unknown>; createdAt: string }) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-muted/30">
                    {Object.values(s.data).map((v, i) => (
                      <td key={i} className="px-4 py-3 text-muted-foreground">{String(v)}</td>
                    ))}
                    <td className="px-4 py-3 text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
