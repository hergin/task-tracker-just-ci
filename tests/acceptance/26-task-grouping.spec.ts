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

// Grouping tasks on a list page. The spec leaves the markup open, so these tests hold the feature to this accessible shape:
//  - every task row carries a checkbox named `Select <task title>`, and the page has a `Group name` field and a
//    `Group selected` button;
//  - a group's open tasks are a list named `Tasks in <group name>` and its done tasks a list named
//    `Done tasks in <group name>`, each block headed by a heading showing the group's name;
//  - each block carries `Rename <group name>` (opening a `Name for <group name>` field with Save and Cancel) and
//    `Delete <group name>`.

/** The checkbox that picks the task titled `title` for grouping. */
function selectBox(page: Page, title: string): Locator {
  return page.getByRole('checkbox', { name: `Select ${title}`, exact: true })
}

/** The `Group name` field a new group is named in. */
function groupNameField(page: Page): Locator {
  return page.getByLabel('Group name', { exact: true })
}

/** The open tasks of the group named `name`. */
function openGroup(page: Page, name: string): Locator {
  return page.getByRole('list', { name: `Tasks in ${name}`, exact: true })
}

/** The done tasks of the group named `name`, inside the Done section. */
function doneGroup(page: Page, name: string): Locator {
  return page.getByRole('list', { name: `Done tasks in ${name}`, exact: true })
}

/** The heading that shows a group block's name. */
function groupHeading(page: Page, name: string): Locator {
  return page.getByRole('heading', { name, exact: true })
}

/** The row of the task titled `title` inside the group block `block`. */
function rowIn(page: Page, block: Locator, title: string): Locator {
  return block.getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) })
}

/** Ticks the tasks, types the group's name and presses Group selected, without waiting for the server. */
async function pressGroupSelected(page: Page, titles: readonly string[], name: string): Promise<void> {
  for (const title of titles) await selectBox(page, title).check()
  await groupNameField(page).fill(name)
  await page.getByRole('button', { name: 'Group selected', exact: true }).click()
}

/** Groups the tasks under `name` and waits until the server has saved it: the Group name field clears only then. */
async function groupTasks(page: Page, titles: readonly string[], name: string): Promise<void> {
  await pressGroupSelected(page, titles, name)
  await expect(groupNameField(page), 'the group was saved').toHaveValue('', SERVER_CONFIRMED)
}

/** Creates a fresh list holding `titles` in that order, and returns its name. */
async function openListWith(page: Page, ...titles: string[]): Promise<string> {
  const listName = await openNewList(page, 'Grouping')
  for (const title of titles) await addTask(page, title)
  return listName
}

/** Takes a task from To do to Done and waits until the server has saved it. */
async function markDone(page: Page, title: string): Promise<void> {
  const status = statusButton(page, title)
  await status.click()
  await expect(status).toHaveText('Doing')
  await status.click()
  // A done task leaves the open tasks for the Done section, which starts collapsed.
  await expect(page.getByRole('button', { name: /^Done \(\d+\)$/ })).toBeVisible()
  await expectTasksSaved(page)
}

/** Expands the Done section of a list page. Its name carries a count other steps can change. */
async function showDone(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Done \(\d+\)$/ }).click()
}

