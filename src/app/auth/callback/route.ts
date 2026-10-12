import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { getEmailProvider } from '@/lib/notifications/email'
import { welcomeEmail } from '@/lib/notifications/templates'
import { createClient } from '@/lib/supabase/server'

/** A confirmation this recent is the click on the sign-up email, not an older account signing in. */
const JUST_CONFIRMED_MS = 5 * 60_000

// Email confirmation links land here with a one-time code. (Password resets use an emailed
// code typed into the site, not a link.)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/account'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/account'
  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const user = data.user
      const confirmedAt = user?.email_confirmed_at ? new Date(user.email_confirmed_at).getTime() : 0
      if (user?.email && Date.now() - confirmedAt < JUST_CONFIRMED_MS) {
        const name = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
        getEmailProvider()
          .send({ to: user.email, ...welcomeEmail(name.split(' ')[0] || 'there') })
          .catch((e) => logger.warn('auth.welcome_email_failed', { error: e }))
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`)
}
