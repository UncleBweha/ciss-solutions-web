import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Email confirmation, password recovery and Google sign-in land here with a one-time code.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/account'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/account'
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  // An OAuth provider reports a cancelled or refused sign-in as ?error=...
  const failure = searchParams.get('error') ? 'google' : 'link'
  return NextResponse.redirect(`${origin}/login?error=${failure}`)
}
