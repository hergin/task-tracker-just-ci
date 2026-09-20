import { expect, test } from '@playwright/test'
import {
  SERVER_CONFIRMED,
  addContact,
  contactList,
  contactRow,
  openContacts,
  uniqueName,
  uniqueToken,
} from './support/data'

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('AC1: opening /contacts signed out shows the sign-in screen', async ({ page }) => {
    await page.goto('/contacts')

    await expect(page.getByRole('button', { name: 'Sign in with GitHub', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your contacts', exact: true })).toHaveCount(0)
  })
})

test.describe('contacts', () => {
  test('AC1: the navigation has a Contacts link next to Today, which opens the contacts page', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation')

    await expect(nav.getByRole('link', { name: 'Today', exact: true })).toBeVisible()
    await nav.getByRole('link', { name: 'Contacts', exact: true }).click()

    await expect(page).toHaveURL(/\/contacts$/)
    await expect(page.getByRole('heading', { name: 'Your contacts', exact: true })).toBeVisible()
  })

  test('AC2: the contacts page has an add form with Name, Email and Note', async ({ page }) => {
    await openContacts(page)

    await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Note', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add contact', exact: true })).toBeVisible()
  })

  test('AC3: a contact added with a name, an email and a note shows all three, clears the form and survives a reload', async ({
    page,
  }) => {
    const name = uniqueName('Ada Lovelace')
    const email = 'ada@example.com'
    const note = 'Met at the 2026 conference'

    await openContacts(page)
    // The helper waits for the Name field to clear, which happens only once the server has saved the contact.
    await addContact(page, { name, email, note })

    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('Note', { exact: true })).toHaveValue('')
    const row = contactRow(page, name)
    await expect(row).toContainText(email)
    await expect(row).toContainText(note)

    await page.reload()
    await expect(contactRow(page, name)).toContainText(email)
    await expect(contactRow(page, name)).toContainText(note)
  })

  test('AC4: a contact added with only a name shows just the name and survives a reload', async ({ page }) => {
    const name = uniqueName('Grace Hopper')

    await openContacts(page)
    await addContact(page, { name })

    const row = contactRow(page, name)
    await expect(row).toBeVisible()
    // Nothing is shown where an email would be.
    await expect(row.getByText(/@/)).toHaveCount(0)

    await page.reload()
    await expect(contactRow(page, name)).toBeVisible()
    await expect(contactRow(page, name).getByText(/@/)).toHaveCount(0)
  })

  test('AC5: a contact name is required', async ({ page }) => {
    const before = uniqueName('Katherine Johnson')
    await openContacts(page)
    await addContact(page, { name: before })

    await page.getByLabel('Name', { exact: true }).fill('   ')
    await page.getByRole('button', { name: 'Add contact', exact: true }).click()

    await expect(page.getByRole('alert')).toHaveText('Name is required.')
    // Nothing was saved: the form only clears once the server has stored a contact, and the earlier one is untouched.
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('   ')
    await expect(contactRow(page, before)).toBeVisible()
  })

  test('AC6: spaces around the fields are removed before saving', async ({ page }) => {
    const name = uniqueName('Ada')
    const padded = `  ${name}  `

    await openContacts(page)
    await addContact(page, { name: padded, email: '   ', note: '  ' })

    const row = contactRow(page, name)
    await expect(row).toBeVisible()
    // Rendered text is whitespace-normalized, an input's value is not, so the edit form shows what was stored.
    await row.getByRole('button', { name: `Edit ${name}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${name}`, exact: true })
    await expect(form.getByLabel('Name', { exact: true })).toHaveValue(name)
    await expect(form.getByLabel('Email', { exact: true })).toHaveValue('')
    await expect(form.getByLabel('Note', { exact: true })).toHaveValue('')
  })

  test('AC7: an email is checked only when given, and must have one @ with text on both sides and no spaces', async ({
    page,
  }) => {
    const refused = uniqueName('Refused')
    const accepted = uniqueName('Ada Lovelace')

    await openContacts(page)
    for (const invalid of ['ada', 'ada@', '@example.com', 'a@@b.com', 'ada lovelace@example.com']) {
      await page.getByLabel('Name', { exact: true }).fill(refused)
      await page.getByLabel('Email', { exact: true }).fill(invalid)
      await page.getByRole('button', { name: 'Add contact', exact: true }).click()
      await expect(page.getByRole('alert')).toHaveText('Enter a valid email address.')
    }

    await page.getByLabel('Name', { exact: true }).fill(accepted)
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com')
    await page.getByRole('button', { name: 'Add contact', exact: true }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('', SERVER_CONFIRMED)

    // The accepted contact proves rows are shown, so the count below is not vacuous.
    await expect(contactRow(page, accepted)).toContainText('ada@example.com')
    await expect(contactRow(page, refused)).toHaveCount(0)
  })

  test('AC8: a value at its length limit is saved and one over it is refused', async ({ page }) => {
    const token = uniqueToken()
    const atLimitName = `${token} ${'a'.repeat(191)}` // 200 characters
    const atLimitEmail = `${'a'.repeat(308)}@example.com` // 320 characters
    const atLimitNote = 'n'.repeat(5000)
    const overLimit = [
      { contactName: `${token} ${'a'.repeat(192)}`, email: '', note: '' }, // a 201-character name
      { contactName: `${token} long email`, email: `${'a'.repeat(309)}@example.com`, note: '' },
      { contactName: `${token} long note`, email: '', note: 'n'.repeat(5001) },
    ]

    await openContacts(page)
    await addContact(page, { name: atLimitName, email: atLimitEmail, note: atLimitNote })
    await expect(contactRow(page, atLimitName)).toBeVisible()

    for (const fields of overLimit) {
      await page.getByLabel('Name', { exact: true }).fill(fields.contactName)
      await page.getByLabel('Email', { exact: true }).fill(fields.email)
      await page.getByLabel('Note', { exact: true }).fill(fields.note)
      await page.getByRole('button', { name: 'Add contact', exact: true }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(contactRow(page, fields.contactName)).toHaveCount(0)
    }
  })

  test('AC9: contacts are sorted by name ignoring case, and two with the same name keep a stable order', async ({
    page,
  }) => {
    const token = uniqueToken()
    const alice = `alice ${token}`
    const bob = `Bob ${token}`
    const carol = `carol ${token}`
    const duplicate = `dup ${token}`

    await openContacts(page)
    await addContact(page, { name: carol })
    await addContact(page, { name: alice })
    await addContact(page, { name: bob })

    // Only this test's own contacts: other tests' contacts sort anywhere in the page's list.
    const mine = contactList(page).getByRole('listitem').filter({ hasText: token })
    await expect(mine).toHaveCount(3)
    await expect(mine.nth(0)).toContainText(alice)
    await expect(mine.nth(1)).toContainText(bob)
    await expect(mine.nth(2)).toContainText(carol)

    await addContact(page, { name: duplicate, note: 'First of two' })
    await addContact(page, { name: duplicate, note: 'Second of two' })
    const both = contactList(page).getByRole('listitem').filter({ hasText: duplicate })
    await expect(both).toHaveCount(2)
    const order = await both.allInnerTexts()

    await page.reload()
    await expect(both).toHaveCount(2)
    expect(await both.allInnerTexts()).toEqual(order)
  })

  test('AC10: each contact row has Edit and Delete buttons named after the contact', async ({ page }) => {
    const name = uniqueName('Ada Lovelace')

    await openContacts(page)
    await addContact(page, { name })

    const row = contactRow(page, name)
    await expect(row.getByRole('button', { name: `Edit ${name}`, exact: true })).toBeVisible()
    await expect(row.getByRole('button', { name: `Delete ${name}`, exact: true })).toBeVisible()
  })

  test('AC11: editing a contact prefills the form, shows the new values and moves the row to its new place', async ({
    page,
  }) => {
    const token = uniqueToken()
    const before = `${token} alpha`
    const after = `${token} gamma`
    const other = `${token} beta`

    await openContacts(page)
    await addContact(page, { name: before, email: 'alpha@example.com', note: 'First note' })
    await addContact(page, { name: other })

    await contactRow(page, before).getByRole('button', { name: `Edit ${before}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${before}`, exact: true })
    await expect(form.getByLabel('Name', { exact: true })).toHaveValue(before)
    await expect(form.getByLabel('Email', { exact: true })).toHaveValue('alpha@example.com')
    await expect(form.getByLabel('Note', { exact: true })).toHaveValue('First note')

    await form.getByLabel('Name', { exact: true }).fill(after)
    await form.getByLabel('Email', { exact: true }).fill('gamma@example.com')
    await form.getByLabel('Note', { exact: true }).fill('Second note')
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    // The form closes only once the server has saved the contact.
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)

    await expect(contactRow(page, after)).toContainText('gamma@example.com')
    await expect(contactRow(page, after)).toContainText('Second note')
    const mine = contactList(page).getByRole('listitem').filter({ hasText: token })
    await expect(mine.nth(0)).toContainText(other)
    await expect(mine.nth(1)).toContainText(after)

    await page.reload()
    await expect(contactRow(page, after)).toContainText('gamma@example.com')
    await expect(contactRow(page, before)).toHaveCount(0)
  })

  test('AC12: an edit with an empty name, an invalid email or an over-long value changes nothing, and clearing a field removes it', async ({
    page,
  }) => {
    const name = uniqueName('Ada Lovelace')
    const note = 'Met at the 2026 conference'

    await openContacts(page)
    await addContact(page, { name, email: 'ada@example.com', note })

    await contactRow(page, name).getByRole('button', { name: `Edit ${name}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${name}`, exact: true })

    await form.getByLabel('Name', { exact: true }).fill('   ')
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form.getByRole('alert')).toHaveText('Name is required.')
    await expect(form).toBeVisible()

    await form.getByLabel('Name', { exact: true }).fill(name)
    await form.getByLabel('Email', { exact: true }).fill('ada@')
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form.getByRole('alert')).toHaveText('Enter a valid email address.')

    await form.getByLabel('Email', { exact: true }).fill(`${'a'.repeat(309)}@example.com`)
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form.getByRole('alert')).toBeVisible()
    await expect(form).toBeVisible()

    // None of the refused saves changed the contact.
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(contactRow(page, name)).toContainText('ada@example.com')
    await expect(contactRow(page, name)).toContainText(note)

    await contactRow(page, name).getByRole('button', { name: `Edit ${name}`, exact: true }).click()
    await form.getByLabel('Email', { exact: true }).fill('')
    await form.getByLabel('Note', { exact: true }).fill('')
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)

    await expect(contactRow(page, name)).toBeVisible()
    await expect(contactRow(page, name).getByText(/@/)).toHaveCount(0)
    await expect(contactRow(page, name)).not.toContainText(note)
  })

  test('AC13: cancelling an edit leaves the contact unchanged', async ({ page }) => {
    const name = uniqueName('Ada Lovelace')
    const changed = uniqueName('Changed')

    await openContacts(page)
    await addContact(page, { name, email: 'ada@example.com', note: 'Met at the 2026 conference' })

    await contactRow(page, name).getByRole('button', { name: `Edit ${name}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${name}`, exact: true })
    await form.getByLabel('Name', { exact: true }).fill(changed)
    await form.getByLabel('Email', { exact: true }).fill('changed@example.com')
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()

    await expect(form).toHaveCount(0)
    await expect(contactRow(page, name)).toContainText('ada@example.com')

    await page.reload()
    await expect(contactRow(page, name)).toContainText('ada@example.com')
    await expect(contactRow(page, changed)).toHaveCount(0)
  })

  test('AC14: deleting a contact asks first, then removes it', async ({ page }) => {
    const name = uniqueName('Ada Lovelace')
    const keeper = uniqueName('Grace Hopper')

    await openContacts(page)
    await addContact(page, { name })
    await addContact(page, { name: keeper })

    await contactRow(page, name).getByRole('button', { name: `Delete ${name}`, exact: true }).click()
    await expect(page.getByText(`Delete "${name}"? This can't be undone.`, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(contactRow(page, name)).toBeVisible()

    await contactRow(page, name).getByRole('button', { name: `Delete ${name}`, exact: true }).click()
    await page.getByRole('button', { name: 'Delete contact', exact: true }).click()
    // The notice appears only once the server has deleted the contact.
    await expect(page.getByText(`Deleted "${name}".`, { exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expect(contactRow(page, name)).toHaveCount(0)

    await page.reload()
    // The kept contact proves the page's contacts have loaded before the deleted one is counted.
    await expect(contactRow(page, keeper)).toBeVisible()
    await expect(contactRow(page, name)).toHaveCount(0)
  })
})
