import { useState, useEffect } from 'react'
import { api } from '@/api/client'
import { RefreshCw } from 'lucide-react'

interface CaptchaChallenge {
  question: string
  token: string
}

export default function CaptchaField({ setToken, onAnswerChange, error }: {
  setToken: (token: string) => void
  onAnswerChange: (v: string) => void
  error?: string
}) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchChallenge = async () => {
    setLoading(true)
    try {
      const res = await api.get('/captcha/challenge')
      setChallenge(res.data)
      setToken(res.data.token)
      onAnswerChange('')
    } catch {
      setChallenge(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchChallenge() }, [])

  return (
    <div className="flex flex-col gap-2">
      <label className="form-label overlay-label">Are You Human?</label>
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="input-field !min-h-[52px] flex items-center text-sm text-muted-foreground">
            Loading challenge…
          </div>
        ) : challenge ? (
          <>
            <span className="overlay-label text-sm whitespace-nowrap">{challenge.question}</span>
            <input
              onChange={e => onAnswerChange(e.target.value)}
              className="input-field !min-h-[44px] !py-2 w-24 text-center font-mono text-lg"
              placeholder="?"
              autoComplete="off"
              inputMode="numeric"
            />
            <button type="button" onClick={fetchChallenge} className="p-2 rounded-lg hover:bg-muted transition-colors" title="New challenge">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
          </>
        ) : (
          <span className="text-sm text-destructive">Could not load captcha. Refresh to try again.</span>
        )}
      </div>
      {error && <p className="text-sm text-destructive font-semibold">{error}</p>}
    </div>
  )
}