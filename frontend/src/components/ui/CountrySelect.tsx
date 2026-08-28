import SearchableSelect, { SelectOption } from './SearchableSelect'
import { countries, flagEmoji } from '@/lib/countries'

interface Props {
  value?: string // ISO code
  onChange: (iso: string) => void
  className?: string
}

export default function CountrySelect({ value, onChange, className }: Props) {
  const options: SelectOption[] = countries.map((c) => ({
    value: c.iso,
    label: `${flagEmoji(c.iso)}  ${c.name}`,
  }))
  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={(v) => onChange(v || '')}
      placeholder="Select country"
      searchPlaceholder="Search countries…"
      className={className}
    />
  )
}
