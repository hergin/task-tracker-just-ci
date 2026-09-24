import { expect, test, type Page } from '@playwright/test'
import { SERVER_CONFIRMED, addTask, openNewList, taskRow, todayInUtc } from './support/data'

/**
 * The new-task form on a list page, by its accessible name: the page already has another control labelled "Due date",
 * the "Due date" radio of the "Order by" group, so the form's own due date field is only unambiguous within the form.
 */
function newTaskForm(page: Page) {
  return page.getByRole('form', { name: 'Add task', exact: true })
}

/** On a list page: adds a task with a title and a due date in one go, and waits until the server has saved it. */
async function addDatedTask(page: Page, title: string, dueDate: string): Promise<void> {
  const titleInput = page.getByLabel('New task', { exact: true })
  await titleInput.fill(title)
  await newTaskForm(page).getByLabel('Due date', { exact: true }).fill(dueDate)
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  // The form clears only once the server confirms the write.
  await expect(titleInput, 'the new task was saved').toHaveValue('', SERVER_CONFIRMED)
}

test.describe('give a task a due date as you add it', () => {
  test('AC1: the new-task form has a Due date field beside the title field, empty by default', async ({ page }) => {
    await page.goto('/lists/list-groceries')

    const form = newTaskForm(page)
    await expect(form.getByLabel('New task', { exact: true })).toHaveValue('')
    await expect(form.getByLabel('Due date', { exact: true })).toHaveValue('')
  })

  test('AC2: a task added with a due date shows that due date on its row straight away', async ({ page }) => {
    await openNewList(page, 'Dated add')

    await addDatedTask(page, 'Renew the passport', '2026-10-03')

    await expect(taskRow(page, 'Renew the passport')).toContainText('Due 2026-10-03')
  })

  test('AC3: a task added with the due date left empty has no due date', async ({ page }) => {
    await openNewList(page, 'Undated add')
    await expect(newTaskForm(page).getByLabel('Due date', { exact: true })).toHaveValue('')

    await addTask(page, 'Sharpen the knives')

    const row = taskRow(page, 'Sharpen the knives')
    await expect(row).toContainText('To do')
    await expect(row.getByText(/^Due /)).toHaveCount(0)
    await page.reload()
    await expect(taskRow(page, 'Sharpen the knives')).toContainText('To do')
    await expect(taskRow(page, 'Sharpen the knives').getByText(/^Due /)).toHaveCount(0)
  })

  test("AC4: a task added with today's date appears on the Today page", async ({ page }) => {
    const listName = await openNewList(page, 'Due today add')

    await addDatedTask(page, 'Call the dentist', todayInUtc())

    await page.getByRole('link', { name: 'Today', exact: true }).click()
    await expect(page.getByRole('list', { name: `Due in ${listName}`, exact: true }).getByRole('listitem')).toHaveText([
      /Call the dentist.*Due today/,
    ])
  })

  test('AC5: the title and the due date field are both empty again after a task is added', async ({ page }) => {
    await openNewList(page, 'Add form clears')

    await addDatedTask(page, 'Collect the parcel', '2026-10-05')

    await expect(taskRow(page, 'Collect the parcel')).toContainText('Due 2026-10-05')
    await expect(page.getByLabel('New task', { exact: true })).toHaveValue('')
    await expect(newTaskForm(page).getByLabel('Due date', { exact: true })).toHaveValue('')
  })

  /**
   * A native date field keeps out most nonsense, but not a five-digit year: Chromium accepts 52026-12-04 as a value,
   * and the app's own validation refuses it, as the task edit form already does ("Due date must be a real date.").
   */
  test('AC6: adding a task with an invalid due date creates nothing and shows the error next to the form', async ({ page }) => {
    await openNewList(page, 'Invalid date add')

    await page.getByLabel('New task', { exact: true }).fill('Renew the lease')
    await newTaskForm(page).getByLabel('Due date', { exact: true }).fill('52026-12-04')
    await page.getByRole('button', { name: 'Add task', exact: true }).click()

    await expect(page.getByRole('alert')).toHaveText('Due date must be a real date.')
    // The list was empty, so this message proves the tasks have loaded and none was created.
    await expect(page.getByText('No tasks yet.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText('No tasks yet.', { exact: true })).toBeVisible()
  })
})
