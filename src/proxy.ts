import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isOrderToken, orderTokenCookie } from '@/lib/order-token'

// Refreshes the Supabase session cookie and gates signed-in areas. It runs only on
// routes that depend on the user (see matcher), so cached catalogue pages never
// wait on an auth round trip. Authorisation is re-checked server-side in every
// page and action; this is just the first, cheap gate.
export async function proxy(request: NextRequest) {
  // Order pages: take the guest's access token out of the address (see lib/order-token).
  // They do not depend on the session here, so there is no auth round trip for them.
  if (request.nextUrl.pathname.startsWith('/order/')) {
    const token = request.nextUrl.searchParams.get('t')
    const number = (request.nextUrl.pathname.split('/')[2] ?? '').replace(/%2D/gi, '-')
    // Order numbers are plain (CISS-XXXXXXXX): anything needing decoding is not one.
    if (!token || !/^[A-Za-z0-9_-]+$/.test(number) || !isOrderToken(token)) return NextResponse.next({ request })
    const clean = request.nextUrl.clone()
    clean.searchParams.delete('t')
    const redirect = NextResponse.redirect(clean)
    redirect.cookies.set(orderTokenCookie(number), token, {
      httpOnly: true,
      sameSite: 'lax',
      // Behind the reverse proxy the request itself arrives over http: go by the site's address.
      secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') ?? false,
      path: '/order',
      maxAge: 60 * 60 * 24 * 90,
    })
    return redirect
  }

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
  matcher: ['/account/:path*', '/admin/:path*', '/checkout/:path*', '/order/:path*', '/login', '/register', '/auth/:path*'],
}
