// Settings for acceptance tests, from the environment. Documented in .env.example.

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'

/**
 * How long an assertion waits by default. A deployment's database now and then pauses for 10–15 s, even for a page's first
 * read, so against a deployment (BASE_URL set, as for e2ePassword) it is 20 s (#93). On the local emulators it stays 10 s,
 * so a test waiting for UI that doesn't exist yet fails fast.
 */
export const DEFAULT_WAIT_MS = process.env.BASE_URL ? 20_000 : 10_000

/**
 * How long one action (a click, a fill, a check) waits for its element. Without it an action waits for the whole test's
 * time, so a test clicking UI that doesn't exist yet would run out the test timeout. Against a
 * deployment it is as long as a wait for the server's confirmation, since a control may stay disabled until then.
 */
export const ACTION_WAIT_MS = process.env.BASE_URL ? 30_000 : 10_000

/**
 * How long a whole test may take. The helpers wait up to 30 s for the server to confirm one write (SERVER_CONFIRMED), and a
 * test makes several: with Playwright's default of 30 s for the test, a single slow confirmation on a pull request's new
 * database ran the whole test out of time, and the retry's pass failed the run as flaky (#121). Against a deployment a
 * test gets time for its slowest wait and the rest of its steps.
 */
export const TEST_TIMEOUT_MS = process.env.BASE_URL ? 120_000 : 30_000

/** Where the setup project saves the signed-in session that every test starts from. */
export const STORAGE_STATE = 'tests/acceptance/.auth/e2e-owner.json'

/** The seeded test account (see the fixture in CLAUDE.md). */
export const E2E_EMAIL = 'e2e-owner@e2e.test'

/** On the local emulators the password is always local-e2e-password; against a deployment it comes from E2E_PASSWORD. */
export function e2ePassword(): string {
  if (!process.env.BASE_URL) return 'local-e2e-password'
  if (!process.env.E2E_PASSWORD) throw new Error('Set E2E_PASSWORD when BASE_URL points at a deployment.')
  return process.env.E2E_PASSWORD
}
