import type { ShallowRef } from 'vue'
import { readonly, shallowRef } from 'vue'

/**
 * Captured while the session is healthy: Firebase clears `currentUser` before an
 * expiry can be observed, taking the provider with it.
 */
interface RememberedIdentity {
  uid: string
  providerId?: string
}

// The primitive is what the request path reads; the ref exists only for the UI.
let suspended = false
const suspendedRef = shallowRef(false)
let voluntarySignOutDepth = 0
let rememberedIdentity: RememberedIdentity | null = null

/** The uid outlives the page because the drafts do. */
const LAST_SIGNED_IN_UID_KEY = 'Comfy.Cloud.LastSignedInUid'

function readLastSignedInUid(): string | null {
  try {
    return localStorage.getItem(LAST_SIGNED_IN_UID_KEY)
  } catch {
    return null
  }
}

function persistLastSignedInUid(uid: string): void {
  try {
    localStorage.setItem(LAST_SIGNED_IN_UID_KEY, uid)
  } catch {
    // Surviving a reload is an optimisation; the in-memory record still works.
  }
}

/**
 * True while the cloud session is unusable and awaiting re-authentication.
 * Request seams read this to stop generating traffic that can only 401.
 */
export function isSessionSuspended(): boolean {
  return suspended
}

/** Reactive mirror of {@link isSessionSuspended}, for components. */
export const sessionSuspended: Readonly<ShallowRef<boolean>> =
  readonly(suspendedRef)

/**
 * The provider the expired user signed in with, so re-authentication can offer
 * the same route. Undefined when it was never captured; ask rather than guess.
 */
export function lastKnownProviderId(): string | undefined {
  return rememberedIdentity?.providerId
}

/**
 * Records who is signed in and reports whether persisted work is theirs.
 *
 * One call, because splitting them lets whichever caller records first destroy
 * the evidence the other needs, and a second account then compares against
 * itself and inherits the first one's drafts.
 */
export function adoptIdentity(uid: string, providerId?: string): boolean {
  const previousUid = rememberedIdentity
    ? rememberedIdentity.uid
    : readLastSignedInUid()

  rememberedIdentity = { uid, providerId }
  persistLastSignedInUid(uid)

  // Nothing recorded yet means a cold start, not a stranger: with no evidence
  // that the work belongs to someone else, keeping it is the safe default.
  return previousUid === null || previousUid === uid
}

/**
 * Brackets a sign-out the app performed on purpose, so the sign-out hook can
 * tell it from a genuine expiry. Read it synchronously at that hook: the
 * bracket closes as soon as the sign-out call it wraps returns.
 *
 * Per-tab and in memory on purpose. A shared marker can only say "a sign-out
 * happened recently", never "this one", so while it lives a real expiry in any
 * tab reads as deliberate and the drafts are wiped.
 */
export function beginVoluntarySignOut(): void {
  voluntarySignOutDepth++
}

export function endVoluntarySignOut(): void {
  // Floored so an unbalanced release cannot go negative and disarm the guard.
  voluntarySignOutDepth = Math.max(0, voluntarySignOutDepth - 1)
}

export function isVoluntarySignOutInProgress(): boolean {
  return voluntarySignOutDepth > 0
}

/**
 * Suspends a cloud session whose credential the identity provider has rejected.
 *
 * Deliberately not driven by observing `401`s: a `401` is per-endpoint and
 * overloaded, so inferring session death from one disrupts working users. The
 * only caller is the sign-out hook, which fires when Firebase itself signs the
 * user out on `user-disabled` or `user-token-expired`.
 *
 * Never navigates, so the canvas and any unsaved work survive.
 */
export function suspendSession(): void {
  if (suspended) return
  suspended = true
  suspendedRef.value = true

  console.warn(
    'Cloud session suspended: the identity provider rejected the credential. Re-authentication needed.'
  )
}

/** Clears the suspension once a user is signed in again. */
export function resumeSession(): void {
  suspended = false
  suspendedRef.value = false
}
