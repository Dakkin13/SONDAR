import { createClient, type SupabaseClient, type WebSocketLikeConstructor } from '@supabase/supabase-js'
import WebSocket from 'ws'

// Service-role client for test setup/teardown ONLY — creates and deletes
// throwaway accounts directly against auth.users + profiles, bypassing RLS
// and email confirmation. Never imported by application code; Node-side
// (Playwright test process) only, never shipped to the browser.
function env(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name}. E2E tests need a dedicated Supabase TEST project — see e2e/README.md.`,
    )
  }
  return value
}

let cached: SupabaseClient | null = null

export function adminClient(): SupabaseClient {
  if (cached) return cached
  cached = createClient(
    env('NEXT_PUBLIC_SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // supabase-js always constructs a RealtimeClient, even though this
      // admin client never subscribes to anything — and that constructor
      // throws on Node < 22, which has no built-in WebSocket. Node's own
      // test/CI runners here are on Node 20, so this needs an explicit
      // transport (the browser-side app never hits this: it always runs in
      // a real browser, which has native WebSocket).
      realtime: { transport: WebSocket as WebSocketLikeConstructor },
    },
  )
  return cached
}

export interface TestUser {
  id: string
  email: string
  password: string
}

// Every id created by this run, so afterAll can sweep up even if an
// individual test's own cleanup was skipped by a failure.
const createdUserIds = new Set<string>()

/** Creates a pre-confirmed throwaway auth user (no email round-trip needed). */
export async function createTestUser(prefix = 'e2e'): Promise<TestUser> {
  const admin = adminClient()
  const unique = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `${unique}@sondar-e2e.test`
  const password = `Test-${Math.random().toString(36).slice(2, 10)}!`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createTestUser failed: ${error?.message}`)

  createdUserIds.add(data.user.id)
  return { id: data.user.id, email, password }
}

export interface OnboardOverrides {
  display_name?: string
  city?: string
  instruments?: string[]
  genres?: string[]
}

/**
 * Writes an already-onboarded profile row directly (service role bypasses
 * RLS), so DM/band tests can skip the onboarding wizard and start from a
 * ready account — the wizard itself is covered end-to-end by
 * signup-onboarding.spec.ts.
 */
export async function onboardTestUser(user: TestUser, overrides: OnboardOverrides = {}): Promise<void> {
  const admin = adminClient()
  const { error } = await admin.from('profiles').upsert(
    {
      id: user.id,
      display_name: overrides.display_name ?? 'E2E Musician',
      city: overrides.city ?? 'Madrid',
      instruments: overrides.instruments ?? ['guitar'],
      genres: overrides.genres ?? ['rock'],
      objective: 'casual_jam',
      level: 'intermediate',
      availability: ['flexible'],
      is_onboarded: true,
    },
    { onConflict: 'id' },
  )
  if (error) throw new Error(`onboardTestUser failed: ${error.message}`)
}

/** Deletes the auth user (cascades to profiles/messages/bands via FKs). */
export async function deleteTestUser(id: string): Promise<void> {
  const admin = adminClient()
  await admin.auth.admin.deleteUser(id)
  createdUserIds.delete(id)
}

/** A fresh, not-yet-registered email + password for the real sign-up form. */
export function freshCredentials(prefix = 'e2e-signup'): { email: string; password: string } {
  const unique = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return { email: `${unique}@sondar-e2e.test`, password: `Test-${Math.random().toString(36).slice(2, 10)}!` }
}

/**
 * Stands in for "click the confirmation link" after the real signup form
 * creates an unconfirmed account: finds it by email and confirms it, so the
 * test can continue by actually signing in through the UI. Test projects
 * only accumulate a handful of e2e-* accounts between cleanups, so a
 * client-side email filter over one page of listUsers() is enough (the
 * admin API has no server-side email filter).
 */
export async function confirmUserByEmail(email: string): Promise<string> {
  const admin = adminClient()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw new Error(`confirmUserByEmail: listUsers failed: ${error.message}`)
  const user = data.users.find((u) => u.email === email)
  if (!user) throw new Error(`confirmUserByEmail: no user found for ${email}`)

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true })
  if (updateError) throw new Error(`confirmUserByEmail: updateUserById failed: ${updateError.message}`)

  createdUserIds.add(user.id)
  return user.id
}

/** Best-effort final sweep for anything an individual test failed to clean up. */
export async function deleteAllCreatedTestUsers(): Promise<void> {
  const admin = adminClient()
  await Promise.all(
    Array.from(createdUserIds).map((id) => admin.auth.admin.deleteUser(id).catch(() => {})),
  )
  createdUserIds.clear()
}
