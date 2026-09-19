import { FormError } from '../components/FormError'
import { signInWithGitHub } from '../data/auth'
import { TestSignIn } from '../e2e/TestSignIn'
import { useAction } from '../hooks/useAction'

/** Shown by AppShell to signed-out visitors, at any URL. */
export function SignIn() {
  const github = useAction(signInWithGitHub)

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
      <p className="mt-2 text-gray-600">Sign in to see your lists.</p>
      <button
        type="button"
        onClick={() => void github.run()}
        disabled={github.pending}
        className="mt-6 w-full rounded bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        Sign in with GitHub
      </button>
      <FormError error={github.error} />
      {import.meta.env.VITE_E2E_LOGIN === 'true' && <TestSignIn />}
    </main>
  )
}
