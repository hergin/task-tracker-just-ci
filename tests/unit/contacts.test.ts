import { describe, expect, it } from 'vitest'
import { compareContacts } from '../../src/lib/contacts'

describe('compareContacts', () => {
  it('orders contacts by name, ignoring upper and lower case', () => {
    const contacts = [
      { id: 'b', name: 'Bob' },
      { id: 'c', name: 'carol' },
      { id: 'a', name: 'alice' },
    ]
    expect(contacts.sort(compareContacts).map((contact) => contact.name)).toEqual(['alice', 'Bob', 'carol'])
  })

  it('breaks ties by id, so two contacts with the same name keep a stable order', () => {
    const contacts = [
      { id: 'y', name: 'Ada' },
      { id: 'x', name: 'ada' },
    ]
    expect(contacts.sort(compareContacts).map((contact) => contact.id)).toEqual(['x', 'y'])
  })
})
