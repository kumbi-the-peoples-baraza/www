import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { configApi } from '@/api/client'
import { DEFAULTS } from '@/hooks/useConfig'
import { useState } from 'react'
import { Save, ExternalLink, LayoutGrid, Plus, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import RichTextarea from '@/components/ui/RichTextarea'
import ImagePicker from '@/components/ui/ImagePicker'
import type { SiteConfig, ProjectItem, ContentCard } from '@/hooks/useConfig'

// ── Reusable field components ─────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} onChange={e => onChange(e.target.value)} className="input-field" placeholder={placeholder} />
}

// ── Project item editor ───────────────────────────────────────────────────────
function ProjectEditor({ item, onChange }: { item: ProjectItem; onChange: (v: ProjectItem) => void }) {
  const set = (k: keyof ProjectItem) => (v: string) => onChange({ ...item, [k]: v })
  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      <p className="font-bold text-sm text-primary uppercase tracking-widest">{item.id}</p>
      <Field label="Title"><TextInput value={item.title} onChange={set('title')} /></Field>
      <Field label="Tag / Category"><TextInput value={item.tag} onChange={set('tag')} placeholder="e.g. Missing Persons · Data" /></Field>
      <Field label="Description">
        <RichTextarea key={`proj-desc-${item.id}`} initialContent={item.description} onChange={set('description')} placeholder="Project description…" />
      </Field>
      <ImagePicker label="Card Image" value={item.image} onChange={set('image')} />
      <Field label="Link"><TextInput value={item.link} onChange={set('link')} placeholder="/projects/trace" /></Field>
    </div>
  )
}

// ── Generic card editor (for values, features, roles) ─────────────────────────
function CardEditor({ card, onChange, onDelete }: { card: ContentCard; onChange: (v: ContentCard) => void; onDelete: () => void }) {
  return (
    <div className="glass-card p-4 flex flex-col gap-3 relative">
      <button onClick={onDelete} className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Remove card">
        <Trash2 className="w-4 h-4" />
      </button>
      <Field label="Title"><input value={card.title} onChange={e => onChange({ ...card, title: e.target.value })} className="input-field pr-10" /></Field>
      <Field label="Description"><textarea value={card.description} onChange={e => onChange({ ...card, description: e.target.value })} className="input-field min-h-[4rem]" /></Field>
    </div>
  )
}

function CardsSection({ cards, onChange }: { cards: ContentCard[]; onChange: (cards: ContentCard[]) => void }) {
  const addCard = () => {
    const id = `card-${Date.now()}`
    onChange([...cards, { id, title: 'New Card', description: '' }])
  }
  return (
    <div className="flex flex-col gap-4">
      {cards.map((c, i) => (
        <CardEditor key={c.id} card={c} onChange={v => { const next = [...cards]; next[i] = v; onChange(next) }} onDelete={() => onChange(cards.filter((_, idx) => idx !== i))} />
      ))}
      <button onClick={addCard} className="btn-ghost gap-2 self-start text-sm font-semibold">
        <Plus className="w-4 h-4" /> Add Card
      </button>
    </div>
  )
}

// ── Section definitions ───────────────────────────────────────────────────────
type SectionEntry = { id: string; title: string } | { separator: string }

const SECTIONS: SectionEntry[] = [
  { separator: 'Global' },
  { id: 'nav', title: 'Navigation & Branding' },
  { id: 'footer', title: 'Footer' },
  { id: 'footer-social', title: 'Social Media Links' },

  { separator: 'Home Page' },
  { id: 'hero', title: 'Hero Banner' },
  { id: 'projects', title: 'Projects Section' },
  { id: 'volunteer', title: 'Volunteer CTA' },

  { separator: 'About Us' },
  { id: 'about', title: 'Page Settings' },
  { id: 'about-values', title: 'Values Cards' },

  { separator: 'Projects' },
  { id: 'projects-page', title: 'Page Settings' },

  { separator: 'Blog' },
  { id: 'blog-page', title: 'Page Settings' },

  { separator: 'KumbiTrace' },
  { id: 'trace', title: 'Page Settings' },
  { id: 'trace-features', title: 'Feature Cards' },

  { separator: 'KumbiVote' },
  { id: 'vote', title: 'Page Settings' },
  { id: 'vote-features', title: 'Feature Cards' },

  { separator: 'Volunteer' },
  { id: 'volunteer-page', title: 'Page Settings' },
  { id: 'volunteer-roles', title: 'Role Cards' },
]

