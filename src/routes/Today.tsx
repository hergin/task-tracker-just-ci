import { useState } from 'react'
import { Link } from 'react-router'
import { FormError } from '../components/FormError'
import { Loading } from '../components/Loading'
import { StatusButton } from '../components/StatusButton'
import { useCurrentUser } from '../data/auth'
import { useLists } from '../data/lists'
import { setTaskStatus, useAllTasks, type ListedTask } from '../data/tasks'
import { useAction } from '../hooks/useAction'
import { dueState, toDateKey } from '../lib/dates'
import { groupDueByToday, nextStatus } from '../lib/tasks'

/** `/today`: open tasks, across all the user's lists, that are overdue or due today. */
export function Today() {
  const user = useCurrentUser()
  const lists = useLists(user.uid)
  const tasks = useAllTasks(user.uid)
  const status = useAction(setTaskStatus)
  const [changed, setChanged] = useState<{ id: string; title: string } | null>(null)

  if (lists.status === 'loading' || tasks.status === 'loading') return <Loading />

  const today = toDateKey(new Date())
  const groups = groupDueByToday(tasks.data, lists.data, today)
  const listedIds = new Set(groups.flatMap((group) => group.tasks.map((task) => task.id)))
  // A task marked Done leaves Today at once, so a failure can no longer be shown next to its button.
  const lostError = changed && !listedIds.has(changed.id) ? status.error : null

  function onChangeStatus(task: ListedTask) {
    setChanged({ id: task.id, title: task.title })
    void status.run(task, nextStatus(task.status))
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Today</h1>
        {/* A task can leave Today before the server confirms it, so the page carries the indicator, not the row. */}
        {tasks.data.some((task) => task.saving) && (
          <p role="status" className="text-sm text-gray-500">
            Saving…
          </p>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-600">Open tasks that are overdue or due today ({today}).</p>

      {lostError && changed && (
        <p role="alert" className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {`Couldn't change "${changed.title}": ${lostError.message}`}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="mt-6 text-gray-600">Nothing due today.</p>
      ) : (
        groups.map(({ list, tasks: due }) => (
          <section key={list.id} aria-labelledby={`today-${list.id}`} className="mt-6">
            <h2 id={`today-${list.id}`} className="text-lg font-medium text-gray-900">
              <Link to={`/lists/${list.id}`} className="hover:underline">
                {list.name}
              </Link>
            </h2>
            <ul
              aria-label={`Due in ${list.name}`}
              className="mt-2 divide-y divide-gray-200 rounded border border-gray-200 bg-white"
            >
              {due.map((task) => {
                const overdue = dueState(task.dueDate, today) === 'overdue'
                return (
                  <li key={task.id} className="flex items-start gap-3 px-4 py-3">
                    <StatusButton
                      status={task.status}
                      title={task.title}
                      onClick={() => onChangeStatus(task)}
                      disabled={status.pending && changed?.id === task.id}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-900">{task.title}</p>
                      {changed?.id === task.id && <FormError error={status.error} />}
                    </div>
                    <span
                      className={`shrink-0 text-sm ${overdue ? 'font-medium text-red-700' : 'text-gray-500'}`}
                    >
                      {overdue ? `Overdue since ${task.dueDate}` : 'Due today'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </main>
  )
}
