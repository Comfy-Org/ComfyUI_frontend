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

export type SessionRefreshOutcome =
  | 'succeeded'
  | 'retry_scheduled'
  | 'retries_exhausted'
  | 'permanent_failure'
  /** The credential reached its expiry after retries ran out; the client failed closed. */
  | 'expired'

export type SessionResult =
  | { readonly status: 'ok'; readonly session: AccountCredential }
  | {
      readonly status: 'error'
      readonly code: SessionErrorCode
      /** Set only when the failure came from an HTTP response, not aborted/network. */
      readonly httpStatus?: number
    }

export type SessionFailure = Extract<SessionResult, { status: 'error' }>

export interface MintHandle {
  readonly mintId: number
  readonly response: Promise<SessionResult>
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
   * Called with the outcome of every SCHEDULED refresh attempt (never a
   * login or caller-initiated mint), so a host can feed its refresh
   * telemetry without owning the scheduler. A permanent failure and an
   * expiry carry the failure the client committed, so the host never has
   * to read it back out of the snapshot.
   */
  readonly onScheduledOutcome?: (
    outcome: SessionRefreshOutcome,
    failure?: SessionFailure
  ) => void
}
