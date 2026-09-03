import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import CMSLayout from '@/components/layout/CMSLayout'
import PageLoader from '@/components/ui/PageLoader'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'
import { useConfig } from '@/hooks/useConfig'

const Home = lazy(() => import('@/components/pages/Home'))
const Projects = lazy(() => import('@/components/pages/Projects'))
const TraceData = lazy(() => import('@/components/pages/TraceData'))
const KumbiVote = lazy(() => import('@/components/pages/KumbiVote'))
const Blog = lazy(() => import('@/components/pages/Blog'))
const BlogPostPage = lazy(() => import('@/components/pages/BlogPost'))
const About = lazy(() => import('@/components/pages/About'))
const PersonDetail = lazy(() => import('@/components/pages/PersonDetail'))
const Volunteer = lazy(() => import('@/components/pages/Volunteer'))
const Login = lazy(() => import('@/components/pages/Login'))
const ForgotPassword = lazy(() => import('@/components/pages/ForgotPassword'))
const ResetPassword = lazy(() => import('@/components/pages/ResetPassword'))
const SetPassword = lazy(() => import('@/components/pages/SetPassword'))
const PublicNotebookPage = lazy(() => import('@/components/pages/Notebook').then(m => ({ default: m.PublicNotebookPage })))

const CMSDashboard = lazy(() => import('@/components/cms/Dashboard'))
const CMSPages = lazy(() => import('@/components/cms/Pages'))
const CMSContent = lazy(() => import('@/components/cms/Content'))
const CMSMedia = lazy(() => import('@/components/cms/Media'))
const CMSForms = lazy(() => import('@/components/cms/Forms'))
const CMSUsers = lazy(() => import('@/components/cms/Users'))
const CMSAnalytics = lazy(() => import('@/components/cms/Analytics'))
const CMSAppearance = lazy(() => import('@/components/cms/Appearance'))
const CMSNotebooks = lazy(() => import('@/components/cms/Notebooks'))
const CMSBlog = lazy(() => import('@/components/cms/Blog'))
const CMSSiteContent = lazy(() => import('@/components/cms/SiteContent'))
const CMSPeople = lazy(() => import('@/components/cms/People'))
const CMSRuntimeErrors = lazy(() => import('@/components/cms/RuntimeErrors'))
const CMSSecurity = lazy(() => import('@/components/cms/Security'))

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
    return <Navigate to="/cms" replace />
  }
  return <>{children}</>
}

// SiteTitle derives the browser/document title from the Navigation & Branding
// values configured in /cms/site-content (nav.brand + nav.tagline). It removes
// the previously hard-wired "Empowering Communities" fallback.
function SiteTitle() {
  const cfg = useConfig()
  useEffect(() => {
    const brand = cfg.nav.brand?.trim() || 'Kumbi'
    const tagline = cfg.nav.tagline?.trim()
    document.title = tagline ? `${brand} | ${tagline}` : brand
  }, [cfg.nav.brand, cfg.nav.tagline])
  return null
}

export default function App() {
  const { theme, textZoom } = useThemeStore()

  // Apply theme class and zoom to <html> so shadcn CSS vars work correctly
  useEffect(() => {
    const html = document.documentElement
    html.classList.remove('light', 'dim', 'dark')
    html.classList.add(theme)
    html.style.fontSize = `${textZoom}rem`
  }, [theme, textZoom])

  return (
    <BrowserRouter>
      <SiteTitle />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/trace" element={<TraceData />} />
            <Route path="/projects/vote" element={<KumbiVote />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/about" element={<About />} />
            <Route path="/people/:id" element={<PersonDetail />} />
            <Route path="/about/:id" element={<PersonDetail />} />
            <Route path="/contact" element={<Home />} />
            <Route path="/volunteer" element={<Volunteer />} />
            <Route path="/n/:slug" element={<PublicNotebookPage />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/set-password" element={<ProtectedRoute><SetPassword /></ProtectedRoute>} />
          <Route
            path="/cms"
            element={
              <ProtectedRoute>
                <CMSLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CMSDashboard />} />
            <Route path="pages" element={<CMSPages />} />
            <Route path="content" element={<CMSContent />} />
            <Route path="media" element={<CMSMedia />} />
            <Route path="forms" element={<CMSForms />} />
            <Route path="users" element={<ProtectedRoute allowedRoles={["admin"]}><CMSUsers /></ProtectedRoute>} />
            <Route path="security" element={<ProtectedRoute allowedRoles={["admin"]}><CMSSecurity /></ProtectedRoute>} />
            <Route path="analytics" element={<ProtectedRoute allowedRoles={["admin"]}><CMSAnalytics /></ProtectedRoute>} />
            <Route path="appearance" element={<CMSAppearance />} />
            <Route path="notebooks" element={<CMSNotebooks />} />
              <Route path="blog" element={<CMSBlog />} />
              <Route path="site-content" element={<CMSSiteContent />} />
              <Route path="people" element={<CMSPeople />} />
              <Route path="runtime-errors" element={<ProtectedRoute allowedRoles={["admin"]}><CMSRuntimeErrors /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
