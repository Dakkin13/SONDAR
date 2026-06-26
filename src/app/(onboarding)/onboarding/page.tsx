'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Genre, Instrument, Objective } from '@/types'
import Step1 from '@/components/onboarding/Step1'
import Step2 from '@/components/onboarding/Step2'
import Step3 from '@/components/onboarding/Step3'
import Confirmation from '@/components/onboarding/Confirmation'

type Level = 'beginner' | 'intermediate' | 'advanced' | 'professional'
type Availability = 'weekday-evenings' | 'weekends' | 'flexible'

// Maps form values → DB enum values (objective_type column uses underscores)
function toObjectiveEnum(value: Objective | null): string | null {
  if (!value) return null
  const map: Record<string, string> = {
    'jam':          'casual_jam',
    'casual-jam':   'casual_jam',
    'form-band':    'form_band',
    'record':       'studio_sessions',
    'studio-sessions': 'studio_sessions',
    'perform-live': 'live_gigs',
    'live-gigs':    'live_gigs',
  }
  return map[value] ?? value
}

function validateProfilePayload(payload: Record<string, unknown>): string[] {
  const errors: string[] = []

  if (!payload.id) errors.push('id is missing')
  if (!payload.display_name || payload.display_name === '') errors.push('display_name is empty')
  if (!payload.city || payload.city === '') errors.push('city is empty — user may not have selected a city from the autocomplete')

  if (!Array.isArray(payload.instruments) || (payload.instruments as unknown[]).length === 0)
    errors.push('instruments is empty or not an array')
  if (!Array.isArray(payload.genres) || (payload.genres as unknown[]).length === 0)
    errors.push('genres is empty or not an array')
  if (!Array.isArray(payload.availability))
    errors.push('availability is not an array')

  const validLevels = ['beginner', 'intermediate', 'advanced', 'professional']
  if (!validLevels.includes(payload.level as string))
    errors.push(`level "${String(payload.level)}" is not a valid enum value`)

  const validObjectives = ['casual_jam', 'form_band', 'studio_sessions', 'live_gigs']
  if (!validObjectives.includes(payload.objective as string))
    errors.push(`primary objective "${String(payload.objective)}" is not a valid enum value`)

  const validInstruments = ['guitar', 'bass', 'drums', 'keys', 'vocals', 'violin', 'saxophone', 'trumpet', 'producer', 'dj', 'other']
  const invalidInstruments = (payload.instruments as string[] ?? []).filter((i) => !validInstruments.includes(i))
  if (invalidInstruments.length > 0)
    errors.push(`invalid instrument values: ${invalidInstruments.join(', ')}`)

  if (typeof payload.is_onboarded !== 'boolean')
    errors.push('is_onboarded must be a boolean')

  return errors
}

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
  photoUrls: string[]
  influences: string[]
}


