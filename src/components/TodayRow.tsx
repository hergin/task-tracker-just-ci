import { setTaskDueDate, setTaskStatus, type ListedTask } from '../data/tasks'
import type { DateKey } from '../data/types'
import { useAction } from '../hooks/useAction'
import { dueState, nextDay } from '../lib/dates'
import type { ResultError } from '../lib/result'
import { nextStatus } from '../lib/tasks'
import { FormError } from './FormError'
import { StatusButton } from './StatusButton'

type Props = {
  task: ListedTask
  today: DateKey
  /** This task's last refused change, kept by the page: a row that leaves Today loses its own state. */
  error: ResultError | null
  /** Called when the user clicks the button, to drop the error the last attempt left on this task. */
  onStart: () => void
  /** Called when the server refuses this task's change, so the page reports it even once the row is gone. */
  onFailed: (error: ResultError) => void
}

/**
 * One task on the Today page: the button that advances its status, the button that pushes it to tomorrow,
 * its title, and its due information.
 */
export function TodayRow({ task, today, error, onStart, onFailed }: Props) {
  const status = useAction(setTaskStatus)
  const push = useAction(setTaskDueDate)

  async function onChangeStatus() {
    onStart()
    const result = await status.run(task, nextStatus(task.status))
    if (!result.ok) onFailed(result.error)
  }

  async function onPushToTomorrow() {
    onStart()
    const result = await push.run(task, nextDay(today))
    if (!result.ok) onFailed(result.error)
  }

  const overdue = dueState(task.dueDate, today) === 'overdue'

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      {/* Only this task's own change disables its button: every other row keeps working while it is in flight. */}
      <StatusButton
        status={task.status}
        title={task.title}
        onClick={() => void onChangeStatus()}
        disabled={status.pending}
      />
      {/* Named after its task, so every row's button can be told apart; only its own push disables it. */}
      <button
        type="button"
        aria-label={`Push ${task.title} to tomorrow`}
        onClick={() => void onPushToTomorrow()}
        disabled={push.pending}
        className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        Tomorrow
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-gray-900">{task.title}</p>
        <FormError error={error} />
      </div>
      <span className={`shrink-0 text-sm ${overdue ? 'font-medium text-red-700' : 'text-gray-500'}`}>
        {overdue ? `Overdue since ${task.dueDate}` : 'Due today'}
      </span>
    </li>
  )
}
