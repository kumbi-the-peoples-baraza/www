import { useState, useEffect } from 'react'
import CountrySelect from './CountrySelect'
import { countries, findCountry } from '@/lib/countries'

interface Props {
  // stored as callingCode + '|' + number; leading zeros stripped on the number
  value?: string
  onChange: (value: string) => void
  className?: string
}

export default function PhoneNumber({ value, onChange, className = '' }: Props) {
  const [country, setCountry] = useState('KE')
  const [number, setNumber] = useState('')

  useEffect(() => {
    if (value && value.includes('|')) {
      const [cc, num] = value.split('|')
      const found = countries.find((c) => c.callingCode === cc)
      if (found) setCountry(found.iso)
      setNumber(num || '')
    }
  }, [value])

  useEffect(() => {
    const c = findCountry(country)
    const cc = c?.callingCode || ''
    const clean = number.replace(/^0+/, '')
    onChange(`${cc}|${clean}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, number])

  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="w-44 shrink-0">
        <CountrySelect value={country} onChange={setCountry} />
      </div>
      <input
        type="tel"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="712 345 678"
        className="input-field flex-1"
      />
    </div>
  )
}
