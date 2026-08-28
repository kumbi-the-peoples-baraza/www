import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check, Search, Loader2 } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  sublabel?: string
  image?: string
}

interface Props {
  options: SelectOption[]
  value?: string
  onChange: (value: string | undefined) => void
  placeholder?: string
  searchPlaceholder?: string
  allowClear?: boolean
  renderOption?: (opt: SelectOption) => React.ReactNode
  className?: string
  buttonClassName?: string
  loading?: boolean
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  allowClear = false,
  renderOption,
  className = '',
  buttonClassName = 'input-field',
  loading = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sublabel || '').toLowerCase().includes(q)
    )
  }, [options, query])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const showEmpty = filtered.length === 0
  const showLoading = loading && options.length === 0

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 w-full text-left ${buttonClassName}`}
      >
        <span className={selected ? '' : 'text-muted-foreground'}>
          {selected ? selected.label : placeholder}
        </span>
        {loading && !selected ? (
          <Loader2 className="w-4 h-4 shrink-0 opacity-60 animate-spin" />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-[hsl(var(--popover)/0.95)] shadow-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-2 border-b border-border flex items-center gap-2 bg-[hsl(var(--popover)/0.95)]">
            <Search className="w-4 h-4 opacity-60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent outline-none text-sm"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {allowClear && (
              <button
                type="button"
                onClick={() => { onChange(undefined); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/70 transition-colors"
              >
                <span className="text-muted-foreground">None</span>
              </button>
            )}
            {showLoading && (
              <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            )}
            {!showLoading && showEmpty && (
              <p className="px-3 py-2 text-sm text-muted-foreground">No matches</p>
            )}
            {!showLoading && filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-muted/70 transition-colors"
              >
                {renderOption ? renderOption(o) : (
                  <span className="text-sm">
                    {o.label}
                    {o.sublabel && <span className="block text-xs text-muted-foreground">{o.sublabel}</span>}
                  </span>
                )}
                {o.value === value && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
