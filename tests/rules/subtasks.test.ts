import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  FIXED_TIME,
  FUTURE_TIME,
  createRulesEnv,
  dbAs,
  newSubtask,
  newTask,
  seed,
  storedList,
  storedProfile,
  storedSubtask,
  storedTask,
  without,
} from './setup'

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
    'lists/alice-list/tasks/alice-task': storedTask('alice'),
    'lists/bob-list/tasks/bob-task': storedTask('bob'),
    'lists/alice-list/tasks/alice-task/subtasks/open-subtask': storedSubtask('alice'),
  })
})

const aliceSubtask = (id: string) => `lists/alice-list/tasks/alice-task/subtasks/${id}`

describe('subtasks: reading', () => {
  it('the task owner can read their subtask', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, 'alice'), aliceSubtask('open-subtask'))))
  })

  it("another user cannot read someone else's subtask", async () => {
    await assertFails(getDoc(doc(dbAs(env, 'bob'), aliceSubtask('open-subtask'))))
  })

  it("a signed-out visitor cannot read a subtask, even on a shared list's task", async () => {
    await seed(env, {
      'lists/alice-shared': storedList('alice', { shared: true }),
      'lists/alice-shared/tasks/shared-task': storedTask('alice'),
      'lists/alice-shared/tasks/shared-task/subtasks/shared-subtask': storedSubtask('alice'),
    })
    await assertFails(getDoc(doc(dbAs(env, null), 'lists/alice-shared/tasks/shared-task/subtasks/shared-subtask')))
  })

  it("a task's own subtask list, filtered to your own ownerId, is allowed", async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(
      getDocs(query(collection(alice, 'lists/alice-list/tasks/alice-task/subtasks'), where('ownerId', '==', 'alice'))),
    )
  })

  it('listing a subtask collection without an ownerId filter is rejected', async () => {
    await assertFails(getDocs(collection(dbAs(env, 'alice'), 'lists/alice-list/tasks/alice-task/subtasks')))
  })
})

describe('subtasks: creating', () => {
  it('the task owner can add a subtask', async () => {
    await assertSucceeds(setDoc(doc(dbAs(env, 'alice'), aliceSubtask('new')), newSubtask('alice')))
  })

  it("a user cannot add a subtask to someone else's task, even claiming to own the subtask", async () => {
    await assertFails(setDoc(doc(dbAs(env, 'alice'), 'lists/bob-list/tasks/bob-task/subtasks/new'), newSubtask('alice')))
  })

  it('the subtask owner must be the signed-in user', async () => {
    await assertFails(setDoc(doc(dbAs(env, 'alice'), aliceSubtask('new')), newSubtask('bob')))
  })

  it('the title must be 1 to 500 characters', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(setDoc(doc(alice, aliceSubtask('new')), newSubtask('alice', { title: '' })))
    await assertFails(setDoc(doc(alice, aliceSubtask('new')), newSubtask('alice', { title: 'x'.repeat(501) })))
  })

  it('done must be a boolean', async () => {
    await assertFails(setDoc(doc(dbAs(env, 'alice'), aliceSubtask('new')), newSubtask('alice', { done: 'yes' })))
  })

  it('createdAt must be a timestamp, and never in the future', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(setDoc(doc(alice, aliceSubtask('undated')), without(newSubtask('alice'), 'createdAt')))
    await assertFails(setDoc(doc(alice, aliceSubtask('not-a-time')), newSubtask('alice', { createdAt: '2026-01-01' })))
    await assertFails(setDoc(doc(alice, aliceSubtask('dated-ahead')), newSubtask('alice', { createdAt: FUTURE_TIME })))
  })

  it('a subtask can be created with the createdAt it already had, as moving its task to another list does', async () => {
    await assertSucceeds(
      setDoc(doc(dbAs(env, 'alice'), aliceSubtask('moved')), newSubtask('alice', { createdAt: FIXED_TIME })),
    )
  })

  it('a subtask can be created in the same batch as its task, as moving a task to another list does', async () => {
    const alice = dbAs(env, 'alice')
    const batch = writeBatch(alice)
    batch.set(doc(alice, 'lists/alice-list/tasks/moved'), newTask('alice'))
    batch.set(doc(alice, 'lists/alice-list/tasks/moved/subtasks/moved-subtask'), newSubtask('alice'))
    await assertSucceeds(batch.commit())
  })

  it('a subtask cannot be created under a task that does not exist', async () => {
    await assertFails(
      setDoc(doc(dbAs(env, 'alice'), 'lists/alice-list/tasks/ghost/subtasks/new'), newSubtask('alice')),
    )
  })

  it("a user cannot add a subtask to someone else's task by creating that task in the same batch", async () => {
    const alice = dbAs(env, 'alice')
    const batch = writeBatch(alice)
    batch.set(doc(alice, 'lists/bob-list/tasks/sneaked'), newTask('alice'))
    batch.set(doc(alice, 'lists/bob-list/tasks/sneaked/subtasks/new'), newSubtask('alice'))
    await assertFails(batch.commit())
  })
})

describe('subtasks: changing', () => {
  it('the owner can tick a subtask done and rename it', async () => {
    const alice = dbAs(env, 'alice')
    await assertSucceeds(updateDoc(doc(alice, aliceSubtask('open-subtask')), { done: true }))
    await assertSucceeds(updateDoc(doc(alice, aliceSubtask('open-subtask')), { title: 'Wash vegetables' }))
  })

  it('ownerId and createdAt cannot change', async () => {
    const alice = dbAs(env, 'alice')
    await assertFails(updateDoc(doc(alice, aliceSubtask('open-subtask')), { ownerId: 'bob' }))
    await assertFails(updateDoc(doc(alice, aliceSubtask('open-subtask')), { createdAt: serverTimestamp() }))
  })

  it("another user cannot change someone else's subtask", async () => {
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), aliceSubtask('open-subtask')), { title: 'Hacked' }))
  })

  it('the owner can delete their subtask', async () => {
    await assertSucceeds(deleteDoc(doc(dbAs(env, 'alice'), aliceSubtask('open-subtask'))))
  })

  it("another user cannot delete someone else's subtask", async () => {
    await assertFails(deleteDoc(doc(dbAs(env, 'bob'), aliceSubtask('open-subtask'))))
  })
})
