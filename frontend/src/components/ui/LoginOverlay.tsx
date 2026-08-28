import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import OverlayPanel from './OverlayPanel'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password too short'),
})
type FormData = z.infer<typeof schema>

interface Props { open: boolean; onClose: () => void }

const W = '85%'

export default function LoginOverlay({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })
  const mutation = useMutation({
    mutationFn: (d: FormData) => authApi.login({ email: d.email, password: d.password }),
    onSuccess: (res) => { setAuth(res.data.user, res.data.token); onClose(); navigate('/cms') },
  })

  return (
    <OverlayPanel open={open} onClose={onClose} title="Admin Sign In" subtitle="Kumbi CMS — restricted access">
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '55vh' }}>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: W, margin: '0 auto' }}>
          <Field label="Email Address" error={errors.email?.message}>
            <input {...register('email')} type="email" className="input-field" placeholder="admin@kumbi.org" />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <input {...register('password')} type="password" className="input-field" placeholder="••••••••" />
          </Field>
          <button type="submit" disabled={mutation.isPending} className="btn-primary" style={{ width: '100%' }}>
            {mutation.isPending ? 'Signing in…' : 'Sign In'}
          </button>
          {mutation.isError && <p style={{ textAlign: 'center', color: 'hsl(var(--destructive))', fontWeight: 600 }}>Invalid credentials. Please try again.</p>}
        </form>
      </div>
    </OverlayPanel>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label className="form-label">{label}</label>
      {children}
      {error && <p style={{ color: 'hsl(var(--destructive))', fontWeight: 600, fontSize: '0.9rem', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  )
}
