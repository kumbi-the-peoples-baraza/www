import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

const GITHUB_README_URL =
  "https://raw.githubusercontent.com/kumbi-the-peoples-baraza/Kumbi-Trace-Missing-Data-Analysis/refs/heads/main/README.md";

const CUSTOM_TITLE = "KumbiTrace Missing Person Database";
const CUSTOM_SUBTITLE = "Analysis and Visualization of Missing Person Data";

interface RepoInfo {
  full_name: string;
  name: string;
  description?: string;
}

function firstParagraph(md: string): string {
  const cleaned = md
    .replace(/^#\s+.*$/m, "")
    .replace(/\r\n/g, "\n")
    .trim();
  const paragraphs = cleaned.split(/\n\n+/);
  for (const p of paragraphs) {
    const stripped = p.replace(/[#*_`\[\]]/g, "").trim();
    if (stripped.length > 30) return stripped.slice(0, 300);
  }
  return cleaned.slice(0, 300);
}

export default function GithubReadme() {
  const [markdown, setMarkdown] = useState<string>("");
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const summary = useMemo(() => markdown ? firstParagraph(markdown) : "", [markdown]);

  const getRepoFromUrl = (url: string) => {
    const match = url.match(/githubusercontent\.com\/([^/]+)\/([^/]+)\//);
    return match ? { owner: match[1], repo: match[2] } : null;
  };

  useEffect(() => {
    const repoData = getRepoFromUrl(GITHUB_README_URL);
    if (!repoData) {
      setError("Invalid GitHub URL");
      setLoading(false);
      return;
    }

    const { owner, repo } = repoData;

    Promise.all([
      fetch(GITHUB_README_URL).then((res) => {
        if (!res.ok) throw new Error("Failed to fetch README");
        return res.text();
      }),
      fetch(`https://api.github.com/repos/${owner}/${repo}`).then((res) => {
        if (!res.ok) throw new Error("Failed to fetch repository info");
        return res.json();
      }),
    ])
      .then(([readmeText, repoJson]) => {
        setMarkdown(readmeText);
        setRepoInfo(repoJson);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Fetching README</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !repoInfo) {
    return (
      <div className="max-w-4xl mx-auto p-2">
        <Card className="glass-card">
          <CardContent>
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-6">
          <h2 className="text-2xl font-black tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #0A1A6B 0%, #1A3BB8 60%, #3B6FE0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
            {CUSTOM_TITLE}
          </h2>
          <p className="text-sm font-medium mt-1" style={{ color: 'rgba(26,59,184,0.55)' }}>
            {CUSTOM_SUBTITLE}
          </p>
        </div>

        {summary && (
          <p className="text-sm leading-relaxed mb-5" style={{ color: 'hsl(var(--foreground) / 0.85)' }}>
            {summary}
          </p>
        )}

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: -16, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -12, height: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div className="markdown-content pt-2 border-t" style={{ borderColor: 'rgba(26,59,184,0.08)' }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    code: ({ node, className, children, ...props }) => {
                      const isInline = typeof children === "string" && !children.includes("\n");
                      return isInline ? (
                        <code {...props}>{children}</code>
                      ) : (
                        <code className={className} {...props}>{children}</code>
                      );
                    },
                    a: ({ node, ...props }) => (
                      <a target="_blank" rel="noopener noreferrer" {...props} />
                    ),
                  }}
                >
                  {markdown}
                </ReactMarkdown>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
          style={{
            background: expanded
              ? 'rgba(26,59,184,0.08)'
              : 'linear-gradient(135deg, #1A3BB8 0%, #3B6FE0 100%)',
            color: expanded ? '#1A3BB8' : '#fff',
            boxShadow: expanded ? 'none' : '0 2px 12px rgba(26,59,184,0.25)',
          }}
          onMouseEnter={e => {
            if (!expanded) { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(26,59,184,0.35)' }
          }}
          onMouseLeave={e => {
            if (!expanded) { e.currentTarget.style.filter = ''; e.currentTarget.style.boxShadow = '0 2px 12px rgba(26,59,184,0.25)' }
          }}
        >
          <span>{expanded ? "Collapse" : "View More"}</span>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            style={{ display: 'flex' }}
          >
            <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
          </motion.span>
        </button>
      </CardContent>
    </Card>
  );
}