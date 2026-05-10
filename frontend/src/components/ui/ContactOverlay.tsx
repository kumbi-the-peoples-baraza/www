import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { formsApi } from '@/api/client'
import OverlayPanel from './OverlayPanel'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  subject: z.string().min(1, 'Required'),
  message: z.string().min(10, 'Message too short'),
  _hp: z.string().max(0, 'Bot detected'), // honeypot — must stay empty
})
type FormData = z.infer<typeof schema>

interface Props { open: boolean; onClose: () => void }

const W = '85%'

export default function ContactOverlay({ open, onClose }: Props) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })
  const mutation = useMutation({
    mutationFn: (d: FormData) => formsApi.submitContact(d),
    onSuccess: () => { reset(); onClose() },
  })

  return (
    <OverlayPanel open={open} onClose={onClose} title="Contact Us" subtitle="We'd love to hear from you">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: W, margin: '0 auto' }}>
        {/* Honeypot — hidden from humans, bots fill it, Zod rejects if non-empty */}
        <input {...register('_hp')} type="text" tabIndex={-1} autoComplete="off"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
        <Field label="Full Name" error={errors.name?.message}>
          <input {...register('name')} className="input-field" placeholder="Your full name" />
        </Field>
        <Field label="Email Address" error={errors.email?.message}>
          <input {...register('email')} type="email" className="input-field" placeholder="you@example.com" />
        </Field>
        <Field label="Subject" error={errors.subject?.message}>
          <input {...register('subject')} className="input-field" placeholder="How can we help?" />
        </Field>
        <Field label="Message" error={errors.message?.message}>
          <textarea {...register('message')} rows={6} className="input-field" style={{ resize: 'vertical' }} placeholder="Tell us more…" />
        </Field>
        <button type="submit" disabled={mutation.isPending} className="btn-primary" style={{ width: '100%' }}>
          {mutation.isPending ? 'Sending…' : 'Send Message'}
        </button>
        {mutation.isSuccess && <p style={{ textAlign: 'center', color: '#15803d', fontWeight: 700, fontSize: '1rem' }}>✓ Message sent! We'll be in touch.</p>}
        {mutation.isError && <p style={{ textAlign: 'center', color: 'hsl(var(--destructive))', fontWeight: 600 }}>Something went wrong. Please try again.</p>}
      </form>
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
