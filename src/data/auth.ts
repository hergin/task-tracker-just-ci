import {
  GithubAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { useSyncExternalStore } from 'react'
import { auth, db } from '../lib/firebase'
import { profileFromAuthUser } from '../lib/profile'
import type { Result } from '../lib/result'
import { attempt } from './errors'

export type CurrentUser = { uid: string; name: string; image: string | null }

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: CurrentUser }

type StoreState = AuthState | { status: 'error'; error: unknown }

let current: StoreState = { status: 'loading' }
let started = false
const listeners = new Set<() => void>()

function publish(next: StoreState) {
  current = next
  for (const listener of listeners) listener()
}

/** Creates or refreshes users/{uid} from the auth account. The rules only accept server time for createdAt. */
async function syncProfile(user: User): Promise<CurrentUser> {
  const profile = profileFromAuthUser(user)
  const ref = doc(db, 'users', user.uid)
  const stored = await getDoc(ref)
  if (!stored.exists()) {
    await setDoc(ref, { ...profile, createdAt: serverTimestamp() })
  } else if (stored.get('name') !== profile.name || stored.get('image') !== profile.image) {
    await updateDoc(ref, profile)
  }
  return { uid: user.uid, ...profile }
}

function start() {
  if (started) return
  started = true
  onAuthStateChanged(
    auth,
    (user) => {
      if (!user) {
        publish({ status: 'signed-out' })
        return
      }
      publish({ status: 'loading' })
      syncProfile(user).then(
        (signedIn) => {
          if (auth.currentUser?.uid === signedIn.uid) publish({ status: 'signed-in', user: signedIn })
        },
        (error: unknown) => publish({ status: 'error', error }),
      )
    },
    (error) => publish({ status: 'error', error }),
  )
}

function subscribe(listener: () => void) {
  start()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Who is signed in. Throws to the route error boundary if the session or profile can't be loaded. */
export function useAuthState(): AuthState {
  const state = useSyncExternalStore(subscribe, () => current)
  if (state.status === 'error') throw state.error
  return state
}

/** The signed-in user. Only for components rendered inside the signed-in app shell. */
export function useCurrentUser(): CurrentUser {
  const state = useAuthState()
  if (state.status !== 'signed-in') throw new Error('useCurrentUser() was used outside the signed-in app shell')
  return state.user
}

export function signInWithGitHub(): Promise<Result<void>> {
  return attempt(async () => {
    await signInWithPopup(auth, new GithubAuthProvider())
  })
}

/** Email/password sign-in. Used only by the test sign-in form in src/e2e/. */
export function signInWithPassword(email: string, password: string): Promise<Result<void>> {
  return attempt(async () => {
    await signInWithEmailAndPassword(auth, email, password)
  })
}

export function signOut(): Promise<Result<void>> {
  return attempt(() => firebaseSignOut(auth))
}
