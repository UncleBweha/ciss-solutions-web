import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Refreshes the Supabase session cookie and gates signed-in areas. It runs only on
// routes that depend on the user (see matcher), so cached catalogue pages never
// wait on an auth round trip. Authorisation is re-checked server-side in every
// page and action; this is just the first, cheap gate.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl
  const needsAuth = pathname.startsWith('/account') || pathname.startsWith('/admin')
  if (needsAuth && !user) {
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.search = `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(login)
  }

  return response
}

export const config = {
  matcher: ['/account/:path*', '/admin/:path*', '/checkout/:path*', '/login', '/register', '/auth/:path*'],
}
