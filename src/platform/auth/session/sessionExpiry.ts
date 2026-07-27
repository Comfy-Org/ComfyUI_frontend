import { FirebaseError } from 'firebase/app'
import type { User } from 'firebase/auth'
import { AuthErrorCodes } from 'firebase/auth'

import type * as SessionCookie from '@/platform/auth/session/useSessionCookie'
import { isCloud } from '@/platform/distribution/types'
import type * as AuthStore from '@/stores/authStore'

/**
 * `unknown` is deliberately distinct from `dead`: an oracle we could not reach
 * says nothing about the session, and signing a user out because their network
 * dropped is the same false positive as signing them out on a single 401.
 */
type SessionVerdict = 'alive' | 'dead' | 'unknown'

/** Firebase refusing to re-issue a token is a verdict, not a hint. */
const REVOKED_IDENTITY_CODES: ReadonlySet<string> = new Set([
  AuthErrorCodes.TOKEN_EXPIRED,
  AuthErrorCodes.USER_DISABLED,
  AuthErrorCodes.USER_DELETED,
  AuthErrorCodes.INVALID_AUTH,
  AuthErrorCodes.USER_SIGNED_OUT
])

/**
 * Bounds oracle traffic when a single endpoint 401s on a poll loop while the
 * session itself is healthy — without it, every poll would re-probe.
 */
const INVESTIGATION_COOLDOWN_MS = 60_000

/**
 * The session mint shares a serialized mutation queue with no request timeout,
 * so a stalled prior mutation could otherwise pin the shared investigation
 * promise forever and leave every later report awaiting a verdict that never
 * arrives.
 */
const INVESTIGATION_TIMEOUT_MS = 15_000

let terminated = false
let investigation: Promise<SessionVerdict> | null = null
let nextInvestigationAllowedAt = 0

/**
 * True once the session has been judged dead. Request seams check this to stop
 * generating traffic in the window between the verdict and the redirect.
 */
export function isSessionTerminated(): boolean {
  return terminated
}

let authStoreModule: Promise<typeof AuthStore | null> | null = null
let sessionCookieModule: Promise<typeof SessionCookie | null> | null = null

/**
 * Every module this file needs is loaded lazily to keep `@/scripts/api` (which
 * imports this one) out of the static graph. Both loaders memoize, so a burst
 * of 401s issues one import rather than one per report, and both swallow their
 * own failure so no caller of {@link reportUnauthorized} can see a rejection.
 * A failed load clears the memo so a later report can retry.
 */
function loadAuthStore(): Promise<typeof AuthStore | null> {
  authStoreModule ??= import('@/stores/authStore').catch((error: unknown) => {
    console.warn('Session expiry could not load the auth store:', error)
    authStoreModule = null
    return null
  })
  return authStoreModule
}

function loadSessionCookie(): Promise<typeof SessionCookie | null> {
  sessionCookieModule ??=
    import('@/platform/auth/session/useSessionCookie').catch(
      (error: unknown) => {
        console.warn('Session expiry could not load the session cookie:', error)
        sessionCookieModule = null
        return null
      }
    )
  return sessionCookieModule
}

/**
 * Asks the identity provider for a genuinely fresh token. A forced refresh is
 * what separates "stale by the clock" from "revoked": an unforced read is
 * happy to hand back a cached token the server has already rejected.
 */
async function refreshIdentity(user: User): Promise<SessionVerdict> {
  try {
    await user.getIdToken(true)
    return 'alive'
  } catch (error) {
    return error instanceof FirebaseError &&
      REVOKED_IDENTITY_CODES.has(error.code)
      ? 'dead'
      : 'unknown'
  }
}

/**
 * Re-establishes the session cookie from the freshly refreshed identity. This
 * is both the probe and the repair: success means the stale cookie has just
 * been replaced, so the 401 that triggered us was endpoint-specific.
 *
 * Only 401 is a dead verdict. A 403 here means the identity was accepted and
 * the authorization refused — this repo decodes the two apart on its sibling
 * auth endpoint — and by this point a forced refresh has already proven the
 * identity live.
 */
async function probeSession(): Promise<SessionVerdict> {
  const sessionCookie = await loadSessionCookie()
  if (!sessionCookie) return 'unknown'

  try {
    await sessionCookie.useSessionCookie().createSessionOrThrow()
    return 'alive'
  } catch (error) {
    return error instanceof sessionCookie.SessionRequestError &&
      error.status === 401
      ? 'dead'
      : 'unknown'
  }
}

async function consultOracles(user: User): Promise<SessionVerdict> {
  const identity = await refreshIdentity(user)
  return identity === 'alive' ? probeSession() : identity
}

async function investigate(user: User): Promise<SessionVerdict> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<SessionVerdict>((resolve) => {
    timer = setTimeout(() => resolve('unknown'), INVESTIGATION_TIMEOUT_MS)
  })

  try {
    return await Promise.race([consultOracles(user), timeout])
  } finally {
    clearTimeout(timer)
  }
}

function redirectToLogin(): void {
  try {
    window.location.href = '/cloud/login'
  } catch {
    window.location.reload()
  }
}

/**
 * The redirect is the user's only way out of a terminated session, so it runs
 * in a `finally`: once the latch is set, every cloud request short-circuits,
 * and a teardown that threw on its way to the redirect would strand the app
 * in exactly the dead-end this module exists to end.
 */
async function terminate(): Promise<void> {
  if (terminated) return
  terminated = true

  try {
    const [sessionCookie, authStore] = await Promise.all([
      loadSessionCookie(),
      loadAuthStore()
    ])
    await sessionCookie?.useSessionCookie().deleteSession()
    await authStore?.useAuthStore().logout()
  } catch (error) {
    console.warn('Session expiry teardown failed:', error)
  } finally {
    redirectToLogin()
  }
}

/**
 * Entry point for every cloud request that came back `401`.
 *
 * A 401 is a trigger, never a verdict: this codebase already treats an isolated
 * 401 as transient, and endpoints can refuse for reasons that have nothing to
 * do with the session. So a report only opens an investigation, and only the
 * authoritative oracles above may conclude the session is dead.
 *
 * The trigger is "we believe we are signed in, yet the server said 401" rather
 * than "this request carried a bearer token". A revoked identity stops
 * producing tokens entirely, so gating on the token would go blind at exactly
 * the moment the session is worst. An anonymous 401 has no signed-in user and
 * returns here untouched, leaving the normal logged-out path alone.
 *
 * Concurrent reports share one investigation and termination latches, so a poll
 * loop firing hundreds of 401s produces a single logout and redirect. Never
 * rejects: callers fire it without awaiting.
 */
export async function reportUnauthorized(): Promise<void> {
  if (!isCloud || terminated) return

  const authStore = await loadAuthStore()
  const user = authStore?.useAuthStore().currentUser
  if (!user) return

  if (!investigation) {
    if (Date.now() < nextInvestigationAllowedAt) return
    investigation = investigate(user).finally(() => {
      investigation = null
      nextInvestigationAllowedAt = Date.now() + INVESTIGATION_COOLDOWN_MS
    })
  }

  if ((await investigation) === 'dead') await terminate()
}
