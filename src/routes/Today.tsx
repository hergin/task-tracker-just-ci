import { Link } from 'react-router'
import { Loading } from '../components/Loading'
import { useCurrentUser } from '../data/auth'
import { useLists } from '../data/lists'
import { useAllTasks } from '../data/tasks'
import { dueState, toDateKey } from '../lib/dates'
import { STATUS_LABELS, groupDueByToday } from '../lib/tasks'

/** `/today`: open tasks, across all the user's lists, that are overdue or due today. */
export function Today() {
  const user = useCurrentUser()
  const lists = useLists(user.uid)
  const tasks = useAllTasks(user.uid)

  if (lists.status === 'loading' || tasks.status === 'loading') return <Loading />

  const today = toDateKey(new Date())
  const groups = groupDueByToday(tasks.data, lists.data, today)

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-semibold text-gray-900">Today</h1>
      <p className="mt-1 text-sm text-gray-600">Open tasks that are overdue or due today ({today}).</p>

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
                  <li key={task.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-gray-900">{task.title}</span>
                    <span className="shrink-0 text-sm text-gray-500">
                      {STATUS_LABELS[task.status]} ·{' '}
                      <span className={overdue ? 'font-medium text-red-700' : undefined}>
                        {overdue ? `Overdue since ${task.dueDate}` : 'Due today'}
                      </span>
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
