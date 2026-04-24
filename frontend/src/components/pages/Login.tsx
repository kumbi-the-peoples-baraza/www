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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-white font-bold">J</div>
            <an className="text-2xl font-bold gradient-text">Kumbi CMS</span>
          </div>
          <p className="text-muted-foreground">Sign in to manage your content</p>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="card flex flex-col gap-5">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <input {...register('email')} type="email" className="input-field" placeholder="admin@kumbi.org" />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Password</label>
            <input {...register('password')} type="password" className="input-field" />
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
          </div>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex items-center justify-center gap-2">
            <LogIn className="w-4 h-4" />
            {mutation.isPending ? 'Signing in...' : 'Sign In'}
          </button>
          {mutation.isError && (
            <p className="text-sm text-destructive text-center">Invalid credentials</p>
          )}
        </form>
      </div>
    </div>
  )
}
