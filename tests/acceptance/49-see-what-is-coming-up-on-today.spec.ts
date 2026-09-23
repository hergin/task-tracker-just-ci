import { expect, test, type Page } from '@playwright/test'
import { SERVER_CONFIRMED, addTask, openNewList, setDueDate, statusButton, taskRow, todayInUtc, uniqueName } from './support/data'

// The Today page gains a "Coming up" section below the overdue-or-due-today one, listing open tasks due tomorrow
// through seven days from now, grouped by list. A group names its list the way the existing section names its own
// ("Due in Groceries"), so the same list can appear in both sections without either being ambiguous.
//
// Two of the spec's criteria have no test here, because their precondition can never hold in this suite (see the
// acceptance-test rules in CLAUDE.md): every test signs in as e2e-owner and shares one database with the seed
// fixture, whose open, past-dated tasks (Buy milk, Send invoices, Write quarterly report) are read-only.
// - "nothing is overdue or due today, but something is coming up": the fixture's overdue tasks are always there,
//   so "Nothing due today." can never be shown to this account.
// - "nothing is coming up either, so no Coming up section appears at all": tests run in parallel against that same
//   database and create tasks due within the window, so the section's absence is not a state a test can rely on.

/** A date `days` from today, as the app sees it. Tests run in the UTC time zone (playwright.config.ts). */
function daysFromTodayInUtc(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** The Coming up section's tasks for one list. */
function comingUpGroup(page: Page, listName: string) {
  return page.getByRole('list', { name: `Coming up in ${listName}`, exact: true })
}

/** The row of the task titled `title` in its list's Coming up group. */
function comingUpRow(page: Page, listName: string, title: string) {
  return comingUpGroup(page, listName).getByRole('listitem').filter({ hasText: title })
}

/** The existing overdue-or-due-today section's tasks for one list. */
function dueGroup(page: Page, listName: string) {
  return page.getByRole('list', { name: `Due in ${listName}`, exact: true })
}

/** Waits until the server has confirmed every change made from the Today page. */
async function expectTodaySaved(page: Page): Promise<void> {
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0, SERVER_CONFIRMED)
}

/** On a list page: cycles a new To do task to Done (To do → Doing → Done), as the list page already can. */
async function completeFromListPage(page: Page, title: string): Promise<void> {
  await statusButton(page, title).click()
  await expect(taskRow(page, title)).toContainText('Doing')
  await statusButton(page, title).click()
  // A done task moves to the Done group, which starts collapsed.
  await expect(page.getByRole('button', { name: 'Done (1)', exact: true })).toBeVisible()
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0, SERVER_CONFIRMED)
}

