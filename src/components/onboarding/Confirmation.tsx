'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import type { Genre, Instrument, Objective } from '@/types'

interface ConfirmationProps {
  displayName: string
  city: string
  bio: string
  instruments: Instrument[]
  genres: Genre[]
  objectives: Objective[]
  avatarUrl: string | null
}

const OBJECTIVE_LABELS: Record<Objective, string> = {
  jam: 'Casual jam',
  'form-band': 'Form a band',
  record: 'Studio sessions',
  'perform-live': 'Live gigs',
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
}

export default function Confirmation({
  displayName,
  city,
  bio,
  instruments,
  genres,
  objectives,
  avatarUrl,
}: ConfirmationProps) {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center gap-3"
      >
        <motion.p
          variants={fadeUp}
          className="text-sm uppercase tracking-[0.2em] text-[rgba(240,239,235,0.45)]"
        >
          You&apos;re all set
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="text-[#F0EFEB] md:text-7xl"
          style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: 72,
            lineHeight: 1,
            textShadow: '0 0 80px rgba(255,85,0,0.55)',
            letterSpacing: '0.04em',
          }}
        >
          You&apos;re in.
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="text-[rgba(240,239,235,0.55)]"
        >
          Your profile is ready. Go find your people.
        </motion.p>
      </motion.div>

      {/* Profile card preview */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        className="glass w-full max-w-sm overflow-hidden"
      >
        <div className="flex items-start gap-4 p-5">
          {/* Avatar */}
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#1C1C1C]">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl">
                🎵
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#F0EFEB]">
              {displayName || 'Your name'}
            </p>
            {city && (
              <p className="text-xs text-[rgba(240,239,235,0.45)]">{city}</p>
            )}
            {bio && (
              <p className="mt-1 line-clamp-2 text-xs text-[rgba(240,239,235,0.6)]">
                {bio}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        {(instruments.length > 0 || genres.length > 0) && (
          <div className="border-t border-[rgba(240,239,235,0.06)] px-5 py-3">
            <div className="flex flex-wrap gap-1.5">
              {instruments.slice(0, 4).map((i) => (
                <span
                  key={i}
                  className="rounded-full bg-[rgba(255,85,0,0.15)] px-2.5 py-0.5 text-xs text-[#FF5500]"
                >
                  {i}
                </span>
              ))}
              {genres.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-[rgba(240,239,235,0.06)] px-2.5 py-0.5 text-xs text-[rgba(240,239,235,0.55)]"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Objectives */}
        {objectives.length > 0 && (
          <div className="border-t border-[rgba(240,239,235,0.06)] px-5 py-3">
            <p className="text-xs text-[rgba(240,239,235,0.35)]">Looking for</p>
            <p className="mt-0.5 text-xs text-[rgba(240,239,235,0.7)]">
              {objectives.map((o) => OBJECTIVE_LABELS[o]).join(' · ')}
            </p>
          </div>
        )}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        onClick={() => router.push('/explore')}
        className="w-full max-w-sm rounded-xl bg-[#FF5500] py-4 font-semibold text-black shadow-[0_0_48px_rgba(255,85,0,0.5)] transition-opacity hover:opacity-90 active:opacity-80"
        style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 16 }}
      >
        Find musicians near you →
      </motion.button>
    </div>
  )
}
