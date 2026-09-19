import { expect, test } from '@playwright/test'
import { openNewList, todayInUtc } from './support/data'

test.describe('show when a list was created, on its page', () => {
  test('AC1: the Groceries list page shows Created 2026-01-01 near the heading', async ({ page }) => {
    await page.goto('/lists/list-groceries')

    await expect(page.getByRole('heading', { name: 'Groceries', exact: true })).toBeVisible()
    await expect(page.getByText('Created 2026-01-01', { exact: true })).toBeVisible()
  })

  test("AC2: a newly created list's page shows Created followed by today's date", async ({ page }) => {
    await openNewList(page, 'Trip')

    await expect(page.getByText(`Created ${todayInUtc()}`, { exact: true })).toBeVisible()
  })

  test('AC3: the created date stays the same after a reload', async ({ page }) => {
    await openNewList(page, 'Trip')
    const created = `Created ${todayInUtc()}`
    await expect(page.getByText(created, { exact: true })).toBeVisible()

    await page.reload()

    await expect(page.getByText(created, { exact: true })).toBeVisible()
  })
})
