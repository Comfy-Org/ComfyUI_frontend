/**
 * Tells, from facts rather than a timer, whether a popup sign-in was
 * abandoned. Firebase itself cannot: after the window closes it waits a
 * hardcoded 8s (on a 2s poll) before rejecting with `popup-closed-by-user`,
 * because a closed window alone does not say whether the sign-in result had
 * already been handed over.
 *
 * The result is handed over through the resolver's event manager, and
 * Firebase's hosted handler page waits for the page to acknowledge it before
 * closing the popup. So "window closed and no result for this operation" means
 * the visitor gave up, and "result received" means the sign-in is completing,
 * however long the token exchange then takes.
 *
 * This subclasses the SDK's public `browserPopupRedirectResolver` and reads two
 * of its internals: the event manager `_initialize` resolves to, and the
 * provider, event id and window `_openPopup` works with
 * (popupWatchSdkContract.test.ts pins them). When they are not what this
 * expects, nothing is watched and sign-in keeps Firebase's own timing.
 */
import type { PopupRedirectResolver } from 'firebase/auth'
import { browserPopupRedirectResolver } from 'firebase/auth'

export interface PopupWatchCallbacks {
  /** The popup closed before any sign-in result reached the page: the visitor gave up. */
  readonly onAbandoned?: () => void
  /** A result arrived after `onAbandoned` and was kept: the sign-in completes after all. */
  readonly onResumed?: () => void
  /**
   * Asked when a result arrives after `onAbandoned`. True discards it before
   * Firebase exchanges it, so no account is signed in or created.
   */
  readonly discardLateResult?: () => boolean
}

/** Frequent enough to feel immediate; one `closed` read per tick. */
const CLOSED_POLL_MS = 100

interface AuthEventLike {
  readonly type?: unknown
  readonly eventId?: unknown
}

interface AuthEventManagerLike {
  onEvent: (event: AuthEventLike) => boolean
}

interface ResolverInternals {
  _initialize(auth: unknown): Promise<unknown>
  _openPopup(
    auth: unknown,
    provider: unknown,
    authType: unknown,
    eventId?: string
  ): Promise<unknown>
}

type ResolverClass = new () => ResolverInternals

interface WatchedAttempt {
  readonly callbacks: PopupWatchCallbacks
  abandoned: boolean
  eventId?: string
  poll?: ReturnType<typeof setInterval>
}

// Keyed by the provider object each sign-in hands to `signInWithPopup`, which
// Firebase passes on to `_openPopup`, so a popup Firebase still opens for an
// operation it already cancelled is never taken for a newer one.
const attemptsByProvider = new WeakMap<object, WatchedAttempt>()
const attemptsByEventId = new Map<string, WatchedAttempt>()
const wrappedManagers = new WeakSet<object>()
let observingResults = false

function isResolverClass(value: unknown): value is ResolverClass {
  if (typeof value !== 'function') return false
  const prototype: unknown = value.prototype
  return (
    typeof prototype === 'object' &&
    prototype !== null &&
    '_initialize' in prototype &&
    '_openPopup' in prototype
  )
}

function isEventManager(value: unknown): value is AuthEventManagerLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'onEvent' in value &&
    typeof value.onEvent === 'function'
  )
}

interface PopupWindowLike {
  readonly closed: unknown
}

function popupWindowOf(popup: unknown): PopupWindowLike | undefined {
  if (typeof popup !== 'object' || popup === null || !('window' in popup))
    return undefined
  const { window } = popup
  return typeof window === 'object' && window !== null && 'closed' in window
    ? window
    : undefined
}

function stopPolling(attempt: WatchedAttempt): void {
  clearInterval(attempt.poll)
  attempt.poll = undefined
}

function deliver(
  original: AuthEventManagerLike['onEvent'],
  event: AuthEventLike
): boolean {
  const attempt =
    event.type === 'signInViaPopup' && typeof event.eventId === 'string'
      ? attemptsByEventId.get(event.eventId)
      : undefined
  if (!attempt) return original(event)
  stopPolling(attempt)
  if (attempt.abandoned) {
    // Acknowledged so the handler page stops, never handed to Firebase.
    if (attempt.callbacks.discardLateResult?.()) return true
    attempt.abandoned = false
    attempt.callbacks.onResumed?.()
  }
  return original(event)
}

function watchWindow(attempt: WatchedAttempt, popup: PopupWindowLike): void {
  attempt.poll = setInterval(() => {
    if (popup.closed !== true) return
    stopPolling(attempt)
    attempt.abandoned = true
    attempt.callbacks.onAbandoned?.()
  }, CLOSED_POLL_MS)
}

function watchingResolver(Base: ResolverClass): ResolverClass {
  return class WatchingPopupRedirectResolver extends Base {
    override async _initialize(auth: unknown): Promise<unknown> {
      const manager = await super._initialize(auth)
      if (isEventManager(manager) && !wrappedManagers.has(manager)) {
        const original = manager.onEvent.bind(manager)
        manager.onEvent = (event) => deliver(original, event)
        wrappedManagers.add(manager)
        observingResults = true
      }
      return manager
    }

    override async _openPopup(
      auth: unknown,
      provider: unknown,
      authType: unknown,
      eventId?: string
    ): Promise<unknown> {
      const popup = await super._openPopup(auth, provider, authType, eventId)
      const attempt =
        typeof provider === 'object' && provider !== null
          ? attemptsByProvider.get(provider)
          : undefined
      const popupWindow = popupWindowOf(popup)
      // Without results to compare against, a closed window proves nothing.
      if (attempt && observingResults && eventId && popupWindow) {
        attempt.eventId = eventId
        attemptsByEventId.set(eventId, attempt)
        watchWindow(attempt, popupWindow)
      }
      return popup
    }
  }
}

/**
 * The resolver a watched identity's Auth is created with. One for the whole
 * page, so Auth created again for the same app is handed the same resolver.
 * Firebase's own when its resolver cannot be extended.
 */
export const watchedPopupRedirectResolver: PopupRedirectResolver =
  isResolverClass(browserPopupRedirectResolver)
    ? watchingResolver(browserPopupRedirectResolver)
    : browserPopupRedirectResolver

/**
 * Runs one popup sign-in for `provider`, the object passed to
 * `signInWithPopup`, reporting through `callbacks` while it is pending.
 */
export async function runWatchedPopup<T>(
  provider: object,
  signIn: () => Promise<T>,
  callbacks: PopupWatchCallbacks
): Promise<T> {
  const attempt: WatchedAttempt = { callbacks, abandoned: false }
  attemptsByProvider.set(provider, attempt)
  try {
    return await signIn()
  } finally {
    stopPolling(attempt)
    attemptsByProvider.delete(provider)
    if (attempt.eventId) attemptsByEventId.delete(attempt.eventId)
  }
}
