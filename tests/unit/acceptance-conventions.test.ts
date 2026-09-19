import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { conventionViolations } from '../../scripts/lib/acceptance-conventions'

// Guards the acceptance-test rules in CLAUDE.md, so a test that breaks them fails `npm run verify`.

const ROOT = 'tests/acceptance'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '.auth' ? [] : sourceFiles(path)
    return entry.name.endsWith('.ts') ? [path] : []
  })
}

describe('acceptance tests', () => {
  const files = sourceFiles(ROOT)

  it('exist', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('follow the acceptance-test rules', () => {
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return conventionViolations(source).map((message) => `${file} ${message}`)
    })
    expect(violations).toEqual([])
  })
})

describe('a locator by a literal', () => {
  it("needs exact: true for a name, since a name also matches longer names that other tests' data can produce (#86, #102)", () => {
    expect(conventionViolations(`page.getByRole('list', { name: 'Due in Groceries' })`)).toHaveLength(1)
    expect(conventionViolations(`page.getByRole('heading', { name: 'Work', level: 1 })`)).toHaveLength(1)
    expect(conventionViolations(`page.getByRole('button', { name: 'Delete list' })`)).toHaveLength(1)
    expect(conventionViolations("page.getByRole('button', { name: `Delete ${name}` })")).toHaveLength(1)
    expect(conventionViolations(`page.getByRole('list', { name: 'Due in Groceries', exact: true })`)).toEqual([])
    expect(conventionViolations(`page.getByRole('heading', { exact: true, name: 'Work' })`)).toEqual([])
    expect(conventionViolations(`page.getByRole('heading', { name: listName })`)).toEqual([])
    expect(conventionViolations(`page.getByRole('heading', { name: /^List/ })`)).toEqual([])
  })

  it('needs exact: true for a text or label too', () => {
    expect(conventionViolations(`page.getByText('Buy milk')`)).toHaveLength(1)
    expect(conventionViolations(`page.getByLabel('New tag')`)).toHaveLength(1)
    expect(conventionViolations('page.getByText(`Deleted "${name}".`)')).toHaveLength(1)
    expect(conventionViolations(`page.getByText('Buy milk', { exact: true })`)).toEqual([])
    expect(conventionViolations(`page.getByLabel('Notes', { exact: true })`)).toEqual([])
    expect(conventionViolations(`page.getByText(title, { exact: true })`)).toEqual([])
    expect(conventionViolations(`page.getByText(title)`)).toEqual([])
  })
})
