import { describe, expect, it } from 'vitest'
import { compareUsers } from '../../src/lib/users'

describe('compareUsers', () => {
  it('orders users by name', () => {
    const users = [
      { id: '1', name: 'Zoe' },
      { id: '2', name: 'Ada' },
    ]
    expect(users.sort(compareUsers).map((user) => user.name)).toEqual(['Ada', 'Zoe'])
  })

  it('breaks ties by id', () => {
    const users = [
      { id: 'b', name: 'Sam' },
      { id: 'a', name: 'Sam' },
    ]
    expect(users.sort(compareUsers).map((user) => user.id)).toEqual(['a', 'b'])
  })
})
