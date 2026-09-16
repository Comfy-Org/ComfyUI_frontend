/**
 * An identity port whose real identity is loaded and subscribed only on
 * `activate()`, so a host can construct the session client at module load
 * while the identity's module (and the SDK behind it) stays a lazy chunk.
 */
import type { AccountIdentity } from './identity.js'
import { brandIdentity } from './identity.js'
import type { AccountUser } from './sessionContracts.js'

export interface LazyIdentity<
  TUser extends AccountUser
> extends AccountIdentity<TUser> {
  /** Loads and subscribes the real identity; idempotent while loading or active; rejects if the loader rejects. */
  activate: () => Promise<void>
  /** Unsubscribes the real identity and delivers null (signed-out) to subscribers; no-op unless active. */
  deactivate: () => void
}

export function createLazyIdentity<TUser extends AccountUser>(
  load: () => Promise<AccountIdentity<TUser>>
): LazyIdentity<TUser> {
  const listeners = new Set<(user: TUser | null) => void>()
  let generation = 0
  let activation: Promise<void> | undefined
  let unsubscribe: (() => void) | undefined
  let lastDelivered: { readonly user: TUser | null } | undefined

  function deliver(user: TUser | null): void {
    lastDelivered = { user }
    listeners.forEach((listener) => listener(user))
  }

  function activate(): Promise<void> {
    if (activation) return activation
    const started = ++generation
    activation = load().then(
      (identity) => {
        if (started !== generation) return
        unsubscribe = identity.onUserChanged(deliver)
      },
      (error: unknown) => {
        if (started === generation) activation = undefined
        throw error
      }
    )
    return activation
  }

  function deactivate(): void {
    if (!activation) return
    generation += 1
    activation = undefined
    const wasSubscribed = unsubscribe !== undefined
    unsubscribe?.()
    unsubscribe = undefined
    lastDelivered = undefined
    if (!wasSubscribed) return
    listeners.forEach((listener) => listener(null))
  }

  return {
    ...brandIdentity<TUser>({
      onUserChanged: (listener) => {
        listeners.add(listener)
        if (lastDelivered) listener(lastDelivered.user)
        return () => {
          listeners.delete(listener)
        }
      }
    }),
    activate,
    deactivate
  }
}
