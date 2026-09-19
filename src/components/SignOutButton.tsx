import { signOut } from '../data/auth'
import { useAction } from '../hooks/useAction'
import { FormError } from './FormError'

export function SignOutButton() {
  const action = useAction(signOut)
  return (
    <div>
      <button
        type="button"
        onClick={() => void action.run()}
        disabled={action.pending}
        className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        Sign out
      </button>
      <FormError error={action.error} />
    </div>
  )
}
