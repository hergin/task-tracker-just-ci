import { expect, test, type Page } from '@playwright/test'
import { addTask, expectTasksSaved, listRow, openNewList, setDueDate, todayInUtc } from './support/data'

/** A date `offset` days from today, as 'YYYY-MM-DD'. Tests run in the UTC time zone (playwright.config.ts). */
function dayInUtc(offset: number): string {
  const date = new Date(`${todayInUtc()}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

/** On a list page: the status button of the task titled `title`, named after the status it has now. */
function statusButtonAt(page: Page, status: string, title: string) {
  return page.getByRole('button', { name: `${status}: change status of ${title}`, exact: true })
}

/**
 * On a list page with no filter applied: advances a To do task to Doing, Done or Postponed by clicking its status
 * button, expanding the Done group to reach it once it is done, and waits until the server has saved it.
 */
async function setStatus(page: Page, title: string, status: 'Doing' | 'Done' | 'Postponed'): Promise<void> {
  await statusButtonAt(page, 'To do', title).click()
  await expect(statusButtonAt(page, 'Doing', title)).toBeVisible()
  if (status !== 'Doing') {
    await statusButtonAt(page, 'Doing', title).click()
    const doneToggle = page.getByRole('button', { name: /^Done \(\d+\)$/ })
    await expect(doneToggle).toBeVisible()
    if ((await doneToggle.getAttribute('aria-expanded')) === 'false') await doneToggle.click()
    await expect(statusButtonAt(page, 'Done', title)).toBeVisible()
    if (status === 'Postponed') {
      await statusButtonAt(page, 'Done', title).click()
      await expect(statusButtonAt(page, 'Postponed', title)).toBeVisible()
    }
  }
  await expectTasksSaved(page)
}

test.describe('an overdue count on each list', () => {
  test('AC1: a list with one overdue To do task shows 1 overdue after its 1 open, and two such tasks show 2 overdue', async ({
    page,
  }) => {
    const listName = await openNewList(page, 'Overdue chores')
    await addTask(page, 'Pay the rent')
    await setDueDate(page, 'Pay the rent', dayInUtc(-1))

    await page.goto('/')
    await expect(listRow(page, listName)).toHaveText(/1 open\s*1 overdue/)

    await listRow(page, listName).getByRole('link').click()
    await addTask(page, 'Pay the phone bill')
    await setDueDate(page, 'Pay the phone bill', dayInUtc(-1))

    await page.goto('/')
    await expect(listRow(page, listName)).toHaveText(/2 open\s*2 overdue/)
  })

  test('AC2: a Doing task due before today counts as overdue, the same as a To do task', async ({ page }) => {
    const listName = await openNewList(page, 'Doing and late')
    await addTask(page, 'Draft the letter')
    await setDueDate(page, 'Draft the letter', dayInUtc(-1))
    await setStatus(page, 'Draft the letter', 'Doing')

    await page.goto('/')
    await expect(listRow(page, listName)).toHaveText(/1 open\s*1 overdue/)
  })

  test('AC3: a task due today is not counted', async ({ page }) => {
    const mixed = await openNewList(page, 'Today and late')
    await addTask(page, 'Water the plants')
    await setDueDate(page, 'Water the plants', todayInUtc())
    await addTask(page, 'Call the bank')
    await setDueDate(page, 'Call the bank', dayInUtc(-1))

    const todayOnly = await openNewList(page, 'Due today only')
    await addTask(page, 'Collect the parcel')
    await setDueDate(page, 'Collect the parcel', todayInUtc())

    await page.goto('/')
    // Both tasks are open, only the one due yesterday is overdue.
    await expect(listRow(page, mixed)).toHaveText(/2 open\s*1 overdue/)
    await expect(listRow(page, todayOnly)).toContainText('1 open')
    await expect(listRow(page, todayOnly).getByText(/overdue/i)).toHaveCount(0)
  })

  test('AC4: a task due in the future, and a task with no due date, are not counted', async ({ page }) => {
    const listName = await openNewList(page, 'Mixed due dates')
    await addTask(page, 'Book the flights')
    await setDueDate(page, 'Book the flights', dayInUtc(1))
    await addTask(page, 'Buy a gift')
    await addTask(page, 'Renew the passport')
    await setDueDate(page, 'Renew the passport', dayInUtc(-1))

    await page.goto('/')
    await expect(listRow(page, listName)).toHaveText(/3 open\s*1 overdue/)
  })

  test('AC5: a Done task with a due date before today is not counted', async ({ page }) => {
    const listName = await openNewList(page, 'Late and finished')
    await addTask(page, 'File the taxes')
    await setDueDate(page, 'File the taxes', dayInUtc(-1))
    await setStatus(page, 'File the taxes', 'Done')
    await addTask(page, 'Send the form')
    await setDueDate(page, 'Send the form', dayInUtc(-1))

    await page.goto('/')
    await expect(listRow(page, listName)).toHaveText(/1 open\s*1 overdue/)
  })

  test('AC6: a Postponed task with a due date before today is not counted', async ({ page }) => {
    const listName = await openNewList(page, 'Late and postponed')
    await addTask(page, 'Fix the shed')
    await setDueDate(page, 'Fix the shed', dayInUtc(-1))
    await setStatus(page, 'Fix the shed', 'Postponed')
    await addTask(page, 'Mow the lawn')
    await setDueDate(page, 'Mow the lawn', dayInUtc(-1))

    await page.goto('/')
    // The postponed task is still open, but never overdue.
    await expect(listRow(page, listName)).toHaveText(/2 open\s*1 overdue/)
  })

  test('AC7: a list with nothing overdue shows no overdue text at all', async ({ page }) => {
    const listName = await openNewList(page, 'Nothing late')
    await addTask(page, 'Sort the photos')
    await addTask(page, 'Ring the dentist')
    await setDueDate(page, 'Ring the dentist', todayInUtc())
    await addTask(page, 'Pack the bags')
    await setDueDate(page, 'Pack the bags', dayInUtc(1))
    await addTask(page, 'Post the cards')
    await setDueDate(page, 'Post the cards', dayInUtc(-1))
    await setStatus(page, 'Post the cards', 'Postponed')
    await addTask(page, 'Take the bins out')
    await setDueDate(page, 'Take the bins out', dayInUtc(-1))
    await setStatus(page, 'Take the bins out', 'Done')

    await page.goto('/')
    // The fixture's Groceries is the control: it has an overdue task, so an overdue count is rendered on this page.
    await expect(listRow(page, 'Groceries')).toContainText('1 overdue')
    // Nothing at all between this list's open count and its Rename button: no "0 overdue", no empty placeholder text.
    await expect(listRow(page, listName)).toHaveText(/4 open\s*Rename/)
    await expect(listRow(page, listName).getByText(/overdue/i)).toHaveCount(0)
  })

  test('AC8: the open count is unchanged: a postponed task still counts as open, overdue or not', async ({ page }) => {
    const listName = await openNewList(page, 'Open count')
    await addTask(page, 'Sand the door')
    await setDueDate(page, 'Sand the door', dayInUtc(-1))
    await setStatus(page, 'Sand the door', 'Postponed')
    await addTask(page, 'Oil the hinges')
    await setStatus(page, 'Oil the hinges', 'Postponed')
    await addTask(page, 'Paint the door')
    await setDueDate(page, 'Paint the door', dayInUtc(-1))

    await page.goto('/')
    // Two postponed tasks, one of them dated in the past, plus one overdue To do task.
    await expect(listRow(page, listName)).toHaveText(/3 open\s*1 overdue/)
    await expect(listRow(page, 'Groceries')).toContainText('2 open')
    await expect(listRow(page, 'Work')).toContainText('3 open')
    await expect(listRow(page, 'Empty list')).toContainText('0 open')
  })

  test('AC10: the count rises and falls on an open lists page, without reloading it', async ({ page }) => {
    const listName = await openNewList(page, 'Live count')
    const listUrl = page.url()
    await addTask(page, 'Change the tyres')
    await setDueDate(page, 'Change the tyres', dayInUtc(-1))

    await page.goto('/')
    await expect(listRow(page, listName)).toHaveText(/1 open\s*1 overdue/)

    // A second tab makes the changes, so the lists page below is never reloaded or navigated.
    const editor = await page.context().newPage()
    await editor.goto(listUrl)
    await addTask(editor, 'Replace the wipers')
    await setDueDate(editor, 'Replace the wipers', dayInUtc(-1))
    await expect(listRow(page, listName)).toHaveText(/2 open\s*2 overdue/)

    await setStatus(editor, 'Replace the wipers', 'Done')
    await expect(listRow(page, listName)).toHaveText(/1 open\s*1 overdue/)

    await setDueDate(editor, 'Change the tyres', todayInUtc())
    await expect(listRow(page, listName)).toHaveText(/1 open\s*Rename/)
    await expect(listRow(page, listName).getByText(/overdue/i)).toHaveCount(0)
    await editor.close()
  })

  test('AC11: with the seeded fixture, Groceries shows 1 overdue, Work 2 overdue and Empty list none', async ({ page }) => {
    await page.goto('/')

    // Buy milk is overdue; Buy eggs is done and Buy bread has no due date.
    await expect(listRow(page, 'Groceries')).toHaveText(/2 open\s*1 overdue/)
    // Send invoices and Write quarterly report are overdue; Archive old files is done and Plan next year has no due date.
    await expect(listRow(page, 'Work')).toHaveText(/3 open\s*2 overdue/)
    await expect(listRow(page, 'Empty list')).toHaveText(/0 open\s*Rename/)
    await expect(listRow(page, 'Empty list').getByText(/overdue/i)).toHaveCount(0)
  })

  test("AC12: another user's list contributes to no count", async ({ page }) => {
    await page.goto('/')

    // The counts are exactly those of the signed-in user's own tasks...
    await expect(listRow(page, 'Groceries')).toContainText('1 overdue')
    await expect(listRow(page, 'Work')).toContainText('2 overdue')
    // ...and the other user's list has no row, so no count, on this page.
    await expect(
      page.getByRole('list', { name: 'Lists', exact: true }).getByRole('link', { name: 'Private list of another user', exact: true }),
    ).toHaveCount(0)
  })
})

test.describe('an overdue count in a browser ahead of UTC', () => {
  // UTC+14: for most of the UTC day this browser's local date is already the next one.
  const TIME_ZONE = 'Pacific/Kiritimati'

  test.use({ timezoneId: TIME_ZONE })

  /** A date `offset` days from today as a browser in TIME_ZONE sees it, as 'YYYY-MM-DD'. */
  function dayInZone(offset: number): string {
    const date = new Date(`${new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE })}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + offset)
    return date.toISOString().slice(0, 10)
  }

  test("AC9: overdue is judged by the browser's local date, the same day the Today page uses", async ({ page }) => {
    const listName = await openNewList(page, 'Local dates')
    await addTask(page, 'Send the parcel')
    await setDueDate(page, 'Send the parcel', dayInZone(-1))
    await addTask(page, 'Buy the stamps')
    await setDueDate(page, 'Buy the stamps', dayInZone(0))

    // The Today page judges by this browser's local date: local yesterday is overdue, local today is not.
    await page.getByRole('link', { name: 'Today', exact: true }).click()
    await expect(page.getByRole('list', { name: `Due in ${listName}`, exact: true }).getByRole('listitem')).toHaveText([
      new RegExp(`Send the parcel.*Overdue since ${dayInZone(-1)}`),
      /Buy the stamps.*Due today/,
    ])

    await page.goto('/')
    await expect(listRow(page, listName)).toHaveText(/2 open\s*1 overdue/)
  })
})
