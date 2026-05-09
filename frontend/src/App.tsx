import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import CMSLayout from '@/components/layout/CMSLayout'
import PageLoader from '@/components/ui/PageLoader'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'

const Home = lazy(() => import('@/components/pages/Home'))
const Projects = lazy(() => import('@/components/pages/Projects'))
const TraceData = lazy(() => import('@/components/pages/TraceData'))
const Blog = lazy(() => import('@/components/pages/Blog'))
const About = lazy(() => import('@/components/pages/About'))
const Volunteer = lazy(() => import('@/components/pages/Volunteer'))
const Login = lazy(() => import('@/components/pages/Login'))

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/trace" element={<TraceData />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Home />} />
            <Route path="/volunteer" element={<Volunteer />} />
          </Route>
          <Route path="/login" element={<Login />} />
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
            <Route path="users" element={<CMSUsers />} />
            <Route path="analytics" element={<CMSAnalytics />} />
            <Route path="appearance" element={<CMSAppearance />} />
            <Route path="notebooks" element={<CMSNotebooks />} />
              <Route path="blog" element={<CMSBlog />} />
              <Route path="site-content" element={<CMSSiteContent />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
