import { useId, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { FormError } from '../components/FormError'
import { Loading } from '../components/Loading'
import { TaskRow } from '../components/TaskRow'
import { useCurrentUser } from '../data/auth'
import { shareList, useList, useLists } from '../data/lists'
import { addTask, moveTask, moveTaskToList, useTasks, type ListedTask } from '../data/tasks'
import { LIMITS, type List } from '../data/types'
import { useUsers } from '../data/users'
import { useAction } from '../hooks/useAction'
import { toDateKey } from '../lib/dates'
import {
  filterByStatus,
  filterByTag,
  moveTaskByDirection,
  nextPosition,
  orderTasks,
  parseStatusFilter,
  parseTagFilter,
  parseTaskOrder,
  reorderTask,
  splitByDone,
  STATUS_LABELS,
  type StatusFilter,
  type TaskOrder,
} from '../lib/tasks'

const STATUS_FILTER_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: STATUS_LABELS.todo },
  { value: 'doing', label: STATUS_LABELS.doing },
  { value: 'done', label: STATUS_LABELS.done },
  { value: 'postponed', label: STATUS_LABELS.postponed },
]

/** `/lists/:listId`: the tasks in one list. Done tasks sit in a collapsed group at the bottom. */
export function ListDetail() {
  const { listId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useCurrentUser()
  const list = useList(listId, user.uid)
  const lists = useLists(user.uid)
  const tasks = useTasks(listId, user.uid)
  const users = useUsers()
  const add = useAction(addTask)
  const move = useAction(moveTask)
  const moveToList = useAction(moveTaskToList)
  const share = useAction(shareList)
  const [title, setTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null)
  const [movingToListTaskId, setMovingToListTaskId] = useState<string | null>(null)
  const titleId = useId()
  const doneListId = useId()
  const statusFilterName = useId()
  const taskOrderName = useId()
  const shareLinkId = useId()
  const statusFilter = parseStatusFilter(searchParams.get('status'))
  const tagFilter = parseTagFilter(searchParams.get('tag'))
  const taskOrder = parseTaskOrder(searchParams.get('order'))

  function onFilterChange(next: StatusFilter) {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        if (next === 'all') params.delete('status')
        else params.set('status', next)
        return params
      },
      { replace: true },
    )
  }

  function onOrderChange(next: TaskOrder) {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        if (next === 'saved') params.delete('order')
        else params.set('order', next)
        return params
      },
      { replace: true },
    )
  }

  function onTagClick(tag: string) {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        params.set('tag', tag)
        return params
      },
      { replace: true },
    )
  }

  function onShowAllTasks() {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        params.delete('status')
        params.delete('tag')
        return params
      },
      { replace: true },
    )
  }

  if (
    list.status === 'loading' ||
    lists.status === 'loading' ||
    tasks.status === 'loading' ||
    users.status === 'loading'
  ) {
    return <Loading />
  }

  if (list.data === null) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <h1 className="text-2xl font-semibold text-gray-900">List not found</h1>
        <Link to="/" className="mt-2 inline-block text-blue-700 underline">
          Back to your lists
        </Link>
      </main>
    )
  }

  const allTasks = tasks.data
  const otherLists = lists.data.filter((other) => other.id !== listId)
  const { open, done } = splitByDone(allTasks)
  const orderedOpen = orderTasks(open, taskOrder)
  const today = toDateKey(new Date())
  const tagMatchingTasks = filterByTag(allTasks, tagFilter)
  const isFiltering = statusFilter !== 'all' || tagFilter !== null
  const filteredTasks = filterByStatus(tagMatchingTasks, statusFilter)
  const filterLabel = statusFilter !== 'all' ? STATUS_LABELS[statusFilter] : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    const result = await add.run({ uid: user.uid, listId, title, position: nextPosition(allTasks) })
    if (result.ok) setTitle('')
  }

  function runMove(changes: ListedTask[] | null, movedTaskId: string) {
    if (!changes) return
    setMovingTaskId(movedTaskId)
    void move.run(changes)
  }

  async function onMoveToList(task: ListedTask, destination: List) {
    setMovingToListTaskId(task.id)
    setNotice(null)
    const result = await moveToList.run(task, destination.id)
    if (result.ok) setNotice(`Moved "${task.title}" to "${destination.name}".`)
  }

  function onEditTask(taskId: string) {
    setEditingId(taskId)
    setEditingSubtaskId(null)
  }

  function onEditSubtask(subtaskId: string) {
    setEditingSubtaskId(subtaskId)
    setEditingId(null)
  }

  const row =
    (group: ListedTask[], canReorder = true) =>
    (task: ListedTask, index: number) => (
      <TaskRow
        key={task.id}
        task={task}
        users={users.data}
        today={today}
        editing={editingId === task.id}
        onEdit={() => onEditTask(task.id)}
        onCloseEdit={() => setEditingId(null)}
        onDeleted={(deletedTitle) => setNotice(`Deleted "${deletedTitle}".`)}
        onTagClick={onTagClick}
        onMove={(direction) => runMove(moveTaskByDirection(group, task.id, direction), task.id)}
        onDropTask={(draggedTaskId) =>
          runMove(
            reorderTask(group, draggedTaskId, group.findIndex((t) => t.id === task.id)),
            draggedTaskId,
          )
        }
        moveError={movingTaskId === task.id ? move.error : null}
        otherLists={otherLists}
        onMoveToList={(destination) => void onMoveToList(task, destination)}
        moveToListPending={moveToList.pending}
        moveToListError={movingToListTaskId === task.id ? moveToList.error : null}
        isFirst={index === 0}
        isLast={index === group.length - 1}
        canReorder={canReorder}
        uid={user.uid}
        editingSubtaskId={editingSubtaskId}
        onEditSubtask={onEditSubtask}
        onCloseSubtaskEdit={() => setEditingSubtaskId(null)}
      />
    )

  return (
    <main className="mx-auto max-w-2xl p-4">
      <Link to="/" className="text-sm text-blue-700 underline">
        ← Your lists
      </Link>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">{list.data.name}</h1>
        {/* Tests wait for this to disappear before reloading: until then, the server hasn't confirmed every change.
            A move to another list takes its task off this page as soon as it is sent, so it reports itself. */}
        {(allTasks.some((task) => task.saving) || moveToList.pending) && (
          <p role="status" className="text-sm text-gray-500">
            Saving…
          </p>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-500">Created {toDateKey(list.data.createdAt)}</p>

      {list.data.shared && !share.pending ? (
        <div className="mt-4">
          <label htmlFor={shareLinkId} className="block text-sm font-medium text-gray-700">
            Share link
          </label>
          <input
            id={shareLinkId}
            type="text"
            readOnly
            value={`${window.location.origin}/share/${listId}`}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700"
          />
          <p className="mt-1 text-sm text-gray-500">Anyone with this link can see this list's tasks without signing in.</p>
        </div>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void share.run(listId)}
            disabled={share.pending}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Share read-only
          </button>
          <FormError error={share.error} />
        </div>
      )}

      <form onSubmit={(event) => void onSubmit(event)} className="mt-4">
        <label htmlFor={titleId} className="block text-sm font-medium text-gray-700">
          New task
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={titleId}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={LIMITS.taskTitle}
            className="flex-1 rounded border border-gray-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={add.pending}
            className="rounded bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Add task
          </button>
        </div>
        <FormError error={add.error} />
      </form>

      {notice && (
        <p role="status" className="mt-4 rounded bg-green-50 px-3 py-2 text-sm text-green-800">
          {notice}
        </p>
      )}

      <div role="radiogroup" aria-label="Filter by status" className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700">
        {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-1.5">
            <input type="radio" name={statusFilterName} checked={statusFilter === value} onChange={() => onFilterChange(value)} />
            {label}
          </label>
        ))}
      </div>

      <div role="radiogroup" aria-label="Order by" className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700">
        <label className="flex items-center gap-1.5">
          <input type="radio" name={taskOrderName} checked={taskOrder === 'saved'} onChange={() => onOrderChange('saved')} />
          Saved order
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={taskOrderName} checked={taskOrder === 'due-date'} onChange={() => onOrderChange('due-date')} />
          Due date
        </label>
      </div>

      {tagFilter !== null && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700">
          <p>Showing tasks tagged "{tagFilter}"</p>
          <button type="button" onClick={onShowAllTasks} className="text-blue-700 hover:underline">
            Show all tasks
          </button>
        </div>
      )}

      {tagFilter !== null && tagMatchingTasks.length === 0 ? (
        <p className="mt-4 text-gray-600">No tasks tagged "{tagFilter}".</p>
      ) : allTasks.length === 0 ? (
        <p className="mt-4 text-gray-600">No tasks yet.</p>
      ) : isFiltering ? (
        filteredTasks.length === 0 ? (
          <p className="mt-4 text-gray-600">No {filterLabel} tasks.</p>
        ) : (
          <ul aria-label="Tasks" className="mt-4 divide-y divide-gray-200 rounded border border-gray-200 bg-white">
            {filteredTasks.map(row(filteredTasks))}
          </ul>
        )
      ) : orderedOpen.length === 0 ? (
        <p className="mt-4 text-gray-600">No open tasks.</p>
      ) : (
        <ul aria-label="Tasks" className="mt-4 divide-y divide-gray-200 rounded border border-gray-200 bg-white">
          {orderedOpen.map(row(orderedOpen, taskOrder === 'saved'))}
        </ul>
      )}

      {!isFiltering && done.length > 0 && (
        <section className="mt-6">
          <button
            type="button"
            aria-expanded={showDone}
            aria-controls={doneListId}
            onClick={() => setShowDone(!showDone)}
            className="text-sm font-medium text-gray-700 hover:underline"
          >
            <span aria-hidden="true">{showDone ? '▾' : '▸'} </span>
            Done ({done.length})
          </button>
          <ul
            id={doneListId}
            aria-label="Done tasks"
            hidden={!showDone}
            className="mt-2 divide-y divide-gray-200 rounded border border-gray-200 bg-white"
          >
            {done.map(row(done))}
          </ul>
        </section>
      )}
    </main>
  )
}
