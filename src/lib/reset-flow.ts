import 'server-only'
import { cookies } from 'next/headers'

/**
 * Where a customer is in "forgot password": waiting to enter the emailed code, or (code
 * accepted) choosing a new password. Kept in a short-lived httpOnly cookie rather than in
 * the page's own state, because the page is re-rendered after each step and after the
 * sign-in the code performs, and must come back on the right step every time.
 */
export type ResetFlow = { email: string; stage: 'code' | 'password' }

const COOKIE = 'ciss_reset'
/** A little longer than the code itself lives, to leave time to type the new password. */
const MAX_AGE_SECONDS = 30 * 60

export async function readResetFlow(): Promise<ResetFlow | null> {
  const raw = (await cookies()).get(COOKIE)?.value
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<ResetFlow>
    if (typeof value.email === 'string' && (value.stage === 'code' || value.stage === 'password')) return { email: value.email, stage: value.stage }
  } catch {
    // not ours
  }
  return null
}

export async function writeResetFlow(flow: ResetFlow) {
  ;(await cookies()).set(COOKIE, JSON.stringify(flow), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/forgot-password',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function clearResetFlow() {
  ;(await cookies()).set(COOKIE, '', { path: '/forgot-password', maxAge: 0 })
}
