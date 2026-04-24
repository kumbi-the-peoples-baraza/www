import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Image, FormInput, Users,
  BarChart3, Palette, BookOpen, Settings, LogOut, ChevronLeft, Menu
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/client'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/cms', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/cms/pages', icon: FileText, label: 'Pages' },
  { to: '/cms/content', icon: Settings, label: 'Content' },
  { to: '/cms/media', icon: Image, label: 'Media' },
  { to: '/cms/forms', icon: FormInput, label: 'Forms' },
  { to: '/cms/notebooks', icon: BookOpen, label: 'Notebooks' },
  { to: '/cms/users', icon: Users, label: 'Users' },
  { to: '/cms/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/cms/appearance', icon: Palette, label: 'Appearance' },
]

export default function CMSLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await authApi.logout().catch(() => {})
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col glass border-r border-white/10 transition-all duration-300 z-30',
        collapsed ? 'w-16' : 'w-60'
      )}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-bg flex items-center justify-center text-white font-bold text-xs">J</div>
              <span className="font-bold gradient-text">Kumbi CMS</span>
            </div>
          )}
          <button onClick={() => setCollapsed((v) => !v)} className="p-1.5 rounded-lg hover:bg-muted transition-colors ml-auto">
            {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-2 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                collapsed && 'justify-center'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-white/10">
          {!collapsed && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn('flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors', collapsed && 'justify-center')}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
