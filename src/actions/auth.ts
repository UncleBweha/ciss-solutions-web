'use server'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { siteUrl } from '@/lib/env'
import { GOOGLE_OAUTH_COOKIE, GOOGLE_OAUTH_COOKIE_PATH, googleRedirectUri } from '@/lib/google-oauth'
import { logger } from '@/lib/logger'
import { getEmailProvider } from '@/lib/notifications/email'
import { passwordResetEmail, RESET_CODE_MINUTES, welcomeEmail } from '@/lib/notifications/templates'
import { clientIp, rateLimit } from '@/lib/security'
import { serverEnv } from '@/lib/server-env'
import { createAdminClient } from '@/lib/supabase/admin'
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
  // This device only: signing out here must not sign the same person out on their other devices.
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/')
}

/** When the latest reset code for this email was issued, or null if there is none. */
async function resetCodeIssuedAt(email: string): Promise<number | null> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id').ilike('email', email.replace(/[\\%_]/g, '\\$&')).maybeSingle()
  if (!profile) return null
  const { data } = await admin.auth.admin.getUserById(profile.id)
  const sentAt = data.user?.recovery_sent_at
  return sentAt ? new Date(sentAt).getTime() : null
}

/** Step 1: email a one-time code. Says the same thing whether or not the account exists. */
export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp()
  if (!(await rateLimit(`reset:${ip}`, 60, 3600))) return { message: 'Too many requests. Please try again later.' }
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get('email'))
  if (!email.success) return { errors: { email: 'Enter a valid email' } }
  if (!(await rateLimit(`reset-email:${email.data}`, 6, 3600))) return { message: 'Too many requests. Please try again later.' }

  // Supabase creates the code and emails it with the project's "Reset password" template and
  // SMTP settings (sender, {{ .Token }} in the body). See docs/DEPLOYMENT.md, "Password reset codes".
  const admin = createAdminClient()
  const { error } = await admin.auth.resetPasswordForEmail(email.data)
  if (error) {
    // Supabase could not send (its SMTP settings, or its hourly limit). So that nobody is locked
    // out, make the code here and send it through the store's own mailbox instead.
    logger.error('auth.reset_email_failed', { via: 'supabase', error: error.message })
    const { data } = await admin.auth.admin.generateLink({ type: 'recovery', email: email.data })
    const code = data?.properties?.email_otp
    if (code) {
      await getEmailProvider()
        .send({ to: email.data, from: serverEnv.email.noReplyFrom, ...passwordResetEmail(code) })
        .catch((e) => logger.error('auth.reset_email_failed', { via: 'store', error: e }))
    }
  }
  return { ok: true, message: `If an account exists for ${email.data}, we have emailed it a code. It is valid for ${RESET_CODE_MINUTES} minutes.` }
}

/** Step 2: check the emailed code. A valid code signs the customer in, ready to choose a password. */
export async function verifyResetCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp()
  if (!(await rateLimit(`reset-code:${ip}`, 30, 900))) return { message: 'Too many attempts. Please try again later.' }
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email(),
      code: z.string().trim().regex(/^\d{6,10}$/, 'Enter the code from the email'),
    })
    .safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  // A handful of guesses per code, so it cannot be brute-forced inside its 15 minutes.
  if (!(await rateLimit(`reset-code-email:${parsed.data.email}`, 6, 900))) return { message: 'Too many attempts. Request a new code.' }

  const expired = { errors: { code: 'That code is wrong or has expired. Request a new one.' } }
  const issuedAt = await resetCodeIssuedAt(parsed.data.email)
  if (!issuedAt || Date.now() - issuedAt > RESET_CODE_MINUTES * 60_000) return expired

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.code, type: 'recovery' })
  if (error) return expired
  return { ok: true }
}

/** Step 3: the new password, for the session the code just opened. */
export async function completePasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })
    .safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { message: 'We could not save that password. Request a new code and try again.' }
  redirect('/account')
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })
    .safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { message: 'We could not update your password. Sign in again and retry.' }
  return { ok: true, message: 'Your password has been updated.' }
}
