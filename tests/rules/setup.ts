import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp, doc, serverTimestamp, setDoc } from 'firebase/firestore'

// The emulator host comes from FIRESTORE_EMULATOR_HOST, which `firebase emulators:exec` sets.
export function createRulesEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-seed-app',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
}

/** A Firestore client acting as `uid`, or as a signed-out visitor when `uid` is null. */
export function dbAs(env: RulesTestEnvironment, uid: string | null) {
  return (uid === null ? env.unauthenticatedContext() : env.authenticatedContext(uid)).firestore()
}

/** Writes documents with rules disabled, to set up the state a test starts from. */
export async function seed(env: RulesTestEnvironment, docs: Record<string, Record<string, unknown>>) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(db, path), data)
    }
  })
}

export const FIXED_TIME = Timestamp.fromDate(new Date('2026-01-01T09:00:00Z'))

/** A time no document can have reached yet: a created document may never be dated ahead of now. */
export const FUTURE_TIME = Timestamp.fromDate(new Date('2099-01-01T09:00:00Z'))

/** A document as the app would write it, with one field left out: the rules refuse a document missing a field. */
export function without(data: Record<string, unknown>, field: string): Record<string, unknown> {
  const rest = { ...data }
  delete rest[field]
  return rest
}

// Stored documents, as they look after a valid write.

export function storedProfile(name: string) {
  return { name, image: null, createdAt: FIXED_TIME }
}

export function storedList(ownerId: string, overrides: Record<string, unknown> = {}) {
  return { name: 'Groceries', ownerId, createdAt: FIXED_TIME, shared: false, ...overrides }
}

export function storedTask(ownerId: string, overrides: Record<string, unknown> = {}) {
  return {
    ownerId,
    title: 'Buy milk',
    notes: null,
    status: 'todo',
    dueDate: null,
    assigneeId: null,
    position: 0,
    createdAt: FIXED_TIME,
    completedAt: null,
    tags: [],
    ...overrides,
  }
}

// New documents, as the app writes them.

export function newList(ownerId: string, overrides: Record<string, unknown> = {}) {
  return { name: 'Groceries', ownerId, createdAt: serverTimestamp(), shared: false, ...overrides }
}

export function newTask(ownerId: string, overrides: Record<string, unknown> = {}) {
  return storedTask(ownerId, { createdAt: serverTimestamp(), ...overrides })
}

export function storedSubtask(ownerId: string, overrides: Record<string, unknown> = {}) {
  return { ownerId, title: 'Chop vegetables', done: false, position: 0, createdAt: FIXED_TIME, ...overrides }
}

export function newSubtask(ownerId: string, overrides: Record<string, unknown> = {}) {
  return storedSubtask(ownerId, { createdAt: serverTimestamp(), ...overrides })
}
