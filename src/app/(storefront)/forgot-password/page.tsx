import type { Metadata } from 'next'
import { AuthShell } from '@/components/account/auth-shell'
import { ResetCodeForm, ResetPasswordForm, ResetRequestForm } from '@/components/account/auth-forms'
import { getSessionUser } from '@/lib/auth'
import { readResetFlow } from '@/lib/reset-flow'
import { param } from '@/lib/utils'

export const metadata: Metadata = { title: 'Reset password', robots: { index: false } }

export default async function ForgotPasswordPage({ searchParams }: PageProps<'/forgot-password'>) {
  const [sp, flow] = await Promise.all([searchParams, readResetFlow()])
  // The password step needs the session the accepted code opened; without it, start over.
  const choosing = flow?.stage === 'password' && Boolean(await getSessionUser())
  return (
    <AuthShell title="Reset your password" subtitle="We will email you a code to choose a new password.">
      {choosing ? <ResetPasswordForm /> : flow?.stage === 'code' ? <ResetCodeForm email={flow.email} justSent={param(sp.sent) === '1'} /> : <ResetRequestForm />}
    </AuthShell>
  )
}
