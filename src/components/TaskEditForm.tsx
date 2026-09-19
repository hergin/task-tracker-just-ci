import { useId, useState, type FormEvent } from 'react'
import { updateTask } from '../data/tasks'
import { LIMITS, type Task, type UserProfile } from '../data/types'
import { useAction } from '../hooks/useAction'
import { addTag, removeTag } from '../lib/tasks'
import { FormError } from './FormError'

type Props = {
  task: Task
  users: readonly UserProfile[]
  /** Called on Cancel, and once the server has saved the task. */
  onClose: () => void
}

/** Edits a task's title, notes, due date and assignee, in place of its row. */
export function TaskEditForm({ task, users, onClose }: Props) {
  const save = useAction(updateTask)
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? '')
  const [tags, setTags] = useState(task.tags)
  const [newTag, setNewTag] = useState('')
  const [tagLimitReached, setTagLimitReached] = useState(false)
  const titleFieldId = useId()
  const notesFieldId = useId()
  const dueDateFieldId = useId()
  const assigneeFieldId = useId()
  const newTagFieldId = useId()

  function onAddTag() {
    const result = addTag(tags, newTag)
    setTags(result.tags)
    setTagLimitReached(result.limitReached)
    if (!result.limitReached) setNewTag('')
  }

  function onRemoveTag(tag: string) {
    setTags(removeTag(tags, tag))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await save.run(task, { title, notes, dueDate, assigneeId, tags })
    if (result.ok) onClose()
  }

  return (
    <form aria-label={`Edit ${task.title}`} onSubmit={(event) => void onSubmit(event)} className="space-y-3">
      <div>
        <label htmlFor={titleFieldId} className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id={titleFieldId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={LIMITS.taskTitle}
          autoFocus
          className="mt-1 w-full rounded border border-gray-300 px-3 py-1"
        />
      </div>
      <div>
        <label htmlFor={notesFieldId} className="block text-sm font-medium text-gray-700">
          Notes
        </label>
        <textarea
          id={notesFieldId}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={LIMITS.taskNotes}
          rows={3}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-1"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor={dueDateFieldId} className="block text-sm font-medium text-gray-700">
            Due date
          </label>
          <input
            id={dueDateFieldId}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="mt-1 rounded border border-gray-300 px-3 py-1"
          />
        </div>
        <div>
          <label htmlFor={assigneeFieldId} className="block text-sm font-medium text-gray-700">
            Assigned to
          </label>
          <select
            id={assigneeFieldId}
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            className="mt-1 rounded border border-gray-300 px-3 py-1"
          >
            <option value="">No one</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={newTagFieldId} className="block text-sm font-medium text-gray-700">
          New tag
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={newTagFieldId}
            value={newTag}
            onChange={(event) => setNewTag(event.target.value)}
            maxLength={LIMITS.tagText}
            className="rounded border border-gray-300 px-3 py-1"
          />
          <button
            type="button"
            onClick={onAddTag}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Add tag
          </button>
        </div>
        {tagLimitReached && (
          <p className="mt-1 text-sm text-red-700">A task can have at most {LIMITS.taskTags} tags.</p>
        )}
        {tags.length > 0 && (
          <ul aria-label="Tags on this task" className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm text-gray-800">
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => onRemoveTag(tag)}
                  className="text-gray-500 hover:text-gray-800"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={save.pending}
          className="rounded bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={save.pending}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      <FormError error={save.error} />
    </form>
  )
}
