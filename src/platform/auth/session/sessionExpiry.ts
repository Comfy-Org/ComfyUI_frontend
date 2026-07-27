import { isPublicRoutePath } from '@/platform/auth/session/publicRoutes'
import { isCloud } from '@/platform/distribution/types'

/**
 * If the browser refuses to leave — a `beforeunload` confirm the user cancels —
 * the latch would otherwise stay set for the life of the tab, silently failing
 * every cloud call. Releasing it restores the previous behaviour instead.
 */
const NAVIGATION_GRACE_MS = 10_000

let terminated = false
let voluntarySignOutDepth = 0

/**
 * True once the session has ended. Request seams check this to stop generating
 * traffic in the window between the sign-out and the redirect landing.
 */
export function isSessionTerminated(): boolean {
  return terminated
}

/**
 * Brackets a sign-out the app performed on purpose.
 *
 * Several in-process flows sign the user out without their session having
 * expired: `useAuthActions.logout` (which redirects itself), the
 * `requires-recent-login` recovery that signs out only to immediately re-prompt,
 * and the signup rollback that deletes a half-created Firebase user. All three
 * reach the same `onAuthUserLogout` hook as a genuine expiry, so without this
 * bracket they would each be misread as a dead credential and hard-navigate.
 */
export function beginVoluntarySignOut(): void {
  voluntarySignOutDepth++
}

export function endVoluntarySignOut(): void {
  voluntarySignOutDepth = Math.max(0, voluntarySignOutDepth - 1)
}

export function isVoluntarySignOutInProgress(): boolean {
  return voluntarySignOutDepth > 0
}

/**
 * Ends a cloud session that the identity provider has already invalidated.
 *
 * Deliberately NOT driven by observing `401`s. A `401` is per-endpoint and
 * overloaded — missing entitlement, a resource outside the workspace, a feature
 * the account lacks — so inferring session death from one is a guess, and a
 * wrong guess signs out a working user. The two callers are instead driven by a
 * known token expiry: Firebase's own `_logoutIfInvalidated`, which signs out on
 * precisely `user-disabled` or `user-token-expired` and never on a transient
 * failure, and the Cloud JWT refresh timer when the identity itself is rejected.
 */
export function endExpiredSession(reason: string): void {
  if (
    !isCloud ||
    terminated ||
    isVoluntarySignOutInProgress() ||
    isPublicRoutePath(window.location.pathname)
  ) {
    return
  }
  terminated = true

  console.warn(`Cloud session ended (${reason}); returning to sign-in.`)

  setTimeout(() => {
    terminated = false
  }, NAVIGATION_GRACE_MS)

  try {
    window.location.href = '/cloud/login'
  } catch {
    window.location.reload()
  }
}
