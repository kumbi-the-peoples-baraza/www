import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { blogApi } from '@/api/client'
import PageHero from '@/components/ui/PageHero'
import { useConfig } from '@/hooks/useConfig'
import type { BlogPost } from '@/types'

export default function Blog() {
  const cfg = useConfig()
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog'],
    queryFn: () => blogApi.list().then(r => r.data),
  })

  return (
    <>
      <PageHero
        title="Social Work Blog"
        subtitle="Stories, insights, and updates from our work across Nairobi and Kenya."
        tag="Community · Impact"
        img={cfg.pages.blog.heroImage}
      />

      <div className="section">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card overflow-hidden animate-pulse">
                <div className="h-52 bg-muted" />
                <div className="p-7 flex flex-col gap-3">
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No posts published yet. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {posts.map((post: BlogPost, i: number) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card overflow-hidden group hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col"
              >
                <div className="h-52 overflow-hidden shrink-0 bg-muted">
                  {post.coverImage && (
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="p-7 flex flex-col flex-1 gap-3">
                  <span className="text-xs font-bold text-primary/70 uppercase tracking-widest">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })
                      : new Date(post.createdAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'long' })}
                  </span>
                  <h3 className="font-black text-lg leading-snug tracking-tight">{post.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed flex-1">{post.excerpt}</p>
                  <button className="mt-2 text-sm font-bold text-primary hover:underline text-left self-start">
                    Read more →
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
