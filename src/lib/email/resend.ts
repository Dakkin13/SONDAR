import { Resend } from 'resend'

// Single shared Resend client — set RESEND_API_KEY in .env.local.
// The Resend constructor throws synchronously when its key is missing, and
// Next's build imports every route module (even dynamic ones) while
// collecting page data — so without a fallback here, `next build` fails
// outright in any environment that doesn't have RESEND_API_KEY set (CI,
// local dev without .env.local configured for email, etc). The placeholder
// is never actually used to send anything: every call site also checks
// `process.env.RESEND_API_KEY` before calling `resend.emails.send()`.
export const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder_not_configured')

// Sender address — must be a domain you've verified in Resend dashboard.
// While testing before you have a domain, use: onboarding@resend.dev
export const FROM_EMAIL = process.env.FROM_EMAIL ?? 'Sondar <onboarding@resend.dev>'
export const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sondar.app'
