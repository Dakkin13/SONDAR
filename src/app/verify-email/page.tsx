'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

export default function VerifyEmailPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      if (user.email_confirmed_at) { router.push('/home'); return }
      setEmail(user.email ?? null)
    }
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleResend() {
    if (!email || resending) return
    setResending(true)
    await supabase.auth.resend({ type: 'signup', email })
    setResent(true)
    setResending(false)
  }

  async function handleCheckNow() {
    setChecking(true)
    await supabase.auth.refreshSession()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email_confirmed_at) {
      router.push('/home')
    } else {
      setChecking(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md text-center"
      >
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(255,92,0,0.08)', border: '1px solid rgba(255,92,0,0.2)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FF5C00" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>

        <h1 className="mb-2 text-[#F0EFEB]"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 36, letterSpacing: '0.06em' }}>
          CHECK YOUR EMAIL
        </h1>

        <p className="mb-1 text-[rgba(240,239,235,0.55)] text-sm leading-relaxed">
          We sent a confirmation link to
        </p>
        {email && (
          <p className="mb-6 font-semibold text-[#F0EFEB]">{email}</p>
        )}
        <p className="mb-8 text-[13px] text-[rgba(240,239,235,0.35)] leading-relaxed">
          Click the link in your email to verify your account and start connecting with musicians.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => void handleCheckNow()}
            disabled={checking}
            className="w-full rounded-full bg-[#FF5500] py-3.5 text-sm font-semibold text-black shadow-[0_0_24px_rgba(255,85,0,0.3)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {checking ? 'Checking…' : "I've verified my email →"}
          </button>

          <button
            onClick={() => void handleResend()}
            disabled={resending || resent}
            className="w-full rounded-full py-3 text-sm font-medium text-[rgba(240,239,235,0.5)] transition-colors hover:text-[#F0EFEB] disabled:opacity-50"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {resent ? '✓ Email resent' : resending ? 'Sending…' : 'Resend email'}
          </button>

          <button
            onClick={() => void supabase.auth.signOut().then(() => router.push('/login'))}
            className="text-xs text-[rgba(240,239,235,0.25)] underline hover:text-[rgba(240,239,235,0.5)]"
          >
            Sign out
          </button>
        </div>
      </motion.div>
    </main>
  )
}
