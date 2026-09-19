import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

// The only place the Firebase app is configured. Only src/data/ imports `auth` and `db` from here.

function readConfig(): FirebaseOptions {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG
  if (!raw) throw new Error('VITE_FIREBASE_CONFIG is not set. See .env.example.')
  try {
    return JSON.parse(raw) as FirebaseOptions
  } catch {
    throw new Error('VITE_FIREBASE_CONFIG is not valid JSON. See .env.example.')
  }
}

const app = initializeApp(readConfig())

export const auth = getAuth(app)
export const db = getFirestore(app, import.meta.env.VITE_FIRESTORE_DATABASE_ID || '(default)')

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
