import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { useSubscription, type SubscriptionState } from '../hooks/useSubscription'
import { db } from '../lib/firebase'
import { compareLists } from '../lib/lists'
import type { Result } from '../lib/result'
import { requiredText } from '../lib/text'
import { listFromSnapshot } from './converters'
import { attempt } from './errors'
import { LIMITS, type List } from './types'

/** Firestore allows at most 500 writes in one batch. */
const BATCH_LIMIT = 500

/** The signed-in user's lists, oldest first. */
export function useLists(uid: string): SubscriptionState<List[]> {
  return useSubscription(`lists:${uid}`, (onData, onError) =>
    onSnapshot(
      query(collection(db, 'lists'), where('ownerId', '==', uid)),
      (snapshot) => onData(snapshot.docs.map(listFromSnapshot).sort(compareLists)),
      onError,
    ),
  )
}

/** One list, or null when it doesn't exist or belongs to someone else (the rules refuse both the same way). */
export function useList(listId: string, uid: string): SubscriptionState<List | null> {
  return useSubscription(`list:${uid}:${listId}`, (onData, onError) =>
    onSnapshot(
      doc(db, 'lists', listId),
      (snapshot) => onData(snapshot.exists() ? listFromSnapshot(snapshot) : null),
      (error) => (error.code === 'permission-denied' ? onData(null) : onError(error)),
    ),
  )
}

/** A list's public read-only page: the list by id, or null when it doesn't exist or was never shared. */
export function useSharedList(listId: string): SubscriptionState<List | null> {
  return useSubscription(`shared-list:${listId}`, (onData, onError) =>
    onSnapshot(
      doc(db, 'lists', listId),
      (snapshot) => onData(snapshot.exists() ? listFromSnapshot(snapshot) : null),
      (error) => (error.code === 'permission-denied' ? onData(null) : onError(error)),
    ),
  )
}

export async function createList(uid: string, name: string): Promise<Result<{ id: string }>> {
  const valid = requiredText(name, LIMITS.listName, 'List name')
  if (!valid.ok) return valid
  return attempt(async () => {
    const ref = await addDoc(collection(db, 'lists'), {
      name: valid.data,
      ownerId: uid,
      createdAt: serverTimestamp(),
      shared: false,
    })
    return { id: ref.id }
  })
}

export async function renameList(listId: string, name: string): Promise<Result<void>> {
  const valid = requiredText(name, LIMITS.listName, 'List name')
  if (!valid.ok) return valid
  return attempt(() => updateDoc(doc(db, 'lists', listId), { name: valid.data }))
}

/** Turns on the read-only share link for a list the signed-in user owns. */
export function shareList(listId: string): Promise<Result<void>> {
  return attempt(() => updateDoc(doc(db, 'lists', listId), { shared: true }))
}

/** Turns the share link off again: the list keeps its id, so sharing it again gives the same link. */
export function unshareList(listId: string): Promise<Result<void>> {
  return attempt(() => updateDoc(doc(db, 'lists', listId), { shared: false }))
}

/**
 * Deletes a list, every task in it and every task's subtasks. Firestore never deletes a subcollection by
 * itself, so the subtasks go first, then the tasks, in batches, and the list last: if something fails
 * halfway, the list is still there to delete again.
 */
export async function deleteList(listId: string, uid: string): Promise<Result<void>> {
  return attempt(async () => {
    const tasks = await getDocs(query(collection(db, 'lists', listId, 'tasks'), where('ownerId', '==', uid)))
    for (const task of tasks.docs) {
      const subtasks = await getDocs(
        query(collection(db, 'lists', listId, 'tasks', task.id, 'subtasks'), where('ownerId', '==', uid)),
      )
      for (let start = 0; start < subtasks.docs.length; start += BATCH_LIMIT) {
        const batch = writeBatch(db)
        for (const subtask of subtasks.docs.slice(start, start + BATCH_LIMIT)) batch.delete(subtask.ref)
        await batch.commit()
      }
    }
    for (let start = 0; start < tasks.docs.length; start += BATCH_LIMIT) {
      const batch = writeBatch(db)
      for (const task of tasks.docs.slice(start, start + BATCH_LIMIT)) batch.delete(task.ref)
      await batch.commit()
    }
    await deleteDoc(doc(db, 'lists', listId))
  })
}
