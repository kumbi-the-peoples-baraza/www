import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notebooksApi } from '@/api/client'
import { useRef } from 'react'
import { Upload, BookOpen } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Notebooks() {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: notebooks = [], isLoading } = useQuery({
    queryKey: ['notebooks'],
    queryFn: () => notebooksApi.list().then((r) => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => notebooksApi.upload(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notebooks'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Jupyter Notebooks</h1>
        <button onClick={() => inputRef.current?.click()} className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" /> Upload Notebook
        </button>
        <input ref={inputRef} type="file" accept=".ipynb" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadMutation.mutate(file)
        }} />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notebooks.map((nb: { id: string; name: string; uploadedAt: string }) => (
            <div key={nb.id} className="glass-card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{nb.name}</p>
                <p className="text-xs text-muted-foreground">{new Date(nb.uploadedAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
