import type { DateKey } from '../data/types'

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** The local calendar date of `date`, as 'YYYY-MM-DD'. */
export function toDateKey(date: Date): DateKey {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** True for a well-formed 'YYYY-MM-DD' that names a real calendar date. */
export function isDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** The calendar day after `date`: the first of the next month or year when `date` ends one. */
export function nextDay(date: DateKey): DateKey {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  return toDateKey(new Date(year, month - 1, day + 1))
}

export type DueState = 'none' | 'overdue' | 'today' | 'upcoming'

/** Where a due date sits relative to `today`. DateKeys compare correctly as plain strings. */
export function dueState(dueDate: DateKey | null, today: DateKey): DueState {
  if (dueDate === null) return 'none'
  if (dueDate < today) return 'overdue'
  if (dueDate === today) return 'today'
  return 'upcoming'
}
