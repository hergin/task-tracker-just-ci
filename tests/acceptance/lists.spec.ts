import { expect, test } from '@playwright/test'
import { SERVER_CONFIRMED, createList, listRow, uniqueName } from './support/data'

test.describe('lists page', () => {
  test("shows the signed-in user's lists and no one else's", async ({ page }) => {
    await page.goto('/')
    const lists = page.getByRole('list', { name: 'Lists', exact: true })

    await expect(lists.getByRole('link', { name: 'Groceries', exact: true })).toBeVisible()
    await expect(lists.getByRole('link', { name: 'Work', exact: true })).toBeVisible()
    // Assert absence only after something on the page proves the data has loaded, or it passes vacuously.
    await expect(lists.getByRole('link', { name: 'Private list of another user', exact: true })).toHaveCount(0)
  })

  test('each list shows how many open tasks it has', async ({ page }) => {
    await page.goto('/')

    await expect(listRow(page, 'Groceries')).toContainText('2 open')
    await expect(listRow(page, 'Work')).toContainText('3 open')
    await expect(listRow(page, 'Empty list')).toContainText('0 open')
  })

  test('a new list appears and is still there after a reload', async ({ page }) => {
    const name = uniqueName('Trip')

    await createList(page, name)

    await expect(listRow(page, name)).toBeVisible()
    await page.reload()
    await expect(listRow(page, name)).toBeVisible()
  })

  test('a list name is required', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('New list name', { exact: true }).fill('   ')
    await page.getByRole('button', { name: 'Create list', exact: true }).click()

    await expect(page.getByRole('alert')).toHaveText('List name is required.')
  })

  test('reference: create a list, see 0 open tasks, rename it, and delete it through the confirmation', async ({ page }) => {
    const name = uniqueName('Trip')
    const renamed = uniqueName('Holiday')

    await createList(page, name)
    await expect(listRow(page, name)).toContainText('0 open')

    await page.getByRole('button', { name: `Rename ${name}`, exact: true }).click()
    await page.getByLabel(`Name for ${name}`, { exact: true }).fill(renamed)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    // The row leaves edit mode only once the server has saved the new name.
    await expect(page.getByRole('button', { name: `Rename ${renamed}`, exact: true })).toBeVisible(SERVER_CONFIRMED)
    await page.reload()
    await expect(listRow(page, renamed)).toContainText('0 open')
    await expect(listRow(page, name)).toHaveCount(0)

    const href = await listRow(page, renamed).getByRole('link').getAttribute('href')
    expect(href).toMatch(/^\/lists\//)
    await page.getByRole('button', { name: `Delete ${renamed}`, exact: true }).click()
    await page.getByRole('button', { name: 'Delete list', exact: true }).click()
    // The notice appears only once the server has deleted the list and its tasks.
    await expect(page.getByText(`Deleted "${renamed}".`, { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expect(listRow(page, renamed)).toHaveCount(0)

    await page.goto(String(href))
    await expect(page.getByRole('heading', { name: 'List not found', exact: true })).toBeVisible()
  })

  test('cancelling a delete keeps the list', async ({ page }) => {
    const name = uniqueName('Keep')
    await createList(page, name)

    await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click()
    await expect(page.getByText(`Delete "${name}" and all its tasks? This can't be undone.`, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    await expect(listRow(page, name)).toBeVisible()
    await page.reload()
    await expect(listRow(page, name)).toBeVisible()
  })
})
