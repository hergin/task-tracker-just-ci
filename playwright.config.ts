import { defineConfig, devices } from '@playwright/test'
import { ACTION_WAIT_MS, BASE_URL, DEFAULT_WAIT_MS, STORAGE_STATE, TEST_TIMEOUT_MS } from './tests/acceptance/support/env'

// Acceptance tests drive the UI of a running app: the local dev server by default, or a deployment via BASE_URL.
// Only `npm run test:e2e:local` sets E2E_START_DEV_SERVER, which makes Playwright start (and stop) the dev server
// against the emulators that command started. Otherwise nothing here starts a server.
export default defineConfig({
  testDir: 'tests/acceptance',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // In CI a failed test is retried once to capture a trace, but a test that only passes on retry still fails the run.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  // A whole test: 30 s locally, 120 s against a deployment, so one slow confirmation can't run a test out of time (#121).
  timeout: TEST_TIMEOUT_MS,
  // 10 s locally, 20 s against a deployment, whose database now and then pauses (DEFAULT_WAIT_MS).
  expect: { timeout: DEFAULT_WAIT_MS },
  use: {
    baseURL: BASE_URL,
    // One action: 10 s locally, 30 s against a deployment (ACTION_WAIT_MS), not the rest of the test's time.
    actionTimeout: ACTION_WAIT_MS,
    timezoneId: 'UTC',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_START_DEV_SERVER
    ? {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
})
