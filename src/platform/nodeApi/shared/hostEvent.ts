import { invalidArgument } from './invalidArgument'
import { createListeners } from './listeners'

/** Starts following the host and returns what stops it. */
type HostSubscription<TArgs extends unknown[]> = (
  emit: (...args: TArgs) => void
) => () => void

/**
 * An event a pack subscribes to. The host is followed only while at least one
 * listener is registered, and stops being followed when the last one leaves.
 */
export function createHostEvent<TArgs extends unknown[] = []>(
  member: string,
  follow: HostSubscription<TArgs>
): (listener: (...args: TArgs) => void) => () => void {
  const listeners = createListeners<TArgs>(member)
  let stopFollowing: (() => void) | undefined

  return (listener) => {
    if (typeof listener !== 'function') {
      throw invalidArgument(member, 'a function to call', listener)
    }
    const remove = listeners.add(listener)
    stopFollowing ??= follow(listeners.notify)
    return () => {
      remove()
      if (!listeners.isEmpty()) return
      stopFollowing?.()
      stopFollowing = undefined
    }
  }
}
