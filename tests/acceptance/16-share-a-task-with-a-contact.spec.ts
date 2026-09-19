import { expect, test, type Locator, type Page } from '@playwright/test'
import { SERVER_CONFIRMED, addTask, expectTasksSaved, openNewList, statusButton, taskRow, uniqueName } from './support/data'

// Sharing a task with one of the account's contacts, from the task's row on its list page. The contacts themselves come
// from the contacts page (issue #15), which also seeds the test account's contacts, so these tests never name a contact:
// they read the names the picker offers and share with those.

/** The option a task's picker starts on, when nobody is chosen to share with. */
const PLACEHOLDER = 'Choose a contact'

/** The contacts picker on a task's row. */
function sharePicker(page: Page, taskTitle: string): Locator {
  return page.getByLabel(`Share ${taskTitle} with`, { exact: true })
}

/** The button that shares a task with the contact chosen in its picker. */
function shareButton(page: Page, taskTitle: string): Locator {
  return page.getByRole('button', { name: `Share ${taskTitle}`, exact: true })
}

/** The `Contacts {taskTitle} is shared with` list on a task's row. */
function sharedWith(page: Page, taskTitle: string): Locator {
  return taskRow(page, taskTitle).getByRole('list', { name: `Contacts ${taskTitle} is shared with`, exact: true })
}

/** The names on that list, in the order shown. */
function sharedWithNames(page: Page, taskTitle: string): Locator {
  return sharedWith(page, taskTitle).getByRole('listitem')
}

/** The open Tasks list's own rows, without the smaller lists inside them: only a task row has a Delete button. */
function taskRows(page: Page): Locator {
  return page
    .getByRole('list', { name: 'Tasks', exact: true })
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: /^Delete / }) })
}

/** The names a task's picker offers, in the order shown, without the placeholder. */
async function offeredContacts(page: Page, taskTitle: string): Promise<string[]> {
  await expect(sharePicker(page, taskTitle)).toBeVisible()
  const options = await sharePicker(page, taskTitle).getByRole('option').allTextContents()
  return options.map((option) => option.trim()).filter((option) => option !== PLACEHOLDER)
}

/** The first contact a task's picker offers. The seed fixture gives the test account at least one contact (issue #15). */
async function firstContact(page: Page, taskTitle: string): Promise<string> {
  const [contact] = await offeredContacts(page, taskTitle)
  if (contact === undefined) throw new Error('the picker offers no contact; the seed fixture gives the test account at least one')
  return contact
}

/** Shares a task with a contact and waits until their name shows on the task. */
async function shareTask(page: Page, taskTitle: string, contact: string): Promise<void> {
  await sharePicker(page, taskTitle).selectOption({ label: contact })
  await shareButton(page, taskTitle).click()
  await expect(sharedWith(page, taskTitle)).toContainText(contact)
}

/** Stops sharing a task with a contact. */
async function stopSharing(page: Page, taskTitle: string, contact: string): Promise<void> {
  await taskRow(page, taskTitle).getByRole('button', { name: `Stop sharing ${taskTitle} with ${contact}`, exact: true }).click()
}

/** A fresh list with one task, shared with nobody. */
async function openTaskToShare(page: Page, base: string): Promise<string> {
  const taskTitle = uniqueName(base)
  await openNewList(page, 'Party')
  await addTask(page, taskTitle)
  return taskTitle
}

