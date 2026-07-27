import { FirebaseError } from 'firebase/app'
import { AuthErrorCodes } from 'firebase/auth'

import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'

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

const REVOKED_SESSION_STATUSES: ReadonlySet<number> = new Set([401, 403])

/**
 * Bounds oracle traffic when a single endpoint 401s on a poll loop while the
 * session itself is healthy — without it, every poll would re-probe.
 */
const INVESTIGATION_COOLDOWN_MS = 60_000

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

/**
 * Asks the identity provider for a genuinely fresh token. A forced refresh is
 * what separates "stale by the clock" from "revoked": an unforced read is
 * happy to hand back a cached token the server has already rejected.
 */
async function refreshIdentity(): Promise<SessionVerdict> {
  const { useAuthStore } = await import('@/stores/authStore')
  const user = useAuthStore().currentUser
  if (!user) return 'unknown'

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
 */
async function probeSession(): Promise<SessionVerdict> {
  const { SessionRequestError, useSessionCookie } =
    await import('@/platform/auth/session/useSessionCookie')

  try {
    await useSessionCookie().createSessionOrThrow()
    return 'alive'
  } catch (error) {
    return error instanceof SessionRequestError &&
      REVOKED_SESSION_STATUSES.has(error.status)
      ? 'dead'
      : 'unknown'
  }
}

async function investigate(): Promise<SessionVerdict> {
  const identity = await refreshIdentity()
  return identity === 'alive' ? probeSession() : identity
}

async function terminate(): Promise<void> {
  if (terminated) return
  terminated = true

  const [{ useToastStore }, { useSessionCookie }, { useAuthStore }] =
    await Promise.all([
      import('@/platform/updates/common/toastStore'),
      import('@/platform/auth/session/useSessionCookie'),
      import('@/stores/authStore')
    ])

  useToastStore().add({
    severity: 'warn',
    summary: t('auth.sessionExpired.title'),
    detail: t('auth.sessionExpired.detail')
  })

  try {
    await useSessionCookie().deleteSession()
    await useAuthStore().logout()
  } catch (error) {
    console.warn('Session expiry teardown failed:', error)
  }

  window.location.href = '/cloud/login'
}

/**
 * Entry point for every authenticated cloud request that came back `401`.
 *
 * A 401 is a trigger, never a verdict: this codebase already treats an isolated
 * 401 as transient, and endpoints can refuse for reasons that have nothing to
 * do with the session. So a report only opens an investigation, and only the
 * authoritative oracles above may conclude the session is dead. Concurrent
 * reports share one investigation, and termination runs at most once, so a
 * poll loop firing hundreds of 401s produces a single logout and redirect.
 */
export async function reportUnauthorized(): Promise<void> {
  if (!isCloud || terminated) return

  if (!investigation) {
    if (Date.now() < nextInvestigationAllowedAt) return
    investigation = investigate().finally(() => {
      investigation = null
      nextInvestigationAllowedAt = Date.now() + INVESTIGATION_COOLDOWN_MS
    })
  }

  if ((await investigation) === 'dead') await terminate()
}
