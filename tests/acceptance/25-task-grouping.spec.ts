import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  SERVER_CONFIRMED,
  addTask,
  expectTasksSaved,
  openNewList,
  setDueDate,
  statusButton,
  taskRow,
  todayInUtc,
  uniqueName,
} from './support/data'

/** The checkbox that picks the task titled `title` for grouping. */
function selectCheckbox(page: Page, title: string): Locator {
  return page.getByRole('checkbox', { name: `Select ${title}`, exact: true })
}

/** The name field of the form that makes a group: gone once the form is closed. */
function groupNameField(page: Page): Locator {
  return page.getByRole('textbox', { name: 'Group name', exact: true })
}

/** A group's heading, wherever the group is shown. */
function groupHeading(page: Page, name: string): Locator {
  return page.getByRole('heading', { name, exact: true })
}

/** Ticks `titles` and opens the form that names the new group. */
async function openGroupForm(page: Page, titles: string[]): Promise<void> {
  for (const title of titles) await selectCheckbox(page, title).check()
  await page.getByRole('button', { name: 'Group selected', exact: true }).click()
}

/** Ticks `titles`, groups them under `name` and waits until the server has saved the group. */
async function groupTasks(page: Page, titles: string[], name: string): Promise<void> {
  await openGroupForm(page, titles)
  await groupNameField(page).fill(name)
  await page.getByRole('button', { name: 'Create group', exact: true }).click()
  // The form closes only once the server confirms the write.
  await expect(groupNameField(page), 'the new group was saved').toHaveCount(0, SERVER_CONFIRMED)
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Asserts the list page shows these texts one after another, whichever markup a group's heading and its tasks are
 * built from. Every text is a title or a group name unique to this page, so each can match in one place only.
 */
async function expectShownInOrder(page: Page, texts: string[]): Promise<void> {
  await expect(page.getByRole('main')).toHaveText(new RegExp(texts.map(escapeForRegExp).join('[\\s\\S]*?')))
}

/** Cycles a task's status one step (To do → Doing → Done → Postponed → To do). */
async function advanceStatus(page: Page, title: string): Promise<void> {
  await statusButton(page, title).click()
}

test.describe('group tasks in a list', () => {
  test('AC1: every task offers a Select checkbox, and Group selected enables once one is ticked', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    const groupSelected = page.getByRole('button', { name: 'Group selected', exact: true })

    await expect(selectCheckbox(page, 'Alpha')).toBeVisible()
    await expect(selectCheckbox(page, 'Alpha')).not.toBeChecked()
    await expect(selectCheckbox(page, 'Beta')).not.toBeChecked()
    await expect(groupSelected).toBeDisabled()

    await selectCheckbox(page, 'Alpha').check()

    await expect(groupSelected).toBeEnabled()
  })

  test('AC2: Group selected opens a naming form, and Cancel closes it without making a group', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')

    await openGroupForm(page, ['Alpha'])

    await expect(groupNameField(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create group', exact: true })).toBeVisible()
    await groupNameField(page).fill('Errands')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    await expect(groupNameField(page)).toHaveCount(0)
    await page.reload()
    // The task proves the page has loaded before the absence of the group is asserted.
    await expect(taskRow(page, 'Alpha')).toBeVisible()
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)
  })

  test('AC3: grouping two of four tasks shows the ungrouped ones first, then the group with its two', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await addTask(page, 'Gamma')
    await addTask(page, 'Delta')

    await groupTasks(page, ['Alpha', 'Gamma'], 'Errands')

    await expectShownInOrder(page, ['Beta', 'Delta', 'Errands', 'Alpha', 'Gamma'])
    await expect(selectCheckbox(page, 'Alpha')).not.toBeChecked()
    await expect(selectCheckbox(page, 'Gamma')).not.toBeChecked()
  })

  test('AC4: a grouped task keeps its details, and its status, edit and delete controls still work', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await page.getByRole('button', { name: 'Edit Alpha', exact: true }).click()
    const form = page.getByRole('form', { name: 'Edit Alpha', exact: true })
    await form.getByLabel('Notes', { exact: true }).fill('Bring the receipt')
    await form.getByLabel('Due date', { exact: true }).fill('2030-03-04')
    await form.getByLabel('New tag', { exact: true }).fill('urgent')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    const subtaskInput = page.getByLabel('New subtask for Alpha', { exact: true })
    await subtaskInput.fill('Find the receipt')
    await page.getByRole('button', { name: 'Add subtask to Alpha', exact: true }).click()
    await expect(subtaskInput, 'the new subtask was saved').toHaveValue('', SERVER_CONFIRMED)

    await groupTasks(page, ['Alpha', 'Beta'], 'Errands')

    await expect(groupHeading(page, 'Errands')).toBeVisible()
    await expect(taskRow(page, 'Alpha')).toContainText('To do')
    await expect(taskRow(page, 'Alpha')).toContainText('Bring the receipt')
    await expect(taskRow(page, 'Alpha')).toContainText('Due 2030-03-04')
    await expect(taskRow(page, 'Alpha')).toContainText('urgent')
    await expect(taskRow(page, 'Alpha')).toContainText('Find the receipt')

    await advanceStatus(page, 'Alpha')
    await expect(taskRow(page, 'Alpha')).toContainText('Doing')

    await page.getByRole('button', { name: 'Edit Alpha', exact: true }).click()
    await form.getByLabel('Title', { exact: true }).fill('Alpha renamed')
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await expect(taskRow(page, 'Alpha renamed')).toBeVisible()

    await page.getByRole('button', { name: 'Delete Beta', exact: true }).click()
    // The notice appears only once the server has deleted the task.
    await expect(page.getByText('Deleted "Beta".', { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expectShownInOrder(page, ['Errands', 'Alpha renamed'])
  })

  test('AC5: a group with open and done tasks shows under both, and Done counts tasks', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await addTask(page, 'Gamma')
    await groupTasks(page, ['Alpha', 'Beta'], 'Errands')

    // Beta (grouped) and Gamma (ungrouped) to done: To do → Doing → Done.
    await advanceStatus(page, 'Beta')
    await advanceStatus(page, 'Beta')
    await advanceStatus(page, 'Gamma')
    await advanceStatus(page, 'Gamma')
    const doneToggle = page.getByRole('button', { name: 'Done (2)', exact: true })
    await expect(doneToggle).toBeVisible()
    await expectTasksSaved(page)

    await doneToggle.click()

    await expect(groupHeading(page, 'Errands')).toHaveCount(2)
    await expectShownInOrder(page, ['Errands', 'Alpha', 'Done (2)', 'Errands', 'Beta'])
  })

  test('AC6: a group name is trimmed, required, capped and unique within its list', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')

    await openGroupForm(page, ['Alpha'])
    await groupNameField(page).fill('   ')
    await page.getByRole('button', { name: 'Create group', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Group name is required.')

    // Over-long names are refused. The message itself can't be asserted through the UI: every text field in this app
    // caps its input (maxLength), and a capped field can't be filled past the cap, so what is checked is the outcome.
    const tooLong = 'E'.repeat(201)
    await groupNameField(page).fill(tooLong)
    await page.getByRole('button', { name: 'Create group', exact: true }).click()
    await expect(groupHeading(page, tooLong)).toHaveCount(0)

    await groupNameField(page).fill('  Errands  ')
    await page.getByRole('button', { name: 'Create group', exact: true }).click()
    await expect(groupNameField(page), 'the new group was saved').toHaveCount(0, SERVER_CONFIRMED)
    await expect(groupHeading(page, 'Errands')).toBeVisible()

    await openGroupForm(page, ['Beta'])
    await groupNameField(page).fill('Errands')
    await page.getByRole('button', { name: 'Create group', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('A group named Errands already exists in this list.')
    await expect(groupHeading(page, 'Errands')).toHaveCount(1)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    // The same name in another list is allowed.
    await openNewList(page, 'Grouping elsewhere')
    await addTask(page, 'Gamma')
    await groupTasks(page, ['Gamma'], 'Errands')
    await expect(groupHeading(page, 'Errands')).toBeVisible()
  })

  test('AC7: a group can be renamed, everywhere it is shown', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await groupTasks(page, ['Alpha', 'Beta'], 'Errands')
    await advanceStatus(page, 'Beta')
    await advanceStatus(page, 'Beta')
    const doneToggle = page.getByRole('button', { name: 'Done (1)', exact: true })
    await expect(doneToggle).toBeVisible()
    await expectTasksSaved(page)
    await doneToggle.click()
    await expect(groupHeading(page, 'Errands')).toHaveCount(2)
    // Collapsed again, so only the open tasks' copy of the group offers its rename control.
    await doneToggle.click()

    await page.getByRole('button', { name: 'Rename group Errands', exact: true }).click()
    const nameField = page.getByRole('textbox', { name: 'Name for Errands', exact: true })
    await expect(nameField).toHaveValue('Errands')
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()

    await nameField.fill('   ')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Group name is required.')

    // Saving the group's own name again is not an error.
    await nameField.fill('Errands')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(nameField, 'the unchanged name was saved').toHaveCount(0, SERVER_CONFIRMED)
    await expect(groupHeading(page, 'Errands')).toBeVisible()

    await page.getByRole('button', { name: 'Rename group Errands', exact: true }).click()
    await page.getByRole('textbox', { name: 'Name for Errands', exact: true }).fill('Weekend errands')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(groupHeading(page, 'Weekend errands')).toBeVisible(SERVER_CONFIRMED)

    await page.getByRole('button', { name: 'Done (1)', exact: true }).click()
    await expect(groupHeading(page, 'Weekend errands')).toHaveCount(2)
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)
  })

  test('AC8: deleting a group keeps its tasks, back among the ungrouped ones', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await addTask(page, 'Gamma')
    await advanceStatus(page, 'Gamma')
    await expect(taskRow(page, 'Gamma')).toContainText('Doing')
    await groupTasks(page, ['Alpha', 'Gamma'], 'Errands')
    await expectShownInOrder(page, ['Beta', 'Errands', 'Alpha', 'Gamma'])

    // One click, with nothing to confirm: the heading is gone straight after it.
    await page.getByRole('button', { name: 'Delete group Errands', exact: true }).click()

    await expect(groupHeading(page, 'Errands')).toHaveCount(0, SERVER_CONFIRMED)
    await expectShownInOrder(page, ['Alpha', 'Beta', 'Gamma'])
    await expect(taskRow(page, 'Gamma')).toContainText('Doing')
  })

  test('AC9: grouping tasks again moves them out of their old group', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await addTask(page, 'Gamma')
    await groupTasks(page, ['Alpha', 'Beta'], 'Errands')

    await groupTasks(page, ['Beta'], 'Shopping')

    await expectShownInOrder(page, ['Gamma', 'Errands', 'Alpha', 'Shopping', 'Beta'])

    // Errands has no tasks left once its last one moves away.
    await groupTasks(page, ['Alpha'], 'Chores')

    await expectShownInOrder(page, ['Gamma', 'Chores', 'Alpha', 'Shopping', 'Beta'])
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)
  })

  test('AC10: a group lives as long as it has tasks, whatever their status', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await groupTasks(page, ['Alpha', 'Beta'], 'Errands')

    await advanceStatus(page, 'Alpha')

    await expect(taskRow(page, 'Alpha')).toContainText('Doing')
    await expectShownInOrder(page, ['Errands', 'Alpha', 'Beta'])

    await page.getByRole('button', { name: 'Delete Beta', exact: true }).click()
    await expect(page.getByText('Deleted "Beta".', { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expect(groupHeading(page, 'Errands')).toBeVisible()

    await page.getByRole('button', { name: 'Delete Alpha', exact: true }).click()
    await expect(page.getByText('Deleted "Alpha".', { exact: true })).toBeVisible(SERVER_CONFIRMED)

    await expect(page.getByText('No tasks yet.', { exact: true })).toBeVisible()
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)
  })

  test('AC11: a group, its name and its tasks are still there after a reload', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await addTask(page, 'Gamma')
    await groupTasks(page, ['Alpha', 'Gamma'], 'Errands')
    await expectShownInOrder(page, ['Beta', 'Errands', 'Alpha', 'Gamma'])
    await expectTasksSaved(page)

    await page.reload()

    await expect(groupHeading(page, 'Errands')).toBeVisible()
    await expectShownInOrder(page, ['Beta', 'Errands', 'Alpha', 'Gamma'])
  })

  test('AC12: under the due date order and under a filter, tasks stay under their group', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await addTask(page, 'Gamma')
    await addTask(page, 'Delta')
    await groupTasks(page, ['Alpha', 'Gamma'], 'Errands')
    await groupTasks(page, ['Beta'], 'Chores')
    await setDueDate(page, 'Beta', '2026-06-05')
    await setDueDate(page, 'Gamma', '2026-06-10')

    await page.getByRole('radiogroup', { name: 'Order by', exact: true }).getByRole('radio', { name: 'Due date', exact: true }).click()

    // Ungrouped first, then the groups by their first shown task: Beta (05 June) before Gamma (10 June).
    await expectShownInOrder(page, ['Delta', 'Chores', 'Beta', 'Errands', 'Gamma', 'Alpha'])

    await page.getByRole('radiogroup', { name: 'Order by', exact: true }).getByRole('radio', { name: 'Saved order', exact: true }).click()
    await advanceStatus(page, 'Beta')
    await expect(taskRow(page, 'Beta')).toContainText('Doing')
    await page.getByRole('radiogroup', { name: 'Filter by status', exact: true }).getByRole('radio', { name: 'To do', exact: true }).click()

    await expectShownInOrder(page, ['Delta', 'Errands', 'Alpha', 'Gamma'])
    await expect(page.getByText('Beta', { exact: true })).toHaveCount(0)
    await expect(groupHeading(page, 'Chores')).toHaveCount(0)
  })

  test('AC13: reordering moves a task within its own group only', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await addTask(page, 'Gamma')
    await addTask(page, 'Delta')
    await groupTasks(page, ['Gamma', 'Delta'], 'Errands')

    await taskRow(page, 'Alpha').getByRole('button', { name: 'Reorder Alpha', exact: true }).press('ArrowDown')
    await expectShownInOrder(page, ['Beta', 'Alpha', 'Errands', 'Gamma', 'Delta'])

    // Alpha is the last ungrouped task now: moving it down again must not push it into the group.
    await taskRow(page, 'Alpha').getByRole('button', { name: 'Reorder Alpha', exact: true }).press('ArrowDown')
    await expectShownInOrder(page, ['Beta', 'Alpha', 'Errands', 'Gamma', 'Delta'])

    await taskRow(page, 'Delta').getByRole('button', { name: 'Reorder Delta', exact: true }).dragTo(taskRow(page, 'Gamma'))
    await expectShownInOrder(page, ['Beta', 'Alpha', 'Errands', 'Delta', 'Gamma'])

    // Delta is the first task of its group: moving it up must not take it out of the group.
    await taskRow(page, 'Delta').getByRole('button', { name: 'Reorder Delta', exact: true }).press('ArrowUp')
    await expectShownInOrder(page, ['Beta', 'Alpha', 'Errands', 'Delta', 'Gamma'])
  })

  test('AC14: a task added once groups exist starts ungrouped', async ({ page }) => {
    await openNewList(page, 'Grouping')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await groupTasks(page, ['Alpha', 'Beta'], 'Errands')

    await addTask(page, 'Gamma')

    await expectShownInOrder(page, ['Gamma', 'Errands', 'Alpha', 'Beta'])
  })

  test('AC15: /today, search results and a shared list show no group headings', async ({ page }) => {
    const groupName = uniqueName('Errands')
    const taskTitle = uniqueName('Collect the parcel')
    await openNewList(page, 'Grouping')
    await addTask(page, taskTitle)
    await setDueDate(page, taskTitle, todayInUtc())
    await groupTasks(page, [taskTitle], groupName)
    await expect(groupHeading(page, groupName)).toBeVisible()
    await page.getByRole('button', { name: 'Share read-only', exact: true }).click()
    const shareLink = page.getByRole('textbox', { name: 'Share link', exact: true })
    await expect(shareLink).toBeVisible(SERVER_CONFIRMED)
    const shareUrl = await shareLink.inputValue()

    await page.goto('/today')
    await expect(page.getByText(taskTitle, { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: groupName })).toHaveCount(0)

    await page.goto(`/search?q=${encodeURIComponent(taskTitle)}`)
    await expect(page.getByRole('list', { name: 'Search results', exact: true })).toContainText(taskTitle)
    await expect(page.getByRole('heading', { name: groupName })).toHaveCount(0)

    await page.goto(shareUrl)
    await expect(page.getByText(`To do ${taskTitle}`, { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: groupName })).toHaveCount(0)
  })
})
