import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { formsApi } from '@/api/client'
import { Mail, Phone, MapPin } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  subject: z.string().min(1, 'Required'),
  message: z.string().min(10, 'Message too short'),
})

type FormData = z.infer<typeof schema>

export default function Contact() {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => formsApi.submitContact(data),
    onSuccess: () => { alert('Message sent!'); reset() },
  })

  return (
    <div className="section pt-32">
      <h1 className="text-4xl font-bold mb-6 gradient-text">Contact Us</h1>
      <div className="grid md:grid-cols-2 gap-12">
        <div>
          <p className="text-muted-foreground mb-8">Get in touch with us. We'd love to hear from you.</p>
          <div className="flex flex-col gap-4">
            {[
              { icon: Mail, label: 'Email', value: 'hello@kumbi.org' },
              { icon: Phone, label: 'Phone', value: '+254 700 000 000' },
              { icon: MapPin, label: 'Location', value: 'Nairobi, Kenya' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="p-2 rounded-xl glass">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="font-medium">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="card flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <input {...register('name')} className="input-field" />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <input {...register('email')} type="email" className="input-field" />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Subject</label>
            <input {...register('subject')} className="input-field" />
            {errors.subject && <p className="text-xs text-destructive mt-1">{errors.subject.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Message</label>
            <textarea {...register('message')} rows={5} className="input-field" />
            {errors.message && <p className="text-xs text-destructive mt-1">{errors.message.message}</p>}
          </div>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  )
}
