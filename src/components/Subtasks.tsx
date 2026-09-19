import { useId, useState, type FormEvent } from 'react'
import { addSubtask, deleteSubtask, useSubtasks, type ListedSubtask } from '../data/subtasks'
import { LIMITS } from '../data/types'
import { useAction } from '../hooks/useAction'
import { nextSubtaskPosition, subtaskProgress } from '../lib/subtasks'
import { FormError } from './FormError'
import { SubtaskEditForm } from './SubtaskEditForm'
import { SubtaskRow } from './SubtaskRow'

type Props = {
  uid: string
  listId: string
  taskId: string
  taskTitle: string
  /** The subtask currently open for rename, if it belongs to this task; at most one is open across the page. */
  editingSubtaskId: string | null
  onEditSubtask: (subtaskId: string) => void
  onCloseSubtaskEdit: () => void
}

/** A task's checklist: add a subtask, tick it off, rename or remove it. */
export function Subtasks({ uid, listId, taskId, taskTitle, editingSubtaskId, onEditSubtask, onCloseSubtaskEdit }: Props) {
  const subtasks = useSubtasks(listId, taskId, uid)
  const add = useAction(addSubtask)
  const remove = useAction(deleteSubtask)
  const [newTitle, setNewTitle] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const newSubtaskFieldId = useId()

  if (subtasks.status === 'loading') return null

  const items = subtasks.data
  const progress = subtaskProgress(items)

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await add.run({ uid, listId, taskId, title: newTitle, position: nextSubtaskPosition(items) })
    if (result.ok) setNewTitle('')
  }

  async function onRemove(subtask: ListedSubtask) {
    setRemovingId(subtask.id)
    await remove.run(subtask)
  }

  return (
    <div className="mt-2">
      {progress && (
        <p className="text-xs text-gray-500">
          {progress.done} of {progress.total}
        </p>
      )}
      {items.length > 0 && (
        <ul aria-label={`Subtasks for ${taskTitle}`} className="space-y-1">
          {items.map((subtask) =>
            editingSubtaskId === subtask.id ? (
              <li key={subtask.id}>
                <SubtaskEditForm subtask={subtask} onClose={onCloseSubtaskEdit} />
              </li>
            ) : (
              <SubtaskRow
                key={subtask.id}
                subtask={subtask}
                onEdit={() => onEditSubtask(subtask.id)}
                onRemove={() => void onRemove(subtask)}
                removing={remove.pending && removingId === subtask.id}
              />
            ),
          )}
        </ul>
      )}
      {items.some((subtask) => subtask.saving) && (
        <p role="status" className="mt-1 text-xs text-gray-500">
          Saving…
        </p>
      )}
      <form onSubmit={(event) => void onAdd(event)} className="mt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <label htmlFor={newSubtaskFieldId} className="sr-only">
          New subtask for {taskTitle}
        </label>
        <input
          id={newSubtaskFieldId}
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          maxLength={LIMITS.subtaskTitle}
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={add.pending}
          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Add subtask to {taskTitle}
        </button>
      </form>
      <FormError error={add.error ?? remove.error} />
    </div>
  )
}
