@AGENTS.md

# Sonus — Project Context for Claude

Sonus is a dark, music-discovery app for musician matchmaking. Festival / record-label aesthetic. Stack: Next.js 16.2.6 (App Router, Turbopack), React 19, Tailwind v4, Framer Motion, Supabase, Mapbox GL.

---

## Current State

### Fully built and working

**Landing page** (`src/app/page.tsx`)
- Full brand-aligned page: hero, How It Works (3 Eurorack module cards), Profile Card Showcase, City Map, CTA footer
- Inline `WaveCanvas` component: fixed full-screen canvas, two animated glowing orbs (orange #FF5C00, violet #5B21B6), six thin waveform filaments, floor reflection, film-grain overlay
- Animated via `requestAnimationFrame`, 60fps, Safari-compatible

**Login page** (`src/app/(auth)/login/page.tsx`)
- Google OAuth via Supabase `signInWithOAuth`
- Framer Motion fade-in, glass card

**Onboarding flow** (`src/app/(onboarding)/onboarding/page.tsx`)
- 4-step flow: instruments/genres → objectives/level → profile details → confirmation
- `OnboardingBackground` canvas persists across all steps; orbs lerp to different positions per step; step 4 triggers bloom pulse
- Step 1: instrument chips (multi-select) + genre chips (max 3)
- Step 2: objective cards + level pills + availability chips
- Step 3: avatar upload (Supabase Storage), Mapbox city autocomplete, bio, audio link, Instagram
- Step 4: confirmation card preview + 2-second delay then redirect to `/explore`
- Progress bar + step counter + animated slide transitions (Framer Motion)
- On finish: upserts profile then `router.push('/explore')`

**Explore page** (`src/app/explore/page.tsx`)
- Full-screen Mapbox dark-v11 map
- `FilterBar` floating at top (instrument + objective dropdowns, map/list toggle)
- `BottomSheet` at bottom with spring animation (damping:20, stiffness:300): peek shows horizontal musician card scroll; pin click expands to full musician preview
- List view alternative to map
- Calls `touch_last_active` RPC on mount for authenticated users
- `MapView` dynamically imported (SSR disabled)

**Auth callback** (`src/app/auth/callback/route.ts`)
- Exchanges OAuth code, checks `is_onboarded`, routes to `/onboarding` or `/explore`

**Middleware** (`src/proxy.ts` — note: Next.js 16 renamed `middleware.ts` → `proxy.ts`, function renamed to `proxy`)
- `/auth/*` always passes through
- Unauthenticated users on protected routes → `/login`
- Authenticated users on `/onboarding` with `is_onboarded === true` → `/explore`
- Authenticated users on `/explore` with `is_onboarded !== true` → `/onboarding`
- Protected routes: `/explore`, `/messages`, `/settings`

### Partially built / needs work

**Explore page** — UI is built but depends on Supabase RPC functions that may not exist yet:
- `get_nearby_musicians(lat, lng, radius_km)` — must return `NearbyMusician[]` with `distance_km`
- `touch_last_active()` — must update user's `last_active` column

**Profile page** (`/profile/[id]`) — does not exist yet. MusicianCard links to it but the route 404s.

**Messages page** (`/messages`) — does not exist. Listed as protected route.

**Settings page** (`/settings`) — does not exist. Listed as protected route.

### Last thing fixed

The `handleFinish` function in the onboarding page was crashing silently because:
1. The Supabase URL in `.env.local` had `/rest/v1/` appended — making all auth calls fail
2. The upsert used wrong column names (`location_name`, `location_lat`, `location_lng`, `objectives`) instead of the actual DB column names (`city`, `lat`, `lng`, `objective`)
3. `PostgrestError` is not an `instanceof Error` so the catch block always showed 'Something went wrong'
4. The dev server was never restarted after the env fix, so `NEXT_PUBLIC_` vars were still compiled with the old URL

All fixed. Error display is now a full-width red banner at top of screen (not the old truncated inline text).

### Known remaining issues

1. **`get_nearby_musicians` and `touch_last_active` Supabase RPCs** — must be created in the DB for the Explore page to show musicians. SQL not yet written.
2. **`/profile/[id]` route** — missing entirely. All musician cards link to it.
3. **Onboarding upsert may still fail** if DB columns don't match — run the SQL below to ensure they exist.
4. **`WaveBackground.tsx`** (`src/components/WaveBackground.tsx`) — orphaned file, no longer imported anywhere. Can be deleted.
5. **Confirmation step** — `go(4)` shows it then `router.push('/explore')` fires after 2s. The Confirmation component also has its own `router.push('/explore')` button — both paths eventually redirect correctly.

---

## Database — profiles table

The profiles table lives at `public.profiles`. Row-level security is enabled; the upsert must include `id: user.id` to match `auth.uid()`.

**Confirmed columns used by the app:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | FK → auth.users, primary key |
| `display_name` | text | nullable |
| `city` | text | nullable — display name of location |
| `lat` | double precision | nullable |
| `lng` | double precision | nullable |
| `bio` | text | nullable, max 120 chars enforced in UI |
| `audio_url` | text | nullable — YouTube / SoundCloud link |
| `avatar_url` | text | nullable — Supabase Storage URL |
| `instruments` | text[] | array of Instrument union values |
| `genres` | text[] | array of Genre union values |
| `objective` | text[] | array of Objective union values |
| `level` | text | 'beginner' \| 'intermediate' \| 'advanced' \| 'professional' |
| `availability` | text[] | ['weekday-evenings', 'weekends', 'flexible'] |
| `instagram_url` | text | nullable |
| `is_onboarded` | boolean | default false — checked by middleware and auth callback |
| `last_active` | timestamptz | nullable — updated by `touch_last_active()` RPC |
| `updated_at` | timestamptz | set on every upsert |

The full column list, the `messages` / `waves` tables, and every RPC
(`get_nearby_musicians(user_lat, user_lng, radius_km)`, `touch_last_active`,
`set_user_location`, `increment_profile_views`) live in
`supabase/migrations/20260915000000_baseline.sql` — see **Database workflow**
below. Do not paste SQL into the dashboard by hand any more; write a migration.

Note: `profiles.objective` is a single text value (the app upserts one
underscore-style enum string via `toObjectiveEnum()`), not an array.

---

## Database — bands feature

Adds group-chat support: users can form a named "band" (a group of musicians) with a group chat, in addition to existing 1:1 DMs. No migration tooling exists in this repo — run this SQL manually in the Supabase dashboard's SQL Editor before any band-related app code will work.

**Tables:** `bands`, `band_members` (roster + role, PK `(band_id, user_id)`), `band_join_requests` (invites to an *already-existing* band only — band creation adds members directly, no request needed), `band_messages` (group chat; `read_by uuid[]` generalizes the 1:1 `messages.read_at` single-timestamp model the same way `liked_by uuid[]` already generalizes per-user likes).

**v1 scope decision:** band membership at creation time is limited to people the creator already has a DM thread with (no stranger search exists anywhere in the app yet) — auto-added directly to `band_members`, no accept step, mirroring how WhatsApp/Telegram let you add existing contacts to a new group directly. Inviting someone into an *existing* band is a separate, real accept/decline flow via `band_join_requests`, since that invitee might not personally know the inviter.

**Schema:** tables, helper functions, and RLS policies are in
`supabase/migrations/20260915000000_baseline.sql` (this SQL was created from
that exact file, so it is authoritative for the bands tables).

---

## Database workflow

Schema is tracked as Supabase CLI migrations in `supabase/migrations/`. The
CLI is a pinned devDependency, so use the npm scripts — never paste SQL into
the dashboard by hand.

**One-time setup on the existing project** (the baseline describes objects
that already exist, so it must be marked applied, not pushed):
```bash
npm run db:link -- --project-ref <project-ref>   # asks for the DB password
npx supabase migration repair --status applied 20260915000000
npm run db:pull                                  # diff live schema vs. baseline; reconcile any drift
```

**Every schema change after that:**
```bash
npm run db:new -- describe_the_change   # creates supabase/migrations/<timestamp>_describe_the_change.sql
# edit the file, then:
npm run db:push                          # applies un-applied migrations to the linked project
npm run db:status                        # shows local vs. remote migration state
```

Migrations must be idempotent where practical (`IF NOT EXISTS`,
`DROP POLICY IF EXISTS` before `CREATE POLICY`) and must not change
user-facing behavior without a matching app change in the same commit.

**Routes:** `/bands` (my bands list), `/bands/new` (create wizard), `/bands/[bandId]` (roster/detail), `/bands/[bandId]/settings` (manage), `/messages/band/[bandId]` (group chat — a deliberate fork of `/messages/[userId]/page.tsx`, not a shared component, since read-receipts/typing/channel-naming are pairwise-only in the 1:1 chat code).

---

## Routing and middleware decisions

- `src/proxy.ts` is the middleware file (Next.js 16 renamed `middleware.ts`)
- The exported function is named `proxy` (not `middleware`) — this is required by Next.js 16
- `/auth/*` is always exempted from middleware checks (OAuth flow must pass through)
- Unauthenticated users land on `/login`, not `/` (the landing page is public)
- The middleware makes a DB call on `/onboarding` and `/explore` only — not on every request
- Supabase URL must be the base project URL with no path suffix: `https://<ref>.supabase.co`

---

## Design system

- Background: `#0D0D0D` (near-black)
- Foreground: `#F0EFEB` (warm white)
- Accent: `#FF5C00` (orange)
- Violet: `#5B21B6`
- Fonts: Bebas Neue (`--font-bebas`, display) + DM Sans (`--font-sans`, body)
- Glass card utility: `.glass` in `globals.css` — `backdrop-filter: blur(20px) saturate(180%)`, `isolation: isolate`
- Film grain: SVG data URI in `body::after` at `opacity: 0.028`
- Canvas animations use `requestAnimationFrame`, not CSS or Framer Motion

---

## How to Resume

When starting a fresh session, read this file first, then:

**If continuing the onboarding fix:**
1. Open the browser at `http://localhost:3000/onboarding` (start dev server with `npm run dev` in `/Users/dani/sonus`)
2. Complete the form and click Finish — watch the red error banner at the top of the screen for the exact error message
3. If you see "Upsert error: column X does not exist", run the ALTER TABLE SQL above in Supabase → SQL Editor
4. Check the server terminal for `[middleware] profile for <id>` logs when navigating to `/explore`

**Next features to build (in priority order):**
1. **Run the DB SQL** — add missing columns and create the two RPC functions above. Without them the Explore page has no data and `touch_last_active` throws.
2. **`/profile/[id]` page** — musician profile view. All map pins and musician cards link here. Should show full profile: avatar, name, bio, instruments, genres, objectives, location, audio link.
3. **`/messages` page** — messaging between musicians. The `Message` type is already defined in `src/types/index.ts`.
4. **Delete `src/components/WaveBackground.tsx`** — orphaned, nothing imports it.
5. **`/settings` page** — let the user edit their own profile (same fields as onboarding step 3).

**Key files to read before touching anything:**
- `src/proxy.ts` — middleware routing logic
- `src/app/(onboarding)/onboarding/page.tsx` — full onboarding orchestrator including `handleFinish`
- `src/types/index.ts` — all TypeScript types including `NearbyMusician` and `Profile`
- `src/app/globals.css` — Tailwind v4 design tokens and `.glass` utility

**Never do:**
- Add `/rest/v1/` to `NEXT_PUBLIC_SUPABASE_URL` — it breaks all auth
- Name the middleware file `middleware.ts` or export a function named `middleware` — Next.js 16 requires `proxy.ts` / `proxy`
- Use `onboarding_completed` as a column name — the DB column is `is_onboarded`
- Put a canvas with `z-index: -1` behind elements — it goes behind the body background paint and becomes invisible. Use `z-index: 0` and put content in a `position: relative; z-index: 1` wrapper.
