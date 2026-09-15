-- ─────────────────────────────────────────────────────────────────────────────
-- Sondar — baseline schema
--
-- This is the first tracked migration. The live project already has every
-- object below (they were created by pasting SQL into the dashboard before
-- migrations were tracked in-repo), so on the existing project this file must
-- be MARKED applied, not pushed:
--
--   npx supabase link --project-ref <ref>
--   npx supabase migration repair --status applied 20260915000000
--
-- profiles / messages / waves and the four RPCs were reconstructed from the
-- application code and CLAUDE.md, not exported from the database. Run
-- `npx supabase db pull` once after linking to diff this against the real
-- schema and reconcile anything that differs. The bands tables were created
-- from this exact SQL and are authoritative.
--
-- Every statement is idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS) so the
-- file converges an existing database instead of failing on it, and stands up
-- a fresh one from scratch.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists pgcrypto      with schema extensions;  -- gen_random_uuid()
create extension if not exists cube          with schema extensions;  -- earthdistance dependency
create extension if not exists earthdistance with schema extensions;  -- get_nearby_musicians()
create extension if not exists postgis       with schema extensions;  -- profiles.location

-- ── profiles ─────────────────────────────────────────────────────────────────
-- id === auth.users.id; RLS below requires auth.uid() = id for writes.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

-- One ADD COLUMN per column so an older live table converges to this shape.
alter table public.profiles add column if not exists display_name     text;
alter table public.profiles add column if not exists city             text not null default '';
alter table public.profiles add column if not exists lat              double precision;
alter table public.profiles add column if not exists lng              double precision;
alter table public.profiles add column if not exists location         extensions.geography(Point, 4326);
alter table public.profiles add column if not exists bio              text;
alter table public.profiles add column if not exists audio_url        text;
alter table public.profiles add column if not exists avatar_url       text;
alter table public.profiles add column if not exists photo_urls       text[] not null default '{}';
alter table public.profiles add column if not exists instruments      text[] not null default '{}';
alter table public.profiles add column if not exists genres           text[] not null default '{}';
-- Stores the underscore enum values ('casual_jam' | 'form_band' | 'studio_sessions' | 'live_gigs').
-- Kept as text rather than an enum type so legacy dash-style values remain readable.
alter table public.profiles add column if not exists objective        text;
alter table public.profiles add column if not exists level            text;
alter table public.profiles add column if not exists availability     text[] not null default '{}';
alter table public.profiles add column if not exists influences       text[] not null default '{}';
alter table public.profiles add column if not exists instagram_url    text;
alter table public.profiles add column if not exists years_practicing text;
alter table public.profiles add column if not exists age_range        text;
alter table public.profiles add column if not exists band_experience  text;
alter table public.profiles add column if not exists profile_views    integer not null default 0;
alter table public.profiles add column if not exists is_onboarded     boolean not null default false;
alter table public.profiles add column if not exists last_active      timestamptz;
alter table public.profiles add column if not exists created_at       timestamptz not null default now();
alter table public.profiles add column if not exists updated_at       timestamptz not null default now();

alter table public.profiles enable row level security;

-- Explore/home/messages read other users' profiles, so any signed-in user can SELECT.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ── messages (1:1 DMs) ───────────────────────────────────────────────────────
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  liked_by   uuid[] not null default '{}'
);

create index if not exists messages_from_to_created_at_idx
  on public.messages (from_id, to_id, created_at);
create index if not exists messages_to_unread_idx
  on public.messages (to_id) where read_at is null;

alter table public.messages enable row level security;

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants" on public.messages
  for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender" on public.messages
  for insert to authenticated with check (from_id = auth.uid());

-- Recipient sets read_at; either side toggles liked_by.
drop policy if exists "messages_update_participants" on public.messages;
create policy "messages_update_participants" on public.messages
  for update to authenticated using (from_id = auth.uid() or to_id = auth.uid());

-- Only the sender can delete (the chat page's "delete conversation" relies on this).
drop policy if exists "messages_delete_sender" on public.messages;
create policy "messages_delete_sender" on public.messages
  for delete to authenticated using (from_id = auth.uid());

-- ── waves ("👋 Wave" on a profile) ───────────────────────────────────────────
create table if not exists public.waves (
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);

alter table public.waves enable row level security;

drop policy if exists "waves_select_participants" on public.waves;
create policy "waves_select_participants" on public.waves
  for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());

drop policy if exists "waves_insert_sender" on public.waves;
create policy "waves_insert_sender" on public.waves
  for insert to authenticated with check (from_id = auth.uid());

-- The profile page upserts, which needs UPDATE on conflict.
drop policy if exists "waves_update_sender" on public.waves;
create policy "waves_update_sender" on public.waves
  for update to authenticated using (from_id = auth.uid());

-- ── bands ────────────────────────────────────────────────────────────────────
create table if not exists public.bands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  avatar_url text,
  bio        text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bands enable row level security;

