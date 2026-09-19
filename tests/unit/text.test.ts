import { describe, expect, it } from 'vitest'
import { optionalText, requiredText } from '../../src/lib/text'

describe('requiredText', () => {
  it('returns the trimmed value', () => {
    expect(requiredText('  Groceries  ', 200, 'List name')).toEqual({ ok: true, data: 'Groceries' })
  })

  it('rejects empty or whitespace-only input, naming the field', () => {
    expect(requiredText('   ', 200, 'List name')).toEqual({
      ok: false,
      error: { code: 'invalid', message: 'List name is required.' },
    })
  })

  it('rejects input longer than the limit after trimming', () => {
    expect(requiredText(' abcd ', 4, 'Title')).toEqual({ ok: true, data: 'abcd' })
    expect(requiredText('abcde', 4, 'Title')).toEqual({
      ok: false,
      error: { code: 'invalid', message: 'Title must be 4 characters or fewer.' },
    })
  })
})

describe('optionalText', () => {
  it('turns empty or whitespace-only input into null', () => {
    expect(optionalText('   ', 10, 'Notes')).toEqual({ ok: true, data: null })
  })

  it('returns the trimmed value', () => {
    expect(optionalText('  Window seat  ', 20, 'Notes')).toEqual({ ok: true, data: 'Window seat' })
  })

  it('rejects input longer than the limit', () => {
    expect(optionalText('abcde', 4, 'Notes')).toEqual({
      ok: false,
      error: { code: 'invalid', message: 'Notes must be 4 characters or fewer.' },
    })
  })
})
