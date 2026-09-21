import type { List } from '../data/types'

type ListOrderFields = Pick<List, 'id' | 'createdAt'>

/** Display order for lists: oldest first, then id, so ties are still deterministic. */
export function compareLists(a: ListOrderFields, b: ListOrderFields): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** The lists a task in `listId` can be moved to: the user's own lists, except the one it is already in. */
export function otherLists<T extends Pick<List, 'id'>>(lists: readonly T[], listId: string): T[] {
  return lists.filter((list) => list.id !== listId)
}
