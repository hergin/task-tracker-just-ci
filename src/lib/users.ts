import type { UserProfile } from '../data/types'

type UserOrderFields = Pick<UserProfile, 'id' | 'name'>

/** Display order for users: by name, then id, so ties are still deterministic. */
export function compareUsers(a: UserOrderFields, b: UserOrderFields): number {
  return a.name.localeCompare(b.name, 'en') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}