// ── Section content components ────────────────────────────────────────────────
function NavSection({ cfg, set }: { cfg: SiteConfig; set: ReturnType<typeof useSectionSet> }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <Field label="Brand Name"><TextInput value={cfg.nav.brand} onChange={v => set('nav')({ brand: v })} /></Field>
      <Field label="Tagline (shown in footer)"><TextInput value={cfg.nav.tagline} onChange={v => set('nav')({ tagline: v })} /></Field>
    </div>
  )
}

function HeroSection({ cfg, set }: { cfg: SiteConfig; set: ReturnType<typeof useSectionSet> }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <Field label="Heading"><TextInput value={cfg.hero.heading} onChange={v => set('hero')({ heading: v })} /></Field>
      <Field label="Badge (pill above heading)"><TextInput value={cfg.hero.badge} onChange={v => set('hero')({ badge: v })} placeholder="e.g. Kenya · Community · Impact" /></Field>
      <Field label="Subheading">
        <RichTextarea key="hero-sub" initialContent={cfg.hero.subheading} onChange={v => set('hero')({ subheading: v })} placeholder="Hero subheading…" />
      </Field>
      <ImagePicker label="Background Image" value={cfg.hero.image} onChange={v => set('hero')({ image: v })} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Primary CTA Button"><TextInput value={cfg.hero.ctaPrimary} onChange={v => set('hero')({ ctaPrimary: v })} /></Field>
        <Field label="Secondary CTA Button"><TextInput value={cfg.hero.ctaSecondary} onChange={v => set('hero')({ ctaSecondary: v })} /></Field>
      </div>
    </div>
  )
}

function ProjectsSection({ cfg, set, setProjectItem, onAddProject, onDeleteProject }: {
  cfg: SiteConfig; set: ReturnType<typeof useSectionSet>;
  setProjectItem: (idx: number, val: ProjectItem) => void;
  onAddProject: () => void; onDeleteProject: (idx: number) => void
}) {
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <Field label="Section Heading"><TextInput value={cfg.projects.heading} onChange={v => set('projects')({ heading: v })} /></Field>
      <Field label="Section Subheading">
        <RichTextarea key="proj-sub" initialContent={cfg.projects.subheading} onChange={v => set('projects')({ subheading: v })} placeholder="Projects subheading…" />
      </Field>
      <Field label="Tagline (above heading)"><TextInput value={cfg.projects.tagline} onChange={v => set('projects')({ tagline: v })} /></Field>
      <ImagePicker label="Background Image" value={cfg.projects.backgroundImage} onChange={v => set('projects')({ backgroundImage: v })} />
      <p className="form-label mt-2">Project Cards</p>
      {cfg.projects.items.map((item, i) => (
        <div key={item.id} className="relative">
          <button onClick={() => onDeleteProject(i)} className="absolute top-5 right-5 z-10 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Remove project">
            <Trash2 className="w-4 h-4" />
          </button>
          <ProjectEditor item={item} onChange={val => setProjectItem(i, val)} />
        </div>
      ))}
      <button onClick={onAddProject} className="btn-ghost gap-2 self-start text-sm font-semibold">
        <Plus className="w-4 h-4" /> Add Project
      </button>
    </div>
  )
}

function VolunteerSection({ cfg, set }: { cfg: SiteConfig; set: ReturnType<typeof useSectionSet> }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <Field label="Heading"><TextInput value={cfg.volunteer.heading} onChange={v => set('volunteer')({ heading: v })} /></Field>
      <Field label="Subheading">
        <RichTextarea key="vol-sub" initialContent={cfg.volunteer.subheading} onChange={v => set('volunteer')({ subheading: v })} placeholder="Volunteer subheading…" />
      </Field>
      <Field label="Button Text"><TextInput value={cfg.volunteer.cta} onChange={v => set('volunteer')({ cta: v })} /></Field>
      <ImagePicker label="Background Image" value={cfg.volunteer.backgroundImage} onChange={v => set('volunteer')({ backgroundImage: v })} />
    </div>
  )
}

