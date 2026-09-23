import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Project CLIs, run with Node directly: no shell, so arguments never need quoting, on any OS.
const BINARIES = {
  firebase: join('node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js'),
  vite: join('node_modules', 'vite', 'bin', 'vite.js'),
}

// The Firebase CLI prefers a personal `firebase login` over GOOGLE_APPLICATION_CREDENTIALS. Pointing it at an
// empty config directory hides any personal login, so scripts always act as the service account they were
// given — locally as in CI — and the emulators always run the same way.
const TOOL_ENV: Record<Tool, Record<string, string>> = {
  firebase: { XDG_CONFIG_HOME: join(tmpdir(), 'seed-app-firebase-cli') },
  vite: {},
}

type Tool = keyof typeof BINARIES

/** Runs a CLI with its output streaming to the console. Throws if it fails. */
export function run(tool: Tool, args: string[], env: Record<string, string> = {}): void {
  const result = spawnSync(process.execPath, [BINARIES[tool], ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...TOOL_ENV[tool], ...env },
  })
  if (result.status !== 0) throw new Error(`${tool} ${args[0]} failed (exit code ${result.status})`)
}

/** Runs a CLI with its output streaming to the console, and returns its exit code instead of throwing. */
export function runForExitCode(tool: Tool, args: string[], env: NodeJS.ProcessEnv = process.env): number {
  const result = spawnSync(process.execPath, [BINARIES[tool], ...args], {
    stdio: 'inherit',
    env: { ...env, ...TOOL_ENV[tool] },
  })
  return result.status ?? 1
}

/** Runs a CLI and captures its output instead of printing it, for commands called with --json. */
export function runCapture(tool: Tool, args: string[]): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, [BINARIES[tool], ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: { ...process.env, ...TOOL_ENV[tool] },
  })
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}`.trim() }
}
