import { expect, test, type Page } from '@playwright/test'
import { addTask, expectTasksSaved, openNewList, statusButton, taskRow } from './support/data'

/** The "Filter by status" radiogroup on a list page. */
function statusFilter(page: Page) {
  return page.getByRole('radiogroup', { name: 'Filter by status', exact: true })
}

/** Selects a status filter (`All`, `To do`, `Doing` or `Done`) on the current list page. */
async function selectFilter(page: Page, name: string): Promise<void> {
  await statusFilter(page).getByRole('radio', { name }).click()
}

test.describe('filter tasks by status', () => {
  test('AC1: with no filter chosen, All is selected and today\'s grouping is unchanged', async ({ page }) => {
    await page.goto('/lists/list-groceries')

    await expect(statusFilter(page).getByRole('radio', { name: 'All', exact: true })).toBeChecked()

    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByText('Buy milk', { exact: true })).toBeVisible()
    await expect(tasks.getByText('Buy bread', { exact: true })).toBeVisible()
    await expect(tasks).not.toContainText('Buy eggs')

    await expect(page.getByRole('button', { name: 'Done (1)', exact: true })).toHaveAttribute('aria-expanded', 'false')
  })

  test('AC2: choosing To do shows only Buy milk', async ({ page }) => {
    await page.goto('/lists/list-groceries')

    await selectFilter(page, 'To do')

    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByText('Buy milk', { exact: true })).toBeVisible()
    await expect(page.getByText('Buy bread', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Buy eggs', { exact: true })).toHaveCount(0)
  })

  test('AC3: choosing Doing shows only Buy bread', async ({ page }) => {
    await page.goto('/lists/list-groceries')

    await selectFilter(page, 'Doing')

    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByText('Buy bread', { exact: true })).toBeVisible()
    await expect(page.getByText('Buy milk', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Buy eggs', { exact: true })).toHaveCount(0)
  })

  test('AC4: choosing Done shows Buy eggs directly, with no group to expand', async ({ page }) => {
    await page.goto('/lists/list-groceries')

    await selectFilter(page, 'Done')

    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByText('Buy eggs', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Done \(\d+\)$/ })).toHaveCount(0)
    await expect(page.getByText('Buy milk', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Buy bread', { exact: true })).toHaveCount(0)
  })

  test('AC5: the Doing filter stays selected and applied after a reload', async ({ page }) => {
    await page.goto('/lists/list-work')

    await selectFilter(page, 'Doing')

    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByText('Send invoices', { exact: true })).toBeVisible()
    await expect(page.getByText('Write quarterly report', { exact: true })).toHaveCount(0)

    await page.reload()

    await expect(statusFilter(page).getByRole('radio', { name: 'Doing', exact: true })).toBeChecked()
    await expect(page.getByRole('list', { name: 'Tasks', exact: true }).getByText('Send invoices', { exact: true })).toBeVisible()
    await expect(page.getByText('Write quarterly report', { exact: true })).toHaveCount(0)
  })

  test('AC6: a Doing filter with no matching task names the filter in the empty state', async ({ page }) => {
    await openNewList(page, 'Chores')
    await addTask(page, 'Water the plants')

    await selectFilter(page, 'Doing')

    await expect(page.getByText('No Doing tasks.', { exact: true })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Tasks', exact: true })).toHaveCount(0)
  })

  test("AC7: advancing a filtered task's status removes it from the still-applied filter", async ({ page }) => {
    await openNewList(page, 'Errands')
    await addTask(page, 'Post a letter')

    await selectFilter(page, 'To do')
    await expect(taskRow(page, 'Post a letter')).toBeVisible()

    await statusButton(page, 'Post a letter').click()
    await expectTasksSaved(page)

    await expect(taskRow(page, 'Post a letter')).toHaveCount(0)
  })
})