function FooterSection({ cfg, set, setTop }: { cfg: SiteConfig; set: ReturnType<typeof useSectionSet>; setTop: (v: string) => void }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <Field label="About Text">
        <RichTextarea key="footer-about" initialContent={cfg.footer.about} onChange={v => set('footer')({ about: v })} placeholder="About text…" />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Street Address"><TextInput value={cfg.footer.address} onChange={v => set('footer')({ address: v })} /></Field>
        <Field label="City / Country"><TextInput value={cfg.footer.city} onChange={v => set('footer')({ city: v })} /></Field>
        <Field label="Email">
          <TextInput value={cfg.footer.email} onChange={v => set('footer')({ email: v })} />
          {cfg.footer.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cfg.footer.email) && (
            <p className="text-xs text-destructive mt-1">Enter a valid email address.</p>
          )}
        </Field>
        <Field label="Phone">
          <TextInput value={cfg.footer.phone} onChange={v => set('footer')({ phone: v })} />
          {!cfg.footer.phone.trim() && <p className="text-xs text-destructive mt-1">Phone is required.</p>}
        </Field>
      </div>
      <Field label="Copyright Line"><TextInput value={cfg.footer.copyright} onChange={v => set('footer')({ copyright: v })} /></Field>
      <Field label="Correspondence Email Address">
        <TextInput
          value={cfg.correspondenceEmail || ''}
          onChange={v => setTop(v)}
          placeholder="ops@kumbike.org"
        />
      </Field>
    </div>
  )
}

function SocialLinksSection({ cfg, set }: { cfg: SiteConfig; set: ReturnType<typeof useSectionSet> }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">Set your organisation's social media profile URLs. Leave blank to hide the icon in the footer.</p>
      <Field label="X (Twitter) URL">
        <div className="flex gap-2 items-center">
          <TextInput value={cfg.footer.twitter} onChange={v => set('footer')({ twitter: v })} placeholder="https://x.com/kumbi" />
          {cfg.footer.twitter && <a href={cfg.footer.twitter} target="_blank" rel="noopener noreferrer" className="p-2 hover:text-primary transition-colors"><ExternalLink className="w-4 h-4" /></a>}
        </div>
      </Field>
      <Field label="Instagram URL">
        <div className="flex gap-2 items-center">
          <TextInput value={cfg.footer.instagram} onChange={v => set('footer')({ instagram: v })} placeholder="https://instagram.com/kumbi" />
          {cfg.footer.instagram && <a href={cfg.footer.instagram} target="_blank" rel="noopener noreferrer" className="p-2 hover:text-primary transition-colors"><ExternalLink className="w-4 h-4" /></a>}
        </div>
      </Field>
      <Field label="Facebook URL">
        <div className="flex gap-2 items-center">
          <TextInput value={cfg.footer.facebook} onChange={v => set('footer')({ facebook: v })} placeholder="https://facebook.com/kumbi" />
          {cfg.footer.facebook && <a href={cfg.footer.facebook} target="_blank" rel="noopener noreferrer" className="p-2 hover:text-primary transition-colors"><ExternalLink className="w-4 h-4" /></a>}
        </div>
      </Field>
    </div>
  )
}

function AboutValuesSection({ cfg, setPage }: { cfg: SiteConfig; setPage: (page: keyof SiteConfig['pages']) => (patch: Partial<SiteConfig['pages'][typeof page]>) => void }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <p className="form-label">About Us — Values Cards</p>
      <CardsSection cards={cfg.pages.about.values} onChange={v => setPage('about')({ values: v })} />
    </div>
  )
}

function TraceFeaturesSection({ cfg, setPage }: { cfg: SiteConfig; setPage: (page: keyof SiteConfig['pages']) => (patch: Partial<SiteConfig['pages'][typeof page]>) => void }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <p className="form-label">KumbiTrace — Feature Cards</p>
      <CardsSection cards={cfg.pages.trace.features} onChange={v => setPage('trace')({ features: v })} />
    </div>
  )
}

function VoteFeaturesSection({ cfg, setPage }: { cfg: SiteConfig; setPage: (page: keyof SiteConfig['pages']) => (patch: Partial<SiteConfig['pages'][typeof page]>) => void }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <p className="form-label">KumbiVote — Feature Cards</p>
      <CardsSection cards={cfg.pages.vote.features} onChange={v => setPage('vote')({ features: v })} />
    </div>
  )
}

function VolunteerRolesSection({ cfg, setPage }: { cfg: SiteConfig; setPage: (page: keyof SiteConfig['pages']) => (patch: Partial<SiteConfig['pages'][typeof page]>) => void }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <p className="form-label">Volunteer — Role Cards</p>
      <CardsSection cards={cfg.pages.volunteer.roles} onChange={v => setPage('volunteer')({ roles: v })} />
    </div>
  )
}

