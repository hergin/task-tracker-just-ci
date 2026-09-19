// A pure check that keeps the seed script away from anything except the local emulators.

type SeedTargetInput = {
  /** --project */
  project?: string
  /** GCLOUD_PROJECT, set by `firebase emulators:exec` */
  emulatorProject?: string
}

/** The emulator project the seed script may write to, or throws. Only demo-* projects, which exist only in the emulators. */
export function resolveSeedProject({ project, emulatorProject }: SeedTargetInput): string {
  const projectId = project ?? emulatorProject ?? 'demo-seed-app'
  if (!projectId.startsWith('demo-')) {
    throw new Error(`Refusing to seed project "${projectId}": only demo-* emulator projects can be seeded.`)
  }
  return projectId
}
