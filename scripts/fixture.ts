import type { List, Task, UserProfile } from '../src/data/types.ts'

// The deterministic seed fixture: fixed ids, fixed timestamps, no randomness, no dates relative to now.
// Documented as a table in CLAUDE.md. Acceptance tests rely on it, so change it deliberately.

/** The test account that the test sign-in form uses. */
export const E2E_OWNER = { uid: 'e2e-owner', email: 'e2e-owner@e2e.test', name: 'E2E Owner' } as const

/** The test account's password on the local emulators, when E2E_PASSWORD is not set. */
export const LOCAL_E2E_PASSWORD = 'local-e2e-password'

const at = (iso: string) => new Date(iso)

export const users: UserProfile[] = [
  { id: 'e2e-owner', name: 'E2E Owner', image: null, createdAt: at('2026-01-01T09:00:00Z') },
  { id: 'e2e-other', name: 'E2E Other', image: null, createdAt: at('2026-01-01T09:00:00Z') },
]

export const lists: List[] = [
  { id: 'list-groceries', name: 'Groceries', ownerId: 'e2e-owner', createdAt: at('2026-01-01T10:00:00Z'), shared: false },
  { id: 'list-work', name: 'Work', ownerId: 'e2e-owner', createdAt: at('2026-01-01T10:01:00Z'), shared: false },
  { id: 'list-empty', name: 'Empty list', ownerId: 'e2e-owner', createdAt: at('2026-01-01T10:02:00Z'), shared: false },
  {
    id: 'list-other-private',
    name: 'Private list of another user',
    ownerId: 'e2e-other',
    createdAt: at('2026-01-01T10:03:00Z'),
    shared: false,
  },
]

type TaskFields = Pick<Task, 'id' | 'listId' | 'ownerId' | 'title' | 'position'> & Partial<Task>

function task(fields: TaskFields): Task {
  return {
    notes: null,
    status: 'todo',
    dueDate: null,
    assigneeId: null,
    createdAt: at('2026-01-01T11:00:00Z'),
    completedAt: null,
    tags: [],
    ...fields,
  }
}

export const tasks: Task[] = [
  task({ id: 'task-milk', listId: 'list-groceries', ownerId: 'e2e-owner', title: 'Buy milk', position: 0, dueDate: '2026-01-12' }),
  task({ id: 'task-bread', listId: 'list-groceries', ownerId: 'e2e-owner', title: 'Buy bread', position: 1, status: 'doing' }),
  task({
    id: 'task-eggs',
    listId: 'list-groceries',
    ownerId: 'e2e-owner',
    title: 'Buy eggs',
    position: 2,
    status: 'done',
    completedAt: at('2026-01-02T08:00:00Z'),
  }),
  task({
    id: 'task-invoices',
    listId: 'list-work',
    ownerId: 'e2e-owner',
    title: 'Send invoices',
    position: 0,
    status: 'doing',
    dueDate: '2026-01-10',
  }),
  task({
    id: 'task-report',
    listId: 'list-work',
    ownerId: 'e2e-owner',
    title: 'Write quarterly report',
    position: 1,
    notes: 'Include the Q4 numbers.',
    dueDate: '2026-01-15',
    assigneeId: 'e2e-other',
  }),
  task({
    id: 'task-archive',
    listId: 'list-work',
    ownerId: 'e2e-owner',
    title: 'Archive old files',
    position: 2,
    status: 'done',
    dueDate: '2026-01-05',
    completedAt: at('2026-01-05T16:00:00Z'),
  }),
  task({ id: 'task-plan', listId: 'list-work', ownerId: 'e2e-owner', title: 'Plan next year', position: 3 }),
  task({
    id: 'task-private',
    listId: 'list-other-private',
    ownerId: 'e2e-other',
    title: 'Private task of another user',
    position: 0,
  }),
]
