/**
 * The proactive-refresh owner: an optional piece the session client hands
 * its lifecycle to when a host asks for scheduled refresh. It owns its own
 * timers, retry count, the expiry fail-close, and (when a cross-tab port is
 * given) the lease, leadership and sibling adoption. It never holds session
 * state: it reads the client's live credential through the host and commits
 * a refreshed, failed, expired or adopted result back through the host, so
 * the client stays the single owner of `credential`/`failure`.
 *
 * Extracted from createSessionClient so the mint/commit core can be reasoned
 * about without the scheduling and cross-tab machinery, and so a client with
 * no `refreshScheduler` option carries none of it.
 */
import type {
  AccountCredential,
  AccountUser,
  MintHandle,
  RefreshSchedulerOptions,
  SessionFailure
} from './sessionContracts.js'
import { isPermanentSessionError } from './sessionContracts.js'

const DEFAULT_BUFFER_MS = 5 * 60 * 1000

/** Guards captured before a scheduled mint, re-checked before its commit. */
interface RefreshGuards {
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
  /** Returns a failure when the refreshed session was rejected (wrong scope). */
  commitRefreshed: (session: AccountCredential) => SessionFailure | undefined
  commitPermanentFailure: (failure: SessionFailure) => void
  /** Clears iff the live credential is still `expiring`; returns what it committed. */
  commitExpired: (expiring: AccountCredential) => SessionFailure | undefined
  /** Parse a cross-tab message into a credential, or undefined if malformed. */
  parseAdopted: (message: unknown) => AccountCredential | undefined
  /** Commit a sibling's credential: supersede any in-flight mint, persist, publish. */
  commitAdopted: (session: AccountCredential) => void
}

export interface RefreshScheduler {
  /** A fresh credential committed: cancel the fail-close, arm the next refresh, tell siblings. */
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
  const crossTab = options.crossTab
  const followerJitterMs = crossTab?.followerJitterMs ?? 15_000

  let scheduledTimer: ReturnType<typeof setTimeout> | undefined
  /**
   * The hard fail-close for a credential whose refresh chain died. Its own
   * timer on purpose: re-arming the refresh (a retry, a promotion) must not
   * cancel it; only a committed credential or a teardown does.
   */
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  let scheduledRetryCount = 0
  /** Without coordination every tab is its own leader. */
  let isRefreshLeader = crossTab === undefined
  let coordinationKey: string | undefined
  /**
   * Bumped on every coordination teardown. A leadership grant landing on an
   * abandoned request carries the generation it was issued under — the key
   * string alone cannot distinguish an abandoned request from its same-key
   * successor after a sign-out/sign-in round trip.
   */
  let coordinationGeneration = 0
  let armingScheduledRefresh = false
  let releaseLeadership: (() => void) | undefined
  let stopCredentialFeed: (() => void) | undefined

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

  function teardownCoordination(): void {
    coordinationGeneration += 1
    releaseLeadership?.()
    releaseLeadership = undefined
    stopCredentialFeed?.()
    stopCredentialFeed = undefined
    coordinationKey = undefined
    isRefreshLeader = crossTab === undefined
  }

  function ensureCoordination(): void {
    const credential = host.getCredential()
    if (crossTab === undefined || credential === undefined) return
    // Keyed by the SERVER-RESOLVED workspace, never the requested target: a
    // personal {} mint resolves to a concrete workspace the target string
    // cannot name, and tabs on one workspace must share one lease however
    // they reached it.
    const key = `comfy-account-refresh:${credential.uid}:${credential.workspace.id}`
    if (key === coordinationKey) return
    teardownCoordination()
    coordinationKey = key
    const generationAtRequest = coordinationGeneration
    stopCredentialFeed = crossTab.port.onCredential(
      key,
      adoptPublishedCredential
    )
    releaseLeadership = crossTab.port.requestLeadership(key, () => {
      // A grant is honored only for the coordination generation that issued
      // the request: abandoned requests can still win the grant race in the
      // lock manager, and after a same-user round trip their key is
      // byte-identical to the live request's.
      if (generationAtRequest !== coordinationGeneration) return
      isRefreshLeader = true
      // Promotion retakes the schedule unconditionally — the follower timer
      // may be jittered, mid-retry, or already dead from exhausted retries.
      // The latch skips the redundant re-arm when the grant fires
      // synchronously inside armScheduledRefresh itself.
      const live = host.getCredential()
      if (live !== undefined && !armingScheduledRefresh) {
        armScheduledRefresh(live.expiresAt, host.now())
      }
    })
  }

  /**
   * Every committed mint is published once a coordination key exists —
   * leadership gates adoption, never publication — so the reactive 401
   * re-mint and a leaderless follower's fallback reach siblings too: those
   * are exactly the rotations they must not miss. Adoption itself never
   * republishes, and the monotonic-expiry guard makes redelivery a no-op,
   * so the channel cannot loop.
   */
  function publishToSiblings(session: AccountCredential): void {
    if (coordinationKey === undefined) return
    crossTab?.port.publishCredential(coordinationKey, session)
  }

  function adoptPublishedCredential(message: unknown): void {
    // Any tab adopts a strictly newer credential, the leader included: a
    // leader whose own chain died recovers from a sibling's fallback mint,
    // and the monotonic-expiry check keeps the channel from looping.
    const next = host.parseAdopted(message)
    if (next === undefined) return
    if (host.getCurrentUser()?.uid !== next.uid) return
    // Scope check: the channel key cannot fully encode the workspace (the
    // personal target is server-resolved), so a same-user credential minted
    // for a DIFFERENT workspace must never switch this tab.
    const credential = host.getCredential()
    if (credential === undefined) return
    if (next.workspace.id !== credential.workspace.id) return
    if (next.expiresAt <= credential.expiresAt) return
    clearExpiry()
    host.commitAdopted(next)
    armScheduledRefresh(next.expiresAt, host.now())
    crossTab?.onCredentialAdopted?.(next)
  }

  function armScheduledRefresh(expiresAt: number, now: number): void {
    stopScheduledRefresh()
    scheduledRetryCount = 0
    armingScheduledRefresh = true
    try {
      ensureCoordination()
    } finally {
      armingScheduledRefresh = false
    }
    // A follower holds past the leader's refresh point by bounded random
    // jitter; when no published credential has arrived by then, the leader
    // is gone and this tab refreshes for itself. Never tighter than one
    // retry interval: a token already inside the buffer (a host buffer at
    // or above the TTL, a skewed clock) would otherwise re-mint in a loop.
    const jitter = isRefreshLeader ? 0 : Math.random() * followerJitterMs
    scheduledTimer = setTimeout(
      () => {
        scheduledTimer = undefined
        void runScheduledRefresh()
      },
      Math.max(retryBaseMs, expiresAt - bufferMs - now) + jitter
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
      const rejected = host.commitRefreshed(result.session)
      if (rejected) {
        reportOutcome?.('permanent_failure', rejected)
        return
      }
      clearExpiry()
      armScheduledRefresh(result.session.expiresAt, host.now())
      publishToSiblings(result.session)
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
      // A leader with a dead chain must not sit on the lease: release it so
      // a sibling can lead, and queue again as a follower so this tab can
      // adopt what that sibling mints or be promoted back if nobody does.
      teardownCoordination()
      ensureCoordination()
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
      publishToSiblings(session)
    },
    stop() {
      stopScheduledRefresh()
      clearExpiry()
      teardownCoordination()
    }
  }
}
