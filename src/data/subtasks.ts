import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { useSubscription, type SubscriptionState } from '../hooks/useSubscription'
import { db } from '../lib/firebase'
import type { Result } from '../lib/result'
import { compareSubtasks } from '../lib/subtasks'
import { requiredText } from '../lib/text'
import { subtaskFromSnapshot } from './converters'
import { attempt } from './errors'
import { LIMITS, type Subtask } from './types'

/** A subtask as listed under its task. `saving` is true while the server hasn't confirmed a change to it yet. */
export type ListedSubtask = Subtask & { saving: boolean }

/** A task's subtasks, in display order. */
export function useSubtasks(listId: string, taskId: string, uid: string): SubscriptionState<ListedSubtask[]> {
  return useSubscription(`subtasks:${uid}:${listId}:${taskId}`, (onData, onError) =>
    onSnapshot(
      query(collection(db, 'lists', listId, 'tasks', taskId, 'subtasks'), where('ownerId', '==', uid)),
      // Metadata changes too, so `saving` turns false when the server confirms a write.
      { includeMetadataChanges: true },
      (snapshot) =>
        onData(
          snapshot.docs
            .map((subtask) => ({ ...subtaskFromSnapshot(subtask), saving: subtask.metadata.hasPendingWrites }))
            .sort(compareSubtasks),
        ),
      onError,
    ),
  )
}

export type NewSubtask = {
  uid: string
  listId: string
  taskId: string
  title: string
  position: number
}

export async function addSubtask({ uid, listId, taskId, title, position }: NewSubtask): Promise<Result<{ id: string }>> {
  const valid = requiredText(title, LIMITS.subtaskTitle, 'Subtask title')
  if (!valid.ok) return valid
  return attempt(async () => {
    const ref = await addDoc(collection(db, 'lists', listId, 'tasks', taskId, 'subtasks'), {
      ownerId: uid,
      title: valid.data,
      done: false,
      position,
      createdAt: serverTimestamp(),
    })
    return { id: ref.id }
  })
}

type SubtaskKey = Pick<Subtask, 'id' | 'listId' | 'taskId'>

function subtaskRef(subtask: SubtaskKey) {
  return doc(db, 'lists', subtask.listId, 'tasks', subtask.taskId, 'subtasks', subtask.id)
}

export function setSubtaskDone(subtask: SubtaskKey, done: boolean): Promise<Result<void>> {
  return attempt(() => updateDoc(subtaskRef(subtask), { done }))
}

export async function renameSubtask(subtask: SubtaskKey, title: string): Promise<Result<void>> {
  const valid = requiredText(title, LIMITS.subtaskTitle, 'Subtask title')
  if (!valid.ok) return valid
  return attempt(() => updateDoc(subtaskRef(subtask), { title: valid.data }))
}

export function deleteSubtask(subtask: SubtaskKey): Promise<Result<void>> {
  return attempt(() => deleteDoc(subtaskRef(subtask)))
}
