import { motion } from "framer-motion";
import { Search, BarChart3, Users, AlertTriangle, Star } from "lucide-react";
import PageHero from "@/components/ui/PageHero";
import { useConfig } from "@/hooks/useConfig";
import GithubReadme from "./MarkDownLoader";

const FEATURE_ICONS: Record<string, React.ElementType> = {
  'crowd-reports': Search,
  'data-analysis': BarChart3,
  'community-verification': Users,
  'real-time-alerts': AlertTriangle,
};

export default function TraceData() {
  const cfg = useConfig();

  return (
    <>
      <PageHero
        title={cfg.pages.trace.heading}
        subtitle={cfg.pages.trace.subheading}
        tag={cfg.pages.trace.heroTag}
        img={cfg.pages.trace.heroImage}
      />
      <div className="section">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {cfg.pages.trace.features.map((f, i) => {
            const Icon = FEATURE_ICONS[f.id] || Star;
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-7 flex gap-5"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-lg mb-1">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>

        <div className="section glass-card">
          <GithubReadme></GithubReadme>
        </div>
      </div>
    </>
  );
}
