import { effectScope, onScopeDispose } from 'vue'
import type { EffectScope } from 'vue'

import { createListeners } from './listeners'

/** Starts following the host and returns what stops it. */
type HostSubscription<TArgs extends unknown[]> = (
  emit: (...args: TArgs) => void
) => () => void

/**
 * An event a pack subscribes to. The host is followed in an effect scope of its
 * own, only while at least one listener is registered.
 */
export function createHostEvent<TArgs extends unknown[] = []>(
  member: string,
  follow: HostSubscription<TArgs>
): (listener: (...args: TArgs) => void) => () => void {
  const listeners = createListeners<TArgs>(member)
  let following: EffectScope | undefined

  return (listener) => {
    const remove = listeners.subscribe(listener)
    following ??= followDetached(() => follow(listeners.notify))
    return () => {
      remove()
      if (!listeners.isEmpty()) return
      following?.stop()
      following = undefined
    }
  }
}

function followDetached(start: () => () => void): EffectScope {
  const scope = effectScope(true)
  scope.run(() => onScopeDispose(start()))
  return scope
}
