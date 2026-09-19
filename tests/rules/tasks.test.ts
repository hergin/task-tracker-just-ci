import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { FIXED_TIME, createRulesEnv, dbAs, newTask, seed, storedList, storedProfile, storedTask } from './setup'

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
    'users/alice': storedProfile('Alice'),
    'users/bob': storedProfile('Bob'),
    'lists/alice-list': storedList('alice'),
    'lists/bob-list': storedList('bob'),
    'lists/alice-list/tasks/open-task': storedTask('alice'),
    'lists/alice-list/tasks/done-task': storedTask('alice', { status: 'done', completedAt: FIXED_TIME }),
  })
})

const aliceTask = (id: string) => `lists/alice-list/tasks/${id}`

describe('tasks: reading', () => {
  it('the owner can read their task', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, 'alice'), aliceTask('open-task'))))
  })

  it("another user cannot read someone else's task", async () => {
    await assertFails(getDoc(doc(dbAs(env, 'bob'), aliceTask('open-task'))))
  })

  it('a list-page query filtered to your own ownerId is allowed', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(getDocs(query(collection(alice, 'lists/alice-list/tasks'), where('ownerId', '==', 'alice'))))
  })

  it('a list-page query without an ownerId filter is rejected', async () => {
    await assertFails(getDocs(collection(dbAs(env, 'alice'), 'lists/alice-list/tasks')))
  })

  it('a query across all lists filtered to your own ownerId is allowed', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(getDocs(query(collectionGroup(alice, 'tasks'), where('ownerId', '==', 'alice'))))
  })

  it("a query across all lists for someone else's tasks is rejected", async () => {
    const bob = dbAs(env, 'bob')
    await assertFails(getDocs(query(collectionGroup(bob, 'tasks'), where('ownerId', '==', 'alice'))))
  })

  it('a query across all lists without an ownerId filter is rejected', async () => {
    await assertFails(getDocs(collectionGroup(dbAs(env, 'alice'), 'tasks')))
  })
})

describe('tasks: reading a shared list', () => {
  beforeEach(async () => {
    await seed(env, {
      'lists/alice-shared': storedList('alice', { shared: true }),
      'lists/alice-shared/tasks/open-task': storedTask('alice'),
    })
  })

  it("a signed-out visitor can read a shared list's task", async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, null), 'lists/alice-shared/tasks/open-task')))
  })

  it("a signed-out visitor can query a shared list's tasks with no filter", async () => {
    await assertSucceeds(getDocs(collection(dbAs(env, null), 'lists/alice-shared/tasks')))
  })

  it("a signed-out visitor cannot read an unshared list's task", async () => {
    await assertFails(getDoc(doc(dbAs(env, null), aliceTask('open-task'))))
  })

  it('a signed-out visitor cannot create, update or delete a task on a shared list', async () => {
    const visitor = dbAs(env, null)
    await assertFails(setDoc(doc(visitor, 'lists/alice-shared/tasks/new'), newTask('alice')))
    await assertFails(updateDoc(doc(visitor, 'lists/alice-shared/tasks/open-task'), { title: 'Hacked' }))
    await assertFails(deleteDoc(doc(visitor, 'lists/alice-shared/tasks/open-task')))
  })

  it('a shared list cannot be enumerated through a collection-group query', async () => {
    await assertFails(getDocs(collectionGroup(dbAs(env, null), 'tasks')))
  })
})

