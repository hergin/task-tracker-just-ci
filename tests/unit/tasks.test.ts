import { describe, expect, it } from 'vitest'
import type { Task } from '../../src/data/types'
import {
  addTag,
  compareTasks,
  completedAtChange,
  countOpenTasksByList,
  filterByStatus,
  filterByTag,
  groupComingUp,
  groupDueByToday,
  isComingUp,
  isDueByToday,
  isOpen,
  moveTaskByDirection,
  nextPosition,
  nextStatus,
  normalizeTaskEdit,
  orderTasks,
  parseStatusFilter,
  parseTagFilter,
  parseTaskOrder,
  removeTag,
  reorderTask,
  searchTasks,
  splitByDone,
} from '../../src/lib/tasks'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    listId: 'list-1',
    ownerId: 'user-1',
    title: 'Buy milk',
    notes: null,
    status: 'todo',
    dueDate: null,
    assigneeId: null,
    position: 0,
    createdAt: new Date('2026-01-01T09:00:00Z'),
    completedAt: null,
    tags: [],
    ...overrides,
  }
}

describe('nextStatus', () => {
  it('cycles todo → doing → done → postponed → todo', () => {
    expect(nextStatus('todo')).toBe('doing')
    expect(nextStatus('doing')).toBe('done')
    expect(nextStatus('done')).toBe('postponed')
    expect(nextStatus('postponed')).toBe('todo')
  })
})

describe('completedAtChange', () => {
  it.each([
    [null, 'todo', 'clear'],
    [null, 'done', 'set'],
    ['todo', 'done', 'set'],
    ['doing', 'done', 'set'],
    ['done', 'done', 'keep'],
    ['done', 'todo', 'clear'],
    ['done', 'doing', 'clear'],
    ['todo', 'doing', 'clear'],
    ['done', 'postponed', 'clear'],
    ['postponed', 'done', 'set'],
  ] as const)('%s → %s: %s', (from, to, expected) => {
    expect(completedAtChange(from, to)).toBe(expected)
  })
})

describe('isOpen', () => {
  it('is true for todo and doing, false for done', () => {
    expect(isOpen(task({ status: 'todo' }))).toBe(true)
    expect(isOpen(task({ status: 'doing' }))).toBe(true)
    expect(isOpen(task({ status: 'done' }))).toBe(false)
  })
})

