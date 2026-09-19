import { expect, test } from '@playwright/test'
import { SERVER_CONFIRMED, addTask, openNewList, taskRow } from './support/data'

test.describe('tag a task on a list', () => {
  test('AC1: adding a tag while editing shows it on the task\'s row', async ({ page }) => {
    await openNewList(page, 'Trip')
    await addTask(page, 'Pack bags')

    await page.getByRole('button', { name: 'Edit Pack bags', exact: true }).click()
    const form = page.getByRole('form', { name: 'Edit Pack bags', exact: true })
    await form.getByLabel('New tag', { exact: true }).fill('urgent')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()

    // The form closes only once the server has saved the task.
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await expect(taskRow(page, 'Pack bags').getByRole('list', { name: 'Tags for Pack bags', exact: true })).toContainText('urgent')
  })

  test('AC2: adding two tags in one edit shows both on the row, in order', async ({ page }) => {
    await openNewList(page, 'Trip')
    await addTask(page, 'Book hotel')

    await page.getByRole('button', { name: 'Edit Book hotel', exact: true }).click()
    const form = page.getByRole('form', { name: 'Edit Book hotel', exact: true })
    await form.getByLabel('New tag', { exact: true }).fill('travel')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByLabel('New tag', { exact: true }).fill('urgent')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    const tags = taskRow(page, 'Book hotel').getByRole('list', { name: 'Tags for Book hotel', exact: true }).getByRole('listitem')
    await expect(tags).toHaveText(['travel', 'urgent'])
  })

  test('AC3: removing one of two tags leaves the other on the row', async ({ page }) => {
    await openNewList(page, 'Trip')
    await addTask(page, 'Buy tickets')

    await page.getByRole('button', { name: 'Edit Buy tickets', exact: true }).click()
    const form = page.getByRole('form', { name: 'Edit Buy tickets', exact: true })
    await form.getByLabel('New tag', { exact: true }).fill('flight')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByLabel('New tag', { exact: true }).fill('deadline')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)

    await page.getByRole('button', { name: 'Edit Buy tickets', exact: true }).click()
    await form.getByRole('button', { name: 'Remove tag flight', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)

    const tags = taskRow(page, 'Buy tickets').getByRole('list', { name: 'Tags for Buy tickets', exact: true }).getByRole('listitem')
    await expect(tags).toHaveText(['deadline'])
  })

  test('AC4: tags are still shown on the row after a reload', async ({ page }) => {
    await openNewList(page, 'Trip')
    await addTask(page, 'Confirm reservation')

    await page.getByRole('button', { name: 'Edit Confirm reservation', exact: true }).click()
    const form = page.getByRole('form', { name: 'Edit Confirm reservation', exact: true })
    await form.getByLabel('New tag', { exact: true }).fill('hotel')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()

    // The form closes, and "Saving…" clears, only once the server has confirmed the write.
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0, SERVER_CONFIRMED)

    await page.reload()
    await expect(taskRow(page, 'Confirm reservation').getByRole('list', { name: 'Tags for Confirm reservation', exact: true })).toContainText(
      'hotel',
    )
  })

  test('AC5: a task with no tags shows none on its row', async ({ page }) => {
    await openNewList(page, 'Trip')
    await addTask(page, 'Get visa')
    await addTask(page, 'Buy sunscreen')

    await page.getByRole('button', { name: 'Edit Get visa', exact: true }).click()
    const form = page.getByRole('form', { name: 'Edit Get visa', exact: true })
    await form.getByLabel('New tag', { exact: true }).fill('paperwork')
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)

    // Proves tags are shown at all before checking the untagged task has none.
    await expect(taskRow(page, 'Get visa').getByRole('list', { name: 'Tags for Get visa', exact: true })).toContainText('paperwork')
    await expect(taskRow(page, 'Buy sunscreen').getByRole('list', { name: 'Tags for Buy sunscreen', exact: true })).toHaveCount(0)
  })
})
