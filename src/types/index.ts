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

export type Objective =
  | 'jam'
  | 'form-band'
  | 'record'
  | 'perform-live'
  | 'teach'
  | 'learn'
  | 'collaborate'
  | 'session-work'

export interface Profile {
  id: string
  created_at: string
  updated_at: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  instruments: Instrument[]
  genres: Genre[]
  objectives: Objective[]
  location_name: string | null
  location_lat: number | null
  location_lng: number | null
  experience_years: number | null
  spotify_url: string | null
  soundcloud_url: string | null
  instagram_url: string | null
  is_onboarded: boolean
}

export interface NearbyMusician {
  id: string
  display_name: string | null
  avatar_url: string | null
  instruments: Instrument[]
  genres: Genre[]
  objectives: Objective[]
  bio: string | null
  location_lat: number
  location_lng: number
  location_name: string | null
  last_active: string | null
  distance_km: number
}

export interface Message {
  id: string
  created_at: string
  sender_id: string
  recipient_id: string
  content: string
  read_at: string | null
}
