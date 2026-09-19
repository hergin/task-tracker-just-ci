import { useEffect, useEffectEvent, useState } from 'react'

export type SubscriptionState<T> = { status: 'loading' } | { status: 'ready'; data: T }

/** Starts a realtime subscription and returns the function that stops it. */
export type Subscribe<T> = (onData: (data: T) => void, onError: (error: unknown) => void) => () => void

/**
 * The one way to read data: a realtime subscription, restarted whenever `key` changes.
 * `key` must identify everything the subscription depends on, e.g. `tasks:${uid}:${listId}`.
 * Errors are thrown during render so they reach the route error boundary; map expected errors inside `subscribe`.
 */
export function useSubscription<T>(key: string, subscribe: Subscribe<T>): SubscriptionState<T> {
  const [latest, setLatest] = useState<{ key: string; data: T } | { key: string; error: unknown } | null>(null)
  const start = useEffectEvent((onData: (data: T) => void, onError: (error: unknown) => void) =>
    subscribe(onData, onError),
  )

  useEffect(() => {
    return start(
      (data) => setLatest({ key, data }),
      (error) => setLatest({ key, error }),
    )
  }, [key])

  if (latest === null || latest.key !== key) return { status: 'loading' }
  if ('error' in latest) throw latest.error
  return { status: 'ready', data: latest.data }
}
