# E2E tests — golden paths

Three Playwright tests, each exercising a full user-facing flow through the
real UI against a real Supabase stack:

| File | Flow |
|---|---|
| [`signup-onboarding.spec.ts`](./signup-onboarding.spec.ts) | Sign up with email/password → confirm → sign in → complete the 4-step onboarding wizard → land on `/home` |
| [`direct-message.spec.ts`](./direct-message.spec.ts) | Two users DM each other; the message has to arrive on the *other* browser context live, over realtime, with no reload |
| [`create-band.spec.ts`](./create-band.spec.ts) | A user creates a band solo and it shows up on `/bands/[id]` and `/bands` |

These three were picked because they're exactly the flows that have broken
in this project before: the bands RLS chicken-and-egg bug (band → owner
row → read-back, all under RLS), the messaging rebuild (optimistic send +
realtime upsert-by-id), and the onboarding → `is_onboarded` gate in
`src/proxy.ts`. A future regression in any of these fails CI instead of
shipping.

## No second Supabase project needed

These tests run against a **throwaway local Supabase stack** — Postgres,
Auth, Realtime, and Storage, via Docker — that the Supabase CLI (already a
devDependency, pinned in `package.json`) starts fresh from
[`supabase/migrations/`](../supabase/migrations/) and throws away when it's
done. That's what [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
does automatically on every push: no GitHub secrets, no second free-tier
project, no subscription. It never touches your `sondar` project or any
other project in your Supabase account.

## Running locally

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/)
(free for personal use) to be installed and running.

```bash
npm install
npx playwright install --with-deps chromium

npx supabase start   # spins up the local stack, applies every migration
npx supabase status  # prints the local API URL + anon/service_role keys
```

Create `.env.e2e` in the repo root (gitignored) using the values `supabase
status` just printed:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from `supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`>
```

Then:

```bash
npm run build         # NEXT_PUBLIC_* vars are inlined at build time
npm run test:e2e      # headless
npm run test:e2e:ui   # Playwright's interactive UI runner — best for writing/debugging

npx supabase stop     # when you're done — tears the local stack back down
```

You only need to re-run `supabase start` after pulling changes that touch
`supabase/migrations/`, or after `supabase stop`; while it's running,
re-running `npm run test:e2e` reuses the same stack.

### Using a hosted test project instead

If you'd rather point these at a real hosted Supabase project than a local
Docker stack (e.g. no Docker available), any project works the same way —
just apply every file in `supabase/migrations/` to it via its SQL Editor,
then put its URL/anon key/service_role key in `.env.e2e` as above. **Never
use your production project** — these tests create and delete real rows.
CI itself always uses the local stack; a hosted project is only a local
convenience if you want one.

## How test accounts work

Nothing here logs in as a real person or touches production credentials.
[`e2e/support/supabase-admin.ts`](./support/supabase-admin.ts) uses the
**service role key** to:

- create pre-confirmed throwaway accounts (`admin.createUser`) so the DM and
  band tests can skip straight to a signed-in, already-onboarded user;
- confirm the one account that goes through the *real* sign-up form in
  `signup-onboarding.spec.ts`, standing in for "click the link in the
  confirmation email" (which a test can't actually receive);
- delete every account it created, in a `finally` / fixture teardown, win
  or lose.

On the local stack this is all disposable anyway (`supabase stop` wipes
it); against a hosted project, a crashed run just leaves a few harmless
`*@sondar-e2e.test` rows behind, safe to delete by hand.

## Adding a fourth golden path

Use `makeOnboardedUser` / `onboardedUser` from
[`e2e/support/fixtures.ts`](./support/fixtures.ts) rather than hand-rolling
account creation — they register cleanup automatically. Keep new specs
scoped to one real flow end-to-end through the UI; this suite is meant to
stay small and load-bearing, not become a full UI regression suite.
