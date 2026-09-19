import { createServer } from 'node:net'
import { runForExitCode } from './lib/run.ts'

// npm run test:e2e:local — the whole acceptance suite with one command, starting from nothing running: starts the
// Auth and Firestore emulators, seeds them, lets Playwright start the dev server, runs the tests, and stops everything.
// Needs Java and Playwright's Chromium (npx playwright install chromium). Extra arguments go to Playwright:
//   npm run test:e2e:local -- tests/acceptance/lists.spec.ts

const PORTS: Record<string, number> = { 'Firestore emulator': 8080, 'Auth emulator': 9099, 'dev server': 5173 }

for (const [name, port] of Object.entries(PORTS)) {
  if (!(await isFree(port))) {
    throw new Error(`Port ${port} (${name}) is in use. Stop your running emulators and dev server first.`)
  }
}

const playwrightArgs = process.argv
  .slice(2)
  .map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))
  .join(' ')

// E2E_START_DEV_SERVER makes playwright.config.ts start the dev server; without BASE_URL the tests use it.
const env: NodeJS.ProcessEnv = { ...process.env, E2E_START_DEV_SERVER: '1' }
delete env.BASE_URL

process.exitCode = runForExitCode(
  'firebase',
  ['emulators:exec', '--only', 'auth,firestore', '--project', 'demo-seed-app', `npm run seed && npx playwright test ${playwrightArgs}`.trim()],
  env,
)

function isFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '127.0.0.1')
  })
}
