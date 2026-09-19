import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Project CLIs, run with Node directly: no shell, so arguments never need quoting, on any OS.
const BINARIES = {
  firebase: join('node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js'),
}

// Pointing the Firebase CLI at an empty config directory hides any personal `firebase login`, so the emulators
// always run the same way, locally as in CI.
const TOOL_ENV: Record<Tool, Record<string, string>> = {
  firebase: { XDG_CONFIG_HOME: join(tmpdir(), 'seed-app-firebase-cli') },
}

type Tool = keyof typeof BINARIES

/** Runs a CLI with its output streaming to the console, and returns its exit code instead of throwing. */
export function runForExitCode(tool: Tool, args: string[], env: NodeJS.ProcessEnv = process.env): number {
  const result = spawnSync(process.execPath, [BINARIES[tool], ...args], {
    stdio: 'inherit',
    env: { ...env, ...TOOL_ENV[tool] },
  })
  return result.status ?? 1
}
