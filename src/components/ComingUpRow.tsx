import type { Task } from '../data/types'

type Props = {
  task: Pick<Task, 'title' | 'dueDate'>
}

/** One task in Today's "Coming up" section: its title and its due date, and nothing to change about it. */
export function ComingUpRow({ task }: Props) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <p className="min-w-0 flex-1 text-gray-900">{task.title}</p>
      <span className="shrink-0 text-sm text-gray-500">{task.dueDate}</span>
    </li>
  )
}
