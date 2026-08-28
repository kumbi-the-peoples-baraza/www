import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

const schema = z.object({
  password: z.string().min(10, 'Must be at least 10 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })
type FormData = z.infer<typeof schema>

export default function SetPassword() {
  const navigate = useNavigate()
  const { setPendingPasswordChange, token } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => authApi.setPassword({ token: token!, password: data.password }),
    onSuccess: () => {
      setPendingPasswordChange()
      navigate('/cms')
    },
  })

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
          <p className="text-muted-foreground text-base">Set a new password for your account</p>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="card flex flex-col gap-6">
          <div className="p-3 rounded-lg bg-primary/10 text-primary text-sm">
            You are required to change your password before continuing.
          </div>

          <div>
            <label className="form-label">New Password</label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                className="input-field pr-10"
                placeholder="At least 10 characters"
                autoFocus
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
            {errors.password && (
              <p className="text-sm text-destructive mt-1.5">{errors.password.message}</p>
            )}
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
          </div>

          <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            {mutation.isPending ? 'Setting password…' : 'Set Password'}
          </button>

          {mutation.isError && (
            <p className="text-sm text-destructive text-center font-semibold">
              Could not set password. Please try again.
            </p>
          )}
        </form>
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
