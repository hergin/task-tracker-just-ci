import type { DocumentSnapshot, Timestamp } from 'firebase/firestore'
import type { List, Subtask, Task, TaskStatus, UserProfile } from './types'

// Firestore documents → domain types. A server timestamp that is still pending reads as the local estimate.

function fields(snapshot: DocumentSnapshot): Record<string, unknown> {
  const data = snapshot.data({ serverTimestamps: 'estimate' })
  if (!data) throw new Error(`Document ${snapshot.ref.path} does not exist`)
  return data
}

function toDate(value: unknown): Date {
  return (value as Timestamp).toDate()
}

function toOptionalDate(value: unknown): Date | null {
  return value === null ? null : toDate(value)
}

export function userFromSnapshot(snapshot: DocumentSnapshot): UserProfile {
  const data = fields(snapshot)
  return {
    id: snapshot.id,
    name: data.name as string,
    image: data.image as string | null,
    createdAt: toDate(data.createdAt),
  }
}

export function listFromSnapshot(snapshot: DocumentSnapshot): List {
  const data = fields(snapshot)
  return {
    id: snapshot.id,
    name: data.name as string,
    ownerId: data.ownerId as string,
    createdAt: toDate(data.createdAt),
    shared: data.shared as boolean,
  }
}

export function taskFromSnapshot(snapshot: DocumentSnapshot): Task {
  const data = fields(snapshot)
  const listId = snapshot.ref.parent.parent?.id
  if (!listId) throw new Error(`Task ${snapshot.ref.path} is not inside a list`)
  return {
    id: snapshot.id,
    listId,
    ownerId: data.ownerId as string,
    title: data.title as string,
    notes: data.notes as string | null,
    status: data.status as TaskStatus,
    dueDate: data.dueDate as string | null,
    assigneeId: data.assigneeId as string | null,
    position: data.position as number,
    createdAt: toDate(data.createdAt),
    completedAt: toOptionalDate(data.completedAt),
    tags: data.tags as string[],
  }
}

export function subtaskFromSnapshot(snapshot: DocumentSnapshot): Subtask {
  const data = fields(snapshot)
  const taskRef = snapshot.ref.parent.parent
  const listId = taskRef?.parent.parent?.id
  if (!taskRef || !listId) throw new Error(`Subtask ${snapshot.ref.path} is not inside a task`)
  return {
    id: snapshot.id,
    listId,
    taskId: taskRef.id,
    ownerId: data.ownerId as string,
    title: data.title as string,
    done: data.done as boolean,
    position: data.position as number,
    createdAt: toDate(data.createdAt),
  }
}
