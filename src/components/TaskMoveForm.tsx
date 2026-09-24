import { useId, useState, type FormEvent } from 'react'
import type { List, Task } from '../data/types'

type Props = {
  task: Task
  /** The lists this task can move to: the user's own lists apart from the one it is in. Never empty. */
  lists: readonly List[]
  /** Called with the chosen list when the user confirms the move. */
  onMove: (destination: List) => void
  onCancel: () => void
  /** Whether a move is still waiting on the server. */
  pending: boolean
}

/** Picks another of the user's lists to move a task to, under its row. */
export function TaskMoveForm({ task, lists, onMove, onCancel, pending }: Props) {
  const [destinationId, setDestinationId] = useState(lists[0]?.id ?? '')
  const destinationFieldId = useId()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const destination = lists.find((list) => list.id === destinationId)
    if (destination) onMove(destination)
  }

  return (
    <form aria-label={`Move ${task.title}`} onSubmit={onSubmit} className="mt-2 flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={destinationFieldId} className="block text-sm font-medium text-gray-700">
          Move to list
        </label>
        <select
          id={destinationFieldId}
          value={destinationId}
          onChange={(event) => setDestinationId(event.target.value)}
          className="mt-1 rounded border border-gray-300 px-3 py-1"
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        Move task
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        Cancel
      </button>
    </form>
  )
}
