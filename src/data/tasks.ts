import {
  addDoc,
  collection,
  collectionGroup,
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
import type { Result } from '../lib/result'
import {
  compareTasks,
  completedAtChange,
  countOpenTasksByList,
  normalizeTaskEdit,
  type TaskEditInput,
} from '../lib/tasks'
import { requiredText } from '../lib/text'
import { taskFromSnapshot } from './converters'
import { attempt } from './errors'
import { LIMITS, type DateKey, type Task, type TaskStatus } from './types'

/** A task as listed on its list page. `saving` is true while the server hasn't confirmed a change to it yet. */
export type ListedTask = Task & { saving: boolean }

/** The tasks in one of the signed-in user's lists, in display order. */
export function useTasks(listId: string, uid: string): SubscriptionState<ListedTask[]> {
  return useSubscription(`tasks:${uid}:${listId}`, (onData, onError) =>
    onSnapshot(
      query(collection(db, 'lists', listId, 'tasks'), where('ownerId', '==', uid)),
      // Metadata changes too, so `saving` turns false when the server confirms a write.
      { includeMetadataChanges: true },
      (snapshot) =>
        onData(
          snapshot.docs
            .map((task) => ({ ...taskFromSnapshot(task), saving: task.metadata.hasPendingWrites }))
            .sort(compareTasks),
        ),
      onError,
    ),
  )
}

/** The tasks of a shared list's public page, in display order. Empty when the list isn't shared. */
export function useSharedTasks(listId: string): SubscriptionState<Task[]> {
  return useSubscription(`shared-tasks:${listId}`, (onData, onError) =>
    onSnapshot(
      collection(db, 'lists', listId, 'tasks'),
      (snapshot) => onData(snapshot.docs.map(taskFromSnapshot).sort(compareTasks)),
      (error) => (error.code === 'permission-denied' ? onData([]) : onError(error)),
    ),
  )
}

/** Every task in the signed-in user's lists. */
export function useAllTasks(uid: string): SubscriptionState<ListedTask[]> {
  return useSubscription(`all-tasks:${uid}`, (onData, onError) =>
    onSnapshot(
      query(collectionGroup(db, 'tasks'), where('ownerId', '==', uid)),
      // Metadata changes too, so `saving` turns false when the server confirms a write (as in useTasks).
      { includeMetadataChanges: true },
      (snapshot) =>
        onData(snapshot.docs.map((task) => ({ ...taskFromSnapshot(task), saving: task.metadata.hasPendingWrites }))),
      onError,
    ),
  )
}

/** How many open tasks each of the signed-in user's lists has, by list id. Lists without open tasks are left out. */
export function useOpenTaskCounts(uid: string): SubscriptionState<Record<string, number>> {
  return useSubscription(`open-task-counts:${uid}`, (onData, onError) =>
    onSnapshot(
      query(collectionGroup(db, 'tasks'), where('ownerId', '==', uid)),
      (snapshot) => onData(countOpenTasksByList(snapshot.docs.map(taskFromSnapshot))),
      onError,
    ),
  )
}

export type NewTask = {
  uid: string
  listId: string
  title: string
  position: number
}

export async function addTask({ uid, listId, title, position }: NewTask): Promise<Result<{ id: string }>> {
  const valid = requiredText(title, LIMITS.taskTitle, 'Task title')
  if (!valid.ok) return valid
  return attempt(async () => {
    const ref = await addDoc(collection(db, 'lists', listId, 'tasks'), {
      ownerId: uid,
      title: valid.data,
      notes: null,
      status: 'todo',
      dueDate: null,
      assigneeId: null,
      position,
      createdAt: serverTimestamp(),
      completedAt: null,
      tags: [],
    })
    return { id: ref.id }
  })
}

type TaskKey = Pick<Task, 'id' | 'listId'>

function taskRef(task: TaskKey) {
  return doc(db, 'lists', task.listId, 'tasks', task.id)
}

/** Saves the edit form: title, notes, due date and assignee. */
export async function updateTask(task: TaskKey, input: TaskEditInput): Promise<Result<void>> {
  const valid = normalizeTaskEdit(input)
  if (!valid.ok) return valid
  return attempt(() => updateDoc(taskRef(task), valid.data))
}

/** Changes a task's status, and completedAt with it (completedAtChange; the rules enforce the same). */
export function setTaskStatus(task: TaskKey & Pick<Task, 'status'>, status: TaskStatus): Promise<Result<void>> {
  const change = completedAtChange(task.status, status)
  return attempt(() =>
    updateDoc(
      taskRef(task),
      change === 'keep' ? { status } : { status, completedAt: change === 'set' ? serverTimestamp() : null },
    ),
  )
}

/** Moves a task's due date, leaving everything else about it alone (the Today page's push to tomorrow). */
export function setTaskDueDate(task: TaskKey, dueDate: DateKey): Promise<Result<void>> {
  return attempt(() => updateDoc(taskRef(task), { dueDate }))
}

/** Firestore allows at most 500 writes in one batch. */
const BATCH_LIMIT = 500

/** Deletes a task and its subtasks: Firestore never deletes a subcollection by itself (deleteList does the same). */
export async function deleteTask(task: TaskKey & Pick<Task, 'ownerId'>): Promise<Result<void>> {
  return attempt(async () => {
    const subtasks = await getDocs(
      query(collection(db, 'lists', task.listId, 'tasks', task.id, 'subtasks'), where('ownerId', '==', task.ownerId)),
    )
    for (let start = 0; start < subtasks.docs.length; start += BATCH_LIMIT) {
      const batch = writeBatch(db)
      for (const subtask of subtasks.docs.slice(start, start + BATCH_LIMIT)) batch.delete(subtask.ref)
      await batch.commit()
    }
    await deleteDoc(taskRef(task))
  })
}

/** Writes the new positions from reorderTask or moveTaskByDirection (lib/tasks.ts), in one batch. */
export function moveTask(changedTasks: readonly (TaskKey & Pick<Task, 'position'>)[]): Promise<Result<void>> {
  return attempt(async () => {
    const batch = writeBatch(db)
    for (const task of changedTasks) batch.update(taskRef(task), { position: task.position })
    await batch.commit()
  })
}
