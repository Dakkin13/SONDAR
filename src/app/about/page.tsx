'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import MarketingNav from '@/components/ui/MarketingNav'

export default function AboutPage() {
  return (
    <main
      className="relative text-[#F0EFEB]"
      style={{ minHeight: '100dvh', zIndex: 1, fontFamily: 'var(--font-dm-sans)' }}
    >
      <MarketingNav alwaysScrolled />

      {/* Ambient orbs */}
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }}>
        <div className="absolute right-0 top-0"
          style={{ width: 600, height: 600, background: 'radial-gradient(circle at 80% 15%, rgba(255,85,0,0.18) 0%, transparent 60%)', borderRadius: '50%' }} />
        <div className="absolute bottom-0 left-0"
          style={{ width: 500, height: 500, background: 'radial-gradient(circle at 20% 85%, rgba(91,33,182,0.15) 0%, transparent 60%)', borderRadius: '50%' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-5 pt-20 pb-24 sm:pb-32">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(240,239,235,0.3)]">
            Why this exists
          </p>
          <h1
            className="mb-4 leading-none tracking-[0.03em] text-[#F0EFEB]"
            style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(48px, 10vw, 80px)' }}
          >
            MUSIC IS EASIER WHEN THE RIGHT PEOPLE CAN FIND EACH OTHER.
          </h1>
          <div className="h-px w-16 bg-[#FF5500]" />
        </motion.div>

        {/* Body */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6 text-base leading-relaxed text-[rgba(240,239,235,0.6)]"
        >
          <p>
            This platform was built to make that happen — to help musicians meet, form bands,
            and find spaces where they can actually play.
          </p>

          <p>
            What started as a personal frustration became a bigger idea: a place where musicians
            can build real connections, not just profiles.
          </p>

          <div className="glass rounded-2xl p-6 my-8">
            <p className="text-[10px] tracking-[0.22em] uppercase text-[rgba(240,239,235,0.3)] mb-3">
              The story
            </p>
            <p className="text-[rgba(240,239,235,0.75)] leading-relaxed">
              I&apos;ve played in several bands, and I&apos;ve experienced firsthand how difficult it can
              be to find the right people — especially abroad, where you&apos;re starting from zero
              and don&apos;t know anyone. That experience shaped the vision behind Sondar: not just
              an app, but a community for musicians who are trying to create something together.
            </p>
          </div>

          <p>
            I&apos;m 19, from Spain, and this comes from a genuine place — wanting to make that
            process simpler, faster, and more human.
          </p>

          <p>
            At its core, Sondar is about community. Turning isolated musicians into bands,
            rehearsals, and actual music. Because the people you need are already in your city —
            they just can&apos;t find you yet.
          </p>
        </motion.div>

        {/* Quote */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 border-l-2 border-[#FF5500] pl-5"
        >
          <p className="text-lg font-medium italic text-[rgba(240,239,235,0.55)] leading-relaxed">
            &ldquo;Not just an app. A community for musicians who are trying to create something
            together.&rdquo;
          </p>
        </motion.div>

        {/* Signature */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.42 }}
          className="mt-10 flex items-center gap-3"
        >
          <div className="h-px flex-1 bg-[rgba(240,239,235,0.07)]" />
          <div className="text-right">
            <p className="text-sm font-medium text-[rgba(240,239,235,0.5)]">Founder, Sondar</p>
            <p className="text-[11px] tracking-[0.12em] text-[rgba(240,239,235,0.25)]">Spain · Est. 2026</p>
          </div>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'rgba(255,85,0,0.10)', border: '1px solid rgba(255,85,0,0.25)' }}
          >
            <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 16, color: '#FF5500', letterSpacing: '0.05em' }}>S</span>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-14 flex flex-col items-start gap-3 sm:flex-row sm:items-center"
        >
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-full bg-[#FF5500] px-6 py-3 text-sm font-semibold text-black shadow-[0_0_28px_rgba(255,85,0,0.35)] transition-opacity hover:opacity-90"
          >
            Join Sondar — it&apos;s free →
          </Link>
          <Link
            href="/"
            className="text-sm text-[rgba(240,239,235,0.35)] transition-colors hover:text-[rgba(240,239,235,0.7)]"
          >
            Back to home
          </Link>
        </motion.div>
      </div>
    </main>
  )
}
