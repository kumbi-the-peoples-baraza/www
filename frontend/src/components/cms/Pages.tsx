import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pagesApi } from '@/api/client'
import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Archive, GitBranch, FolderPlus, Briefcase, ChevronDown, Layers, Sparkles } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import RichTextarea from '@/components/ui/RichTextarea'
import type { Page } from '@/types'
import { cn } from '@/lib/utils'

const DISPLAY_MODES = ['full', 'modal', 'overlay', 'carousel', 'hero', 'link'] as const

type EditingPage = Partial<Page> & { _isProject?: boolean; _parentId?: string | null }

function getParentId(p: Page): string | null {
  if (p.parentId) return p.parentId
  if (p.metadata && typeof (p.metadata as Record<string, unknown>).parentId === 'string') return (p.metadata as Record<string, unknown>).parentId as string
  if (p.metadata && typeof (p.metadata as Record<string, unknown>).parent_id === 'string') return (p.metadata as Record<string, unknown>).parent_id as string
  return null
}
function isProject(p: Page): boolean {
  const m = p.metadata as Record<string, unknown> | undefined
  return Boolean(m?.isProject || m?.is_project || m?.kind === 'project')
}
function buildTree(pages: Page[]): (Page & { depth: number; children: Page[] })[] {
  const byId = new Map<string, Page & { depth: number; children: Page[] }>()
  pages.forEach(p => byId.set(p.id, { ...p, depth: 0, children: [] }))
  const roots: (Page & { depth: number; children: Page[] })[] = []
  byId.forEach(node => {
    const pid = getParentId(node as Page)
    if (pid && byId.has(pid)) {
      const parent = byId.get(pid)!
      node.depth = parent.depth + 1
      parent.children.push(node as Page)
    } else {
      roots.push(node)
    }
  })
  // sort roots and children by order
  const sortFn = (a: Page, b: Page) => (a.order ?? 0) - (b.order ?? 0)
  roots.sort(sortFn)
  byId.forEach(n => n.children.sort(sortFn))
  return roots
}
function flattenTree(roots: (Page & { depth: number; children: Page[] })[]): (Page & { depth: number })[] {
  const out: (Page & { depth: number })[] = []
  function walk(nodes: (Page & { depth: number; children: Page[] })[]) {
    for (const n of nodes) {
      const { children, ...rest } = n
      out.push(rest as Page & { depth: number })
      if (children.length) walk(children as (Page & { depth: number; children: Page[] })[])
    }
  }
  walk(roots)
  return out
}

