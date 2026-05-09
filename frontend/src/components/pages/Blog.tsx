import { motion } from 'framer-motion'
import PageHero from '@/components/ui/PageHero'

const posts = [
  {
    title: 'Community Outreach in Kibera',
    date: 'April 2026',
    excerpt: 'Our volunteers spent the weekend in Kibera, distributing supplies and connecting families with support services.',
    img: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=800&q=80&auto=format&fit=crop',
  },
  {
    title: 'KumbiTrace: Six Months On',
    date: 'March 2026',
    excerpt: 'A look back at six months of crowd-sourced data gathering and what we have learned about enforced disappearances.',
    img: 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?w=800&q=80&auto=format&fit=crop',
  },
  {
    title: 'Building Trust in Digital Voting',
    date: 'February 2026',
    excerpt: 'How KumbiVote is changing the conversation around electoral integrity in East Africa.',
    img: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=800&q=80&auto=format&fit=crop',
  },
]

export default function Blog() {
  return (
    <>
      <PageHero
        title="Social Work Blog"
        subtitle="Stories, insights, and updates from our work across Nairobi and Kenya."
        tag="Community · Impact"
        img="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1400&q=80&auto=format&fit=crop"
      />

      <div className="section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {posts.map((post, i) => (
            <motion.article
              key={post.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="glass-card overflow-hidden group hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col"
            >
              <div className="h-52 overflow-hidden shrink-0">
                <img
                  src={post.img} alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-7 flex flex-col flex-1 gap-3">
                <span className="text-xs font-bold text-primary/70 uppercase tracking-widest">{post.date}</span>
                <h3 className="font-black text-lg leading-snug tracking-tight">{post.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">{post.excerpt}</p>
                <button className="mt-2 text-sm font-bold text-primary hover:underline text-left self-start">
                  Read more →
                </button>
              </div>
            </motion.article>
          ))}
        </div>

        <p className="text-center text-muted-foreground text-sm mt-14">
          More posts will be loaded from the CMS.
        </p>
      </div>
    </>
  )
}
