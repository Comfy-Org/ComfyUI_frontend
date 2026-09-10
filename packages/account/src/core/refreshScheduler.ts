/**
 * The proactive-refresh owner: an optional piece the session client hands
 * its lifecycle to when a host asks for scheduled refresh. It owns its own
 * timers, retry count and the expiry fail-close; it never holds session
 * state. It reads the client's live credential through the host and commits
 * a refreshed, failed or expired result back through the host, so the client
 * stays the single owner of `credential`/`failure` and this stays a driver.
 *
 * Extracted from createSessionClient so the mint/commit core can be reasoned
 * about without the scheduling machinery, and so a client with no
 * `refreshScheduler` option carries none of it.
 */
import type {
  AccountCredential,
  AccountUser,
  MintHandle,
  RefreshSchedulerOptions,
  SessionFailure
} from './session.js'
import { isPermanentSessionError } from './session.js'

const DEFAULT_BUFFER_MS = 5 * 60 * 1000

/** Guards captured before a scheduled mint, re-checked before its commit. */
export interface RefreshGuards {
  readonly epoch: number
  readonly invalidation: number
}

export interface RefreshHost {
  now: () => number
  getCurrentUser: () => AccountUser | null
  getCredential: () => AccountCredential | undefined
  captureGuards: () => RefreshGuards
  /** A scheduled mint's result may commit only if nothing superseded it. */
  guardsHold: (
    guards: RefreshGuards,
    user: AccountUser,
    mintId: number
  ) => boolean
  /** A forced mint for the target that produced the live credential. */
  mint: (user: AccountUser) => MintHandle
  commitRefreshed: (session: AccountCredential) => void
  commitPermanentFailure: (failure: SessionFailure) => void
  /** Clears iff the live credential is still `expiring`; returns what it committed. */
  commitExpired: (expiring: AccountCredential) => SessionFailure | undefined
}

export interface RefreshScheduler {
  /** A fresh credential committed: cancel the fail-close and arm the next refresh. */
  armAfterCommit: (session: AccountCredential, now: number) => void
  stop: () => void
}

export function createRefreshScheduler(
  options: RefreshSchedulerOptions,
  host: RefreshHost
): RefreshScheduler {
  const bufferMs = options.bufferMs ?? DEFAULT_BUFFER_MS
  const retryBaseMs = options.retryBaseMs ?? 5000
  const maxRetries = options.maxRetries ?? 3
  const reportOutcome = options.onScheduledOutcome

  let scheduledTimer: ReturnType<typeof setTimeout> | undefined
  /**
   * The hard fail-close for a credential whose refresh chain died. Its own
   * timer on purpose: re-arming the refresh (a retry, a promotion) must not
   * cancel it; only a committed credential or a teardown does.
   */
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  let scheduledRetryCount = 0

  function stopScheduledRefresh(): void {
    if (scheduledTimer !== undefined) {
      clearTimeout(scheduledTimer)
      scheduledTimer = undefined
    }
  }

  function clearExpiry(): void {
    if (expiryTimer !== undefined) {
      clearTimeout(expiryTimer)
      expiryTimer = undefined
    }
  }

  function armScheduledRefresh(expiresAt: number, now: number): void {
    stopScheduledRefresh()
    scheduledRetryCount = 0
    // Never tighter than one retry interval: a token already inside the
    // buffer (a host buffer at or above the TTL, a skewed clock) would
    // otherwise re-mint in a loop with no backoff.
    scheduledTimer = setTimeout(
      () => {
        scheduledTimer = undefined
        void runScheduledRefresh()
      },
      Math.max(retryBaseMs, expiresAt - bufferMs - now)
    )
  }

  /**
   * Retries are spent and the credential still has time on it: keep serving
   * it until its expiry instant, then fail closed and tell the host, as the
   * cloud store's clear-at-expiry does. A dead scheduler must never leave an
   * expired token in circulation.
   */
  function armClearAtExpiry(expiring: AccountCredential): void {
    const now = host.now()
    clearExpiry()
    expiryTimer = setTimeout(
      () => {
        expiryTimer = undefined
        const committed = host.commitExpired(expiring)
        if (!committed) return
        stopScheduledRefresh()
        reportOutcome?.('expired', committed)
      },
      Math.max(0, expiring.expiresAt - now)
    )
  }

  /**
   * The scheduled re-mint mirrors the cloud store's refresh semantics: a
   * transient failure keeps the still-valid credential and retries with
   * doubling backoff; a permanent failure commits the error; exhausted
   * retries keep the credential until it expires, then fail closed. Every
   * commit runs publish() before reporting its outcome — host outcome
   * handlers read state the publish just wrote.
   */
  async function runScheduledRefresh(): Promise<void> {
    const user = host.getCurrentUser()
    if (!user) return
    const guards = host.captureGuards()
    // Refresh with the target that produced the live credential, so a
    // scheduled refresh reproduces the same session AND coalesces with any
    // concurrent reactive re-mint for it.
    const { mintId, response } = host.mint(user)
    let result
    try {
      result = await response
    } catch {
      result = { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' } as const
    }
    if (!host.guardsHold(guards, user, mintId)) return
    if (result.status === 'ok') {
      clearExpiry()
      host.commitRefreshed(result.session)
      armScheduledRefresh(result.session.expiresAt, host.now())
      reportOutcome?.('succeeded')
      return
    }
    if (isPermanentSessionError(result.code)) {
      host.commitPermanentFailure(result)
      reportOutcome?.('permanent_failure', result)
      return
    }
    if (scheduledRetryCount >= maxRetries) {
      const live = host.getCredential()
      if (live !== undefined) armClearAtExpiry(live)
      reportOutcome?.('retries_exhausted')
      return
    }
    const delay = retryBaseMs * 2 ** scheduledRetryCount
    scheduledRetryCount += 1
    stopScheduledRefresh()
    scheduledTimer = setTimeout(() => {
      scheduledTimer = undefined
      void runScheduledRefresh()
    }, delay)
    reportOutcome?.('retry_scheduled')
  }

  return {
    armAfterCommit(session, now) {
      clearExpiry()
      armScheduledRefresh(session.expiresAt, now)
    },
    stop() {
      stopScheduledRefresh()
      clearExpiry()
    }
  }
}
