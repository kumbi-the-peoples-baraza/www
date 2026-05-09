import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Image, FormInput, Users,
  BarChart3, Palette, BookOpen, Settings, LogOut, ChevronLeft, Menu
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/client'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher'
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
      {/* Sidebar — uses nav-surface so it's always readable */}
      <aside
        className={cn(
          'flex flex-col transition-all duration-300 z-30 shrink-0',
          collapsed ? 'w-16' : 'w-60'
        )}
        style={{ background: 'hsl(var(--nav-bg))', borderRight: '1px solid hsl(var(--nav-border))' }}
      >
        <div
          className="flex items-center justify-between px-3 py-4 border-b"
          style={{ borderColor: 'hsl(var(--nav-border))' }}
        >
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-xs">K</div>
              <span className="font-black text-sm text-primary tracking-tight">Kumbi CMS</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors ml-auto"
            style={{ color: 'hsl(var(--nav-fg))' }}
          >
            {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-primary/10',
                collapsed && 'justify-center'
              )}
              style={({ isActive }) => ({ color: isActive ? undefined : 'hsl(var(--nav-fg) / 0.75)' })}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div
          className="p-2 border-t flex flex-col gap-2"
          style={{ borderColor: 'hsl(var(--nav-border))' }}
        >
          {!collapsed && (
            <div className="px-3 py-2">
              <p className="text-xs font-bold truncate" style={{ color: 'hsl(var(--nav-fg))' }}>{user?.name}</p>
              <p className="text-xs truncate" style={{ color: 'hsl(var(--nav-fg) / 0.55)' }}>{user?.role}</p>
            </div>
          )}
          {!collapsed && <ThemeSwitcher />}
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-destructive/15 hover:text-destructive transition-colors',
              collapsed && 'justify-center'
            )}
            style={{ color: 'hsl(var(--nav-fg) / 0.65)' }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
