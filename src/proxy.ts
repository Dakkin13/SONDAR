import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Routes that require an authenticated session
const PROTECTED = ['/explore', '/messages', '/settings']

export async function proxy(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request })
  }

  const { pathname } = request.nextUrl

  // Always pass OAuth callbacks through — Supabase needs to set session cookies
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, extraHeaders) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
          Object.entries(extraHeaders ?? {}).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          )
        },
      },
    },
  )

  // getUser() validates the JWT against Supabase Auth — never use getSession() here
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Unauthenticated ─────────────────────────────────────────────────────────
  if (!user) {
    const isProtected = PROTECTED.some(
      (r) => pathname === r || pathname.startsWith(`${r}/`),
    )
    if (isProtected) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // ── Authenticated — check onboarding status for routes that need it ─────────
  const onOnboarding = pathname === '/onboarding' || pathname.startsWith('/onboarding/')
  const onProtected  = PROTECTED.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  if (onOnboarding || onProtected) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_onboarded')
      .eq('id', user.id)
      .single()

    console.log('[middleware] profile for', user.id, '→', profile)

    const completed = profile?.is_onboarded === true

    if (onOnboarding && completed) {
      // Already onboarded — send them to the app
      const url = request.nextUrl.clone()
      url.pathname = '/explore'
      return NextResponse.redirect(url)
    }

    if (onProtected && !completed) {
      // Authenticated but profile not complete yet
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
