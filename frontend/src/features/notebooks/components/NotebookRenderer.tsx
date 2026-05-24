import { CellRenderer } from "./CellRenderer";
import type { Notebook, CellDTO, OutputDTO } from "@/types";

interface Props {
  notebook: Notebook | null;
  showAll?: boolean;
  className?: string;
}

function parseCells(notebook: Notebook): CellDTO[] {
  if (!notebook.cells) return [];
  if (Array.isArray(notebook.cells)) return notebook.cells;
  try {
    const p = JSON.parse(notebook.cells as unknown as string);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

function hasDisplay(cell: CellDTO) {
  return cell.type === "code" && cell.outputs?.some((o) => o.outputType === "display_data");
}

function streamText(output: OutputDTO): string {
  return (output.text ?? []).join("").trim();
}

/** Extract chart title from plt.title('...') in cell source */
function chartTitle(source: string): string {
  const m = source.match(/plt\.title\(['"]([^'"]+)['"]\)/);
  return m ? m[1] : "";
}

/**
 * Parse README into a map of chart-title → { heading, description, insight }
 * Sections look like:
 *   ### 1. Gender Distribution:
 *   Description: ...
 *   Insight: ...
 */
function parseReadmeSections(readme: string): Map<string, { heading: string; description: string; insight: string }> {
  const map = new Map<string, { heading: string; description: string; insight: string }>();
  if (!readme) return map;

  // Split on ### headings
  const sections = readme.split(/(?=###\s)/);
  for (const section of sections) {
    const headingMatch = section.match(/###\s+\d+\.\s+(.+?)(?:\n|:)/);
    if (!headingMatch) continue;
    const heading = headingMatch[1].replace(/:$/, "").trim();

    const descMatch = section.match(/Description:\s*(.+?)(?=\n\n|\nInsight:|\n###|$)/s);
    const insightMatch = section.match(/Insight:\s*(.+?)(?=\n\n|\n###|\n!\[|$)/s);

    const entry = {
      heading,
      description: descMatch ? descMatch[1].replace(/\s+/g, " ").trim() : "",
      insight: insightMatch ? insightMatch[1].replace(/\s+/g, " ").trim() : "",
    };

    // Index by heading words so fuzzy chart-title matching works
    map.set(heading.toLowerCase(), entry);
  }
  return map;
}

/** Find the best README section for a chart title */
function findSection(title: string, sections: Map<string, { heading: string; description: string; insight: string }>) {
  if (!title) return null;
  const t = title.toLowerCase();
  for (const [key, val] of sections) {
    if (t.includes(key) || key.includes(t)) return val;
    // word overlap
    const keyWords = key.split(/\s+/);
    const titleWords = t.split(/\s+/);
    if (keyWords.some((w) => w.length > 4 && titleWords.includes(w))) return val;
  }
  return null;
}

/** Group chart cells with their following stream-output summaries */
function groupForDisplay(cells: CellDTO[]): Array<{ chart: CellDTO; stats: string[] }> {
  const groups: Array<{ chart: CellDTO; stats: string[] }> = [];
  for (let i = 0; i < cells.length; i++) {
    if (!hasDisplay(cells[i])) continue;
    const stats: string[] = [];
    let j = i + 1;
    while (j < cells.length && !hasDisplay(cells[j]) && j - i <= 3) {
      for (const o of cells[j].outputs ?? []) {
        if (o.outputType === "stream") {
          const t = streamText(o);
          if (t) stats.push(t);
        }
      }
      j++;
    }
    groups.push({ chart: cells[i], stats });
  }
  return groups;
}

export function NotebookRenderer({ notebook, showAll = false, className }: Props) {
  if (!notebook) return null;
  const cells = parseCells(notebook);
  if (cells.length === 0) return null;

  const sections = parseReadmeSections(notebook.readme ?? "");

  return (
    <div className={className}>
      {/* Notebook title + description */}
      <div className="mb-8">
        <h2 className="text-2xl font-black text-primary mb-1">{notebook.title}</h2>
        {notebook.description && (
          <p className="text-muted-foreground text-sm">{notebook.description}</p>
        )}
      </div>

      {showAll ? (
        /* CMS preview — every cell */
        <div className="space-y-4">
          {cells.map((cell, i) => (
            <div key={cell.id ?? i} className="glass-card overflow-hidden">
              {cell.type === "code" && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">code</span>
                </div>
              )}
              <div className="p-4">
                <CellRenderer cell={cell} showSource={cell.type !== "code"} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Public — charts with README descriptions above and stats below */
        <div className="space-y-10">
          {groupForDisplay(cells).map(({ chart, stats }, i) => {
            const title = chartTitle(chart.source);
            const section = findSection(title, sections);

            return (
              <div key={chart.id ?? i} className="glass-card overflow-hidden">
                {/* README description above the chart */}
                {section && (
                  <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border/40">
                    <h3 className="font-black text-base text-primary mb-2">{section.heading}</h3>
                    {section.description && (
                      <p className="text-sm text-foreground/80 mb-1">
                        <span className="font-semibold">Description: </span>{section.description}
                      </p>
                    )}
                    {section.insight && (
                      <p className="text-sm text-foreground/80">
                        <span className="font-semibold">Insight: </span>{section.insight}
                      </p>
                    )}
                  </div>
                )}

                {/* Chart */}
                <div className="p-5 sm:p-6">
                  <CellRenderer cell={chart} showSource={false} />
                </div>

                {/* Raw stats below */}
                {stats.length > 0 && (
                  <div className="border-t border-border/40 px-5 sm:px-6 py-4 bg-muted/20">
                    {stats.map((text, j) => (
                      <pre key={j} className="text-xs font-mono text-foreground/70 whitespace-pre-wrap leading-relaxed">
                        {text}
                      </pre>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
