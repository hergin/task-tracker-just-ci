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
  uniqueName,
} from './support/data'
import { STORAGE_STATE } from './support/env'

/** A due date in the past, whatever day the suite runs on, so a task with it is overdue (as every fixture date is). */
const OVERDUE = '2026-01-10'

/** The statuses the status button cycles through, in the order one click walks them. */
const STATUS_CYCLE = ['To do', 'Doing', 'Done', 'Postponed'] as const

/** The day after `date` ('YYYY-MM-DD'), over a month or year end too. Tests run in the UTC time zone. */
function dayAfter(date: string): string {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

/** The tasks due in one list on the Today page. */
function todayGroup(page: Page, listName: string) {
  return page.getByRole('list', { name: `Due in ${listName}`, exact: true })
}

/** The row of the task titled `title` in its list's group on the Today page. */
function todayRow(page: Page, listName: string, title: string) {
  return todayGroup(page, listName).getByRole('listitem').filter({ hasText: title })
}

/** On the Today page: the button that pushes a task's due date to tomorrow. */
function moveButton(page: Page, listName: string, title: string) {
  return todayGroup(page, listName).getByRole('button', { name: `Move to tomorrow: ${title}`, exact: true })
}

/** Waits until the server has confirmed every change made from the Today page. */
async function expectTodaySaved(page: Page): Promise<void> {
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0, SERVER_CONFIRMED)
}

/** On a list page: expands the Done group when there is one, so a task that has just become Done stays visible. */
async function expandDone(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /^Done \(\d+\)$/ })
  if ((await toggle.count()) === 0) return
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
}

/** On a list page: clicks a new task's status button until it has `target`, and waits for the server. */
async function setStatus(page: Page, title: string, target: (typeof STATUS_CYCLE)[number]): Promise<void> {
  for (let step = 0; step < STATUS_CYCLE.indexOf(target); step += 1) {
    const next = STATUS_CYCLE[step + 1]
    await page.getByRole('button', { name: `${STATUS_CYCLE[step]}: change status of ${title}`, exact: true }).click()
    // A task that has just become Done sits in the Done group, which starts collapsed.
    if (next === 'Done') await expect(page.getByRole('button', { name: /^Done \(\d+\)$/ })).toBeVisible()
    await expandDone(page)
    await expect(page.getByRole('button', { name: `${next}: change status of ${title}`, exact: true })).toBeVisible()
  }
  await expectTasksSaved(page)
}

type TaskFields = { notes?: string; dueDate?: string; assignee?: string; tag?: string }

/** On a list page: fills a task's edit form and waits until the server has saved it. */
async function editTask(page: Page, title: string, fields: TaskFields): Promise<void> {
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  const form = page.getByRole('form', { name: `Edit ${title}`, exact: true })
  if (fields.notes !== undefined) await form.getByLabel('Notes', { exact: true }).fill(fields.notes)
  if (fields.dueDate !== undefined) await form.getByLabel('Due date', { exact: true }).fill(fields.dueDate)
  if (fields.assignee !== undefined) {
    await form.getByLabel('Assigned to', { exact: true }).selectOption({ label: fields.assignee })
  }
  if (fields.tag !== undefined) {
    await form.getByLabel('New tag', { exact: true }).fill(fields.tag)
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
  }
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  // The form closes only once the server has saved the task.
  await expect(form).toHaveCount(0, SERVER_CONFIRMED)
}

/** Creates a list holding one task due today, and returns the list's name and the list page's URL. */
async function listWithTaskDueToday(
  page: Page,
  base: string,
  title: string,
): Promise<{ listName: string; listUrl: string }> {
  const listName = await openNewList(page, base)
  await addTask(page, title)
  await setDueDate(page, title, todayInUtc())
  return { listName, listUrl: page.url() }
}

