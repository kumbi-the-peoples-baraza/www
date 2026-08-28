import { useQuery } from '@tanstack/react-query'
import { configApi } from '@/api/client'

export interface ProjectItem {
  id: string; title: string; tag: string; description: string; image: string; link: string
}

export interface ContentCard {
  id: string
  title: string
  description: string
}

export interface WatermarkConfig {
  enabled: boolean
  text: string
  font: string
  size: number
  weight: string
  style: string
  color: string
  opacity: number
  position: string
}

export interface SiteConfig {
  nav: { brand: string; tagline: string }
  hero: { heading: string; subheading: string; image: string; ctaPrimary: string; ctaSecondary: string; badge: string }
  projects: { heading: string; subheading: string; tagline: string; items: ProjectItem[]; backgroundImage: string }
  volunteer: { heading: string; subheading: string; cta: string; backgroundImage: string }
  footer: { about: string; address: string; city: string; email: string; phone: string; copyright: string; twitter: string; instagram: string; facebook: string }
  correspondenceEmail?: string
  pages: {
    about:    { heading: string; subheading: string; heroImage: string; content: string; heroTag: string; values: ContentCard[] }
    projects: { heading: string; subheading: string; heroImage: string; content: string; heroTag: string }
    blog:     { heading: string; subheading: string; heroImage: string; content: string; heroTag: string }
    volunteer:{ heading: string; subheading: string; heroImage: string; content: string; heroTag: string; roles: ContentCard[] }
    trace:    { heading: string; subheading: string; heroImage: string; content: string; heroTag: string; features: ContentCard[] }
    vote:     { heading: string; subheading: string; heroImage: string; content: string; heroTag: string; features: ContentCard[] }
  }
  watermark?: WatermarkConfig
}

const WM_DEFAULTS: WatermarkConfig = {
  enabled: false, text: '© Kumbi',
  font: 'Inter, sans-serif', size: 24, weight: 'bold', style: 'normal',
  color: '#ffffff', opacity: 0.6, position: 'bottom-right',
}

