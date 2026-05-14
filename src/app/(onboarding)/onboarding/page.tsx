'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Genre, Instrument, Objective } from '@/types'
import Step1 from '@/components/onboarding/Step1'
import Step2 from '@/components/onboarding/Step2'
import Step3 from '@/components/onboarding/Step3'
import Confirmation from '@/components/onboarding/Confirmation'
import OnboardingBackground from '@/components/onboarding/OnboardingBackground'

type Level = 'beginner' | 'intermediate' | 'advanced' | 'professional'
type Availability = 'weekday-evenings' | 'weekends' | 'flexible'

const TOTAL_STEPS = 4

interface FormState {
  instruments: Instrument[]
  genres: Genre[]
  objectives: Objective[]
  level: Level | null
  availability: Availability[]
  displayName: string
  city: string
  locationLat: number | null
  locationLng: number | null
  bio: string
  audioLink: string
  instagramUrl: string
  avatarUrl: string | null
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '60%' : '-60%',
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? '-60%' : '60%',
    opacity: 0,
  }),
}

const slideTransition = { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const }

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    instruments: [],
    genres: [],
    objectives: [],
    level: null,
    availability: [],
    displayName: '',
    city: '',
    locationLat: null,
    locationLng: null,
    bio: '',
    audioLink: '',
    instagramUrl: '',
    avatarUrl: null,
  })

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleCitySelect(name: string, lat: number, lng: number) {
    setForm((prev) => ({ ...prev, city: name, locationLat: lat, locationLng: lng }))
  }

  function go(next: number) {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  async function handleFinish() {
    setSaving(true)
    setError(null)
    try {
      // ── Step A: verify session ──────────────────────────────────────────────
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw new Error('Auth error: ' + userError.message)
      if (!user) throw new Error('No user found — not authenticated')
      console.log('Step A ok — user id:', user.id)

      // ── Step B: upsert profile ──────────────────────────────────────────────
      // Column names match the DB schema:
      //   city / lat / lng  (not location_name / location_lat / location_lng)
      //   objective         (not objectives)
      //   audio_url         (not audioLink)
      const profileData = {
        id: user.id,
        display_name: form.displayName || null,
        city: form.city || null,
        lat: form.locationLat,
        lng: form.locationLng,
        bio: form.bio || null,
        audio_url: form.audioLink || null,
        avatar_url: form.avatarUrl,
        instruments: form.instruments,
        genres: form.genres,
        objective: form.objectives,
        level: form.level,
        availability: form.availability,
        instagram_url: form.instagramUrl || null,
        is_onboarded: true,
        updated_at: new Date().toISOString(),
      }

      console.log('Step B — saving profile:', profileData)

      const { data: savedProfile, error: upsertError } = await supabase
        .from('profiles')
        .upsert(profileData)
        .select()

      console.log('Step B result:', { savedProfile, upsertError })

      if (upsertError) throw new Error('Upsert error: ' + upsertError.message)
      console.log('Step B ok — profile saved')

      // ── Step C: show confirmation then redirect ─────────────────────────────
      go(4)
      await new Promise<void>((resolve) => setTimeout(resolve, 2000))
      console.log('Step C — redirecting to /explore')
      router.push('/explore')
    } catch (err) {
      console.error('handleFinish failed:', err)
      // Supabase errors are PostgrestError (not Error instances) — extract message regardless
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const canAdvance =
    step === 1
      ? form.instruments.length > 0
      : step === 2
        ? form.objectives.length > 0 && form.level !== null
        : step === 3
          ? form.displayName.trim().length > 0
          : true

  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100

  return (
    <>
      {/* Canvas lives outside the content wrapper so it's in the root stacking
          context at z-0; the wrapper below sits at z-1 above it. */}
      <OnboardingBackground currentStep={step} />

      <div className="relative flex min-h-screen flex-col" style={{ zIndex: 1 }}>

      {/* Full-width error banner — always visible when something fails */}
      {error && (
        <div className="fixed left-0 right-0 top-0 z-[100] bg-red-950 px-4 py-3 text-center">
          <p className="text-sm font-medium text-red-300 break-words">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-1 text-xs text-red-400 underline hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Progress bar */}
      {step < TOTAL_STEPS && (
        <div className="fixed left-0 right-0 top-0 z-50 h-[2px] bg-[rgba(240,239,235,0.08)]">
          <motion.div
            className="h-full bg-[#FF5500] shadow-[0_0_8px_rgba(255,85,0,0.6)]"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      )}

      {/* Step counter */}
      {step < TOTAL_STEPS && (
        <div className="fixed right-4 top-4 z-50 text-xs text-[rgba(240,239,235,0.35)]">
          {step} / {TOTAL_STEPS - 1}
        </div>
      )}

      {/* Step content */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
            >
              {step === 1 && (
                <Step1
                  instruments={form.instruments}
                  genres={form.genres}
                  onInstrumentsChange={(v) => patch('instruments', v)}
                  onGenresChange={(v) => patch('genres', v)}
                />
              )}
              {step === 2 && (
                <Step2
                  objectives={form.objectives}
                  level={form.level}
                  availability={form.availability}
                  onObjectivesChange={(v) => patch('objectives', v)}
                  onLevelChange={(v) => patch('level', v)}
                  onAvailabilityChange={(v) => patch('availability', v)}
                />
              )}
              {step === 3 && (
                <Step3
                  displayName={form.displayName}
                  city={form.city}
                  bio={form.bio}
                  audioLink={form.audioLink}
                  instagramUrl={form.instagramUrl}
                  avatarUrl={form.avatarUrl}
                  onDisplayNameChange={(v) => patch('displayName', v)}
                  onCityChange={(v) => patch('city', v)}
                  onCitySelect={handleCitySelect}
                  onBioChange={(v) => patch('bio', v)}
                  onAudioLinkChange={(v) => patch('audioLink', v)}
                  onInstagramUrlChange={(v) => patch('instagramUrl', v)}
                  onAvatarUrlChange={(v) => patch('avatarUrl', v)}
                />
              )}
              {step === 4 && (
                <Confirmation
                  displayName={form.displayName}
                  city={form.city}
                  bio={form.bio}
                  instruments={form.instruments}
                  genres={form.genres}
                  objectives={form.objectives}
                  avatarUrl={form.avatarUrl}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      {step < TOTAL_STEPS && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-[rgba(240,239,235,0.06)] bg-[rgba(13,13,13,0.9)] px-4 py-4 backdrop-blur-md">
          <button
            onClick={() => go(step - 1)}
            disabled={step === 1}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-[rgba(240,239,235,0.45)] transition-opacity hover:text-[#F0EFEB] disabled:opacity-0"
          >
            ← Back
          </button>

          <button
            onClick={step === 3 ? handleFinish : () => go(step + 1)}
            disabled={!canAdvance || saving}
            className="rounded-xl bg-[#FF5500] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_0_16px_rgba(255,85,0,0.35)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? 'Saving…' : step === 3 ? 'Finish' : 'Continue →'}
          </button>
        </div>
      )}

      </div>
    </>
  )
}
