import { useId, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuthState } from '../data/auth'
import { SignIn } from '../routes/SignIn'
import { Loading } from './Loading'
import { SignOutButton } from './SignOutButton'

/** Wraps every screen. Signed-out visitors see the sign-in screen at whatever URL they opened. */
export function AppShell() {
  const auth = useAuthState()
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [syncedSearch, setSyncedSearch] = useState<string | null>(null)
  const searchId = useId()

  // Keeps the header field showing the current query on /search, including a direct visit or reload,
  // without fighting the user's own edits: adjusted during render, not in an effect (React docs).
  if (location.pathname === '/search' && location.search !== syncedSearch) {
    setSyncedSearch(location.search)
    setQuery(new URLSearchParams(location.search).get('q') ?? '')
  }

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    navigate(trimmed === '' ? '/search' : `/search?q=${encodeURIComponent(trimmed)}`)
  }

  if (auth.status === 'loading') return <Loading />
  if (auth.status === 'signed-out') return <SignIn />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 p-4">
          <nav className="flex items-center gap-4">
            <Link to="/" className="font-semibold text-gray-900">
              Tasks
            </Link>
            <NavLink
              to="/today"
              className={({ isActive }) =>
                `text-sm ${isActive ? 'font-medium text-gray-900 underline' : 'text-gray-600 hover:text-gray-900'}`
              }
            >
              Today
            </NavLink>
          </nav>
          <form onSubmit={onSearchSubmit} className="flex flex-1 items-center gap-2 sm:max-w-xs">
            <label htmlFor={searchId} className="sr-only">
              Search tasks
            </label>
            <input
              id={searchId}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks"
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="shrink-0 rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              Search
            </button>
          </form>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{auth.user.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
