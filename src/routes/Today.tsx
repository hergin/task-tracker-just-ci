import { useState } from 'react'
import { Link } from 'react-router'
import { ComingUpRow } from '../components/ComingUpRow'
import { Loading } from '../components/Loading'
import { TodayRow } from '../components/TodayRow'
import { useCurrentUser } from '../data/auth'
import { useLists } from '../data/lists'
import { useAllTasks, type ListedTask } from '../data/tasks'
import { toDateKey } from '../lib/dates'
import type { ResultError } from '../lib/result'
import { COMING_UP_DAYS, groupComingUp, groupDueByToday } from '../lib/tasks'

/** A refused status change, by task id: the page keeps it, since a row that leaves Today takes its own state with it. */
type Failure = { title: string; error: ResultError }

/**
 * `/today`: open tasks, across all the user's lists, that are overdue or due today, and below them the ones coming up
 * in the next COMING_UP_DAYS days.
 */
export function Today() {
  const user = useCurrentUser()
  const lists = useLists(user.uid)
  const tasks = useAllTasks(user.uid)
  const [failures, setFailures] = useState<Record<string, Failure>>({})

  if (lists.status === 'loading' || tasks.status === 'loading') return <Loading />

  const today = toDateKey(new Date())
  const groups = groupDueByToday(tasks.data, lists.data, today)
  const comingUp = groupComingUp(tasks.data, lists.data, today)
  const listedIds = new Set(groups.flatMap((group) => group.tasks.map((task) => task.id)))
  // A task marked Done leaves Today at once, so its failure can no longer be shown next to its button.
  const lost = Object.entries(failures).filter(([id]) => !listedIds.has(id))

  function onFailed(task: ListedTask, error: ResultError) {
    setFailures((current) => ({ ...current, [task.id]: { title: task.title, error } }))
  }

  function onStart(task: ListedTask) {
    setFailures((current) =>
      task.id in current ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== task.id)) : current,
    )
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
                  onFailed={(error) => onFailed(task, error)}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      {comingUp.length > 0 && (
        <section aria-labelledby="coming-up" className="mt-10">
          <h2 id="coming-up" className="text-xl font-semibold text-gray-900">
            Coming up
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {`Open tasks due in the next ${COMING_UP_DAYS} days.`}
          </p>
          {comingUp.map(({ list, tasks: soon }) => (
            <div key={list.id} className="mt-4">
              <h3 className="text-base font-medium text-gray-900">
                <Link to={`/lists/${list.id}`} className="hover:underline">
                  {list.name}
                </Link>
              </h3>
              <ul
                aria-label={`Coming up in ${list.name}`}
                className="mt-2 divide-y divide-gray-200 rounded border border-gray-200 bg-white"
              >
                {soon.map((task) => (
                  <ComingUpRow key={task.id} task={task} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
