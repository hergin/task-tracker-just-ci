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

/** A due date in the past, as every date in the fixture is, so a task carrying it is always overdue. */
const OVERDUE = '2026-01-10'

/** The day after the app's today. Tests run in the UTC time zone (playwright.config.ts), so today is computed in UTC. */
function tomorrowInUtc(): string {
  const date = new Date(`${todayInUtc()}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

/** The tasks due in one list on the Today page. */
function todayGroup(page: Page, listName: string) {
  return page.getByRole('list', { name: `Due in ${listName}`, exact: true })
}

/** The row of the task titled `title` in its list's group on the Today page. */
function todayRow(page: Page, listName: string, title: string) {
  return todayGroup(page, listName).getByRole('listitem').filter({ hasText: title })
}

/** On the Today page: the button that moves a task to tomorrow. */
function pushButton(page: Page, listName: string, title: string) {
  return todayGroup(page, listName).getByRole('button', { name: `Push "${title}" to tomorrow`, exact: true })
}

/** On the Today page: the status button of a task, named after the status it has now, as on the list page. */
function todayStatusButton(page: Page, listName: string, status: string, title: string) {
  return todayGroup(page, listName).getByRole('button', {
    name: `${status}: change status of ${title}`,
    exact: true,
  })
}

/** Waits until the server has confirmed every change made from the Today page. */
async function expectTodaySaved(page: Page): Promise<void> {
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0, SERVER_CONFIRMED)
}

/** On a list page: adds a task and gives it a due date, waiting for the server each time. */
async function addTaskDue(page: Page, title: string, due: string): Promise<void> {
  await addTask(page, title)
  await setDueDate(page, title, due)
}

/** On a list page: writes a task's notes through its edit form and waits until the server has saved it. */
async function setNotes(page: Page, title: string, notes: string): Promise<void> {
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  const form = page.getByRole('form', { name: `Edit ${title}`, exact: true })
  await form.getByLabel('Notes', { exact: true }).fill(notes)
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  // The form closes only once the server has saved the task.
  await expect(form).toHaveCount(0, SERVER_CONFIRMED)
}

/** On a list page: moves a new To do task to Doing. */
async function makeDoing(page: Page, title: string): Promise<void> {
  await statusButton(page, title).click()
  await expect(taskRow(page, title)).toContainText('Doing')
  await expectTasksSaved(page)
}

/** On a list page: cycles a new To do task to Postponed (To do → Doing → Done → Postponed), the only route the UI has. */
async function makePostponed(page: Page, title: string): Promise<void> {
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

test.describe('pushing a task on Today to tomorrow', () => {
  test('AC1: every task on Today offers a push button next to its status button, whatever its status and due date', async ({
    page,
  }) => {
    const listName = await openNewList(page, 'Push to tomorrow')
    await addTaskDue(page, 'Water plants', todayInUtc())
    await addTaskDue(page, 'Call the bank', todayInUtc())
    await addTaskDue(page, 'Book flights', todayInUtc())
    await addTaskDue(page, 'Renew the pass', OVERDUE)
    await makeDoing(page, 'Call the bank')
    await makePostponed(page, 'Book flights')

    await page.goto('/today')

    const rows = [
      { title: 'Water plants', status: 'To do' },
      { title: 'Call the bank', status: 'Doing' },
      { title: 'Book flights', status: 'Postponed' },
      { title: 'Renew the pass', status: 'To do' },
    ]
    for (const { title, status } of rows) {
      // Both buttons are on the task's own row, so the push button sits next to the status button.
      const row = todayRow(page, listName, title)
      await expect(row.getByRole('button', { name: `${status}: change status of ${title}`, exact: true })).toBeVisible()
      await expect(row.getByRole('button', { name: `Push "${title}" to tomorrow`, exact: true })).toBeVisible()
    }
  })

  test('AC2: pushing takes the task off Today without a reload, and its group once the list has nothing left', async ({
    page,
  }) => {
    const listName = await openNewList(page, 'Push clears Today')
    await addTaskDue(page, 'Water plants', todayInUtc())
    await addTaskDue(page, 'Call the bank', todayInUtc())

    await page.goto('/today')
    await expect(todayGroup(page, listName).getByRole('listitem')).toHaveCount(2)

    await pushButton(page, listName, 'Water plants').click()

    // No reload: the row goes as soon as the change applies, and the group stays for the task still due.
    await expect(todayRow(page, listName, 'Water plants')).toHaveCount(0)
    await expect(todayRow(page, listName, 'Call the bank')).toBeVisible()
    // The task left behind keeps working.
    await todayStatusButton(page, listName, 'To do', 'Call the bank').click()
    await expect(todayStatusButton(page, listName, 'Doing', 'Call the bank')).toBeVisible()

    await pushButton(page, listName, 'Call the bank').click()

    // The list's last task due today is gone, so its group goes too.
    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: listName, exact: true, level: 2 })).toHaveCount(0)
    await expectTodaySaved(page)
  })

  test('AC3: a pushed task is due tomorrow, whether it was due today or long overdue', async ({ page }) => {
    const listName = await openNewList(page, 'Push sets tomorrow')
    await addTaskDue(page, 'Water plants', todayInUtc())
    await addTaskDue(page, 'Renew the pass', OVERDUE)
    const listUrl = page.url()

    await page.goto('/today')
    await pushButton(page, listName, 'Water plants').click()
    await pushButton(page, listName, 'Renew the pass').click()
    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expectTodaySaved(page)

    await page.goto(listUrl)
    const tomorrow = tomorrowInUtc()
    await expect(taskRow(page, 'Water plants').getByText(`Due ${tomorrow}`, { exact: true })).toBeVisible()
    // The overdue task lands on tomorrow as well, not on the day after the date it used to have.
    await expect(taskRow(page, 'Renew the pass').getByText(`Due ${tomorrow}`, { exact: true })).toBeVisible()
    await expect(taskRow(page, 'Renew the pass')).not.toContainText('2026-01-11')
  })

  test('AC5: the pushed task shows tomorrow on its list page, unmarked as overdue and after a reload', async ({ page }) => {
    const listName = await openNewList(page, 'Push shows on the list')
    await addTaskDue(page, 'Water plants', todayInUtc())
    const listUrl = page.url()

    await page.goto('/today')
    await pushButton(page, listName, 'Water plants').click()
    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expectTodaySaved(page)

    await page.goto(listUrl)
    const due = taskRow(page, 'Water plants').getByText(`Due ${tomorrowInUtc()}`, { exact: true })
    await expect(due).toBeVisible()
    await expect(taskRow(page, 'Water plants')).not.toContainText('(overdue)')

    await page.reload()
    await expect(due).toBeVisible()
  })

  test('AC6: pushing changes the due date only: status, title, notes and place in the list all stay', async ({ page }) => {
    const listName = await openNewList(page, 'Push keeps the rest')
    await addTask(page, 'Water plants')
    await addTask(page, 'Call the bank')
    await addTask(page, 'Post the letter')
    const listUrl = page.url()
    await setDueDate(page, 'Call the bank', todayInUtc())
    await setNotes(page, 'Call the bank', 'Ask about the fee.')
    await makeDoing(page, 'Call the bank')
    await setDueDate(page, 'Post the letter', todayInUtc())
    await makePostponed(page, 'Post the letter')

    await page.goto('/today')
    await pushButton(page, listName, 'Call the bank').click()
    await pushButton(page, listName, 'Post the letter').click()
    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expectTodaySaved(page)

    await page.goto(listUrl)
    // The pushed tasks keep their place in the saved order, and the tasks around them keep theirs.
    await expect(page.getByRole('list', { name: 'Tasks', exact: true }).getByRole('listitem')).toHaveText([
      /Water plants/,
      /Call the bank/,
      /Post the letter/,
    ])
    await expect(page.getByRole('button', { name: 'Doing: change status of Call the bank', exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Postponed: change status of Post the letter', exact: true }),
    ).toBeVisible()
    await expect(taskRow(page, 'Call the bank').getByText('Ask about the fee.', { exact: true })).toBeVisible()
  })

  test('AC7: Today shows Saving… while a push is unconfirmed, and stops once the server confirms it', async ({ page }) => {
    const listName = await openNewList(page, 'Push saving indicator')
    await addTaskDue(page, 'Water plants', todayInUtc())

    await page.goto('/today')
    const button = pushButton(page, listName, 'Water plants')
    await expect(button).toBeVisible()
    const saving = page.getByText('Saving…', { exact: true })
    await expect(saving).toHaveCount(0)

    // Offline the server can't confirm the change, so the indicator stays up while the change is unconfirmed.
    await page.context().setOffline(true)
    await button.click()
    await expect(saving).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: /^Saving…$/ })).toBeVisible()

    await page.context().setOffline(false)
    await expect(saving).toHaveCount(0, SERVER_CONFIRMED)
  })

  test('AC8: while one push is in flight, that task offers no second push and the other tasks keep working', async ({
    page,
  }) => {
    const listName = await openNewList(page, 'Push one at a time')
    await addTaskDue(page, 'Water plants', todayInUtc())
    await addTaskDue(page, 'Call the bank', todayInUtc())

    await page.goto('/today')
    await expect(pushButton(page, listName, 'Water plants')).toBeVisible()
    await expect(pushButton(page, listName, 'Call the bank')).toBeVisible()

    // Offline the first push stays unconfirmed, so it is still in flight while the other task is used.
    await page.context().setOffline(true)
    await pushButton(page, listName, 'Water plants').click()
    await expect(page.getByText('Saving…', { exact: true })).toBeVisible()
    // The task being pushed can't be pushed a second time while its change is in flight.
    await expect(pushButton(page, listName, 'Water plants')).toHaveCount(0)
    // Every other task's own button is untouched by it.
    await expect(pushButton(page, listName, 'Call the bank')).toBeEnabled()
    await pushButton(page, listName, 'Call the bank').click()
    await expect(todayGroup(page, listName)).toHaveCount(0)

    await page.context().setOffline(false)
    await expectTodaySaved(page)
  })

  test('AC9: a push the server refuses is reported on Today, naming the task that has left it', async ({
    page,
    browser,
  }) => {
    const title = uniqueName('Water plants')
    const listName = await openNewList(page, 'Push refused')
    await addTaskDue(page, title, todayInUtc())
    const listUrl = page.url()

    await page.goto('/today')
    const button = pushButton(page, listName, title)
    await expect(button).toBeVisible()

    // Offline this page keeps showing the task while another session deletes it, so the change it sends is refused.
    await page.context().setOffline(true)
    const other = await browser.newContext({ storageState: STORAGE_STATE })
    const otherPage = await other.newPage()
    await otherPage.goto(listUrl)
    await otherPage.getByRole('button', { name: `Delete ${title}`, exact: true }).click()
    await expect(otherPage.getByText(`Deleted "${title}".`, { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await other.close()

    await button.click()
    await page.context().setOffline(false)

    // The refused change is never dropped silently: the task is gone from Today, so the page says so, naming it.
    await expect(todayRow(page, listName, title)).toHaveCount(0, SERVER_CONFIRMED)
    await expect(page.getByRole('alert')).toBeVisible(SERVER_CONFIRMED)
    await expect(page.getByText(new RegExp(title))).toBeVisible()
  })

  test("AC10: Today lists the same tasks as before, each of the fixture's rows now offering a push button too", async ({
    page,
  }) => {
    const listName = await openNewList(page, 'Push leaves Today intact')
    await addTaskDue(page, 'Water plants', todayInUtc())
    await addTaskDue(page, 'Renew the pass', OVERDUE)

    await page.goto('/today')

    const work = page.getByRole('list', { name: 'Due in Work', exact: true })
    await expect(work.getByRole('listitem')).toHaveText([
      /Send invoices.*Overdue since 2026-01-10/,
      /Write quarterly report.*Overdue since 2026-01-15/,
    ])
    const groceries = page.getByRole('list', { name: 'Due in Groceries', exact: true })
    await expect(groceries.getByRole('listitem')).toHaveText([/Buy milk.*Overdue since 2026-01-12/])
    // Done and undated tasks are still left out.
    await expect(page.getByText('Archive old files', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Buy bread', { exact: true })).toHaveCount(0)

    // Each row still carries its due information, and its status button still works.
    await expect(todayRow(page, listName, 'Water plants')).toContainText('Due today')
    await expect(todayRow(page, listName, 'Renew the pass')).toContainText('Overdue since 2026-01-10')
    await todayStatusButton(page, listName, 'To do', 'Water plants').click()
    await expect(todayStatusButton(page, listName, 'Doing', 'Water plants')).toBeVisible()
    await expectTodaySaved(page)

    // The fixture's rows offer the push button as well; this test never uses it on them.
    await expect(work.getByRole('button', { name: 'Push "Send invoices" to tomorrow', exact: true })).toBeVisible()
    await expect(
      work.getByRole('button', { name: 'Push "Write quarterly report" to tomorrow', exact: true }),
    ).toBeVisible()
    await expect(groceries.getByRole('button', { name: 'Push "Buy milk" to tomorrow', exact: true })).toBeVisible()
  })

  test("AC11: pushing a task of the test's own leaves the fixture's tasks exactly as they were", async ({ page }) => {
    const listName = await openNewList(page, 'Push spares the fixture')
    await addTaskDue(page, 'Water plants', todayInUtc())

    await page.goto('/today')
    await pushButton(page, listName, 'Water plants').click()
    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expectTodaySaved(page)

    // Nothing but the test's own task moved: the fixture's rows on Today and its due dates on a list page are unchanged.
    await expect(page.getByRole('list', { name: 'Due in Work', exact: true }).getByRole('listitem')).toHaveText([
      /Send invoices.*Overdue since 2026-01-10/,
      /Write quarterly report.*Overdue since 2026-01-15/,
    ])
    await page.goto('/lists/list-groceries')
    await expect(taskRow(page, 'Buy milk').getByText('Due 2026-01-12 (overdue)', { exact: true })).toBeVisible()
  })
})