describe('tasks: creating', () => {
  it('the list owner can add a task', async () => {
    await assertSucceeds(setDoc(doc(dbAs(env, 'alice'), aliceTask('new')), newTask('alice')))
  })

  it("a user cannot add a task to someone else's list, even claiming to own the task", async () => {
    await assertFails(setDoc(doc(dbAs(env, 'alice'), 'lists/bob-list/tasks/new'), newTask('alice')))
  })

  it('the task owner must be the signed-in user', async () => {
    await assertFails(setDoc(doc(dbAs(env, 'alice'), aliceTask('new')), newTask('bob')))
  })

  it('the title must be 1 to 500 characters', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(setDoc(doc(alice, aliceTask('new')), newTask('alice', { title: '' })))
    await assertFails(setDoc(doc(alice, aliceTask('new')), newTask('alice', { title: 'x'.repeat(501) })))
  })

  it('the status must be todo, doing or done', async () => {
    await assertFails(setDoc(doc(dbAs(env, 'alice'), aliceTask('new')), newTask('alice', { status: 'blocked' })))
  })

  it('the due date must be null or YYYY-MM-DD', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(setDoc(doc(alice, aliceTask('dated')), newTask('alice', { dueDate: '2026-03-10' })))
    await assertFails(setDoc(doc(alice, aliceTask('bad-date')), newTask('alice', { dueDate: 'tomorrow' })))
  })

  it('the assignee must be null or an existing user', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(setDoc(doc(alice, aliceTask('assigned')), newTask('alice', { assigneeId: 'bob' })))
    await assertFails(setDoc(doc(alice, aliceTask('ghost')), newTask('alice', { assigneeId: 'nobody' })))
  })

  it('createdAt must be the server time', async () => {
    await assertFails(setDoc(doc(dbAs(env, 'alice'), aliceTask('new')), newTask('alice', { createdAt: FIXED_TIME })))
  })

  it('a task that is not done cannot have completedAt', async () => {
    await assertFails(
      setDoc(doc(dbAs(env, 'alice'), aliceTask('new')), newTask('alice', { completedAt: serverTimestamp() })),
    )
  })

  it('a task created as done must have completedAt set to server time', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(
      setDoc(doc(alice, aliceTask('done-now')), newTask('alice', { status: 'done', completedAt: serverTimestamp() })),
    )
    await assertFails(setDoc(doc(alice, aliceTask('done-null')), newTask('alice', { status: 'done', completedAt: null })))
  })

  it('tags must be a list of at most 10 non-empty strings of at most 50 characters', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(setDoc(doc(alice, aliceTask('tagged')), newTask('alice', { tags: ['urgent', 'travel'] })))
    await assertFails(setDoc(doc(alice, aliceTask('not-a-list')), newTask('alice', { tags: 'urgent' })))
    await assertFails(setDoc(doc(alice, aliceTask('too-many')), newTask('alice', { tags: Array.from({ length: 11 }, (_, i) => `tag${i}`) })))
    await assertFails(setDoc(doc(alice, aliceTask('empty-tag')), newTask('alice', { tags: [''] })))
    await assertFails(setDoc(doc(alice, aliceTask('long-tag')), newTask('alice', { tags: ['x'.repeat(51)] })))
    await assertSucceeds(setDoc(doc(alice, aliceTask('max-tag')), newTask('alice', { tags: ['x'.repeat(50)] })))
  })
})

describe('tasks: changing', () => {
  it('marking a task done sets completedAt to server time', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(updateDoc(doc(alice, aliceTask('open-task')), { status: 'done' }))
    await assertSucceeds(updateDoc(doc(alice, aliceTask('open-task')), { status: 'done', completedAt: serverTimestamp() }))
  })

  it('editing a done task keeps its completedAt', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(updateDoc(doc(alice, aliceTask('done-task')), { title: 'Buy oat milk' }))
    await assertFails(updateDoc(doc(alice, aliceTask('done-task')), { completedAt: serverTimestamp() }))
  })

  it('moving a task out of done clears completedAt', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(updateDoc(doc(alice, aliceTask('done-task')), { status: 'todo' }))
    await assertSucceeds(updateDoc(doc(alice, aliceTask('done-task')), { status: 'todo', completedAt: null }))
  })

  it('ownerId and createdAt cannot change', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(updateDoc(doc(alice, aliceTask('open-task')), { ownerId: 'bob' }))
    await assertFails(updateDoc(doc(alice, aliceTask('open-task')), { createdAt: serverTimestamp() }))
  })

  it("another user cannot change someone else's task", async () => {
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), aliceTask('open-task')), { title: 'Hacked' }))
  })

  it('the owner can add and remove tags', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(updateDoc(doc(alice, aliceTask('open-task')), { tags: ['urgent'] }))
    await assertFails(updateDoc(doc(alice, aliceTask('open-task')), { tags: Array.from({ length: 11 }, (_, i) => `tag${i}`) }))
  })

  it('postponed is a valid status, and other unknown statuses such as paused are still refused', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(setDoc(doc(alice, aliceTask('postponed')), newTask('alice', { status: 'postponed' })))
    await assertSucceeds(updateDoc(doc(alice, aliceTask('open-task')), { status: 'postponed' }))
    await assertFails(setDoc(doc(alice, aliceTask('paused')), newTask('alice', { status: 'paused' })))
    await assertFails(updateDoc(doc(alice, aliceTask('open-task')), { status: 'paused' }))
  })

  it('a postponed task has no completedAt: moving done to postponed clears it, postponed to done sets it anew', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(updateDoc(doc(alice, aliceTask('done-task')), { status: 'postponed', completedAt: null }))
    await assertFails(updateDoc(doc(alice, aliceTask('done-task')), { completedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(alice, aliceTask('done-task')), { status: 'done' }))
    await assertSucceeds(updateDoc(doc(alice, aliceTask('done-task')), { status: 'done', completedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(alice, aliceTask('done-task')), { status: 'postponed' }))
    await assertFails(
      setDoc(doc(alice, aliceTask('new')), newTask('alice', { status: 'postponed', completedAt: serverTimestamp() })),
    )
  })

  it('the owner can delete their task', async () => {
    await assertSucceeds(deleteDoc(doc(dbAs(env, 'alice'), aliceTask('open-task'))))
  })

  it("another user cannot delete someone else's task", async () => {
    await assertFails(deleteDoc(doc(dbAs(env, 'bob'), aliceTask('open-task'))))
  })
})

