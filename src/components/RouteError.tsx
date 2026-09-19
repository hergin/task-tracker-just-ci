import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'

// The single boundary for unexpected errors and unknown URLs.
export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  useEffect(() => {
    if (!notFound) console.error(error)
  }, [error, notFound])

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        {notFound ? 'Page not found' : 'Something went wrong'}
      </h1>
      {!notFound && <p className="mt-2 text-gray-600">Reload the page to try again.</p>}
    </main>
  )
}
