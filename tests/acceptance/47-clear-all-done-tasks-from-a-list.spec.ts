import { expect, test, type Locator, type Page } from '@playwright/test'
import { SERVER_CONFIRMED, addTask, expectTasksSaved, openNewList, statusButton, taskRow } from './support/data'

/** The control next to the Done group header that clears a list's done tasks. */
function clearDone(page: Page): Locator {
  return page.getByRole('button', { name: 'Clear done', exact: true })
}

/** The Done group's toggle, whatever its count ("Done (2)"). */
function doneToggle(page: Page): Locator {
  return page.getByRole('button', { name: /^Done \(\d+\)$/ })
}

/**
 * On a list page: advances a To do task to Done and waits until the server has saved it. `doneCount` is how many
 * tasks the list's Done group holds afterwards, which is the proof the change landed before waiting on the server.
 */
async function completeTask(page: Page, title: string, doneCount: number): Promise<void> {
  await statusButton(page, title).click()
  await expect(taskRow(page, title)).toContainText('Doing')
  await statusButton(page, title).click()
  await expect(page.getByRole('button', { name: `Done (${doneCount})`, exact: true })).toBeVisible()
  await expectTasksSaved(page)
}

/** On a list page: opens the Done group so its tasks can be seen and acted on. */
async function expandDone(page: Page): Promise<void> {
  await doneToggle(page).click()
  await expect(doneToggle(page)).toHaveAttribute('aria-expanded', 'true')
}

/** A fresh list holding `count` done tasks, named "Done 1", "Done 2", …, plus the open task "Keep me". */
async function openListWithDoneTasks(page: Page, count: number): Promise<void> {
  await openNewList(page, 'Tidy up')
  await addTask(page, 'Keep me')
  for (let index = 1; index <= count; index += 1) {
    await addTask(page, `Done ${index}`)
    await completeTask(page, `Done ${index}`, index)
  }
}

test.describe('clear all done tasks from a list', () => {
  test('AC1: a Clear done control is shown only once the list has a done task', async ({ page }) => {
    await openNewList(page, 'Tidy up')
    await addTask(page, 'Keep me')

    await expect(taskRow(page, 'Keep me')).toBeVisible()
    await expect(clearDone(page)).toHaveCount(0)

    await addTask(page, 'Done 1')
    await completeTask(page, 'Done 1', 1)

    await expect(clearDone(page)).toBeVisible()
  })

  test('AC2: the control asks to confirm, saying how many done tasks will be deleted', async ({ page }) => {
    await openListWithDoneTasks(page, 2)

    await clearDone(page).click()

    await expect(page.getByText("Delete 2 done tasks? This can't be undone.", { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete done tasks', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
  })

  test('AC3: cancelling the confirmation deletes nothing', async ({ page }) => {
    await openListWithDoneTasks(page, 2)

    await clearDone(page).click()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    await expect(page.getByText("Delete 2 done tasks? This can't be undone.", { exact: true })).toHaveCount(0)
    await expect(taskRow(page, 'Keep me')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Done (2)', exact: true })).toBeVisible()

    await page.reload()

    await expect(taskRow(page, 'Keep me')).toBeVisible()
    await expandDone(page)
    const doneTasks = page.getByRole('list', { name: 'Done tasks', exact: true })
    await expect(doneTasks.getByText('Done 1', { exact: true })).toBeVisible()
    await expect(doneTasks.getByText('Done 2', { exact: true })).toBeVisible()
  })

  test('AC4: confirming deletes the done tasks and leaves every other status untouched', async ({ page }) => {
    await openNewList(page, 'Tidy up')

    // A postponed task is reached by advancing past done, which means opening the Done group to reach its control.
    await addTask(page, 'Postponed task')
    await completeTask(page, 'Postponed task', 1)
    await expandDone(page)
    await statusButton(page, 'Postponed task').click()
    await expect(taskRow(page, 'Postponed task')).toContainText('Postponed')
    await expectTasksSaved(page)

    await addTask(page, 'Todo task')
    await addTask(page, 'Doing task')
    await statusButton(page, 'Doing task').click()
    await expect(taskRow(page, 'Doing task')).toContainText('Doing')
    await expectTasksSaved(page)
    await addTask(page, 'Done task')
    await completeTask(page, 'Done task', 1)

    await clearDone(page).click()
    await page.getByRole('button', { name: 'Delete done tasks', exact: true }).click()

    await expect(doneToggle(page)).toHaveCount(0, SERVER_CONFIRMED)
    await expect(page.getByText('Done task', { exact: true })).toHaveCount(0)
    await expect(taskRow(page, 'Todo task')).toContainText('To do')
    await expect(taskRow(page, 'Doing task')).toContainText('Doing')
    await expect(taskRow(page, 'Postponed task')).toContainText('Postponed')
  })

  test('AC5: a notice says how many were deleted, and they stay gone after a reload', async ({ page }) => {
    await openListWithDoneTasks(page, 2)

    await clearDone(page).click()
    await page.getByRole('button', { name: 'Delete done tasks', exact: true }).click()

    // The notice appears only once the server has deleted the tasks.
    await expect(page.getByText('Deleted 2 done tasks.', { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expect(doneToggle(page)).toHaveCount(0)

    await page.reload()

    await expect(taskRow(page, 'Keep me')).toBeVisible()
    await expect(doneToggle(page)).toHaveCount(0)
    await expect(page.getByText('Done 1', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Done 2', { exact: true })).toHaveCount(0)
  })

  test('AC6: a status or tag filter hides the control along with the Done group', async ({ page }) => {
    await openListWithDoneTasks(page, 1)
    const listUrl = page.url()
    await expect(clearDone(page)).toBeVisible()

    const statusFilter = page.getByRole('radiogroup', { name: 'Filter by status', exact: true })
    await statusFilter.getByRole('radio', { name: 'Done', exact: true }).click()

    await expect(page.getByRole('list', { name: 'Tasks', exact: true }).getByText('Done 1', { exact: true })).toBeVisible()
    await expect(doneToggle(page)).toHaveCount(0)
    await expect(clearDone(page)).toHaveCount(0)

    await statusFilter.getByRole('radio', { name: 'All', exact: true }).click()
    await expect(clearDone(page)).toBeVisible()

    await page.goto(`${listUrl}?tag=nothing-carries-this-tag`)

    await expect(page.getByText('Showing tasks tagged "nothing-carries-this-tag"', { exact: true })).toBeVisible()
    await expect(doneToggle(page)).toHaveCount(0)
    await expect(clearDone(page)).toHaveCount(0)
  })
})
