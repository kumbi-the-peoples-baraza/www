import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/api/client'
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

const schema = z.object({
  password: z.string().min(10, 'Must be at least 10 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })
type FormData = z.infer<typeof schema>

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (token) {
      authApi.verifyReset(token)
        .then(() => setTokenValid(true))
        .catch(() => setTokenValid(false))
    }
  }, [token])

  const mutation = useMutation({
    mutationFn: (data: FormData) => authApi.resetPassword({ token: token!, password: data.password }),
    onSuccess: () => setSubmitted(true),
  })

  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="card max-w-md w-full flex flex-col items-center gap-4 text-center">
          <p className="text-destructive font-semibold">Invalid or expired reset link.</p>
          <Link to="/forgot-password" className="btn-primary">Request a new link</Link>
        </div>
      </div>
    )
  }

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
          <p className="text-muted-foreground text-base">Create a new password</p>
        </div>

        <div className="card flex flex-col gap-6">
          {submitted ? (
            <>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Your password has been reset successfully.</span>
              </div>
              <button onClick={() => navigate('/login')} className="btn-primary w-full">
                Sign In
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-6">
              <div>
                <label className="form-label">New Password</label>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  placeholder="At least 10 characters"
                  autoFocus
                />
                {errors.password && (
                  <p className="text-sm text-destructive mt-1.5">{errors.password.message}</p>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  {showPassword ? 'Hide password' : 'View password'}
                </button>
                <PasswordStrength value={watch('password') || ''} />
              </div>

              <div>
                <label className="form-label">Confirm Password</label>
                <input
                  {...register('confirm')}
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Repeat your new password"
                />
                {errors.confirm && (
                  <p className="text-sm text-destructive mt-1.5">{errors.confirm.message}</p>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  {showPassword ? 'Hide password' : 'View password'}
                </button>
              </div>

              <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
                {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                {mutation.isPending ? 'Resetting…' : 'Reset Password'}
              </button>

              {mutation.isError && (
                <p className="text-sm text-destructive text-center font-semibold">
                  Could not reset password. The link may have expired.
                </p>
              )}

              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground text-center flex items-center justify-center gap-1">
                <ArrowLeft className="w-3 h-3" />
                Back to Login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function PasswordStrength({ value }: { value: string }) {
  const checks = [
    { label: '10+ characters', met: value.length >= 10 },
    { label: 'Uppercase', met: /[A-Z]/.test(value) },
    { label: 'Lowercase', met: /[a-z]/.test(value) },
    { label: 'Number', met: /[0-9]/.test(value) },
    { label: 'Symbol', met: /[^A-Za-z0-9]/.test(value) },
  ]
  const met = checks.filter(c => c.met).length

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex gap-1">
        {checks.map((c, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${c.met ? 'bg-green-500' : 'bg-muted'}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{met}/5 requirements met</p>
    </div>
  )
}
