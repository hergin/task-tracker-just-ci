// Pure checks that keep a production deploy away from staging and free of test sign-in.

/** Strings that only the test sign-in form (src/e2e/) puts into a build. */
export const TEST_SIGN_IN_MARKERS = ['data-e2e-login', 'Test sign-in', 'e2e-owner@e2e.test'] as const

/** The build files that contain test sign-in code, with the markers found in each. A production build must have none. */
export function findTestSignIn(files: readonly { path: string; content: string }[]): { path: string; markers: string[] }[] {
  return files
    .map((file) => ({ path: file.path, markers: TEST_SIGN_IN_MARKERS.filter((marker) => file.content.includes(marker)) }))
    .filter((file) => file.markers.length > 0)
}

type ProductionTarget = {
  /** FIREBASE_PROJECT_ID_PROD */
  projectId: string | undefined
  /** FIREBASE_PROJECT_ID_STAGING, when set */
  stagingProjectId: string | undefined
  /** VITE_E2E_LOGIN from the environment */
  e2eLogin: string | undefined
}

/** Throws unless a production deploy targets a real, non-staging project with test sign-in switched off. */
export function assertProductionTarget({ projectId, stagingProjectId, e2eLogin }: ProductionTarget): string {
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID_PROD is not set.')
  if (stagingProjectId && projectId === stagingProjectId) {
    throw new Error(`Refusing to deploy production to the staging project "${projectId}".`)
  }
  if (e2eLogin === 'true') {
    throw new Error('VITE_E2E_LOGIN is "true". Production builds must never include test sign-in.')
  }
  return projectId
}
