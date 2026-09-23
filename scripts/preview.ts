import { appendFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { run, runCapture } from './lib/run.ts'

// Creates or updates one pull request's preview in the staging project, or deletes it.
//
//   npm run preview:deploy -- --pr 12    builds the app and puts it on Hosting channel pr-12
//   npm run preview:delete -- --pr 12    deletes the channel
//
// One channel per pull request, so two open at once do not overwrite each other's preview. They do share the
// staging project's Firestore data: this is somewhere to look at a change, not somewhere to test against, and
// the acceptance tests run against the emulators on the machine that runs them (npm run test:e2e:local).
//
// Needs the "Preview deployments" variables in .env.example: locally in .env.staging.local, in CI from the
// repository's variables and secrets.

const CHANNEL_EXPIRY = '30d'

const { positionals, values } = parseArgs({ allowPositionals: true, options: { pr: { type: 'string' } } })
const command = positionals[0]
if ((command !== 'deploy' && command !== 'delete') || !values.pr) {
  throw new Error('Usage: tsx scripts/preview.ts deploy|delete --pr <number>')
}

const channelId = `pr-${values.pr}`
const projectId = requireEnv('FIREBASE_PROJECT_ID_STAGING')
// Nothing here is reversible on the wrong project: a channel deploy on production is a public URL of unreviewed
// work, and the delete below would take one away.
if (projectId === process.env.FIREBASE_PROJECT_ID_PROD) throw new Error('The staging and production projects must differ.')
requireEnv('GOOGLE_APPLICATION_CREDENTIALS')
const target = ['--project', projectId, '--non-interactive']

if (command === 'deploy') deploy()
else remove()

function deploy() {
  const webConfig = requireEnv('FIREBASE_WEB_CONFIG_STAGING')

  step('Build')
  // Vite inlines these at build time, so the preview is built with staging's own values. The test sign-in form
  // is included: the preview is not production, and there is no other way in without one.
  run('vite', ['build'], {
    VITE_FIREBASE_CONFIG: webConfig,
    VITE_FIRESTORE_DATABASE_ID: '(default)',
    VITE_USE_EMULATORS: 'false',
    VITE_E2E_LOGIN: 'true',
  })

  step(`Hosting channel ${channelId}`)
  const url = deployChannel()

  console.log(`\nPreview ready: ${url}`)
  // Read by the workflow, which puts it on the pull request as the deployment's URL.
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`)
}

function remove() {
  step(`Hosting channel ${channelId}`)
  const deleted = runCapture('firebase', ['hosting:channel:delete', channelId, '--force', '--json', ...target])
  if (deleted.ok) {
    console.log('Deleted.')
  } else if (/not found|NOT_FOUND|404|does not exist/i.test(deleted.output)) {
    // A channel that expired on its own, or a pull request that never got one: asking twice is asking once.
    console.log('Nothing to delete.')
  } else {
    console.log(deleted.output)
    throw new Error('Delete failed.')
  }
}

function deployChannel(): string {
  const deployed = runCapture('firebase', ['hosting:channel:deploy', channelId, '--expires', CHANNEL_EXPIRY, '--json', ...target])
  if (!deployed.ok) {
    console.log(deployed.output)
    throw new Error(`Could not deploy Hosting channel ${channelId}.`)
  }
  // The CLI prints other things before the JSON, so the object starts at the first brace.
  const json = deployed.output.slice(deployed.output.indexOf('{'))
  const parsed = JSON.parse(json) as { result?: Record<string, { url?: string }> }
  const url = Object.values(parsed.result ?? {})[0]?.url
  if (!url) throw new Error(`Hosting channel ${channelId} deployed, but no URL was returned:\n${deployed.output}`)
  return url
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set. See "Preview deployments" in .env.example.`)
  return value
}

function step(title: string) {
  console.log(`\n=== ${title}`)
}