describe('tasks: sharing with a contact', () => {
  /** `count` user ids, to fill a task's shared-with list up to and past its limit. */
  const contactIds = (count: number) => Array.from({ length: count }, (_, index) => `contact-${index}`)

  /** A task as the app writes it, but without the shared-with field at all. */
  function withoutSharedWith(task: Record<string, unknown>) {
    const rest = { ...task }
    delete rest.sharedWith
    return rest
  }

  it('a task can be created shared with 0 to 10 text ids, and nothing else is accepted', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(setDoc(doc(alice, aliceTask('shared-none')), newTask('alice', { sharedWith: [] })))
    await assertSucceeds(setDoc(doc(alice, aliceTask('shared-one')), newTask('alice', { sharedWith: ['bob'] })))
    await assertSucceeds(setDoc(doc(alice, aliceTask('shared-ten')), newTask('alice', { sharedWith: contactIds(10) })))
    await assertFails(setDoc(doc(alice, aliceTask('shared-eleven')), newTask('alice', { sharedWith: contactIds(11) })))
    await assertFails(setDoc(doc(alice, aliceTask('shared-not-a-list')), newTask('alice', { sharedWith: 'bob' })))
    await assertFails(setDoc(doc(alice, aliceTask('shared-not-text')), newTask('alice', { sharedWith: [1] })))
    await assertFails(setDoc(doc(alice, aliceTask('shared-missing')), withoutSharedWith(newTask('alice'))))
  })

  it('the owner can share and unshare their task within the same limits, and another user cannot', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(updateDoc(doc(alice, aliceTask('open-task')), { sharedWith: ['bob'] }))
    await assertSucceeds(updateDoc(doc(alice, aliceTask('open-task')), { sharedWith: [] }))
    await assertFails(updateDoc(doc(alice, aliceTask('open-task')), { sharedWith: contactIds(11) }))
    await assertFails(updateDoc(doc(alice, aliceTask('open-task')), { sharedWith: 'bob' }))
    await assertFails(updateDoc(doc(alice, aliceTask('open-task')), { sharedWith: [1] }))
    await assertFails(updateDoc(doc(alice, aliceTask('open-task')), { sharedWith: deleteField() }))
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), aliceTask('open-task')), { sharedWith: ['bob'] }))
  })

  it('a contact a task is shared with still cannot read it', async () => {
    await assertSucceeds(updateDoc(doc(dbAs(env, 'alice'), aliceTask('open-task')), { sharedWith: ['bob'] }))

    const bob = dbAs(env, 'bob')
    await assertFails(getDoc(doc(bob, aliceTask('open-task'))))
    await assertFails(getDocs(query(collectionGroup(bob, 'tasks'), where('sharedWith', 'array-contains', 'bob'))))
  })
})
