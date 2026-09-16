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
  /** Loads and subscribes the real identity; resolves once the identity has delivered its current user (or on deactivate); idempotent while pending or active; rejects if the loader rejects. */
  activate: () => Promise<void>
  /** Unsubscribes the real identity and, if it had delivered, delivers null (signed-out) to subscribers; no-op when inactive. */
  deactivate: () => void
}

export function createLazyIdentity<TUser extends AccountUser>(
  load: () => Promise<AccountIdentity<TUser>>
): LazyIdentity<TUser> {
  const listeners = new Set<(user: TUser | null) => void>()
  let generation = 0
  let activation: Promise<void> | undefined
  let settleActivation: (() => void) | undefined
  let unsubscribe: (() => void) | undefined
  let lastDelivered: { readonly user: TUser | null } | undefined

  function deliver(user: TUser | null): void {
    lastDelivered = { user }
    listeners.forEach((listener) => listener(user))
  }

  function activate(): Promise<void> {
    if (activation) return activation
    const started = ++generation
    activation = new Promise<void>((resolve, reject) => {
      settleActivation = resolve
      load().then(
        (identity) => {
          if (started !== generation) return
          unsubscribe = identity.onUserChanged((user) => {
            deliver(user)
            resolve()
          })
        },
        (error: unknown) => {
          if (started === generation) {
            activation = undefined
            settleActivation = undefined
          }
          reject(error)
        }
      )
    })
    return activation
  }

  function deactivate(): void {
    if (!activation) return
    generation += 1
    activation = undefined
    settleActivation?.()
    settleActivation = undefined
    unsubscribe?.()
    unsubscribe = undefined
    const hadDelivered = lastDelivered !== undefined
    lastDelivered = undefined
    if (!hadDelivered) return
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
