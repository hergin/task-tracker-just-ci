import type { ResultError } from '../lib/result'

/** Renders an expected failure inline, next to the control that caused it. */
export function FormError({ error }: { error: ResultError | null }) {
  if (!error) return null
  return (
    <p role="alert" className="mt-2 text-sm text-red-700">
      {error.message}
    </p>
  )
}
