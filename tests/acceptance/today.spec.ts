import { expect, test } from '@playwright/test'
import { SERVER_CONFIRMED, addTask, openNewList, setDueDate, todayInUtc } from './support/data'

test.describe('today page', () => {
  test('reference: shows the overdue fixture tasks grouped by list in due-date order, and a task due today under its list', async ({ page }) => {
    const listName = await openNewList(page, 'Deadlines')
    await addTask(page, 'Submit the form')
    await setDueDate(page, 'Submit the form', todayInUtc())

    await page.getByRole('link', { name: 'Today', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Today', exact: true, level: 1 })).toBeVisible()

    // The fixture's groups are in due-date order. Other tests' lists can have groups anywhere among them, even before them,
    // and their names can start with "Work" or "Groceries" too (#86), so the fixture's groups are matched exactly.
    const groups = page.getByRole('heading', { level: 2 })
    await expect(groups.filter({ hasText: /^(Work|Groceries)$/ })).toHaveText(['Work', 'Groceries'])
    await expect(page.getByRole('list', { name: 'Due in Work', exact: true }).getByRole('listitem')).toHaveText([
      /Send invoices.*Overdue since 2026-01-10/,
      /Write quarterly report.*Overdue since 2026-01-15/,
    ])
    await expect(page.getByRole('list', { name: 'Due in Groceries', exact: true }).getByRole('listitem')).toHaveText([
      /Buy milk.*Overdue since 2026-01-12/,
    ])

    await expect(page.getByRole('list', { name: `Due in ${listName}`, exact: true }).getByRole('listitem')).toHaveText([
      /Submit the form.*Due today/,
    ])
  })

  test('leaves out done tasks and tasks without a due date', async ({ page }) => {
    await page.goto('/today')

    await expect(page.getByRole('list', { name: 'Due in Work', exact: true })).toContainText('Send invoices')
    await expect(page.getByText('Archive old files', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Plan next year', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Buy bread', { exact: true })).toHaveCount(0)
  })

  test("tasks of a deleted list don't show up", async ({ page }) => {
    const listName = await openNewList(page, 'Cancelled')
    await addTask(page, 'Never mind')
    await setDueDate(page, 'Never mind', todayInUtc())

    await page.getByRole('link', { name: 'Today', exact: true }).click()
    await expect(page.getByRole('list', { name: `Due in ${listName}`, exact: true })).toContainText('Never mind')

    await page.getByRole('link', { name: 'Tasks', exact: true }).click()
    await page.getByRole('button', { name: `Delete ${listName}`, exact: true }).click()
    await page.getByRole('button', { name: 'Delete list', exact: true }).click()
    await expect(page.getByText(`Deleted "${listName}".`, { exact: true })).toBeVisible(SERVER_CONFIRMED)

    await page.getByRole('link', { name: 'Today', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Due in Work', exact: true })).toBeVisible()
    await expect(page.getByText('Never mind', { exact: true })).toHaveCount(0)
  })
})
