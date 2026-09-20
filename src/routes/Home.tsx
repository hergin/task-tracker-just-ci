import { useId, useState, type FormEvent } from 'react'
import { FormError } from '../components/FormError'
import { ListRow } from '../components/ListRow'
import { Loading } from '../components/Loading'
import { useCurrentUser } from '../data/auth'
import { createList, useLists } from '../data/lists'
import { useTaskCounts } from '../data/tasks'
import { LIMITS } from '../data/types'
import { useAction } from '../hooks/useAction'
import { toDateKey } from '../lib/dates'

/** `/`: the signed-in user's lists. */
export function Home() {
  const user = useCurrentUser()
  const lists = useLists(user.uid)
  const counts = useTaskCounts(user.uid, toDateKey(new Date()))
  const create = useAction(createList)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const nameId = useId()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    const result = await create.run(user.uid, name)
    if (result.ok) setName('')
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-semibold text-gray-900">Your lists</h1>

      <form onSubmit={(event) => void onSubmit(event)} className="mt-4">
        <label htmlFor={nameId} className="block text-sm font-medium text-gray-700">
          New list name
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={LIMITS.listName}
            className="flex-1 rounded border border-gray-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={create.pending}
            className="rounded bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Create list
          </button>
        </div>
        <FormError error={create.error} />
      </form>

      {notice && (
        <p role="status" className="mt-4 rounded bg-green-50 px-3 py-2 text-sm text-green-800">
          {notice}
        </p>
      )}

      {lists.status === 'loading' || counts.status === 'loading' ? (
        <Loading />
      ) : lists.data.length === 0 ? (
        <p className="mt-6 text-gray-600">No lists yet.</p>
      ) : (
        <ul aria-label="Lists" className="mt-6 divide-y divide-gray-200 rounded border border-gray-200 bg-white">
          {lists.data.map((list) => (
            <ListRow
              key={list.id}
              list={list}
              uid={user.uid}
              openCount={counts.data.open[list.id] ?? 0}
              overdueCount={counts.data.overdue[list.id] ?? 0}
              onDeleted={(deletedName) => setNotice(`Deleted "${deletedName}".`)}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
