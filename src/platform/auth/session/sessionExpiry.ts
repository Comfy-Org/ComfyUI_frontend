import { isCloud } from '@/platform/distribution/types'

/**
 * Routes that are already the destination, or are part of getting signed in.
 * Redirecting from one of these would either loop or interrupt a login.
 */
const PUBLIC_PATH_PREFIXES = ['/cloud/login', '/cloud/signup', '/cloud/oauth']

let terminated = false

/**
 * True once the session has ended. Request seams check this to stop generating
 * traffic in the window between the sign-out and the redirect landing.
 */
export function isSessionTerminated(): boolean {
  return terminated
}

function isOnPublicRoute(): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) =>
    window.location.pathname.startsWith(prefix)
  )
}

/**
 * Ends a cloud session that the identity provider has already invalidated.
 *
 * This is deliberately NOT driven by observing `401`s. A `401` is per-endpoint
 * and overloaded — missing entitlement, a resource outside the workspace, a
 * feature the account lacks — so inferring session death from one is a guess,
 * and a wrong guess signs out a working user. Instead there are exactly two
 * callers, both authoritative and both driven by a known expiry rather than by
 * polling:
 *
 * - Firebase's own `ProactiveRefresh` refreshes at `expiry - 5m` and, via
 *   `_logoutIfInvalidated`, signs the user out on precisely `user-disabled` or
 *   `user-token-expired`. Every other failure, including a network error,
 *   leaves the user signed in. That sign-out is the identity verdict.
 * - The unified Cloud JWT refresh timer, when `POST /api/auth/token` rejects
 *   the Firebase identity permanently.
 *
 * Idempotent: the voluntary sign-out path performs its own redirect, and this
 * may be reached concurrently with it.
 */
export function endExpiredSession(reason: string): void {
  if (!isCloud || terminated || isOnPublicRoute()) return
  terminated = true

  console.warn(`Cloud session ended (${reason}); returning to sign-in.`)

  try {
    window.location.href = '/cloud/login'
  } catch {
    window.location.reload()
  }
}
