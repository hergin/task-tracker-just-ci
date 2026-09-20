import type { TaskStatus } from '../data/types'
import { STATUS_LABELS } from '../lib/tasks'

type Props = {
  status: TaskStatus
  /** The task's title, for the button's accessible name. */
  title: string
  /** Advances the task to nextStatus(status). */
  onClick: () => void
  /** True while this task's own status change is in flight. */
  disabled: boolean
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
  doing: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
  done: 'bg-green-100 text-green-900 hover:bg-green-200',
  postponed: 'bg-purple-100 text-purple-900 hover:bg-purple-200',
}

/** A task's status, as the button that advances it: the same control on the list page and on Today. */
export function StatusButton({ status, title, onClick, disabled }: Props) {
  const label = STATUS_LABELS[status]
  return (
    <button
      type="button"
      aria-label={`${label}: change status of ${title}`}
      onClick={onClick}
      disabled={disabled}
      className={`w-20 shrink-0 rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${STATUS_STYLES[status]}`}
    >
      {label}
    </button>
  )
}