test.describe('push a task on Today to tomorrow', () => {
  test('AC1: every task on Today, in any open status, offers a Move to tomorrow button beside its status button', async ({
    page,
  }) => {
    const listName = await openNewList(page, 'Deadlines')
    await addTask(page, 'Pay rent')
    await setDueDate(page, 'Pay rent', todayInUtc())
    await addTask(page, 'Call the bank')
    await setDueDate(page, 'Call the bank', todayInUtc())
    await setStatus(page, 'Call the bank', 'Doing')
    await addTask(page, 'Water the plants')
    await setDueDate(page, 'Water the plants', OVERDUE)
    await setStatus(page, 'Water the plants', 'Postponed')

    await page.goto('/today')

    for (const title of ['Pay rent', 'Call the bank', 'Water the plants']) {
      await expect(moveButton(page, listName, title)).toBeVisible()
      // The row's two controls are the status button and this one, side by side.
      await expect(todayRow(page, listName, title).getByRole('button')).toHaveCount(2)
    }
    await expect(moveButton(page, listName, 'Pay rent')).toHaveText('Move to tomorrow')
    await expect(
      todayRow(page, listName, 'Water the plants').getByRole('button', {
        name: 'Postponed: change status of Water the plants',
        exact: true,
      }),
    ).toBeVisible()
  })

  test('AC2: pushing a task takes its row off Today at once, and its group once the group is empty', async ({ page }) => {
    const listName = await openNewList(page, 'Deadlines')
    await addTask(page, 'Pay rent')
    await setDueDate(page, 'Pay rent', todayInUtc())
    await addTask(page, 'Call the bank')
    await setDueDate(page, 'Call the bank', todayInUtc())

    await page.goto('/today')
    await expect(todayRow(page, listName, 'Pay rent')).toBeVisible()

    await moveButton(page, listName, 'Pay rent').click()

    // No reload: the row goes as soon as the task is pushed, and the rest of the page is left alone.
    await expect(todayRow(page, listName, 'Pay rent')).toHaveCount(0)
    await expect(todayRow(page, listName, 'Call the bank')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Due in Work', exact: true })).toContainText('Send invoices')

    await moveButton(page, listName, 'Call the bank').click()

    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: listName, exact: true, level: 2 })).toHaveCount(0)
    await expectTodaySaved(page)
  })

  test('AC3: Today shows Saving… until the server confirms a push, and every other button keeps working', async ({
    page,
  }) => {
    const listName = await openNewList(page, 'Deadlines')
    await addTask(page, 'Pay rent')
    await setDueDate(page, 'Pay rent', todayInUtc())
    await addTask(page, 'Call the bank')
    await setDueDate(page, 'Call the bank', todayInUtc())

    await page.goto('/today')
    const saving = page.getByText('Saving…', { exact: true })
    await expect(moveButton(page, listName, 'Pay rent')).toBeVisible()
    await expect(saving).toHaveCount(0)

    // Offline the server can't confirm the push, so the indicator stays up while the change is unconfirmed.
    await page.context().setOffline(true)
    await moveButton(page, listName, 'Pay rent').click()

    await expect(saving).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: /^Saving…$/ })).toBeVisible()
    // Only the pushed task's own button is disabled: the other row's is still usable.
    await expect(moveButton(page, listName, 'Call the bank')).toBeEnabled()

    await page.context().setOffline(false)
    await expect(saving).toHaveCount(0, SERVER_CONFIRMED)
  })

  test("AC4: the pushed task shows tomorrow's date on its list page, and still after a reload", async ({ page }) => {
    const { listName, listUrl } = await listWithTaskDueToday(page, 'Deadlines', 'Pay rent')
    await page.goto('/today')

    await moveButton(page, listName, 'Pay rent').click()
    await expect(todayRow(page, listName, 'Pay rent')).toHaveCount(0)
    await expectTodaySaved(page)

    const tomorrow = dayAfter(todayInUtc())
    await page.goto(listUrl)
    await expect(taskRow(page, 'Pay rent')).toContainText(`Due ${tomorrow}`)

    await page.reload()
    await expect(taskRow(page, 'Pay rent')).toContainText(`Due ${tomorrow}`)
  })

  test('AC5: tomorrow is the day after the date Today shows, across a year end and a month end', async ({ page }) => {
    const listName = await openNewList(page, 'Deadlines')
    await addTask(page, 'Pay rent')
    await setDueDate(page, 'Pay rent', '2025-12-29')
    await addTask(page, 'Call the bank')
    await setDueDate(page, 'Call the bank', '2026-02-26')
    const listUrl = page.url()

    // The browser's local date decides what tomorrow is, so the test fixes it; only Date is faked, not timers.
    await page.clock.setFixedTime(new Date('2025-12-31T09:00:00Z'))
    await page.goto('/today')
    await expect(page.getByText('Open tasks that are overdue or due today (2025-12-31).', { exact: true })).toBeVisible()
    await expect(todayRow(page, listName, 'Pay rent')).toBeVisible()

    await moveButton(page, listName, 'Pay rent').click()
    await expect(todayRow(page, listName, 'Pay rent')).toHaveCount(0)
    await expectTodaySaved(page)

    await page.clock.setFixedTime(new Date('2026-02-28T09:00:00Z'))
    await page.goto('/today')
    await expect(page.getByText('Open tasks that are overdue or due today (2026-02-28).', { exact: true })).toBeVisible()
    await expect(todayRow(page, listName, 'Call the bank')).toBeVisible()

    await moveButton(page, listName, 'Call the bank').click()
    await expect(todayRow(page, listName, 'Call the bank')).toHaveCount(0)
    await expectTodaySaved(page)

    await page.goto(listUrl)
    await expect(taskRow(page, 'Pay rent')).toContainText('Due 2026-01-01')
    await expect(taskRow(page, 'Call the bank')).toContainText('Due 2026-03-01')
  })

  test('AC6: an overdue task goes to tomorrow, not to the day after the date it was due', async ({ page }) => {
    const listName = await openNewList(page, 'Deadlines')
    await addTask(page, 'Renew the licence')
    await setDueDate(page, 'Renew the licence', OVERDUE)
    const listUrl = page.url()

    await page.goto('/today')
    await expect(todayRow(page, listName, 'Renew the licence')).toContainText(`Overdue since ${OVERDUE}`)

    await moveButton(page, listName, 'Renew the licence').click()
    await expect(todayRow(page, listName, 'Renew the licence')).toHaveCount(0)
    await expectTodaySaved(page)

    await page.goto(listUrl)
    await expect(taskRow(page, 'Renew the licence')).toContainText(`Due ${dayAfter(todayInUtc())}`)
    await expect(taskRow(page, 'Renew the licence')).not.toContainText(`Due ${dayAfter(OVERDUE)}`)
  })

  test('AC7: a push leaves the status, title, notes, assignee, tags and place in the list alone', async ({ page }) => {
    const listName = await openNewList(page, 'Deadlines')
    await addTask(page, 'Pay rent')
    await addTask(page, 'Call the bank')
    await addTask(page, 'Water the plants')
    await editTask(page, 'Call the bank', {
      notes: 'Ask about the fee.',
      dueDate: todayInUtc(),
      assignee: 'E2E Other',
      tag: 'money',
    })
    await setStatus(page, 'Call the bank', 'Doing')
    await setDueDate(page, 'Water the plants', todayInUtc())
    await setStatus(page, 'Water the plants', 'Postponed')
    const listUrl = page.url()

    await page.goto('/today')
    await moveButton(page, listName, 'Call the bank').click()
    await moveButton(page, listName, 'Water the plants').click()
    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expectTodaySaved(page)

    await page.goto(listUrl)
    const tomorrow = dayAfter(todayInUtc())
    const rows = page
      .getByRole('list', { name: 'Tasks', exact: true })
      .getByRole('listitem')
      .filter({ hasText: /Pay rent|Call the bank|Water the plants/ })
    // Same three tasks, in the order they were added: a push doesn't move a task within its list.
    await expect(rows).toHaveText([/Pay rent/, /Call the bank/, /Water the plants/])

    const pushed = taskRow(page, 'Call the bank')
    await expect(pushed).toContainText(`Due ${tomorrow}`)
    await expect(pushed).toContainText('Ask about the fee.')
    await expect(pushed).toContainText('Assigned to E2E Other')
    await expect(pushed.getByRole('list', { name: 'Tags for Call the bank', exact: true })).toContainText('money')
    await expect(statusButton(page, 'Call the bank')).toHaveAttribute('aria-label', 'Doing: change status of Call the bank')

    const postponed = taskRow(page, 'Water the plants')
    await expect(postponed).toContainText(`Due ${tomorrow}`)
    await expect(statusButton(page, 'Water the plants')).toHaveAttribute(
      'aria-label',
      'Postponed: change status of Water the plants',
    )
  })

  test('AC8: a done, undated or later-dated task is not on Today and has no Move to tomorrow button', async ({ page }) => {
    const listName = await openNewList(page, 'Deadlines')
    const done = uniqueName('Buy stamps')
    const undated = uniqueName('Water the plants')
    const later = uniqueName('Book flights')
    await addTask(page, 'Pay rent')
    await setDueDate(page, 'Pay rent', todayInUtc())
    await addTask(page, done)
    await setDueDate(page, done, todayInUtc())
    await setStatus(page, done, 'Done')
    await addTask(page, undated)
    await addTask(page, later)
    await setDueDate(page, later, dayAfter(todayInUtc()))

    await page.goto('/today')
    // The group has loaded, so what it doesn't hold is really absent.
    await expect(moveButton(page, listName, 'Pay rent')).toBeVisible()

    for (const title of [done, undated, later]) {
      await expect(todayRow(page, listName, title)).toHaveCount(0)
      await expect(page.getByRole('button', { name: `Move to tomorrow: ${title}`, exact: true })).toHaveCount(0)
    }
  })

  test('AC9: a push the server refuses is reported on Today, naming the task that has left it', async ({
    page,
    browser,
  }) => {
    const title = uniqueName('Pay rent')
    const { listName, listUrl } = await listWithTaskDueToday(page, 'Deadlines', title)
    await page.goto('/today')
    const button = moveButton(page, listName, title)
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

    // The refused push is never dropped silently: the row has left Today, so the page says so, naming the task.
    await expect(todayRow(page, listName, title)).toHaveCount(0, SERVER_CONFIRMED)
    await expect(page.getByRole('alert')).toBeVisible(SERVER_CONFIRMED)
    await expect(page.getByRole('alert')).toHaveText(new RegExp(`^Couldn't change "${title}": .+`))
  })

  test("AC10: pushing one task leaves every other task's due date and status alone", async ({ page }) => {
    const listName = await openNewList(page, 'Deadlines')
    await addTask(page, 'Pay rent')
    await setDueDate(page, 'Pay rent', todayInUtc())
    await addTask(page, 'Call the bank')
    await setDueDate(page, 'Call the bank', todayInUtc())
    await setStatus(page, 'Call the bank', 'Doing')
    await addTask(page, 'Renew the licence')
    await setDueDate(page, 'Renew the licence', OVERDUE)
    const listUrl = page.url()

    await page.goto('/today')
    await moveButton(page, listName, 'Pay rent').click()
    await expect(todayRow(page, listName, 'Pay rent')).toHaveCount(0)
    await expectTodaySaved(page)

    await page.goto(listUrl)
    await expect(taskRow(page, 'Pay rent')).toContainText(`Due ${dayAfter(todayInUtc())}`)
    await expect(taskRow(page, 'Call the bank')).toContainText(`Due ${todayInUtc()}`)
    await expect(statusButton(page, 'Call the bank')).toHaveAttribute('aria-label', 'Doing: change status of Call the bank')
    await expect(taskRow(page, 'Renew the licence')).toContainText(`Due ${OVERDUE}`)
    await expect(statusButton(page, 'Renew the licence')).toHaveAttribute(
      'aria-label',
      'To do: change status of Renew the licence',
    )
  })
})
