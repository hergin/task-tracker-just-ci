import { readFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { GoogleAuth } from 'google-auth-library'

type IndexFile = {
  indexes: { collectionGroup: string }[]
  fieldOverrides: { collectionGroup: string; fieldPath: string }[]
}

type ApiIndex = { name?: string; queryScope?: string; state?: string }

/**
 * Waits until every index in firestore.indexes.json is READY in the given database. A database builds its
 * indexes in the background, and queries that need them fail until then — as "That index is not ready yet",
 * which looks like a broken deployment rather than one that is still settling.
 */
export async function waitForIndexes(projectId: string, databaseId: string, timeoutMs = 10 * 60_000): Promise<void> {
  const spec = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as IndexFile
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
  const client = await auth.getClient()
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}`
  const started = Date.now()
  let explained = false

  for (;;) {
    const pending: string[] = []

    if (spec.indexes.length > 0) {
      const { data } = await client.request<{ indexes?: ApiIndex[] }>({ url: `${base}/collectionGroups/-/indexes` })
      const found = data.indexes ?? []
      if (found.length < spec.indexes.length) pending.push(`${spec.indexes.length - found.length} composite index(es) not created yet`)
      for (const index of found) {
        if (index.state !== 'READY') pending.push(`${index.name} (${index.state})`)
      }
    }

    for (const { collectionGroup, fieldPath } of spec.fieldOverrides) {
      const { data } = await client.request<{ indexConfig?: { indexes?: ApiIndex[] } }>({
        url: `${base}/collectionGroups/${collectionGroup}/fields/${fieldPath}`,
      })
      const indexes = data.indexConfig?.indexes ?? []
      if (indexes.length === 0) pending.push(`${collectionGroup}.${fieldPath} (not created yet)`)
      for (const index of indexes) {
        if (index.state !== 'READY') pending.push(`${collectionGroup}.${fieldPath} ${index.queryScope} (${index.state})`)
      }
    }

    const elapsed = Date.now() - started
    if (pending.length === 0) {
      console.log(`Indexes ready after ${duration(elapsed)}.`)
      return
    }
    if (elapsed > timeoutMs) throw new Error(`Indexes still not ready after ${duration(elapsed)}: ${pending.join(', ')}`)
    if (!explained) {
      console.log('A database builds its indexes in the background. This usually takes 3 to 5 minutes.')
      explained = true
    }
    console.log(`Still building (${duration(elapsed)} of up to ${duration(timeoutMs)}): ${pending.join(', ')}`)
    await sleep(15_000)
  }
}

function duration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}
