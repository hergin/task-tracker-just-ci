import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  SERVER_CONFIRMED,
  addTask,
  expectTasksSaved,
  openNewList,
  setDueDate,
  statusButton,
  taskRow,
  uniqueName,
} from './support/data'
import { BASE_URL, STORAGE_STATE } from './support/env'

// Moving a task to another list (#51). The UI these tests drive: every task row has a "Move <title>" button next to
// its Edit and Delete ones (the reorder buttons stay "Move <title> up" and "Move <title> down"); it opens a
// "Move <title>" form holding a "Move to list" picker of the user's other lists and a "Move task" button; once the
// server has confirmed the move, the source list's page shows a notice naming the destination list.
//
// One acceptance criterion has no test here: "If the user owns no other list, the Move control is not shown". Every
// acceptance test signs in as the fixture's e2e-owner, who owns Groceries, Work and Empty list, and the fixture is
// read-only, so a user owning a single list is a state these tests cannot reach.

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

/** Creates a list, opens it, and returns its name and the URL of its page. */
async function newList(page: Page, base: string): Promise<{ name: string; url: string }> {
  const name = await openNewList(page, base)
  return { name, url: page.url() }
}

/** The open Move form of the task titled `title` on a list page. */
function moveForm(page: Page, title: string): Locator {
  return page.getByRole('form', { name: `Move ${title}`, exact: true })
}

/** On a list page: the notice shown once a task has been moved to the list named `listName`. */
function movedNotice(page: Page, listName: string): Locator {
  return page.getByRole('status').filter({ hasText: listName })
}

/** On a list page: opens a task's Move form and picks the list named `listName` as the destination. */
async function chooseDestination(page: Page, title: string, listName: string): Promise<Locator> {
  await page.getByRole('button', { name: `Move ${title}`, exact: true }).click()
  const form = moveForm(page, title)
  await form.getByLabel('Move to list', { exact: true }).selectOption({ label: listName })
  return form
}

/** On a list page: moves a task to another list and waits until the server has confirmed the move. */
async function moveTaskToList(page: Page, title: string, listName: string): Promise<void> {
  const form = await chooseDestination(page, title, listName)
  await form.getByRole('button', { name: 'Move task', exact: true }).click()
  // The notice naming the destination appears only once the server has confirmed the move.
  await expect(movedNotice(page, listName), 'the move was saved').toBeVisible(SERVER_CONFIRMED)
}

