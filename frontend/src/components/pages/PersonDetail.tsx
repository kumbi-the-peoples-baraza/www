import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { peopleApi } from '@/api/client'
import { parseImageValue } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import type { Person } from '@/types'

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: person, isLoading, isError } = useQuery({
    queryKey: ['person', id],
    queryFn: () => peopleApi.get(id!).then(r => r.data as Person),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="pt-24 pb-20 px-[2%] sm:px-[4%] lg:px-[6%] max-w-4xl mx-auto">
        <div className="h-8 w-32 bg-muted animate-pulse rounded mb-6" />
        <div className="h-64 bg-muted animate-pulse rounded-2xl" />
      </div>
    )
  }

  if (isError || !person) {
    return (
      <div className="pt-24 pb-20 px-[2%] sm:px-[4%] lg:px-[6%] max-w-4xl mx-auto text-center">
        <h1 className="text-2xl font-black mb-4">Person not found</h1>
        <Link to="/about" className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to About
        </Link>
      </div>
    )
  }

  const src = parseImageValue(person.portrait)
  const focal = (person.portrait || '').split('|')[1] || '50% 50%'

  return (
    <div className="pt-16">
      {/* Header spacer is handled by PageHero pt-16 elsewhere; for detail use simple bar */}
      <div className="max-w-4xl mx-auto px-[2%] sm:px-[4%] lg:px-[6%] py-8">
        <Link to="/about" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Our People
        </Link>

        <div className="glass-card overflow-hidden">
          <div className="aspect-[4/3] sm:aspect-[3/2] bg-black overflow-hidden flex items-center justify-center">
            {src ? (
              <img src={src} alt={person.name} className="w-full h-full object-cover" style={{ objectPosition: focal }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl font-black text-white/30">{person.name[0]}</div>
            )}
          </div>
          <div className="p-6 sm:p-8 flex flex-col gap-3">
            <h1 className="text-3xl font-black tracking-tight">{person.name}</h1>
            <p className="text-primary font-semibold">{person.position}</p>
            {person.bio && <p className="text-muted-foreground leading-relaxed whitespace-pre-line mt-2">{person.bio}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
