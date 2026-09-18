import type { Page } from '@playwright/test'
import { test, expect } from './support/fixtures'
import type { TestUser } from './support/supabase-admin'

async function signIn(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.getByPlaceholder('Email').fill(user.email)
  await page.getByPlaceholder('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/home/)
}

// Golden path 2: two already-onboarded musicians DM each other and the
// message arrives on the other side over realtime, with no reload — this is
// exactly the pipeline (postgres_changes + optimistic send + upsert-by-id)
// that a structural regression in the chat rebuild would break silently.
test('two users exchange a DM and see it arrive live', async ({ browser, makeOnboardedUser }) => {
  const sender = await makeOnboardedUser({ display_name: 'E2E Sender' })
  const recipient = await makeOnboardedUser({ display_name: 'E2E Recipient' })

  const senderCtx = await browser.newContext()
  const recipientCtx = await browser.newContext()
  try {
    const senderPage = await senderCtx.newPage()
    const recipientPage = await recipientCtx.newPage()

    await signIn(senderPage, sender)
    await signIn(recipientPage, recipient)

    // Both sides open the SAME conversation before anything is sent, so the
    // recipient's page has to pick the message up live, not on next load.
    await senderPage.goto(`/messages/${recipient.id}`)
    await recipientPage.goto(`/messages/${sender.id}`)

    // The other person's name legitimately appears twice on a brand-new,
    // empty conversation — the sticky header and the empty-state card — so
    // .first() (the header) is enough to confirm we're on the right chat.
    await expect(senderPage.getByText('E2E RECIPIENT').first()).toBeVisible()
    await expect(recipientPage.getByText('E2E SENDER').first()).toBeVisible()

    const outbound = `Hey — golden path DM ${Date.now()}`
    await senderPage.getByPlaceholder('Message…').fill(outbound)
    await senderPage.getByRole('button', { name: 'Send' }).click()

    // Appears in the sender's own bubble list immediately (optimistic insert)…
    await expect(senderPage.getByText(outbound)).toBeVisible()
    // …and on the recipient's side without a reload (realtime delivery).
    await expect(recipientPage.getByText(outbound)).toBeVisible({ timeout: 15_000 })

    // Round trip, to exercise delivery in both directions.
    const reply = `Got it, loud and clear ${Date.now()}`
    await recipientPage.getByPlaceholder('Message…').fill(reply)
    await recipientPage.getByRole('button', { name: 'Send' }).click()
    await expect(senderPage.getByText(reply)).toBeVisible({ timeout: 15_000 })
  } finally {
    await senderCtx.close()
    await recipientCtx.close()
  }
})
