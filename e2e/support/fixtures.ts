import { test as base } from '@playwright/test'
import {
  createTestUser, deleteTestUser, onboardTestUser, type OnboardOverrides, type TestUser,
} from './supabase-admin'

interface Fixtures {
  /** A confirmed, already-onboarded throwaway user — deleted after the test. */
  onboardedUser: TestUser
  /** Factory for extra onboarded users (e.g. the DM test's second party). */
  makeOnboardedUser: (overrides?: OnboardOverrides) => Promise<TestUser>
}

export const test = base.extend<Fixtures>({
  onboardedUser: async ({}, use) => {
    const user = await createTestUser('e2e-user')
    await onboardTestUser(user)
    await use(user)
    await deleteTestUser(user.id)
  },

  makeOnboardedUser: async ({}, use) => {
    const created: TestUser[] = []
    await use(async (overrides) => {
      const user = await createTestUser('e2e-user')
      await onboardTestUser(user, overrides)
      created.push(user)
      return user
    })
    await Promise.all(created.map((u) => deleteTestUser(u.id)))
  },
})

export { expect } from '@playwright/test'
