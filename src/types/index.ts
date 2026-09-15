export type Instrument =
  | 'guitar'
  | 'bass'
  | 'drums'
  | 'keys'
  | 'piano'
  | 'violin'
  | 'cello'
  | 'trumpet'
  | 'saxophone'
  | 'flute'
  | 'vocals'
  | 'producer'
  | 'dj'
  | 'other'

export type Genre =
  | 'rock'
  | 'metal'
  | 'jazz'
  | 'blues'
  | 'classical'
  | 'electronic'
  | 'hip-hop'
  | 'r&b'
  | 'soul'
  | 'funk'
  | 'reggae'
  | 'pop'
  | 'folk'
  | 'country'
  | 'latin'
  | 'experimental'
  | 'ambient'
  | 'punk'
  | 'indie'
  | 'other'

// Values match the 4 options shown in the UI.
// toObjectiveEnum() in onboarding/page.tsx maps these to DB enum values before upsert.
export type Objective = 'jam' | 'form-band' | 'record' | 'perform-live'

// What the DB actually stores in profiles.objective (underscore enum values).
// Legacy rows may still hold the dash-style UI values, which is why display
// lookups (OBJECTIVE_LABEL maps) accept both.
export type ObjectiveDb = 'casual_jam' | 'form_band' | 'studio_sessions' | 'live_gigs'

export type Level = 'beginner' | 'intermediate' | 'advanced' | 'professional'
export type Availability = 'weekday-evenings' | 'weekends' | 'flexible'

// GeoJSON Point as PostgREST returns the PostGIS `location` geography column.
export interface GeoPoint {
  type?: string
  coordinates?: [number, number]
}

// Mirrors public.profiles exactly — one row, real column names.
// Pages that select a subset should derive it with Pick<Profile, ...>
// rather than redeclaring the shape.
export interface Profile {
  id: string
  display_name: string | null
  city: string | null
  lat: number | null
  lng: number | null
  location: GeoPoint | null
  bio: string | null
  audio_url: string | null
  avatar_url: string | null
  photo_urls: string[] | null
  instruments: Instrument[]
  genres: Genre[]
  objective: ObjectiveDb | Objective | null
  level: Level | null
  availability: Availability[]
  influences: string[] | null
  instagram_url: string | null
  years_practicing: string | null
  age_range: string | null
  band_experience: string | null
  profile_views: number | null
  is_onboarded: boolean
  last_active: string | null
  created_at: string | null
  updated_at: string | null
}

// The three columns nearly every list/avatar UI needs.
export type ProfileSummary = Pick<Profile, 'id' | 'display_name' | 'avatar_url'>

export interface NearbyMusician {
  id: string
  display_name: string | null
  avatar_url: string | null
  photo_urls: string[] | null
  instruments: Instrument[]
  genres: Genre[]
  objective: string | null
  bio: string | null
  lat: number
  lng: number
  city: string | null
  last_active: string | null
  distance_km: number
  created_at?: string | null
  influences?: string[] | null
}

// Mirrors public.messages exactly (1:1 DMs).
export interface Message {
  id: string
  created_at: string
  from_id: string
  to_id: string
  content: string
  read_at: string | null
  liked_by: string[]
}

// ── Bands ──────────────────────────────────────────────────────────────────
// Mirrors public.bands / public.band_members / public.band_join_requests /
// public.band_messages exactly (see CLAUDE.md "Database — bands feature").
// These follow the ACTUAL runtime column naming used throughout the app
// (from_id, avatar_url, created_at) — not the stale Profile/Message shapes
// above (sender_id/recipient_id, objectives, location_lat/lng), which don't
// match real Supabase columns and shouldn't be used as a template.

export type BandRole = 'owner' | 'admin' | 'member'

export interface Band {
  id: string
  name: string
  avatar_url: string | null
  bio: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface BandMember {
  band_id: string
  user_id: string
  role: BandRole
  joined_at: string
}

// Joined shape used by /bands and /bands/[bandId] (band_members + profiles)
export interface BandMemberProfile {
  user_id: string
  role: BandRole
  joined_at: string
  display_name: string | null
  avatar_url: string | null
  instruments: Instrument[]
}

export type BandJoinRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export interface BandJoinRequest {
  id: string
  band_id: string
  invited_user_id: string
  invited_by: string
  status: BandJoinRequestStatus
  created_at: string
  responded_at: string | null
}

export interface BandMessage {
  id: string
  band_id: string
  from_id: string
  content: string
  created_at: string
  read_by: string[]
  liked_by: string[]
}

// Row shape used by /bands list and the unified /messages inbox
export interface BandListItem {
  band: Band
  memberCount: number
  lastMessage: { content: string; created_at: string; from_id: string } | null
  unreadCount: number
}
