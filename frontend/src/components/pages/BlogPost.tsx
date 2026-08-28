import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, Expand } from 'lucide-react'
import { blogApi, analyticsApi } from '@/api/client'
import ImageGallery from '@/components/ui/ImageGallery'
import { SafeHtml } from '@/components/ui/SafeHtml'
import { parseImageValue } from '@/lib/utils'
import type { BlogPost, GalleryImage } from '@/types'

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: () => blogApi.get(slug!).then(r => r.data as BlogPost),
    enabled: !!slug,
  })

  useEffect(() => {
    if (slug) analyticsApi.track(`/blog/${slug}`, document.referrer).catch(() => {})
  }, [slug])

  if (isLoading) return (
    <div className="pt-28 px-[2%] sm:px-[4%] lg:px-[6%] max-w-3xl mx-auto animate-pulse flex flex-col gap-4">
      <div className="h-8 bg-muted rounded w-3/4" />
      <div className="h-64 bg-muted rounded-xl" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-5/6" />
    </div>
  )

  if (isError || !post) return (
    <div className="pt-28 px-[2%] sm:px-[4%] text-center">
      <p className="text-muted-foreground mb-4">Post not found.</p>
      <Link to="/blog" className="text-primary font-semibold">← Back to Blog</Link>
    </div>
  )

  const gallery: GalleryImage[] = [
    ...(parseImageValue(post.coverImage)
      ? [{ url: parseImageValue(post.coverImage)!, caption: post.coverCaption, photographer: 'Kumbi Media Team', dateTaken: post.publishedAt }]
      : []),
    ...(post.galleryImages || []),
  ]

  return (
    <article className="pt-24 pb-20 px-[2%] sm:px-[4%] lg:px-[6%] max-w-4xl mx-auto">
      <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Blog
      </Link>

      {parseImageValue(post.coverImage) && (
        <div className="mb-6">
          <div className="w-full h-72 sm:h-96 rounded-2xl overflow-hidden bg-muted">
            <img src={parseImageValue(post.coverImage)} alt={post.title} className="w-full h-full object-cover" loading="eager" />
          </div>
          {post.coverCaption && (
            <p className="mt-4 mb-4 text-sm text-muted-foreground italic text-center leading-relaxed px-2">
              {post.coverCaption}
            </p>
          )}
        </div>
      )}

      <span className="text-xs font-bold text-primary/70 uppercase tracking-widest">
        {new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
      </span>
      {post.author?.name && (
        <span className="text-xs font-bold text-primary/70 uppercase tracking-widest mt-1 block">
          By {post.author.name}
        </span>
      )}
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2 mb-4 leading-tight">{post.title}</h1>
      {post.excerpt && (
        <p className="text-lg text-muted-foreground leading-relaxed border-l-4 border-primary/30 pl-4 mb-8">{post.excerpt}</p>
      )}

      <SafeHtml html={post.body} className="rich-content text-base leading-relaxed" />

      {/* Gallery */}
      {gallery.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-black mb-4">Gallery</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {gallery.map((img, i) => (
              <button
                key={i}
                onClick={() => { setGalleryIndex(i); setGalleryOpen(true) }}
                className="aspect-square rounded-xl overflow-hidden bg-muted group relative"
              >
                <img src={parseImageValue(img.url)} alt={img.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Expand className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* About Author */}
      {post.author && post.author.name && (
        <div className="mt-14 rounded-2xl border border-border bg-muted/30 p-6">
          <h3 className="text-sm font-bold text-primary/70 uppercase tracking-widest mb-1">About Author</h3>
          <p className="text-lg font-black">{post.author.name}</p>
          {post.author.bio && <p className="text-sm leading-relaxed mt-2">{post.author.bio}</p>}
          {post.author.email && (
            <a href={`mailto:${post.author.email}`} className="text-sm font-semibold text-primary hover:underline mt-2 inline-block">
              {post.author.email}
            </a>
          )}
        </div>
      )}

      {/* Gallery overlay */}
      {galleryOpen && (
        <ImageGallery images={gallery} initialIndex={galleryIndex} onClose={() => setGalleryOpen(false)} />
      )}
    </article>
  )
}
