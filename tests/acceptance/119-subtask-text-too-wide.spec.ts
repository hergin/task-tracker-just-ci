import { expect, test, type Page } from '@playwright/test'
import { addTask, openNewList, uniqueName } from './support/data'

// #119: on a mobile viewport, the "Add subtask" button sits under the subtask textbox instead of beside it,
// and neither one is pushed off-screen.
test.use({ viewport: { width: 375, height: 667 } })

/** Creates a fresh list with one task, ready for subtasks. */
async function openTaskWithNoSubtasks(page: Page): Promise<string> {
  const taskTitle = uniqueName('Prep dinner')
  await openNewList(page, 'Household mobile')
  await addTask(page, taskTitle)
  return taskTitle
}

test.describe('subtask form layout on a mobile viewport', () => {
  test('AC1: the Add subtask button sits below the subtask textbox', async ({ page }) => {
    const taskTitle = await openTaskWithNoSubtasks(page)
    const input = page.getByLabel(`New subtask for ${taskTitle}`, { exact: true })
    const button = page.getByRole('button', { name: `Add subtask to ${taskTitle}`, exact: true })
    await expect(input).toBeVisible()
    await expect(button).toBeVisible()

    const inputBox = await input.boundingBox()
    const buttonBox = await button.boundingBox()
    if (!inputBox || !buttonBox) throw new Error('expected both the textbox and the button to have a layout box')

    expect(buttonBox.y, "the button's top edge should be below the textbox's bottom edge").toBeGreaterThanOrEqual(
      inputBox.y + inputBox.height,
    )
  })

  test('AC2: the subtask textbox and Add subtask button are fully visible without horizontal scrolling', async ({ page }) => {
    const taskTitle = await openTaskWithNoSubtasks(page)
    const input = page.getByLabel(`New subtask for ${taskTitle}`, { exact: true })
    const button = page.getByRole('button', { name: `Add subtask to ${taskTitle}`, exact: true })
    await expect(input).toBeVisible()
    await expect(button).toBeVisible()

    const inputBox = await input.boundingBox()
    const buttonBox = await button.boundingBox()
    if (!inputBox || !buttonBox) throw new Error('expected both the textbox and the button to have a layout box')
    const viewportWidth = page.viewportSize()?.width ?? 375

    expect(inputBox.x, "the textbox's left edge should be within the page").toBeGreaterThanOrEqual(0)
    expect(inputBox.x + inputBox.width, "the textbox's right edge should be within the page").toBeLessThanOrEqual(viewportWidth)
    expect(buttonBox.x, "the button's left edge should be within the page").toBeGreaterThanOrEqual(0)
    expect(buttonBox.x + buttonBox.width, "the button's right edge should be within the page").toBeLessThanOrEqual(viewportWidth)
  })
})