create table if not exists public.band_members (
  band_id   uuid not null references public.bands(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (band_id, user_id)
);
alter table public.band_members enable row level security;

-- Invites to an *existing* band. Band creation inserts band_members directly.
create table if not exists public.band_join_requests (
  id              uuid primary key default gen_random_uuid(),
  band_id         uuid not null references public.bands(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by      uuid not null references public.profiles(id) on delete cascade,
  status          text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at      timestamptz not null default now(),
  responded_at    timestamptz
);
alter table public.band_join_requests enable row level security;

-- One pending invite per (band, user) at a time — allows re-inviting after a decline.
create unique index if not exists band_join_requests_one_pending_per_user
  on public.band_join_requests (band_id, invited_user_id)
  where status = 'pending';

-- Group chat. read_by generalizes the 1:1 read_at timestamp the same way
-- liked_by generalizes per-user likes.
create table if not exists public.band_messages (
  id         uuid primary key default gen_random_uuid(),
  band_id    uuid not null references public.bands(id) on delete cascade,
  from_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now(),
  read_by    uuid[] not null default '{}',
  liked_by   uuid[] not null default '{}'
);
alter table public.band_messages enable row level security;

create index if not exists band_messages_band_id_created_at_idx
  on public.band_messages (band_id, created_at);

-- Helper predicates used by the band policies (SECURITY DEFINER so the
-- membership lookup itself is not subject to band_members RLS).
create or replace function public.is_band_member(target_band_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.band_members
    where band_id = target_band_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_band_admin(target_band_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.band_members
    where band_id = target_band_id and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

drop policy if exists "bands_select_members" on public.bands;
create policy "bands_select_members" on public.bands
  for select using (public.is_band_member(id));
drop policy if exists "bands_insert_authenticated" on public.bands;
create policy "bands_insert_authenticated" on public.bands
  for insert with check (auth.uid() = created_by);
drop policy if exists "bands_update_admins" on public.bands;
create policy "bands_update_admins" on public.bands
  for update using (public.is_band_admin(id));
drop policy if exists "bands_delete_owner" on public.bands;
create policy "bands_delete_owner" on public.bands
  for delete using (
    exists (select 1 from public.band_members where band_id = id and user_id = auth.uid() and role = 'owner')
  );

drop policy if exists "band_members_select_members" on public.band_members;
create policy "band_members_select_members" on public.band_members
  for select using (public.is_band_member(band_id));
drop policy if exists "band_members_insert_admins_or_self" on public.band_members;
create policy "band_members_insert_admins_or_self" on public.band_members
  for insert with check (public.is_band_admin(band_id) or user_id = auth.uid());
drop policy if exists "band_members_delete_admin_or_self" on public.band_members;
create policy "band_members_delete_admin_or_self" on public.band_members
  for delete using (public.is_band_admin(band_id) or user_id = auth.uid());

drop policy if exists "band_join_requests_select" on public.band_join_requests;
create policy "band_join_requests_select" on public.band_join_requests
  for select using (invited_user_id = auth.uid() or public.is_band_admin(band_id));
drop policy if exists "band_join_requests_insert_admins" on public.band_join_requests;
create policy "band_join_requests_insert_admins" on public.band_join_requests
  for insert with check (public.is_band_admin(band_id) and invited_by = auth.uid());
drop policy if exists "band_join_requests_update_invitee_or_admin" on public.band_join_requests;
create policy "band_join_requests_update_invitee_or_admin" on public.band_join_requests
  for update using (invited_user_id = auth.uid() or public.is_band_admin(band_id));

drop policy if exists "band_messages_select_members" on public.band_messages;
create policy "band_messages_select_members" on public.band_messages
  for select using (public.is_band_member(band_id));
drop policy if exists "band_messages_insert_members" on public.band_messages;
create policy "band_messages_insert_members" on public.band_messages
  for insert with check (public.is_band_member(band_id) and from_id = auth.uid());
drop policy if exists "band_messages_update_members" on public.band_messages;
create policy "band_messages_update_members" on public.band_messages
  for update using (public.is_band_member(band_id));

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- The chat pages subscribe to postgres_changes on these tables; that only
-- fires for tables in the supabase_realtime publication.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'band_messages') then
      alter publication supabase_realtime add table public.band_messages;
    end if;
  end if;
end $$;

-- ── RPCs ─────────────────────────────────────────────────────────────────────

-- Updates last_active for the calling user (explore page calls this on mount).
create or replace function public.touch_last_active()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_active = now() where id = auth.uid();
$$;

-- Sets the PostGIS location for a user (onboarding + settings).
create or replace function public.set_user_location(user_id uuid, lat float, lng float)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set location = extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography
  where id = user_id and id = auth.uid();
end;
$$;

-- Increments the view counter when someone else opens a profile.
create or replace function public.increment_profile_views(profile_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.profiles
  set profile_views = coalesce(profile_views, 0) + 1
  where id = profile_id and id <> auth.uid();
$$;

-- Musicians near a point, ordered by distance. The app calls this with
-- (user_lat, user_lng, radius_km) — see explore/page.tsx and home/page.tsx.
-- Dropped first because CREATE OR REPLACE cannot change a return type.
drop function if exists public.get_nearby_musicians(double precision, double precision, double precision);
create function public.get_nearby_musicians(
  user_lat  double precision,
  user_lng  double precision,
  radius_km double precision default 50
)
returns table (
  id           uuid,
  display_name text,
  avatar_url   text,
  photo_urls   text[],
  instruments  text[],
  genres       text[],
  objective    text,
  bio          text,
  lat          double precision,
  lng          double precision,
  city         text,
  last_active  timestamptz,
  created_at   timestamptz,
  distance_km  double precision
)
language sql stable security invoker set search_path = public, extensions as $$
  select
    p.id, p.display_name, p.avatar_url, p.photo_urls, p.instruments, p.genres,
    p.objective, p.bio, p.lat, p.lng, p.city, p.last_active, p.created_at,
    earth_distance(ll_to_earth(p.lat, p.lng), ll_to_earth(user_lat, user_lng)) / 1000 as distance_km
  from public.profiles p
  where p.is_onboarded = true
    and p.lat is not null
    and p.lng is not null
    and earth_distance(ll_to_earth(p.lat, p.lng), ll_to_earth(user_lat, user_lng)) / 1000 <= radius_km
  order by distance_km asc;
$$;
