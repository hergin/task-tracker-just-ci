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
import { STORAGE_STATE } from './support/env'

/** Tomorrow's date as the app sees it. Tests run in the UTC time zone (playwright.config.ts). */
function tomorrowInUtc(): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

/** The tasks due in one list on the Today page. */
function todayGroup(page: Page, listName: string): Locator {
  return page.getByRole('list', { name: `Due in ${listName}`, exact: true })
}

/** The row of the task titled `title` in its list's group on the Today page. */
function todayRow(page: Page, listName: string, title: string): Locator {
  return todayGroup(page, listName).getByRole('listitem').filter({ hasText: title })
}

/** The button that pushes a task to tomorrow, within `scope`: a Today group or one of its rows. */
function pushButton(scope: Locator, title: string): Locator {
  return scope.getByRole('button', { name: `Push ${title} to tomorrow`, exact: true })
}

/** Waits until the server has confirmed every change made from the Today page. */
async function expectTodaySaved(page: Page): Promise<void> {
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0, SERVER_CONFIRMED)
}

/** Creates a list holding one task per entry, each with its due date, and returns the list's name and page URL. */
async function listWithTasksDue(
  page: Page,
  base: string,
  tasks: readonly { title: string; due: string }[],
): Promise<{ listName: string; listUrl: string }> {
  const listName = await openNewList(page, base)
  for (const task of tasks) {
    await addTask(page, task.title)
    await setDueDate(page, task.title, task.due)
  }
  return { listName, listUrl: page.url() }
}

/** On a list page: gives a task notes, a tag and an assignee in one edit, and waits until the server has saved it. */
async function describeTask(page: Page, title: string, notes: string, tag: string): Promise<void> {
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  const form = page.getByRole('form', { name: `Edit ${title}`, exact: true })
  await form.getByLabel('Notes', { exact: true }).fill(notes)
  await form.getByLabel('Assigned to', { exact: true }).selectOption({ label: 'E2E Other' })
  await form.getByLabel('New tag', { exact: true }).fill(tag)
  await form.getByRole('button', { name: 'Add tag', exact: true }).click()
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  // The form closes only once the server has saved the task.
  await expect(form).toHaveCount(0, SERVER_CONFIRMED)
}

/** On a list page: cycles a new To do task to Postponed (To do → Doing → Done → Postponed), as the list page already can. */
async function postponeFromListPage(page: Page, title: string): Promise<void> {
  await statusButton(page, title).click()
  await expect(taskRow(page, title)).toContainText('Doing')
  await statusButton(page, title).click()
  // A done task moves to the Done group, which starts collapsed.
  const doneToggle = page.getByRole('button', { name: 'Done (1)', exact: true })
  await expect(doneToggle).toBeVisible()
  if ((await doneToggle.getAttribute('aria-expanded')) === 'false') await doneToggle.click()
  await statusButton(page, title).click()
  await expect(page.getByRole('button', { name: `Postponed: change status of ${title}`, exact: true })).toBeVisible()
  await expectTasksSaved(page)
}

