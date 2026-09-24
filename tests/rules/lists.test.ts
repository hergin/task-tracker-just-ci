import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { FIXED_TIME, createRulesEnv, dbAs, newList, seed, storedList, storedTask } from './setup'

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
    'lists/alice-list': storedList('alice'),
    'lists/bob-list': storedList('bob'),
  })
})

describe('lists: reading', () => {
  it('the owner can read their list', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, 'alice'), 'lists/alice-list')))
  })

  it("another user cannot read someone else's list", async () => {
    await assertFails(getDoc(doc(dbAs(env, 'bob'), 'lists/alice-list')))
  })

  it('signed-out visitors cannot read lists', async () => {
    await assertFails(getDoc(doc(dbAs(env, null), 'lists/alice-list')))
  })

  it('a query filtered to your own ownerId is allowed', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(getDocs(query(collection(alice, 'lists'), where('ownerId', '==', 'alice'))))
  })

  it('a query without an ownerId filter is rejected', async () => {
    await assertFails(getDocs(collection(dbAs(env, 'alice'), 'lists')))
  })

  it("a query for someone else's ownerId is rejected", async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(getDocs(query(collection(alice, 'lists'), where('ownerId', '==', 'bob'))))
  })
})

describe('lists: reading a shared list', () => {
  beforeEach(async () => {
    await seed(env, { 'lists/alice-shared': storedList('alice', { shared: true }) })
  })

  it('a signed-out visitor can read a shared list by id', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, null), 'lists/alice-shared')))
  })

  it('another signed-in user can read a shared list by id', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, 'bob'), 'lists/alice-shared')))
  })

  it('a signed-out visitor cannot read a list that was never shared', async () => {
    await assertFails(getDoc(doc(dbAs(env, null), 'lists/alice-list')))
  })

  it('a signed-out visitor cannot list or query the lists collection, even filtering on shared', async () => {
    await assertFails(getDocs(collection(dbAs(env, null), 'lists')))
    await assertFails(getDocs(query(collection(dbAs(env, null), 'lists'), where('shared', '==', true))))
  })
})

describe('lists: creating', () => {
  it('a user can create a list they own', async () => {
    await assertSucceeds(setDoc(doc(dbAs(env, 'alice'), 'lists/new'), newList('alice')))
  })

  it('a user cannot create a list owned by someone else', async () => {
    await assertFails(setDoc(doc(dbAs(env, 'alice'), 'lists/new'), newList('bob')))
  })

  it('the name must be 1 to 200 characters', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(setDoc(doc(alice, 'lists/new'), newList('alice', { name: '' })))
    await assertFails(setDoc(doc(alice, 'lists/new'), newList('alice', { name: 'x'.repeat(201) })))
    await assertSucceeds(setDoc(doc(alice, 'lists/new'), newList('alice', { name: 'x'.repeat(200) })))
  })

  it('createdAt must be the server time', async () => {
    await assertFails(setDoc(doc(dbAs(env, 'alice'), 'lists/new'), newList('alice', { createdAt: FIXED_TIME })))
  })

  it('a list cannot hold extra fields', async () => {
    await assertFails(setDoc(doc(dbAs(env, 'alice'), 'lists/new'), newList('alice', { color: 'red' })))
  })
})

describe('lists: changing', () => {
  it('the owner can rename their list', async () => {
    await assertSucceeds(updateDoc(doc(dbAs(env, 'alice'), 'lists/alice-list'), { name: 'Shopping' }))
  })

  it('the owner cannot give the list to someone else', async () => {
    await assertFails(updateDoc(doc(dbAs(env, 'alice'), 'lists/alice-list'), { ownerId: 'bob' }))
  })

  it("another user cannot rename someone else's list", async () => {
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), 'lists/alice-list'), { name: 'Mine now' }))
  })

  it('the owner can share their list', async () => {
    await assertSucceeds(updateDoc(doc(dbAs(env, 'alice'), 'lists/alice-list'), { shared: true }))
  })

  it("another user cannot share someone else's list", async () => {
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), 'lists/alice-list'), { shared: true }))
  })

  it('the owner can stop sharing their list', async () => {
    await seed(env, { 'lists/alice-shared': storedList('alice', { shared: true }) })
    await assertSucceeds(updateDoc(doc(dbAs(env, 'alice'), 'lists/alice-shared'), { shared: false }))
  })

  it("another user cannot stop sharing someone else's list", async () => {
    await seed(env, { 'lists/alice-shared': storedList('alice', { shared: true }) })
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), 'lists/alice-shared'), { shared: false }))
  })

  it('a signed-out visitor cannot stop sharing a list shared to them', async () => {
    await seed(env, { 'lists/alice-shared': storedList('alice', { shared: true }) })
    await assertFails(updateDoc(doc(dbAs(env, null), 'lists/alice-shared'), { shared: false }))
  })

  it('a signed-out visitor cannot share a list, even one already shared to them', async () => {
    await seed(env, { 'lists/alice-shared': storedList('alice', { shared: true }) })
    await assertFails(updateDoc(doc(dbAs(env, null), 'lists/alice-shared'), { name: 'Renamed' }))
  })

  it('shared must be a boolean', async () => {
    await assertFails(updateDoc(doc(dbAs(env, 'alice'), 'lists/alice-list'), { shared: 'yes' }))
  })

  it('the owner can delete their list', async () => {
    await assertSucceeds(deleteDoc(doc(dbAs(env, 'alice'), 'lists/alice-list')))
  })

  it("another user cannot delete someone else's list", async () => {
    await assertFails(deleteDoc(doc(dbAs(env, 'bob'), 'lists/alice-list')))
  })

  it('the owner can delete a list together with its tasks in one batch', async () => {
    await seed(env, {
      'lists/alice-list/tasks/first': storedTask('alice'),
      'lists/alice-list/tasks/second': storedTask('alice', { status: 'done', completedAt: FIXED_TIME }),
    })
    const alice = dbAs(env, 'alice')
    const batch = writeBatch(alice)
    batch.delete(doc(alice, 'lists/alice-list/tasks/first'))
    batch.delete(doc(alice, 'lists/alice-list/tasks/second'))
    batch.delete(doc(alice, 'lists/alice-list'))
    await assertSucceeds(batch.commit())
  })
})
