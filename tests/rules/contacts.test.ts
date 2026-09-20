import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createRulesEnv, dbAs, newContact, seed, storedContact } from './setup'

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

// Every test here asserts something the rules must allow as well as something they must refuse: a collection
// with no rules at all refuses everything, so a test of refusals alone would pass without the feature.

describe('contacts: private to the user who created them (AC17)', () => {
  it('a contact is readable by its owner and by no one else', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, 'alice'), 'contacts/alice-contact')))
    await assertFails(getDoc(doc(dbAs(env, 'bob'), 'contacts/alice-contact')))
  })

  it('only the owner can change or delete a contact', async () => {
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), 'contacts/alice-contact'), { name: 'Mine now' }))
    await assertFails(deleteDoc(doc(dbAs(env, 'bob'), 'contacts/alice-contact')))
    await assertSucceeds(updateDoc(doc(dbAs(env, 'alice'), 'contacts/alice-contact'), { name: 'Ada King' }))
    await assertSucceeds(deleteDoc(doc(dbAs(env, 'alice'), 'contacts/alice-contact')))
  })

  it('a user can create a contact they own, but not one owned by someone else', async () => {
    await assertSucceeds(setDoc(doc(dbAs(env, 'alice'), 'contacts/mine'), newContact('alice')))
    await assertFails(setDoc(doc(dbAs(env, 'alice'), 'contacts/theirs'), newContact('bob')))
  })

  it("a query must filter on the signed-in user's ownerId, so it can only return their own contacts", async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(getDocs(query(collection(alice, 'contacts'), where('ownerId', '==', 'alice'))))
    await assertFails(getDocs(collection(alice, 'contacts')))
    await assertFails(getDocs(query(collection(alice, 'contacts'), where('ownerId', '==', 'bob'))))
  })
})

describe('contacts: the shape of a contact (AC18)', () => {
  it('the name must be 1 to 200 characters', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(setDoc(doc(alice, 'contacts/new'), newContact('alice', { name: '' })))
    await assertFails(setDoc(doc(alice, 'contacts/new'), newContact('alice', { name: 'x'.repeat(201) })))
    await assertSucceeds(setDoc(doc(alice, 'contacts/new'), newContact('alice', { name: 'x'.repeat(200) })))
  })

  it('the email must be 1 to 320 characters', async () => {
    const alice = dbAs(env, 'alice')
    const longEmail = (length: number) => `${'e'.repeat(length - '@example.com'.length)}@example.com`
    await assertFails(setDoc(doc(alice, 'contacts/new'), newContact('alice', { email: '' })))
    await assertFails(setDoc(doc(alice, 'contacts/new'), newContact('alice', { email: longEmail(321) })))
    await assertSucceeds(setDoc(doc(alice, 'contacts/new'), newContact('alice', { email: longEmail(320) })))
  })

  it('a contact holds exactly its own fields, none missing and none extra', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(setDoc(doc(alice, 'contacts/new'), { ownerId: 'alice', email: 'ada@example.com', createdAt: serverTimestamp() }))
    await assertFails(setDoc(doc(alice, 'contacts/new'), { ownerId: 'alice', name: 'Ada Lovelace', createdAt: serverTimestamp() }))
    await assertFails(setDoc(doc(alice, 'contacts/new'), newContact('alice', { phone: '555-0100' })))
    await assertSucceeds(setDoc(doc(alice, 'contacts/new'), newContact('alice')))
  })

  it('a signed-out visitor can neither read nor write a contact', async () => {
    const out = dbAs(env, null)
    await assertFails(getDoc(doc(out, 'contacts/alice-contact')))
    await assertFails(setDoc(doc(out, 'contacts/new'), newContact('alice')))
    await assertFails(updateDoc(doc(out, 'contacts/alice-contact'), { name: 'Ada King' }))
    await assertFails(deleteDoc(doc(out, 'contacts/alice-contact')))
    await assertSucceeds(getDoc(doc(dbAs(env, 'alice'), 'contacts/alice-contact')))
  })
})