export const DEFAULTS: SiteConfig = {
  nav: { brand: 'Kumbi', tagline: 'The People\'s Baraza' },
  hero: {
    heading: 'Building a Better Community Together',
    subheading: 'Kumbi drives meaningful change across Kenya through data, democracy, and dedicated social work.',
    image: '', ctaPrimary: 'Explore Projects', ctaSecondary: 'Learn More',
    badge: 'Kenya · Community · Impact',
  },
  projects: {
    heading: 'Our Projects',
    subheading: 'Three pillars of community transformation driving real, measurable impact across Kenya.',
    tagline: 'Empowering communities — one project at a time',
    backgroundImage: '', items: [
      { id: 'trace', title: 'KumbiTrace', tag: 'Missing Persons · Data', link: '/projects/trace', image: '',
        description: 'Born from the 2024 Nairobi protests, KumbiTrace is a crowd-sourced platform for tracking enforced disappearances.' },
      { id: 'vote', title: 'KumbiVote', tag: 'Blockchain · Elections', link: '/projects/vote', image: '',
        description: 'A bulletproof blockchain-based distributed elections management platform built for Africa.' },
      { id: 'social', title: 'Social Work', tag: 'Community · Volunteers', link: '/blog', image: '',
        description: 'Connecting volunteers with communities in need through coordinated social programmes across Kenya.' },
    ],
  },
  volunteer: {
    heading: 'Ready to Make a Difference?',
    subheading: 'Join hundreds of volunteers already working with Kumbi to transform communities across Nairobi and Kenya.',
    cta: 'Volunteer with Kumbi', backgroundImage: '',
  },
  footer: {
    about: 'Driving meaningful change across Kenya through data, democracy, and dedicated social work.',
    address: 'Ngong Road, Kilimani', city: 'Nairobi, Kenya',
    email: 'hello@kumbi.org', phone: '+254 702 550 800',
    copyright: '© 2026 Kumbi. All Rights Reserved.',
    twitter: '', instagram: '', facebook: '',
  },
  correspondenceEmail: '',
  pages: {
    about:    { heading: 'About Kumbi', subheading: 'Our story, mission, and the people behind the movement.', heroImage: '', content: '', heroTag: 'Who We Are',
      values: [
        { id: 'community-first', title: 'Community First', description: 'Every decision we make is guided by the needs and voices of the communities we serve.' },
        { id: 'data-driven', title: 'Data-driven', description: 'We use evidence and data to design programmes that create measurable, lasting impact.' },
        { id: 'transparency', title: 'Transparency', description: 'We operate openly — our data, our methods, and our results are available to all.' },
      ] },
    projects: { heading: 'Our Projects', subheading: 'Explore the initiatives driving change.', heroImage: '', content: '', heroTag: 'Kumbi Initiatives' },
    blog:     { heading: 'Social Work Blog', subheading: 'Stories, insights, and updates from our work across Nairobi and Kenya.', heroImage: '', content: '', heroTag: 'Community · Impact' },
    volunteer:{ heading: 'Volunteer with Kumbi', subheading: 'Join hundreds of changemakers already working to transform communities across Kenya.', heroImage: '', content: '', heroTag: 'Get Involved',
      roles: [
        { id: 'technology', title: 'Technology', description: 'Developers, designers, data scientists — help us build and improve our platforms.' },
        { id: 'outreach', title: 'Outreach', description: 'Community organisers and communicators who can spread the word and mobilise people.' },
        { id: 'social-work', title: 'Social Work', description: 'Trained social workers and counsellors supporting families and communities in need.' },
        { id: 'legal-support', title: 'Legal Support', description: 'Lawyers and paralegals helping families navigate the legal system.' },
      ] },
    trace:    { heading: 'KumbiTrace', subheading: 'A crowd-sourced missing persons tracking and data analysis platform — born from the 2024 Nairobi protests.', heroImage: '', content: '', heroTag: 'Missing Persons · Data',
      features: [
        { id: 'crowd-reports', title: 'Crowd-sourced Reports', description: 'Anyone can submit a missing persons report with photos, last known location, and circumstances.' },
        { id: 'data-analysis', title: 'Data Analysis', description: 'Pattern recognition and geospatial analysis to identify clusters and trends in disappearances.' },
        { id: 'community-verification', title: 'Community Verification', description: 'Community members verify and corroborate reports, building a trusted, tamper-resistant dataset.' },
        { id: 'real-time-alerts', title: 'Real-time Alerts', description: 'Instant notifications to families, lawyers, and human rights organisations when new data emerges.' },
      ] },
    vote:     { heading: 'KumbiVote', subheading: 'A bulletproof, first-of-its-kind blockchain-based distributed elections management and polling platform — low latency, tamper-proof, and built for Africa.', heroImage: '', content: '', heroTag: 'Blockchain · Elections',
      features: [
        { id: 'tamper-proof', title: 'Tamper-proof', description: 'Every vote is recorded on a distributed blockchain — immutable, verifiable, and transparent.' },
        { id: 'low-latency', title: 'Low Latency', description: 'Results are tallied in real time with sub-second confirmation, even at national scale.' },
        { id: 'built-for-africa', title: 'Built for Africa', description: 'Designed for low-bandwidth environments, feature phones, and offline-first operation.' },
        { id: 'accessible', title: 'Accessible to All', description: 'Multi-language, USSD-compatible, and accessible to voters without smartphones.' },
      ] },
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
      about:    { ...DEFAULTS.pages.about,    ...(data.pages?.about    || {}), values:   data.pages?.about?.values    || DEFAULTS.pages.about.values },
      projects: { ...DEFAULTS.pages.projects, ...(data.pages?.projects || {}) },
      blog:     { ...DEFAULTS.pages.blog,     ...(data.pages?.blog     || {}) },
      volunteer:{ ...DEFAULTS.pages.volunteer,...(data.pages?.volunteer|| {}), roles:    data.pages?.volunteer?.roles    || DEFAULTS.pages.volunteer.roles },
      trace:    { ...DEFAULTS.pages.trace,    ...(data.pages?.trace    || {}), features: data.pages?.trace?.features   || DEFAULTS.pages.trace.features },
      vote:     { ...DEFAULTS.pages.vote,     ...(data.pages?.vote     || {}), features: data.pages?.vote?.features    || DEFAULTS.pages.vote.features },
    },
    watermark: { ...WM_DEFAULTS, ...(data.watermark || {}) },
  }
}