function PageSection({ cfg, page, setPage }: { cfg: SiteConfig; page: keyof SiteConfig['pages']; setPage: (page: keyof SiteConfig['pages']) => (patch: Partial<SiteConfig['pages'][typeof page]>) => void }) {
  const p = cfg.pages[page]
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <Field label="Page Heading / Hero Title">
        <TextInput value={p.heading} onChange={v => setPage(page)({ heading: v })} />
      </Field>
      <Field label="Hero Tag / Badge">
        <TextInput value={p.heroTag} onChange={v => setPage(page)({ heroTag: v })} placeholder="e.g. Who We Are" />
      </Field>
      <Field label="Hero Subheader">
        <RichTextarea key={`${page}-sub`} initialContent={p.subheading} onChange={v => setPage(page)({ subheading: v })} placeholder="Hero subheader text…" />
      </Field>
      <ImagePicker label="Hero Image" value={p.heroImage} onChange={v => setPage(page)({ heroImage: v })} />
      <Field label="Page Content (body)">
        <RichTextarea key={`${page}-content`} initialContent={p.content} onChange={v => setPage(page)({ content: v })} placeholder="Main page content…" />
      </Field>
    </div>
  )
}

// ── Hook: type-safe section setter ────────────────────────────────────────────
function useSectionSet(setDraft: React.Dispatch<React.SetStateAction<SiteConfig | null>>) {
  return <K extends keyof SiteConfig>(section: K) =>
    (patch: Partial<SiteConfig[K]>) =>
      setDraft(d => d ? { ...d, [section]: { ...(d[section] as object), ...patch } } : d)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SiteContent() {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<SiteConfig | null>(null)
  const firstSection = (SECTIONS.find((s): s is { id: string; title: string } => 'id' in s) ?? { id: 'nav' }).id
  const [activeSection, setActiveSection] = useState(firstSection)
  const [sectionOpen, setSectionOpen] = useState(false)

  const { data: raw, isLoading } = useQuery({
    queryKey: ['site-config'],
    queryFn: () => configApi.get().then(r => r.data),
  })

  const cfg: SiteConfig | null = draft ?? raw ?? null

  if (raw && !draft) setDraft({
    nav:       { ...DEFAULTS.nav,       ...(raw.nav       || {}) },
    hero:      { ...DEFAULTS.hero,      ...(raw.hero      || {}) },
    projects:  { ...DEFAULTS.projects,  ...(raw.projects  || {}), items: raw.projects?.items || DEFAULTS.projects.items },
      volunteer: { ...DEFAULTS.volunteer, ...(raw.volunteer || {}) },
      footer:    { ...DEFAULTS.footer,    ...(raw.footer    || {}) },
      correspondenceEmail: raw.correspondenceEmail || DEFAULTS.correspondenceEmail || '',
    pages: {
      about:    { ...DEFAULTS.pages.about,    ...(raw.pages?.about    || {}), values:   raw.pages?.about?.values    || DEFAULTS.pages.about.values },
      projects: { ...DEFAULTS.pages.projects, ...(raw.pages?.projects || {}) },
      blog:     { ...DEFAULTS.pages.blog,     ...(raw.pages?.blog     || {}) },
      volunteer:{ ...DEFAULTS.pages.volunteer,...(raw.pages?.volunteer|| {}), roles:    raw.pages?.volunteer?.roles    || DEFAULTS.pages.volunteer.roles },
      trace:    { ...DEFAULTS.pages.trace,    ...(raw.pages?.trace    || {}), features: raw.pages?.trace?.features   || DEFAULTS.pages.trace.features },
      vote:     { ...DEFAULTS.pages.vote,     ...(raw.pages?.vote     || {}), features: raw.pages?.vote?.features    || DEFAULTS.pages.vote.features },
    },
  })

  const mutation = useMutation({
    mutationFn: (data: SiteConfig) => configApi.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['site-config'] }),
  })

  if (isLoading || !cfg) return <Skeleton className="h-96 w-full" />

  const set = useSectionSet(setDraft)

  const setPage = (page: keyof SiteConfig['pages']) =>
    (patch: Partial<SiteConfig['pages'][typeof page]>) =>
      setDraft(d => d ? { ...d, pages: { ...d.pages, [page]: { ...d.pages[page], ...patch } } } : d)

  const setProjectItem = (idx: number, val: ProjectItem) =>
    setDraft(d => {
      if (!d) return d
      const items = [...d.projects.items]
      items[idx] = val
      return { ...d, projects: { ...d.projects, items } }
    })

  const onAddProject = () =>
    setDraft(d => {
      if (!d) return d
      const id = `project-${Date.now()}`
      const newItem: ProjectItem = { id, title: 'New Project', tag: '', description: '', image: '', link: '' }
      return { ...d, projects: { ...d.projects, items: [...d.projects.items, newItem] } }
    })

  const onDeleteProject = (idx: number) =>
    setDraft(d => {
      if (!d) return d
      const items = d.projects.items.filter((_, i) => i !== idx)
      return { ...d, projects: { ...d.projects, items } }
    })

  return (
    <div className="relative min-h-[calc(100vh-12rem)]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">Site Settings <span className="text-muted-foreground font-semibold">/ {SECTIONS.find((s): s is { id: string; title: string } => 'id' in s && s.id === activeSection)?.title ?? activeSection}</span></h1>
      </div>

      {/* ── Content area ── */}
      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          {activeSection === 'nav' && <NavSection cfg={cfg} set={set} />}
          {activeSection === 'hero' && <HeroSection cfg={cfg} set={set} />}
          {activeSection === 'projects' && <ProjectsSection cfg={cfg} set={set} setProjectItem={setProjectItem} onAddProject={onAddProject} onDeleteProject={onDeleteProject} />}
          {activeSection === 'volunteer' && <VolunteerSection cfg={cfg} set={set} />}
          {activeSection === 'footer' && <FooterSection cfg={cfg} set={set} setTop={(v) => setDraft(d => d ? { ...d, correspondenceEmail: v } : d)} />}
          {activeSection === 'footer-social' && <SocialLinksSection cfg={cfg} set={set} />}
          {activeSection === 'about' && <PageSection cfg={cfg} page="about" setPage={setPage} />}
          {activeSection === 'about-values' && <AboutValuesSection cfg={cfg} setPage={setPage} />}
          {activeSection === 'projects-page' && <PageSection cfg={cfg} page="projects" setPage={setPage} />}
          {activeSection === 'blog-page' && <PageSection cfg={cfg} page="blog" setPage={setPage} />}
          {activeSection === 'trace' && <PageSection cfg={cfg} page="trace" setPage={setPage} />}
          {activeSection === 'trace-features' && <TraceFeaturesSection cfg={cfg} setPage={setPage} />}
          {activeSection === 'vote' && <PageSection cfg={cfg} page="vote" setPage={setPage} />}
          {activeSection === 'vote-features' && <VoteFeaturesSection cfg={cfg} setPage={setPage} />}
          {activeSection === 'volunteer-page' && <PageSection cfg={cfg} page="volunteer" setPage={setPage} />}
          {activeSection === 'volunteer-roles' && <VolunteerRolesSection cfg={cfg} setPage={setPage} />}
        </div>
      </div>

      {/* ── Floating section selector button + popover ── */}
      <div className="fixed top-[4.5rem] right-6 z-40">
        <button
          onClick={() => setSectionOpen(v => !v)}
          className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
          title="Switch section"
        >
          <LayoutGrid className="w-5 h-5" />
        </button>

        {sectionOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setSectionOpen(false)} />
            <div className="absolute top-16 right-0 z-40 w-64 glass-card overflow-y-auto p-3 border border-border shadow-2xl rounded-2xl max-h-[70vh]">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-3 py-2">Sections</p>
              {SECTIONS.map(s => {
                if ('separator' in s) {
                  return (
                    <p key={s.separator} className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-3 pt-4 pb-1.5">
                      {s.separator}
                    </p>
                  )
                }
                return (
                  <button
                    key={s.id}
                    onClick={() => { setActiveSection(s.id); setSectionOpen(false) }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                      activeSection === s.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-primary/10'
                    }`}
                  >
                    {s.title}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Floating toast just below nav bar ── */}
      <div className="fixed top-14 left-0 right-0 z-50 pointer-events-none flex justify-center">
        <div className="pointer-events-auto">
          {mutation.isSuccess && (
            <p className="bg-green-600 text-white font-semibold text-sm px-5 py-2.5 rounded-b-xl shadow-lg animate-in slide-in-from-top">
              ✓ Page updated
            </p>
          )}
          {mutation.isError && (
            <p className="bg-destructive text-destructive-foreground font-semibold text-sm px-5 py-2.5 rounded-b-xl shadow-lg animate-in slide-in-from-top">
              Save failed. Please try again.
            </p>
          )}
        </div>
      </div>

      {/* ── Floating save button ── */}
      <button
        onClick={() => mutation.mutate(cfg)}
        disabled={mutation.isPending}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        title="Save changes"
      >
        <Save className="w-5 h-5" />
      </button>
    </div>
  )
}