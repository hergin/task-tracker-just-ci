import { parseArgs } from 'node:util'
import { E2E_OWNER, lists, tasks, users } from './fixture.ts'
import { seedDatabase } from './lib/seed.ts'
import { resolveSeedProject } from './lib/targets.ts'

// Resets the running local emulators to exactly the fixture in scripts/fixture.ts: npm run seed

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
  },
})

const projectId = resolveSeedProject({ project: values.project, emulatorProject: process.env.GCLOUD_PROJECT })

await seedDatabase(projectId)

console.log(`Seeded ${projectId} (emulators): ${users.length} users, ${lists.length} lists, ${tasks.length} tasks. Test account: ${E2E_OWNER.email}`)
