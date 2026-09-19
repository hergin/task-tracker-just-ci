import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore'
import { E2E_OWNER, LOCAL_E2E_PASSWORD, lists, tasks, users } from '../fixture.ts'

/**
 * Resets the emulators' database to exactly the fixture in scripts/fixture.ts: deletes every document, recreates the
 * test account, writes the fixture. Running it twice gives the same state.
 */
export async function seedDatabase(projectId: string): Promise<void> {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

  const app = initializeApp({ projectId }, 'seed')
  try {
    const db = getFirestore(app)
    await clearDatabase(db)
    await resetTestAccount(getAuth(app))
    await writeFixture(db)
  } finally {
    await deleteApp(app)
  }
}

async function clearDatabase(db: Firestore) {
  for (const collection of await db.listCollections()) {
    await db.recursiveDelete(collection)
  }
}

/** Recreates the test account, so its password is always the known local one. */
async function resetTestAccount(auth: Auth) {
  try {
    await auth.deleteUser(E2E_OWNER.uid)
  } catch (error) {
    if (!isUserNotFound(error)) throw error
  }
  await createTestAccount(auth, LOCAL_E2E_PASSWORD)
}

function createTestAccount(auth: Auth, password: string) {
  return auth.createUser({
    uid: E2E_OWNER.uid,
    email: E2E_OWNER.email,
    emailVerified: true,
    password,
    displayName: E2E_OWNER.name,
  })
}

function isUserNotFound(error: unknown): boolean {
  return (error as { code?: string }).code === 'auth/user-not-found'
}

async function writeFixture(db: Firestore) {
  const timestamp = (date: Date) => Timestamp.fromDate(date)
  const batch = db.batch()
  for (const { id, ...user } of users) {
    batch.set(db.doc(`users/${id}`), { ...user, createdAt: timestamp(user.createdAt) })
  }
  for (const { id, ...list } of lists) {
    batch.set(db.doc(`lists/${id}`), { ...list, createdAt: timestamp(list.createdAt) })
  }
  for (const { id, listId, ...task } of tasks) {
    batch.set(db.doc(`lists/${listId}/tasks/${id}`), {
      ...task,
      createdAt: timestamp(task.createdAt),
      completedAt: task.completedAt ? timestamp(task.completedAt) : null,
    })
  }
  await batch.commit()
}
