import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mediaApi } from '@/api/client'
import { useRef } from 'react'
import { Upload, Trash2, Image, FileText, Film, Music } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

const iconFor = (url: string) => {
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) return Image
  if (/\.(mp4|webm|mov)$/i.test(url)) return Film
  if (/\.(mp3|wav|ogg)$/i.test(url)) return Music
  return FileText
}

export default function Media() {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaApi.list().then((r) => r.data),
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Media Library</h1>
        <button onClick={() => inputRef.current?.click()} className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" /> Upload
        </button>
        <input ref={inputRef} type="file" className="hidden" multiple onChange={(e) => {
          Array.from(e.target.files || []).forEach((f) => uploadMutation.mutate(f))
        }} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {files.map((f: { id: string; url: string; name: string }) => {
            const Icon = iconFor(f.url)
            const isImage = Icon === Image
            return (
              <div key={f.id} className="glass-card p-2 group relative aspect-square flex flex-col items-center justify-center gap-2 overflow-hidden">
                {isImage ? (
                  <img src={f.url} alt={f.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <Icon className="w-8 h-8 text-muted-foreground" />
                )}
                <p className="text-xs text-muted-foreground truncate w-full text-center">{f.name}</p>
                <button
                  onClick={() => deleteMutation.mutate(f.id)}
                  className="absolute top-2 right-2 p-1 rounded-lg bg-destructive/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
