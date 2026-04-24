import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
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
const Contact = lazy(() => import('@/components/pages/Contact'))
const Volunteer = lazy(() => import('@/components/pages/Volunteer'))
const Login = lazy(() => import('@/components/pages/Login'))

// CMS pages
const CMSDashboard = lazy(() => import('@/components/cms/Dashboard'))
const CMSPages = lazy(() => import('@/components/cms/Pages'))
const CMSContent = lazy(() => import('@/components/cms/Content'))
const CMSMedia = lazy(() => import('@/components/cms/Media'))
const CMSForms = lazy(() => import('@/components/cms/Forms'))
const CMSUsers = lazy(() => import('@/components/cms/Users'))
const CMSAnalytics = lazy(() => import('@/components/cms/Analytics'))
const CMSAppearance = lazy(() => import('@/components/cms/Appearance'))
const CMSNotebooks = lazy(() => import('@/components/cms/Notebooks'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const { theme, textZoom } = useThemeStore()

  return (
    <div
      className={theme}
      style={{ '--text-zoom': `${textZoom}rem` } as React.CSSProperties}
    >
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/trace" element={<TraceData />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/volunteer" element={<Volunteer />} />
            </Route>
            <Route path="/login" element={<Login />} />

            {/* CMS - protected */}
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
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </div>
  )
}
