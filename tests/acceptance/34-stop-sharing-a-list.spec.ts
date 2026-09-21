import { expect, test, type Page } from '@playwright/test'
import { SERVER_CONFIRMED, addTask, listRow, openNewList, taskRow, uniqueName } from './support/data'

/** On a list page: shares it read-only and returns the full address of its shared page. */
async function shareList(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Share read-only', exact: true }).click()
  const shareLink = page.getByRole('textbox', { name: 'Share link', exact: true })
  await expect(shareLink, 'the list was shared').toBeVisible(SERVER_CONFIRMED)
  return shareLink.inputValue()
}

/**
 * On the page of a shared list: stops sharing it and waits until the server has confirmed.
 * The `Share read-only` button comes back only then, so its arrival is the proof.
 */
async function stopSharing(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Stop sharing', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Share read-only', exact: true }), 'sharing was stopped').toBeVisible(SERVER_CONFIRMED)
}

test.describe('stop sharing a list', () => {
  test('AC1: a shared list offers Stop sharing, a list that is not shared does not', async ({ page }) => {
    await openNewList(page, 'Ski trip')

    // Asserted first, so the absence below proves the page loaded rather than passing vacuously.
    await expect(page.getByRole('button', { name: 'Share read-only', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stop sharing', exact: true })).toHaveCount(0)

    await shareList(page)

    await expect(page.getByRole('button', { name: 'Stop sharing', exact: true })).toBeVisible()
  })

  test('AC2: stopping sharing replaces the share link with the Share read-only button', async ({ page }) => {
    await openNewList(page, 'Book club')
    await shareList(page)

    await page.getByRole('button', { name: 'Stop sharing', exact: true }).click()

    // The button comes back only once the server has confirmed, so this assertion waits that long.
    await expect(page.getByRole('button', { name: 'Share read-only', exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expect(page.getByRole('textbox', { name: 'Share link', exact: true })).toHaveCount(0)
  })

  test('AC3: a signed-out visitor who opens the old link sees that the list is not shared', async ({ page, browser }) => {
    const taskTitle = uniqueName('Buy lanterns')
    await openNewList(page, 'Recipes')
    await addTask(page, taskTitle)
    const shareUrl = await shareList(page)
    await stopSharing(page)

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(shareUrl)

    await expect(visitorPage.getByRole('heading', { name: "This list isn't shared", exact: true })).toBeVisible()
    await expect(visitorPage.getByText(`To do ${taskTitle}`, { exact: true })).toHaveCount(0)
    await visitor.close()
  })

  test('AC4: a visitor with the shared page open sees it stop being shared, without reloading', async ({ page, browser }) => {
    const taskTitle = uniqueName('Hang bunting')
    await openNewList(page, 'Party')
    await addTask(page, taskTitle)
    const shareUrl = await shareList(page)

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(shareUrl)
    await expect(visitorPage.getByText(`To do ${taskTitle}`, { exact: true })).toBeVisible()

    await stopSharing(page)

    // The visitor's page follows the list in real time; it waits for the server to push the change, never a reload.
    await expect(visitorPage.getByRole('heading', { name: "This list isn't shared", exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expect(visitorPage.getByText(`To do ${taskTitle}`, { exact: true })).toHaveCount(0)
    await visitor.close()
  })

  test('AC5: sharing again shows the same share link as before stopping', async ({ page }) => {
    await openNewList(page, 'Concerts')
    const before = await shareList(page)
    await stopSharing(page)

    const after = await shareList(page)

    expect(after).toBe(before)
  })

  test('AC6: after sharing again, a signed-out visitor sees the list and its tasks again', async ({ page, browser }) => {
    const taskTitle = uniqueName('Water plants')
    const listName = await openNewList(page, 'Greenhouse')
    await addTask(page, taskTitle)
    const shareUrl = await shareList(page)
    await stopSharing(page)
    await shareList(page)

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(shareUrl)

    await expect(visitorPage.getByRole('heading', { name: listName, level: 1 })).toBeVisible()
    await expect(visitorPage.getByText(`To do ${taskTitle}`, { exact: true })).toBeVisible()
    await visitor.close()
  })

  test('AC7: stopping sharing leaves the list name, its tasks and the lists page unchanged', async ({ page }) => {
    const taskTitle = uniqueName('Sort tools')
    const listName = await openNewList(page, 'Garage')
    await addTask(page, taskTitle)
    await page.getByRole('button', { name: `Edit ${taskTitle}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${taskTitle}`, exact: true })
    await form.getByLabel('Notes', { exact: true }).fill('Bring the ladder.')
    await form.getByLabel('Due date', { exact: true }).fill('2099-12-31')
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    // The form closes only once the server has saved the task.
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    await shareList(page)

    await stopSharing(page)

    await expect(page.getByRole('heading', { name: listName, level: 1 })).toBeVisible()
    const row = taskRow(page, taskTitle)
    await expect(row.getByRole('button', { name: `To do: change status of ${taskTitle}`, exact: true })).toBeVisible()
    await expect(row.getByText('Bring the ladder.', { exact: true })).toBeVisible()
    await expect(row.getByText('Due 2099-12-31', { exact: true })).toBeVisible()

    await page.goto('/')
    await expect(listRow(page, listName)).toBeVisible()
  })

  test('AC10: after sharing again, the shared page is still read-only, with no subtasks and no tags', async ({ page, browser }) => {
    const taskTitle = uniqueName('Pack tent')
    const subtaskTitle = uniqueName('Find the pegs')
    const tag = uniqueName('outdoors')
    await openNewList(page, 'Camping')
    await addTask(page, taskTitle)
    const subtaskInput = page.getByLabel(`New subtask for ${taskTitle}`, { exact: true })
    await subtaskInput.fill(subtaskTitle)
    await page.getByRole('button', { name: `Add subtask to ${taskTitle}`, exact: true }).click()
    // The input clears only once the server confirms the write.
    await expect(subtaskInput, 'the new subtask was saved').toHaveValue('', SERVER_CONFIRMED)
    await page.getByRole('button', { name: `Edit ${taskTitle}`, exact: true }).click()
    const form = page.getByRole('form', { name: `Edit ${taskTitle}`, exact: true })
    await form.getByLabel('New tag', { exact: true }).fill(tag)
    await form.getByRole('button', { name: 'Add tag', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form).toHaveCount(0, SERVER_CONFIRMED)
    const shareUrl = await shareList(page)
    await stopSharing(page)
    await shareList(page)

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(shareUrl)

    // Asserted first, so the absences below prove the page loaded rather than passing vacuously.
    await expect(visitorPage.getByText(`To do ${taskTitle}`, { exact: true })).toBeVisible()
    await expect(visitorPage.getByText(subtaskTitle, { exact: true })).toHaveCount(0)
    await expect(visitorPage.getByText(tag, { exact: true })).toHaveCount(0)
    await expect(visitorPage.getByRole('button')).toHaveCount(0)
    await expect(visitorPage.getByRole('link')).toHaveCount(0)
    await expect(visitorPage.getByRole('textbox')).toHaveCount(0)
    await expect(visitorPage.getByRole('checkbox')).toHaveCount(0)
    await visitor.close()
  })
})
