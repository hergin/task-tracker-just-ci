import { expect, test, type Page } from '@playwright/test'
import { SERVER_CONFIRMED, addTask, openNewList } from './support/data'

/** On a list page: shares it read-only and returns the full address of its shared page. */
async function shareList(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Share read-only', exact: true }).click()
  const shareLink = page.getByRole('textbox', { name: 'Share link', exact: true })
  await expect(shareLink).toBeVisible(SERVER_CONFIRMED)
  return shareLink.inputValue()
}

test.describe('share a list read-only', () => {
  test('AC1: sharing a list replaces the button with a read-only share link', async ({ page }) => {
    await openNewList(page, 'Camping')
    const listUrl = new URL(page.url())

    await page.getByRole('button', { name: 'Share read-only', exact: true }).click()
    const shareLink = page.getByRole('textbox', { name: 'Share link', exact: true })
    await expect(shareLink).toHaveValue(`${listUrl.origin}/share/${listUrl.pathname.split('/').pop()}`, SERVER_CONFIRMED)
    await expect(page.getByRole('button', { name: 'Share read-only', exact: true })).toHaveCount(0)
  })

  test('AC2: a signed-out visitor sees the list name and its task titles', async ({ page, browser }) => {
    const listName = await openNewList(page, 'Road trip')
    await addTask(page, 'Pack cooler')
    const shareUrl = await shareList(page)

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(shareUrl)

    await expect(visitorPage.getByRole('heading', { name: listName, level: 1 })).toBeVisible()
    await expect(visitorPage.getByText('To do Pack cooler', { exact: true })).toBeVisible()
    await expect(visitorPage.getByRole('button', { name: 'Sign in with GitHub', exact: true })).toHaveCount(0)
    await visitor.close()
  })

  test('AC3: the shared page has no controls to change anything', async ({ page, browser }) => {
    await openNewList(page, 'Garden')
    await addTask(page, 'Buy seeds')
    const shareUrl = await shareList(page)

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(shareUrl)

    // Asserted first, so the absences below prove the page loaded rather than passing vacuously.
    await expect(visitorPage.getByText('To do Buy seeds', { exact: true })).toBeVisible()
    await expect(visitorPage.getByRole('button')).toHaveCount(0)
    await expect(visitorPage.getByRole('link')).toHaveCount(0)
    await expect(visitorPage.getByRole('textbox')).toHaveCount(0)
    await visitor.close()
  })

  test("AC4: the shared page shows nothing of the owner's other lists", async ({ page, browser }) => {
    const otherListName = await openNewList(page, 'Secret plans')
    await openNewList(page, 'Hiking')
    await addTask(page, 'Pack boots')
    const shareUrl = await shareList(page)

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(shareUrl)

    await expect(visitorPage.getByText('To do Pack boots', { exact: true })).toBeVisible()
    await expect(visitorPage.getByText(otherListName)).toHaveCount(0)
    await expect(visitorPage.getByRole('link', { name: '← Your lists', exact: true })).toHaveCount(0)
    await visitor.close()
  })

  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test("AC5: opening the link of a list that was never shared shows \"This list isn't shared\"", async ({ page }) => {
      await page.goto('/share/list-groceries')

      await expect(page.getByRole('heading', { name: "This list isn't shared", exact: true })).toBeVisible()
      await expect(page.getByText('Buy milk', { exact: true })).toHaveCount(0)
    })
  })
})
