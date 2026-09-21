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

/** The tasks due in one list on the Today page. */
function todayGroup(page: Page, listName: string) {
  return page.getByRole('list', { name: `Due in ${listName}`, exact: true })
}

/** The row of the task titled `title` in its list's group on the Today page. */
function todayRow(page: Page, listName: string, title: string) {
  return todayGroup(page, listName).getByRole('listitem').filter({ hasText: title })
}

/** On the Today page: the button that moves a task to tomorrow, one per task. */
function pushButton(page: Page, listName: string, title: string) {
  return todayGroup(page, listName).getByRole('button', { name: `Push to tomorrow: ${title}`, exact: true })
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

/** A date `days` away from today, as 'YYYY-MM-DD'. Tests run in the UTC time zone (playwright.config.ts). */
function dateInUtc(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
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
  test('AC1: every task on Today has its own Push to tomorrow button, next to its status button', async ({ page }) => {
    const listName = await openNewList(page, 'Chores')
    await addTask(page, 'Water plants')
    await addTask(page, 'Post the parcel')
    await setDueDate(page, 'Water plants', todayInUtc())
    await setDueDate(page, 'Post the parcel', dateInUtc(-40))

    await page.goto('/today')

    for (const title of ['Water plants', 'Post the parcel']) {
      await expect(pushButton(page, listName, title)).toBeVisible()
      // The push is its own control: the row keeps the status button it already had.
      await expect(todayStatusButton(page, listName, 'To do', title)).toBeVisible()
      await expect(todayRow(page, listName, title).getByRole('button', { name: /^Push to tomorrow: / })).toHaveCount(1)
    }
  })

  test("AC2: pushing sets tomorrow's date, whether the task was due today or long overdue", async ({ page }) => {
    const tomorrow = dateInUtc(1)
    const listName = await openNewList(page, 'Chores')
    const listUrl = page.url()
    await addTask(page, 'Water plants')
    await addTask(page, 'Post the parcel')
    await setDueDate(page, 'Water plants', todayInUtc())
    await setDueDate(page, 'Post the parcel', dateInUtc(-40))

    await page.goto('/today')
    await pushButton(page, listName, 'Water plants').click()
    await pushButton(page, listName, 'Post the parcel').click()
    await expectTodaySaved(page)

    // Tomorrow is today plus one day for both, not each task's own due date plus one.
    await page.goto(listUrl)
    await expect(taskRow(page, 'Water plants')).toContainText(`Due ${tomorrow}`)
    await expect(taskRow(page, 'Post the parcel')).toContainText(`Due ${tomorrow}`)
  })

  test('AC4: the task leaves Today once the server confirms, and Today shows Saving… until then', async ({ page }) => {
    const { listName } = await listWithTaskDueToday(page, 'Chores', 'Water plants')
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
    await expect(todayRow(page, listName, 'Water plants')).toHaveCount(0)
  })

  test("AC5: pushing a list's only due task takes its section off Today", async ({ page }) => {
    const { listName } = await listWithTaskDueToday(page, 'Chores', 'Water plants')
    await page.goto('/today')

    await pushButton(page, listName, 'Water plants').click()

    // No reload: the row goes as soon as the task is pushed, and with it the only group its list had.
    await expect(todayRow(page, listName, 'Water plants')).toHaveCount(0)
    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: listName, exact: true, level: 2 })).toHaveCount(0)
    await expectTodaySaved(page)
  })

  test("AC6: the list page shows tomorrow's date in place of the task's old due date", async ({ page }) => {
    const tomorrow = dateInUtc(1)
    const wasDue = dateInUtc(-40)
    const listName = await openNewList(page, 'Chores')
    const listUrl = page.url()
    await addTask(page, 'Post the parcel')
    await setDueDate(page, 'Post the parcel', wasDue)
    await expect(taskRow(page, 'Post the parcel')).toContainText(`Due ${wasDue}`)

    await page.goto('/today')
    await pushButton(page, listName, 'Post the parcel').click()
    await expectTodaySaved(page)

    await page.goto(listUrl)
    await expect(taskRow(page, 'Post the parcel')).toContainText(`Due ${tomorrow}`)
    await expect(taskRow(page, 'Post the parcel')).not.toContainText(wasDue)
  })

  test('AC7: the push leaves status, title, notes, assignee, tags and the place in the list alone', async ({ page }) => {
    const tomorrow = dateInUtc(1)
    const listName = await openNewList(page, 'Chores')
    const listUrl = page.url()
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await addTask(page, 'Gamma')

    await page.getByRole('button', { name: 'Edit Beta', exact: true }).click()
    const form = page.getByRole('form', { name: 'Edit Beta', exact: true })
    await form.getByLabel('Notes', { exact: true }).fill('Ring the bell.')
    await form.getByLabel('Due date', { exact: true }).fill(todayInUtc())
    await form.getByLabel('Assigned to', { exact: true }).selectOption({ label: 'E2E Other' })
    await form.getByLabel('New tag', { exact: true }).fill('errand')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await statusButton(page, 'Beta').click()
    await expect(page.getByRole('button', { name: 'Doing: change status of Beta', exact: true })).toBeVisible()
    await expectTasksSaved(page)

    await page.goto('/today')
    await pushButton(page, listName, 'Beta').click()
    await expectTodaySaved(page)

    await page.goto(listUrl)
    // The task rows only: a row's tags are a list of their own nested inside it, whose items are listitems too.
    const taskRows = page
      .getByRole('list', { name: 'Tasks', exact: true })
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name: /^(?:To do|Doing|Done|Postponed): change status of / }) })
    await expect(taskRows).toHaveText([/Alpha/, /Beta/, /Gamma/])
    await expect(page.getByRole('button', { name: 'Doing: change status of Beta', exact: true })).toBeVisible()
    const beta = taskRow(page, 'Beta')
    await expect(beta).toContainText('Ring the bell.')
    await expect(beta).toContainText('Assigned to E2E Other')
    await expect(beta).toContainText(`Due ${tomorrow}`)
    await expect(beta.getByRole('list', { name: 'Tags for Beta', exact: true }).getByRole('listitem')).toHaveText([
      'errand',
    ])
  })

  test("AC8: pushing one task leaves every other task's controls on Today working", async ({ page }) => {
    const listName = await openNewList(page, 'Chores')
    await addTask(page, 'Alpha')
    await addTask(page, 'Beta')
    await setDueDate(page, 'Alpha', todayInUtc())
    await setDueDate(page, 'Beta', todayInUtc())

    await page.goto('/today')
    await expect(pushButton(page, listName, 'Beta')).toBeVisible()

    // Offline the change stays in flight, so both rows keep the state the click left them in.
    await page.context().setOffline(true)
    await pushButton(page, listName, 'Alpha').click()

    // Alpha's own push can't be sent twice while its change is in flight.
    await expect(pushButton(page, listName, 'Alpha').and(page.locator('button:enabled'))).toHaveCount(0)
    // Beta is untouched: both of its controls still work, and pushing it works too.
    await expect(pushButton(page, listName, 'Beta')).toBeEnabled()
    await expect(todayStatusButton(page, listName, 'To do', 'Beta')).toBeEnabled()
    await pushButton(page, listName, 'Beta').click()

    await page.context().setOffline(false)
    await expectTodaySaved(page)
    await expect(todayGroup(page, listName)).toHaveCount(0)
  })

  test('AC9: a push the server refuses is reported on Today, naming the task that has left it', async ({
    page,
    browser,
  }) => {
    const title = uniqueName('Post the parcel')
    const { listName, listUrl } = await listWithTaskDueToday(page, 'Chores', title)
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

    // The refused push is never dropped silently: the task is gone from Today, so the page says so, naming it.
    await expect(todayRow(page, listName, title)).toHaveCount(0, SERVER_CONFIRMED)
    await expect(page.getByRole('alert')).toBeVisible(SERVER_CONFIRMED)
    await expect(page.getByText(new RegExp(title))).toBeVisible()
  })

  test('AC10: the pushed task stays off Today after a reload, since today has not reached its new due date', async ({
    page,
  }) => {
    const tomorrow = dateInUtc(1)
    const { listName, listUrl } = await listWithTaskDueToday(page, 'Chores', 'Water plants')

    await page.goto('/today')
    await pushButton(page, listName, 'Water plants').click()
    await expectTodaySaved(page)

    await page.reload()

    // The fixture's own overdue task proves Today has loaded before anything is asserted absent.
    await expect(page.getByRole('list', { name: 'Due in Groceries', exact: true })).toContainText('Buy milk')
    await expect(todayRow(page, listName, 'Water plants')).toHaveCount(0)
    await expect(todayGroup(page, listName)).toHaveCount(0)

    // It is still there, due tomorrow: it has left Today, not the list.
    await page.goto(listUrl)
    await expect(taskRow(page, 'Water plants')).toContainText(`Due ${tomorrow}`)
  })
})
