import { describe, expect, it } from 'vitest'
import type { Subtask } from '../../src/data/types'
import { compareSubtasks, nextSubtaskPosition, subtaskProgress } from '../../src/lib/subtasks'

function subtask(overrides: Partial<Subtask> = {}): Subtask {
  return {
    id: 'subtask-1',
    listId: 'list-1',
    taskId: 'task-1',
    ownerId: 'user-1',
    title: 'Chop vegetables',
    done: false,
    position: 0,
    createdAt: new Date('2026-01-01T09:00:00Z'),
    ...overrides,
  }
}

describe('compareSubtasks', () => {
  it('orders by position first', () => {
    const subtasks = [subtask({ id: 'b', position: 2 }), subtask({ id: 'a', position: 1 })]
    expect(subtasks.sort(compareSubtasks).map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('breaks position ties by createdAt', () => {
    const later = subtask({ id: 'later', createdAt: new Date('2026-01-02T00:00:00Z') })
    const earlier = subtask({ id: 'earlier', createdAt: new Date('2026-01-01T00:00:00Z') })
    expect([later, earlier].sort(compareSubtasks).map((s) => s.id)).toEqual(['earlier', 'later'])
  })

  it('breaks remaining ties by id, so order never depends on input order', () => {
    const forward = [subtask({ id: 'x' }), subtask({ id: 'y' })].sort(compareSubtasks).map((s) => s.id)
    const backward = [subtask({ id: 'y' }), subtask({ id: 'x' })].sort(compareSubtasks).map((s) => s.id)
    expect(forward).toEqual(['x', 'y'])
    expect(backward).toEqual(['x', 'y'])
  })
})

describe('nextSubtaskPosition', () => {
  it('is 0 for an empty checklist', () => {
    expect(nextSubtaskPosition([])).toBe(0)
  })

  it('is one past the highest position, whatever the order', () => {
    expect(nextSubtaskPosition([{ position: 3 }, { position: 0 }, { position: 7 }])).toBe(8)
  })
})

describe('subtaskProgress', () => {
  it('is null for a task with no subtasks', () => {
    expect(subtaskProgress([])).toBeNull()
  })

  it('counts how many are done out of the total', () => {
    expect(subtaskProgress([{ done: true }, { done: false }, { done: true }])).toEqual({ done: 2, total: 3 })
  })

  it('is 0 of total when none are done', () => {
    expect(subtaskProgress([{ done: false }, { done: false }])).toEqual({ done: 0, total: 2 })
  })

  it('is total of total when all are done', () => {
    expect(subtaskProgress([{ done: true }, { done: true }])).toEqual({ done: 2, total: 2 })
  })
})
