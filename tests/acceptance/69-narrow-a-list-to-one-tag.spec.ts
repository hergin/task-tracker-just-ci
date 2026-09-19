import { expect, test, type Page } from '@playwright/test'
import { SERVER_CONFIRMED, addTask, expectTasksSaved, openNewList, statusButton, taskRow, uniqueName } from './support/data'

/** Adds a tag to a task through its edit form and waits until the server has saved it. */
async function tagTask(page: Page, title: string, tag: string): Promise<void> {
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  const form = page.getByRole('form', { name: `Edit ${title}`, exact: true })
  await form.getByLabel('New tag', { exact: true }).fill(tag)
  await form.getByRole('button', { name: 'Add tag', exact: true }).click()
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(form).toHaveCount(0, SERVER_CONFIRMED)
}

/** Clicks the tag button on a task's row, narrowing the list to that tag. */
async function narrowByTag(page: Page, title: string, tag: string): Promise<void> {
  await taskRow(page, title)
    .getByRole('button', { name: `Show tasks tagged ${tag}`, exact: true })
    .click()
}

test.describe('narrow a list to one tag', () => {
  test('AC1: clicking a tag on a task row shows only tasks carrying that tag', async ({ page }) => {
    await openNewList(page, 'Tagged filter')
    await addTask(page, 'Tagged task')
    await addTask(page, 'Other task')
    await tagTask(page, 'Tagged task', 'urgent')

    await narrowByTag(page, 'Tagged task', 'urgent')

    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByText('Tagged task', { exact: true })).toBeVisible()
    await expect(page.getByText('Other task', { exact: true })).toHaveCount(0)
  })

  test('AC2: narrowing to a tag names the tag on the page', async ({ page }) => {
    await openNewList(page, 'Tagged filter')
    await addTask(page, 'Tagged task')
    await tagTask(page, 'Tagged task', 'urgent')

    await narrowByTag(page, 'Tagged task', 'urgent')

    await expect(page.getByText('Showing tasks tagged "urgent"', { exact: true })).toBeVisible()
  })

  test('AC3: Show all tasks returns to every task and clears the tag message', async ({ page }) => {
    await openNewList(page, 'Tagged filter')
    await addTask(page, 'Tagged task')
    await addTask(page, 'Other task')
    await tagTask(page, 'Tagged task', 'urgent')

    await narrowByTag(page, 'Tagged task', 'urgent')
    await expect(page.getByText('Showing tasks tagged "urgent"', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Show all tasks', exact: true }).click()

    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByText('Tagged task', { exact: true })).toBeVisible()
    await expect(tasks.getByText('Other task', { exact: true })).toBeVisible()
    await expect(page.getByText('Showing tasks tagged "urgent"', { exact: true })).toHaveCount(0)
  })

  test('AC4: a tag no task carries shows a message instead of the task list', async ({ page }) => {
    const tag = uniqueName('unused-tag')
    await page.goto(`/lists/list-groceries?tag=${encodeURIComponent(tag)}`)

    await expect(page.getByText(`No tasks tagged "${tag}".`, { exact: true })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Tasks', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Show all tasks', exact: true })).toBeVisible()
  })

  test('AC5: narrowing to a tag shared by an open and a done task shows both with no Done group', async ({ page }) => {
    await openNewList(page, 'Tagged filter')
    await addTask(page, 'Open task')
    await addTask(page, 'Done task')
    await tagTask(page, 'Open task', 'pair')
    await tagTask(page, 'Done task', 'pair')

    // Advance 'Done task' from To do to Doing to Done.
    await statusButton(page, 'Done task').click()
    await expectTasksSaved(page)
    await statusButton(page, 'Done task').click()
    await expectTasksSaved(page)

    await narrowByTag(page, 'Open task', 'pair')

    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByText('Open task', { exact: true })).toBeVisible()
    await expect(tasks.getByText('Done task', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Done \(\d+\)$/ })).toHaveCount(0)
  })

  test('AC6: the status filter still narrows within a tag', async ({ page }) => {
    await openNewList(page, 'Tagged filter')
    await addTask(page, 'Todo task')
    await addTask(page, 'Doing task')
    await tagTask(page, 'Todo task', 'shared')
    await tagTask(page, 'Doing task', 'shared')

    await statusButton(page, 'Doing task').click()
    await expectTasksSaved(page)

    await narrowByTag(page, 'Todo task', 'shared')

    await page.getByRole('radiogroup', { name: 'Filter by status', exact: true }).getByRole('radio', { name: 'Doing', exact: true }).click()

    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByText('Doing task', { exact: true })).toBeVisible()
    await expect(page.getByText('Todo task', { exact: true })).toHaveCount(0)
  })
})
