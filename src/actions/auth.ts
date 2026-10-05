'use server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { siteUrl, supabaseAnonKey, supabaseUrl } from '@/lib/env'
import { logger } from '@/lib/logger'
import { getEmailProvider } from '@/lib/notifications/email'
import { welcomeEmail } from '@/lib/notifications/templates'
import { clientIp, rateLimit } from '@/lib/security'
import { createClient } from '@/lib/supabase/server'
import { fieldErrors, optionalKenyanPhone, type FormState } from '@/lib/validation/forms'

/** Only same-site relative paths are allowed as post-login destinations. */
function safeNext(value: FormDataEntryValue | null, fallback = '/account') {
  const next = typeof value === 'string' ? value : ''
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : fallback
}

const password = z.string().min(8, 'Use at least 8 characters').max(72)

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp()
  if (!(await rateLimit(`login:${ip}`, 10, 600))) return { message: 'Too many sign-in attempts. Please wait 10 minutes.' }
  const parsed = z.object({ email: z.string().trim().email('Enter your email'), password: z.string().min(1, 'Enter your password') }).safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    logger.warn('auth.sign_in_failed', { reason: error.code ?? error.message })
    return { message: error.code === 'email_not_confirmed' ? 'Please confirm your email address first (check your inbox).' : 'Incorrect email or password.' }
  }
  redirect(safeNext(formData.get('next')))
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp()
  if (!(await rateLimit(`signup:${ip}`, 5, 3600))) return { message: 'Too many sign-up attempts. Please try again later.' }
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, 'Enter your name').max(100),
      email: z.string().trim().toLowerCase().email('Enter a valid email'),
      phone: optionalKenyanPhone,
      password,
    })
    .safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, phone: parsed.data.phone ?? '' },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/account`,
    },
  })
  if (error) {
    logger.warn('auth.sign_up_failed', { reason: error.code ?? error.message })
    return { message: error.code === 'weak_password' ? 'Choose a stronger password.' : 'We could not create your account. If you already have one, sign in instead.' }
  }
  getEmailProvider()
    .send({ to: parsed.data.email, ...welcomeEmail(parsed.data.fullName.split(' ')[0]) })
    .catch((e) => logger.warn('auth.welcome_email_failed', { error: e }))
  if (!data.session) return { ok: true, message: 'Check your email to confirm your account, then sign in.' }
  redirect(safeNext(formData.get('next')))
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp()
  if (!(await rateLimit(`reset:${ip}`, 5, 3600))) return { message: 'Too many requests. Please try again later.' }
  const email = z.string().trim().email().safeParse(formData.get('email'))
  if (!email.success) return { errors: { email: 'Enter a valid email' } }
  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password` })
  // Same answer whether or not the account exists.
  return { ok: true, message: 'If an account exists for that email, we have sent a link to reset your password.' }
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })
    .safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { message: 'Your reset link has expired. Request a new one.' }
  return { ok: true, message: 'Your password has been updated.' }
}

/**
 * Google sign-in through Supabase OAuth (PKCE). The provider sends the user back
 * to /auth/callback, which exchanges the code for a session. New Google users get
 * a profile from the same handle_new_user trigger as email sign-ups.
 */
export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const next = safeNext(formData.get('next'))
  const ip = await clientIp()
  if (!(await rateLimit(`login:${ip}`, 10, 600))) redirect('/login?error=rate')
  // signInWithOAuth only builds a URL; check the provider is really on so customers
  // never land on Supabase's raw "provider is not enabled" error.
  if (!(await googleProviderEnabled())) {
    logger.warn('auth.google_disabled')
    redirect(`/login?error=google${next !== '/account' ? `&next=${encodeURIComponent(next)}` : ''}`)
  }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error || !data.url) {
    logger.warn('auth.google_start_failed', { reason: error?.code ?? error?.message ?? 'no_url' })
    redirect(`/login?error=google${next !== '/account' ? `&next=${encodeURIComponent(next)}` : ''}`)
  }
  redirect(data.url)
}

async function googleProviderEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return false
    const settings = (await res.json()) as { external?: { google?: boolean } }
    return settings.external?.google === true
  } catch {
    return false
  }
}
