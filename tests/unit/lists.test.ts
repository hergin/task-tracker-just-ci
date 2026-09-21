import { describe, expect, it } from 'vitest'
import { compareLists, otherLists } from '../../src/lib/lists'

describe('compareLists', () => {
  it('orders lists oldest first', () => {
    const newer = { id: 'a', createdAt: new Date('2026-01-02T00:00:00Z') }
    const older = { id: 'b', createdAt: new Date('2026-01-01T00:00:00Z') }
    expect([newer, older].sort(compareLists).map((list) => list.id)).toEqual(['b', 'a'])
  })

  it('breaks ties by id', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z')
    const lists = [
      { id: 'y', createdAt },
      { id: 'x', createdAt },
    ]
    expect(lists.sort(compareLists).map((list) => list.id)).toEqual(['x', 'y'])
  })
})

describe('otherLists', () => {
  it('leaves out the list a task is already in', () => {
    const lists = [{ id: 'groceries' }, { id: 'work' }, { id: 'empty' }]
    expect(otherLists(lists, 'work').map((list) => list.id)).toEqual(['groceries', 'empty'])
  })

  it('offers nothing when the user has only the list they are looking at', () => {
    expect(otherLists([{ id: 'groceries' }], 'groceries')).toEqual([])
  })
})
