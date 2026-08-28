import { useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'

declare global {
  interface Window {
    turnstile?: { render: (container: string | HTMLElement, options: object) => string; reset: (widgetId?: string) => void }
  }
}

interface Props {
  onVerify: (token: string) => void
  onError?: () => void
}

export default function TurnstileField({ onVerify, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const [siteKey, setSiteKey] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.get('/auth/captcha-config').then(res => {
      setSiteKey(res.data.site_key)
    }).catch(() => setError(true))
  }, [])

  useEffect(() => {
    if (!siteKey || !containerRef.current) return

    const loadTurnstile = () => {
      if (window.turnstile) {
        widgetId.current = window.turnstile.render(containerRef.current!, {
          sitekey: siteKey,
          callback: (token: string) => onVerify(token),
          'error-callback': () => { setError(true); onError?.() },
          theme: 'auto',
        })
        return
      }
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.onload = () => {
        widgetId.current = window.turnstile!.render(containerRef.current!, {
          sitekey: siteKey,
          callback: (token: string) => onVerify(token),
          'error-callback': () => { setError(true); onError?.() },
          theme: 'auto',
        })
      }
      script.onerror = () => setError(true)
      document.head.appendChild(script)
    }

    loadTurnstile()
  }, [siteKey, onVerify, onError])

  if (error) {
    return <p className="text-sm text-destructive">Could not load CAPTCHA. Please refresh the page.</p>
  }

  return <div ref={containerRef} className="min-h-[65px]" />
}
