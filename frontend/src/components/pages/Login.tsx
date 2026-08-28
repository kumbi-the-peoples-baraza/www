import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { LogIn, ShieldCheck, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react'
import TurnstileField from '@/components/ui/TurnstileField'
import { useCallback, useState } from 'react'

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
  remember_me: z.boolean().optional(),
})
type LoginFormData = z.infer<typeof loginSchema>

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
})
type OtpFormData = z.infer<typeof otpSchema>

export default function Login() {
  const navigate = useNavigate()
  const { setAuth, pendingOtpEmail, setPendingOtp, clearPendingOtp } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [failureCount, setFailureCount] = useState(0)

  const showTurnstile = failureCount >= 3

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember_me: false },
  })

  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
  })

  const fingerprint = typeof navigator !== 'undefined'
    ? btoa(navigator.userAgent + screen.width + screen.height)
    : 'unknown'

  const loginMutation = useMutation({
    mutationFn: (data: LoginFormData) =>
      authApi.login({
        email: data.email,
        password: data.password,
        cf_turnstile_response: turnstileToken || undefined,
        remember_me: data.remember_me,
        device_fingerprint: fingerprint,
      }),
    onSuccess: (res) => {
      if (res.data.requires_otp) {
        setPendingOtp(res.data.email || loginForm.getValues('email'))
        setLoginError(null)
        return
      }
      setAuth(res.data.user, res.data.token)
      if (res.data.requires_password_change) {
        navigate('/set-password')
        return
      }
      navigate('/cms')
    },
    onError: (err: any) => {
      setFailureCount(c => c + 1)
      const msg = err.response?.data?.error || 'Invalid credentials. Please try again.'
      setLoginError(msg)
    },
  })

  const otpMutation = useMutation({
    mutationFn: (data: OtpFormData) =>
      authApi.verifyOtp({ email: pendingOtpEmail!, otp: data.otp, remember_me: loginForm.getValues('remember_me') }),
    onSuccess: (res) => {
      setAuth(res.data.user, res.data.token)
      clearPendingOtp()
      if (res.data.requires_password_change) {
        navigate('/set-password')
        return
      }
      navigate('/cms')
    },
    onError: (err: any) => {
      otpForm.setError('otp', { message: err.response?.data?.error || 'Invalid OTP' })
    },
  })

  const onLoginSubmit = useCallback((data: LoginFormData) => {
    setLoginError(null)
    loginMutation.mutate(data)
  }, [loginMutation])

  const onOtpSubmit = useCallback((data: OtpFormData) => {
    otpMutation.mutate(data)
  }, [otpMutation])

  const isOtpPending = pendingOtpEmail !== null

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-secondary-foreground primary flex items-center justify-center text-primary-foreground font-black text-lg">
              <span id="logo"></span>
            </div>
            <span className="text-2xl font-black tracking-tight text-primary">Kumbi CMS</span>
          </div>
          <p className="text-muted-foreground text-base">
            {isOtpPending ? 'Enter the code sent to your email' : 'Sign in to manage your content'}
          </p>
        </div>

        {!isOtpPending ? (
          <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="card flex flex-col gap-6">
            <div>
              <label className="form-label">Email</label>
              <input
                {...loginForm.register('email')}
                type="email"
                className="input-field"
                placeholder="admin@kumbi.org"
              />
              {loginForm.formState.errors.email && (
                <p className="text-sm text-destructive mt-1.5">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  {...loginForm.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {loginForm.formState.errors.password && (
                <p className="text-sm text-destructive mt-1.5">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                {...loginForm.register('remember_me')}
                className="w-4 h-4 rounded border-muted-foreground/30"
              />
              Remember me for 90 days
            </label>

            {showTurnstile && (
              <div>
                <TurnstileField onVerify={(t) => setTurnstileToken(t)} />
              </div>
            )}

            {loginError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {loginError.includes('locked') && <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{loginError}</span>
              </div>
            )}

            <button type="submit" disabled={loginMutation.isPending} className="btn-primary w-full">
              {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              {loginMutation.isPending ? 'Signing in…' : 'Sign In'}
            </button>

            <Link to="/forgot-password" className="text-sm text-primary hover:underline text-center">
              Forgot your password?
            </Link>
          </form>
        ) : (
          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="card flex flex-col gap-6">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary text-sm">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>New device detected. Check <strong>{pendingOtpEmail}</strong> for a 6-digit code.</span>
            </div>

            <div>
              <label className="form-label">One-Time Password</label>
              <input
                {...otpForm.register('otp')}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="input-field text-center text-lg tracking-[0.3em] font-mono"
                placeholder="000000"
              />
              {otpForm.formState.errors.otp && (
                <p className="text-sm text-destructive mt-1.5">{otpForm.formState.errors.otp.message}</p>
              )}
            </div>

            <button type="submit" disabled={otpMutation.isPending} className="btn-primary w-full">
              {otpMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              {otpMutation.isPending ? 'Verifying…' : 'Verify OTP'}
            </button>

            <button
              type="button"
              onClick={() => { clearPendingOtp(); setLoginError(null) }}
              className="text-sm text-muted-foreground hover:text-foreground text-center"
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
