import { describe, expect, it } from 'vitest'
import { addDays, dueState, isDateKey, toDateKey } from '../../src/lib/dates'

describe('toDateKey', () => {
  it('uses the local calendar date, even late in the day', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('zero-pads month and day', () => {
    expect(toDateKey(new Date(2026, 2, 7))).toBe('2026-03-07')
  })
})

describe('isDateKey', () => {
  it.each(['2026-02-28', '2028-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isDateKey(value)).toBe(true)
  })

  it.each(['2026-02-30', '2027-02-29', '2026-13-01', '2026-1-5', 'tomorrow', ''])('rejects %j', (value) => {
    expect(isDateKey(value)).toBe(false)
  })
})

describe('addDays', () => {
  it('counts days forward', () => {
    expect(addDays('2026-03-10', 7)).toBe('2026-03-17')
  })

  it('crosses a month and a year', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
    expect(addDays('2026-12-30', 7)).toBe('2027-01-06')
  })

  it('crosses a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('leaves the date as it is for no days', () => {
    expect(addDays('2026-03-10', 0)).toBe('2026-03-10')
  })
})

describe('dueState', () => {
  const today = '2026-03-10'

  it.each([
    [null, 'none'],
    ['2026-03-09', 'overdue'],
    ['2025-12-31', 'overdue'],
    ['2026-03-10', 'today'],
    ['2026-03-11', 'upcoming'],
    ['2027-01-01', 'upcoming'],
  ] as const)('due %j is %s', (dueDate, expected) => {
    expect(dueState(dueDate, today)).toBe(expected)
  })
})