export default function Pages() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<EditingPage | null>(null)
  const [filter, setFilter] = useState<'all' | 'pages' | 'projects' | 'children'>('all')
  const [createMenuOpen, setCreateMenuOpen] = useState(false)

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['cms-pages'],
    queryFn: () => pagesApi.list().then((r) => r.data as Page[]),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Page> & Record<string, unknown>) => pagesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cms-pages'] }); setEditing(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Page> & Record<string, unknown> }) => pagesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cms-pages'] }); setEditing(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pagesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cms-pages'] }),
  })

  const tree = useMemo(() => buildTree(pages), [pages])
  const flat = useMemo(() => flattenTree(tree), [tree])

  const filteredFlat = useMemo(() => {
    if (filter === 'all') return flat
    if (filter === 'projects') return flat.filter(isProject)
    if (filter === 'pages') return flat.filter(p => !isProject(p) && !getParentId(p))
    if (filter === 'children') return flat.filter(p => !!getParentId(p))
    return flat
  }, [flat, filter])

  const projectCount = useMemo(() => pages.filter(isProject).length, [pages])
  const childCount = useMemo(() => pages.filter(p => !!getParentId(p)).length, [pages])
  const topLevelCount = useMemo(() => pages.filter(p => !isProject(p) && !getParentId(p)).length, [pages])

  const save = () => {
    if (!editing) return
    const payload: Record<string, unknown> = { ...editing }
    const parentId = editing._parentId ?? (editing.parentId as string | null) ?? null
    // persist parent in both top-level field and metadata for backend compatibility
    if (parentId) {
      payload.parentId = parentId
      payload.parent_id = parentId
      const meta = { ...(editing.metadata as Record<string, unknown> || {}) }
      meta.parentId = parentId
      meta.parent_id = parentId
      payload.metadata = meta
    } else {
      payload.parentId = null
      payload.parent_id = null
      if (payload.metadata) {
        const m = { ...(payload.metadata as Record<string, unknown>) }
        delete m.parentId
        delete m.parent_id
        payload.metadata = m
      }
    }
    if (editing._isProject) {
      const meta = { ...(payload.metadata as Record<string, unknown> || {}) }
      meta.isProject = true
      meta.kind = 'project'
      payload.metadata = meta
    } else if (editing._isProject === false) {
      const meta = { ...(payload.metadata as Record<string, unknown> || {}) }
      delete meta.isProject
      delete meta.is_project
      if (meta.kind === 'project') delete meta.kind
      payload.metadata = meta
    }
    delete payload._isProject
    delete payload._parentId

    if (editing.id) updateMutation.mutate({ id: editing.id, data: payload })
    else createMutation.mutate(payload)
  }

  const startNewPage = (kind: 'page' | 'project' | 'child', parentId?: string | null) => {
    setCreateMenuOpen(false)
    if (kind === 'project') {
      setEditing({ title: '', slug: '', status: 'draft', displayMode: 'hero', _isProject: true, _parentId: null, order: flat.length })
    } else if (kind === 'child') {
      const pid = parentId ?? (flat[0]?.id ?? null)
      setEditing({ title: '', slug: '', status: 'draft', displayMode: 'full', _isProject: false, _parentId: pid, order: flat.length })
    } else {
      setEditing({ title: '', slug: '', status: 'draft', displayMode: 'full', _isProject: false, _parentId: null, order: flat.length })
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" /> Pages &amp; Projects
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Create top-level pages, projects, and nested child pages. Projects appear on /projects. Child pages inherit their parent’s URL + slug.</p>
          </div>

          {/* Elegant create menu */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick buttons on desktop */}
            <div className="hidden lg:flex items-center gap-2">
              <button onClick={() => startNewPage('page')} className="btn-primary flex items-center gap-2 !min-h-[44px] !py-2 !px-4 !text-sm">
                <Plus className="w-4 h-4" /> New Page
              </button>
              <button onClick={() => startNewPage('project')} className="btn-ghost flex items-center gap-2 !min-h-[44px] border-primary/20 hover:bg-primary/10">
                <Briefcase className="w-4 h-4" /> New Project
              </button>
              <button onClick={() => startNewPage('child')} className="btn-ghost flex items-center gap-2 !min-h-[44px]">
                <GitBranch className="w-4 h-4" /> New Child Page
              </button>
            </div>

            {/* Pill dropdown for mobile + elegant overflow */}
            <div className="relative lg:hidden">
              <button onClick={() => setCreateMenuOpen(v => !v)} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> New <ChevronDown className={cn("w-4 h-4 transition-transform", createMenuOpen && "rotate-180")} />
              </button>
              {createMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setCreateMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 z-30 glass-card p-2 flex flex-col gap-1 shadow-xl">
                    <button onClick={() => startNewPage('page')} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-primary/10 text-left transition-colors">
                      <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center"><Plus className="w-4 h-4" /></span>
                      <span><span className="font-semibold text-sm block">New Page</span><span className="text-xs text-muted-foreground">Top-level page</span></span>
                    </button>
                    <button onClick={() => startNewPage('project')} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-primary/10 text-left transition-colors">
                      <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center"><Briefcase className="w-4 h-4" /></span>
                      <span><span className="font-semibold text-sm block">New Project</span><span className="text-xs text-muted-foreground">Shows on /projects</span></span>
                    </button>
                    <button onClick={() => startNewPage('child')} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-primary/10 text-left transition-colors">
                      <span className="w-8 h-8 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center"><GitBranch className="w-4 h-4" /></span>
                      <span><span className="font-semibold text-sm block">New Child Page</span><span className="text-xs text-muted-foreground">Nested under a parent</span></span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Filter tabs - elegant pill */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { k: 'all', label: 'All', count: pages.length, icon: Layers },
            { k: 'pages', label: 'Pages', count: topLevelCount, icon: FolderPlus },
            { k: 'projects', label: 'Projects', count: projectCount, icon: Briefcase },
            { k: 'children', label: 'Child Pages', count: childCount, icon: GitBranch },
          ].map(t => (
            <button key={t.k} onClick={() => setFilter(t.k as typeof filter)}
              className={cn("px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 border transition-all",
                filter === t.k ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card border-border hover:border-primary/30 hover:bg-primary/5")}>
              <t.icon className="w-3.5 h-3.5" /> {t.label} <span className={cn("px-1.5 py-0.5 rounded-full text-xs", filter === t.k ? "bg-white/20" : "bg-muted")}>{t.count}</span>
            </button>
          ))}
          {filter !== 'all' && <button onClick={() => setFilter('all')} className="text-sm text-muted-foreground hover:text-foreground ml-2">Clear filter →</button>}
        </div>
      </div>

      {editing && (
        <div className="glass-card p-6 mb-6 border-primary/20">
          <h2 className="font-bold mb-1 flex items-center gap-2">
            {editing._isProject ? <><Briefcase className="w-4 h-4 text-amber-600" /> {editing.id ? 'Edit Project' : 'New Project'}</> : editing._parentId ? <><GitBranch className="w-4 h-4 text-secondary" /> {editing.id ? 'Edit Child Page' : 'New Child Page'}</> : <><Plus className="w-4 h-4 text-primary" /> {editing.id ? 'Edit Page' : 'New Page'}</>}
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            {editing._isProject ? "Projects are featured on the public /projects page. Use a memorable slug." : editing._parentId ? "Child pages live under a parent. URL will be /parent-slug/child-slug." : "Top-level pages appear in navigation and site map."}
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="input-field" placeholder={editing._isProject ? "e.g. Kumbi Trace" : "e.g. Our Story"} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Slug <span className="text-muted-foreground font-normal">— URL friendly</span></label>
              <input value={editing.slug || ''} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-')} )} className="input-field" placeholder="my-page" />
              {editing._parentId && (() => {
                const parent = pages.find(p => p.id === editing._parentId)
                return parent ? <p className="text-xs text-muted-foreground mt-1">Full URL: <code className="bg-muted px-1 py-0.5 rounded">/{parent.slug}/{editing.slug || 'child-slug'}</code></p> : null
              })()}
            </div>
            {/* Parent selector — only when not a project, allows nesting */}
            <div>
              <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5" /> Parent Page <span className="text-muted-foreground font-normal">— optional</span></label>
              <select value={editing._parentId || ''} onChange={(e) => setEditing({ ...editing, _parentId: e.target.value || null })} className="input-field">
                <option value="">— No parent (top-level) —</option>
                {pages.filter(p => p.id !== editing.id).map(p => {
                  const pid = getParentId(p)
                  const prefix = pid ? "↳ " : ""
                  return <option key={p.id} value={p.id}>{prefix}{p.title} /{p.slug} {isProject(p) ? "• Project" : ""}</option>
                })}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Kind</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing({ ...editing, _isProject: false })} className={cn("flex-1 py-3 rounded-xl border-2 font-semibold text-sm flex items-center justify-center gap-2 transition-all", !editing._isProject ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/30")}>
                  <FolderPlus className="w-4 h-4" /> Page
                </button>
                <button type="button" onClick={() => setEditing({ ...editing, _isProject: true, _parentId: null })} className={cn("flex-1 py-3 rounded-xl border-2 font-semibold text-sm flex items-center justify-center gap-2 transition-all", editing._isProject ? "bg-amber-500 text-white border-amber-500" : "border-border hover:border-amber-500/30")}>
                  <Briefcase className="w-4 h-4" /> Project
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Status</label>
              <select value={editing.status || 'draft'} onChange={(e) => setEditing({ ...editing, status: e.target.value as Page['status'] })} className="input-field">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Display Mode</label>
              <select value={editing.displayMode || 'full'} onChange={(e) => setEditing({ ...editing, displayMode: e.target.value as Page['displayMode'] })} className="input-field">
                {DISPLAY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Description</label>
              <RichTextarea
                key={editing.id || 'new'}
                initialContent={editing.description || ''}
                onChange={val => setEditing(prev => ({ ...prev, description: val }))}
                placeholder="Page description or intro text…"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={save} className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Saving…" : editing.id ? "Update" : editing._isProject ? "Create Project" : editing._parentId ? "Create Child Page" : "Create Page"}
            </button>
            <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filteredFlat.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><Sparkles className="w-6 h-6 text-muted-foreground" /></div>
            <p className="font-semibold">No {filter === 'all' ? 'pages' : filter} yet</p>
            <p className="text-sm text-muted-foreground max-w-sm">{filter === 'projects' ? "Create your first project — it will appear on the public /projects page." : filter === 'children' ? "Child pages are nested under a parent. Click “New Child Page” or use the + icon on any page." : "Get started by creating a page or project."}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => startNewPage('page')} className="btn-primary !min-h-[40px] !py-2 text-sm"><Plus className="w-4 h-4" /> New Page</button>
              <button onClick={() => startNewPage('project')} className="btn-ghost !min-h-[40px] text-sm"><Briefcase className="w-4 h-4" /> New Project</button>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Title', 'Slug', 'Status', 'Display', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredFlat.map((p) => {
                const depth = (p as Page & { depth: number }).depth || 0
                const pid = getParentId(p)
                const parentTitle = pid ? pages.find(x => x.id === pid)?.title : null
                const proj = isProject(p)
                return (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        {depth > 0 && <span className="flex items-center gap-1 text-muted-foreground"><span className="inline-block w-4 h-px bg-border" /> <GitBranch className="w-3 h-3" /></span>}
                        {proj && <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0"><Briefcase className="w-3.5 h-3.5" /></span>}
                        {!proj && depth === 0 && <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><FolderPlus className="w-3.5 h-3.5" /></span>}
                        <span style={{ marginLeft: depth ? depth * 8 : 0 }}>{p.title}</span>
                        {proj && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-bold tracking-wide">PROJECT</span>}
                        {pid && parentTitle && <span className="text-xs text-muted-foreground hidden sm:inline">↳ {parentTitle}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">/{pid ? `${pages.find(x => x.id === pid)?.slug || ''}/` : ''}{p.slug}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.status === 'published' ? 'bg-green-500/15 text-green-600 dark:text-green-400' : p.status === 'archived' ? 'bg-orange-500/15 text-orange-600' : 'bg-muted text-muted-foreground'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.displayMode}{proj ? " • project" : ""}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setEditing({ ...p, _isProject: proj, _parentId: pid })} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => startNewPage('child', p.id)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Add child page"><Plus className="w-3.5 h-3.5" /><GitBranch className="w-2.5 h-2.5 -ml-1" /></button>
                        <button onClick={() => updateMutation.mutate({ id: p.id, data: { status: 'archived' } })} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Archive"><Archive className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { if (confirm(`Delete “${p.title}”?`)) deleteMutation.mutate(p.id) }} className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Helper footer */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" /> Page</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Project</span>
        <span className="flex items-center gap-1.5"><GitBranch className="w-3 h-3" /> Child = nested. Add via row + icon or “New Child Page”.</span>
      </div>
    </div>
  )
}
