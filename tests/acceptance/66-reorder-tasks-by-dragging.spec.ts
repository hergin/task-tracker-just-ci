import { expect, test, type Page } from '@playwright/test'
import { addTask, expectTasksSaved, openNewList, taskRow } from './support/data'

/** The open Tasks list on the current list page. */
function tasksList(page: Page) {
  return page.getByRole('list', { name: 'Tasks', exact: true })
}

/** The reorder handle of the task titled `title`. */
function reorderHandle(page: Page, title: string) {
  return taskRow(page, title).getByRole('button', { name: `Reorder ${title}`, exact: true })
}

/** Creates a fresh list and adds "First", "Second" and "Third" in that order. */
async function openListWithThreeTasks(page: Page): Promise<void> {
  await openNewList(page, 'Reorder')
  await addTask(page, 'First')
  await addTask(page, 'Second')
  await addTask(page, 'Third')
}

test.describe('reorder tasks by dragging or the keyboard', () => {
  test('AC1: ArrowDown on the handle of First moves it after Second', async ({ page }) => {
    await openListWithThreeTasks(page)

    await reorderHandle(page, 'First').press('ArrowDown')

    await expect(tasksList(page).getByRole('listitem')).toHaveText([/Second/, /First/, /Third/])
  })

  test('AC2: ArrowUp on the handle of Third moves it before Second', async ({ page }) => {
    await openListWithThreeTasks(page)

    await reorderHandle(page, 'Third').press('ArrowUp')

    await expect(tasksList(page).getByRole('listitem')).toHaveText([/First/, /Third/, /Second/])
  })

  test('AC3: the handle keeps the focus after a move, so ArrowDown twice moves the same task twice', async ({ page }) => {
    await openListWithThreeTasks(page)
    const handle = reorderHandle(page, 'First')

    await handle.press('ArrowDown')
    await expect(tasksList(page).getByRole('listitem')).toHaveText([/Second/, /First/, /Third/])

    await handle.press('ArrowDown')
    await expect(tasksList(page).getByRole('listitem')).toHaveText([/Second/, /Third/, /First/])
  })

  test('AC4: dragging the handle of Third onto First moves it there', async ({ page }) => {
    await openListWithThreeTasks(page)

    await reorderHandle(page, 'Third').dragTo(taskRow(page, 'First'))

    await expect(tasksList(page).getByRole('listitem')).toHaveText([/Third/, /First/, /Second/])
  })

  test('AC5: a move survives a reload once the server has confirmed it', async ({ page }) => {
    await openListWithThreeTasks(page)

    await reorderHandle(page, 'First').press('ArrowDown')
    await expect(tasksList(page).getByRole('listitem')).toHaveText([/Second/, /First/, /Third/])
    await expectTasksSaved(page)

    await page.reload()

    await expect(tasksList(page).getByRole('listitem')).toHaveText([/Second/, /First/, /Third/])
  })

  test('AC6: ArrowUp on the handle of the first task shown changes nothing', async ({ page }) => {
    await openListWithThreeTasks(page)

    await reorderHandle(page, 'First').press('ArrowUp')

    await expect(tasksList(page).getByRole('listitem')).toHaveText([/First/, /Second/, /Third/])
  })
})
