import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { blogApi, galleryApi } from '@/api/client'
import PageHero from '@/components/ui/PageHero'
import ImageGallery from '@/components/ui/ImageGallery'
import { useConfig } from '@/hooks/useConfig'
import type { BlogPost } from '@/types'
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react'

type Tab = 'recent' | 'popular' | 'all' | 'gallery'
const PAGE_SIZE = 30

function PostCard({ post, index }: { post: BlogPost; index: number }) {
  const navigate = useNavigate()
  return (
    <motion.article
      initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ delay: index * 0.07 }}
      className="glass-card overflow-hidden group hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer"
      onClick={() => navigate(`/blog/${post.slug}`)}
    >
      <div className="aspect-square overflow-hidden shrink-0 bg-muted">
        {post.coverImage
          ? <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-4xl font-black">{post.title[0]}</div>
        }
      </div>
      <div className="p-6 flex flex-col flex-1 gap-2">
        <span className="text-xs font-bold text-primary/70 uppercase tracking-widest">
          {new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
        <h3 className="font-black text-lg leading-snug tracking-tight">{post.title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed flex-1">{post.excerpt}</p>
        <span className="mt-2 text-sm font-bold text-primary group-hover:underline self-start">Read more →</span>
      </div>
    </motion.article>
  )
}

export default function Blog() {
  const cfg = useConfig()
  const [tab, setTab] = useState<Tab>('recent')
  const [page, setPage] = useState(0)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)

  const { data: recent = [] } = useQuery({ queryKey: ['blog'], queryFn: () => blogApi.list().then(r => r.data) })
  const { data: popular = [] } = useQuery({ queryKey: ['blog-popular'], queryFn: () => blogApi.popular().then(r => r.data), enabled: tab === 'popular' })
  const { data: gallery = [] } = useQuery({ queryKey: ['gallery'], queryFn: () => galleryApi.list().then(r => r.data), enabled: tab === 'gallery' })

  const allPosts = recent as BlogPost[]
  const paginated = allPosts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(allPosts.length / PAGE_SIZE)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'recent', label: 'Most Recent' },
    { key: 'popular', label: 'Most Popular' },
    { key: 'all', label: 'All Posts' },
    { key: 'gallery', label: 'Gallery' },
  ]

  return (
    <>
      <PageHero title={cfg.pages.blog.heading} subtitle={cfg.pages.blog.subheading}
        tag={cfg.pages.blog.heroTag} img={cfg.pages.blog.heroImage} />

      <div className="px-[2%] sm:px-[4%] lg:px-[6%] max-w-7xl mx-auto py-12">
        {/* Tab bar */}
        <div className="flex gap-1 mb-10 border-b border-border overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(0) }}
              className={`px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'recent' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {(recent as BlogPost[]).slice(0, 9).map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
            {(recent as BlogPost[]).length === 0 && <p className="col-span-3 text-center text-muted-foreground py-20">No posts yet.</p>}
          </div>
        )}

        {tab === 'popular' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {(popular as BlogPost[]).map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
            {(popular as BlogPost[]).length === 0 && <p className="col-span-3 text-center text-muted-foreground py-20">No data yet.</p>}
          </div>
        )}

        {tab === 'all' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              {paginated.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
              {paginated.length === 0 && <p className="col-span-3 text-center text-muted-foreground py-20">No posts yet.</p>}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-ghost !py-2 !px-3"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-semibold">Page {page + 1} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-ghost !py-2 !px-3"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </>
        )}

        {tab === 'gallery' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {(gallery as { id: string; url: string; name: string; caption?: string }[]).map((f, i) => (
                <motion.button key={f.id} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                  className="aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer group relative"
                  onClick={() => { setGalleryIndex(i); setGalleryOpen(true) }}
                >
                  <img src={f.url} alt={f.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Expand className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.button>
              ))}
              {(gallery as unknown[]).length === 0 && <p className="col-span-full text-center text-muted-foreground py-20">No gallery images published yet.</p>}
            </div>
            {galleryOpen && (
              <ImageGallery
                images={(gallery as { id: string; url: string; name: string; caption?: string }[]).map(f => ({ url: f.url, caption: f.caption }))}
                initialIndex={galleryIndex}
                onClose={() => setGalleryOpen(false)}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
