import { useId, useState, type FormEvent } from 'react'
import { renameSubtask } from '../data/subtasks'
import { LIMITS, type Subtask } from '../data/types'
import { useAction } from '../hooks/useAction'
import { FormError } from './FormError'

type Props = {
  subtask: Pick<Subtask, 'id' | 'listId' | 'taskId' | 'title'>
  /** Called on Cancel, and once the server has saved the subtask. */
  onClose: () => void
}

/** Renames a subtask, in place of its row. */
export function SubtaskEditForm({ subtask, onClose }: Props) {
  const save = useAction(renameSubtask)
  const [title, setTitle] = useState(subtask.title)
  const titleFieldId = useId()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await save.run(subtask, title)
    if (result.ok) onClose()
  }

  return (
    <form
      aria-label={`Edit subtask ${subtask.title}`}
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-wrap items-center gap-2"
    >
      <div>
        <label htmlFor={titleFieldId} className="sr-only">
          Subtask title
        </label>
        <input
          id={titleFieldId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={LIMITS.subtaskTitle}
          autoFocus
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={save.pending}
        className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onClose}
        disabled={save.pending}
        className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
      >
        Cancel
      </button>
      <FormError error={save.error} />
    </form>
  )
}
