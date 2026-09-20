import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { deleteList, renameList } from '../data/lists'
import { LIMITS, type List } from '../data/types'
import { useAction } from '../hooks/useAction'
import { FormError } from './FormError'

type Props = {
  list: List
  uid: string
  openCount: number
  /** How many of those open tasks are overdue. Nothing is shown when none are. */
  overdueCount: number
  /** Called once the server has deleted the list, with the name it had. */
  onDeleted: (name: string) => void
}

/** One row on the lists page: the list's link and task counts, renaming in place, deleting after confirmation. */
export function ListRow({ list, uid, openCount, overdueCount, onDeleted }: Props) {
  const [mode, setMode] = useState<'view' | 'rename' | 'confirm-delete'>('view')
  const [name, setName] = useState(list.name)
  const rename = useAction(renameList)
  const remove = useAction(deleteList)
  const nameId = useId()

  async function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await rename.run(list.id, name)
    if (result.ok) setMode('view')
  }

  async function onDelete() {
    const result = await remove.run(list.id, uid)
    if (result.ok) onDeleted(list.name)
  }

  if (mode === 'rename') {
    return (
      <li className="px-4 py-3">
        <form onSubmit={(event) => void onRename(event)} className="flex flex-wrap items-center gap-2">
          <label htmlFor={nameId} className="sr-only">
            Name for {list.name}
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={LIMITS.listName}
            autoFocus
            className="flex-1 rounded border border-gray-300 px-3 py-1"
          />
          <button
            type="submit"
            disabled={rename.pending}
            className="rounded bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              rename.reset()
              setMode('view')
            }}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
        </form>
        <FormError error={rename.error} />
      </li>
    )
  }

  if (mode === 'confirm-delete') {
    return (
      <li className="bg-red-50 px-4 py-3">
        <p className="text-gray-900">Delete "{list.name}" and all its tasks? This can't be undone.</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => void onDelete()}
            disabled={remove.pending}
            className="rounded bg-red-700 px-3 py-1 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            Delete list
          </button>
          <button
            type="button"
            onClick={() => {
              remove.reset()
              setMode('view')
            }}
            disabled={remove.pending}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        <FormError error={remove.error} />
      </li>
    )
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link to={`/lists/${list.id}`} className="flex-1 text-gray-900 hover:underline">
        {list.name}
      </Link>
      <span className="text-sm text-gray-500">{openCount} open</span>
      {overdueCount > 0 && <span className="text-sm font-medium text-red-700">{overdueCount} overdue</span>}
      <button
        type="button"
        aria-label={`Rename ${list.name}`}
        onClick={() => {
          setName(list.name)
          setMode('rename')
        }}
        className="text-sm text-blue-700 hover:underline"
      >
        Rename
      </button>
      <button
        type="button"
        aria-label={`Delete ${list.name}`}
        onClick={() => setMode('confirm-delete')}
        className="text-sm text-red-700 hover:underline"
      >
        Delete
      </button>
    </li>
  )
}
