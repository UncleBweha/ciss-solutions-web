'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { completePasswordResetAction, requestPasswordResetAction, restartPasswordResetAction, signInAction, signInWithGoogleAction, signUpAction, updatePasswordAction, verifyResetCodeAction } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Field, FormMessage, Input } from '@/components/ui/form'

function GoogleSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="glass" size="lg" className="w-full" loading={pending}>
      {pending ? null : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82Z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z" />
          <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
        </svg>
      )}
      Continue with Google
    </Button>
  )
}

export function GoogleSignIn({ next }: { next?: string }) {
  return (
    <>
      <form action={signInWithGoogleAction}>
        <input type="hidden" name="next" value={next ?? '/account'} />
        <GoogleSubmit />
      </form>
      <div className="my-5 flex items-center gap-3 text-sm text-fg-secondary">
        <span className="h-px flex-1 bg-border-strong" />
        or
        <span className="h-px flex-1 bg-border-strong" />
      </div>
    </>
  )
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, {})
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? '/account'} />
      <Field label="Email" htmlFor="email" error={state.errors?.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" error={state.errors?.password} required>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="text-primary-light hover:underline">
          Forgot password?
        </Link>
      </div>
      <FormMessage>{state.message}</FormMessage>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
      <p className="text-center text-sm text-fg-secondary">
        New to CISS Solutions?{' '}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-primary-light hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  )
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signUpAction, {})
  if (state.ok) return <FormMessage tone="success">{state.message}</FormMessage>
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? '/account'} />
      <Field label="Full name" htmlFor="fullName" error={state.errors?.fullName} required>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" error={state.errors?.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Phone (optional)" htmlFor="phone" error={state.errors?.phone} hint="For order updates">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="0712345678" />
      </Field>
      <Field label="Password" htmlFor="password" error={state.errors?.password} hint="At least 8 characters" required>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <FormMessage>{state.message}</FormMessage>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create account
      </Button>
      <p className="text-center text-sm text-fg-secondary">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-primary-light hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}

// "Forgot password" is three forms; the page decides which one to show (see lib/reset-flow.ts).

/** Step 1: ask for a code by email. */
export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, {})
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email" error={state.errors?.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <FormMessage>{state.message}</FormMessage>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Email me a code
      </Button>
    </form>
  )
}

/** Step 2: enter the emailed code. */
export function ResetCodeForm({ email, justSent }: { email: string; justSent: boolean }) {
  const [state, action, pending] = useActionState(verifyResetCodeAction, {})
  const [resend, resendAction, resending] = useActionState(requestPasswordResetAction, {})
  return (
    <div className="space-y-4">
      <FormMessage tone="success">
        {justSent ? 'Code sent. ' : ''}If an account exists for {email}, we have emailed it a code. It is valid for 15 minutes.
      </FormMessage>
      <form action={action} className="space-y-4">
        <Field label="Code from the email" htmlFor="code" error={state.errors?.code} required>
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={16} className="font-mono tracking-[0.3em]" autoFocus required />
        </Field>
        <FormMessage>{state.message}</FormMessage>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Continue
        </Button>
      </form>
      <FormMessage>{resend.message}</FormMessage>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-primary-light">
        <form action={resendAction}>
          <button type="submit" className="hover:underline" disabled={resending}>
            {resending ? 'Sending…' : 'Send a new code'}
          </button>
        </form>
        <form action={restartPasswordResetAction}>
          <button type="submit" className="hover:underline">
            Use a different email
          </button>
        </form>
      </div>
    </div>
  )
}

/** Step 3: the code was accepted; choose the new password. */
export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(completePasswordResetAction, {})
  return (
    <div className="space-y-4">
      <FormMessage tone="success">Code accepted. Choose a new password.</FormMessage>
      <form action={action} className="space-y-4">
        <Field label="New password" htmlFor="password" error={state.errors?.password} required>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} autoFocus required />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={state.errors?.confirm} required>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <FormMessage>{state.message}</FormMessage>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Reset password
        </Button>
      </form>
    </div>
  )
}

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, {})
  if (state.ok) {
    return (
      <div className="space-y-4">
        <FormMessage tone="success">{state.message}</FormMessage>
        <Link href="/account" className="font-semibold text-primary-light hover:underline">
          Go to your account →
        </Link>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-4">
      <Field label="New password" htmlFor="password" error={state.errors?.password} required>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={state.errors?.confirm} required>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <FormMessage>{state.message}</FormMessage>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Update password
      </Button>
    </form>
  )
}
