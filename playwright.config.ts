import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// Local convenience only — loads .env.e2e if present (e.g. pointing at a
// `supabase start` local stack, see e2e/README.md). In CI the real values
// come from `supabase status` as job env vars, which this never overrides
// (dotenv does not clobber already-set process.env keys).
loadEnv({ path: '.env.e2e' })

// Golden-path E2E tests. Run against a throwaway LOCAL Supabase stack (or a
// separate test project if you'd rather) — NEVER production, since these
// create and delete real rows. See e2e/README.md.
const PORT = Number(process.env.E2E_PORT ?? 3100)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`
const CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // Keep worker count modest so parallel runs don't race on shared
  // resources like realtime channels.
  workers: CI ? 2 : undefined,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Serves the already-built app (`npm run build` runs first in CI). All
  // NEXT_PUBLIC_* vars — including NEXT_PUBLIC_WAITLIST_MODE, which must be
  // "false" here so /login is reachable — are inlined at BUILD time, so they
  // have to be set before `npm run build` runs, not here (see e2e/README.md).
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
})