test.describe('share a task with a contact', () => {
  test('AC1: every task offers a contacts picker and a Share button, disabled on the placeholder', async ({ page }) => {
    const first = uniqueName('Book the hall')
    const second = uniqueName('Order the cake')
    await openNewList(page, 'Party')
    await addTask(page, first)
    await addTask(page, second)

    for (const taskTitle of [first, second]) {
      await expect(sharePicker(page, taskTitle)).toBeVisible()
      await expect(sharePicker(page, taskTitle).getByRole('option', { name: PLACEHOLDER, exact: true })).toHaveCount(1)
      // The picker starts on the placeholder, which leaves nobody chosen, so there is nothing to share yet.
      await expect(shareButton(page, taskTitle)).toBeDisabled()
    }
  })

  test('AC2: the picker offers contacts by name, and never the signed-in user', async ({ page }) => {
    const taskTitle = await openTaskToShare(page, 'Send invitations')

    const contacts = await offeredContacts(page, taskTitle)

    expect(contacts.length, 'the seed fixture gives the test account at least one contact').toBeGreaterThan(0)
    expect(contacts).not.toContain('E2E Owner')
  })

  test('AC3: choosing a contact and pressing Share shows their name on the task', async ({ page }) => {
    const taskTitle = await openTaskToShare(page, 'Hire a photographer')
    const contact = await firstContact(page, taskTitle)

    await sharePicker(page, taskTitle).selectOption({ label: contact })
    await expect(shareButton(page, taskTitle)).toBeEnabled()
    await shareButton(page, taskTitle).click()

    await expect(sharedWithNames(page, taskTitle)).toHaveText([contact])
    // The picker goes back to the placeholder, which leaves nobody chosen again.
    await expect(shareButton(page, taskTitle)).toBeDisabled()
  })

  test('AC4: a contact on a task is no longer offered there, but is still offered on another task', async ({ page }) => {
    const shared = uniqueName('Hire a band')
    const other = uniqueName('Book the caterer')
    await openNewList(page, 'Party')
    await addTask(page, shared)
    await addTask(page, other)
    const contact = await firstContact(page, shared)

    await shareTask(page, shared, contact)

    expect(await offeredContacts(page, shared)).not.toContain(contact)
    expect(await offeredContacts(page, other)).toContain(contact)
  })

  test('AC5: a task shared with nobody shows no contacts list, and a new task and the fixture start that way', async ({ page }) => {
    const shared = uniqueName('Hire a DJ')
    const untouched = uniqueName('Buy balloons')
    await openNewList(page, 'Party')
    await addTask(page, shared)
    await addTask(page, untouched)
    const contact = await firstContact(page, shared)

    await shareTask(page, shared, contact)

    // The shared task proves the list is shown at all before the other task is checked for not having one.
    await expect(sharedWithNames(page, shared)).toHaveText([contact])
    await expect(sharedWith(page, untouched)).toHaveCount(0)

    await expectTasksSaved(page)
    await page.goto('/lists/list-groceries')
    await expect(sharePicker(page, 'Buy milk')).toBeVisible()
    await expect(sharedWith(page, 'Buy milk')).toHaveCount(0)
  })

  test('AC6: contacts are shown in the order they were shared', async ({ page }) => {
    const taskTitle = await openTaskToShare(page, 'Plan the games')
    // Shared in the reverse of the order the picker offers them, so the order shown can only come from the order
    // they were shared in. With a single contact in the fixture this shares, and expects, just that one.
    const inShareOrder = (await offeredContacts(page, taskTitle)).reverse()
    expect(inShareOrder.length, 'the seed fixture gives the test account at least one contact').toBeGreaterThan(0)

    for (const contact of inShareOrder) await shareTask(page, taskTitle, contact)

    await expect(sharedWithNames(page, taskTitle)).toHaveText(inShareOrder)
  })

  test('AC7: stopping sharing removes that name, leaves the others, and offers the contact again', async ({ page }) => {
    const taskTitle = await openTaskToShare(page, 'Write the speech')
    const contacts = await offeredContacts(page, taskTitle)
    expect(contacts.length, 'the seed fixture gives the test account at least one contact').toBeGreaterThan(0)
    for (const contact of contacts) await shareTask(page, taskTitle, contact)
    await expect(sharedWithNames(page, taskTitle)).toHaveText(contacts)

    for (const [index, contact] of contacts.entries()) {
      await stopSharing(page, taskTitle, contact)
      const left = contacts.slice(index + 1)
      if (left.length > 0) await expect(sharedWithNames(page, taskTitle)).toHaveText(left)
    }

    // With the last name gone the list goes too, and everyone is on offer again.
    await expect(sharedWith(page, taskTitle)).toHaveCount(0)
    expect(await offeredContacts(page, taskTitle)).toEqual(expect.arrayContaining(contacts))
  })

  test('AC8: a reload still shows the names, and still shows them gone after stopping sharing', async ({ page }) => {
    const taskTitle = await openTaskToShare(page, 'Order the flowers')
    const contact = await firstContact(page, taskTitle)

    await shareTask(page, taskTitle, contact)
    await expectTasksSaved(page)
    await page.reload()
    await expect(sharedWithNames(page, taskTitle)).toHaveText([contact])

    await stopSharing(page, taskTitle, contact)
    await expect(sharedWith(page, taskTitle)).toHaveCount(0)
    await expectTasksSaved(page)
    await page.reload()
    await expect(sharePicker(page, taskTitle)).toBeVisible()
    await expect(sharedWith(page, taskTitle)).toHaveCount(0)
  })

  test('AC9: the page shows Saving… while a share and an unshare are unconfirmed', async ({ page }) => {
    const taskTitle = await openTaskToShare(page, 'Print the menus')
    const contact = await firstContact(page, taskTitle)
    const saving = page.getByText('Saving…', { exact: true })

    // Offline the change still shows on the page, but the server cannot confirm it, which is what "Saving…" reports.
    await page.context().setOffline(true)
    await sharePicker(page, taskTitle).selectOption({ label: contact })
    await shareButton(page, taskTitle).click()
    await expect(sharedWith(page, taskTitle)).toContainText(contact)
    await expect(saving).toBeVisible()

    await page.context().setOffline(false)
    await expectTasksSaved(page)

    await page.context().setOffline(true)
    await stopSharing(page, taskTitle, contact)
    await expect(sharedWith(page, taskTitle)).toHaveCount(0)
    await expect(saving).toBeVisible()

    await page.context().setOffline(false)
    await expectTasksSaved(page)
  })

  test('AC11: sharing leaves the rest of the task alone, and saving its Edit form leaves the sharing alone', async ({ page }) => {
    const taskTitle = uniqueName('Plan the menu')
    const second = uniqueName('Thank the guests')
    await openNewList(page, 'Party')
    await addTask(page, taskTitle)
    await addTask(page, second)

    await page.getByRole('button', { name: `Edit ${taskTitle}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${taskTitle}`, exact: true })
    await form.getByLabel('Notes', { exact: true }).fill('Vegetarian options')
    await form.getByLabel('Due date', { exact: true }).fill('2030-02-01')
    await form.getByLabel('Assigned to', { exact: true }).selectOption({ label: 'E2E Other' })
    await form.getByLabel('New tag', { exact: true }).fill('catering')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await statusButton(page, taskTitle).click()
    await expect(taskRow(page, taskTitle)).toContainText('Doing')
    const contact = await firstContact(page, taskTitle)

    await shareTask(page, taskTitle, contact)

    const row = taskRow(page, taskTitle)
    await expect(row).toContainText('Vegetarian options')
    await expect(row).toContainText('Due 2030-02-01')
    await expect(row).toContainText('Assigned to E2E Other')
    await expect(row).toContainText('Doing')
    await expect(row.getByRole('list', { name: `Tags for ${taskTitle}`, exact: true }).getByRole('listitem')).toHaveText(['catering'])
    // Position: the two tasks are still in the order they were added.
    await expect(taskRows(page).first()).toContainText(taskTitle)
    await expect(taskRows(page).nth(1)).toContainText(second)

    // Saving the edit form again changes nobody the task is shared with.
    await page.getByRole('button', { name: `Edit ${taskTitle}`, exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await expect(sharedWithNames(page, taskTitle)).toHaveText([contact])
  })
})
