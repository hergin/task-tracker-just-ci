import { LIMITS } from '../data/types'

type AuthAccount = {
  displayName: string | null
  email: string | null
  photoURL: string | null
}

/** The public profile stored in users/{uid}, derived from a Firebase Auth account. Always satisfies the rules' limits. */
export function profileFromAuthUser(account: AuthAccount): { name: string; image: string | null } {
  const name =
    account.displayName?.trim() || account.email?.split('@')[0]?.trim() || 'Unnamed user'
  const image = account.photoURL && account.photoURL.length <= LIMITS.userImage ? account.photoURL : null
  return { name: name.slice(0, LIMITS.userName), image }
}
