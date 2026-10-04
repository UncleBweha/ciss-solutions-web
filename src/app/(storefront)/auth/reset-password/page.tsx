import type { Metadata } from 'next'
import { AuthShell } from '@/components/account/auth-shell'
import { UpdatePasswordForm } from '@/components/account/auth-forms'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } }

export default async function ResetPasswordPage() {
  await requireUser('/forgot-password')
  return (
    <AuthShell title="Choose a new password">
      <UpdatePasswordForm />
    </AuthShell>
  )
}
