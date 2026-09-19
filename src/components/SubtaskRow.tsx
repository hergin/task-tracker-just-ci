import { useState } from 'react'
import { setSubtaskDone, type ListedSubtask } from '../data/subtasks'
import { useAction } from '../hooks/useAction'
import { FormError } from './FormError'

type Props = {
  subtask: ListedSubtask
  onEdit: () => void
  onRemove: () => void
  removing: boolean
}

/** One subtask row: its checkbox, Edit and Remove. */
export function SubtaskRow({ subtask, onEdit, onRemove, removing }: Props) {
  const toggle = useAction(setSubtaskDone)
  // Tracks the checkbox's intended state while the write is in flight, since setSubtaskDone's own pending
  // flag re-renders this row before the subscription reflects the change, which would otherwise snap a
  // controlled checkbox back to its old value mid-click.
  const [pendingDone, setPendingDone] = useState<boolean | null>(null)

  async function onToggle(done: boolean) {
    setPendingDone(done)
    await toggle.run(subtask, done)
    setPendingDone(null)
  }

  const checked = pendingDone ?? subtask.done

  return (
    <li className="flex items-center gap-2 text-sm">
      <label className="flex flex-1 items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => void onToggle(event.target.checked)}
          disabled={toggle.pending}
        />
        <span className={checked ? 'text-gray-500 line-through' : 'text-gray-900'}>{subtask.title}</span>
      </label>
      <button
        type="button"
        aria-label={`Edit subtask ${subtask.title}`}
        onClick={onEdit}
        className="text-xs text-blue-700 hover:underline"
      >
        Edit
      </button>
      <button
        type="button"
        aria-label={`Remove subtask ${subtask.title}`}
        onClick={onRemove}
        disabled={removing}
        className="text-xs text-red-700 hover:underline disabled:opacity-50"
      >
        Remove
      </button>
      <FormError error={toggle.error} />
    </li>
  )
}
