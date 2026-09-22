/**
 * An identity port whose real identity is loaded and subscribed only on
 * `activate()`, so a host can construct the session client at module load
 * while the identity's module (and the SDK behind it) stays a lazy chunk.
 */
import type { AccountIdentity } from './identity.js'
import { brandIdentity } from './identity.js'
import type { AccountUser } from './sessionContracts.js'

/**
 * Single-owner: one driver calls `activate()` and `deactivate()`; a second
 * consumer would share and tear down the same activation.
 */
export interface LazyIdentity<
  TUser extends AccountUser
> extends AccountIdentity<TUser> {
  /**
   * Resolves once the loaded identity has delivered its current user, or at
   * once when `deactivate()` interrupts the activation; the caller re-checks
   * its own liveness after the await.
   */
  activate: () => Promise<void>
  /**
   * Unsubscribes the real identity, signing subscribers out if it had
   * delivered a signed-in user.
   */
  deactivate: () => void
}

/**
 * An identity that has already settled signed-out: for a `load` that
 * legitimately has no source to resolve, so the port still delivers once and
 * a subscriber reaches signed-out instead of hanging in `pending` forever.
 */
export function createUnavailableIdentity<
  TUser extends AccountUser
>(): AccountIdentity<TUser> {
  return brandIdentity<TUser>({
    onUserChanged: (callback) => {
      callback(null)
      return () => undefined
    }
  })
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

  async function subscribe(started: number, resolve: () => void) {
    const identity = await load()
    if (started !== generation) return
    unsubscribe = identity.onUserChanged((user) => {
      if (started !== generation) return
      resolve()
      deliver(user)
    })
  }

  function activate(): Promise<void> {
    if (activation) return activation
    const started = ++generation
    activation = new Promise<void>((resolve, reject) => {
      settleActivation = resolve
      subscribe(started, resolve).catch((error: unknown) => {
        if (started !== generation) return
        activation = undefined
        settleActivation = undefined
        reject(error)
      })
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
