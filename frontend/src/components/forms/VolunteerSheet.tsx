import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, CheckCircle2 } from 'lucide-react'
import { useVolunteerStore } from '@/store/volunteerStore'
import { formsApi } from '@/api/client'
import RichTextarea from '@/components/ui/RichTextarea'
import { useState } from 'react'

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(7, 'Invalid number'),
  skills: z.string().min(10, 'Please describe what you can do'),
})

type FormData = z.infer<typeof schema>

export default function VolunteerSheet() {
  const { isOpen, close } = useVolunteerStore()
  const [minimized, setMinimized] = useState(false)
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => formsApi.submitVolunteer(data),
    onSuccess: () => { setSuccess(true); reset() },
  })

  const onSubmit = (data: FormData) => mutation.mutate(data)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1, height: minimized ? 'auto' : undefined }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[480px] glass border-l border-white/10 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <h2 className="font-bold text-lg gradient-text">Volunteer with Kumbi</h2>
              <p className="text-xs text-muted-foreground">Join our community of changemakers</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMinimized((v) => !v)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <Minus className="w-4 h-4" />
              </button>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!minimized && (
            <div className="flex-1 overflow-y-auto p-6">
              {success ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4 py-12 text-center"
                >
                  <CheckCircle2 className="w-16 h-16 text-green-500" />
                  <h3 className="text-xl font-bold">Thank you!</h3>
                  <p className="text-muted-foreground">We'll be in touch soon.</p>
                  <button onClick={() => { setSuccess(false); close() }} className="px-6 py-2 rounded-xl gradient-bg text-white font-semibold">
                    Close
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="First Name" error={errors.firstName?.message}>
                      <input {...register('firstName')} className="input-field" placeholder="Jane" />
                    </Field>
                    <Field label="Last Name" error={errors.lastName?.message}>
                      <input {...register('lastName')} className="input-field" placeholder="Doe" />
                    </Field>
                  </div>
                  <Field label="Email Address" error={errors.email?.message}>
                    <input {...register('email')} type="email" className="input-field" placeholder="jane@example.com" />
                  </Field>
                  <Field label="Cellphone Number" error={errors.phone?.message}>
                    <input {...register('phone')} type="tel" className="input-field" placeholder="+254 700 000 000" />
                  </Field>
                  <Field label="What can you do?" error={errors.skills?.message}>
                    <RichTextarea onChange={(val) => setValue('skills', val)} placeholder="Tell us about your skills, availability, and how you'd like to contribute 🌟" />
                  </Field>
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="w-full py-3 rounded-xl gradient-bg text-white font-semibold shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {mutation.isPending ? 'Submitting...' : 'Register to Volunteer'}
                  </button>
                  {mutation.isError && (
                    <p className="text-sm text-destructive text-center">Something went wrong. Please try again.</p>
                  )}
                </form>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
