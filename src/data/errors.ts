import { FirebaseError } from 'firebase/app'
import { err, ok, type Result } from '../lib/result'

const CONNECTION = "Can't reach the server. Check your connection and try again."
const CANCELLED = 'Sign-in was cancelled.'

const MESSAGES: Record<string, string> = {
  'permission-denied': "You don't have access to that.",
  unavailable: CONNECTION,
  'auth/network-request-failed': CONNECTION,
  'auth/popup-closed-by-user': CANCELLED,
  'auth/cancelled-popup-request': CANCELLED,
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
  'auth/invalid-credential': 'Wrong email or password.',
}

/**
 * Runs a Firebase operation for a write in src/data/. Firebase errors become Result errors with a
 * user-facing message; anything else is a bug and is rethrown to the error boundary.
 */
export async function attempt<T>(operation: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await operation())
  } catch (error) {
    if (!(error instanceof FirebaseError)) throw error
    const message = MESSAGES[error.code]
    if (message) return err(error.code, message)
    console.error(error)
    return err(error.code, 'Something went wrong. Please try again.')
  }
}
