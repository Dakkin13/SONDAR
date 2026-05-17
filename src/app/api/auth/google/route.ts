import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/google
 *
 * Initiates the Google OAuth flow entirely server-side so that the PKCE
 * code_verifier is stored in an HTTP cookie (via @supabase/ssr) rather than
 * in localStorage.
 *
 * This is the correct approach for Next.js App Router: the browser Supabase
 * client (createBrowserClient) stores PKCE in localStorage, but the callback
 * route uses the server client which reads PKCE from cookies — they never
 * match, silently breaking every OAuth attempt.
 *
 * By initiating OAuth here (server-side), Supabase sets the code_verifier
 * cookie in the response, and the existing /auth/callback route can exchange
 * the code correctly.
 *
 * The "Continue with Google" buttons simply link to this route — no JS needed.
 */
export async function GET(request: NextRequest) {
  // Use the Host header so that when accessing via IP on the local network
  // (e.g. http://192.168.1.x:3000) the callback URL matches the actual origin,
  // not "localhost" which the phone can't reach.
  const host  = request.headers.get('host') ?? new URL(request.url).host
  // x-forwarded-proto is set by production reverse proxies (Vercel, etc).
  // In dev it's absent, so fall back to http for any local/private address.
  const isLocal = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  const proto   = request.headers.get('x-forwarded-proto') ?? (isLocal ? 'http' : 'https')
  const origin  = `${proto}://${host}`
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      skipBrowserRedirect: true, // return URL instead of navigating
    },
  })

  if (error || !data?.url) {
    const msg = encodeURIComponent(
      error?.message?.includes('provider') || error?.message?.includes('not enabled')
        ? 'Google sign-in is not configured in your Supabase project.'
        : (error?.message ?? 'Could not start Google sign-in. Try again.'),
    )
    return NextResponse.redirect(`${origin}/login?error=${msg}`)
  }

  // Redirect the browser to Google — the PKCE cookie is already set in the
  // Set-Cookie header of this response by the @supabase/ssr cookie handler.
  return NextResponse.redirect(data.url)
}
