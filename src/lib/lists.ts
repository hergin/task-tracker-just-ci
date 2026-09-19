import type { List } from '../data/types'

type ListOrderFields = Pick<List, 'id' | 'createdAt'>

/** Display order for lists: oldest first, then id, so ties are still deterministic. */
export function compareLists(a: ListOrderFields, b: ListOrderFields): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}
