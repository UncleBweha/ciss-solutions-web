import type { Metadata } from 'next'
import { AuthShell } from '@/components/account/auth-shell'
import { GoogleSignIn, SignUpForm } from '@/components/account/auth-forms'
import { isGoogleSignInConfigured } from '@/lib/google-oauth'
import { param } from '@/lib/utils'

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } }

export default async function RegisterPage({ searchParams }: PageProps<'/register'>) {
  const next = param((await searchParams).next)
  return (
    <AuthShell title="Create your account" subtitle="Faster checkout, order tracking and a saved wishlist.">
      {isGoogleSignInConfigured ? <GoogleSignIn next={next} /> : null}
      <SignUpForm next={next} />
    </AuthShell>
  )
}
