import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/api/client'
import { ArrowLeft, Mail, KeyRound, CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'

const emailSchema = z.object({
  email: z.string().email('Invalid email'),
})
type EmailData = z.infer<typeof emailSchema>

const otpSchema = z.object({
  otp: z.string().length(6, 'Enter the 6-digit code'),
})
type OtpData = z.infer<typeof otpSchema>

export default function ForgotPassword() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')

  const emailForm = useForm<EmailData>({ resolver: zodResolver(emailSchema) })
  const otpForm = useForm<OtpData>({ resolver: zodResolver(otpSchema) })

  const sendMutation = useMutation({
    mutationFn: (data: EmailData) => authApi.forgotPassword(data.email),
    onSuccess: (_res, data) => {
      setEmail(data.email)
      setStep('otp')
    },
  })

  const resendMutation = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
  })

  const verifyMutation = useMutation({
    mutationFn: (data: OtpData) => authApi.verifyResetOtp({ email, otp: data.otp }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['auth'] })
      navigate(`/reset-password/${res.data.token}`)
    },
  })

  const onEmailSubmit = (data: EmailData) => sendMutation.mutate(data)
  const onOtpSubmit = (data: OtpData) => verifyMutation.mutate(data)

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
          <p className="text-muted-foreground text-base">
            {step === 'email' ? 'Reset your password' : 'Enter your code'}
          </p>
        </div>

        <div className="card flex flex-col gap-6">
          {step === 'email' ? (
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="flex flex-col gap-6">
              <div>
                <label className="form-label">Email address</label>
                <input
                  {...emailForm.register('email')}
                  type="email"
                  className="input-field"
                  placeholder="admin@kumbi.org"
                  autoFocus
                />
                {emailForm.formState.errors.email && (
                  <p className="text-sm text-destructive mt-1.5">{emailForm.formState.errors.email.message}</p>
                )}
              </div>

              <button type="submit" disabled={sendMutation.isPending} className="btn-primary w-full">
                {sendMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                {sendMutation.isPending ? 'Sending…' : 'Send Code'}
              </button>

              {sendMutation.isError && (
                <p className="text-sm text-destructive text-center font-semibold">
                  Could not send code. Please try again.
                </p>
              )}

              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground text-center flex items-center justify-center gap-1">
                <ArrowLeft className="w-3 h-3" />
                Back to Login
              </Link>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="flex flex-col gap-6">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 text-primary text-sm">
                <KeyRound className="w-4 h-4 mt-0.5 shrink-0" />
                <span>We sent a 6-digit code to <strong>{email}</strong>. Enter it below to continue.</span>
              </div>

              <div>
                <label className="form-label">Verification code</label>
                <input
                  {...otpForm.register('otp')}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="input-field text-center text-lg tracking-[0.3em] font-mono"
                  placeholder="000000"
                  autoFocus
                />
                {otpForm.formState.errors.otp && (
                  <p className="text-sm text-destructive mt-1.5">{otpForm.formState.errors.otp.message}</p>
                )}
              </div>

              <button type="submit" disabled={verifyMutation.isPending} className="btn-primary w-full">
                {verifyMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {verifyMutation.isPending ? 'Verifying…' : 'Verify & Continue'}
              </button>

              {verifyMutation.isError && (
                <p className="text-sm text-destructive text-center font-semibold">
                  Invalid or expired code. Please try again.
                </p>
              )}

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => resendMutation.mutate()}
                  disabled={resendMutation.isPending}
                  className="text-primary hover:underline"
                >
                  {resendMutation.isPending ? 'Resending…' : 'Resend code'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('email'); otpForm.reset() }}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Use a different email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