test.describe('move a task to another list', () => {
  test('AC1: a task offers Move alongside its Edit and Delete controls', async ({ page }) => {
    const title = uniqueName('Repaint the shed')
    await newList(page, 'Source')
    await addTask(page, title)

    const row = taskRow(page, title)
    await expect(row.getByRole('button', { name: `Edit ${title}`, exact: true })).toBeVisible()
    await expect(row.getByRole('button', { name: `Delete ${title}`, exact: true })).toBeVisible()
    await expect(row.getByRole('button', { name: `Move ${title}`, exact: true })).toBeVisible()
  })

  test("AC2: Move offers the user's other lists by name, and neither this list nor another user's", async ({ page }) => {
    const title = uniqueName('Repaint the shed')
    const destination = await newList(page, 'Target')
    const source = await newList(page, 'Source')
    await addTask(page, title)

    await page.getByRole('button', { name: `Move ${title}`, exact: true }).click()

    const picker = moveForm(page, title).getByLabel('Move to list', { exact: true })
    await expect(picker.getByRole('option', { name: destination.name, exact: true })).toHaveCount(1)
    // The picker is populated, so what it leaves out can be asserted: the task's own list, and a list of another user's.
    await expect(picker.getByRole('option', { name: source.name, exact: true })).toHaveCount(0)
    await expect(picker.getByRole('option', { name: 'Private list of another user', exact: true })).toHaveCount(0)
  })

  test('AC4: a confirmed move takes the task off the source list and puts it on the destination list', async ({ page }) => {
    const title = uniqueName('Repaint the shed')
    const destination = await newList(page, 'Target')
    await newList(page, 'Source')
    await addTask(page, title)

    await moveTaskToList(page, title, destination.name)

    await expect(taskRow(page, title)).toHaveCount(0)
    await page.reload()
    // The source list is empty now, which also proves its tasks have loaded before asserting the task is gone.
    await expect(page.getByText('No tasks yet.', { exact: true })).toBeVisible()
    await expect(taskRow(page, title)).toHaveCount(0)

    await page.goto(destination.url)
    await expect(taskRow(page, title)).toBeVisible()
  })

  test('AC5: the moved task keeps its title, notes, due date, status and tags', async ({ page }) => {
    const title = uniqueName('Repaint the shed')
    const destination = await newList(page, 'Target')
    await newList(page, 'Source')
    await addTask(page, title)

    await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${title}`, exact: true })
    await form.getByLabel('Notes', { exact: true }).fill('Two coats, outside only.')
    await form.getByLabel('Due date', { exact: true }).fill('2030-05-06')
    await form.getByLabel('New tag', { exact: true }).fill('garden')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    // The form closes only once the server has saved the task.
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await statusButton(page, title).click()
    await expect(taskRow(page, title)).toContainText('Doing')
    await expectTasksSaved(page)

    await moveTaskToList(page, title, destination.name)

    await page.goto(destination.url)
    const row = taskRow(page, title)
    await expect(row).toContainText('Two coats, outside only.')
    await expect(row).toContainText('Due 2030-05-06')
    await expect(row.getByRole('list', { name: `Tags for ${title}`, exact: true })).toContainText('garden')
    await expect(page.getByRole('button', { name: `Doing: change status of ${title}`, exact: true })).toBeVisible()
  })

  test('AC6: the moved task keeps its subtasks, with the same ones ticked', async ({ page }) => {
    const title = uniqueName('Repaint the shed')
    const ticked = uniqueName('Buy paint')
    const untouched = uniqueName('Sand the door')
    const destination = await newList(page, 'Target')
    await newList(page, 'Source')
    await addTask(page, title)
    await addSubtask(page, title, ticked)
    await addSubtask(page, title, untouched)
    await subtasksList(page, title).getByRole('checkbox', { name: ticked, exact: true }).check()
    await expectTasksSaved(page)

    await moveTaskToList(page, title, destination.name)

    await page.goto(destination.url)
    const subtasks = subtasksList(page, title)
    await expect(subtasks.getByRole('checkbox', { name: ticked, exact: true })).toBeChecked()
    await expect(subtasks.getByRole('checkbox', { name: untouched, exact: true })).not.toBeChecked()
  })

  test('AC7: the moved task is placed after every task already in the destination list', async ({ page }) => {
    const first = uniqueName('Sort the shelves')
    const second = uniqueName('Sweep the floor')
    const moved = uniqueName('Repaint the shed')
    const destination = await newList(page, 'Target')
    await addTask(page, first)
    await addTask(page, second)
    await newList(page, 'Source')
    await addTask(page, moved)

    await moveTaskToList(page, moved, destination.name)

    // The destination is this test's own list, so its whole order can be asserted.
    await page.goto(destination.url)
    const tasks = page.getByRole('list', { name: 'Tasks', exact: true }).getByRole('listitem')
    await expect(tasks).toHaveCount(3)
    await expect(tasks.nth(0)).toContainText(first)
    await expect(tasks.nth(1)).toContainText(second)
    await expect(tasks.nth(2)).toContainText(moved)
  })

  test('AC8: the source list shows a notice naming the destination once the move is confirmed', async ({ page }) => {
    const title = uniqueName('Repaint the shed')
    const destination = await newList(page, 'Target')
    await newList(page, 'Source')
    await addTask(page, title)

    const form = await chooseDestination(page, title, destination.name)
    await form.getByRole('button', { name: 'Move task', exact: true }).click()

    // A notice like the one a deletion shows, naming the list the task went to.
    await expect(movedNotice(page, destination.name)).toBeVisible(SERVER_CONFIRMED)
  })

  test('AC9: the source list shows Saving… while the move is unconfirmed', async ({ page }) => {
    const title = uniqueName('Repaint the shed')
    const destination = await newList(page, 'Target')
    await newList(page, 'Source')
    await addTask(page, title)
    const saving = page.getByText('Saving…', { exact: true })
    await expect(saving).toHaveCount(0)

    // Offline the server can't confirm the move, so the indicator stays up while the move is unconfirmed.
    await page.context().setOffline(true)
    const form = await chooseDestination(page, title, destination.name)
    await form.getByRole('button', { name: 'Move task', exact: true }).click()
    await expect(saving).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: /^Saving…$/ })).toBeVisible()

    await page.context().setOffline(false)
    await expect(saving).toHaveCount(0, SERVER_CONFIRMED)
  })

  test('AC10: an overdue task that is moved is on Today under the destination list, not the source one', async ({ page }) => {
    const title = uniqueName('Repaint the shed')
    const destination = await newList(page, 'Target')
    const source = await newList(page, 'Source')
    await addTask(page, title)
    await setDueDate(page, title, '2020-02-03')

    await page.goto('/today')
    await expect(page.getByRole('list', { name: `Due in ${source.name}`, exact: true })).toContainText(title)

    await page.goto(source.url)
    await moveTaskToList(page, title, destination.name)

    await page.goto('/today')
    await expect(page.getByRole('list', { name: `Due in ${destination.name}`, exact: true })).toContainText(title)
    await expect(page.getByRole('list', { name: `Due in ${source.name}`, exact: true })).toHaveCount(0)
  })

  test('AC11: a move the server refuses leaves the task whole in the source list', async ({ page, browser }) => {
    const title = uniqueName('Repaint the shed')
    const subtask = uniqueName('Buy paint')
    const destination = await newList(page, 'Target')
    await newList(page, 'Source')
    await addTask(page, title)
    await addSubtask(page, title, subtask)

    // Offline this page still offers the destination list while another session deletes it, so the move it sends is refused.
    await page.context().setOffline(true)
    const other = await browser.newContext({ storageState: STORAGE_STATE })
    const otherPage = await other.newPage()
    await otherPage.goto(BASE_URL)
    await otherPage.getByRole('button', { name: `Delete ${destination.name}`, exact: true }).click()
    await otherPage.getByRole('button', { name: 'Delete list', exact: true }).click()
    await expect(otherPage.getByText(`Deleted "${destination.name}".`, { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await other.close()

    const form = await chooseDestination(page, title, destination.name)
    await form.getByRole('button', { name: 'Move task', exact: true }).click()
    await page.context().setOffline(false)

    // The refused move is undone whole: the task is back in the source list, with its subtask, and never half gone.
    await expect(taskRow(page, title)).toBeVisible(SERVER_CONFIRMED)
    await page.reload()
    await expect(taskRow(page, title)).toBeVisible()
    await expect(subtasksList(page, title).getByRole('checkbox', { name: subtask, exact: true })).toBeVisible()
  })
})
