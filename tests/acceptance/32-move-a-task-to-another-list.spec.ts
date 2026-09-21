import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  SERVER_CONFIRMED,
  addTask,
  expectTasksSaved,
  listRow,
  openNewList,
  setDueDate,
  statusButton,
  taskRow,
  uniqueName,
} from './support/data'

/** The control on a task's row that moves the task to another list. */
function moveControl(page: Page, taskTitle: string): Locator {
  return page.getByLabel(`Move ${taskTitle} to another list`, { exact: true })
}

/** Chooses a list in a task's move control, which moves the task at once. */
async function moveTaskTo(page: Page, taskTitle: string, listName: string): Promise<void> {
  await moveControl(page, taskTitle).selectOption({ label: listName })
}

/** Waits for the notice the source list's page shows once the server has moved the task. */
async function expectMoved(page: Page, taskTitle: string, listName: string): Promise<void> {
  await expect(page.getByText(`Moved "${taskTitle}" to "${listName}".`, { exact: true })).toBeVisible(SERVER_CONFIRMED)
}

/** Opens an existing list from the lists page. */
async function openList(page: Page, name: string): Promise<void> {
  await page.goto('/')
  await listRow(page, name).getByRole('link').click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

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

test.describe('move a task to another list', () => {
  test("AC1: a task row offers the user's other lists to move it to, and no one else's", async ({ page }) => {
    await page.goto('/lists/list-groceries')

    // The fixture's own lists are read here; other tests' lists can be among the choices too, so each is matched exactly.
    const control = moveControl(page, 'Buy milk')
    await expect(control).toBeVisible()
    await expect(control.getByRole('option', { name: 'Work', exact: true })).toHaveCount(1)
    await expect(control.getByRole('option', { name: 'Empty list', exact: true })).toHaveCount(1)
    await expect(control.getByRole('option', { name: 'Groceries', exact: true })).toHaveCount(0)
    await expect(control.getByRole('option', { name: 'Private list of another user', exact: true })).toHaveCount(0)

    // A done task has the control too; the Done group starts collapsed.
    await page.getByRole('button', { name: 'Done (1)', exact: true }).click()
    await expect(moveControl(page, 'Buy eggs')).toBeVisible()
  })

  test('AC2: choosing a list moves the task at once and the list it came from says so', async ({ page }) => {
    const target = await openNewList(page, 'Storage')
    await openNewList(page, 'Desk')
    const title = uniqueName('Sort the receipts')
    await addTask(page, title)

    await moveTaskTo(page, title, target)

    await expectMoved(page, title, target)
    await expect(taskRow(page, title)).toHaveCount(0)
  })

  test('AC3: the chosen list shows the task once, with everything it had, and the old list no longer has it', async ({ page }) => {
    const target = await openNewList(page, 'Archive')
    const source = await openNewList(page, 'Inbox')
    const title = uniqueName('File the contract')
    await addTask(page, title)

    await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${title}`, exact: true })
    await form.getByLabel('Notes', { exact: true }).fill('Two signed copies.')
    await form.getByLabel('Due date', { exact: true }).fill('2030-03-04')
    await form.getByLabel('Assigned to', { exact: true }).selectOption({ label: 'E2E Other' })
    await form.getByLabel('New tag', { exact: true }).fill('paperwork')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    // The form closes only once the server has saved the task.
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await statusButton(page, title).click()
    await expect(taskRow(page, title)).toContainText('Doing')
    await expectTasksSaved(page)

    await moveTaskTo(page, title, target)
    await expectMoved(page, title, target)

    await openList(page, target)
    const moved = taskRow(page, title)
    await expect(moved).toHaveCount(1)
    await expect(moved).toContainText('Doing')
    await expect(moved).toContainText('Two signed copies.')
    await expect(moved).toContainText('Due 2030-03-04')
    await expect(moved).toContainText('Assigned to E2E Other')
    await expect(moved.getByRole('list', { name: `Tags for ${title}`, exact: true })).toContainText('paperwork')

    await openList(page, source)
    await page.reload()
    // Proves the source list has loaded before its task count is checked.
    await expect(page.getByText('No tasks yet.', { exact: true })).toBeVisible()
    await expect(taskRow(page, title)).toHaveCount(0)
  })

  test('AC4: an open task lands after the open tasks already there, and a done task stays done', async ({ page }) => {
    const target = await openNewList(page, 'Next week')
    const first = uniqueName('Call the plumber')
    const second = uniqueName('Book the van')
    await addTask(page, first)
    await addTask(page, second)

    await openNewList(page, 'This week')
    const openTask = uniqueName('Pay the invoice')
    const doneTask = uniqueName('Collect the keys')
    await addTask(page, openTask)
    await addTask(page, doneTask)
    const status = statusButton(page, doneTask)
    await status.click()
    await expect(taskRow(page, doneTask)).toContainText('Doing')
    await status.click()
    await expect(page.getByRole('button', { name: 'Done (1)', exact: true })).toBeVisible()
    await expectTasksSaved(page)

    await moveTaskTo(page, openTask, target)
    await expectMoved(page, openTask, target)
    await page.getByRole('button', { name: 'Done (1)', exact: true }).click()
    await moveTaskTo(page, doneTask, target)
    await expectMoved(page, doneTask, target)

    await openList(page, target)
    const openRows = page.getByRole('list', { name: 'Tasks', exact: true }).getByRole('listitem')
    await expect(openRows).toContainText([first, second, openTask])
    await page.getByRole('button', { name: 'Done (1)', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Done tasks', exact: true }).getByRole('listitem')).toContainText([doneTask])
  })

  test('AC5: the moved task keeps its subtasks, with the same ones ticked', async ({ page }) => {
    const target = await openNewList(page, 'Projects')
    const source = await openNewList(page, 'Scratch')
    const title = uniqueName('Set up the office')
    await addTask(page, title)
    const one = uniqueName('Order a desk')
    const two = uniqueName('Order a chair')
    const three = uniqueName('Order a lamp')
    await addSubtask(page, title, one)
    await addSubtask(page, title, two)
    await addSubtask(page, title, three)
    await subtaskCheckbox(page, title, one).check()
    await subtaskCheckbox(page, title, three).check()
    await expect(taskRow(page, title)).toContainText('2 of 3')
    await expectTasksSaved(page)

    await moveTaskTo(page, title, target)
    await expectMoved(page, title, target)

    await openList(page, target)
    await expect(subtasksList(page, title).getByRole('listitem')).toContainText([one, two, three])
    await expect(subtaskCheckbox(page, title, one)).toBeChecked()
    await expect(subtaskCheckbox(page, title, two)).not.toBeChecked()
    await expect(subtaskCheckbox(page, title, three)).toBeChecked()
    await expect(taskRow(page, title)).toContainText('2 of 3')

    await openList(page, source)
    // Proves the source list has loaded before its subtasks are checked to be gone.
    await expect(page.getByText('No tasks yet.', { exact: true })).toBeVisible()
    await expect(page.getByText(one, { exact: true })).toHaveCount(0)
  })

  test('AC6: an overdue task that was moved is on Today under the list it moved to', async ({ page }) => {
    const target = await openNewList(page, 'Later')
    const source = await openNewList(page, 'Now')
    const title = uniqueName('Renew the licence')
    await addTask(page, title)
    await setDueDate(page, title, '2024-05-06')
    await expectTasksSaved(page)

    await moveTaskTo(page, title, target)
    await expectMoved(page, title, target)

    await page.getByRole('link', { name: 'Today', exact: true }).click()
    await expect(page.getByRole('list', { name: `Due in ${target}`, exact: true })).toContainText(title)
    await expect(page.getByRole('list', { name: `Due in ${source}`, exact: true })).toHaveCount(0)
  })
})
