import { expect, test, type Page } from '@playwright/test'
import { SERVER_CONFIRMED, addTask, openNewList } from './support/data'

/** On a list page: shares it read-only and returns the full address of its shared page. */
async function shareList(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Share read-only', exact: true }).click()
  const shareLink = page.getByRole('textbox', { name: 'Share link', exact: true })
  // The link replaces the button only once the server has confirmed the list is shared.
  await expect(shareLink).toBeVisible(SERVER_CONFIRMED)
  return shareLink.inputValue()
}

/** On a list page: stops sharing it and waits until the share-link block is gone. */
async function stopSharing(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Stop sharing', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Share read-only', exact: true })).toBeVisible(SERVER_CONFIRMED)
}

test.describe('stop sharing a list', () => {
  test('AC1: a shared list\'s page offers "Stop sharing" beside its share link', async ({ page }) => {
    await openNewList(page, 'Book club')
    await shareList(page)

    await expect(page.getByRole('textbox', { name: 'Share link', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stop sharing', exact: true })).toBeVisible()
  })

  test('AC2: stopping puts the "Share read-only" button back in place of the link, without a reload', async ({ page }) => {
    await openNewList(page, 'Recipes')
    await shareList(page)

    await page.getByRole('button', { name: 'Stop sharing', exact: true }).click()

    await expect(page.getByRole('button', { name: 'Share read-only', exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expect(page.getByRole('textbox', { name: 'Share link', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Stop sharing', exact: true })).toHaveCount(0)
  })

  test("AC3: the old link shows \"This list isn't shared\" to a signed-out visitor", async ({ page, browser }) => {
    await openNewList(page, 'Moving house')
    await addTask(page, 'Book a van')
    const shareUrl = await shareList(page)
    await stopSharing(page)

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(shareUrl)

    // The shared page follows the list live, so this waits out a stop still on its way to the server.
    await expect(visitorPage.getByRole('heading', { name: "This list isn't shared", exact: true })).toBeVisible(SERVER_CONFIRMED)
    await expect(visitorPage.getByText('Book a van', { exact: true })).toHaveCount(0)
    await visitor.close()
  })

  test('AC4: sharing again after stopping gives the same link, working once more', async ({ page, browser }) => {
    await openNewList(page, 'Weekend trip')
    await addTask(page, 'Charge the camera')
    const firstUrl = await shareList(page)
    await stopSharing(page)

    const secondUrl = await shareList(page)
    expect(secondUrl).toBe(firstUrl)

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(secondUrl)

    await expect(visitorPage.getByText('To do Charge the camera', { exact: true })).toBeVisible()
    await visitor.close()
  })
})
