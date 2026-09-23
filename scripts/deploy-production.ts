import { appendFileSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { waitForIndexes } from './lib/indexes.ts'
import { assertProductionTarget, findTestSignIn } from './lib/production.ts'
import { run } from './lib/run.ts'

// Deploys the current code to production. Run by .github/workflows/deploy-production.yml on every push to main.
//
//   1. build with the production config and test sign-in off
//   2. fail if the build contains any test sign-in code
//   3. deploy Security Rules and indexes to the default database, and wait for the indexes
//   4. deploy Hosting live
//
// Building and checking come first, so a bad build never touches production.

const projectId = assertProductionTarget({
  projectId: process.env.FIREBASE_PROJECT_ID_PROD,
  stagingProjectId: process.env.FIREBASE_PROJECT_ID_STAGING,
  e2eLogin: process.env.VITE_E2E_LOGIN,
})
const webConfig = requireEnv('FIREBASE_WEB_CONFIG_PROD')
requireEnv('GOOGLE_APPLICATION_CREDENTIALS')
const target = ['--project', projectId, '--non-interactive']

step('Build')
run('vite', ['build'], {
  VITE_FIREBASE_CONFIG: webConfig,
  VITE_FIRESTORE_DATABASE_ID: '(default)',
  VITE_USE_EMULATORS: 'false',
  VITE_E2E_LOGIN: 'false',
})

// The flag above says the form was left out; this says so about the thing being shipped. A build is what
// reaches people, and a switch that silently stopped working would not show up anywhere else.
step('Check the build for test sign-in')
const found = findTestSignIn(buildFiles('dist'))
if (found.length > 0) {
  throw new Error(`The production build contains test sign-in code: ${found.map((file) => `${file.path} (${file.markers.join(', ')})`).join('; ')}`)
}
console.log('None found.')

step('Security Rules and indexes')
run('firebase', ['deploy', '--only', 'firestore', ...target])

step('Indexes')
await waitForIndexes(projectId, '(default)')

step('Hosting (live)')
const commit = process.env.GITHUB_SHA ? `main at ${process.env.GITHUB_SHA.slice(0, 7)}` : 'manual deploy'
run('firebase', ['deploy', '--only', 'hosting', '--message', commit, ...target])

const url = `https://${projectId}.web.app`
console.log(`\nProduction: ${url}`)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`)

function buildFiles(dir: string): { path: string; content: string }[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(?:js|html)$/.test(entry.name))
    .map((entry) => {
      const path = join(entry.parentPath, entry.name)
      return { path, content: readFileSync(path, 'utf8') }
    })
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set. See "Production" in .env.example.`)
  return value
}

function step(title: string) {
  console.log(`\n=== ${title}`)
}
