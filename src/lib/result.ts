// The one return type for every write in src/data/.
// Expected failures are values, not exceptions: components render `error.message` inline.
export type ResultError = {
  code: string
  message: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ResultError }

export function ok(): Result<void>
export function ok<T>(data: T): Result<T>
export function ok<T>(data?: T): Result<T | undefined> {
  return { ok: true, data }
}

export function err(code: string, message: string): Result<never> {
  return { ok: false, error: { code, message } }
}
