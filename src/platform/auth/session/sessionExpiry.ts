import type { ShallowRef } from 'vue'
import { readonly, shallowRef } from 'vue'

import { isCloud } from '@/platform/distribution/types'

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

/**
 * Firebase propagates a sign-out to every tab through shared persistence, but a
 * per-tab counter cannot: the sibling tab never called `beginVoluntarySignOut`,
 * so it would read a deliberate sign-out as an expiry and suspend a healthy
 * session. The marker travels the same way the sign-out does.
 *
 * It expires on a timestamp rather than being cleared, so a tab that closes
 * mid-sign-out cannot mask a later genuine expiry indefinitely.
 */
const VOLUNTARY_SIGN_OUT_KEY = 'Comfy.Cloud.VoluntarySignOut'
const VOLUNTARY_SIGN_OUT_WINDOW_MS = 10_000

function readLastSignedInUid(): string | null {
  try {
    return localStorage.getItem(LAST_SIGNED_IN_UID_KEY)
  } catch {
    return null
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
 * Records who is signed in, for the two things that must outlive the session:
 * which provider to re-authenticate with, and whether a later sign-in is the
 * same person.
 */
export function rememberIdentity(uid: string, providerId?: string): void {
  rememberedIdentity = { uid, providerId }
  try {
    localStorage.setItem(LAST_SIGNED_IN_UID_KEY, uid)
  } catch {
    // Persisting is an optimisation for the next page load, not a requirement.
  }
}

/** Drops the remembered identity, so nothing is inherited by the next user. */
export function forgetIdentity(): void {
  rememberedIdentity = null
  try {
    localStorage.removeItem(LAST_SIGNED_IN_UID_KEY)
  } catch {
    // Nothing to forget if storage is unavailable.
  }
}

/**
 * Whether locally persisted work belongs to whoever just signed in.
 *
 * Drafts survive an expiry so re-authenticating restores the user's work, but
 * they must not survive into a different account on a shared machine.
 */
export function isSameUserAsRemembered(uid: string): boolean {
  if (rememberedIdentity) return rememberedIdentity.uid === uid

  // Nothing recorded yet means a cold start, not a stranger: with no evidence
  // that the work belongs to someone else, keeping it is the safe default.
  const lastUid = readLastSignedInUid()
  return lastUid === null || lastUid === uid
}

/**
 * Brackets a sign-out the app performed on purpose.
 *
 * The deliberate logout, the `requires-recent-login` recovery that signs out
 * only to re-prompt, and the signup rollback that deletes a half-created user
 * all reach the same sign-out hook as a genuine expiry. Read the flag
 * synchronously at that hook, before any `await`: it is released as soon as the
 * sign-out resolves, which happens while the hook is still awaiting teardown.
 */
export function beginVoluntarySignOut(): void {
  voluntarySignOutDepth++
  try {
    localStorage.setItem(VOLUNTARY_SIGN_OUT_KEY, String(Date.now()))
  } catch {
    // Same-tab sign-outs still work; only the cross-tab hint is lost.
  }
}

export function endVoluntarySignOut(): void {
  voluntarySignOutDepth = Math.max(0, voluntarySignOutDepth - 1)
  if (voluntarySignOutDepth > 0) return

  try {
    // Leaving it behind would make a genuine expiry in the next few seconds
    // look deliberate: no banner, no short-circuit, and the drafts wiped.
    localStorage.removeItem(VOLUNTARY_SIGN_OUT_KEY)
  } catch {
    // The timestamp window is the backstop when storage is unavailable.
  }
}

export function isVoluntarySignOutInProgress(): boolean {
  if (voluntarySignOutDepth > 0) return true

  try {
    const startedAt = Number(localStorage.getItem(VOLUNTARY_SIGN_OUT_KEY))
    return (
      Number.isFinite(startedAt) &&
      Date.now() - startedAt < VOLUNTARY_SIGN_OUT_WINDOW_MS
    )
  } catch {
    return false
  }
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
  if (!isCloud || suspended) return
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
