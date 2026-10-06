'use server'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { siteUrl } from '@/lib/env'
import { GOOGLE_OAUTH_COOKIE, GOOGLE_OAUTH_COOKIE_PATH, googleRedirectUri } from '@/lib/google-oauth'
import { logger } from '@/lib/logger'
import { getEmailProvider } from '@/lib/notifications/email'
import { welcomeEmail } from '@/lib/notifications/templates'
import { clientIp, rateLimit } from '@/lib/security'
import { serverEnv } from '@/lib/server-env'
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
  if (!(await rateLimit(`login:${ip}`, 300, 600))) return { message: 'Too many sign-in attempts. Please wait 10 minutes.' }
  const parsed = z.object({ email: z.string().trim().email('Enter your email'), password: z.string().min(1, 'Enter your password') }).safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  if (!(await rateLimit(`login-email:${parsed.data.email.toLowerCase()}`, 10, 600))) return { message: 'Too many sign-in attempts. Please wait 10 minutes.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    logger.warn('auth.sign_in_failed', { reason: error.code ?? error.message })
    return { message: error.code === 'email_not_confirmed' ? 'Please confirm your email address first (check your inbox).' : 'Incorrect email or password.' }
  }
  // Staff land on the admin dashboard; customers on their account (or the page they came from).
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  const next = safeNext(formData.get('next'))
  if (profile && profile.role !== 'customer') redirect(next.startsWith('/admin') ? next : '/admin')
  redirect(next)
}

/** Starts the Google sign-in: sends the browser to Google, which returns to /auth/google/callback. */
export async function signInWithGoogleAction(formData: FormData) {
  const ip = await clientIp()
  const clientId = serverEnv.google.clientId
  if (!clientId || !(await rateLimit(`login:${ip}`, 300, 600))) redirect('/login?error=google')

  const state = randomBytes(16).toString('hex')
  const nonce = randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set(GOOGLE_OAUTH_COOKIE, JSON.stringify({ state, nonce, next: safeNext(formData.get('next')) }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: siteUrl.startsWith('https://'),
    path: GOOGLE_OAUTH_COOKIE_PATH,
    maxAge: 600,
  })
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    // Supabase checks the ID token against the SHA-256 of the nonce it is given.
    nonce: createHash('sha256').update(nonce).digest('hex'),
    prompt: 'select_account',
  })
  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp()
  if (!(await rateLimit(`signup:${ip}`, 60, 3600))) return { message: 'Too many sign-up attempts. Please try again later.' }
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
  if (!(await rateLimit(`reset:${ip}`, 60, 3600))) return { message: 'Too many requests. Please try again later.' }
  const email = z.string().trim().email().safeParse(formData.get('email'))
  if (!email.success) return { errors: { email: 'Enter a valid email' } }
  if (!(await rateLimit(`reset-email:${email.data.toLowerCase()}`, 3, 3600))) return { message: 'Too many requests. Please try again later.' }
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
