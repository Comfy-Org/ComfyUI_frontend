import { isPublicRoutePath } from '@/platform/auth/session/publicRoutes'
import { isCloud } from '@/platform/distribution/types'

/**
 * A successful navigation destroys this module, so a firing timer means the
 * browser refused to leave — a `beforeunload` the user cancelled, which is the
 * default whenever there are unsaved workflows.
 *
 * Keep offering the way out rather than giving up after one attempt. The latch
 * stays set either way, because the session really is dead and letting cloud
 * traffic resume would restore the 401 storm this exists to end; but a tab that
 * has stopped all traffic AND stopped asking is indistinguishable from the
 * silent breakage this change was written to remove.
 */
const NAVIGATION_RETRY_MS = 10_000

let terminated = false
let voluntarySignOutDepth = 0
let retryTimer: ReturnType<typeof setInterval> | undefined

/**
 * True once the session has ended. Request seams check this to stop generating
 * traffic between the sign-out and the redirect landing, and it stays true so a
 * refused navigation cannot let the traffic back.
 */
export function isSessionTerminated(): boolean {
  return terminated
}

/**
 * Marks a sign-out the app is performing on purpose.
 *
 * Several in-process flows sign the user out without their session having
 * expired: `useAuthActions.logout` (which redirects itself), the
 * `requires-recent-login` recovery that signs out only to immediately re-prompt,
 * and the signup rollback that deletes a half-created Firebase user. All three
 * reach the same `onAuthUserLogout` hook as a genuine expiry, so without this
 * they would each be misread as a dead credential and hard-navigate.
 */
export function beginVoluntarySignOut(): void {
  voluntarySignOutDepth++
}

export function endVoluntarySignOut(): void {
  voluntarySignOutDepth = Math.max(0, voluntarySignOutDepth - 1)
}

/**
 * MUST be read synchronously, at the entry of the sign-out hook and before any
 * `await`. The sign-out resolves without a network call while the hook awaits
 * one, so by the time the hook resumes the flag has already been released.
 */
export function isVoluntarySignOutInProgress(): boolean {
  return voluntarySignOutDepth > 0
}

function redirectToLogin(): void {
  try {
    window.location.href = '/cloud/login'
  } catch {
    window.location.reload()
  }
}

/**
 * Ends a cloud session that the identity provider has already invalidated.
 *
 * Deliberately NOT driven by observing `401`s. A `401` is per-endpoint and
 * overloaded — missing entitlement, a resource outside the workspace, a feature
 * the account lacks — so inferring session death from one is a guess, and a
 * wrong guess signs out a working user.
 *
 * There is exactly one caller: the sign-out hook, which fires when Firebase's
 * own `_logoutIfInvalidated` signs the user out on precisely `user-disabled` or
 * `user-token-expired`, and never on a transient failure. Nothing else in the
 * app may end a session; the token refresh paths only ask the provider to
 * re-issue and let it decide.
 */
export function endExpiredSession(reason: string): void {
  if (!isCloud || terminated || isPublicRoutePath(window.location.pathname)) {
    return
  }
  terminated = true

  console.warn(`Cloud session ended (${reason}); returning to sign-in.`)

  redirectToLogin()
  retryTimer ??= setInterval(() => redirectToLogin(), NAVIGATION_RETRY_MS)
}