export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('sondar-step', { detail: { step } }))
  }, [step])

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
    photoUrls: [],
    influences: [],
  })

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleCitySelect(name: string, lat: number, lng: number) {
    setForm((prev) => ({ ...prev, city: name, locationLat: lat, locationLng: lng }))
  }

  function go(next: number) {
    setStep(next)
  }

  async function handleFinish() {
    setSaving(true)
    setError(null)
    try {
      // ── Step A: verify session with retry (OAuth sessions can take a moment) ─
      let user = null
      for (let attempts = 0; attempts < 3 && !user; attempts++) {
        const { data: { user: u } } = await supabase.auth.getUser()
        if (u) { user = u; break }
        await new Promise<void>((resolve) => setTimeout(resolve, 500))
      }
      if (!user) {
        await supabase.auth.refreshSession()
        const { data: { user: refreshed } } = await supabase.auth.getUser()
        if (!refreshed) throw new Error('Could not establish session. Please try signing in again.')
        user = refreshed
      }

      // ── Step C: build upsert payload ────────────────────────────────────────
      // city: form.city is updated on every keystroke via CityAutocomplete onChange,
      // so it holds the typed text even if the user never picks from the dropdown.
      // Fall back to '' (matches DB DEFAULT '') rather than null.
      //
      // objective: mapped to DB enum (underscore format) via toObjectiveEnum().
      // instruments/level: already match DB enum exactly — no mapping needed.
      // Excluded: lat, lng, updated_at — not plain columns in this schema.
      const primaryObjective = form.objectives[0] ?? null
      const payload = {
        id:              user.id,
        display_name:   form.displayName || '',
        city:           form.city || '',
        bio:            form.bio || null,
        audio_url:      form.audioLink || null,
        avatar_url:     form.avatarUrl,
        photo_urls:     form.photoUrls,
        instruments:    form.instruments,
        genres:         form.genres,
        objective:      toObjectiveEnum(primaryObjective),
        level:          form.level,
        availability:   form.availability,
        instagram_url:  form.instagramUrl || null,
        is_onboarded:   true,
        influences:     form.influences,
      }

      // ── Step D: validate before hitting the DB ──────────────────────────────
      const validationErrors = validateProfilePayload(payload as Record<string, unknown>)
      if (validationErrors.length > 0) {
        throw new Error('Validation failed:\n' + validationErrors.join('\n'))
      }

      // ── Step E: upsert profile ──────────────────────────────────────────────
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' })

      if (upsertError) throw new Error('Upsert error: ' + upsertError.message)

      // ── Step F: set PostGIS location (separate RPC — geography column) ───────
      // Run this SQL once in Supabase SQL Editor before using:
      //
      //   CREATE OR REPLACE FUNCTION public.set_user_location(user_id uuid, lat float, lng float)
      //   RETURNS void AS $$
      //   BEGIN
      //     UPDATE public.profiles
      //     SET location = ST_MakePoint(lng, lat)::geography
      //     WHERE id = user_id;
      //   END;
      //   $$ LANGUAGE plpgsql SECURITY DEFINER;
      //
      if (form.locationLat !== null && form.locationLng !== null) {
        await supabase.rpc('set_user_location', {
          user_id: user.id,
          lat: form.locationLat,
          lng: form.locationLng,
        })
      }

      // ── Step G: show confirmation then trigger GlobalBackground bloom ─────
      go(4)
      window.dispatchEvent(new CustomEvent('sondar-step', { detail: { step: 'complete' } }))

    } catch (err) {
      console.error('handleFinish failed:', err)
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
      <div className="relative flex flex-col" style={{ zIndex: 1, minHeight: '100dvh' }}>

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
        <div className="fixed left-0 right-0 top-0 z-50 h-[3px] bg-[rgba(240,239,235,0.08)]">
          <motion.div
            className="h-full bg-[#FF5500] shadow-[0_0_8px_rgba(255,85,0,0.6)]"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      )}

      {/* Sign-out link — top-left, only during active steps */}
      {step < TOTAL_STEPS && (
        <button
          type="button"
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
          onTouchEnd={async (e) => { e.preventDefault(); await supabase.auth.signOut(); window.location.href = '/login' }}
          style={{ touchAction: 'manipulation' }}
          className="fixed left-4 top-4 z-50 text-xs text-[rgba(240,239,235,0.28)] hover:text-[rgba(240,239,235,0.6)] transition-colors"
        >
          Sign out
        </button>
      )}

      {/* Step counter */}
      {step < TOTAL_STEPS && (
        <div className="fixed right-4 top-4 z-50 text-xs text-[rgba(240,239,235,0.35)]">
          {step} / {TOTAL_STEPS - 1}
        </div>
      )}

      {/* Step content — plain div, no framer-motion slide (iOS Safari stalls x-transforms) */}
      <div className="flex flex-1 flex-col items-center justify-center px-4"
           style={{ paddingTop: 60, paddingBottom: 100 }}>
        <div className="w-full max-w-lg">
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
              photoUrls={form.photoUrls}
              influences={form.influences}
              onDisplayNameChange={(v) => patch('displayName', v)}
              onCityChange={(v) => patch('city', v)}
              onCitySelect={handleCitySelect}
              onBioChange={(v) => patch('bio', v)}
              onAudioLinkChange={(v) => patch('audioLink', v)}
              onInstagramUrlChange={(v) => patch('instagramUrl', v)}
              onAvatarUrlChange={(v) => patch('avatarUrl', v)}
              onPhotoUrlsChange={(v) => patch('photoUrls', v)}
              onInfluencesChange={(v) => patch('influences', v)}
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
        </div>
      </div>

      {/* Navigation */}
      {step < TOTAL_STEPS && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          {/* Fade gradient so content doesn't hard-clip behind button */}
          <div
            aria-hidden
            className="pointer-events-none h-10"
            style={{ background: 'linear-gradient(to bottom, transparent, #0D0D0D)' }}
          />
          <div className="flex items-center justify-between bg-[#0D0D0D] px-4 pt-3">
            <button
              type="button"
              onClick={() => { if (step > 1) go(step - 1) }}
              onTouchEnd={(e) => { e.preventDefault(); if (step > 1) go(step - 1) }}
              disabled={step === 1}
              style={{ touchAction: 'manipulation' }}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-[rgba(240,239,235,0.45)] transition-opacity hover:text-[#F0EFEB] disabled:opacity-0"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={() => { if (canAdvance && !saving) void (step === 3 ? handleFinish() : go(step + 1)) }}
              onTouchEnd={(e) => { e.preventDefault(); if (canAdvance && !saving) void (step === 3 ? handleFinish() : go(step + 1)) }}
              disabled={!canAdvance || saving}
              style={{ touchAction: 'manipulation' }}
              className="flex h-[52px] items-center rounded-full bg-[#FF5500] px-8 text-base font-semibold text-black shadow-[0_0_16px_rgba(255,85,0,0.35)] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? 'Saving…' : step === 3 ? 'Finish' : 'Continue →'}
            </button>
          </div>
        </div>
      )}

      </div>
    </>
  )
}
