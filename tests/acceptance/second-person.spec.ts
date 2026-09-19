import { expect, test, type Browser, type Page } from '@playwright/test'
import { BASE_URL } from './support/env'
import { addTask, openNewList } from './support/data'

// The second seeded person. Every other spec starts signed in as e2e-owner, from the session auth.setup.ts saves;
// these tests are about the one other person a spec may act as, so behaviour where one person sees or does something
// to another's data can be checked through the UI.
//
// Two criteria of the spec have no test of their own here, because they hold today and so cannot fail:
// that the rest of the fixture is unchanged (lists.spec.ts already asserts the owner's lists and not the other
// user's, and no account exists for e2e-other), and that every existing spec still starts signed in as e2e-owner
// and passes (the rest of this suite, unchanged).

/** The second seeded account (see the fixture in CLAUDE.md). */
const SECOND_EMAIL = 'e2e-second@e2e.test'
const SECOND_NAME = 'E2E Second'

/**
 * The second person's password: the local one on the emulators, E2E_SECOND_PASSWORD against a deployment, where the
 * account is created by hand. Empty when a deployment run has not set it; the tests below are then skipped, not failed,
 * so a deployment run with only E2E_PASSWORD keeps passing.
 */
const SECOND_PASSWORD = process.env.BASE_URL ? (process.env.E2E_SECOND_PASSWORD ?? '') : 'local-e2e-password'
const NO_SECOND_PASSWORD = 'Set E2E_SECOND_PASSWORD to act as the second person against a deployment.'

/**
 * Opens a browser signed in as the second person, beside the default `page`, which stays signed in as e2e-owner.
 * This spec signs in through the test sign-in form itself rather than through a saved session, because it is the
 * spec that proves the seeded second account can sign in at all.
 */
async function signInAsSecondPerson(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: { cookies: [], origins: [] },
    timezoneId: 'UTC',
    locale: 'en-US',
  })
  const page = await context.newPage()
  await page.goto('/')

  const form = page.getByRole('form', { name: 'Test sign-in', exact: true })
  await form.getByLabel('Email', { exact: true }).fill(SECOND_EMAIL)
  await form.getByLabel('Password', { exact: true }).fill(SECOND_PASSWORD)
  await form.getByRole('button', { name: 'Sign in with test account', exact: true }).click()
  return page
}

test.describe('a second signed-in person', () => {
  test('AC1: the seeded second account signs in through the test sign-in form', async ({ browser }) => {
    test.skip(SECOND_PASSWORD === '', NO_SECOND_PASSWORD)
    const second = await signInAsSecondPerson(browser)

    await expect(
      second.getByRole('heading', { name: 'Your lists', exact: true }),
      'signed in as the second test account (if not: is the database seeded with e2e-second?)',
    ).toBeVisible()
    await expect(second.getByText(SECOND_NAME, { exact: true })).toBeVisible()

    await second.context().close()
  })

  test("AC2: the second person is one of a task's 'Assigned to' choices", async ({ page }) => {
    test.skip(SECOND_PASSWORD === '', NO_SECOND_PASSWORD)
    await openNewList(page, 'Assigning')
    await addTask(page, 'Pick a person')

    await page.getByRole('button', { name: 'Edit Pick a person', exact: true }).click()
    const assignee = page
      .getByRole('form', { name: 'Edit Pick a person', exact: true })
      .getByLabel('Assigned to', { exact: true })

    await expect(assignee.getByRole('option', { name: 'E2E Other', exact: true })).toHaveCount(1)
    await expect(assignee.getByRole('option', { name: SECOND_NAME, exact: true })).toHaveCount(1)
  })

  test('AC4: the owner and the second person each see their own lists, in one test', async ({ browser, page }) => {
    test.skip(SECOND_PASSWORD === '', NO_SECOND_PASSWORD)
    const second = await signInAsSecondPerson(browser)
    await page.goto('/')

    await expect(
      page.getByRole('list', { name: 'Lists', exact: true }).getByRole('link', { name: 'Groceries', exact: true }),
    ).toBeVisible()

    await expect(second.getByRole('heading', { name: 'Your lists', exact: true })).toBeVisible()
    await expect(second.getByText('No lists yet.', { exact: true })).toBeVisible()
    // Asserted after the empty screen above, which proves the second person's lists have loaded.
    await expect(second.getByRole('link', { name: 'Groceries', exact: true })).toHaveCount(0)

    await second.context().close()
  })

  test("AC5: the second person sees their own empty 'Your lists'", async ({ browser }) => {
    test.skip(SECOND_PASSWORD === '', NO_SECOND_PASSWORD)
    // Creates nothing, so it passes again when the suite is run without reseeding.
    const second = await signInAsSecondPerson(browser)

    await expect(second.getByRole('heading', { name: 'Your lists', exact: true })).toBeVisible()
    await expect(second.getByText('No lists yet.', { exact: true })).toBeVisible()

    await second.context().close()
  })
})
