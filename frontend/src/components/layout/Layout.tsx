import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import VolunteerSheet from '@/components/forms/VolunteerSheet'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <VolunteerSheet />
    </div>
  )
}
