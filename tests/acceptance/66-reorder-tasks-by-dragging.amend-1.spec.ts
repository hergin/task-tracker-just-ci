import { expect, test, type Page } from '@playwright/test'
import { addTask, openNewList, taskRow } from './support/data'

// Amendment to #66: on a phone-sized touch screen, "Move <title> up"/"Move <title> down" buttons
// let a touch user reorder tasks without dragging.
test.use({ viewport: { width: 375, height: 667 }, hasTouch: true })

/** The open Tasks list on the current list page. */
function tasksList(page: Page) {
  return page.getByRole('list', { name: 'Tasks', exact: true })
}

/** The "Move <title> up" button on the row of the task titled `title`. */
function moveUpButton(page: Page, title: string) {
  return taskRow(page, title).getByRole('button', { name: `Move ${title} up`, exact: true })
}

/** The "Move <title> down" button on the row of the task titled `title`. */
function moveDownButton(page: Page, title: string) {
  return taskRow(page, title).getByRole('button', { name: `Move ${title} down`, exact: true })
}

/** Creates a fresh list and adds "First", "Second" and "Third" in that order. */
async function openListWithThreeTasks(page: Page): Promise<void> {
  await openNewList(page, 'Reorder touch')
  await addTask(page, 'First')
  await addTask(page, 'Second')
  await addTask(page, 'Third')
}

test.describe('reorder tasks by tapping on a phone-sized touch screen', () => {
  test('AC7: tapping "Move First down" moves it after Second', async ({ page }) => {
    await openListWithThreeTasks(page)

    await moveDownButton(page, 'First').tap()

    await expect(tasksList(page).getByRole('listitem')).toHaveText([/Second/, /First/, /Third/])
  })

  test('AC8: tapping "Move Third up" moves it before Second', async ({ page }) => {
    await openListWithThreeTasks(page)

    await moveUpButton(page, 'Third').tap()

    await expect(tasksList(page).getByRole('listitem')).toHaveText([/First/, /Third/, /Second/])
  })
})