test.describe('push a task on Today to tomorrow', () => {
  test('AC1: every task on Today offers a Tomorrow button named after its own task, beside its status button and due text', async ({
    page,
  }) => {
    const rent = uniqueName('Pay rent')
    const plants = uniqueName('Water plants')
    const { listName } = await listWithTasksDue(page, 'Deadlines', [
      { title: rent, due: todayInUtc() },
      { title: plants, due: todayInUtc() },
    ])

    await page.goto('/today')

    const group = todayGroup(page, listName)
    const row = todayRow(page, listName, rent)
    await expect(pushButton(row, rent)).toHaveText('Tomorrow')
    // Each row carries its own button, told apart by the task it names.
    await expect(pushButton(group, rent)).toHaveCount(1)
    await expect(pushButton(group, plants)).toHaveCount(1)

    // The row still shows, and still does, what it did before: its status button and its due text.
    await expect(row.getByText('Due today', { exact: true })).toBeVisible()
    await row.getByRole('button', { name: `To do: change status of ${rent}`, exact: true }).click()
    await expect(row.getByRole('button', { name: `Doing: change status of ${rent}`, exact: true })).toBeVisible()
    await expect(row.getByText('Due today', { exact: true })).toBeVisible()
    await expect(pushButton(row, rent)).toBeVisible()
    await expectTodaySaved(page)
  })

  test("AC2: pushing a task due today takes its row off Today, and its list's group with the last of them", async ({
    page,
  }) => {
    const rent = uniqueName('Pay rent')
    const plants = uniqueName('Water plants')
    const { listName } = await listWithTasksDue(page, 'Deadlines', [
      { title: rent, due: todayInUtc() },
      { title: plants, due: todayInUtc() },
    ])

    await page.goto('/today')
    await expect(todayRow(page, listName, rent)).toBeVisible()

    await pushButton(todayGroup(page, listName), rent).click()

    // No reload: the row goes as soon as the task is dated tomorrow, and the group's other row stays.
    await expect(todayRow(page, listName, rent)).toHaveCount(0)
    await expect(todayRow(page, listName, plants)).toBeVisible()
    // The fixture's own group is left alone by the push.
    await expect(page.getByRole('list', { name: 'Due in Work', exact: true })).toContainText('Send invoices')

    await pushButton(todayGroup(page, listName), plants).click()

    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: listName, exact: true, level: 2 })).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Due in Work', exact: true })).toContainText('Send invoices')
    await expectTodaySaved(page)
  })

  test('AC3: pushing an overdue task takes it off Today and dates it tomorrow, not a day after the date it had', async ({
    page,
  }) => {
    const title = uniqueName('Send the invoice')
    const { listName, listUrl } = await listWithTasksDue(page, 'Deadlines', [{ title, due: '2026-01-10' }])

    await page.goto('/today')
    await expect(todayRow(page, listName, title)).toContainText('Overdue since 2026-01-10')

    await pushButton(todayGroup(page, listName), title).click()

    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expectTodaySaved(page)

    await page.goto(listUrl)
    await expect(taskRow(page, title)).toContainText(`Due ${tomorrowInUtc()}`)
    await expect(taskRow(page, title)).not.toContainText('Due 2026-01-11')
  })

  test("AC4: the pushed task shows tomorrow's date on its own list page, and still after a reload", async ({ page }) => {
    const title = uniqueName('Pay rent')
    const { listName, listUrl } = await listWithTasksDue(page, 'Deadlines', [{ title, due: todayInUtc() }])

    await page.goto('/today')
    await pushButton(todayGroup(page, listName), title).click()
    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expectTodaySaved(page)

    await page.goto(listUrl)
    await expect(taskRow(page, title)).toContainText(`Due ${tomorrowInUtc()}`)

    await page.reload()
    await expect(taskRow(page, title)).toContainText(`Due ${tomorrowInUtc()}`)
  })

  test("AC5: tomorrow is the day after the browser's today, over the end of a year and of a month", async ({ page }) => {
    const yearEnd = uniqueName('See in the new year')
    const leapDay = uniqueName('Leap ahead')
    const { listName, listUrl } = await listWithTasksDue(page, 'Deadlines', [
      { title: yearEnd, due: '2026-12-31' },
      { title: leapDay, due: '2028-02-28' },
    ])

    // The browser's own clock decides what today is, and the page says which day that is.
    await page.clock.setFixedTime(new Date('2026-12-31T12:00:00Z'))
    await page.goto('/today')
    await expect(page.getByText('Open tasks that are overdue or due today (2026-12-31).', { exact: true })).toBeVisible()

    await pushButton(todayGroup(page, listName), yearEnd).click()
    await expect(todayRow(page, listName, yearEnd)).toHaveCount(0)
    await expectTodaySaved(page)

    await page.clock.setFixedTime(new Date('2028-02-28T12:00:00Z'))
    await page.reload()
    await expect(page.getByText('Open tasks that are overdue or due today (2028-02-28).', { exact: true })).toBeVisible()

    await pushButton(todayGroup(page, listName), leapDay).click()
    await expect(todayRow(page, listName, leapDay)).toHaveCount(0)
    await expectTodaySaved(page)

    await page.goto(listUrl)
    await expect(taskRow(page, yearEnd)).toContainText('Due 2027-01-01')
    await expect(taskRow(page, leapDay)).toContainText('Due 2028-02-29')
  })

  test('AC6: the push changes only the due date: title, notes, status, assignee, tags and the order in the list stay', async ({
    page,
  }) => {
    const first = uniqueName('Alpha')
    const second = uniqueName('Beta')
    const third = uniqueName('Gamma')
    const notes = 'Ring the bell twice.'
    const tag = 'errand'
    const { listName, listUrl } = await listWithTasksDue(page, 'Routine', [
      { title: first, due: todayInUtc() },
      { title: second, due: todayInUtc() },
      { title: third, due: todayInUtc() },
    ])
    await describeTask(page, second, notes, tag)
    // Beta is Doing and Gamma Postponed, so the push can be seen to leave every status as it was.
    await statusButton(page, second).click()
    await expect(page.getByRole('button', { name: `Doing: change status of ${second}`, exact: true })).toBeVisible()
    await postponeFromListPage(page, third)

    // Only a task's own row carries an Edit button: a tag of its own is a list item inside it too.
    const rows = page
      .getByRole('list', { name: 'Tasks', exact: true })
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name: /^Edit / }) })
    await expect(rows).toHaveText([new RegExp(first), new RegExp(second), new RegExp(third)])

    await page.goto('/today')
    for (const title of [first, second, third]) {
      await pushButton(todayGroup(page, listName), title).click()
      await expect(todayRow(page, listName, title)).toHaveCount(0)
    }
    await expectTodaySaved(page)

    await page.goto(listUrl)
    // Same three tasks, in the same places.
    await expect(rows).toHaveText([new RegExp(first), new RegExp(second), new RegExp(third)])
    await expect(page.getByRole('button', { name: `To do: change status of ${first}`, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: `Doing: change status of ${second}`, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: `Postponed: change status of ${third}`, exact: true })).toBeVisible()

    const tomorrow = tomorrowInUtc()
    const beta = taskRow(page, second)
    await expect(beta).toContainText(notes)
    await expect(beta).toContainText('Assigned to E2E Other')
    await expect(beta.getByRole('button', { name: `Show tasks tagged ${tag}`, exact: true })).toBeVisible()
    await expect(beta).toContainText(`Due ${tomorrow}`)
    await expect(taskRow(page, first)).toContainText(`Due ${tomorrow}`)
    await expect(taskRow(page, third)).toContainText(`Due ${tomorrow}`)
  })

  test('AC7: while a push is unconfirmed Today says Saving…, that task cannot be pushed again, and other rows still can', async ({
    page,
  }) => {
    const rent = uniqueName('Pay rent')
    const plants = uniqueName('Water plants')
    const { listName } = await listWithTasksDue(page, 'Deadlines', [
      { title: rent, due: todayInUtc() },
      { title: plants, due: todayInUtc() },
    ])

    await page.goto('/today')
    await expect(pushButton(todayGroup(page, listName), rent)).toBeVisible()
    const saving = page.getByText('Saving…', { exact: true })
    await expect(saving).toHaveCount(0)

    // Offline the server can't confirm the push, so the indicator stays up while the change is unconfirmed.
    await page.context().setOffline(true)
    await pushButton(todayGroup(page, listName), rent).click()
    await expect(saving).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: /^Saving…$/ })).toBeVisible()
    // The same task can't be pushed a second time: no button that would push it again is left to click.
    await expect(page.getByRole('button', { name: `Push ${rent} to tomorrow`, exact: true, disabled: false })).toHaveCount(0)

    // Another row's button still works while that one is in flight.
    await pushButton(todayGroup(page, listName), plants).click()
    await expect(todayRow(page, listName, plants)).toHaveCount(0)
    await expect(saving).toBeVisible()

    await page.context().setOffline(false)
    await expect(saving).toHaveCount(0, SERVER_CONFIRMED)
  })

  test('AC8: a push the server refuses is reported on Today, naming the task that has left it', async ({
    page,
    browser,
  }) => {
    const title = uniqueName('Pay rent')
    const { listName, listUrl } = await listWithTasksDue(page, 'Deadlines', [{ title, due: todayInUtc() }])

    await page.goto('/today')
    const button = pushButton(todayGroup(page, listName), title)
    await expect(button).toBeVisible()

    // Offline this page keeps showing the task while another session deletes it, so the push it sends is refused.
    await page.context().setOffline(true)
    const other = await browser.newContext({ storageState: STORAGE_STATE })
    const otherPage = await other.newPage()
    await otherPage.goto(listUrl)
    await otherPage.getByRole('button', { name: `Delete ${title}`, exact: true }).click()
    await expect(otherPage.getByText(`Deleted "${title}".`, { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await other.close()

    await button.click()
    await page.context().setOffline(false)

    // The refused push is never dropped silently: the task has left Today, so the page says so, naming it.
    await expect(todayRow(page, listName, title)).toHaveCount(0, SERVER_CONFIRMED)
    await expect(page.getByRole('alert')).toBeVisible(SERVER_CONFIRMED)
    await expect(page.getByRole('alert')).toContainText(`Couldn't change "${title}":`)
  })

  test('AC9: the button is on Today only: a task on its list page has no control that pushes it to tomorrow', async ({
    page,
  }) => {
    const title = uniqueName('Pay rent')
    const { listName, listUrl } = await listWithTasksDue(page, 'Deadlines', [{ title, due: todayInUtc() }])

    await page.goto('/today')
    await expect(pushButton(todayGroup(page, listName), title)).toBeVisible()

    await page.goto(listUrl)
    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    // The task is on the page before its controls are counted, or the count proves nothing.
    await expect(tasks.getByRole('listitem').filter({ hasText: title })).toBeVisible()
    await expect(tasks.getByRole('button', { name: `Push ${title} to tomorrow`, exact: true })).toHaveCount(0)
    await expect(tasks.getByRole('button', { name: 'Tomorrow', exact: true })).toHaveCount(0)
  })
})
