import { deleteTask, setTaskStatus, type ListedTask } from '../data/tasks'
import type { DateKey, UserProfile } from '../data/types'
import { useAction } from '../hooks/useAction'
import { dueState } from '../lib/dates'
import type { ResultError } from '../lib/result'
import { isOpen, nextStatus, type MoveDirection } from '../lib/tasks'
import { FormError } from './FormError'
import { StatusButton } from './StatusButton'
import { Subtasks } from './Subtasks'
import { TaskEditForm } from './TaskEditForm'

type Props = {
  task: ListedTask
  users: readonly UserProfile[]
  today: DateKey
  editing: boolean
  onEdit: () => void
  onCloseEdit: () => void
  /** Called once the server has deleted the task, with the title it had. */
  onDeleted: (title: string) => void
  /** Called with a tag's text when the user clicks it, to narrow the list to that tag. */
  onTagClick: (tag: string) => void
  /** Moves this task one place up or down within its group. */
  onMove: (direction: MoveDirection) => void
  /** Called when a task dragged from elsewhere in the group is dropped on this row, with the dragged task's id. */
  onDropTask: (draggedTaskId: string) => void
  /** The error from this task's last move attempt, if any. */
  moveError: ResultError | null
  /** Whether this is the first task shown in its group: hides the "Move … up" tap button. */
  isFirst: boolean
  /** Whether this is the last task shown in its group: hides the "Move … down" tap button. */
  isLast: boolean
  /** Whether this task offers its drag handle and move controls: false while its group is ordered by due date. */
  canReorder: boolean
  uid: string
  /** The subtask currently open for rename, if any; at most one rename or edit form is open across the page. */
  editingSubtaskId: string | null
  onEditSubtask: (subtaskId: string) => void
  onCloseSubtaskEdit: () => void
}

/** One task on the list page: its reorder handle, status button, details, and Edit and Delete. */
export function TaskRow({
  task,
  users,
  today,
  editing,
  onEdit,
  onCloseEdit,
  onDeleted,
  onTagClick,
  onMove,
  onDropTask,
  moveError,
  isFirst,
  isLast,
  canReorder,
  uid,
  editingSubtaskId,
  onEditSubtask,
  onCloseSubtaskEdit,
}: Props) {
  const status = useAction(setTaskStatus)
  const remove = useAction(deleteTask)

  if (editing) {
    return (
      <li className="px-4 py-3">
        <TaskEditForm task={task} users={users} onClose={onCloseEdit} />
      </li>
    )
  }

  async function onDelete() {
    const result = await remove.run(task)
    if (result.ok) onDeleted(task.title)
  }

  const overdue = isOpen(task) && dueState(task.dueDate, today) === 'overdue'
  const assignee = users.find((user) => user.id === task.assigneeId)

  return (
    <li
      className="flex items-start gap-3 px-4 py-3"
      onDragOver={canReorder ? (event) => event.preventDefault() : undefined}
      onDrop={
        canReorder
          ? (event) => {
              event.preventDefault()
              const draggedTaskId = event.dataTransfer.getData('text/plain')
              if (draggedTaskId && draggedTaskId !== task.id) onDropTask(draggedTaskId)
            }
          : undefined
      }
    >
      {canReorder && (
        <button
          type="button"
          aria-label={`Reorder ${task.title}`}
          draggable
          onDragStart={(event) => event.dataTransfer.setData('text/plain', task.id)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
            event.preventDefault()
            onMove(event.key === 'ArrowUp' ? 'up' : 'down')
          }}
          className="mt-1 shrink-0 cursor-grab text-gray-400 hover:text-gray-600"
        >
          <span aria-hidden="true">⠿</span>
        </button>
      )}
      <StatusButton
        status={task.status}
        title={task.title}
        onClick={() => void status.run(task, nextStatus(task.status))}
        disabled={status.pending}
      />
      <div className="min-w-0 flex-1">
        <p className={task.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-900'}>{task.title}</p>
        {task.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{task.notes}</p>}
        {(task.dueDate || task.assigneeId) && (
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
            {task.dueDate && (
              <span className={overdue ? 'font-medium text-red-700' : undefined}>
                Due {task.dueDate}
                {overdue && ' (overdue)'}
              </span>
            )}
            {task.assigneeId && <span>Assigned to {assignee?.name ?? 'someone'}</span>}
          </p>
        )}
        {task.tags.length > 0 && (
          <ul aria-label={`Tags for ${task.title}`} className="mt-1 flex flex-wrap gap-2">
            {task.tags.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  aria-label={`Show tasks tagged ${tag}`}
                  onClick={() => onTagClick(tag)}
                  className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-200"
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        )}
        <FormError error={status.error ?? remove.error ?? moveError} />
        <Subtasks
          uid={uid}
          listId={task.listId}
          taskId={task.id}
          taskTitle={task.title}
          editingSubtaskId={editingSubtaskId}
          onEditSubtask={onEditSubtask}
          onCloseSubtaskEdit={onCloseSubtaskEdit}
        />
      </div>
      <button type="button" aria-label={`Edit ${task.title}`} onClick={onEdit} className="text-sm text-blue-700 hover:underline">
        Edit
      </button>
      <button
        type="button"
        aria-label={`Delete ${task.title}`}
        onClick={() => void onDelete()}
        disabled={remove.pending}
        className="text-sm text-red-700 hover:underline disabled:opacity-50"
      >
        Delete
      </button>
      {canReorder && !isFirst && (
        <button
          type="button"
          aria-label={`Move ${task.title} up`}
          onClick={() => onMove('up')}
          className="hidden shrink-0 text-gray-500 hover:text-gray-900 max-sm:pointer-coarse:inline-flex"
        >
          <span aria-hidden="true">▲</span>
        </button>
      )}
      {canReorder && !isLast && (
        <button
          type="button"
          aria-label={`Move ${task.title} down`}
          onClick={() => onMove('down')}
          className="hidden shrink-0 text-gray-500 hover:text-gray-900 max-sm:pointer-coarse:inline-flex"
        >
          <span aria-hidden="true">▼</span>
        </button>
      )}
    </li>
  )
}