test.describe('what is coming up on Today', () => {
  test('AC1: an open task due tomorrow appears under Coming up, in its own list\'s group, with its due date', async ({ page }) => {
    const tomorrow = daysFromTodayInUtc(1)
    const listName = await openNewList(page, 'Parcels')
    await addTask(page, 'Collect the parcel')
    await setDueDate(page, 'Collect the parcel', tomorrow)

    await page.goto('/today')

    await expect(page.getByRole('heading', { name: 'Coming up', exact: true })).toBeVisible()
    await expect(comingUpGroup(page, listName).getByRole('listitem')).toHaveText([
      new RegExp(`Collect the parcel.*${tomorrow}`),
    ])
  })

  test('AC2: an open task due seven days from today appears under Coming up too', async ({ page }) => {
    const farEdge = daysFromTodayInUtc(7)
    const listName = await openNewList(page, 'Bicycle')
    await addTask(page, 'Service the bike')
    await setDueDate(page, 'Service the bike', farEdge)

    await page.goto('/today')

    await expect(comingUpGroup(page, listName).getByRole('listitem')).toHaveText([
      new RegExp(`Service the bike.*${farEdge}`),
    ])
  })

  test('AC3: a task due eight days from today appears nowhere on the page', async ({ page }) => {
    const beyond = uniqueName('Renew the passport')
    const listName = await openNewList(page, 'Travel')
    await addTask(page, 'Collect the parcel')
    await setDueDate(page, 'Collect the parcel', daysFromTodayInUtc(1))
    await addTask(page, beyond)
    await setDueDate(page, beyond, daysFromTodayInUtc(8))

    await page.goto('/today')

    await expect(comingUpRow(page, listName, 'Collect the parcel')).toBeVisible()
    await expect(page.getByText(beyond, { exact: true })).toHaveCount(0)
  })

  test('AC4: a done task due within the window does not appear under Coming up', async ({ page }) => {
    const finished = uniqueName('Post the letter')
    const listName = await openNewList(page, 'Errands')
    await addTask(page, 'Water the plants')
    await setDueDate(page, 'Water the plants', daysFromTodayInUtc(2))
    await addTask(page, finished)
    await setDueDate(page, finished, daysFromTodayInUtc(2))
    await completeFromListPage(page, finished)

    await page.goto('/today')

    await expect(comingUpGroup(page, listName).getByRole('listitem')).toHaveText([/Water the plants/])
    await expect(page.getByText(finished, { exact: true })).toHaveCount(0)
  })

  test('AC5: a task with no due date does not appear under Coming up', async ({ page }) => {
    const undated = uniqueName('Think about it')
    const listName = await openNewList(page, 'Ideas')
    await addTask(page, 'Water the plants')
    await setDueDate(page, 'Water the plants', daysFromTodayInUtc(2))
    await addTask(page, undated)

    await page.goto('/today')

    await expect(comingUpGroup(page, listName).getByRole('listitem')).toHaveText([/Water the plants/])
    await expect(page.getByText(undated, { exact: true })).toHaveCount(0)
  })

  test('AC6: a task due today stays in the existing section and is not repeated under Coming up', async ({ page }) => {
    const listName = await openNewList(page, 'Rent')
    await addTask(page, 'Pay the rent')
    await setDueDate(page, 'Pay the rent', todayInUtc())
    await addTask(page, 'Collect the parcel')
    await setDueDate(page, 'Collect the parcel', daysFromTodayInUtc(1))

    await page.goto('/today')

    // Only the task due tomorrow is coming up; the one due today is still in the section it has always been in.
    await expect(comingUpGroup(page, listName).getByRole('listitem')).toHaveText([/Collect the parcel/])
    await expect(dueGroup(page, listName).getByRole('listitem')).toHaveText([/Pay the rent.*Due today/])
  })

  test('AC7: a Coming up row shows the title and due date, and offers no control to change the status', async ({ page }) => {
    const tomorrow = daysFromTodayInUtc(1)
    const listName = await openNewList(page, 'Parcel pickup')
    await addTask(page, 'Collect the parcel')
    await setDueDate(page, 'Collect the parcel', tomorrow)

    await page.goto('/today')

    await expect(comingUpRow(page, listName, 'Collect the parcel')).toHaveText(
      new RegExp(`Collect the parcel.*${tomorrow}`),
    )
    await expect(comingUpGroup(page, listName).getByRole('button', { name: /change status of/ })).toHaveCount(0)
  })

  test('AC8: the overdue-or-due-today section keeps its groups, rows, status button and saving indicator', async ({ page }) => {
    const listName = await openNewList(page, 'Rent and parcels')
    await addTask(page, 'Pay the rent')
    await setDueDate(page, 'Pay the rent', todayInUtc())
    await addTask(page, 'Collect the parcel')
    await setDueDate(page, 'Collect the parcel', daysFromTodayInUtc(1))

    await page.goto('/today')

    // The new section is on the page…
    await expect(comingUpGroup(page, listName).getByRole('listitem')).toHaveText([/Collect the parcel/])

    // …and the existing one still groups the fixture's overdue tasks by list, in due-date order, with their due
    // information unchanged. The fixture's headings are matched exactly: other tests' lists can be named after them (#86).
    const groups = page.getByRole('heading', { level: 2 })
    await expect(groups.filter({ hasText: /^(Work|Groceries)$/ })).toHaveText(['Work', 'Groceries'])
    await expect(dueGroup(page, 'Work').getByRole('listitem')).toHaveText([
      /Send invoices.*Overdue since 2026-01-10/,
      /Write quarterly report.*Overdue since 2026-01-15/,
    ])
    await expect(dueGroup(page, 'Groceries').getByRole('listitem')).toHaveText([/Buy milk.*Overdue since 2026-01-12/])
    await expect(dueGroup(page, listName).getByRole('listitem')).toHaveText([/Pay the rent.*Due today/])

    // Its status button still advances a task, and the page still reports the change until the server confirms it.
    await dueGroup(page, listName)
      .getByRole('button', { name: 'To do: change status of Pay the rent', exact: true })
      .click()
    await expect(
      dueGroup(page, listName).getByRole('button', { name: 'Doing: change status of Pay the rent', exact: true }),
    ).toBeVisible()
    await expectTodaySaved(page)
  })
})
