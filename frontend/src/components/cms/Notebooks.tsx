import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notebooksApi } from '@/api/client'
import { useRef, useState } from 'react'
import { Upload, BookOpen, Github } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Notebooks() {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [githubUrl, setGithubUrl] = useState('')
  const [showGithub, setShowGithub] = useState(false)

  const { data: notebooks = [], isLoading } = useQuery({
    queryKey: ['notebooks'],
    queryFn: () => notebooksApi.list().then(r => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => notebooksApi.upload(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notebooks'] }),
  })

  const githubMutation = useMutation({
    mutationFn: (url: string) => notebooksApi.importFromGitHub(url),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notebooks'] }); setGithubUrl(''); setShowGithub(false) },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Jupyter Notebooks</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowGithub(v => !v)} className="btn-ghost flex items-center gap-2">
            <Github className="w-4 h-4" /> Import from GitHub
          </button>
          <button onClick={() => inputRef.current?.click()} className="btn-primary flex items-center gap-2">
            <Upload className="w-4 h-4" /> Upload .ipynb
          </button>
        </div>
        <input ref={inputRef} type="file" accept=".ipynb" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f) }} />
      </div>

      {showGithub && (
        <div className="glass-card p-5 flex flex-col gap-3">
          <label className="form-label">GitHub Notebook URL</label>
          <p className="text-sm text-muted-foreground -mt-2">
            Paste a GitHub file URL (e.g. <code className="bg-muted px-1 rounded text-xs">https://github.com/user/repo/blob/main/notebook.ipynb</code>) or a raw URL.
          </p>
          <input value={githubUrl} onChange={e => setGithubUrl(e.target.value)}
            className="input-field" placeholder="https://github.com/..." />
          <div className="flex gap-3">
            <button onClick={() => githubMutation.mutate(githubUrl)} disabled={!githubUrl || githubMutation.isPending} className="btn-primary">
              {githubMutation.isPending ? 'Importing…' : 'Import'}
            </button>
            <button onClick={() => setShowGithub(false)} className="btn-ghost">Cancel</button>
          </div>
          {githubMutation.isError && <p className="text-sm text-destructive font-semibold">Import failed. Check the URL and try again.</p>}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {(notebooks as { id: string; name: string; uploadedAt: string }[]).map(nb => (
            <div key={nb.id} className="glass-card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{nb.name}</p>
                <p className="text-xs text-muted-foreground">{new Date(nb.uploadedAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
          {(notebooks as unknown[]).length === 0 && <p className="text-muted-foreground text-sm">No notebooks yet.</p>}
        </div>
      )}
    </div>
  )
}
