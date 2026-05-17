import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resend, FROM_EMAIL, SITE_URL } from '@/lib/email/resend'
import { welcomeEmail } from '@/lib/email/templates'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_onboarded, display_name')
    .eq('id', user.id)
    .single()

  // ── Send welcome email on the very first login ──────────────────────────────
  // is_onboarded is false/null on first login — use that as the "new user" signal.
  if (!profile?.is_onboarded && user.email && process.env.RESEND_API_KEY) {
    const firstName = profile?.display_name?.split(' ')[0]
      ?? user.email.split('@')[0]
      ?? 'there'

    const { subject, html } = welcomeEmail({
      firstName,
      ctaUrl: `${SITE_URL}/onboarding`,
    })

    // Fire-and-forget — don't block the redirect if email fails
    void resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject,
      html,
    }).catch(err => console.error('[welcome email]', err))
  }

  if (!profile?.is_onboarded) {
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  return NextResponse.redirect(`${origin}/home`)
}
