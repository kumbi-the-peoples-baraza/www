import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { formsApi } from '@/api/client'
import { Mail, Phone, MapPin } from 'lucide-react'
import TurnstileField from '@/components/ui/TurnstileField'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  subject: z.string().min(1, 'Required'),
  message: z.string().min(10, 'Message too short'),
  cf_turnstile_response: z.string().min(1, 'Please verify you are human'),
})

type FormData = z.infer<typeof schema>

export default function Contact() {
  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => formsApi.submitContact(data),
    onSuccess: () => { alert('Message sent!'); reset() },
  })

  return (
    <div className="section pt-28">
      <h1 className="text-4xl font-black mb-3 tracking-tight text-primary">Contact Us</h1>
      <p className="text-muted-foreground mb-10 text-base">Get in touch — we'd love to hear from you.</p>

      <div className="grid md:grid-cols-2 gap-12">
        <div className="flex flex-col gap-6">
          {[
            { icon: Mail,    label: 'Email',    value: 'hello@kumbi.org' },
            { icon: Phone,   label: 'Phone',    value: '+254 700 000 000' },
            { icon: MapPin,  label: 'Location', value: 'Nairobi, Kenya' },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl glass flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-0.5">{item.label}</p>
                <p className="text-base font-bold">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="card flex flex-col gap-5">
          <div>
            <label className="form-label">Name</label>
            <input {...register('name')} className="input-field" placeholder="Your full name" />
            {errors.name && <p className="text-sm text-destructive mt-1.5">{errors.name.message}</p>}
          </div>
          <div>
            <label className="form-label">Email</label>
            <input {...register('email')} type="email" className="input-field" placeholder="you@example.com" />
            {errors.email && <p className="text-sm text-destructive mt-1.5">{errors.email.message}</p>}
          </div>
          <div>
            <label className="form-label">Subject</label>
            <input {...register('subject')} className="input-field" placeholder="How can we help?" />
            {errors.subject && <p className="text-sm text-destructive mt-1.5">{errors.subject.message}</p>}
          </div>
          <div>
            <label className="form-label">Message</label>
            <textarea {...register('message')} rows={5} className="input-field resize-none" placeholder="Tell us more..." />
            {errors.message && <p className="text-sm text-destructive mt-1.5">{errors.message.message}</p>}
          </div>
          <TurnstileField onVerify={t => setValue('cf_turnstile_response', t)} />
          {errors.cf_turnstile_response && <p className="text-sm text-destructive font-semibold">{errors.cf_turnstile_response.message}</p>}
          <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
            {mutation.isPending ? 'Sending…' : 'Send Message'}
          </button>
          {mutation.isError && (
            <p className="text-sm text-destructive text-center">Something went wrong. Please try again.</p>
          )}
        </form>
      </div>
    </div>
  )
}