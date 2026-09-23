import { expect, test, type Page } from '@playwright/test'
import {
  SERVER_CONFIRMED,
  addTask,
  expectTasksSaved,
  openNewList,
  setDueDate,
  statusButton,
  taskRow,
  uniqueName,
} from './support/data'
import { STORAGE_STATE } from './support/env'

/** A date `days` away from today, as the app sees it. Tests run in the UTC time zone (playwright.config.ts). */
function dateInUtc(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
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
function moveToTomorrow(page: Page, listName: string, title: string) {
  return todayRow(page, listName, title).getByRole('button', { name: 'Move to tomorrow', exact: true })
}

/** Waits until the server has confirmed every change made from the Today page. */
async function expectTodaySaved(page: Page): Promise<void> {
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0, SERVER_CONFIRMED)
}

/** On a list page: sets a task's notes through its edit form, waiting until the server has saved them. */
async function setNotes(page: Page, title: string, notes: string): Promise<void> {
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  const form = page.getByRole('form', { name: `Edit ${title}`, exact: true })
  await form.getByLabel('Notes', { exact: true }).fill(notes)
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  // The form closes only once the server has saved the task.
  await expect(form).toHaveCount(0, SERVER_CONFIRMED)
}

/** Creates a list holding one task due today, and returns the list's name and the list page's URL. */
async function listWithTaskDueToday(page: Page, base: string, title: string): Promise<{ listName: string; listUrl: string }> {
  const listName = await openNewList(page, base)
  await addTask(page, title)
  await setDueDate(page, title, dateInUtc(0))
  return { listName, listUrl: page.url() }
}

test.describe('pushing a task on Today to tomorrow', () => {
  test('AC1: every task on Today offers a Move to tomorrow button, next to its status button', async ({ page }) => {
    const { listName } = await listWithTaskDueToday(page, 'Deadlines', 'Pay rent')

    await page.goto('/today')

    await expect(moveToTomorrow(page, listName, 'Pay rent')).toBeVisible()
    await expect(
      todayRow(page, listName, 'Pay rent').getByRole('button', {
        name: 'To do: change status of Pay rent',
        exact: true,
      }),
    ).toBeVisible()
    // The fixture's overdue tasks offer it too, whatever their status.
    await expect(moveToTomorrow(page, 'Work', 'Send invoices')).toBeVisible()
    await expect(moveToTomorrow(page, 'Work', 'Write quarterly report')).toBeVisible()
    await expect(moveToTomorrow(page, 'Groceries', 'Buy milk')).toBeVisible()
  })

  test("AC2: the button sets the task's due date to tomorrow, whatever date it had before", async ({ page }) => {
    const listName = await openNewList(page, 'Deadlines')
    await addTask(page, 'Pay rent')
    await setDueDate(page, 'Pay rent', dateInUtc(0))
    await addTask(page, 'Renew passport')
    await setDueDate(page, 'Renew passport', dateInUtc(-5))
    const listUrl = page.url()

    await page.goto('/today')
    await expect(moveToTomorrow(page, listName, 'Pay rent')).toBeVisible()
    await moveToTomorrow(page, listName, 'Pay rent').click()
    await moveToTomorrow(page, listName, 'Renew passport').click()
    await expectTodaySaved(page)

    // Both the task due today and the overdue one now carry tomorrow's date, not the one they had.
    await page.goto(listUrl)
    const tomorrow = dateInUtc(1)
    await expect(taskRow(page, 'Pay rent')).toContainText(`Due ${tomorrow}`)
    await expect(taskRow(page, 'Renew passport')).toContainText(`Due ${tomorrow}`)
    await expect(taskRow(page, 'Renew passport')).not.toContainText(dateInUtc(-5))
  })

  test('AC3: the task leaves Today once the server confirms the move, showing Saving… until then', async ({ page }) => {
    const { listName } = await listWithTaskDueToday(page, 'Deadlines', 'Pay rent')
    await page.goto('/today')

    const button = moveToTomorrow(page, listName, 'Pay rent')
    await expect(button).toBeVisible()
    const saving = page.getByText('Saving…', { exact: true })
    await expect(saving).toHaveCount(0)

    // Offline the server can't confirm the change, so the indicator stays up while the change is unconfirmed.
    await page.context().setOffline(true)
    await button.click()
    await expect(saving).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: /^Saving…$/ })).toBeVisible()

    await page.context().setOffline(false)
    await expectTodaySaved(page)
    // No reload: the task is off Today, and with it the only group its list had.
    await expect(todayRow(page, listName, 'Pay rent')).toHaveCount(0)
    await expect(todayGroup(page, listName)).toHaveCount(0)
  })

  test("AC4: the moved task's own list page shows tomorrow's date as its due date, still after a reload", async ({ page }) => {
    const { listName, listUrl } = await listWithTaskDueToday(page, 'Deadlines', 'Pay rent')
    await page.goto('/today')

    await expect(moveToTomorrow(page, listName, 'Pay rent')).toBeVisible()
    await moveToTomorrow(page, listName, 'Pay rent').click()
    await expectTodaySaved(page)

    await page.goto(listUrl)
    const tomorrow = dateInUtc(1)
    await expect(taskRow(page, 'Pay rent')).toContainText(`Due ${tomorrow}`)
    // Tomorrow is not overdue, so the row says nothing more about the date.
    await expect(taskRow(page, 'Pay rent')).not.toContainText('overdue')

    await page.reload()
    await expect(taskRow(page, 'Pay rent')).toContainText(`Due ${tomorrow}`)
  })

  test("AC5: the move leaves the task's status, title, notes and place in its list unchanged", async ({ page }) => {
    const listName = await openNewList(page, 'Deadlines')
    await addTask(page, 'Book flights')
    await addTask(page, 'Pay rent')
    await addTask(page, 'Water plants')
    await setNotes(page, 'Pay rent', 'Transfer from the joint account.')
    await setDueDate(page, 'Pay rent', dateInUtc(0))
    await statusButton(page, 'Pay rent').click()
    await expect(taskRow(page, 'Pay rent')).toContainText('Doing')
    await expectTasksSaved(page)
    const listUrl = page.url()

    await page.goto('/today')
    await expect(moveToTomorrow(page, listName, 'Pay rent')).toBeVisible()
    await moveToTomorrow(page, listName, 'Pay rent').click()
    await expectTodaySaved(page)

    await page.goto(listUrl)
    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByRole('listitem')).toHaveText([/Book flights/, /Pay rent/, /Water plants/])
    await expect(
      tasks.getByRole('button', { name: 'Doing: change status of Pay rent', exact: true }),
    ).toBeVisible()
    await expect(taskRow(page, 'Pay rent')).toContainText('Transfer from the joint account.')
  })

  test('AC6: a move the server refuses is reported on Today, naming the task', async ({ page, browser }) => {
    const title = uniqueName('Pay rent')
    const { listName, listUrl } = await listWithTaskDueToday(page, 'Deadlines', title)
    await page.goto('/today')
    const button = moveToTomorrow(page, listName, title)
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

    // The refused move is never dropped silently: the task is gone from Today, so the page says so, naming it.
    await expect(todayRow(page, listName, title)).toHaveCount(0, SERVER_CONFIRMED)
    await expect(page.getByRole('alert')).toBeVisible(SERVER_CONFIRMED)
    await expect(page.getByText(new RegExp(title))).toBeVisible()
  })
})
