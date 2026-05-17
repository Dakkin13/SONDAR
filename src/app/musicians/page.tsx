'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export default function ForMusiciansPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-5" style={{ zIndex: 1 }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass-apple w-full max-w-md p-8 text-center"
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(240,239,235,0.3)]">
          For Musicians
        </p>
        <h1
          className="mb-3 leading-none tracking-[0.04em] text-[#F0EFEB]"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 8vw, 56px)' }}
        >
          For Musicians
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-[rgba(240,239,235,0.5)]">
          Coming soon — we&apos;re working on this.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-[rgba(240,239,235,0.4)] transition-colors hover:text-[#F0EFEB]"
        >
          ← Back to Sondar
        </Link>
      </motion.div>
    </main>
  )
}
