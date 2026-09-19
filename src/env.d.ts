// Build-time variables. Every one is documented in .env.example.
interface ImportMetaEnv {
  readonly VITE_FIREBASE_CONFIG?: string
  readonly VITE_FIRESTORE_DATABASE_ID?: string
  readonly VITE_USE_EMULATORS?: string
  readonly VITE_E2E_LOGIN?: string
}
