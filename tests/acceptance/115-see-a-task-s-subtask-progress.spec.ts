import { expect, test, type Locator, type Page } from '@playwright/test'
import { addTask, expectTasksSaved, openNewList, taskRow, uniqueName, SERVER_CONFIRMED } from './support/data'

/** The `Subtasks for {taskTitle}` list under a task. */
function subtasksList(page: Page, taskTitle: string): Locator {
  return page.getByRole('list', { name: `Subtasks for ${taskTitle}`, exact: true })
}

/** The checkbox for a subtask under a task. */
function subtaskCheckbox(page: Page, taskTitle: string, subtaskTitle: string): Locator {
  return subtasksList(page, taskTitle).getByRole('checkbox', { name: subtaskTitle, exact: true })
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
async function openTaskWithNoSubtasks(page: Page, base: string): Promise<string> {
  const taskTitle = uniqueName(base)
  await openNewList(page, base)
  await addTask(page, taskTitle)
  return taskTitle
}

test.describe('subtask progress', () => {
  test('AC1: a task with several subtasks, some ticked off, shows "done of total"', async ({ page }) => {
    const taskTitle = await openTaskWithNoSubtasks(page, 'Plan trip')
    const first = uniqueName('Pack item 1')
    const second = uniqueName('Pack item 2')
    const rest = [uniqueName('Pack item 3'), uniqueName('Pack item 4'), uniqueName('Pack item 5')]
    await addSubtask(page, taskTitle, first)
    await addSubtask(page, taskTitle, second)
    for (const title of rest) await addSubtask(page, taskTitle, title)

    await subtaskCheckbox(page, taskTitle, first).check()
    await subtaskCheckbox(page, taskTitle, second).check()
    await expectTasksSaved(page)

    await expect(taskRow(page, taskTitle)).toContainText('2 of 5')
  })

  test('AC2: ticking every remaining subtask updates the progress to "total of total"', async ({ page }) => {
    const taskTitle = await openTaskWithNoSubtasks(page, 'Host party')
    const first = uniqueName('Task 1')
    const second = uniqueName('Task 2')
    const third = uniqueName('Task 3')
    await addSubtask(page, taskTitle, first)
    await addSubtask(page, taskTitle, second)
    await addSubtask(page, taskTitle, third)

    await subtaskCheckbox(page, taskTitle, first).check()
    await subtaskCheckbox(page, taskTitle, second).check()
    await expectTasksSaved(page)
    await expect(taskRow(page, taskTitle)).toContainText('2 of 3')

    await subtaskCheckbox(page, taskTitle, third).check()
    await expectTasksSaved(page)

    await expect(taskRow(page, taskTitle)).toContainText('3 of 3')
  })

  test('AC3: finishing every subtask leaves a To do task still showing To do', async ({ page }) => {
    const taskTitle = await openTaskWithNoSubtasks(page, 'Renovate kitchen')
    const first = uniqueName('Job 1')
    const second = uniqueName('Job 2')
    await addSubtask(page, taskTitle, first)
    await addSubtask(page, taskTitle, second)
    await expect(taskRow(page, taskTitle)).toContainText('To do')

    await subtaskCheckbox(page, taskTitle, first).check()
    await subtaskCheckbox(page, taskTitle, second).check()
    await expectTasksSaved(page)

    const row = taskRow(page, taskTitle)
    await expect(row).toContainText('2 of 2')
    await expect(row).toContainText('To do')
  })
})
