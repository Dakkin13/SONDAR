import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Routes that require an authenticated session
const PROTECTED = ['/home', '/explore', '/messages', '/settings', '/profile']

export async function proxy(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request })
  }

  const { pathname } = request.nextUrl

  // Always pass OAuth callbacks and API routes through unchanged
  if (pathname.startsWith('/auth/') || pathname.startsWith('/api/')) {
    return NextResponse.next({ request })
  }

  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            )
          },
        },
      },
    )

    // getUser() validates the JWT against Supabase Auth — never use getSession() here
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // ── Unauthenticated ───────────────────────────────────────────────────────
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

    // ── Authenticated — check onboarding status for routes that need it ───────
    const onLogin      = pathname === '/login'
    const onOnboarding = pathname === '/onboarding' || pathname.startsWith('/onboarding/')
    const onProtected  = PROTECTED.some((r) => pathname === r || pathname.startsWith(`${r}/`))

    if (onLogin || onOnboarding || onProtected) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_onboarded')
        .eq('id', user.id)
        .single()

      const completed = profile?.is_onboarded === true

      if ((onLogin || onOnboarding) && completed) {
        const url = request.nextUrl.clone()
        url.pathname = '/home'
        return NextResponse.redirect(url)
      }

      if (onLogin && !completed) {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }

      if (onProtected && !completed) {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }
    }

    return supabaseResponse
  } catch (err) {
    // If anything goes wrong (network, DB, etc.) just let the request through
    // rather than breaking the whole page.
    console.error('[middleware] error:', err)
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
