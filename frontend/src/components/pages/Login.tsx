import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { LogIn } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password too short'),
})

type FormData = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => authApi.login(data.email, data.password),
    onSuccess: (res) => {
      setAuth(res.data.user, res.data.token)
      navigate('/cms')
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-black text-lg">K</div>
            <span className="text-2xl font-black tracking-tight text-primary">Kumbi CMS</span>
          </div>
          <p className="text-muted-foreground text-base">Sign in to manage your content</p>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="card flex flex-col gap-6">
          <div>
            <label className="form-label">Email</label>
            <input {...register('email')} type="email" className="input-field" placeholder="admin@kumbi.org" />
            {errors.email && <p className="text-sm text-destructive mt-1.5">{errors.email.message}</p>}
          </div>
          <div>
            <label className="form-label">Password</label>
            <input {...register('password')} type="password" className="input-field" placeholder="••••••••" />
            {errors.password && <p className="text-sm text-destructive mt-1.5">{errors.password.message}</p>}
          </div>
          <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
            <LogIn className="w-5 h-5" />
            {mutation.isPending ? 'Signing in…' : 'Sign In'}
          </button>
          {mutation.isError && (
            <p className="text-sm text-destructive text-center font-semibold">Invalid credentials. Please try again.</p>
          )}
        </form>
      </div>
    </div>
  )
}
