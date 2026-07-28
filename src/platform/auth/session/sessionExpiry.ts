import type { ShallowRef } from 'vue'
import { readonly, shallowRef } from 'vue'

/**
 * Identity of the user who was signed in, captured while the session was still
 * healthy. Firebase clears `currentUser` before anything can observe an expiry,
 * so reading the provider at that point always comes back empty — it has to be
 * remembered in advance.
 */
interface RememberedIdentity {
  uid: string
  providerId?: string
}

// The primitive is what the hot request path reads, so a 401 storm never builds
// a reactive proxy per request. The ref exists only for the UI, and a single
// writer updates both so they cannot drift.
let suspended = false
const suspendedRef = shallowRef(false)
let voluntarySignOutDepth = 0
let rememberedIdentity: RememberedIdentity | null = null

/**
 * The uid outlives the page because the drafts do. In-memory state is null on
 * every load, so comparing against it would treat every cold start as a new
 * user and delete work that belongs to the person about to sign in.
 */
const LAST_SIGNED_IN_UID_KEY = 'Comfy.Cloud.LastSignedInUid'

function readLastSignedInUid(): string | null {
  try {
    return localStorage.getItem(LAST_SIGNED_IN_UID_KEY)
  } catch {
    // Storage is unavailable in private mode. With no evidence of a previous
    // owner, the caller keeps the work.
    return null
  }
}

function persistLastSignedInUid(uid: string | null): void {
  try {
    if (uid === null) localStorage.removeItem(LAST_SIGNED_IN_UID_KEY)
    else localStorage.setItem(LAST_SIGNED_IN_UID_KEY, uid)
  } catch {
    // Surviving a reload is an optimisation; the in-memory record still works.
  }
}

/**
 * True while the cloud session is unusable and awaiting re-authentication.
 *
 * Request seams check this to stop generating traffic that can only 401. Unlike
 * a sign-out this is recoverable: {@link resumeSession} clears it once a user
 * signs back in, and the page is never navigated away, so work in progress
 * survives.
 */
export function isSessionSuspended(): boolean {
  return suspended
}

/** Reactive mirror of {@link isSessionSuspended}, for components. */
export const sessionSuspended: Readonly<ShallowRef<boolean>> =
  readonly(suspendedRef)

/**
 * The provider the expired user authenticated with, so re-authentication can
 * offer the same route instead of making them choose again. Undefined when it
 * was never captured, in which case the caller should offer a generic sign-in
 * rather than guessing.
 */
export function lastKnownProviderId(): string | undefined {
  return rememberedIdentity?.providerId
}

/**
 * Records who is signed in, and reports whether locally persisted work is
 * theirs.
 *
 * Deciding and recording are one call because splitting them is a defect:
 * whichever caller records first destroys the evidence the other needs, so a
 * second account can be compared against itself and inherit the first one's
 * drafts. Callers get the verdict for the identity they just installed.
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
 * Brackets a sign-out the app performed on purpose.
 *
 * The deliberate logout, the `requires-recent-login` recovery that signs out
 * only to re-prompt, and the signup rollback that deletes a half-created user
 * all reach the same sign-out hook as a genuine expiry. Read the flag
 * synchronously at that hook, before any `await`: the bracket is still open
 * while the hook runs, and closes once the sign-out call it wraps returns.
 * `signOutSeam.test.ts` pins it against a model of that dispatch: the observer
 * is notified from inside the awaited call, never after it resolves.
 *
 * Deliberately in-memory and per-tab. A shared marker would let a sibling tab
 * recognise the sign-out, but it can only say "a sign-out happened recently",
 * never "this sign-out" — so for as long as it lives, a genuine expiry in any
 * tab reads as deliberate and the user's drafts are wiped. The cost of not
 * sharing it is a sibling tab showing an expiry banner it did not need; the
 * cost of sharing it is losing work, which is the thing this feature exists to
 * prevent.
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
 * Deliberately NOT driven by observing `401`s. A `401` is per-endpoint and
 * overloaded — missing entitlement, a resource outside the workspace, a feature
 * the account lacks — so inferring session death from one is a guess, and a
 * wrong guess disrupts a working user.
 *
 * There is exactly one caller: the sign-out hook, which fires when Firebase's
 * own `_logoutIfInvalidated` signs the user out on precisely `user-disabled` or
 * `user-token-expired`, and never on a transient failure. Nothing else may
 * suspend a session; the token refresh paths only ask the provider to re-issue
 * and let it decide.
 *
 * This does not navigate. The user keeps their canvas and can export unsaved
 * work, and re-authenticating in place resumes the session.
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
