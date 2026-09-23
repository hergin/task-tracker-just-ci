import { LIMITS, TASK_STATUSES, type DateKey, type List, type Task, type TaskStatus } from '../data/types'
import { dueState, isDateKey } from './dates'
import { err, ok, type Result } from './result'
import { optionalText, requiredText } from './text'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
  postponed: 'Postponed',
}

/** A list page's status filter: one status, or `all` for every task. */
export type StatusFilter = 'all' | TaskStatus

const STATUS_FILTERS: readonly StatusFilter[] = ['all', ...TASK_STATUSES]

/** Reads a status filter from a URL search param, defaulting to `all` for anything else. */
export function parseStatusFilter(value: string | null): StatusFilter {
  return (STATUS_FILTERS as readonly string[]).includes(value ?? '') ? (value as StatusFilter) : 'all'
}

/** Keeps only the tasks matching `filter`, or every task under `all`. */
export function filterByStatus<T extends Pick<Task, 'status'>>(tasks: readonly T[], filter: StatusFilter): T[] {
  return filter === 'all' ? [...tasks] : tasks.filter((task) => task.status === filter)
}

/** Reads a list page's tag filter from a URL search param: `null` when it is absent or empty. */
export function parseTagFilter(value: string | null): string | null {
  return value === null || value === '' ? null : value
}

/** Keeps only the tasks carrying `tag` exactly, or every task when `tag` is `null`. */
export function filterByTag<T extends Pick<Task, 'tags'>>(tasks: readonly T[], tag: string | null): T[] {
  return tag === null ? [...tasks] : tasks.filter((task) => task.tags.includes(tag))
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'doing',
  doing: 'done',
  done: 'postponed',
  postponed: 'todo',
}

/** The status a task moves to when its status control is clicked: todo → doing → done → postponed → todo. */
export function nextStatus(status: TaskStatus): TaskStatus {
  return NEXT_STATUS[status]
}

export type CompletedAtChange = 'set' | 'keep' | 'clear'

/**
 * How completedAt must change when status goes from `from` to `to` (`from` is null when creating a task).
 * 'set' means server time now, 'keep' leaves it as is, 'clear' means null.
 * firestore.rules enforces the same rule (validCompletedAt).
 */
export function completedAtChange(from: TaskStatus | null, to: TaskStatus): CompletedAtChange {
  if (to !== 'done') return 'clear'
  return from === 'done' ? 'keep' : 'set'
}

export function isOpen(task: Pick<Task, 'status'>): boolean {
  return task.status !== 'done'
}

type TaskOrderFields = Pick<Task, 'id' | 'position' | 'createdAt'>

