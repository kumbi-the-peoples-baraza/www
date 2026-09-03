import { useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { logRuntimeError } from '@/lib/runtimeLog'

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
      const key = res.data.site_key || res.data.siteKey || res.data.turnstileSiteKey || ''
      if (!key || String(key).trim() === '') {
        // Not configured — common on local dev where TURNSTILE_SITE_KEY is empty.
        // Auto-verify with a bypass token so the form's zod (min 1) passes; backend will allow when TURNSTILE_SECRET is empty.
        logRuntimeError('Turnstile site key not configured', { url: window.location.href, siteKey: key }, 'warning')
        setSiteKey(null)
        onVerify('not-required')
        return
      }
      setSiteKey(String(key))
    }).catch((err) => {
      logRuntimeError('Could not load CAPTCHA config', { url: window.location.href, error: String(err) }, 'error')
      setError(true)
    })
  }, [onVerify])

  useEffect(() => {
    if (!siteKey || !containerRef.current) return

    const loadTurnstile = () => {
      if (window.turnstile) {
        widgetId.current = window.turnstile.render(containerRef.current!, {
          sitekey: siteKey,
          callback: (token: string) => onVerify(token),
          'error-callback': () => {
            logRuntimeError('Turnstile render error', { url: window.location.href, siteKey }, 'error')
            setError(true); onError?.()
          },
          theme: 'auto',
        })
        return
      }
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.onload = () => {
        try {
          widgetId.current = window.turnstile!.render(containerRef.current!, {
            sitekey: siteKey,
            callback: (token: string) => onVerify(token),
            'error-callback': () => {
              logRuntimeError('Turnstile render error', { url: window.location.href, siteKey }, 'error')
              setError(true); onError?.()
            },
            theme: 'auto',
          })
        } catch (e) {
          logRuntimeError('Turnstile render exception', { url: window.location.href, error: String(e) }, 'error')
          setError(true)
        }
      }
      script.onerror = () => {
        logRuntimeError('Could not load Turnstile script', { url: window.location.href }, 'error')
        setError(true)
      }
      document.head.appendChild(script)
    }

    loadTurnstile()
  }, [siteKey, onVerify, onError])

  // siteKey === null → Turnstile not configured (local dev) — render nothing, don't block form
  if (siteKey === null) return null

  if (error) {
    const isProd = import.meta.env.PROD
    if (isProd) {
      // On production hide the user-facing error, just log
      // eslint-disable-next-line no-console
      console.error('[Turnstile] Could not load CAPTCHA', { siteKey, url: window.location.href })
      logRuntimeError('Could not load CAPTCHA', { url: window.location.href, siteKey }, 'error')
      return null
    }
    return <p className="text-sm text-destructive">Could not load CAPTCHA. Please refresh the page.</p>
  }

  return <div ref={containerRef} className="min-h-[65px]" />
}
