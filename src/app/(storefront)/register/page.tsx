import type { Metadata } from 'next'
import { AuthShell } from '@/components/account/auth-shell'
import { SignUpForm } from '@/components/account/auth-forms'
import { GoogleSignIn } from '@/components/account/google-button'
import { param } from '@/lib/utils'

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } }

export default async function RegisterPage({ searchParams }: PageProps<'/register'>) {
  const next = param((await searchParams).next)
  return (
    <AuthShell title="Create your account" subtitle="Faster checkout, order tracking and a saved wishlist.">
      <GoogleSignIn next={next} label="Sign up with Google" />
      <SignUpForm next={next} />
    </AuthShell>
  )
}
