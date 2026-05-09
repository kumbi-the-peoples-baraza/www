import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './Navbar'
import Footer from './Footer'
import VolunteerSheet from '@/components/forms/VolunteerSheet'
import AccessibilityWidget from '@/components/ui/AccessibilityWidget'
import ContactOverlay from '@/components/ui/ContactOverlay'
import { useContactStore } from '@/store/contactStore'

export default function Layout() {
  const { isOpen, open, close } = useContactStore()
  const location = useLocation()
  const navigate = useNavigate()

  // /contact route → open overlay, go back
  useEffect(() => {
    if (location.pathname === '/contact') {
      open()
      navigate(-1)
    }
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <VolunteerSheet />
      <AccessibilityWidget />
      <ContactOverlay open={isOpen} onClose={close} />
    </div>
  )
}
