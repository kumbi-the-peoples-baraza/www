import { useQuery } from '@tanstack/react-query'
import { configApi } from '@/api/client'

export interface ProjectItem {
  id: string; title: string; tag: string; description: string; image: string; link: string
}

export interface SiteConfig {
  nav: { brand: string; tagline: string }
  hero: { heading: string; subheading: string; image: string; ctaPrimary: string; ctaSecondary: string }
  projects: { heading: string; subheading: string; tagline: string; items: ProjectItem[]; backgroundImage: string }
  volunteer: { heading: string; subheading: string; cta: string; backgroundImage: string }
  footer: { about: string; address: string; city: string; email: string; phone: string; copyright: string }
  pages: {
    about:    { heroImage: string; story: string }
    projects: { heroImage: string }
    blog:     { heroImage: string }
    volunteer:{ heroImage: string }
    trace:    { heroImage: string }
    vote:     { heroImage: string }
  }
}

export const DEFAULTS: SiteConfig = {
  nav: { brand: 'Kumbi', tagline: "The People's Baraza" },
  hero: {
    heading: 'Building a Better Community Together',
    subheading: 'Kumbi drives meaningful change across Kenya through data, democracy, and dedicated social work.',
    image: 'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=1920&q=90&auto=format&fit=crop',
    ctaPrimary: 'Explore Projects', ctaSecondary: 'Learn More',
  },
  projects: {
    heading: 'Our Projects',
    subheading: 'Three pillars of community transformation driving real, measurable impact across Kenya.',
    tagline: 'Empowering communities — one project at a time',
    backgroundImage: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1600&q=80&auto=format&fit=crop',
    items: [
      { id: 'trace', title: 'KumbiTrace', tag: 'Missing Persons · Data', link: '/projects/trace',
        description: 'Born from the 2024 Nairobi protests, KumbiTrace is a crowd-sourced platform for tracking enforced disappearances.',
        image: 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?w=900&q=80&auto=format&fit=crop' },
      { id: 'vote', title: 'KumbiVote', tag: 'Blockchain · Elections', link: '/projects/vote',
        description: 'A bulletproof blockchain-based distributed elections management platform built for Africa.',
        image: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=900&q=80&auto=format&fit=crop' },
      { id: 'social', title: 'Social Work', tag: 'Community · Volunteers', link: '/blog',
        description: 'Connecting volunteers with communities in need through coordinated social programmes across Kenya.',
        image: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=900&q=80&auto=format&fit=crop' },
    ],
  },
  volunteer: {
    heading: 'Ready to Make a Difference?',
    subheading: 'Join hundreds of volunteers already working with Kumbi to transform communities across Nairobi and Kenya.',
    cta: 'Volunteer with Kumbi',
    backgroundImage: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1600&q=80&auto=format&fit=crop',
  },
  footer: {
    about: 'Driving meaningful change across Kenya through data, democracy, and dedicated social work.',
    address: 'Ngong Road, Kilimani', city: 'Nairobi, Kenya',
    email: 'hello@kumbi.org', phone: '+254 700 000 000',
    copyright: '© 2026 The People\'s Baraza. All Rights Reserved.',
  },
  pages: {
    about:    { heroImage: 'https://images.unsplash.com/photo-1611348586804-61bf6c080437?w=1400&q=80&auto=format&fit=crop', story: '' },
    projects: { heroImage: 'https://images.unsplash.com/photo-1611348586804-61bf6c080437?w=1400&q=80&auto=format&fit=crop' },
    blog:     { heroImage: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1400&q=80&auto=format&fit=crop' },
    volunteer:{ heroImage: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1400&q=80&auto=format&fit=crop' },
    trace:    { heroImage: 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?w=1400&q=80&auto=format&fit=crop' },
    vote:     { heroImage: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=1400&q=80&auto=format&fit=crop' },
  },
}

export function useConfig(): SiteConfig {
  const { data } = useQuery({
    queryKey: ['site-config'],
    queryFn: () => configApi.get().then(r => r.data),
    staleTime: 60_000,
  })
  // Deep merge API data over defaults
  if (!data) return DEFAULTS
  return {
    nav:       { ...DEFAULTS.nav,       ...(data.nav       || {}) },
    hero:      { ...DEFAULTS.hero,      ...(data.hero      || {}) },
    projects:  { ...DEFAULTS.projects,  ...(data.projects  || {}), items: data.projects?.items || DEFAULTS.projects.items },
    volunteer: { ...DEFAULTS.volunteer, ...(data.volunteer || {}) },
    footer:    { ...DEFAULTS.footer,    ...(data.footer    || {}) },
    pages: {
      about:    { ...DEFAULTS.pages.about,    ...(data.pages?.about    || {}) },
      projects: { ...DEFAULTS.pages.projects, ...(data.pages?.projects || {}) },
      blog:     { ...DEFAULTS.pages.blog,     ...(data.pages?.blog     || {}) },
      volunteer:{ ...DEFAULTS.pages.volunteer,...(data.pages?.volunteer|| {}) },
      trace:    { ...DEFAULTS.pages.trace,    ...(data.pages?.trace    || {}) },
      vote:     { ...DEFAULTS.pages.vote,     ...(data.pages?.vote     || {}) },
    },
  }
}
