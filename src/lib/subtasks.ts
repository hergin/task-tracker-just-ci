import type { Subtask } from '../data/types'

type SubtaskOrderFields = Pick<Subtask, 'id' | 'position' | 'createdAt'>

/** Display order for a task's subtasks: position, then createdAt, then id, so ties are still deterministic. */
export function compareSubtasks(a: SubtaskOrderFields, b: SubtaskOrderFields): number {
  return (
    a.position - b.position ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}

/** The position for a subtask added at the end of its task's checklist. */
export function nextSubtaskPosition(subtasks: readonly Pick<Subtask, 'position'>[]): number {
  return subtasks.reduce((max, subtask) => Math.max(max, subtask.position + 1), 0)
}

/** How many of a task's subtasks are done, or null when it has none. */
export function subtaskProgress(subtasks: readonly Pick<Subtask, 'done'>[]): { done: number; total: number } | null {
  if (subtasks.length === 0) return null
  return { done: subtasks.filter((subtask) => subtask.done).length, total: subtasks.length }
}
