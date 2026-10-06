import 'server-only'
import { siteUrl } from '@/lib/env'
import { serverEnv } from '@/lib/server-env'

// The store talks to Google itself and hands the resulting ID token to Supabase, so Google's
// consent screen names this site rather than the Supabase project.
export const isGoogleSignInConfigured = Boolean(serverEnv.google.clientId && serverEnv.google.clientSecret)

/** Must be listed under "Authorised redirect URIs" on the Google OAuth client. */
export const googleRedirectUri = `${siteUrl}/auth/google/callback`

/** Holds the state, nonce and post-sign-in destination while the customer is away at Google. */
export const GOOGLE_OAUTH_COOKIE = 'ciss_google_oauth'
export const GOOGLE_OAUTH_COOKIE_PATH = '/auth/google'
