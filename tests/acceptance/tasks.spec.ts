import { expect, test } from '@playwright/test'
import { SERVER_CONFIRMED, addTask, expectTasksSaved, listRow, openNewList, statusButton, taskRow } from './support/data'

test.describe('list page', () => {
  test('shows open tasks in their saved order', async ({ page }) => {
    await page.goto('/lists/list-groceries')
    const tasks = page.getByRole('list', { name: 'Tasks', exact: true }).getByRole('listitem')

    await expect(tasks.nth(0)).toContainText('Buy milk')
    await expect(tasks.nth(1)).toContainText('Buy bread')
  })

  test('keeps done tasks in a collapsed Done group', async ({ page }) => {
    await page.goto('/lists/list-groceries')

    const doneToggle = page.getByRole('button', { name: 'Done (1)', exact: true })
    await expect(doneToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('list', { name: 'Tasks', exact: true })).not.toContainText('Buy eggs')

    await doneToggle.click()
    await expect(page.getByRole('list', { name: 'Done tasks', exact: true }).getByRole('listitem')).toHaveText([/Buy eggs/])
  })

  test('a task added to a new list shows as To do and is still there after a reload', async ({ page }) => {
    await openNewList(page, 'Chores')
    await expect(page.getByText('No tasks yet.', { exact: true })).toBeVisible()

    await addTask(page, 'Water the plants')

    await expect(taskRow(page, 'Water the plants')).toContainText('To do')
    await page.reload()
    await expect(taskRow(page, 'Water the plants')).toContainText('To do')
  })

  test("adding a task raises its list's open count on the lists page", async ({ page }) => {
    const listName = await openNewList(page, 'Errands')

    await addTask(page, 'Post a letter')

    await page.getByRole('link', { name: '← Your lists', exact: true }).click()
    await expect(listRow(page, listName)).toContainText('1 open')
  })

  test('reference: add a task, cycle it to done, see it in the collapsed Done group, reload, still there', async ({ page }) => {
    await openNewList(page, 'Chores')
    await addTask(page, 'Water the plants')
    await expect(taskRow(page, 'Water the plants')).toContainText('To do')

    const status = statusButton(page, 'Water the plants')
    await status.click()
    await expect(taskRow(page, 'Water the plants')).toContainText('Doing')
    await status.click()

    // A done task leaves the open tasks for the Done group, which starts collapsed.
    const doneToggle = page.getByRole('button', { name: 'Done (1)', exact: true })
    await expect(doneToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByText('No open tasks.', { exact: true })).toBeVisible()
    await expectTasksSaved(page)

    await page.reload()
    await page.getByRole('button', { name: 'Done (1)', exact: true }).click()
    const doneTask = page.getByRole('list', { name: 'Done tasks', exact: true }).getByRole('listitem').filter({ hasText: 'Water the plants' })
    await expect(doneTask).toContainText('Done')
  })

  test("editing a task's title, notes, due date and assignee", async ({ page }) => {
    await openNewList(page, 'Plans')
    await addTask(page, 'Book flights')

    await page.getByRole('button', { name: 'Edit Book flights', exact: true }).click()
    const form = page.getByRole('form', { name: 'Edit Book flights', exact: true })
    await form.getByLabel('Title', { exact: true }).fill('Book train tickets')
    await form.getByLabel('Notes', { exact: true }).fill('Window seats')
    await form.getByLabel('Due date', { exact: true }).fill('2030-01-15')
    await form.getByLabel('Assigned to', { exact: true }).selectOption({ label: 'E2E Other' })
    await form.getByRole('button', { name: 'Save', exact: true }).click()

    // The form closes only once the server has saved the task.
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    const row = taskRow(page, 'Book train tickets')
    await expect(row).toContainText('Window seats')
    await expect(row).toContainText('Due 2030-01-15')
    await expect(row).toContainText('Assigned to E2E Other')
    await page.reload()
    await expect(row).toContainText('Assigned to E2E Other')
    await expect(taskRow(page, 'Book flights')).toHaveCount(0)
  })

  test('deleting a task removes it', async ({ page }) => {
    await openNewList(page, 'Tidy')
    await addTask(page, 'Old task')

    await page.getByRole('button', { name: 'Delete Old task', exact: true }).click()

    // The notice appears only once the server has deleted the task.
    await expect(page.getByText('Deleted "Old task".', { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await page.reload()
    await expect(page.getByText('No tasks yet.', { exact: true })).toBeVisible()
  })
})
