import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/account/auth-shell'
import { SignInForm } from '@/components/account/auth-forms'
import { FormMessage } from '@/components/ui/form'
import { getSessionUser } from '@/lib/auth'
import { param } from '@/lib/utils'

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  const next = param(sp.next)
  if (await getSessionUser()) redirect(next?.startsWith('/') && !next.startsWith('//') ? next : '/account')
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to track orders, save addresses and keep your wishlist.">
      {param(sp.error) === 'link' ? <div className="mb-4"><FormMessage>That link is invalid or has expired. Please try again.</FormMessage></div> : null}
      <SignInForm next={next} />
    </AuthShell>
  )
}
