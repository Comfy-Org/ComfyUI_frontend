/**
 * The contracts the session client shares with the pieces it composes
 * (`exchange`, `refreshScheduler`). Dependency-neutral by design: `session.ts`
 * depends on those pieces, and they depend only on this module, never back on
 * the client — so no top-level binding is ever read before it initializes.
 */
import type { zExchangeTokenResponse } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

export interface AccountUser {
  readonly uid: string
  getIdToken: () => Promise<string>
}

/** Field types come from the generated POST /api/auth/token contract. */
type ExchangeTokenResponse = z.infer<typeof zExchangeTokenResponse>

export interface AccountCredential {
  readonly token: string
  /** ms since epoch */
  readonly expiresAt: number
  readonly uid: string
  readonly workspace: ExchangeTokenResponse['workspace']
  readonly role: ExchangeTokenResponse['role']
  readonly permissions: readonly string[]
}

/**
 * The production store's error taxonomy (`WorkspaceAuthError` codes),
 * emitted as codes only — the host localizes. TOKEN_EXCHANGE_FAILED also
 * covers unparseable bodies, network failures, aborts, and timeouts: a
 * request that produced no usable credential is one failure bucket in
 * production, not three.
 */
export type SessionErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'INVALID_FIREBASE_TOKEN'
  | 'ACCESS_DENIED'
  | 'WORKSPACE_NOT_FOUND'
  | 'TOKEN_EXCHANGE_FAILED'

const PERMANENT_ERROR_CODES: ReadonlySet<SessionErrorCode> = new Set([
  'ACCESS_DENIED',
  'WORKSPACE_NOT_FOUND',
  'INVALID_FIREBASE_TOKEN',
  'NOT_AUTHENTICATED'
])

export function isPermanentSessionError(code: SessionErrorCode): boolean {
  return PERMANENT_ERROR_CODES.has(code)
}

export type SessionResult =
  | { readonly status: 'ok'; readonly session: AccountCredential }
  | {
      readonly status: 'error'
      readonly code: SessionErrorCode
      /** Set only when the failure came from an HTTP response, not aborted/network. */
      readonly httpStatus?: number
    }

export type SessionFailure = Extract<SessionResult, { status: 'error' }>

/**
 * The result of one SCHEDULED refresh attempt as a single tagged value: the
 * outcomes that committed a failure carry it and the rest structurally cannot,
 * so a permanent failure without its error — or a success with one — cannot be
 * represented.
 *
 * `failure?: never` is what makes "structurally cannot" true rather than
 * aspirational. Without it, excess-property checking still rejects a bad
 * object literal, but a report built in a variable or returned from a helper
 * assigns cleanly.
 */
export type ScheduledRefreshReport =
  | { readonly outcome: 'succeeded'; readonly failure?: never }
  | { readonly outcome: 'retry_scheduled'; readonly failure?: never }
  | { readonly outcome: 'retries_exhausted'; readonly failure?: never }
  | { readonly outcome: 'permanent_failure'; readonly failure: SessionFailure }
  /** Retries ran out and the credential reached expiry; the client failed closed. */
  | { readonly outcome: 'expired'; readonly failure: SessionFailure }

/** The outcome discriminants a scheduled refresh can report. */
export type SessionRefreshOutcome = ScheduledRefreshReport['outcome']

export interface MintHandle {
  readonly mintId: number
  readonly response: Promise<SessionResult>
}

/**
 * Cross-tab refresh coordination. One tab per (uid, workspace) key holds the
 * lease and performs the proactive refresh; the others adopt its published
 * credential and mint for themselves only when the leader goes quiet past
 * their jittered fallback. Real hosts wrap Web Locks + BroadcastChannel
 * (`createWebCrossTabRefreshPort` from `@comfyorg/account-core/web`); tests pass
 * fakes.
 */
export interface CrossTabRefreshPort {
  /**
   * Queue for the key's lease. `onAcquired` fires if and when this tab
   * becomes leader; the returned function abandons the request or releases
   * held leadership.
   */
  requestLeadership: (key: string, onAcquired: () => void) => () => void
  publishCredential: (key: string, credential: AccountCredential) => void
  /** Messages cross a serialization boundary; the client validates them. */
  onCredential: (
    key: string,
    callback: (message: unknown) => void
  ) => () => void
}

/**
 * Opt-in proactive refresh, mirroring the cloud store's scheduled-refresh
 * semantics (its buffer, retry base, and retry cap are the defaults): arm at
 * expiry minus the buffer, retry transient failures with doubling backoff,
 * stop on sign-out, detach, or a permanent failure. Hosts whose consumers
 * read the token synchronously need this; valid-on-read hosts do not.
 */
export interface RefreshSchedulerOptions {
  readonly bufferMs?: number
  readonly retryBaseMs?: number
  readonly maxRetries?: number
  /**
   * Cross-tab coordination (opt-in): the leader tab refreshes and publishes;
   * followers adopt the published credential and fall back to their own mint
   * only after a bounded random hold past the refresh point.
   */
  readonly crossTab?: {
    readonly port: CrossTabRefreshPort
    /** Upper bound for the follower's random hold. Default 15s. */
    readonly followerJitterMs?: number
    /**
     * Fires when this tab commits a sibling's credential. Adoption is a
     * rotation the tab did not perform itself, so a host that reacts to
     * rotations (cookie refresh, extension hooks) needs this signal.
     */
    readonly onCredentialAdopted?: (credential: AccountCredential) => void
  }
  /**
   * Called with the result of every SCHEDULED refresh attempt (never a
   * login or caller-initiated mint), so a host can feed its refresh
   * telemetry without owning the scheduler. A permanent failure and an
   * expiry carry the failure the client committed, so the host never has
   * to read it back out of the snapshot.
   */
  readonly onScheduledOutcome?: (report: ScheduledRefreshReport) => void
}

/** The signed-in principal behind the shared `__Host-comfy_session` cookie. */
export interface WebSessionUser {
  readonly id: string
  readonly email: string
  readonly name?: string
  readonly emailVerified: boolean
  readonly signInProvider?: string
}

export interface WebSession {
  readonly user: WebSessionUser
  readonly csrfToken: string
  /** ms since epoch; the sliding idle expiry */
  readonly expiresAt: number
  /** ms since epoch; the hard cap regardless of activity */
  readonly absoluteExpiresAt: number
}

/**
 * `SESSION_UNAVAILABLE` is the only transient code: 429, 5xx, network,
 * abort, and unreadable bodies land there so an outage never reads as a
 * sign-out. `SESSION_REQUEST_REFUSED` is a request no fresh session can fix.
 */
export type WebSessionErrorCode =
  | 'NO_SESSION'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'CSRF_STALE'
  | 'IDENTITY_CHANGED'
  | 'WORKSPACE_ACCESS_DENIED'
  | 'SESSION_REQUEST_REFUSED'
  | 'SESSION_UNAVAILABLE'

export interface WebSessionFailure {
  readonly status: 'error'
  readonly code: WebSessionErrorCode
  readonly retryable: boolean
  readonly httpStatus?: number
  /** The server's `ErrorResponse.code`, when the body carried one. */
  readonly serverCode?: string
}

export type WebSessionResult =
  | { readonly status: 'ok'; readonly session: WebSession }
  | WebSessionFailure

export type WebSessionCommandResult =
  | { readonly status: 'ok' }
  | WebSessionFailure
