import { expect, test } from '@playwright/test'

test.describe('access to lists', () => {
  test("opening another user's list shows List not found", async ({ page }) => {
    await page.goto('/lists/list-other-private')

    await expect(page.getByRole('heading', { name: 'List not found', exact: true })).toBeVisible()
    await expect(page.getByText('Private task of another user', { exact: true })).toHaveCount(0)
  })

  test('opening a list that does not exist shows List not found', async ({ page }) => {
    await page.goto('/lists/no-such-list')

    await expect(page.getByRole('heading', { name: 'List not found', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Back to your lists', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your lists', exact: true })).toBeVisible()
  })
})
