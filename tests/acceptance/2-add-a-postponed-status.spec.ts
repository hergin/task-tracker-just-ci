import { expect, test, type Page } from '@playwright/test'
import {
  SERVER_CONFIRMED,
  addTask,
  expectTasksSaved,
  openNewList,
  setDueDate,
  statusButton,
  taskRow,
  todayInUtc,
} from './support/data'

/** The "Filter by status" radiogroup on a list page. */
function statusFilter(page: Page) {
  return page.getByRole('radiogroup', { name: 'Filter by status', exact: true })
}

/** Selects a status filter (`All`, `To do`, `Doing`, `Done` or `Postponed`) on the current list page. */
async function selectFilter(page: Page, name: string): Promise<void> {
  await statusFilter(page).getByRole('radio', { name, exact: true }).click()
}

/** On a list page: the status button of the task titled `title`, named after the status it has now. */
function statusButtonAt(page: Page, status: string, title: string) {
  return page.getByRole('button', { name: `${status}: change status of ${title}`, exact: true })
}

/**
 * On a list page with no filter applied: clicks a To do task's status button three times, To do → Doing → Done → the
 * status after Done, expanding the Done group to reach it once it is done, and waits until the server has saved it.
 */
async function clickPastDone(page: Page, title: string): Promise<void> {
  await statusButton(page, title).click()
  await expect(statusButtonAt(page, 'Doing', title)).toBeVisible()
  await statusButton(page, title).click()
  const doneToggle = page.getByRole('button', { name: /^Done \(\d+\)$/ })
  await expect(doneToggle).toBeVisible()
  if ((await doneToggle.getAttribute('aria-expanded')) === 'false') await doneToggle.click()
  await statusButtonAt(page, 'Done', title).click()
  await expectTasksSaved(page)
}

/** Adds a tag to a task through its edit form and waits until the server has saved it. */
async function tagTask(page: Page, title: string, tag: string): Promise<void> {
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  const form = page.getByRole('form', { name: `Edit ${title}`, exact: true })
  await form.getByLabel('New tag', { exact: true }).fill(tag)
  await form.getByRole('button', { name: 'Add tag', exact: true }).click()
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(form).toHaveCount(0, SERVER_CONFIRMED)
}

