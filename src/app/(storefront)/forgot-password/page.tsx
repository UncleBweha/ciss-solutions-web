import type { Metadata } from 'next'
import { AuthShell } from '@/components/account/auth-shell'
import { ForgotPasswordForm } from '@/components/account/auth-forms'

export const metadata: Metadata = { title: 'Reset password', robots: { index: false } }

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" subtitle="We will email you a code to choose a new password.">
      <ForgotPasswordForm />
    </AuthShell>
  )
}
