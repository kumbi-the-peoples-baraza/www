import { useThemeStore, type Theme } from '@/store/themeStore'
import { cn } from '@/lib/utils'

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  )
}

function IconDim() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeOpacity="0.45" />
    </svg>
  )
}

const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <IconSun /> },
  { value: 'dim',   label: 'Dim',   icon: <IconDim /> },
  { value: 'dark',  label: 'Dark',  icon: <IconMoon /> },
]

export default function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div
      className="flex items-center gap-0.5 p-1 rounded-xl border"
      style={{ background: 'hsl(var(--nav-bg))', borderColor: 'hsl(var(--nav-border))' }}
    >
      {themes.map((t) => (
        <button
          key={t.value}
          onClick={() => setTheme(t.value)}
          title={t.label}
          aria-label={`Switch to ${t.label} theme`}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-lg transition-all',
            theme === t.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'hover:bg-primary/10'
          )}
          style={{ color: theme === t.value ? undefined : 'hsl(var(--nav-fg) / 0.65)' }}
        >
          {t.icon}
        </button>
      ))}
    </div>
  )
}
