// The domain model. Firestore stores optional fields as null, never omitted.
// Field limits are mirrored in firestore.rules: change both together.

export const TASK_STATUSES = ['todo', 'doing', 'done', 'postponed'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

/** A calendar date, 'YYYY-MM-DD', with no time zone. */
export type DateKey = string

export const LIMITS = {
  userName: 200,
  userImage: 2000,
  listName: 200,
  taskTitle: 500,
  taskNotes: 5000,
  tagText: 50,
  taskTags: 10,
  subtaskTitle: 500,
} as const

/** users/{id}: public profile, readable by every signed-in user. Email stays in Firebase Auth. */
export type UserProfile = {
  id: string
  name: string
  image: string | null
  createdAt: Date
}

/** lists/{id} */
export type List = {
  id: string
  name: string
  ownerId: string
  createdAt: Date
  /** Whether the owner has turned on the read-only share link for this list. Always present. */
  shared: boolean
}

/** lists/{listId}/tasks/{id}. ownerId repeats the list's owner, for collection-group queries and rules. */
export type Task = {
  id: string
  listId: string
  ownerId: string
  title: string
  notes: string | null
  status: TaskStatus
  dueDate: DateKey | null
  assigneeId: string | null
  position: number
  createdAt: Date
  completedAt: Date | null
  /** Free-text labels, in the order they were added. Always present, empty for a task with no tags. */
  tags: string[]
}

/** lists/{listId}/tasks/{taskId}/subtasks/{id}. ownerId repeats the task's owner, the same way a task repeats its list's. */
export type Subtask = {
  id: string
  listId: string
  taskId: string
  ownerId: string
  title: string
  done: boolean
  position: number
  createdAt: Date
}
