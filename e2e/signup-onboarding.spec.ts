import { test, expect } from './support/fixtures'
import { confirmUserByEmail, deleteTestUser, freshCredentials } from './support/supabase-admin'

// Golden path 1: a brand-new visitor signs up with email + password,
// confirms their account, signs in, completes the 3-step onboarding wizard,
// and lands somewhere that proves is_onboarded actually got written.
//
// The real email confirmation link can't be clicked from a test, so
// confirmUserByEmail() stands in for that one click via the admin API —
// everything else (signup form, sign-in form, the wizard itself) runs
// through the real UI exactly as a person would use it.
test('sign up, confirm, sign in, and complete onboarding', async ({ page }) => {
  const { email, password } = freshCredentials()
  let userId: string | null = null

  try {
    await page.goto('/login')
    await page.getByRole('button', { name: "Don't have an account? Sign up" }).click()

    await page.getByPlaceholder('Email').fill(email)
    await page.getByPlaceholder('Password').fill(password)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('Check your email')).toBeVisible()

    userId = await confirmUserByEmail(email)

    // Simulates clicking the emailed link, then signing in for real.
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(email)
    await page.getByPlaceholder('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await page.waitForURL(/\/onboarding/)

    // Step 1 — instruments + genres
    await expect(page.getByText('What do you play?')).toBeVisible()
    await page.getByRole('button', { name: 'Guitar' }).click()
    await page.getByRole('button', { name: 'Rock' }).click()
    await page.getByRole('button', { name: 'Continue →' }).click()

    // Step 2 — objective + level
    await expect(page.getByText('What are you looking for?')).toBeVisible()
    await page.getByRole('button', { name: 'Form a band' }).click()
    await page.getByRole('button', { name: 'Intermediate' }).click()
    await page.getByRole('button', { name: 'Continue →' }).click()

    // Step 3 — identity
    await expect(page.getByPlaceholder('Your name')).toBeVisible()
    const displayName = `E2E Signup ${Date.now()}`
    await page.getByPlaceholder('Your name').fill(displayName)
    await page.getByPlaceholder('Madrid, Berlin, Paris…').fill('Madrid')
    await page.getByRole('button', { name: 'Finish' }).click()

    // Confirmation screen proves the profile upsert (is_onboarded: true) succeeded.
    await expect(page.getByText("You're in.")).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: /Find musicians near you/ }).click()
    await page.waitForURL(/\/explore/)

    // Re-visiting a protected route must NOT bounce back to onboarding now.
    await page.goto('/home')
    await expect(page).toHaveURL(/\/home/)
    await expect(page.getByText(displayName.split(' ')[0], { exact: false })).toBeVisible()
  } finally {
    if (userId) await deleteTestUser(userId)
  }
})
