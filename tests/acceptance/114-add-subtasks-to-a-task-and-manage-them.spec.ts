import { expect, test, type Locator, type Page } from '@playwright/test'
import { SERVER_CONFIRMED, addTask, expectTasksSaved, openNewList, uniqueName } from './support/data'

/** The `Subtasks for {taskTitle}` list under a task. */
function subtasksList(page: Page, taskTitle: string): Locator {
  return page.getByRole('list', { name: `Subtasks for ${taskTitle}`, exact: true })
}

/** Adds a subtask to a task and waits until the server has saved it. */
async function addSubtask(page: Page, taskTitle: string, subtaskTitle: string): Promise<void> {
  const input = page.getByLabel(`New subtask for ${taskTitle}`, { exact: true })
  await input.fill(subtaskTitle)
  await page.getByRole('button', { name: `Add subtask to ${taskTitle}`, exact: true }).click()
  // The input clears only once the server confirms the write.
  await expect(input, 'the new subtask was saved').toHaveValue('', SERVER_CONFIRMED)
}

/** Creates a fresh list with one task, ready for subtasks. */
async function openTaskWithNoSubtasks(page: Page): Promise<string> {
  const taskTitle = uniqueName('Prep dinner')
  await openNewList(page, 'Household')
  await addTask(page, taskTitle)
  return taskTitle
}

test.describe('subtasks', () => {
  test('AC1: adding a subtask to a task shows it under the task, not yet done', async ({ page }) => {
    const taskTitle = await openTaskWithNoSubtasks(page)
    const subtaskTitle = uniqueName('Chop vegetables')

    await addSubtask(page, taskTitle, subtaskTitle)

    const checkbox = subtasksList(page, taskTitle).getByRole('checkbox', { name: subtaskTitle, exact: true })
    await expect(checkbox).toBeVisible()
    await expect(checkbox).not.toBeChecked()
  })

  test('AC2: ticking a subtask as done shows it as done', async ({ page }) => {
    const taskTitle = await openTaskWithNoSubtasks(page)
    const subtaskTitle = uniqueName('Chop vegetables')
    await addSubtask(page, taskTitle, subtaskTitle)
    const checkbox = subtasksList(page, taskTitle).getByRole('checkbox', { name: subtaskTitle, exact: true })

    await checkbox.check()
    await expectTasksSaved(page)

    await expect(checkbox).toBeChecked()
  })

  test('AC3: a done subtask still shows as done after a reload', async ({ page }) => {
    const taskTitle = await openTaskWithNoSubtasks(page)
    const subtaskTitle = uniqueName('Chop vegetables')
    await addSubtask(page, taskTitle, subtaskTitle)
    const checkbox = subtasksList(page, taskTitle).getByRole('checkbox', { name: subtaskTitle, exact: true })
    await checkbox.check()
    await expectTasksSaved(page)
    await expect(checkbox).toBeChecked()

    await page.reload()

    await expect(subtasksList(page, taskTitle).getByRole('checkbox', { name: subtaskTitle, exact: true })).toBeChecked()
  })

  test('AC4: unticking a done subtask shows it as not done', async ({ page }) => {
    const taskTitle = await openTaskWithNoSubtasks(page)
    const subtaskTitle = uniqueName('Chop vegetables')
    await addSubtask(page, taskTitle, subtaskTitle)
    const checkbox = subtasksList(page, taskTitle).getByRole('checkbox', { name: subtaskTitle, exact: true })
    await checkbox.check()
    await expectTasksSaved(page)
    await expect(checkbox).toBeChecked()

    await checkbox.uncheck()
    await expectTasksSaved(page)

    await expect(checkbox).not.toBeChecked()
  })

  test('AC5: renaming a subtask shows the new title instead of the old one', async ({ page }) => {
    const taskTitle = await openTaskWithNoSubtasks(page)
    const subtaskTitle = uniqueName('Chop vegetables')
    await addSubtask(page, taskTitle, subtaskTitle)
    const newSubtaskTitle = uniqueName('Wash vegetables')

    await page.getByRole('button', { name: `Edit subtask ${subtaskTitle}`, exact: true }).click()
    const titleInput = page.getByLabel('Subtask title', { exact: true })
    await titleInput.fill(newSubtaskTitle)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    // The rename form closes only once the server has saved the subtask.
    await expect(titleInput).toHaveCount(0, SERVER_CONFIRMED)

    const subtasks = subtasksList(page, taskTitle)
    await expect(subtasks.getByRole('checkbox', { name: newSubtaskTitle, exact: true })).toBeVisible()
    await expect(subtasks.getByRole('checkbox', { name: subtaskTitle, exact: true })).toHaveCount(0)
  })

  test('AC6: removing a subtask makes it no longer appear under the task', async ({ page }) => {
    const taskTitle = await openTaskWithNoSubtasks(page)
    const subtaskTitle = uniqueName('Chop vegetables')
    await addSubtask(page, taskTitle, subtaskTitle)
    const subtasks = subtasksList(page, taskTitle)
    await expect(subtasks.getByRole('checkbox', { name: subtaskTitle, exact: true })).toBeVisible()

    await page.getByRole('button', { name: `Remove subtask ${subtaskTitle}`, exact: true }).click()
    await expectTasksSaved(page)

    await expect(subtasks.getByRole('checkbox', { name: subtaskTitle, exact: true })).toHaveCount(0)
  })
})