test.describe('postponed status', () => {
  test('AC1: the status button steps To do → Doing → Done → Postponed → To do', async ({ page }) => {
    await openNewList(page, 'Chores')
    await addTask(page, 'Water the plants')
    await expect(statusButtonAt(page, 'To do', 'Water the plants')).toBeVisible()

    await statusButtonAt(page, 'To do', 'Water the plants').click()
    await expect(statusButtonAt(page, 'Doing', 'Water the plants')).toBeVisible()
    await statusButtonAt(page, 'Doing', 'Water the plants').click()

    // Two clicks still make a new task Done: it moves to the collapsed Done group.
    const doneToggle = page.getByRole('button', { name: 'Done (1)', exact: true })
    await expect(doneToggle).toHaveAttribute('aria-expanded', 'false')
    await doneToggle.click()
    await statusButtonAt(page, 'Done', 'Water the plants').click()

    await expect(statusButtonAt(page, 'Postponed', 'Water the plants')).toBeVisible()
    await statusButtonAt(page, 'Postponed', 'Water the plants').click()
    await expect(statusButtonAt(page, 'To do', 'Water the plants')).toBeVisible()
    await expectTasksSaved(page)
  })

  test('AC2: after Done, the status button is named Postponed: change status of <title>', async ({ page }) => {
    await openNewList(page, 'Chores')
    await addTask(page, 'Water the plants')

    await clickPastDone(page, 'Water the plants')

    await expect(
      page.getByRole('button', { name: 'Postponed: change status of Water the plants', exact: true }),
    ).toBeVisible()
  })

  test('AC3: a postponed task is still Postponed after a reload', async ({ page }) => {
    await openNewList(page, 'Chores')
    await addTask(page, 'Water the plants')
    await clickPastDone(page, 'Water the plants')

    await page.reload()

    await expect(statusButtonAt(page, 'Postponed', 'Water the plants')).toBeVisible()
    await expect(taskRow(page, 'Water the plants')).toContainText('Postponed')
  })

  test('AC4: a postponed task is among the open tasks, not in the Done group, and not counted in it', async ({ page }) => {
    await openNewList(page, 'Chores')
    await addTask(page, 'Water the plants')
    await addTask(page, 'Post a letter')
    await clickPastDone(page, 'Water the plants')

    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByRole('button', { name: 'Postponed: change status of Water the plants', exact: true })).toBeVisible()

    // Advance 'Post a letter' from To do to Doing to Done.
    await statusButton(page, 'Post a letter').click()
    await expect(statusButtonAt(page, 'Doing', 'Post a letter')).toBeVisible()
    await statusButton(page, 'Post a letter').click()
    await expectTasksSaved(page)

    await expect(page.getByRole('button', { name: 'Done (1)', exact: true })).toBeVisible()
    await expect(tasks.getByText('Water the plants', { exact: true })).toBeVisible()
    await expect(tasks.getByText('Post a letter', { exact: true })).toHaveCount(0)
    const doneToggle = page.getByRole('button', { name: 'Done (1)', exact: true })
    if ((await doneToggle.getAttribute('aria-expanded')) === 'false') await doneToggle.click()
    const doneTasks = page.getByRole('list', { name: 'Done tasks', exact: true })
    await expect(doneTasks.getByText('Post a letter', { exact: true })).toBeVisible()
    await expect(doneTasks.getByText('Water the plants', { exact: true })).toHaveCount(0)
  })

  test('AC5: the status filter offers All, To do, Doing, Done, Postponed, in that order', async ({ page }) => {
    await page.goto('/lists/list-groceries')

    const radios = statusFilter(page).getByRole('radio')
    const names = ['All', 'To do', 'Doing', 'Done', 'Postponed']
    for (const [index, name] of names.entries()) {
      await expect(radios.nth(index)).toHaveAccessibleName(name)
    }
    await expect(radios).toHaveCount(names.length)
  })

  test('AC6: choosing Postponed shows only the postponed tasks, directly in the task list', async ({ page }) => {
    await openNewList(page, 'Chores')
    await addTask(page, 'Water the plants')
    await addTask(page, 'Post a letter')
    await clickPastDone(page, 'Water the plants')

    await selectFilter(page, 'Postponed')

    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByText('Water the plants', { exact: true })).toBeVisible()
    await expect(page.getByText('Post a letter', { exact: true })).toHaveCount(0)
  })

  test('AC7: choosing Postponed with no postponed task shows No Postponed tasks. and no task list', async ({ page }) => {
    await openNewList(page, 'Chores')
    await addTask(page, 'Water the plants')

    await selectFilter(page, 'Postponed')

    await expect(page.getByText('No Postponed tasks.', { exact: true })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Tasks', exact: true })).toHaveCount(0)
  })

  test('AC8: the Postponed filter stays selected and applied after a reload, and combines with a tag filter', async ({ page }) => {
    await openNewList(page, 'Garden')
    await addTask(page, 'Water the plants')
    await addTask(page, 'Mow the lawn')
    await addTask(page, 'Post a letter')
    await tagTask(page, 'Water the plants', 'garden')
    await tagTask(page, 'Mow the lawn', 'garden')
    await clickPastDone(page, 'Water the plants')
    await clickPastDone(page, 'Post a letter')

    await selectFilter(page, 'Postponed')
    await page.reload()

    await expect(statusFilter(page).getByRole('radio', { name: 'Postponed', exact: true })).toBeChecked()
    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByText('Water the plants', { exact: true })).toBeVisible()
    await expect(tasks.getByText('Post a letter', { exact: true })).toBeVisible()
    await expect(page.getByText('Mow the lawn', { exact: true })).toHaveCount(0)

    await taskRow(page, 'Water the plants').getByRole('button', { name: 'Show tasks tagged garden', exact: true }).click()

    await expect(page.getByText('Showing tasks tagged "garden"', { exact: true })).toBeVisible()
    await expect(statusFilter(page).getByRole('radio', { name: 'Postponed', exact: true })).toBeChecked()
    await expect(tasks.getByText('Water the plants', { exact: true })).toBeVisible()
    await expect(page.getByText('Post a letter', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Mow the lawn', { exact: true })).toHaveCount(0)
  })

  test('AC9: advancing a postponed task to To do removes it from the still-applied Postponed filter', async ({ page }) => {
    await openNewList(page, 'Errands')
    await addTask(page, 'Post a letter')
    await clickPastDone(page, 'Post a letter')

    await selectFilter(page, 'Postponed')
    await expect(taskRow(page, 'Post a letter')).toBeVisible()

    await statusButtonAt(page, 'Postponed', 'Post a letter').click()
    await expectTasksSaved(page)

    await expect(taskRow(page, 'Post a letter')).toHaveCount(0)
    await expect(page.getByText('No Postponed tasks.', { exact: true })).toBeVisible()
  })

  test('AC11: a postponed task is labelled Postponed on Today and on its shared list page', async ({ page, browser }) => {
    const listName = await openNewList(page, 'Postponed deadlines')
    const listUrl = page.url()
    await addTask(page, 'Submit the form')
    await setDueDate(page, 'Submit the form', todayInUtc())
    await clickPastDone(page, 'Submit the form')

    await page.getByRole('link', { name: 'Today', exact: true }).click()
    await expect(page.getByRole('list', { name: `Due in ${listName}`, exact: true }).getByRole('listitem')).toHaveText([
      // Today shows the status as the button that advances it (#30), before the title and the due information.
      /Postponed.*Submit the form.*Due today/,
    ])

    await page.goto(listUrl)
    await page.getByRole('button', { name: 'Share read-only', exact: true }).click()
    const shareLink = page.getByRole('textbox', { name: 'Share link', exact: true })
    await expect(shareLink).toBeVisible(SERVER_CONFIRMED)
    const shareUrl = await shareLink.inputValue()

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(shareUrl)
    await expect(visitorPage.getByText('Postponed Submit the form', { exact: true })).toBeVisible()
    await visitor.close()
  })

  test('AC13: the status button fits the word Postponed without cutting it off', async ({ page }) => {
    await openNewList(page, 'Chores')
    await addTask(page, 'Water the plants')
    await clickPastDone(page, 'Water the plants')

    const button = statusButtonAt(page, 'Postponed', 'Water the plants')
    await expect(button).toHaveText('Postponed')

    const { contentWidth, visibleWidth } = await button.evaluate((element) => ({
      contentWidth: element.scrollWidth,
      visibleWidth: element.clientWidth,
    }))
    expect(contentWidth, 'the word Postponed should fit inside the status button').toBeLessThanOrEqual(visibleWidth)
  })
})
