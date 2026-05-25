import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const GITHUB_README_URL =
  "https://raw.githubusercontent.com/kumbi-the-peoples-baraza/Kumbi-Trace-Missing-Data-Analysis/refs/heads/main/README.md";

interface RepoInfo {
  full_name: string;
  name: string;
  description?: string;
}

export default function GithubReadme() {
  const [markdown, setMarkdown] = useState<string>("");
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent className="py-8">
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
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-0">
        <div className="prose prose-neutral dim:prose-invert  dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              h1: ({ node, ...props }) => (
                <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />
              ),
              h2: ({ node, ...props }) => (
                <h2
                  className="text-2xl font-semibold mt-8 mb-4 border-b pb-2"
                  {...props}
                />
              ),
              h3: ({ node, ...props }) => (
                <h3 className="text-xl font-semibold mt-6 mb-3" {...props} />
              ),
              code: ({ node, className, children, ...props }) => {
                const isInline = typeof children === "string" && !children.includes("\n");
                return isInline ? (
                  <code
                    className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                    {...props}
                  >
                    {children}
                  </code>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              pre: ({ node, ...props }) => (
                <pre
                  className="bg-muted p-4 rounded-lg overflow-auto"
                  {...props}
                />
              ),
              a: ({ node, ...props }) => (
                <a className="text-primary hover:underline" {...props} />
              ),
              ul: ({ node, ...props }) => (
                <ul className="list-disc pl-6 my-4" {...props} />
              ),
              ol: ({ node, ...props }) => (
                <ol className="list-decimal pl-6 my-4" {...props} />
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
