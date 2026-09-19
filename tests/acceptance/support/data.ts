import { randomUUID } from 'node:crypto'
import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Options for an assertion that waits for the server to confirm a write: a form clearing or closing, "Saving…" going away,
 * a "Deleted …" notice. Against a deployment that confirmation can take longer than the 20 s other assertions get there
 * (DEFAULT_WAIT_MS in env.ts), especially on a pull request's brand-new database, so these wait up to 30 s. Every other
 * assertion keeps the default.
 */
export const SERVER_CONFIRMED = { timeout: 30_000 }

/**
 * A name no other test or run will use. Tests share one database and run in parallel and repeatedly,
 * so anything a test creates gets a unique name, and the seed fixture is never changed.
 */
export function uniqueName(base: string): string {
  return `${base} ${randomUUID().slice(0, 8)}`
}

/** The row of the list named `name` on the lists page. */
export function listRow(page: Page, name: string): Locator {
  return page
    .getByRole('list', { name: 'Lists', exact: true })
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name, exact: true }) })
}

/** The row of the task titled `title` on a list page, open or done (the Done group must be expanded to see it). */
export function taskRow(page: Page, title: string): Locator {
  return page.getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) })
}

/** On a list page: adds a task and waits until the server has saved it. */
export async function addTask(page: Page, title: string): Promise<void> {
  const titleInput = page.getByLabel('New task', { exact: true })
  await titleInput.fill(title)
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  // The form clears only once the server confirms the write.
  await expect(titleInput, 'the new task was saved').toHaveValue('', SERVER_CONFIRMED)
}

/**
 * On a list page: waits until the server has confirmed every change to the tasks. Call it after asserting
 * the change is visible, or it can pass before "Saving…" ever appeared.
 */
export async function expectTasksSaved(page: Page): Promise<void> {
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0, SERVER_CONFIRMED)
}

/** On a list page: sets a task's due date through its edit form and waits until the server has saved it. */
export async function setDueDate(page: Page, title: string, date: string): Promise<void> {
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  const form = page.getByRole('form', { name: `Edit ${title}`, exact: true })
  await form.getByLabel('Due date', { exact: true }).fill(date)
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  // The form closes only once the server has saved the task.
  await expect(form).toHaveCount(0, SERVER_CONFIRMED)
}

/** Today's date as the app sees it. Tests run in the UTC time zone (playwright.config.ts). */
export function todayInUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Creates a list and opens it. */
export async function openNewList(page: Page, base: string): Promise<string> {
  const name = uniqueName(base)
  await createList(page, name)
  await listRow(page, name).getByRole('link').click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  return name
}

/** Creates a list from the lists page and waits until the server has saved it. */
export async function createList(page: Page, name: string): Promise<void> {
  await page.goto('/')
  const nameInput = page.getByLabel('New list name', { exact: true })
  await nameInput.fill(name)
  await page.getByRole('button', { name: 'Create list', exact: true }).click()
  // The form clears only once the server confirms the write, so later steps (such as a reload) can rely on it.
  await expect(nameInput, 'the new list was saved').toHaveValue('', SERVER_CONFIRMED)
}

/**
 * On a list page: the button that advances the task titled `title` to its next status. Its name starts with the current
 * status ("To do: change status of Buy milk"), so it changes with every click; the pattern is anchored at both ends.
 */
export function statusButton(page: Page, title: string): Locator {
  return page.getByRole('button', {
    name: new RegExp(`^(To do|Doing|Done|Postponed): change status of ${escapeRegExp(title)}$`),
  })
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
