import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useVolunteerStore } from '@/store/volunteerStore'
import { formsApi } from '@/api/client'
import OverlayPanel from '@/components/ui/OverlayPanel'
import TurnstileField from '@/components/ui/TurnstileField'

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(7, 'Invalid number'),
  skills: z.string().min(10, 'Please describe what you can do'),
  _hp: z.string().max(0, 'Bot detected'),
  cf_turnstile_response: z.string().min(1, 'Please verify you are human'),
})
type FormData = z.infer<typeof schema>

export default function VolunteerSheet() {
  const { isOpen, close } = useVolunteerStore()
  const [success, setSuccess] = useState(false)
  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })
  const mutation = useMutation({
    mutationFn: (d: FormData) => formsApi.submitVolunteer(d),
    onSuccess: () => { setSuccess(true); reset() },
  })

  return (
    <OverlayPanel open={isOpen} onClose={close} title="Volunteer with Kumbi" subtitle="Join our community of changemakers">
      {success ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '4rem 0', textAlign: 'center' }}>
          <CheckCircle2 size={72} color="#15803d" />
          <h3 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0 }}>Thank you!</h3>
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '1rem' }}>We'll review your application and be in touch soon.</p>
          <button onClick={() => { setSuccess(false); close() }} className="btn-primary" style={{ marginTop: '1rem' }}>
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="overlay-form">
          <input {...register('_hp')} type="text" tabIndex={-1} autoComplete="off"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

          <Field label="First Name" error={errors.firstName?.message}>
            <input {...register('firstName')} className="input-field" placeholder="Jane" />
          </Field>
          <Field label="Last Name" error={errors.lastName?.message}>
            <input {...register('lastName')} className="input-field" placeholder="Doe" />
          </Field>
          <Field label="Email Address" error={errors.email?.message}>
            <input {...register('email')} type="email" className="input-field" placeholder="jane@example.com" />
          </Field>
          <Field label="Phone Number" error={errors.phone?.message}>
            <input {...register('phone')} type="tel" className="input-field" placeholder="+254 700 000 000" />
          </Field>
          <Field label="What can you do?" error={errors.skills?.message}>
            <textarea {...register('skills')} rows={5} className="input-field resize-none" placeholder="Tell us about your skills, availability, and how you'd like to contribute" />
          </Field>
          <TurnstileField onVerify={t => setValue('cf_turnstile_response', t)} />
          {errors.cf_turnstile_response && <p style={{ color: 'hsl(var(--destructive))', fontWeight: 600, fontSize: '0.9rem' }}>{errors.cf_turnstile_response.message}</p>}
          <button type="submit" disabled={mutation.isPending} className="btn-primary" style={{ width: '100%' }}>
            {mutation.isPending ? 'Submitting…' : 'Register to Volunteer'}
          </button>
          {mutation.isError && <p style={{ textAlign: 'center', color: 'hsl(var(--destructive))', fontWeight: 600 }}>Something went wrong. Please try again.</p>}
        </form>
      )}
    </OverlayPanel>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label className="form-label overlay-label">{label}</label>
      {children}
      {error && <p style={{ color: 'hsl(var(--destructive))', fontWeight: 600, fontSize: '0.9rem', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  )
}