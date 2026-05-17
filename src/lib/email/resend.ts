import { Resend } from 'resend'

// Single shared Resend client — set RESEND_API_KEY in .env.local
export const resend = new Resend(process.env.RESEND_API_KEY)

// Sender address — must be a domain you've verified in Resend dashboard.
// While testing before you have a domain, use: onboarding@resend.dev
export const FROM_EMAIL = process.env.FROM_EMAIL ?? 'Sondar <onboarding@resend.dev>'
export const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sondar.app'
