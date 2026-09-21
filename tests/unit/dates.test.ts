import { describe, expect, it } from 'vitest'
import { dueState, isDateKey, nextDay, toDateKey } from '../../src/lib/dates'

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

describe('nextDay', () => {
  it('gives the day after, over the end of a month, of a year and of February in a leap and a common year', () => {
    expect(nextDay('2026-09-21')).toBe('2026-09-22')
    expect(nextDay('2026-01-31')).toBe('2026-02-01')
    expect(nextDay('2026-12-31')).toBe('2027-01-01')
    expect(nextDay('2028-02-28')).toBe('2028-02-29')
    expect(nextDay('2027-02-28')).toBe('2027-03-01')
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
