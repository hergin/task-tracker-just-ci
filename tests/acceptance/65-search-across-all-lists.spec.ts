import { expect, test, type Page } from '@playwright/test'
import { uniqueName } from './support/data'

/** Fills the header's search field and submits it. Works from any screen. */
async function search(page: Page, query: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Search tasks', exact: true }).fill(query)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
}

test.describe('search', () => {
  test('AC1: searching for a fixture task from another list shows a result naming its list', async ({ page }) => {
    await page.goto('/lists/list-groceries')

    await search(page, 'invoices')

    await expect(page.getByRole('heading', { name: 'Search', exact: true, level: 1 })).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Search results', exact: true }).getByRole('link', { name: 'Send invoices in Work', exact: true }),
    ).toBeVisible()
  })

  test('AC2: a query matching only a task\'s notes, in a different case, finds that task', async ({ page }) => {
    await page.goto('/')

    await search(page, 'q4 numbers')

    await expect(
      page.getByRole('list', { name: 'Search results', exact: true }).getByRole('link', { name: 'Write quarterly report in Work', exact: true }),
    ).toBeVisible()
  })

  test('AC3: clicking a result opens its list', async ({ page }) => {
    await page.goto('/lists/list-groceries')

    await search(page, 'invoices')
    await page.getByRole('list', { name: 'Search results', exact: true }).getByRole('link', { name: 'Send invoices in Work', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Work', level: 1, exact: true })).toBeVisible()
  })

  test('AC4: searching with an empty field asks for a query and shows no results', async ({ page }) => {
    await page.goto('/')

    await search(page, '')

    await expect(page.getByRole('heading', { name: 'Search', exact: true, level: 1 })).toBeVisible()
    await expect(page.getByText('Type something to search for.', { exact: true })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Search results', exact: true })).toHaveCount(0)
  })

  test('AC5: a query matching nothing says so and shows no results', async ({ page }) => {
    const query = uniqueName('nonexistent')
    await page.goto('/')

    await search(page, query)

    await expect(page.getByText(`No tasks match "${query}".`, { exact: true })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Search results', exact: true })).toHaveCount(0)
  })
})
