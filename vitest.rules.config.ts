import { defineConfig } from 'vitest/config'

// Security Rules tests. Run them with `npm run test:rules`, which starts the Firestore emulator around them.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    // All files share one emulator and clear it between tests, so files must not run in parallel.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
})
