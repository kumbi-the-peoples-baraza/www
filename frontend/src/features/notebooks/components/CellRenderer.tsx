import type { CellDTO, OutputDTO } from "@/types";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/components/ui/SafeHtml";

// ── Output rendering ──────────────────────────────────────────────────────────

function RenderOutput({ output }: { output: OutputDTO }) {
  const mb = (output.mimeBundle ?? output.data) as
    | Record<string, unknown>
    | undefined;

  if (mb?.["text/html"]) {
    return (
      <div
        className="notebook-html-output overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(mb["text/html"] as string) }}
      />
    );
  }

  if (mb?.["image/png"]) {
    return (
      <div className="my-2">
        <img
          src={`data:image/png;base64,${mb["image/png"]}`}
          alt="cell output"
          className="max-w-full rounded-md border border-border"
        />
      </div>
    );
  }

  if (mb?.["image/svg+xml"]) {
    // SVG is high-risk (script, onload). Only allow if it doesn't contain script/event handlers.
    const raw = mb["image/svg+xml"] as string
    if (/on\w+\s*=/i.test(raw) || /<script/i.test(raw)) {
      return <div className="my-2 text-xs text-muted-foreground">SVG blocked (unsafe content)</div>
    }
    return (
      <div
        className="my-2 overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
      />
    );
  }

  const text =
    (mb?.["text/plain"] as string | undefined) ?? output.text?.join("") ?? "";

  if (output.outputType === "error") {
    return (
      <pre className="mt-1 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-mono overflow-x-auto whitespace-pre-wrap">
        {output.text?.join("\n") ?? text}
      </pre>
    );
  }

  if (output.outputType === "stream") {
    return (
      <pre className="mt-1 rounded-md bg-muted/50 px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-muted-foreground">
        {text}
      </pre>
    );
  }

  return text ? (
    <pre className="mt-1 rounded-md bg-muted/40 px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
      {text}
    </pre>
  ) : null;
}

// ── Minimal markdown → HTML ───────────────────────────────────────────────────
// Swap for react-markdown + remark-gfm for full Markdown support

function markdownToHtml(md: string): string {
  return md
    .replace(
      /^#{4}\s+(.+)$/gm,
      '<h4 class="text-sm font-semibold mt-4 mb-1">$1</h4>',
    )
    .replace(
      /^#{3}\s+(.+)$/gm,
      '<h3 class="text-base font-semibold mt-5 mb-2">$1</h3>',
    )
    .replace(
      /^#{2}\s+(.+)$/gm,
      '<h2 class="text-lg font-bold mt-6 mb-2">$1</h2>',
    )
    .replace(
      /^#{1}\s+(.+)$/gm,
      '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>',
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /`(.+?)`/g,
      '<code class="px-1 py-0.5 rounded bg-muted text-xs font-mono">$1</code>',
    )
    .replace(/^[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/^([^<\n].+)$/gm, (line) => `<p class="mb-3">${line}</p>`);
}

// ── Cell renderer ─────────────────────────────────────────────────────────────

interface CellRendererProps {
  cell: CellDTO;
  showSource?: boolean;
  className?: string;
}

export function CellRenderer({
  cell,
  showSource = false,
  className,
}: CellRendererProps) {
  if (cell.type === "markdown") {
    return (
      <div
        className={cn("prose prose-sm max-w-none dark:prose-invert", className)}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(cell.source)) }}
      />
    );
  }

  if (cell.type === "code") {
    return (
      <div className={cn("space-y-1", className)}>
        {showSource && cell.source && (
          <pre className="rounded-md bg-muted/60 border border-border px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">
            <code>{cell.source}</code>
          </pre>
        )}
        {cell.outputs?.map((out, i) => (
          <RenderOutput key={i} output={out} />
        ))}
      </div>
    );
  }

  // raw
  return showSource && cell.source ? (
    <pre
      className={cn(
        "rounded-md bg-muted/30 px-3 py-2 text-xs font-mono",
        className,
      )}
    >
      {cell.source}
    </pre>
  ) : null;
}
