import { useState } from 'react'
import type { Result, ResultError } from '../lib/result'

/**
 * The one way components call a write from src/data/. `error` holds the last expected failure,
 * for rendering inline with <FormError>; it clears when the action runs again, or on reset().
 */
export function useAction<Args extends unknown[], T>(action: (...args: Args) => Promise<Result<T>>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ResultError | null>(null)

  async function run(...args: Args): Promise<Result<T>> {
    setPending(true)
    setError(null)
    try {
      const result = await action(...args)
      if (!result.ok) setError(result.error)
      return result
    } finally {
      setPending(false)
    }
  }

  return { run, pending, error, reset: () => setError(null) }
}
