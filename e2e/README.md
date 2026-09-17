# E2E tests — golden paths

Three Playwright tests, each exercising a full user-facing flow through the
real UI against a real (test) Supabase project:

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

## One-time setup: a dedicated test Supabase project

**Never point these tests at production.** They create and delete real rows
(throwaway `*@sondar-e2e.test` accounts, via the Supabase admin API), and a
test run against prod would pollute or race with real user data.

1. Create a new, free Supabase project — e.g. `sondar-e2e`. This costs
   nothing and is separate from the project SONDAR runs on in production.
2. Apply every migration in [`supabase/migrations/`](../supabase/migrations/)
   to it, in order, via the dashboard's SQL Editor (the same way you've been
   applying them to production — paste each file in and run it).
3. In that project's dashboard, go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon / public key**
   - **service_role key** (⚠️ this bypasses Row Level Security — it only
     ever runs in CI / your local Playwright process, never in the app)
4. Add three repo secrets — GitHub repo → **Settings → Secrets and
   variables → Actions → New repository secret**:
   - `E2E_SUPABASE_URL`
   - `E2E_SUPABASE_ANON_KEY`
   - `E2E_SUPABASE_SERVICE_ROLE_KEY`

That's it — [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) picks
these up automatically on every push. Until they're set, the `e2e` job logs
one clear warning and skips itself rather than failing (typecheck + lint
still run and still block on every push either way).

## Running locally

```bash
# in the repo root, once:
npm install
npx playwright install --with-deps chromium
```

Create `.env.e2e` in the repo root (gitignored — this is your local-only
copy of the same three values, `dotenv` loads it automatically):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Then:

```bash
npm run build        # NEXT_PUBLIC_* vars are inlined at build time
npm run test:e2e      # headless
npm run test:e2e:ui   # Playwright's interactive UI runner — best for writing/debugging
```

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

If a run crashes hard enough to skip its own cleanup, the test project just
accumulates a few `*@sondar-e2e.test` rows — harmless, and safe to delete
by hand from the dashboard if it ever bothers you.

## Adding a fourth golden path

Use `makeOnboardedUser` / `onboardedUser` from
[`e2e/support/fixtures.ts`](./support/fixtures.ts) rather than hand-rolling
account creation — they register cleanup automatically. Keep new specs
scoped to one real flow end-to-end through the UI; this suite is meant to
stay small and load-bearing, not become a full UI regression suite.
