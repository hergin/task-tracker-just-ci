import { expect, test } from '@playwright/test'
import { STORAGE_STATE } from './support/env'

// Only the criteria that can be reached without a task someone has shared: nothing in the app records who a task is
// shared with yet, and only e2e-owner can sign in, so a recipient looking at a shared task cannot be set up from the UI.
// Nothing is shared with e2e-owner, so their Shared with me screen is the empty one.
test.describe('shared with me', () => {
  test('AC1: the header links to Shared with me beside Today, and marks it as the current page there', async ({ page }) => {
    await page.goto('/today')

    const today = page.getByRole('link', { name: 'Today', exact: true })
    const shared = page.getByRole('link', { name: 'Shared with me', exact: true })
    // How Today marks itself as the current page on /today: the marking the new link has to match on /shared.
    await expect(today).toHaveAttribute('aria-current', 'page')

    await shared.click()

    await expect(page).toHaveURL(/\/shared$/)
    await expect(shared).toHaveAttribute('aria-current', 'page')
    await expect(today).not.toHaveAttribute('aria-current', 'page')
  })

  test('AC7: the screen says nothing has been shared with you, and lists nothing, when nothing has', async ({ page }) => {
    await page.goto('/shared')

    await expect(page.getByText('Nothing has been shared with you.', { exact: true })).toBeVisible()
    // Asserted after the sentence above, which proves the screen has loaded. The owner's own tasks belong on their
    // own lists, never here, so the screen has no entries at all.
    await expect(page.getByRole('listitem')).toHaveCount(0)
  })

  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('AC2: a visitor who opens the screen signed out sees the sign-in screen, and signed in sees the screen', async ({ page, browser }) => {
      await page.goto('/shared')

      await expect(page.getByRole('button', { name: 'Sign in with GitHub', exact: true })).toBeVisible()
      await expect(page.getByText('Nothing has been shared with you.', { exact: true })).toHaveCount(0)

      // Signing in is the session auth.setup.ts saved, never a second login flow. The address is the one opened above.
      const sharedUrl = page.url()
      const signedIn = await browser.newContext({ storageState: STORAGE_STATE })
      const signedInPage = await signedIn.newPage()
      await signedInPage.goto(sharedUrl)

      await expect(signedInPage.getByText('Nothing has been shared with you.', { exact: true })).toBeVisible()
      await expect(signedInPage.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
      await signedIn.close()
    })
  })
})
