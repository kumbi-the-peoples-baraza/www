import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pagesApi, contentApi } from "@/api/client";
import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import RichTextarea from "@/components/ui/RichTextarea";
import type { Page, ContentBlock } from "@/types";

const BLOCK_TYPES = [
  "text",
  "image",
  "video",
  "audio",
  "pdf",
  "notebook",
  "form",
] as const;

export default function Content() {
  const qc = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newBlock, setNewBlock] = useState<{
    type: string;
    content: string;
    mediaUrl: string;
  }>({
    type: "text",
    content: "",
    mediaUrl: "",
  });

  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ["cms-pages"],
    queryFn: () => pagesApi.list().then((r) => r.data),
  });

  const { data: blocks = [], isLoading: blocksLoading } = useQuery({
    queryKey: ["content", selectedPageId],
    queryFn: () => contentApi.list(selectedPageId!).then((r) => r.data),
    enabled: !!selectedPageId,
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => contentApi.create(selectedPageId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content", selectedPageId] });
      setAdding(false);
      setNewBlock({ type: "text", content: "", mediaUrl: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      contentApi.update(id, data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["content", selectedPageId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contentApi.delete(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["content", selectedPageId] }),
  });

  const needsMedia = (type: string) =>
    ["image", "video", "audio", "pdf"].includes(type);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Content</h1>

      <div className="mb-6">
        <label className="text-sm font-medium mb-1.5 block">Page</label>
        {pagesLoading ? (
          <Skeleton className="h-10 w-64" />
        ) : (
          <select
            value={selectedPageId || ""}
            onChange={(e) => setSelectedPageId(e.target.value || null)}
            className="input-field w-64"
          >
            <option value="">Select a page…</option>
            {pages.map((p: Page) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedPageId && (
        <>
          <div className="flex flex-col gap-3 mb-4">
            {blocksLoading ? (
              [1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : blocks.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No content blocks yet.
              </p>
            ) : (
              blocks.map((b: ContentBlock, idx: number) => (
                <div key={b.id} className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    <GripVertical className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {b.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          #{idx + 1}
                        </span>
                      </div>
                      {b.type === "text" ? (
                        <RichTextarea
                          initialContent={b.content}
                          onChange={(val) =>
                            updateMutation.mutate({
                              id: b.id,
                              data: { content: val },
                            })
                          }
                        />
                      ) : (
                        <div className="space-y-2">
                          {b.mediaUrl && (
                            <p className="text-xs text-muted-foreground truncate">
                              {b.mediaUrl}
                            </p>
                          )}
                          <input
                            defaultValue={b.mediaUrl || ""}
                            placeholder="Media URL"
                            onBlur={(e) =>
                              updateMutation.mutate({
                                id: b.id,
                                data: { mediaUrl: e.target.value },
                              })
                            }
                            className="input-field text-sm"
                          />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (confirm("Delete block?"))
                          deleteMutation.mutate(b.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {adding ? (
            <div className="glass-card p-4">
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Type
                  </label>
                  <select
                    value={newBlock.type}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, type: e.target.value })
                    }
                    className="input-field"
                  >
                    {BLOCK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {newBlock.type === "text" ? (
                <div className="mb-4">
                  <label className="text-sm font-medium mb-1.5 block">
                    Content
                  </label>
                  <RichTextarea
                    onChange={(val) =>
                      setNewBlock({ ...newBlock, content: val })
                    }
                    placeholder="Write content…"
                  />
                </div>
              ) : needsMedia(newBlock.type) ? (
                <div className="mb-4">
                  <label className="text-sm font-medium mb-1.5 block">
                    Media URL
                  </label>
                  <input
                    value={newBlock.mediaUrl}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, mediaUrl: e.target.value })
                    }
                    className="input-field"
                    placeholder="/app/storage/..."
                  />
                </div>
              ) : (
                <div className="mb-4">
                  <label className="text-sm font-medium mb-1.5 block">
                    Content / Reference
                  </label>
                  <input
                    value={newBlock.content}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, content: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    createMutation.mutate({
                      type: newBlock.type,
                      content: newBlock.content,
                      mediaUrl: newBlock.mediaUrl,
                      order: blocks.length,
                    })
                  }
                  disabled={createMutation.isPending}
                  className="btn-primary"
                >
                  Add Block
                </button>
                <button onClick={() => setAdding(false)} className="btn-ghost">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="btn-ghost flex items-center gap-2 glass"
            >
              <Plus className="w-4 h-4" /> Add Block
            </button>
          )}
        </>
      )}
    </div>
  );
}
