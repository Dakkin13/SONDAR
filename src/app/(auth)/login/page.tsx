'use client'

import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0D0D0D] px-4">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[600px] w-[600px] rounded-full bg-[#FF5500] opacity-[0.06] blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-8"
      >
        {/* Wordmark */}
        <div className="flex flex-col items-center gap-3">
          <h1
            className="text-[clamp(5rem,20vw,10rem)] leading-none tracking-widest text-[#F0EFEB]"
            style={{
              fontFamily: 'var(--font-bebas)',
              textShadow:
                '0 0 80px rgba(255,85,0,0.5), 0 0 160px rgba(255,85,0,0.2)',
            }}
          >
            SONUS
          </h1>
          <p
            className="text-sm tracking-[0.2em] text-[rgba(240,239,235,0.45)] uppercase"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Find your people. Make noise.
          </p>
        </div>

        {/* Glass card */}
        <div className="glass flex w-full max-w-xs flex-col items-center gap-4 px-6 py-8">
          <button
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#F0EFEB] px-5 py-3 text-sm font-semibold text-[#0D0D0D] transition-opacity hover:opacity-90 active:opacity-80"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>
      </motion.div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}
