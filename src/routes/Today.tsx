import { useState } from 'react'
import { Link } from 'react-router'
import { Loading } from '../components/Loading'
import { TodayRow } from '../components/TodayRow'
import { useCurrentUser } from '../data/auth'
import { useLists } from '../data/lists'
import { useAllTasks, type ListedTask } from '../data/tasks'
import { toDateKey } from '../lib/dates'
import type { ResultError } from '../lib/result'
import { groupDueByToday } from '../lib/tasks'

/** A refused change, by task id: the page keeps it, since a row that leaves Today takes its own state with it. */
type Failure = { title: string; error: ResultError }

/** `/today`: open tasks, across all the user's lists, that are overdue or due today. */
export function Today() {
  const user = useCurrentUser()
  const lists = useLists(user.uid)
  const tasks = useAllTasks(user.uid)
  const [failures, setFailures] = useState<Record<string, Failure>>({})
  // How many changes are waiting for the server. A change is unsaved from the click on, before Firestore has
  // even applied it locally, so the indicator can't wait for the first snapshot that reports it as pending.
  const [inFlight, setInFlight] = useState(0)

  if (lists.status === 'loading' || tasks.status === 'loading') return <Loading />

  const today = toDateKey(new Date())
  const groups = groupDueByToday(tasks.data, lists.data, today)
  const listedIds = new Set(groups.flatMap((group) => group.tasks.map((task) => task.id)))
  // A task marked Done leaves Today at once, so its failure can no longer be shown next to its button.
  const lost = Object.entries(failures).filter(([id]) => !listedIds.has(id))

  function onSettled(task: ListedTask, error: ResultError | null) {
    setInFlight((count) => count - 1)
    if (error) setFailures((current) => ({ ...current, [task.id]: { title: task.title, error } }))
  }

  function onStart(task: ListedTask) {
    setInFlight((count) => count + 1)
    setFailures((current) =>
      task.id in current ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== task.id)) : current,
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Today</h1>
        {/* A task can leave Today before the server confirms it, so the page carries the indicator, not the row. */}
        {(inFlight > 0 || tasks.data.some((task) => task.saving)) && (
          <p role="status" className="text-sm text-gray-500">
            Saving…
          </p>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-600">Open tasks that are overdue or due today ({today}).</p>

      {lost.map(([id, failure]) => (
        <p key={id} role="alert" className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {`Couldn't change "${failure.title}": ${failure.error.message}`}
        </p>
      ))}

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
              {due.map((task) => (
                <TodayRow
                  key={task.id}
                  task={task}
                  today={today}
                  error={failures[task.id]?.error ?? null}
                  onStart={() => onStart(task)}
                  onSettled={(error) => onSettled(task, error)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  )
}
