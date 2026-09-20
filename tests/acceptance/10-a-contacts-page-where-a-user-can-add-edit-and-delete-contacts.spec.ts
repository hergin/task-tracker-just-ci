import { expect, test } from '@playwright/test'
import {
  SERVER_CONFIRMED,
  addContact,
  addTask,
  contactRow,
  contactRows,
  deleteAllContacts,
  listRow,
  openNewList,
  uniqueName,
  uniqueToken,
} from './support/data'

// Every acceptance test signs in as the same user, and contacts belong to that one user, so the contacts
// tests share one set of contacts: two of them empty it to see the empty state. They run one at a time,
// each still independent of the others (mode 'default', not 'serial').
test.describe.configure({ mode: 'default' })

test.describe('contacts', () => {
  test('AC1: the header links to the contacts page and shows it as the current page', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('banner').getByRole('navigation')
    await expect(nav.getByRole('link', { name: 'Today', exact: true })).toBeVisible()

    await nav.getByRole('link', { name: 'Contacts', exact: true }).click()

    await expect(page).toHaveURL(/\/contacts$/)
    await expect(page.getByRole('heading', { name: 'Contacts', exact: true, level: 1 })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Contacts', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('AC3: the contacts page has a heading, an add form and a list with one item per contact', async ({ page }) => {
    const token = uniqueToken()
    const grace = `Grace Hopper ${token}`
    const alan = `Alan Turing ${token}`
    await page.goto('/contacts')

    await expect(page.getByRole('heading', { name: 'Contacts', exact: true, level: 1 })).toBeVisible()
    await expect(page.getByLabel('Contact name', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Contact email', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add contact', exact: true })).toBeVisible()

    await addContact(page, grace, `grace.${token}@example.com`)
    await addContact(page, alan, `alan.${token}@example.com`)

    await expect(contactRows(page, token)).toHaveCount(2)
    await expect(contactRow(page, grace)).toContainText(`grace.${token}@example.com`)
    await expect(contactRow(page, alan)).toContainText(`alan.${token}@example.com`)
  })

  test('AC4: with no contacts the page says so and shows no list, until one is added', async ({ page }) => {
    await deleteAllContacts(page)

    await expect(page.getByText('No contacts yet.', { exact: true })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Contacts', exact: true })).toHaveCount(0)

    const name = uniqueName('Grace Hopper')
    await addContact(page, name, 'grace@example.com')

    await expect(contactRow(page, name)).toBeVisible()
    await expect(page.getByText('No contacts yet.', { exact: true })).toHaveCount(0)
  })

  test('AC5: a contact appears once the server has saved it, and is still there after a reload', async ({ page }) => {
    const name = uniqueName('Ada Lovelace')
    const email = `ada.${uniqueToken()}@example.com`
    await page.goto('/contacts')
    const nameInput = page.getByLabel('Contact name', { exact: true })
    const emailInput = page.getByLabel('Contact email', { exact: true })

    await nameInput.fill(name)
    await emailInput.fill(email)
    await page.getByRole('button', { name: 'Add contact', exact: true }).click()

    // Both fields clear only once the server has saved the contact.
    await expect(nameInput).toHaveValue('', SERVER_CONFIRMED)
    await expect(emailInput).toHaveValue('')
    await expect(contactRow(page, name)).toContainText(email)

    await page.reload()
    await expect(contactRow(page, name)).toContainText(email)
  })

  test('AC6: the name and the email are trimmed before saving, and the email keeps its case', async ({ page }) => {
    const token = uniqueToken()
    const name = `Ada Lovelace ${token}`
    const email = `Ada.Lovelace.${token}@Example.COM`
    await page.goto('/contacts')

    await page.getByLabel('Contact name', { exact: true }).fill(`  ${name}  `)
    await page.getByLabel('Contact email', { exact: true }).fill(` ${email} `)
    await page.getByRole('button', { name: 'Add contact', exact: true }).click()
    await expect(page.getByLabel('Contact name', { exact: true })).toHaveValue('', SERVER_CONFIRMED)
    await expect(contactRow(page, name)).toContainText(email)

    // Rendered text collapses the spaces around a value, an input's value doesn't: the edit form shows what was stored.
    await page.reload()
    await contactRow(page, name).getByRole('button', { name: `Edit ${name}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${name}`, exact: true })
    await expect(form.getByLabel('Name', { exact: true })).toHaveValue(name)
    await expect(form.getByLabel('Email', { exact: true })).toHaveValue(email)
  })

  test('AC7: adding without a name or without an email is refused and adds nothing', async ({ page }) => {
    const token = uniqueToken()
    await page.goto('/contacts')
    // A contact of this test's own, so the list has loaded before checking that nothing else was added.
    await addContact(page, `Marker ${token}`, `marker.${token}@example.com`)

    await page.getByLabel('Contact name', { exact: true }).fill('   ')
    await page.getByLabel('Contact email', { exact: true }).fill(`no-name.${token}@example.com`)
    await page.getByRole('button', { name: 'Add contact', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Name is required.')

    await page.getByLabel('Contact name', { exact: true }).fill(`No email ${token}`)
    await page.getByLabel('Contact email', { exact: true }).fill('   ')
    await page.getByRole('button', { name: 'Add contact', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Email is required.')

    await expect(contactRows(page, token)).toHaveCount(1)
  })

  test('AC8: an email that is not of the shape something@something.tld is refused', async ({ page }) => {
    const token = uniqueToken()
    await page.goto('/contacts')
    const nameInput = page.getByLabel('Contact name', { exact: true })
    const emailInput = page.getByLabel('Contact email', { exact: true })

    for (const email of ['ada', 'ada@', '@example.com', 'ada@example', 'ada lovelace@example.com', 'ada@@example.com']) {
      await nameInput.fill(`Refused ${token}`)
      await emailInput.fill(email)
      await page.getByRole('button', { name: 'Add contact', exact: true }).click()
      await expect(page.getByRole('alert')).toHaveText('Email must be a valid email address.')
    }

    await addContact(page, `Accepted plain ${token}`, 'ada@example.com')
    await addContact(page, `Accepted subdomain ${token}`, 'a.b+c@mail.example.co.uk')

    // Only the two accepted ones were added.
    await expect(contactRows(page, token)).toHaveCount(2)
  })

  test('AC9: a name over 200 characters or an email over 320 is refused, and exactly 200 and 320 are accepted', async ({ page }) => {
    const token = uniqueToken()
    const longestName = `${'N'.repeat(200 - token.length)}${token}`
    const longestEmail = `${'e'.repeat(320 - token.length - '@example.com'.length)}${token}@example.com`
    await page.goto('/contacts')

    await addContact(page, longestName, longestEmail)
    await expect(contactRows(page, token)).toHaveCount(1)

    await page.getByLabel('Contact name', { exact: true }).fill(`${longestName}N`)
    await page.getByLabel('Contact email', { exact: true }).fill(`over.${token}@example.com`)
    await page.getByRole('button', { name: 'Add contact', exact: true }).click()
    // The criterion asks only that the error says so; the limit it names is 200 characters.
    await expect(page.getByRole('alert')).toContainText('200')

    await page.getByLabel('Contact name', { exact: true }).fill(`Over ${token}`)
    await page.getByLabel('Contact email', { exact: true }).fill(`e${longestEmail}`)
    await page.getByRole('button', { name: 'Add contact', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('320')

    await expect(contactRows(page, token)).toHaveCount(1)
  })

  test('AC10: contacts are listed by name ignoring case, a new one among them, and ties keep their order', async ({ page }) => {
    const token = uniqueToken()
    const zed = `${token} Zed`
    const ada = `${token} ada`
    const bob = `${token} Bob`
    await page.goto('/contacts')

    await addContact(page, zed, `zed.${token}@example.com`)
    await addContact(page, ada, `first.${token}@example.com`)
    // Added last, but it belongs between the other two.
    await addContact(page, bob, `second.${token}@example.com`)

    await expect(contactRows(page, token)).toHaveText([new RegExp(ada), new RegExp(bob), new RegExp(zed)])

    // Two contacts whose names differ only in case keep the same order between reloads.
    const tieToken = uniqueToken()
    await addContact(page, `${tieToken} Sam`, `sam.${tieToken}@example.com`)
    await addContact(page, `${tieToken} sam`, `other.${tieToken}@example.com`)
    const tied = contactRows(page, tieToken)
    await expect(tied).toHaveCount(2)
    const order = await tied.allTextContents()

    await page.reload()
    await expect(tied).toHaveCount(2)
    expect(await tied.allTextContents()).toEqual(order)
  })

  test('AC11: two contacts may share a name, and two may share an email', async ({ page }) => {
    const token = uniqueToken()
    const twin = `Twin ${token}`
    const sharedEmail = `twin.${token}@example.com`
    await page.goto('/contacts')

    await addContact(page, twin, sharedEmail)
    await addContact(page, twin, `other.${token}@example.com`)
    await addContact(page, `Another ${token}`, sharedEmail)

    await expect(contactRows(page, token)).toHaveCount(3)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('AC12: editing a name shows the contact under it, with the same email, in its sorted position', async ({ page }) => {
    const token = uniqueToken()
    const nora = `${token} Nora`
    const zoe = `${token} Zoe`
    const adaKing = `${token} Ada King`
    const email = `zoe.${token}@example.com`
    await page.goto('/contacts')
    await addContact(page, nora, `nora.${token}@example.com`)
    await addContact(page, zoe, email)

    await contactRow(page, zoe).getByRole('button', { name: `Edit ${zoe}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${zoe}`, exact: true })
    await expect(form.getByLabel('Name', { exact: true })).toHaveValue(zoe)
    await expect(form.getByLabel('Email', { exact: true })).toHaveValue(email)
    await expect(form.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
    await form.getByLabel('Name', { exact: true }).fill(adaKing)
    await form.getByRole('button', { name: 'Save', exact: true }).click()

    // The form closes only once the server has saved the change.
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await expect(contactRow(page, adaKing)).toContainText(email)
    await expect(contactRows(page, token)).toHaveText([new RegExp(adaKing), new RegExp(nora)])

    await page.reload()
    await expect(contactRow(page, adaKing)).toContainText(email)
    await expect(contactRow(page, zoe)).toHaveCount(0)
  })

  test('AC13: editing the email saves a valid one and refuses an invalid one, leaving the contact unchanged', async ({ page }) => {
    const token = uniqueToken()
    const name = `Ada Lovelace ${token}`
    const email = `ada.${token}@example.com`
    const newEmail = `ada.${token}@example.org`
    await page.goto('/contacts')
    await addContact(page, name, email)

    await contactRow(page, name).getByRole('button', { name: `Edit ${name}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${name}`, exact: true })
    await form.getByLabel('Email', { exact: true }).fill(newEmail)
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    // The form closes only once the server has saved the change.
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await expect(contactRow(page, name)).toContainText(newEmail)

    await contactRow(page, name).getByRole('button', { name: `Edit ${name}`, exact: true }).click()
    await form.getByLabel('Email', { exact: true }).fill('   ')
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form.getByRole('alert')).toHaveText('Email is required.')

    await form.getByLabel('Email', { exact: true }).fill('ada@example')
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form.getByRole('alert')).toHaveText('Email must be a valid email address.')

    await form.getByLabel('Email', { exact: true }).fill(`${'e'.repeat(321 - '@example.com'.length)}@example.com`)
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form.getByRole('alert')).toContainText('320')

    // The item is still in edit mode, and the stored contact still has the email that was saved.
    await expect(form).toBeVisible()
    await page.reload()
    await expect(contactRow(page, name)).toContainText(newEmail)
  })

  test('AC14: cancelling an edit leaves the contact as it was', async ({ page }) => {
    const token = uniqueToken()
    const name = `Ada Lovelace ${token}`
    const email = `ada.${token}@example.com`
    const dropped = `Dropped ${token}`
    await page.goto('/contacts')
    await addContact(page, name, email)

    await contactRow(page, name).getByRole('button', { name: `Edit ${name}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${name}`, exact: true })
    await form.getByLabel('Name', { exact: true }).fill(dropped)
    await form.getByLabel('Email', { exact: true }).fill(`dropped.${token}@example.com`)
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()

    await expect(form).toHaveCount(0)
    await expect(contactRow(page, name)).toContainText(email)
    await page.reload()
    await expect(contactRow(page, name)).toContainText(email)
    await expect(contactRows(page, dropped)).toHaveCount(0)
  })

  test('AC15: deleting asks for confirmation naming the contact, and cancelling keeps it', async ({ page }) => {
    const token = uniqueToken()
    const name = `Ada Lovelace ${token}`
    const email = `ada.${token}@example.com`
    await page.goto('/contacts')
    await addContact(page, name, email)

    await contactRow(page, name).getByRole('button', { name: `Delete ${name}`, exact: true }).click()

    await expect(page.getByText(`Delete "${name}"? This can't be undone.`, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete contact', exact: true })).toBeVisible()
    await contactRow(page, name).getByRole('button', { name: 'Cancel', exact: true }).click()

    await expect(contactRow(page, name)).toContainText(email)
    await page.reload()
    await expect(contactRow(page, name)).toContainText(email)
  })

  test('AC16: confirming the delete removes the contact, says so, and brings back the empty state', async ({ page }) => {
    await deleteAllContacts(page)
    const name = uniqueName('Ada Lovelace')
    await addContact(page, name, 'ada@example.com')

    await contactRow(page, name).getByRole('button', { name: `Delete ${name}`, exact: true }).click()
    await page.getByRole('button', { name: 'Delete contact', exact: true }).click()

    // The notice appears only once the server has deleted the contact.
    await expect(page.getByText(`Deleted "${name}".`, { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expect(contactRow(page, name)).toHaveCount(0)
    await expect(page.getByText('No contacts yet.', { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.getByText('No contacts yet.', { exact: true })).toBeVisible()
  })

  test('AC19: a contact changes nothing on the lists, tasks, search or assignee choices', async ({ page }) => {
    const token = uniqueToken()
    const contact = `Grace Hopper ${token}`
    await page.goto('/contacts')
    await addContact(page, contact, `grace.${token}@example.com`)

    // The lists screen and a list's tasks are the same as without contacts.
    await page.goto('/')
    await expect(listRow(page, 'Groceries')).toContainText('2 open')
    await expect(page.getByRole('list', { name: 'Lists', exact: true }).getByRole('listitem').filter({ hasText: token })).toHaveCount(0)
    await page.goto('/lists/list-groceries')
    await expect(page.getByText('Buy milk', { exact: true })).toBeVisible()

    // The assignee choices are still every registered user's profile, and never a contact.
    await openNewList(page, 'Contacts check')
    await addTask(page, 'Check the assignee choices')
    await page.getByRole('button', { name: 'Edit Check the assignee choices', exact: true }).click()
    const form = page.getByRole('form', { name: 'Edit Check the assignee choices', exact: true })
    const assignee = form.getByRole('combobox', { name: 'Assigned to', exact: true })
    await expect(assignee.getByRole('option', { name: 'E2E Other', exact: true })).toHaveCount(1)
    await expect(assignee.getByRole('option', { name: contact, exact: true })).toHaveCount(0)
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()

    // Search still finds tasks, and never a contact.
    await page.getByRole('textbox', { name: 'Search tasks', exact: true }).fill('invoices')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(
      page.getByRole('list', { name: 'Search results', exact: true }).getByRole('link', { name: 'Send invoices in Work', exact: true }),
    ).toBeVisible()
    await page.getByRole('textbox', { name: 'Search tasks', exact: true }).fill(contact)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByText(`No tasks match "${contact}".`, { exact: true })).toBeVisible()
  })
})

test.describe('contacts, signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('AC2: a signed-out visitor who opens /contacts sees the sign-in screen', async ({ page }) => {
    await page.goto('/contacts')

    await expect(page.getByRole('button', { name: 'Sign in with GitHub', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Contacts', exact: true, level: 1 })).toHaveCount(0)
  })
})
