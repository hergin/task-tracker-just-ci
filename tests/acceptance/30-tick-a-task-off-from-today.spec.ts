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

/** Creates a list holding one task due today, and returns the list's name and the list page's URL. */
async function listWithTaskDueToday(page: Page, base: string, title: string): Promise<{ listName: string; listUrl: string }> {
  const listName = await openNewList(page, base)
  await addTask(page, title)
  await setDueDate(page, title, todayInUtc())
  return { listName, listUrl: page.url() }
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

test.describe('changing a task status from Today', () => {
  test('AC1: a task on Today shows its status as a button, and its due information is still on the row', async ({ page }) => {
    const { listName } = await listWithTaskDueToday(page, 'Deadlines', 'Pay rent')

    await page.goto('/today')

    const row = todayRow(page, listName, 'Pay rent')
    await expect(todayStatusButton(page, listName, 'To do', 'Pay rent')).toHaveText('To do')
    await expect(row.getByText('Due today', { exact: true })).toBeVisible()
    // The status is shown once, as the button: the plain status text next to the due information is gone.
    const timesShown = (await row.innerText()).match(/To do/g) ?? []
    expect(timesShown, 'the status should be shown once, as the button').toHaveLength(1)
  })

  test('AC2: clicking the button of a To do task changes it to Doing and keeps it on Today', async ({ page }) => {
    const { listName } = await listWithTaskDueToday(page, 'Deadlines', 'Pay rent')
    await page.goto('/today')

    await todayStatusButton(page, listName, 'To do', 'Pay rent').click()

    await expect(todayStatusButton(page, listName, 'Doing', 'Pay rent')).toBeVisible()
    await expect(todayRow(page, listName, 'Pay rent')).toBeVisible()
    await expectTodaySaved(page)
  })

  test('AC3: clicking the button of a Doing task marks it Done, taking it and its empty group off Today', async ({ page }) => {
    const { listName } = await listWithTaskDueToday(page, 'Deadlines', 'Pay rent')
    await page.goto('/today')

    await todayStatusButton(page, listName, 'To do', 'Pay rent').click()
    await expect(todayStatusButton(page, listName, 'Doing', 'Pay rent')).toBeVisible()
    await todayStatusButton(page, listName, 'Doing', 'Pay rent').click()

    // No reload: the row goes as soon as the task is done, and with it the only group its list had.
    await expect(todayRow(page, listName, 'Pay rent')).toHaveCount(0)
    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: listName, exact: true, level: 2 })).toHaveCount(0)
    await expectTodaySaved(page)
  })

  test('AC4: a Postponed task due today stays on Today, and its button changes it to To do', async ({ page }) => {
    const { listName } = await listWithTaskDueToday(page, 'Deadlines', 'Pay rent')
    await postponeFromListPage(page, 'Pay rent')

    await page.goto('/today')

    await expect(todayStatusButton(page, listName, 'Postponed', 'Pay rent')).toBeVisible()
    await todayStatusButton(page, listName, 'Postponed', 'Pay rent').click()

    await expect(todayStatusButton(page, listName, 'To do', 'Pay rent')).toBeVisible()
    await expect(todayRow(page, listName, 'Pay rent')).toBeVisible()
    await expectTodaySaved(page)
  })

  test('AC5: a task advanced to Done from Today is Done on its list page, and still after a reload', async ({ page }) => {
    const { listName, listUrl } = await listWithTaskDueToday(page, 'Deadlines', 'Pay rent')
    await page.goto('/today')

    await todayStatusButton(page, listName, 'To do', 'Pay rent').click()
    await expect(todayStatusButton(page, listName, 'Doing', 'Pay rent')).toBeVisible()
    await todayStatusButton(page, listName, 'Doing', 'Pay rent').click()
    await expect(todayGroup(page, listName)).toHaveCount(0)
    await expectTodaySaved(page)

    await page.goto(listUrl)
    const doneTask = page.getByRole('button', { name: 'Done: change status of Pay rent', exact: true })
    await page.getByRole('button', { name: 'Done (1)', exact: true }).click()
    await expect(doneTask).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: 'Done (1)', exact: true }).click()
    await expect(doneTask).toBeVisible()
  })

  test('AC6: Today shows Saving… while a change is unconfirmed, and nothing while there is none', async ({ page }) => {
    const { listName } = await listWithTaskDueToday(page, 'Deadlines', 'Pay rent')
    await page.goto('/today')

    const button = todayStatusButton(page, listName, 'To do', 'Pay rent')
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

  test('AC7: a status change the server refuses is reported on Today, naming the task that has left it', async ({
    page,
    browser,
  }) => {
    const title = uniqueName('Pay rent')
    const { listName, listUrl } = await listWithTaskDueToday(page, 'Deadlines', title)
    await page.goto('/today')
    const button = todayStatusButton(page, listName, 'To do', title)
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

  test("AC8: Today lists the same tasks as before, each of the fixture's with a status button", async ({ page }) => {
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

    await expect(work.getByRole('button', { name: 'Doing: change status of Send invoices', exact: true })).toBeVisible()
    await expect(
      work.getByRole('button', { name: 'To do: change status of Write quarterly report', exact: true }),
    ).toBeVisible()
    await expect(groceries.getByRole('button', { name: 'To do: change status of Buy milk', exact: true })).toBeVisible()
  })
})
