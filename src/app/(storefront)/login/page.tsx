import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/account/auth-shell'
import { SignInForm } from '@/components/account/auth-forms'
import { GoogleSignIn } from '@/components/account/google-button'
import { FormMessage } from '@/components/ui/form'
import { getSessionUser } from '@/lib/auth'
import { param } from '@/lib/utils'

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } }

const ERRORS: Record<string, string> = {
  link: 'That link is invalid or has expired. Please try again.',
  google: 'Google sign-in is not available right now. Please sign in with your email instead.',
  rate: 'Too many sign-in attempts. Please wait 10 minutes.',
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  const next = param(sp.next)
  if (await getSessionUser()) redirect(next?.startsWith('/') && !next.startsWith('//') ? next : '/account')
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to track orders, save addresses and keep your wishlist.">
      {param(sp.error) && ERRORS[param(sp.error)!] ? (
        <div className="mb-4">
          <FormMessage>{ERRORS[param(sp.error)!]}</FormMessage>
        </div>
      ) : null}
      <GoogleSignIn next={next} />
      <SignInForm next={next} />
    </AuthShell>
  )
}