describe('compareTasks', () => {
  it('orders by position first', () => {
    const tasks = [task({ id: 'b', position: 2 }), task({ id: 'a', position: 1 })]
    expect(tasks.sort(compareTasks).map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('breaks position ties by createdAt', () => {
    const later = task({ id: 'later', createdAt: new Date('2026-01-02T00:00:00Z') })
    const earlier = task({ id: 'earlier', createdAt: new Date('2026-01-01T00:00:00Z') })
    expect([later, earlier].sort(compareTasks).map((t) => t.id)).toEqual(['earlier', 'later'])
  })

  it('breaks remaining ties by id, so order never depends on input order', () => {
    const forward = [task({ id: 'x' }), task({ id: 'y' })].sort(compareTasks).map((t) => t.id)
    const backward = [task({ id: 'y' }), task({ id: 'x' })].sort(compareTasks).map((t) => t.id)
    expect(forward).toEqual(['x', 'y'])
    expect(backward).toEqual(['x', 'y'])
  })
})

describe('splitByDone', () => {
  it('separates done tasks from open ones, keeping their order', () => {
    const tasks = [
      task({ id: 'a', status: 'done' }),
      task({ id: 'b', status: 'todo' }),
      task({ id: 'c', status: 'doing' }),
      task({ id: 'd', status: 'done' }),
    ]
    const { open, done } = splitByDone(tasks)
    expect(open.map((t) => t.id)).toEqual(['b', 'c'])
    expect(done.map((t) => t.id)).toEqual(['a', 'd'])
  })
})

describe('parseTaskOrder', () => {
  it.each([
    [null, 'saved'],
    ['', 'saved'],
    ['bogus', 'saved'],
    ['saved', 'saved'],
    ['due-date', 'due-date'],
  ] as const)('%s → %s', (value, expected) => {
    expect(parseTaskOrder(value)).toBe(expected)
  })
})

describe('orderTasks', () => {
  it('leaves tasks unchanged under saved order', () => {
    const tasks = [task({ id: 'b', position: 1 }), task({ id: 'a', position: 0 })]
    expect(orderTasks(tasks, 'saved').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('orders dated tasks first by due date, then undated tasks in their saved order', () => {
    const tasks = [
      task({ id: 'gamma', position: 0, dueDate: null }),
      task({ id: 'beta', position: 1, dueDate: '2026-06-20' }),
      task({ id: 'alpha', position: 2, dueDate: '2026-06-10' }),
      task({ id: 'delta', position: 3, dueDate: null }),
    ]
    expect(orderTasks(tasks, 'due-date').map((t) => t.id)).toEqual(['alpha', 'beta', 'gamma', 'delta'])
  })

  it('keeps the saved order for tasks tied on the same due date', () => {
    const tasks = [
      task({ id: 'a', position: 0, dueDate: '2026-06-10' }),
      task({ id: 'b', position: 1, dueDate: '2026-06-10' }),
    ]
    expect(orderTasks(tasks, 'due-date').map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('parseStatusFilter', () => {
  it.each([
    [null, 'all'],
    ['', 'all'],
    ['bogus', 'all'],
    ['all', 'all'],
    ['todo', 'todo'],
    ['doing', 'doing'],
    ['done', 'done'],
  ] as const)('%s → %s', (value, expected) => {
    expect(parseStatusFilter(value)).toBe(expected)
  })
})

describe('filterByStatus', () => {
  const tasks = [task({ id: 'a', status: 'todo' }), task({ id: 'b', status: 'doing' }), task({ id: 'c', status: 'done' })]

  it('keeps every task under all', () => {
    expect(filterByStatus(tasks, 'all').map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps only the matching status otherwise', () => {
    expect(filterByStatus(tasks, 'doing').map((t) => t.id)).toEqual(['b'])
  })
})

describe('parseTagFilter', () => {
  it.each([
    [null, null],
    ['', null],
    ['urgent', 'urgent'],
  ] as const)('%s → %s', (value, expected) => {
    expect(parseTagFilter(value)).toBe(expected)
  })
})

describe('filterByTag', () => {
  const tasks = [
    task({ id: 'a', tags: ['urgent'] }),
    task({ id: 'b', tags: ['later'] }),
    task({ id: 'c', tags: ['urgent', 'later'] }),
  ]

  it('keeps every task when the filter is null', () => {
    expect(filterByTag(tasks, null).map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps only the tasks carrying that tag exactly', () => {
    expect(filterByTag(tasks, 'urgent').map((t) => t.id)).toEqual(['a', 'c'])
  })

  it('matches nothing for a tag no task carries', () => {
    expect(filterByTag(tasks, 'missing')).toEqual([])
  })
})

describe('normalizeTaskEdit', () => {
  const input = { title: ' Book flights ', notes: '', dueDate: '', assigneeId: '', tags: [] }

  it('trims the title and stores empty optional fields as null', () => {
    expect(normalizeTaskEdit(input)).toEqual({
      ok: true,
      data: { title: 'Book flights', notes: null, dueDate: null, assigneeId: null, tags: [] },
    })
  })

  it('keeps notes, a real due date, an assignee and tags', () => {
    expect(
      normalizeTaskEdit({
        title: 'Book flights',
        notes: ' Window seats ',
        dueDate: '2030-01-15',
        assigneeId: 'e2e-other',
        tags: ['travel', 'urgent'],
      }),
    ).toEqual({
      ok: true,
      data: { title: 'Book flights', notes: 'Window seats', dueDate: '2030-01-15', assigneeId: 'e2e-other', tags: ['travel', 'urgent'] },
    })
  })

  it('requires a title', () => {
    expect(normalizeTaskEdit({ ...input, title: '  ' })).toEqual({
      ok: false,
      error: { code: 'invalid', message: 'Title is required.' },
    })
  })

  it('rejects a due date that is not a real date', () => {
    expect(normalizeTaskEdit({ ...input, dueDate: '2030-02-30' })).toEqual({
      ok: false,
      error: { code: 'invalid', message: 'Due date must be a real date.' },
    })
  })
})

describe('addTag', () => {
  it('adds a trimmed tag to the end of the list', () => {
    expect(addTag(['travel'], '  urgent  ')).toEqual({ tags: ['travel', 'urgent'], limitReached: false })
  })

  it('adds nothing for an empty or blank tag', () => {
    expect(addTag(['travel'], '')).toEqual({ tags: ['travel'], limitReached: false })
    expect(addTag(['travel'], '   ')).toEqual({ tags: ['travel'], limitReached: false })
  })

  it('adds no second copy of a tag already carried, after trimming', () => {
    expect(addTag(['travel'], ' travel ')).toEqual({ tags: ['travel'], limitReached: false })
  })

  it('treats tags differing only in case as distinct', () => {
    expect(addTag(['travel'], 'Travel')).toEqual({ tags: ['travel', 'Travel'], limitReached: false })
  })

  it('refuses an 11th tag and reports the limit', () => {
    const tags = Array.from({ length: 10 }, (_, i) => `tag${i}`)
    expect(addTag(tags, 'one-too-many')).toEqual({ tags, limitReached: true })
  })
})

describe('removeTag', () => {
  it('removes the matching tag, keeping the others in order', () => {
    expect(removeTag(['travel', 'urgent', 'flight'], 'urgent')).toEqual(['travel', 'flight'])
  })

  it('does nothing when the tag is not carried', () => {
    expect(removeTag(['travel'], 'missing')).toEqual(['travel'])
  })
})

describe('countOpenTasksByList', () => {
  it('counts todo and doing tasks per list, and ignores done ones', () => {
    const tasks = [
      task({ listId: 'groceries', status: 'todo' }),
      task({ listId: 'groceries', status: 'doing' }),
      task({ listId: 'groceries', status: 'done' }),
      task({ listId: 'work', status: 'todo' }),
    ]
    expect(countOpenTasksByList(tasks)).toEqual({ groceries: 2, work: 1 })
  })

  it('leaves out lists whose tasks are all done', () => {
    expect(countOpenTasksByList([task({ listId: 'archive', status: 'done' })])).toEqual({})
  })
})

describe('nextPosition', () => {
  it('is 0 for an empty list', () => {
    expect(nextPosition([])).toBe(0)
  })

  it('is one past the highest position, whatever the order', () => {
    expect(nextPosition([{ position: 3 }, { position: 0 }, { position: 7 }])).toBe(8)
  })
})

describe('reorderTask', () => {
  const first = task({ id: 'first', position: 0 })
  const second = task({ id: 'second', position: 1 })
  const third = task({ id: 'third', position: 2 })
  const ordered = [first, second, third]

  it('moves a task to a later index, reassigning the positions in between', () => {
    const changed = reorderTask(ordered, 'first', 1)
    expect(changed).toEqual([
      { ...second, position: 0 },
      { ...first, position: 1 },
    ])
  })

  it('moves a task to an earlier index, matching a drop onto another task', () => {
    // "third" dropped onto "first": third takes first's place, and the tasks in between shift by one.
    const changed = reorderTask(ordered, 'third', 0)
    expect(changed).toEqual([
      { ...third, position: 0 },
      { ...first, position: 1 },
      { ...second, position: 2 },
    ])
  })

  it('returns null when the index is clamped back to where the task already is', () => {
    expect(reorderTask(ordered, 'first', -1)).toBeNull()
    expect(reorderTask(ordered, 'third', 5)).toBeNull()
  })

  it('returns null for a task that is not in the list', () => {
    expect(reorderTask(ordered, 'missing', 1)).toBeNull()
  })

  it('only reassigns the positions already present in the group, leaving a hidden task between them untouched', () => {
    // "atFirst" and "atThird" are the visible group under a status filter; a task at position 1 with a
    // different status sits between them in the full list but never appears here.
    const atFirst = task({ id: 'at-first', position: 0 })
    const atThird = task({ id: 'at-third', position: 2 })
    const changed = reorderTask([atFirst, atThird], 'at-third', 0)
    expect(changed).toEqual([
      { ...atThird, position: 0 },
      { ...atFirst, position: 2 },
    ])
  })
})

describe('moveTaskByDirection', () => {
  const first = task({ id: 'first', position: 0 })
  const second = task({ id: 'second', position: 1 })
  const third = task({ id: 'third', position: 2 })
  const ordered = [first, second, third]

  it('moves a task down one place', () => {
    expect(moveTaskByDirection(ordered, 'first', 'down')).toEqual([
      { ...second, position: 0 },
      { ...first, position: 1 },
    ])
  })

  it('moves a task up one place', () => {
    expect(moveTaskByDirection(ordered, 'third', 'up')).toEqual([
      { ...third, position: 1 },
      { ...second, position: 2 },
    ])
  })

  it('changes nothing for the first task moved up, or the last task moved down', () => {
    expect(moveTaskByDirection(ordered, 'first', 'up')).toBeNull()
    expect(moveTaskByDirection(ordered, 'third', 'down')).toBeNull()
  })

  it('moves the same task again after a move, since the caller passes the updated order', () => {
    const afterFirstMove = [second, first, third]
    expect(moveTaskByDirection(afterFirstMove, 'first', 'down')).toEqual([
      { ...third, position: 0 },
      { ...first, position: 2 },
    ])
  })
})

describe('groupDueByToday', () => {
  const today = '2026-03-10'
  const lists = [
    { id: 'groceries', name: 'Groceries' },
    { id: 'work', name: 'Work' },
    { id: 'home', name: 'Home' },
  ]

  it('keeps only open tasks that are overdue or due today', () => {
    const tasks = [
      task({ id: 'overdue', listId: 'work', dueDate: '2026-03-01' }),
      task({ id: 'today', listId: 'work', dueDate: today, status: 'doing' }),
      task({ id: 'upcoming', listId: 'work', dueDate: '2026-03-11' }),
      task({ id: 'no-date', listId: 'work', dueDate: null }),
      task({ id: 'done', listId: 'work', dueDate: '2026-03-01', status: 'done' }),
    ]
    const groups = groupDueByToday(tasks, lists, today)
    expect(groups.map((group) => group.tasks.map((t) => t.id))).toEqual([['overdue', 'today']])
  })

  it('orders groups by their earliest due date, and tasks by due date, then position', () => {
    const tasks = [
      task({ id: 'milk', listId: 'groceries', dueDate: '2026-03-05', position: 0 }),
      task({ id: 'report', listId: 'work', dueDate: '2026-03-08', position: 0 }),
      task({ id: 'invoices', listId: 'work', dueDate: '2026-03-02', position: 1 }),
      task({ id: 'call', listId: 'work', dueDate: '2026-03-08', position: 2 }),
    ]
    const groups = groupDueByToday(tasks, lists, today)
    expect(groups.map((group) => group.list.name)).toEqual(['Work', 'Groceries'])
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(['invoices', 'report', 'call'])
  })

  it('breaks ties between groups by list name', () => {
    const tasks = [
      task({ id: 'b', listId: 'work', dueDate: today }),
      task({ id: 'a', listId: 'home', dueDate: today }),
    ]
    expect(groupDueByToday(tasks, lists, today).map((group) => group.list.name)).toEqual(['Home', 'Work'])
  })

  it("leaves out tasks whose list no longer exists", () => {
    const tasks = [task({ id: 'orphan', listId: 'deleted-list', dueDate: '2026-03-01' })]
    expect(groupDueByToday(tasks, lists, today)).toEqual([])
  })
})

describe('isDueByToday', () => {
  const today = '2026-03-10'

  it('includes open tasks that are overdue or due today', () => {
    expect(isDueByToday(task({ dueDate: '2026-03-09' }), today)).toBe(true)
    expect(isDueByToday(task({ dueDate: '2026-03-10', status: 'doing' }), today)).toBe(true)
  })

  it('excludes upcoming tasks and tasks without a due date', () => {
    expect(isDueByToday(task({ dueDate: '2026-03-11' }), today)).toBe(false)
    expect(isDueByToday(task({ dueDate: null }), today)).toBe(false)
  })

  it('excludes done tasks, even when overdue', () => {
    expect(isDueByToday(task({ dueDate: '2026-03-01', status: 'done' }), today)).toBe(false)
  })
})

describe('isComingUp', () => {
  const today = '2026-03-10'

  it('includes open tasks due tomorrow through seven days from today', () => {
    expect(isComingUp(task({ dueDate: '2026-03-11' }), today)).toBe(true)
    expect(isComingUp(task({ dueDate: '2026-03-14', status: 'doing' }), today)).toBe(true)
    expect(isComingUp(task({ dueDate: '2026-03-17' }), today)).toBe(true)
  })

  it('excludes tasks due further out, due today, overdue, or without a due date', () => {
    expect(isComingUp(task({ dueDate: '2026-03-18' }), today)).toBe(false)
    expect(isComingUp(task({ dueDate: today }), today)).toBe(false)
    expect(isComingUp(task({ dueDate: '2026-03-09' }), today)).toBe(false)
    expect(isComingUp(task({ dueDate: null }), today)).toBe(false)
  })

  it('excludes done tasks due within the window', () => {
    expect(isComingUp(task({ dueDate: '2026-03-11', status: 'done' }), today)).toBe(false)
  })
})

describe('groupComingUp', () => {
  const today = '2026-03-10'
  const lists = [
    { id: 'groceries', name: 'Groceries' },
    { id: 'work', name: 'Work' },
    { id: 'home', name: 'Home' },
  ]

  it('keeps only the open tasks coming up in the next seven days', () => {
    const tasks = [
      task({ id: 'tomorrow', listId: 'work', dueDate: '2026-03-11' }),
      task({ id: 'far-edge', listId: 'work', dueDate: '2026-03-17', status: 'postponed' }),
      task({ id: 'beyond', listId: 'work', dueDate: '2026-03-18' }),
      task({ id: 'today', listId: 'work', dueDate: today }),
      task({ id: 'overdue', listId: 'work', dueDate: '2026-03-01' }),
      task({ id: 'no-date', listId: 'work', dueDate: null }),
      task({ id: 'done', listId: 'work', dueDate: '2026-03-11', status: 'done' }),
    ]
    const groups = groupComingUp(tasks, lists, today)
    expect(groups.map((group) => group.tasks.map((t) => t.id))).toEqual([['tomorrow', 'far-edge']])
  })

  it('orders groups by their earliest due date, and tasks by due date, then position', () => {
    const tasks = [
      task({ id: 'milk', listId: 'groceries', dueDate: '2026-03-12', position: 0 }),
      task({ id: 'report', listId: 'work', dueDate: '2026-03-15', position: 0 }),
      task({ id: 'invoices', listId: 'work', dueDate: '2026-03-11', position: 1 }),
      task({ id: 'call', listId: 'work', dueDate: '2026-03-15', position: 2 }),
    ]
    const groups = groupComingUp(tasks, lists, today)
    expect(groups.map((group) => group.list.name)).toEqual(['Work', 'Groceries'])
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(['invoices', 'report', 'call'])
  })

  it('leaves out tasks whose list no longer exists', () => {
    const tasks = [task({ id: 'orphan', listId: 'deleted-list', dueDate: '2026-03-11' })]
    expect(groupComingUp(tasks, lists, today)).toEqual([])
  })
})

describe('searchTasks', () => {
  const lists = [
    { id: 'groceries', name: 'Groceries' },
    { id: 'work', name: 'Work' },
  ]

  it('matches the title case-insensitively as a substring', () => {
    const tasks = [task({ id: 'invoices', listId: 'work', title: 'Send invoices' })]
    expect(searchTasks(tasks, lists, 'INVOICES').map((r) => r.task.id)).toEqual(['invoices'])
  })

  it("matches the notes, case-insensitively, when the title doesn't match", () => {
    const tasks = [
      task({ id: 'report', listId: 'work', title: 'Write quarterly report', notes: 'Include the Q4 numbers.' }),
    ]
    expect(searchTasks(tasks, lists, 'q4 numbers').map((r) => r.task.id)).toEqual(['report'])
  })

  it('matches literally, with no special meaning for regex characters', () => {
    const tasks = [task({ id: 'a', listId: 'work', title: 'Numbers.', notes: null })]
    expect(searchTasks(tasks, lists, 'numbers.').map((r) => r.task.id)).toEqual(['a'])
    expect(searchTasks(tasks, lists, 'numbers!')).toEqual([])
  })

  it('finds a task with no notes by its title alone', () => {
    const tasks = [task({ id: 'a', listId: 'work', title: 'Buy milk', notes: null })]
    expect(searchTasks(tasks, lists, 'milk').map((r) => r.task.id)).toEqual(['a'])
  })

  it('includes done tasks like any other', () => {
    const tasks = [task({ id: 'a', listId: 'work', title: 'Buy eggs', status: 'done' })]
    expect(searchTasks(tasks, lists, 'eggs').map((r) => r.task.id)).toEqual(['a'])
  })

  it('orders results by list name, then by each list\'s own task order', () => {
    const tasks = [
      task({ id: 'w1', listId: 'work', title: 'Report one', position: 1 }),
      task({ id: 'w0', listId: 'work', title: 'Report zero', position: 0 }),
      task({ id: 'g0', listId: 'groceries', title: 'Report groceries', position: 0 }),
    ]
    expect(searchTasks(tasks, lists, 'report').map((r) => r.task.id)).toEqual(['g0', 'w0', 'w1'])
  })

  it('leaves out tasks whose list no longer exists', () => {
    const tasks = [task({ id: 'orphan', listId: 'deleted-list', title: 'Orphan task' })]
    expect(searchTasks(tasks, lists, 'orphan')).toEqual([])
  })

  it('finds nothing for a query that matches nothing', () => {
    const tasks = [task({ id: 'a', title: 'Buy milk' })]
    expect(searchTasks(tasks, lists, 'zzz')).toEqual([])
  })
})
