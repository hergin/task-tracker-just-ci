import { collection, onSnapshot } from 'firebase/firestore'
import { useSubscription, type SubscriptionState } from '../hooks/useSubscription'
import { db } from '../lib/firebase'
import { compareUsers } from '../lib/users'
import { userFromSnapshot } from './converters'
import type { UserProfile } from './types'

/** Every registered user's public profile, by name. The rules let any signed-in user read profiles (for assigning tasks). */
export function useUsers(): SubscriptionState<UserProfile[]> {
  return useSubscription('users', (onData, onError) =>
    onSnapshot(
      collection(db, 'users'),
      (snapshot) => onData(snapshot.docs.map(userFromSnapshot).sort(compareUsers)),
      onError,
    ),
  )
}