/** Display order for tasks: position, then createdAt, then id, so ties are still deterministic. */
export function compareTasks(a: TaskOrderFields, b: TaskOrderFields): number {
  return (
    a.position - b.position ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}

/** Splits tasks into open ones and done ones, keeping their order. */
export function splitByDone<T extends Pick<Task, 'status'>>(tasks: readonly T[]): { open: T[]; done: T[] } {
  return { open: tasks.filter(isOpen), done: tasks.filter((task) => !isOpen(task)) }
}

/** A list page's ordering of its open tasks: the saved order, or by due date. */
export type TaskOrder = 'saved' | 'due-date'

const TASK_ORDERS: readonly TaskOrder[] = ['saved', 'due-date']

/** Reads a task order from a URL search param, defaulting to `saved` for anything else. */
export function parseTaskOrder(value: string | null): TaskOrder {
  return (TASK_ORDERS as readonly string[]).includes(value ?? '') ? (value as TaskOrder) : 'saved'
}

type DueDateOrderFields = Pick<Task, 'id' | 'position' | 'createdAt' | 'dueDate'>

function compareByDueDate(a: DueDateOrderFields, b: DueDateOrderFields): number {
  if (a.dueDate === null || b.dueDate === null) {
    return a.dueDate === b.dueDate ? compareTasks(a, b) : a.dueDate === null ? 1 : -1
  }
  return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : compareTasks(a, b)
}

/**
 * Orders tasks for display: unchanged under `saved`, or under `due-date`, tasks with a due date first (earliest
 * first), then undated tasks in their saved order. Ties keep their saved order. A view only: never changes position.
 */
export function orderTasks<T extends DueDateOrderFields>(tasks: readonly T[], order: TaskOrder): T[] {
  return order === 'due-date' ? [...tasks].sort(compareByDueDate) : [...tasks]
}

/** The task edit form's fields, as typed. */
export type TaskEditInput = { title: string; notes: string; dueDate: string; assigneeId: string; tags: string[] }

export type TaskEditFields = Pick<Task, 'title' | 'notes' | 'dueDate' | 'assigneeId' | 'tags'>

/** Turns the edit form's input into stored fields: empty notes, due date and assignee become null. */
export function normalizeTaskEdit(input: TaskEditInput): Result<TaskEditFields> {
  const title = requiredText(input.title, LIMITS.taskTitle, 'Title')
  if (!title.ok) return title
  const notes = optionalText(input.notes, LIMITS.taskNotes, 'Notes')
  if (!notes.ok) return notes
  const dueDate = input.dueDate.trim()
  if (dueDate !== '' && !isDateKey(dueDate)) return err('invalid', 'Due date must be a real date.')
  return ok({
    title: title.data,
    notes: notes.data,
    dueDate: dueDate === '' ? null : dueDate,
    assigneeId: input.assigneeId === '' ? null : input.assigneeId,
    tags: input.tags,
  })
}

/** Adding a tag to the edit form's in-progress list: trimmed, deduplicated, capped at LIMITS.taskTags. */
export function addTag(tags: readonly string[], input: string): { tags: string[]; limitReached: boolean } {
  const trimmed = input.trim()
  if (trimmed === '' || tags.includes(trimmed)) return { tags: [...tags], limitReached: false }
  if (tags.length >= LIMITS.taskTags) return { tags: [...tags], limitReached: true }
  return { tags: [...tags, trimmed], limitReached: false }
}

/** Removing a tag from the edit form's in-progress list. */
export function removeTag(tags: readonly string[], tag: string): string[] {
  return tags.filter((existing) => existing !== tag)
}

/** How many open tasks each list has, by list id. Lists without open tasks are left out. */
export function countOpenTasksByList(tasks: readonly Pick<Task, 'listId' | 'status'>[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const task of tasks) {
    if (isOpen(task)) counts[task.listId] = (counts[task.listId] ?? 0) + 1
  }
  return counts
}

/** "1 done task" or "3 done tasks", as the clear-done confirmation and its notice name them. */
export function doneTaskCount(count: number): string {
  return `${count} done ${count === 1 ? 'task' : 'tasks'}`
}

/** The position for a task added at the end of a list. */
export function nextPosition(tasks: readonly Pick<Task, 'position'>[]): number {
  return tasks.reduce((max, task) => Math.max(max, task.position + 1), 0)
}

export type MoveDirection = 'up' | 'down'

/**
 * Moves the task `taskId` to display index `toIndex` within `orderedTasks` (already in display order, such as a
 * group's own filtered or done tasks). Every task keeps the position it already had, just reassigned to the task
 * now at its index, so a task outside this group keeps its place relative to them. Returns the tasks whose
 * position must be written, or `null` when the move would change nothing: an unknown task, or an index clamped
 * back to where it already was (moving past either end of the group).
 */
export function reorderTask<T extends { id: string; position: number }>(
  orderedTasks: readonly T[],
  taskId: string,
  toIndex: number,
): T[] | null {
  const fromIndex = orderedTasks.findIndex((task) => task.id === taskId)
  if (fromIndex === -1) return null
  const clampedTo = Math.max(0, Math.min(toIndex, orderedTasks.length - 1))
  if (clampedTo === fromIndex) return null
  const moved = orderedTasks.find((task) => task.id === taskId)
  if (!moved) return null
  const without = orderedTasks.filter((task) => task.id !== taskId)
  const reordered = [...without.slice(0, clampedTo), moved, ...without.slice(clampedTo)]
  const positions = orderedTasks.map((task) => task.position)
  const changed: T[] = []
  for (const task of reordered) {
    const position = positions.shift()
    if (position !== undefined && task.position !== position) changed.push({ ...task, position })
  }
  return changed.length > 0 ? changed : null
}

/** Moves the task `taskId` one place up or down within `orderedTasks`. Same rules as reorderTask. */
export function moveTaskByDirection<T extends { id: string; position: number }>(
  orderedTasks: readonly T[],
  taskId: string,
  direction: MoveDirection,
): T[] | null {
  const fromIndex = orderedTasks.findIndex((task) => task.id === taskId)
  if (fromIndex === -1) return null
  return reorderTask(orderedTasks, taskId, direction === 'up' ? fromIndex - 1 : fromIndex + 1)
}

/** Whether a task belongs on /today: not done, and overdue or due today. */
export function isDueByToday(task: Pick<Task, 'status' | 'dueDate'>, today: DateKey): boolean {
  const state = dueState(task.dueDate, today)
  return isOpen(task) && (state === 'overdue' || state === 'today')
}

type DueTaskFields = Pick<Task, 'id' | 'listId' | 'status' | 'dueDate' | 'position' | 'createdAt'>

export type DueGroup<T extends DueTaskFields> = { list: Pick<List, 'id' | 'name'>; tasks: T[] }

function compareDueDates(a: Pick<Task, 'dueDate'> | undefined, b: Pick<Task, 'dueDate'> | undefined): number {
  const left = a?.dueDate ?? ''
  const right = b?.dueDate ?? ''
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * The /today page: open tasks that are overdue or due today, grouped by list. Tasks are ordered by due date, then
 * compareTasks; groups by their earliest due date, then list name. Tasks whose list isn't in `lists` are left out.
 */
export function groupDueByToday<T extends DueTaskFields>(
  tasks: readonly T[],
  lists: readonly Pick<List, 'id' | 'name'>[],
  today: DateKey,
): DueGroup<T>[] {
  const dueByList = new Map<string, T[]>()
  for (const task of tasks) {
    if (isDueByToday(task, today)) dueByList.set(task.listId, [...(dueByList.get(task.listId) ?? []), task])
  }
  return lists
    .flatMap((list) => {
      const due = dueByList.get(list.id)
      return due ? [{ list, tasks: due.sort((a, b) => compareDueDates(a, b) || compareTasks(a, b)) }] : []
    })
    .sort(
      (a, b) =>
        compareDueDates(a.tasks[0], b.tasks[0]) ||
        a.list.name.localeCompare(b.list.name, 'en') ||
        (a.list.id < b.list.id ? -1 : a.list.id > b.list.id ? 1 : 0),
    )
}

type SearchableTaskFields = Pick<Task, 'id' | 'listId' | 'title' | 'notes' | 'position' | 'createdAt'>

export type SearchResult<T extends SearchableTaskFields> = { task: T; list: Pick<List, 'id' | 'name'> }

function matchesSearch(task: Pick<Task, 'title' | 'notes'>, query: string): boolean {
  const needle = query.toLowerCase()
  return task.title.toLowerCase().includes(needle) || (task.notes ?? '').toLowerCase().includes(needle)
}

/**
 * Tasks across every list whose title or notes contain `query`, matched case-insensitively as a literal substring.
 * One flat list, ordered by list name then each list's own task order (compareTasks). `query` must already be
 * trimmed and non-empty: a blank query is the caller's "nothing typed" case, not a search with no matches. Tasks
 * whose list isn't in `lists` are left out.
 */
export function searchTasks<T extends SearchableTaskFields>(
  tasks: readonly T[],
  lists: readonly Pick<List, 'id' | 'name'>[],
  query: string,
): SearchResult<T>[] {
  const listsById = new Map(lists.map((list) => [list.id, list]))
  return tasks
    .flatMap((task) => {
      const list = listsById.get(task.listId)
      return list && matchesSearch(task, query) ? [{ task, list }] : []
    })
    .sort((a, b) => a.list.name.localeCompare(b.list.name, 'en') || compareTasks(a.task, b.task))
}
