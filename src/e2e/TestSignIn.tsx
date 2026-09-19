import { useId, useState, type FormEvent } from 'react'
import { FormError } from '../components/FormError'
import { signInWithPassword } from '../data/auth'
import { useAction } from '../hooks/useAction'

// Test-only sign-in with the seeded test account. Rendered only when built with VITE_E2E_LOGIN=true,
// so production builds drop it. The production bundle guard looks for the data-e2e-login marker.
export function TestSignIn() {
  const signIn = useAction(signInWithPassword)
  const [email, setEmail] = useState('e2e-owner@e2e.test')
  const [password, setPassword] = useState('')
  const headingId = useId()
  const emailId = useId()
  const passwordId = useId()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void signIn.run(email, password)
  }

  return (
    <form
      data-e2e-login
      aria-labelledby={headingId}
      onSubmit={onSubmit}
      className="mt-8 rounded border border-dashed border-amber-400 bg-amber-50 p-4"
    >
      <h2 id={headingId} className="font-medium text-amber-900">
        Test sign-in
      </h2>
      {import.meta.env.VITE_USE_EMULATORS === 'true' && (
        <p className="mt-1 text-sm text-amber-900">
          Local emulators: the password is <code>local-e2e-password</code>.
        </p>
      )}
      <label htmlFor={emailId} className="mt-3 block text-sm font-medium text-gray-700">
        Email
      </label>
      <input
        id={emailId}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
      />
      <label htmlFor={passwordId} className="mt-3 block text-sm font-medium text-gray-700">
        Password
      </label>
      <input
        id={passwordId}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
      />
      <button
        type="submit"
        disabled={signIn.pending}
        className="mt-4 w-full rounded bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800 disabled:opacity-50"
      >
        Sign in with test account
      </button>
      <FormError error={signIn.error} />
    </form>
  )
}
