import { expect, test } from '@playwright/test'

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('visitors see the sign-in screen, even when they open a list link', async ({ page }) => {
    await page.goto('/lists/list-groceries')

    await expect(page.getByRole('button', { name: 'Sign in with GitHub', exact: true })).toBeVisible()
    await expect(page.getByText('Buy milk', { exact: true })).toHaveCount(0)
  })
})

test.describe('signed in', () => {
  test('signing out returns to the sign-in screen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Your lists', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Sign out', exact: true }).click()

    await expect(page.getByRole('button', { name: 'Sign in with GitHub', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your lists', exact: true })).toHaveCount(0)
  })
})
