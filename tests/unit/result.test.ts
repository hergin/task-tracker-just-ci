import { describe, expect, it } from 'vitest'
import { err, ok } from '../../src/lib/result'

describe('Result', () => {
  it('ok wraps data', () => {
    expect(ok(42)).toEqual({ ok: true, data: 42 })
  })

  it('ok without data represents a successful void operation', () => {
    expect(ok()).toEqual({ ok: true, data: undefined })
  })

  it('err carries a code and a user-facing message', () => {
    expect(err('not-found', 'List not found')).toEqual({
      ok: false,
      error: { code: 'not-found', message: 'List not found' },
    })
  })
})
