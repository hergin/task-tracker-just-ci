import { err, ok, type Result } from './result'

/** Trims user input and checks it is present and at most `max` characters. `label` names the field in the message. */
export function requiredText(input: string, max: number, label: string): Result<string> {
  const value = input.trim()
  if (value.length === 0) return err('invalid', `${label} is required.`)
  if (value.length > max) return err('invalid', `${label} must be ${max} characters or fewer.`)
  return ok(value)
}

/** Trims optional user input: empty becomes null; otherwise it must be at most `max` characters. */
export function optionalText(input: string, max: number, label: string): Result<string | null> {
  const value = input.trim()
  if (value.length === 0) return ok(null)
  if (value.length > max) return err('invalid', `${label} must be ${max} characters or fewer.`)
  return ok(value)
}
