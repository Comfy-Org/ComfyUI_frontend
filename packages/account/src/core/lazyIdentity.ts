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
  /** Resolves once the loaded identity has delivered its current user. */
  activate: () => Promise<void>
  /** Unsubscribes the real identity, signing subscribers out if it had delivered. */
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
            if (started !== generation) return
            deliver(user)
            resolve()
          })
        },
        (error: unknown) => {
          if (started !== generation) return
          activation = undefined
          settleActivation = undefined
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
    const wasSignedIn =
      lastDelivered !== undefined && lastDelivered.user !== null
    lastDelivered = undefined
    if (!wasSignedIn) return
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
