import { motion } from "framer-motion";
import { SafeHtml } from "@/components/ui/SafeHtml";

interface Props {
  title: string;
  subtitle?: string;
  tag?: string;
  img: string;
}

export default function PageHero({ title, subtitle, tag, img }: Props) {
  return (
    // pt-16 clears the fixed navbar; mb-6 (≈24px, -16px from mb-10) separates hero from page content
    <section className="relative pt-16 overflow-hidden mb-6">
      <div className="relative h-64 sm:h-80 lg:h-96 flex items-end">
        <div className="absolute inset-0">
          <img
            src={img}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(8,16,77,0.35) 0%, rgba(8,16,77,0.82) 100%)",
            }}
          />
        </div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {tag && (
              <span className="inline-block px-4 py-1.5 rounded-full glass text-xs font-bold uppercase tracking-widest text-white/85 mb-4">
                {tag}
              </span>
            )}
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              {title}
            </h1>
            {subtitle && (
              <SafeHtml html={subtitle} className="text-white/70 mt-3 text-base max-w-2xl leading-relaxed rich-content" as="p" />
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
