'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ArtistResult {
  name: string
  imageUrl: string | null
}

interface Props {
  onClose: () => void
  onComplete: () => void
}

const YEARS_OPTIONS = [
  { value: 'less-than-1', label: 'Less than a year' },
  { value: '1-3',         label: '1–3 years'        },
  { value: '3-5',         label: '3–5 years'        },
  { value: '5-plus',      label: '5+ years'          },
]

const AGE_OPTIONS = [
  { value: '18-30', label: '18–30' },
  { value: '31-40', label: '31–40' },
  { value: '41-50', label: '41–50' },
  { value: '50+',   label: '50+'   },
]

const BAND_OPTIONS = [
  { value: 'never',           label: 'Never'                  },
  { value: 'a-few-jams',      label: 'A few jams'             },
  { value: 'one-or-more',     label: 'One or more bands'      },
  { value: 'currently-in',    label: 'Currently in a band'    },
]

const LASTFM_KEY = process.env.NEXT_PUBLIC_LASTFM_API_KEY ?? ''

async function searchArtists(q: string): Promise<ArtistResult[]> {
  if (!q.trim()) return []
  try {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(q)}&limit=5&fmt=json`,
      { headers: { 'User-Agent': 'Sondar/1.0 (contact@sondar.app)' } },
    )
    const data = await res.json()
    const artists: ArtistResult[] = (data.artists ?? []).map((a: { name: string }) => ({
      name: a.name,
      imageUrl: null,
    }))

    // Fetch Last.fm images in parallel (best-effort)
    if (LASTFM_KEY) {
      await Promise.all(
        artists.map(async (artist) => {
          try {
            const r = await fetch(
              `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artist.name)}&api_key=${LASTFM_KEY}&format=json`,
            )
            const d = await r.json()
            const img = d?.artist?.image?.[2]?.['#text']
            if (img && !img.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
              artist.imageUrl = img
            }
          } catch {}
        }),
      )
    }

    return artists
  } catch {
    return []
  }
}

export default function CompleteProfileModal({ onClose, onComplete }: Props) {
  const supabase = createClient()
  const [step, setStep] = useState(1)

  const [years,       setYears]       = useState<string | null>(null)
  const [ageRange,    setAgeRange]    = useState<string | null>(null)
  const [bandExp,     setBandExp]     = useState<string | null>(null)
  const [influences,  setInfluences]  = useState<ArtistResult[]>([])
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState<ArtistResult[]>([])
  const [searching,   setSearching]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const r = await searchArtists(query)
      setResults(r)
      setSearching(false)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  function addInfluence(artist: ArtistResult) {
    if (influences.length >= 5) return
    if (influences.some((a) => a.name === artist.name)) return
    setInfluences((prev) => [...prev, artist])
    setQuery('')
    setResults([])
  }

  function removeInfluence(name: string) {
    setInfluences((prev) => prev.filter((a) => a.name !== name))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('profiles').upsert({
        id:               user.id,
        years_practicing: years,
        age_range:        ageRange,
        band_experience:  bandExp,
        influences:       influences.map((a) => a.name),
      }, { onConflict: 'id' })
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  const canAdvance =
    step === 1 ? !!years :
    step === 2 ? !!ageRange :
    step === 3 ? !!bandExp :
    influences.length >= 1

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="w-full max-w-lg rounded-t-3xl"
        style={{
          background: '#131313',
          border: '1px solid rgba(240,239,235,0.08)',
          borderBottom: 'none',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[rgba(240,239,235,0.18)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 pt-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
              Step {step} of 4
            </p>
            <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
              {step === 1 ? 'EXPERIENCE' :
               step === 2 ? 'YOUR AGE RANGE' :
               step === 3 ? 'BAND HISTORY' :
               'INFLUENCES'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[rgba(240,239,235,0.4)] hover:text-[#F0EFEB]">
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mx-5 mb-5 h-1 overflow-hidden rounded-full bg-[rgba(240,239,235,0.08)]">
          <motion.div
            className="h-full rounded-full bg-[#FF5500]"
            animate={{ width: `${(step / 4) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        {/* Step content */}
        <div className="px-5 pb-5" style={{ minHeight: 220 }}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
                <p className="mb-3 text-sm text-[rgba(240,239,235,0.5)]">How long have you been playing?</p>
                <div className="flex flex-col gap-2">
                  {YEARS_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => setYears(o.value)}
                      className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium transition-all"
                      style={{
                        background: years === o.value ? 'rgba(255,92,0,0.15)' : 'rgba(240,239,235,0.04)',
                        border: `1px solid ${years === o.value ? 'rgba(255,92,0,0.5)' : 'rgba(240,239,235,0.08)'}`,
                        color: years === o.value ? '#FF5500' : 'rgba(240,239,235,0.7)',
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
                <p className="mb-3 text-sm text-[rgba(240,239,235,0.5)]">What&apos;s your age range?</p>
                <div className="flex flex-col gap-2">
                  {AGE_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => setAgeRange(o.value)}
                      className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium transition-all"
                      style={{
                        background: ageRange === o.value ? 'rgba(255,92,0,0.15)' : 'rgba(240,239,235,0.04)',
                        border: `1px solid ${ageRange === o.value ? 'rgba(255,92,0,0.5)' : 'rgba(240,239,235,0.08)'}`,
                        color: ageRange === o.value ? '#FF5500' : 'rgba(240,239,235,0.7)',
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
                <p className="mb-3 text-sm text-[rgba(240,239,235,0.5)]">Have you played in a band?</p>
                <div className="flex flex-col gap-2">
                  {BAND_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => setBandExp(o.value)}
                      className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium transition-all"
                      style={{
                        background: bandExp === o.value ? 'rgba(255,92,0,0.15)' : 'rgba(240,239,235,0.04)',
                        border: `1px solid ${bandExp === o.value ? 'rgba(255,92,0,0.5)' : 'rgba(240,239,235,0.08)'}`,
                        color: bandExp === o.value ? '#FF5500' : 'rgba(240,239,235,0.7)',
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
                <p className="mb-3 text-sm text-[rgba(240,239,235,0.5)]">Who are your musical influences? (up to 5)</p>

                {/* Selected chips */}
                {influences.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {influences.map((a) => (
                      <span key={a.name}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                        style={{ background: 'rgba(255,92,0,0.15)', border: '1px solid rgba(255,92,0,0.4)', color: '#FF5500' }}>
                        {a.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.imageUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                        )}
                        {a.name}
                        <button onClick={() => removeInfluence(a.name)} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search artists…"
                  disabled={influences.length >= 5}
                  className="w-full rounded-xl px-4 py-3 text-sm text-[#F0EFEB] placeholder-[rgba(240,239,235,0.3)] outline-none"
                  style={{ background: 'rgba(240,239,235,0.06)', border: '1px solid rgba(240,239,235,0.1)' }}
                />

                {/* Results */}
                {results.length > 0 && (
                  <div className="mt-2 overflow-hidden rounded-xl"
                    style={{ background: '#1a1a1a', border: '1px solid rgba(240,239,235,0.1)' }}>
                    {results.map((a) => (
                      <button key={a.name} onClick={() => addInfluence(a)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[rgba(240,239,235,0.05)]">
                        {a.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#333', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🎵</div>
                        )}
                        <span className="text-sm text-[rgba(240,239,235,0.8)]">{a.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searching && (
                  <p className="mt-2 text-xs text-[rgba(240,239,235,0.3)]">Searching…</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-5">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-[rgba(240,239,235,0.45)] transition-opacity hover:text-[#F0EFEB] disabled:opacity-0"
          >
            ← Back
          </button>
          <button
            onClick={step === 4 ? handleSave : () => setStep((s) => s + 1)}
            disabled={!canAdvance || saving}
            className="flex h-[48px] items-center rounded-full bg-[#FF5500] px-7 text-sm font-semibold text-black shadow-[0_0_16px_rgba(255,85,0,0.35)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? 'Saving…' : step === 4 ? 'Done' : 'Continue →'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
