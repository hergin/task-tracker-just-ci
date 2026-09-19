import { useParams } from 'react-router'
import { Loading } from '../components/Loading'
import { useSharedList } from '../data/lists'
import { useSharedTasks } from '../data/tasks'
import { STATUS_LABELS } from '../lib/tasks'

/** `/share/:listId`: a shared list's public, read-only page. Rendered outside the signed-in app shell. */
export function SharedList() {
  const { listId = '' } = useParams()
  const list = useSharedList(listId)
  const tasks = useSharedTasks(listId)

  if (list.status === 'loading' || tasks.status === 'loading') return <Loading />

  if (list.data === null) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <h1 className="text-2xl font-semibold text-gray-900">This list isn't shared</h1>
        <p className="mt-2 text-gray-600">Check the link with the person who sent it.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-semibold text-gray-900">{list.data.name}</h1>
      <p className="mt-1 text-sm text-gray-500">Shared read-only</p>

      {tasks.data.length === 0 ? (
        <p className="mt-4 text-gray-600">No tasks yet.</p>
      ) : (
        <ul aria-label="Tasks" className="mt-4 divide-y divide-gray-200 rounded border border-gray-200 bg-white">
          {tasks.data.map((task) => (
            <li key={task.id} className="px-4 py-3">
              <p className="text-gray-900">
                {STATUS_LABELS[task.status]} {task.title}
              </p>
              {task.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{task.notes}</p>}
              {task.dueDate && <p className="mt-1 text-xs text-gray-500">Due {task.dueDate}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
