import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { FIXED_TIME, createRulesEnv, dbAs, seed, storedProfile } from './setup'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await createRulesEnv()
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
})

describe('users/{uid}', () => {
  it('any signed-in user can read any profile', async () => {
    await seed(env, { 'users/alice': storedProfile('Alice') })
    await assertSucceeds(getDoc(doc(dbAs(env, 'bob'), 'users/alice')))
  })

  it('signed-out visitors cannot read profiles', async () => {
    await seed(env, { 'users/alice': storedProfile('Alice') })
    await assertFails(getDoc(doc(dbAs(env, null), 'users/alice')))
  })

  it('a user can create their own profile', async () => {
    await assertSucceeds(
      setDoc(doc(dbAs(env, 'alice'), 'users/alice'), { name: 'Alice', image: null, createdAt: serverTimestamp() }),
    )
  })

  it("a user cannot create someone else's profile", async () => {
    await assertFails(
      setDoc(doc(dbAs(env, 'bob'), 'users/alice'), { name: 'Alice', image: null, createdAt: serverTimestamp() }),
    )
  })

  it('createdAt must be the server time', async () => {
    await assertFails(setDoc(doc(dbAs(env, 'alice'), 'users/alice'), { name: 'Alice', image: null, createdAt: FIXED_TIME }))
  })

  it('a profile cannot hold extra fields such as email', async () => {
    await assertFails(
      setDoc(doc(dbAs(env, 'alice'), 'users/alice'), {
        name: 'Alice',
        image: null,
        createdAt: serverTimestamp(),
        email: 'alice@example.com',
      }),
    )
  })

  it('a user can update their own name but not createdAt', async () => {
    await seed(env, { 'users/alice': storedProfile('Alice') })
    const alice = dbAs(env, 'alice')
    await assertSucceeds(updateDoc(doc(alice, 'users/alice'), { name: 'Alice A.' }))
    await assertFails(updateDoc(doc(alice, 'users/alice'), { createdAt: serverTimestamp() }))
  })

  it("a user cannot update someone else's profile", async () => {
    await seed(env, { 'users/alice': storedProfile('Alice') })
    await assertFails(updateDoc(doc(dbAs(env, 'bob'), 'users/alice'), { name: 'Hacked' }))
  })

  it('profiles cannot be deleted', async () => {
    await seed(env, { 'users/alice': storedProfile('Alice') })
    await assertFails(deleteDoc(doc(dbAs(env, 'alice'), 'users/alice')))
  })
})
