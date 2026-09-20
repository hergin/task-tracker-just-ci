import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { FIXED_TIME, createRulesEnv, dbAs, newContact, seed, storedContact, storedProfile } from './setup'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await createRulesEnv()
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await seed(env, {
    'contacts/alice-contact': storedContact('alice'),
    'contacts/bob-contact': storedContact('bob'),
  })
})

describe('contacts: reading', () => {
  it('the owner can read their contact, and no one else can', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, 'alice'), 'contacts/alice-contact')))
    await assertFails(getDoc(doc(dbAs(env, 'bob'), 'contacts/alice-contact')))
    await assertFails(getDoc(doc(dbAs(env, null), 'contacts/alice-contact')))
  })

  it('only a query filtered to your own ownerId is allowed', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(getDocs(query(collection(alice, 'contacts'), where('ownerId', '==', 'alice'))))
    await assertFails(getDocs(collection(alice, 'contacts')))
    await assertFails(getDocs(query(collection(alice, 'contacts'), where('ownerId', '==', 'bob'))))
    await assertFails(getDocs(query(collection(dbAs(env, null), 'contacts'), where('ownerId', '==', 'alice'))))
  })
})

describe('contacts: creating', () => {
  it('a user can create a contact they own, but not one owned by someone else', async () => {
    await assertSucceeds(setDoc(doc(dbAs(env, 'alice'), 'contacts/new'), newContact('alice')))
    await assertFails(setDoc(doc(dbAs(env, 'alice'), 'contacts/other'), newContact('bob')))
    await assertFails(setDoc(doc(dbAs(env, null), 'contacts/anon'), newContact('alice')))
  })

  it('the name must be 1 to 200 characters', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(setDoc(doc(alice, 'contacts/new'), newContact('alice', { name: '' })))
    await assertFails(setDoc(doc(alice, 'contacts/new'), newContact('alice', { name: 'x'.repeat(201) })))
    await assertSucceeds(setDoc(doc(alice, 'contacts/new'), newContact('alice', { name: 'x'.repeat(200) })))
  })

  it('the email must be null or a string of at most 320 characters', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(setDoc(doc(alice, 'contacts/new'), newContact('alice', { email: 'x'.repeat(321) })))
    await assertFails(setDoc(doc(alice, 'contacts/new'), newContact('alice', { email: 42 })))
    await assertSucceeds(setDoc(doc(alice, 'contacts/new'), newContact('alice', { email: 'x'.repeat(320) })))
    await assertSucceeds(setDoc(doc(alice, 'contacts/new'), newContact('alice', { email: null })))
  })

  it('the note must be null or a string of at most 5000 characters', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(setDoc(doc(alice, 'contacts/new'), newContact('alice', { note: 'x'.repeat(5001) })))
    await assertSucceeds(setDoc(doc(alice, 'contacts/new'), newContact('alice', { note: 'x'.repeat(5000) })))
    await assertSucceeds(setDoc(doc(alice, 'contacts/new'), newContact('alice', { note: null })))
  })

  it('createdAt must be the server time', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(setDoc(doc(alice, 'contacts/new'), newContact('alice')))
    await assertFails(setDoc(doc(alice, 'contacts/dated'), newContact('alice', { createdAt: FIXED_TIME })))
  })

  it('a contact cannot miss a field or hold an extra one', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(setDoc(doc(alice, 'contacts/new'), newContact('alice')))
    const { note: _note, ...withoutNote } = newContact('alice')
    await assertFails(setDoc(doc(alice, 'contacts/missing'), withoutNote))
    await assertFails(setDoc(doc(alice, 'contacts/extra'), newContact('alice', { phone: '555' })))
  })
})

describe('contacts: changing', () => {
  it('the owner can change the name, email and note, and no one else can', async () => {
    await assertSucceeds(
      updateDoc(doc(dbAs(env, 'alice'), 'contacts/alice-contact'), {
        name: 'Ada L.',
        email: 'ada@example.com',
        note: 'Met at the 2026 conference',
      }),
    )
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), 'contacts/alice-contact'), { name: 'Mine now' }))
    await assertFails(updateDoc(doc(dbAs(env, null), 'contacts/alice-contact'), { name: 'Mine now' }))
  })

  it('the owner cannot change ownerId or createdAt', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(updateDoc(doc(alice, 'contacts/alice-contact'), { name: 'Ada L.' }))
    await assertFails(updateDoc(doc(alice, 'contacts/alice-contact'), { ownerId: 'bob' }))
    await assertFails(updateDoc(doc(alice, 'contacts/alice-contact'), { createdAt: FIXED_TIME }))
  })

  it('a changed contact still has to be valid', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(updateDoc(doc(alice, 'contacts/alice-contact'), { name: 'Ada L.' }))
    await assertFails(updateDoc(doc(alice, 'contacts/alice-contact'), { name: '' }))
    await assertFails(updateDoc(doc(alice, 'contacts/alice-contact'), { email: 'x'.repeat(321) }))
    await assertFails(updateDoc(doc(alice, 'contacts/alice-contact'), { phone: '555' }))
  })

  it('only the owner can delete their contact', async () => {
    await assertFails(deleteDoc(doc(dbAs(env, 'bob'), 'contacts/alice-contact')))
    await assertFails(deleteDoc(doc(dbAs(env, null), 'contacts/alice-contact')))
    await assertSucceeds(deleteDoc(doc(dbAs(env, 'alice'), 'contacts/alice-contact')))
  })
})

describe('contacts and profiles', () => {
  it("a contact's email is never copied into the owner's profile", async () => {
    await seed(env, { 'users/alice': storedProfile('Alice') })
    const alice = dbAs(env, 'alice')
    const profile = { name: 'Alice', image: null, createdAt: FIXED_TIME }

    await assertSucceeds(setDoc(doc(alice, 'contacts/new'), newContact('alice', { email: 'ada@example.com' })))
    expect((await getDoc(doc(alice, 'users/alice'))).data()).toEqual(profile)

    await assertSucceeds(updateDoc(doc(alice, 'contacts/new'), { email: 'ada@lovelace.example' }))
    expect((await getDoc(doc(alice, 'users/alice'))).data()).toEqual(profile)

    await assertSucceeds(deleteDoc(doc(alice, 'contacts/new')))
    expect((await getDoc(doc(alice, 'users/alice'))).data()).toEqual(profile)
  })
})
