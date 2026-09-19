import { expect, test, type Page } from '@playwright/test'
import { addTask, openNewList, setDueDate } from './support/data'

/** The "Order by" radiogroup on a list page. */
function orderBy(page: Page) {
  return page.getByRole('radiogroup', { name: 'Order by', exact: true })
}

/** Chooses "Saved order" or "Due date" ordering on the current list page. */
async function selectOrderBy(page: Page, name: 'Saved order' | 'Due date'): Promise<void> {
  await orderBy(page).getByRole('radio', { name, exact: true }).click()
}

test.describe('order tasks by due date', () => {
  test('AC1: the Work list offers Saved order and Due date, starting with Saved order chosen', async ({ page }) => {
    await page.goto('/lists/list-work')

    await expect(orderBy(page).getByRole('radio', { name: 'Saved order', exact: true })).toBeChecked()
    await expect(orderBy(page).getByRole('radio', { name: 'Due date', exact: true })).not.toBeChecked()
  })

  test('AC2: dated tasks come first, earliest due date first, then undated tasks in the order they were added', async ({ page }) => {
    await openNewList(page, 'Due date order')
    await addTask(page, 'Gamma')
    await addTask(page, 'Beta')
    await addTask(page, 'Alpha')
    await addTask(page, 'Delta')
    await setDueDate(page, 'Beta', '2026-06-20')
    await setDueDate(page, 'Alpha', '2026-06-10')

    await selectOrderBy(page, 'Due date')

    await expect(page.getByRole('list', { name: 'Tasks', exact: true }).getByRole('listitem')).toHaveText([
      /Alpha/,
      /Beta/,
      /Gamma/,
      /Delta/,
    ])
  })

  test('AC3: due date ordering and its selection are still applied after a reload', async ({ page }) => {
    await openNewList(page, 'Due date order reload')
    await addTask(page, 'Later')
    await addTask(page, 'Sooner')
    await setDueDate(page, 'Later', '2026-06-20')
    await setDueDate(page, 'Sooner', '2026-06-10')

    await selectOrderBy(page, 'Due date')
    await expect(page.getByRole('list', { name: 'Tasks', exact: true }).getByRole('listitem')).toHaveText([/Sooner/, /Later/])

    await page.reload()

    await expect(page.getByRole('list', { name: 'Tasks', exact: true }).getByRole('listitem')).toHaveText([/Sooner/, /Later/])
    await expect(orderBy(page).getByRole('radio', { name: 'Due date', exact: true })).toBeChecked()
  })

  test('AC4: no control to move a task up or down appears on any open task while ordering by due date', async ({ page }) => {
    await openNewList(page, 'Due date order hides move controls')
    await addTask(page, 'First')
    await addTask(page, 'Second')

    await selectOrderBy(page, 'Due date')

    const tasks = page.getByRole('list', { name: 'Tasks', exact: true })
    await expect(tasks.getByRole('listitem')).toHaveText([/First/, /Second/])
    await expect(tasks.getByRole('button', { name: /^Reorder / })).toHaveCount(0)
  })

  test('AC5: choosing Saved order again brings back the saved order', async ({ page }) => {
    await openNewList(page, 'Due date order back to saved')
    await addTask(page, 'Uno')
    await addTask(page, 'Dos')
    await addTask(page, 'Tres')
    await setDueDate(page, 'Tres', '2026-06-15')

    await selectOrderBy(page, 'Due date')
    await expect(page.getByRole('list', { name: 'Tasks', exact: true }).getByRole('listitem')).toHaveText([/Tres/, /Uno/, /Dos/])

    await selectOrderBy(page, 'Saved order')

    await expect(page.getByRole('list', { name: 'Tasks', exact: true }).getByRole('listitem')).toHaveText([/Uno/, /Dos/, /Tres/])
  })
})
