'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordResetAction, signInAction, signUpAction, updatePasswordAction } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Field, FormMessage, Input } from '@/components/ui/form'

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
        <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="0712 345 678" />
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

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, {})
  if (state.ok) return <FormMessage tone="success">{state.message}</FormMessage>
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email" error={state.errors?.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <FormMessage>{state.message}</FormMessage>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Send reset link
      </Button>
    </form>
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
