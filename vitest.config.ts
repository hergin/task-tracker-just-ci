import { defineConfig } from 'vitest/config'

// Unit tests only: pure logic, no network, no emulator, no DOM.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
