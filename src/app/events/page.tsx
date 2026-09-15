'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/ui/BottomNav'
import { useToast } from '@/components/ui/Toast'

interface Event {
  id: string
  title: string
  description: string | null
  date: string
  city: string
  venue: string | null
  genre: string | null
  is_public: boolean
  created_at: string
  created_by: string
  creator_name: string | null
  creator_avatar: string | null
}

interface EventForm {
  title: string
  description: string
  date: string
  city: string
  venue: string
  genre: string
}

const GENRE_OPTIONS = [
  'Rock', 'Indie', 'Jazz', 'Electronic', 'Hip-Hop', 'Classical',
  'Metal', 'Folk', 'R&B', 'Pop', 'Punk', 'Experimental', 'Ambient', 'Soul', 'Funk',
]

function formatEventDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatEventTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function isUpcoming(iso: string): boolean {
  return new Date(iso).getTime() > Date.now()
}

const inputClass =
  'w-full rounded-xl border border-[rgba(240,239,235,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[#F0EFEB] placeholder:text-[rgba(240,239,235,0.3)] outline-none focus:border-[rgba(255,85,0,0.5)] transition-colors'

export default function EventsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [userId, setUserId] = useState<string | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cityFilter, setCityFilter] = useState('All')
  const [form, setForm] = useState<EventForm>({
    title: '', description: '', date: '', city: '', venue: '', genre: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data, error } = await supabase
        .from('events')
        .select(`
          id, title, description, date, city, venue, genre, is_public, created_at, created_by,
          profiles:created_by ( display_name, avatar_url )
        `)
        .eq('is_public', true)
        .order('date', { ascending: true })

      if (!error && data) {
        const evts: Event[] = data.map((e: Record<string, unknown>) => {
          const p = e.profiles as { display_name: string | null; avatar_url: string | null } | null
          return {
            id: e.id as string,
            title: e.title as string,
            description: e.description as string | null,
            date: e.date as string,
            city: e.city as string,
            venue: e.venue as string | null,
            genre: e.genre as string | null,
            is_public: e.is_public as boolean,
            created_at: e.created_at as string,
            created_by: e.created_by as string,
            creator_name: p?.display_name ?? null,
            creator_avatar: p?.avatar_url ?? null,
          }
        })
        setEvents(evts)
      }
      setLoading(false)
    }
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!userId || !form.title.trim() || !form.date || !form.city.trim()) return
    setSubmitting(true)
    const { data, error } = await supabase
      .from('events')
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        date: form.date,
        city: form.city.trim(),
        venue: form.venue.trim() || null,
        genre: form.genre || null,
        created_by: userId,
        is_public: true,
      })
      .select(`
        id, title, description, date, city, venue, genre, is_public, created_at, created_by,
        profiles:created_by ( display_name, avatar_url )
      `)
      .single()

    if (error) {
      toast('Could not create event: ' + error.message, 'error')
    } else if (data) {
      const p = (data as Record<string, unknown>).profiles as { display_name: string | null; avatar_url: string | null } | null
      const newEvent: Event = {
        id: (data as Record<string, unknown>).id as string,
        title: (data as Record<string, unknown>).title as string,
        description: (data as Record<string, unknown>).description as string | null,
        date: (data as Record<string, unknown>).date as string,
        city: (data as Record<string, unknown>).city as string,
        venue: (data as Record<string, unknown>).venue as string | null,
        genre: (data as Record<string, unknown>).genre as string | null,
        is_public: (data as Record<string, unknown>).is_public as boolean,
        created_at: (data as Record<string, unknown>).created_at as string,
        created_by: (data as Record<string, unknown>).created_by as string,
        creator_name: p?.display_name ?? null,
        creator_avatar: p?.avatar_url ?? null,
      }
      setEvents(prev => [newEvent, ...prev].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
      setShowCreate(false)
      setForm({ title: '', description: '', date: '', city: '', venue: '', genre: '' })
      toast('Event created!', 'default')
    }
    setSubmitting(false)
  }

  const cities = ['All', ...Array.from(new Set(events.map(e => e.city))).sort()]
  const filtered = events.filter(e =>
    (cityFilter === 'All' || e.city === cityFilter)
  )
  const upcoming = filtered.filter(e => isUpcoming(e.date))
  const past = filtered.filter(e => !isUpcoming(e.date))

  return (
    <div style={{ minHeight: '100dvh' }}>
      {/* Create event modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="w-full max-w-lg rounded-t-3xl p-6 sm:rounded-3xl"
              style={{ background: 'rgba(18,18,18,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={e => e.stopPropagation()}
            >
              <h2 className="mb-5 font-[family-name:var(--font-bebas)] text-2xl tracking-widest text-[#F0EFEB]">
                CREATE EVENT
              </h2>
              <div className="space-y-3">
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Event title *" maxLength={80} className={inputClass} />
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description (optional)" rows={2}
                  className={`${inputClass} resize-none`} />
                <input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={inputClass} style={{ colorScheme: 'dark' }} />
                <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="City *" className={inputClass} />
                <input type="text" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                  placeholder="Venue or address (optional)" className={inputClass} />
                <select value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
                  className={inputClass} style={{ appearance: 'none', colorScheme: 'dark' }}>
                  <option value="">Genre (optional)</option>
                  {GENRE_OPTIONS.map(g => <option key={g} value={g.toLowerCase()}>{g}</option>)}
                </select>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={() => void handleCreate()}
                  disabled={submitting || !form.title.trim() || !form.date || !form.city.trim()}
                  className="w-full rounded-xl bg-[#FF5500] py-3 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create event'}
                </button>
                <button onClick={() => setShowCreate(false)}
                  className="w-full rounded-xl py-3 text-sm text-[rgba(240,239,235,0.4)]">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-4"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          background: 'rgba(13,13,13,0.92)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <div>
            <h1 className="text-[#F0EFEB]"
              style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, letterSpacing: '0.08em' }}>
              EVENTS
            </h1>
            <p className="text-[11px] text-[rgba(240,239,235,0.3)]">
              {upcoming.length} upcoming
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#FF5500] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_12px_rgba(255,85,0,0.3)]"
          >
            + New
          </button>
        </div>

        {/* City filter */}
        {cities.length > 2 && (
          <div className="mx-auto max-w-lg mt-3 flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {cities.map(c => (
              <button
                key={c}
                onClick={() => setCityFilter(c)}
                className="flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all"
                style={{
                  background: cityFilter === c ? '#FF5500' : 'rgba(255,255,255,0.05)',
                  color: cityFilter === c ? '#000' : 'rgba(240,239,235,0.5)',
                  border: cityFilter === c ? 'none' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-lg px-4 pt-3 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
          </div>
        ) : upcoming.length === 0 && past.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(255,92,0,0.08)', border: '1px solid rgba(255,92,0,0.15)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,92,0,0.55)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="text-[rgba(240,239,235,0.55)] font-semibold text-base">No events yet</p>
              <p className="mt-1 text-[13px] text-[rgba(240,239,235,0.3)]">
                Be the first to post a gig or jam session.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-1 rounded-full bg-[rgba(255,85,0,0.12)] border border-[rgba(255,85,0,0.2)] px-5 py-2.5 text-sm font-medium text-[#FF5500]"
            >
              Create event →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {upcoming.length > 0 && (
              <section>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
                  Upcoming
                </p>
                <div className="flex flex-col gap-2">
                  {upcoming.map((evt, i) => (
                    <EventCard key={evt.id} event={evt} i={i} currentUserId={userId} />
                  ))}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[rgba(240,239,235,0.3)]">
                  Past
                </p>
                <div className="flex flex-col gap-2 opacity-50">
                  {past.slice(0, 5).map((evt, i) => (
                    <EventCard key={evt.id} event={evt} i={i} currentUserId={userId} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

function EventCard({ event: evt, i, currentUserId }: { event: Event; i: number; currentUserId: string | null }) {
  const router = useRouter()
  const upcoming = isUpcoming(evt.date)
  const initials = (evt.creator_name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: i * 0.04 }}
      className="rounded-2xl p-4"
      style={{
        background: upcoming ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${upcoming ? 'rgba(255,92,0,0.15)' : 'rgba(255,255,255,0.06)'}`,
        borderTopColor: upcoming ? 'rgba(255,92,0,0.25)' : 'rgba(255,255,255,0.09)',
      }}
    >
      {/* Date + genre pill */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-[11px] font-semibold text-[#FF5C00]">{formatEventDate(evt.date)}</p>
          <p className="text-[10px] text-[rgba(240,239,235,0.35)]">{formatEventTime(evt.date)}</p>
        </div>
        {evt.genre && (
          <span className="rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(255,92,0,0.1)', color: '#FF5C00', border: '1px solid rgba(255,92,0,0.2)' }}>
            {evt.genre}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-[#F0EFEB] leading-tight mb-1">{evt.title}</h3>

      {/* Venue + city */}
      <p className="text-[12px] text-[rgba(240,239,235,0.4)]">
        {[evt.venue, evt.city].filter(Boolean).join(' · ')}
      </p>

      {/* Description */}
      {evt.description && (
        <p className="mt-2 text-[12px] text-[rgba(240,239,235,0.5)] leading-relaxed line-clamp-2">
          {evt.description}
        </p>
      )}

      {/* Creator */}
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => router.push(`/profile/${evt.created_by}`)}
          className="flex items-center gap-2"
        >
          <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full"
            style={{ background: 'rgba(255,92,0,0.15)', border: '1px solid rgba(255,92,0,0.2)' }}>
            {evt.creator_avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={evt.creator_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 8, fontWeight: 700, color: '#FF5C00' }}>{initials}</span>
            }
          </div>
          <span className="text-[11px] text-[rgba(240,239,235,0.4)]">{evt.creator_name ?? 'Unknown'}</span>
        </button>
        {evt.created_by !== currentUserId && upcoming && (
          <button
            onClick={() => router.push(`/messages/${evt.created_by}`)}
            className="rounded-full px-3 py-1 text-[11px] font-medium text-[#FF5C00] transition-colors"
            style={{ background: 'rgba(255,92,0,0.1)', border: '1px solid rgba(255,92,0,0.2)' }}
          >
            Message
          </button>
        )}
      </div>
    </motion.div>
  )
}