/** Asserts the page shows these task titles and group names in this order, top to bottom. */
async function expectOrder(page: Page, parts: readonly string[]): Promise<void> {
  await expect(page.getByRole('main')).toHaveText(new RegExp(parts.map(escapeRegExp).join('[\\s\\S]*')))
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test.describe('task grouping', () => {
  test('AC1: every task row has a Select checkbox, done ones too, and ticking one leaves the others alone', async ({ page }) => {
    await openListWith(page, 'Alpha', 'Bravo', 'Charlie')
    await markDone(page, 'Charlie')
    await showDone(page)

    await expect(selectBox(page, 'Alpha')).toBeVisible()
    await expect(selectBox(page, 'Bravo')).toBeVisible()
    await expect(selectBox(page, 'Charlie')).toBeVisible()

    await selectBox(page, 'Alpha').check()
    await expect(selectBox(page, 'Alpha')).toBeChecked()
    await expect(selectBox(page, 'Bravo')).not.toBeChecked()
    await expect(selectBox(page, 'Charlie')).not.toBeChecked()

    await selectBox(page, 'Alpha').uncheck()
    await expect(selectBox(page, 'Alpha')).not.toBeChecked()
    await expect(selectBox(page, 'Bravo')).not.toBeChecked()
  })

  test('AC2: grouping two of three tasks shows a block with those two and leaves the third loose', async ({ page }) => {
    await openListWith(page, 'Alpha', 'Bravo', 'Charlie')

    await groupTasks(page, ['Alpha', 'Charlie'], 'Errands')

    await expect(groupHeading(page, 'Errands')).toBeVisible()
    await expect(openGroup(page, 'Errands').getByRole('listitem')).toHaveText([/Alpha/, /Charlie/])
    await expect(openGroup(page, 'Errands').getByText('Bravo', { exact: true })).toHaveCount(0)
    await expect(taskRow(page, 'Bravo')).toBeVisible()
  })

  test('AC3: once the group is saved the checkboxes and the name field are clear, and the group survives a reload', async ({ page }) => {
    await openListWith(page, 'Alpha', 'Bravo')

    await pressGroupSelected(page, ['Alpha'], 'Errands')

    await expect(groupNameField(page)).toHaveValue('', SERVER_CONFIRMED)
    await expect(selectBox(page, 'Alpha')).not.toBeChecked()
    await expect(selectBox(page, 'Bravo')).not.toBeChecked()

    await page.reload()

    await expect(openGroup(page, 'Errands').getByRole('listitem')).toHaveText([/Alpha/])
  })

  test('AC4: the block sits where its first task was, and the loose tasks keep their order around it', async ({ page }) => {
    await openListWith(page, 'Alpha', 'Bravo', 'Charlie', 'Delta')

    await groupTasks(page, ['Bravo', 'Delta'], 'Errands')

    await expect(openGroup(page, 'Errands').getByRole('listitem')).toHaveText([/Bravo/, /Delta/])
    await expectOrder(page, ['Alpha', 'Errands', 'Bravo', 'Delta', 'Charlie'])
  })

  test('AC5: grouping refuses no selection, a blank name and a name over 200 characters, and saves the name trimmed', async ({ page }) => {
    await openListWith(page, 'Alpha')

    await groupNameField(page).fill('Errands')
    await page.getByRole('button', { name: 'Group selected', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Select at least one task.')
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)

    await selectBox(page, 'Alpha').check()
    await groupNameField(page).fill('   ')
    await page.getByRole('button', { name: 'Group selected', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Group name is required.')

    await groupNameField(page).fill('n'.repeat(201))
    await page.getByRole('button', { name: 'Group selected', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Group name must be 200 characters or fewer.')

    // 200 characters, typed with spaces around them: accepted, and saved trimmed.
    const longName = 'n'.repeat(200)
    await groupNameField(page).fill(`  ${longName}  `)
    await page.getByRole('button', { name: 'Group selected', exact: true }).click()
    await expect(groupNameField(page)).toHaveValue('', SERVER_CONFIRMED)
    await expect(groupHeading(page, longName)).toBeVisible()
    await expect(openGroup(page, longName).getByRole('listitem')).toHaveText([/Alpha/])
  })

  test('AC6: grouping a task again moves it out of its old group, and a group left with no tasks is gone', async ({ page }) => {
    await openListWith(page, 'Alpha', 'Bravo', 'Charlie')
    await groupTasks(page, ['Alpha', 'Charlie'], 'Errands')

    await groupTasks(page, ['Alpha', 'Bravo'], 'Work')

    await expect(openGroup(page, 'Work').getByRole('listitem')).toHaveText([/Alpha/, /Bravo/])
    await expect(openGroup(page, 'Errands').getByRole('listitem')).toHaveText([/Charlie/])

    await groupTasks(page, ['Charlie'], 'Chores')

    await expect(openGroup(page, 'Chores').getByRole('listitem')).toHaveText([/Charlie/])
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)
    await expect(openGroup(page, 'Errands')).toHaveCount(0)
  })

  test('AC7: a group can be renamed, refuses a blank or too long name, and Cancel leaves the name alone', async ({ page }) => {
    await openListWith(page, 'Alpha', 'Bravo')
    await groupTasks(page, ['Alpha', 'Bravo'], 'Errands')

    await page.getByRole('button', { name: 'Rename Errands', exact: true }).click()
    const nameField = page.getByLabel('Name for Errands', { exact: true })
    await expect(nameField).toHaveValue('Errands')

    await nameField.fill('   ')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Group name is required.')

    await nameField.fill('y'.repeat(201))
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Group name must be 200 characters or fewer.')

    await nameField.fill('Shopping')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(groupHeading(page, 'Errands')).toBeVisible()
    await expect(groupHeading(page, 'Shopping')).toHaveCount(0)

    await page.getByRole('button', { name: 'Rename Errands', exact: true }).click()
    await page.getByLabel('Name for Errands', { exact: true }).fill('Shopping')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    // The heading changes only once the server has saved the new name.
    await expect(groupHeading(page, 'Shopping')).toBeVisible(SERVER_CONFIRMED)
    await expect(openGroup(page, 'Shopping').getByRole('listitem')).toHaveText([/Alpha/, /Bravo/])
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)
  })

  test('AC8: deleting a group keeps its tasks, with everything on them, as loose tasks', async ({ page }) => {
    await openListWith(page, 'Alpha', 'Bravo')

    await page.getByRole('button', { name: 'Edit Alpha', exact: true }).click()
    const form = page.getByRole('form', { name: 'Edit Alpha', exact: true })
    await form.getByLabel('Notes', { exact: true }).fill('Bring the receipt')
    await form.getByLabel('Due date', { exact: true }).fill('2030-03-04')
    await form.getByLabel('New tag', { exact: true }).fill('urgent')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)

    const subtaskField = page.getByLabel('New subtask for Alpha', { exact: true })
    await subtaskField.fill('Check the list')
    await page.getByRole('button', { name: 'Add subtask to Alpha', exact: true }).click()
    await expect(subtaskField).toHaveValue('', SERVER_CONFIRMED)

    await statusButton(page, 'Bravo').click()
    await expect(statusButton(page, 'Bravo')).toHaveText('Doing')
    await expectTasksSaved(page)

    await groupTasks(page, ['Alpha', 'Bravo'], 'Errands')
    await page.getByRole('button', { name: 'Delete Errands', exact: true }).click()

    // The notice appears only once the server has deleted the group.
    await expect(page.getByText('Deleted "Errands".', { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)

    await page.reload()

    const alpha = taskRow(page, 'Alpha')
    await expect(alpha).toContainText('To do')
    await expect(alpha).toContainText('Bring the receipt')
    await expect(alpha).toContainText('Due 2030-03-04')
    await expect(alpha).toContainText('urgent')
    await expect(page.getByRole('list', { name: 'Subtasks for Alpha', exact: true })).toContainText('Check the list')
    await expect(taskRow(page, 'Bravo')).toContainText('Doing')
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)
  })

  test("AC9: a grouped task's own controls work, and deleting a group's last task takes the block away", async ({ page }) => {
    await openListWith(page, 'Alpha', 'Bravo')
    await groupTasks(page, ['Alpha', 'Bravo'], 'Errands')
    const block = openGroup(page, 'Errands')

    await statusButton(page, 'Alpha').click()
    await expect(rowIn(page, block, 'Alpha')).toContainText('Doing')

    await page.getByRole('button', { name: 'Edit Alpha', exact: true }).click()
    const form = page.getByRole('form', { name: 'Edit Alpha', exact: true })
    await form.getByLabel('Title', { exact: true }).fill('Alpha renamed')
    await form.getByLabel('New tag', { exact: true }).fill('urgent')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await expect(rowIn(page, block, 'Alpha renamed')).toContainText('urgent')
    await expect(rowIn(page, block, 'Bravo')).toBeVisible()

    const subtaskField = page.getByLabel('New subtask for Bravo', { exact: true })
    await subtaskField.fill('Step one')
    await page.getByRole('button', { name: 'Add subtask to Bravo', exact: true }).click()
    await expect(subtaskField).toHaveValue('', SERVER_CONFIRMED)
    await expect(block.getByRole('list', { name: 'Subtasks for Bravo', exact: true })).toContainText('Step one')

    await page.getByRole('button', { name: 'Delete Alpha renamed', exact: true }).click()
    await expect(page.getByText('Deleted "Alpha renamed".', { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expect(rowIn(page, block, 'Bravo')).toBeVisible()

    await page.getByRole('button', { name: 'Delete Bravo', exact: true }).click()
    await expect(page.getByText('Deleted "Bravo".', { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)
    await expect(openGroup(page, 'Errands')).toHaveCount(0)
  })

  test('AC10: a done task stays in its group, in a block of its own in the Done section', async ({ page }) => {
    await openListWith(page, 'Alpha', 'Bravo', 'Charlie')
    await markDone(page, 'Charlie')
    await showDone(page)

    // Ticking the done task together with the open ones groups them all.
    await groupTasks(page, ['Alpha', 'Bravo', 'Charlie'], 'Errands')

    await expect(openGroup(page, 'Errands').getByRole('listitem')).toHaveText([/Alpha/, /Bravo/])
    await expect(doneGroup(page, 'Errands').getByRole('listitem')).toHaveText([/Charlie/])
    await expect(openGroup(page, 'Errands').getByText('Charlie', { exact: true })).toHaveCount(0)
    // One heading for the open block, one for the block in the Done section.
    await expect(groupHeading(page, 'Errands')).toHaveCount(2)

    await statusButton(page, 'Bravo').click()
    await expect(rowIn(page, openGroup(page, 'Errands'), 'Bravo')).toContainText('Doing')
    await statusButton(page, 'Bravo').click()

    await expect(doneGroup(page, 'Errands').getByRole('listitem')).toHaveText([/Bravo/, /Charlie/])
    await expect(openGroup(page, 'Errands').getByRole('listitem')).toHaveText([/Alpha/])
  })

  test('AC11: reordering moves a task within its block only', async ({ page }) => {
    await openListWith(page, 'Alpha', 'Bravo', 'Charlie', 'Delta')
    await groupTasks(page, ['Bravo', 'Charlie'], 'Errands')
    const block = openGroup(page, 'Errands')

    await block.getByRole('button', { name: 'Reorder Bravo', exact: true }).press('ArrowDown')
    await expect(block.getByRole('listitem')).toHaveText([/Charlie/, /Bravo/])
    await expectTasksSaved(page)

    // Bravo is last in its block: ArrowDown can't take it out of the block.
    await block.getByRole('button', { name: 'Reorder Bravo', exact: true }).press('ArrowDown')
    await expect(block.getByRole('listitem')).toHaveText([/Charlie/, /Bravo/])

    // Charlie is first in its block: ArrowUp can't take it out either.
    await block.getByRole('button', { name: 'Reorder Charlie', exact: true }).press('ArrowUp')
    await expect(block.getByRole('listitem')).toHaveText([/Charlie/, /Bravo/])

    // Dragging a grouped task onto a loose one leaves it in its group.
    await block.getByRole('button', { name: 'Reorder Charlie', exact: true }).dragTo(taskRow(page, 'Alpha'))
    await expect(block.getByRole('listitem')).toHaveText([/Charlie/, /Bravo/])
    await expectOrder(page, ['Alpha', 'Errands', 'Charlie', 'Bravo', 'Delta'])
  })

  test('AC12: the page shows Saving… while a group change is unconfirmed', async ({ page }) => {
    await openListWith(page, 'Alpha', 'Bravo')
    await selectBox(page, 'Alpha').check()
    await groupNameField(page).fill('Errands')

    // Offline the write stays unconfirmed for as long as the test needs, so "Saving…" can't come and go unseen.
    await page.context().setOffline(true)
    await page.getByRole('button', { name: 'Group selected', exact: true }).click()
    await expect(page.getByText('Saving…', { exact: true })).toBeVisible()

    await page.context().setOffline(false)

    await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0, SERVER_CONFIRMED)
    await expect(openGroup(page, 'Errands').getByRole('listitem')).toHaveText([/Alpha/])
  })

  test('AC13: a filtered or date-ordered list shows its tasks flat, and the normal view brings the groups back', async ({ page }) => {
    await openListWith(page, 'Alpha', 'Bravo')
    await page.getByRole('button', { name: 'Edit Alpha', exact: true }).click()
    const form = page.getByRole('form', { name: 'Edit Alpha', exact: true })
    await form.getByLabel('New tag', { exact: true }).fill('home')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await groupTasks(page, ['Alpha'], 'Errands')
    const statusFilter = page.getByRole('radiogroup', { name: 'Filter by status', exact: true })
    const order = page.getByRole('radiogroup', { name: 'Order by', exact: true })
    const groupButton = page.getByRole('button', { name: 'Group selected', exact: true })

    await statusFilter.getByRole('radio', { name: 'To do', exact: true }).click()
    await expect(taskRow(page, 'Alpha')).toBeVisible()
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)
    await expect(openGroup(page, 'Errands')).toHaveCount(0)
    await expect(selectBox(page, 'Alpha')).toHaveCount(0)
    await expect(groupButton).toHaveCount(0)

    await statusFilter.getByRole('radio', { name: 'All', exact: true }).click()
    await expect(groupHeading(page, 'Errands')).toBeVisible()

    await order.getByRole('radio', { name: 'Due date', exact: true }).click()
    await expect(taskRow(page, 'Alpha')).toBeVisible()
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)
    await expect(selectBox(page, 'Alpha')).toHaveCount(0)
    await expect(groupButton).toHaveCount(0)

    await order.getByRole('radio', { name: 'Saved order', exact: true }).click()
    await expect(groupHeading(page, 'Errands')).toBeVisible()

    await rowIn(page, openGroup(page, 'Errands'), 'Alpha').getByRole('button', { name: 'Show tasks tagged home', exact: true }).click()
    await expect(page.getByText('Showing tasks tagged "home"', { exact: true })).toBeVisible()
    await expect(taskRow(page, 'Alpha')).toBeVisible()
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)
    await expect(selectBox(page, 'Alpha')).toHaveCount(0)
    await expect(groupButton).toHaveCount(0)

    await page.getByRole('button', { name: 'Show all tasks', exact: true }).click()
    await expect(groupHeading(page, 'Errands')).toBeVisible()
  })

  test('AC14: the shared page, Today and search show the tasks as before, with no groups', async ({ page, browser }) => {
    const groupName = uniqueName('Errands')
    const dated = uniqueName('Grouped and due')
    const other = uniqueName('Grouped task')
    const listName = await openNewList(page, 'Grouping')
    await addTask(page, dated)
    await addTask(page, other)
    await setDueDate(page, dated, todayInUtc())
    await groupTasks(page, [dated, other], groupName)

    await page.getByRole('button', { name: 'Share read-only', exact: true }).click()
    const shareLink = page.getByRole('textbox', { name: 'Share link', exact: true })
    await expect(shareLink).toBeVisible(SERVER_CONFIRMED)

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(await shareLink.inputValue())
    await expect(visitorPage.getByRole('list', { name: 'Tasks', exact: true }).getByRole('listitem')).toHaveText([
      new RegExp(escapeRegExp(dated)),
      new RegExp(escapeRegExp(other)),
    ])
    await expect(visitorPage.getByText(groupName, { exact: true })).toHaveCount(0)
    await visitor.close()

    await page.goto('/today')
    await expect(page.getByRole('list', { name: `Due in ${listName}`, exact: true }).getByRole('listitem')).toHaveText([
      new RegExp(escapeRegExp(dated)),
    ])
    await expect(page.getByText(groupName, { exact: true })).toHaveCount(0)

    await page.getByRole('textbox', { name: 'Search tasks', exact: true }).fill(other)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(
      page.getByRole('list', { name: 'Search results', exact: true }).getByRole('link', { name: `${other} in ${listName}`, exact: true }),
    ).toBeVisible()
    await expect(page.getByText(groupName, { exact: true })).toHaveCount(0)
  })

  test('AC15: a group belongs to its own list and shows up in no other', async ({ page }) => {
    await openListWith(page, 'Alpha')
    await groupTasks(page, ['Alpha'], 'Errands')

    await openListWith(page, 'Bravo')

    await expect(taskRow(page, 'Bravo')).toBeVisible()
    await expect(groupHeading(page, 'Errands')).toHaveCount(0)
    await expect(openGroup(page, 'Errands')).toHaveCount(0)
  })
})
