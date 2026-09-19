import { Link, useSearchParams } from 'react-router'
import { Loading } from '../components/Loading'
import { useCurrentUser } from '../data/auth'
import { useLists } from '../data/lists'
import { useAllTasks } from '../data/tasks'
import { searchTasks } from '../lib/tasks'

/** `/search?q=<query>`: the signed-in user's tasks, across every list, whose title or notes match the query. */
export function Search() {
  const [searchParams] = useSearchParams()
  const user = useCurrentUser()
  const lists = useLists(user.uid)
  const tasks = useAllTasks(user.uid)
  const query = (searchParams.get('q') ?? '').trim()

  if (lists.status === 'loading' || tasks.status === 'loading') return <Loading />

  const results = query === '' ? [] : searchTasks(tasks.data, lists.data, query)

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-semibold text-gray-900">Search</h1>

      {query === '' ? (
        <p className="mt-4 text-gray-600">Type something to search for.</p>
      ) : results.length === 0 ? (
        <p className="mt-4 text-gray-600">No tasks match "{query}".</p>
      ) : (
        <ul aria-label="Search results" className="mt-4 divide-y divide-gray-200 rounded border border-gray-200 bg-white">
          {results.map(({ task, list }) => (
            <li key={task.id} className="px-4 py-3">
              <Link to={`/lists/${list.id}`} className="text-blue-700 hover:underline">
                {task.title} in {list.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
