import { test, expect } from './support/fixtures'

// Golden path 3: an onboarded musician creates a band solo (no members
// selected — this is the exact shape that used to trip the bands RLS
// chicken-and-egg bug: insert the band, then insert the owner's own
// band_members row, then read the band back, all under RLS).
test('create a band and land on its page', async ({ page, onboardedUser }) => {
  await page.goto('/login')
  await page.getByPlaceholder('Email').fill(onboardedUser.email)
  await page.getByPlaceholder('Password').fill(onboardedUser.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/home/)

  await page.goto('/bands/new')

  const bandName = `E2E Band ${Date.now()}`
  await page.getByPlaceholder('Band name').fill(bandName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await expect(page.getByText('Add members')).toBeVisible()
  await page.getByRole('button', { name: 'Create band' }).click()

  await page.waitForURL(/\/bands\/[0-9a-f-]{36}/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: bandName.toUpperCase() })).toBeVisible()
  await expect(page.getByText('1 member')).toBeVisible()
  // "OWNER" legitimately appears twice (the role pill and the member row) —
  // either proves the same thing, so .first() is enough.
  await expect(page.getByText('OWNER').first()).toBeVisible()

  // The band must also show up back on the /bands list.
  await page.goto('/bands')
  await expect(page.getByText(bandName)).toBeVisible()
})
