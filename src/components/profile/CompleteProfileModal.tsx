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
  { value: 'never',           label: 'Never'               },
  { value: 'a-few-jams',      label: 'A few jams'          },
  { value: 'one-or-more',     label: 'One or more bands'   },
  { value: 'currently-in',    label: 'Currently in a band' },
]

const LASTFM_KEY = process.env.NEXT_PUBLIC_LASTFM_API_KEY ?? ''
const PLACEHOLDER_HASH = '2a96cbd8b46e442fc41c2b86b821562f'
const MIN_LISTENERS = 5000

async function getAudioDBImage(artistName: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artistName)}`,
    )
    if (!r.ok) return null
    const d = await r.json()
    const thumb = d?.artists?.[0]?.strArtistThumb as string | undefined
    return thumb ?? null
  } catch {
    return null
  }
}

async function searchArtists(q: string): Promise<ArtistResult[]> {
  if (!q.trim() || q.trim().length < 2) return []
  try {
    let artists: ArtistResult[] = []

    if (LASTFM_KEY) {
      // Last.fm: sorted by listeners so popular artists surface first
      const res = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=artist.search&artist=${encodeURIComponent(q)}&api_key=${LASTFM_KEY}&format=json&limit=10`,
      )
      const data = await res.json()
      type LfmArtist = { name: string; listeners: string; image?: Array<{ '#text': string; size: string }> }
      const matches: LfmArtist[] = data?.results?.artistmatches?.artist ?? []

      artists = matches
        .filter(a => parseInt(a.listeners ?? '0') >= MIN_LISTENERS)
        .sort((a, b) => parseInt(b.listeners) - parseInt(a.listeners))
        .slice(0, 5)
        .map(a => {
          // Try to extract image from search result before making another request
          const img = a.image?.find(i => i.size === 'large')?.['#text'] ?? ''
          return {
            name: a.name,
            imageUrl: img && !img.includes(PLACEHOLDER_HASH) && img.trim() ? img : null,
          }
        })
    } else {
      // MusicBrainz fallback: filter by score to drop obscure results
      const res = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(q)}&limit=10&fmt=json`,
        { headers: { 'User-Agent': 'Sondar/1.0 (contact@sondar.app)' } },
      )
      const data = await res.json()
      type MbArtist = { name: string; score: number }
      artists = (data.artists ?? [] as MbArtist[])
        .filter((a: MbArtist) => a.score > 70)
        .slice(0, 5)
        .map((a: MbArtist) => ({ name: a.name, imageUrl: null }))
    }

    // Fetch images from TheAudioDB for any artist still missing one
    await Promise.all(
      artists.map(async (artist) => {
        if (!artist.imageUrl) {
          artist.imageUrl = await getAudioDBImage(artist.name)
        }
      }),
    )

    return artists
  } catch {
    return []
  }
}

function ArtistAvatar({ name, imageUrl, size = 32 }: { name: string; imageUrl: string | null; size?: number }) {
  const [failed, setFailed] = useState(false)
  const colors = ['#FF5C00', '#5B21B6', '#0EA5E9', '#10B981', '#F59E0B']
  const color = colors[name.charCodeAt(0) % colors.length]

  if (imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `${color}22`, border: `1.5px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color,
      fontFamily: 'var(--font-bebas)',
    }}>
      {name[0]?.toUpperCase()}
    </div>
  )
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
    if (!query.trim() || query.trim().length < 2) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const r = await searchArtists(query)
      setResults(r)
      setSearching(false)
    }, 350)
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
                <p className="mb-3 text-sm text-[rgba(240,239,235,0.5)]">
                  Who are your musical influences?{' '}
                  <span className="text-[rgba(240,239,235,0.3)]">(up to 5)</span>
                </p>

                {/* Selected chips with images */}
                {influences.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {influences.map((a) => (
                      <span key={a.name}
                        className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-medium"
                        style={{ background: 'rgba(255,92,0,0.15)', border: '1px solid rgba(255,92,0,0.4)', color: '#FF5500' }}>
                        <ArtistAvatar name={a.name} imageUrl={a.imageUrl} size={20} />
                        {a.name}
                        <button onClick={() => removeInfluence(a.name)}
                          className="ml-0.5 opacity-60 hover:opacity-100 leading-none"
                          aria-label={`Remove ${a.name}`}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={influences.length >= 5 ? 'Max 5 artists reached' : 'Search artists…'}
                    disabled={influences.length >= 5}
                    className="w-full rounded-xl px-4 py-3 text-sm text-[#F0EFEB] placeholder-[rgba(240,239,235,0.3)] outline-none"
                    style={{ background: 'rgba(240,239,235,0.06)', border: '1px solid rgba(240,239,235,0.1)' }}
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
                    </div>
                  )}
                </div>

                {/* Results — artist photo + name, sorted by popularity */}
                <AnimatePresence>
                  {results.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="mt-2 overflow-hidden rounded-xl"
                      style={{ background: '#1a1a1a', border: '1px solid rgba(240,239,235,0.1)' }}
                    >
                      {results.map((a, i) => (
                        <button key={a.name} onClick={() => addInfluence(a)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[rgba(240,239,235,0.05)]"
                          style={{ borderTop: i > 0 ? '1px solid rgba(240,239,235,0.05)' : 'none' }}>
                          <ArtistAvatar name={a.name} imageUrl={a.imageUrl} size={38} />
                          <span className="text-sm font-medium text-[rgba(240,239,235,0.85)]">{a.name}</span>
                          {influences.some(inf => inf.name === a.name) && (
                            <span className="ml-auto text-[10px] text-[#FF5500]">✓</span>
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <p className="mt-2 text-xs text-[rgba(240,239,235,0.25)]">No popular artists found. Try a different spelling.</p>
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
