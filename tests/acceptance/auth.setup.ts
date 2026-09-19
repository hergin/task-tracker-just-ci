import { expect, test as setup } from '@playwright/test'
import { E2E_EMAIL, STORAGE_STATE, e2ePassword } from './support/env'

// Signs in once through the test sign-in form and saves the session. Every test starts signed in as e2e-owner.
// Never write another login flow: use this session, or test as a signed-out visitor with
// test.use({ storageState: { cookies: [], origins: [] } }).
setup('sign in with the test account', async ({ page }) => {
  await page.goto('/')

  const form = page.getByRole('form', { name: 'Test sign-in', exact: true })
  await form.getByLabel('Email', { exact: true }).fill(E2E_EMAIL)
  await form.getByLabel('Password', { exact: true }).fill(e2ePassword())
  await form.getByRole('button', { name: 'Sign in with test account', exact: true }).click()

  await expect(
    page.getByRole('heading', { name: 'Your lists', exact: true }),
    'signed in with the test account (if not: is the database seeded, and is E2E_PASSWORD right?)',
  ).toBeVisible()

  // Firebase Auth keeps its session in IndexedDB, which storageState only saves when asked.
  await page.context().storageState({ path: STORAGE_STATE, indexedDB: true })
})
