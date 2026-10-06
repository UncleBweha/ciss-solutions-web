import { NextResponse, type NextRequest } from 'next/server'
import { siteUrl } from '@/lib/env'
import { GOOGLE_OAUTH_COOKIE, GOOGLE_OAUTH_COOKIE_PATH, googleRedirectUri } from '@/lib/google-oauth'
import { logger } from '@/lib/logger'
import { serverEnv } from '@/lib/server-env'
import { createClient } from '@/lib/supabase/server'

function readPending(request: NextRequest): { state: string; nonce: string; next: string } | null {
  try {
    const pending = JSON.parse(request.cookies.get(GOOGLE_OAUTH_COOKIE)?.value ?? '')
    return typeof pending.state === 'string' && typeof pending.nonce === 'string' && typeof pending.next === 'string' ? pending : null
  } catch {
    return null
  }
}

// Google sends the customer back here with a one-time code after they pick an account.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const respond = (path: string) => {
    const response = NextResponse.redirect(`${siteUrl}${path}`)
    response.cookies.set(GOOGLE_OAUTH_COOKIE, '', { path: GOOGLE_OAUTH_COOKIE_PATH, maxAge: 0 })
    return response
  }

  const pending = readPending(request)
  const code = searchParams.get('code')
  const { clientId, clientSecret } = serverEnv.google
  if (!pending || !code || searchParams.get('state') !== pending.state || !clientId || !clientSecret) return respond('/login?error=google')

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: googleRedirectUri, grant_type: 'authorization_code' }),
    cache: 'no-store',
  }).catch(() => null)
  const tokens = tokenResponse?.ok ? ((await tokenResponse.json().catch(() => null)) as { id_token?: string } | null) : null
  if (!tokens?.id_token) {
    logger.warn('auth.google_token_exchange_failed', { status: tokenResponse?.status })
    return respond('/login?error=google')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: tokens.id_token, nonce: pending.nonce })
  if (error || !data.user) {
    logger.warn('auth.google_sign_in_failed', { reason: error?.code ?? error?.message })
    return respond('/login?error=google')
  }
  // Staff land on the admin dashboard; customers on their account (or the page they came from).
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  if (profile && profile.role !== 'customer') return respond(pending.next.startsWith('/admin') ? pending.next : '/admin')
  return respond(pending.next)
}
