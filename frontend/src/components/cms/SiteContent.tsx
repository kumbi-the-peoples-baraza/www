import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { configApi } from '@/api/client'
import { useState } from 'react'
import { Save, ChevronDown, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import RichTextarea from '@/components/ui/RichTextarea'
import ImagePicker from '@/components/ui/ImagePicker'
import type { SiteConfig, ProjectItem } from '@/hooks/useConfig'

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

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 font-black text-base text-primary hover:bg-primary/5 transition-colors"
      >
        {title}
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && <div className="px-6 pb-6 pt-2 flex flex-col gap-5 border-t border-border">{children}</div>}
    </div>
  )
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

// ── Main component ────────────────────────────────────────────────────────────
export default function SiteContent() {
  const qc = useQueryClient()

  const { data: raw, isLoading } = useQuery({
    queryKey: ['site-config'],
    queryFn: () => configApi.get().then(r => r.data),
  })

  const [draft, setDraft] = useState<SiteConfig | null>(null)
  const cfg: SiteConfig | null = draft ?? raw ?? null

  // Initialise draft from fetched data on first load
  if (raw && !draft) setDraft(raw as SiteConfig)

  const mutation = useMutation({
    mutationFn: (data: SiteConfig) => configApi.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['site-config'] }),
  })

  if (isLoading || !cfg) return <Skeleton className="h-96 w-full" />

  const set = <K extends keyof SiteConfig>(section: K) =>
    (patch: Partial<SiteConfig[K]>) =>
      setDraft(d => d ? { ...d, [section]: { ...(d[section] as object), ...patch } } : d)

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Site Content</h1>
        <button
          onClick={() => mutation.mutate(cfg)}
          disabled={mutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {mutation.isPending ? 'Saving…' : 'Save All Changes'}
        </button>
      </div>

      {mutation.isSuccess && <p className="text-green-600 font-semibold text-sm">✓ Changes saved and live.</p>}
      {mutation.isError && <p className="text-destructive font-semibold text-sm">Save failed. Please try again.</p>}

      {/* ── Navigation & Branding ── */}
      <Section title="Navigation & Branding" defaultOpen>
        <Field label="Brand Name"><TextInput value={cfg.nav.brand} onChange={v => set('nav')({ brand: v })} /></Field>
        <Field label="Tagline (shown in footer)"><TextInput value={cfg.nav.tagline} onChange={v => set('nav')({ tagline: v })} /></Field>
      </Section>

      {/* ── Hero Section ── */}
      <Section title="Home — Hero Banner" defaultOpen>
        <Field label="Heading"><TextInput value={cfg.hero.heading} onChange={v => set('hero')({ heading: v })} /></Field>
        <Field label="Subheading">
          <RichTextarea key="hero-sub" initialContent={cfg.hero.subheading} onChange={v => set('hero')({ subheading: v })} placeholder="Hero subheading…" />
        </Field>
        <ImagePicker label="Background Image" value={cfg.hero.image} onChange={v => set('hero')({ image: v })} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Primary CTA Button"><TextInput value={cfg.hero.ctaPrimary} onChange={v => set('hero')({ ctaPrimary: v })} /></Field>
          <Field label="Secondary CTA Button"><TextInput value={cfg.hero.ctaSecondary} onChange={v => set('hero')({ ctaSecondary: v })} /></Field>
        </div>
      </Section>

      {/* ── Projects Section ── */}
      <Section title="Home — Projects Section">
        <Field label="Section Heading"><TextInput value={cfg.projects.heading} onChange={v => set('projects')({ heading: v })} /></Field>
        <Field label="Section Subheading">
          <RichTextarea key="proj-sub" initialContent={cfg.projects.subheading} onChange={v => set('projects')({ subheading: v })} placeholder="Projects subheading…" />
        </Field>
        <Field label="Tagline (above heading)"><TextInput value={cfg.projects.tagline} onChange={v => set('projects')({ tagline: v })} /></Field>
        <ImagePicker label="Background Image" value={cfg.projects.backgroundImage} onChange={v => set('projects')({ backgroundImage: v })} />
        <p className="form-label mt-2">Project Cards</p>
        {cfg.projects.items.map((item, i) => (
          <ProjectEditor key={item.id} item={item} onChange={val => setProjectItem(i, val)} />
        ))}
      </Section>

      {/* ── Volunteer CTA ── */}
      <Section title="Home — Volunteer Section">
        <Field label="Heading"><TextInput value={cfg.volunteer.heading} onChange={v => set('volunteer')({ heading: v })} /></Field>
        <Field label="Subheading">
          <RichTextarea key="vol-sub" initialContent={cfg.volunteer.subheading} onChange={v => set('volunteer')({ subheading: v })} placeholder="Volunteer subheading…" />
        </Field>
        <Field label="Button Text"><TextInput value={cfg.volunteer.cta} onChange={v => set('volunteer')({ cta: v })} /></Field>
        <ImagePicker label="Background Image" value={cfg.volunteer.backgroundImage} onChange={v => set('volunteer')({ backgroundImage: v })} />
      </Section>

      {/* ── Footer ── */}
      <Section title="Footer">
        <Field label="About Text">
          <RichTextarea key="footer-about" initialContent={cfg.footer.about} onChange={v => set('footer')({ about: v })} placeholder="About text…" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Street Address"><TextInput value={cfg.footer.address} onChange={v => set('footer')({ address: v })} /></Field>
          <Field label="City / Country"><TextInput value={cfg.footer.city} onChange={v => set('footer')({ city: v })} /></Field>
          <Field label="Email"><TextInput value={cfg.footer.email} onChange={v => set('footer')({ email: v })} /></Field>
          <Field label="Phone"><TextInput value={cfg.footer.phone} onChange={v => set('footer')({ phone: v })} /></Field>
        </div>
        <Field label="Copyright Line"><TextInput value={cfg.footer.copyright} onChange={v => set('footer')({ copyright: v })} /></Field>
      </Section>

      {/* ── Inner Pages ── */}
      <Section title="About Us Page">
        <ImagePicker label="Hero Image" value={cfg.pages.about.heroImage} onChange={v => setPage('about')({ heroImage: v })} />
        <Field label="Our Story">
          <RichTextarea key="about-story" initialContent={cfg.pages.about.story} onChange={v => setPage('about')({ story: v })} placeholder="Write the organisation's story…" />
        </Field>
      </Section>

      <Section title="Projects Page">
        <ImagePicker label="Hero Image" value={cfg.pages.projects.heroImage} onChange={v => setPage('projects')({ heroImage: v })} />
      </Section>

      <Section title="Blog Page">
        <ImagePicker label="Hero Image" value={cfg.pages.blog.heroImage} onChange={v => setPage('blog')({ heroImage: v })} />
      </Section>

      <Section title="KumbiTrace Page">
        <ImagePicker label="Hero Image" value={cfg.pages.trace.heroImage} onChange={v => setPage('trace')({ heroImage: v })} />
      </Section>

      <Section title="Volunteer Page">
        <ImagePicker label="Hero Image" value={cfg.pages.volunteer.heroImage} onChange={v => setPage('volunteer')({ heroImage: v })} />
      </Section>
    </div>
  )
}
