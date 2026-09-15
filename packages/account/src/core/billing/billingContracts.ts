/**
 * The contracts the billing core shares with its hosts. Dependency-neutral
 * by design, the same way `sessionContracts` is: the transport and the typed
 * operations depend on this module, never back on each other.
 *
 * Billing reports failures as coded results rather than thrown errors, so a
 * caller cannot accidentally surface a server or payment-provider string to a
 * user. The codes carry no server text; the copy that belongs to each code is
 * owned by the billing core and localized by the host. The one server value
 * that crosses this boundary is `serverCode`, a machine identifier and never
 * copy: a command matches it against its own closed set, and a host stores it
 * where it already keeps `WorkspaceApiError.code`.
 */
import type { SessionClient } from '../session.js'

/**
 * The session members the billing core reaches for. A host's client is typed
 * for its own user, and the identity seam is contravariant in that user, so
 * requiring the full client would reject every host whose user is more
 * specific than the base.
 */
export type BillingSession = Pick<
  SessionClient,
  'getSnapshot' | 'subscribe' | 'ensureFresh' | 'remint'
>

/**
 * The failure buckets a billing request can produce, extracted from what the
 * cloud app's `workspaceApi` callers actually distinguish today.
 * REQUEST_FAILED is the transient bucket: 5xx, a network failure, an abort,
 * and a timeout are one failure for a caller, exactly as they are in the
 * session client's `TOKEN_EXCHANGE_FAILED`.
 */
export type BillingErrorCode =
  /** Nobody is signed in, or the identity could not produce a token. */
  | 'NOT_AUTHENTICATED'
  /** A 401 that survived the one re-mint retry, or a 403. */
  | 'ACCESS_DENIED'
  | 'NOT_FOUND'
  /** A business-level 409 — never a missing customer, which self-heals. */
  | 'CONFLICT'
  /** The identity or workspace changed while the request was in flight. */
  | 'SUPERSEDED'
  | 'REQUEST_FAILED'
  /** A 2xx whose body does not match the generated contract. */
  | 'MALFORMED_RESPONSE'

export type BillingFailure = {
  readonly status: 'error'
  readonly code: BillingErrorCode
  /** Set only when the failure came from an HTTP response. */
  readonly httpStatus?: number
  /**
   * The coded `code` of a generated `ErrorResponse` body, when the server
   * sent one. Its `message` is dropped on purpose: a command acts on codes
   * it names, never on server text. Never render it; the contract does not
   * bound its shape, so it is a value to match, not to show.
   */
  readonly serverCode?: string
}

export type BillingResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | BillingFailure

interface BillingRequestBase {
  /** Route below the host's billing base, e.g. `/billing/topup`. */
  readonly route: string
  /**
   * Present on a write whose replay the backend deduplicates. It is also
   * what makes a 401 retry safe: see `createSessionBillingTransport`.
   */
  readonly idempotencyKey?: string
  readonly signal?: AbortSignal
  /** Total budget for session minting, retries, and reading the response. */
  readonly timeoutMs?: number
}

export type BillingRequest = BillingRequestBase &
  (
    | { readonly method: 'GET'; readonly body?: never }
    | { readonly method: 'POST'; readonly body?: unknown }
  )

export interface BillingHttpResponse {
  readonly httpStatus: number
  readonly body: unknown
  /** True when a 401 could not be retried because the write was not replayable. */
  readonly authenticationRetrySkipped?: true
  /**
   * Response header reader. The capability revision a mutation reports
   * (`X-Capability-Revision`) reaches the capabilities cache through this,
   * mirroring the cloud app's `attachCapabilityRevisionInterceptor`. It is
   * absent whenever CORS is bypassed, so every reader treats a missing
   * header as "no revision reported" rather than assuming presence.
   */
  readonly header: (name: string) => string | null
}

/**
 * One request, credentials included. An HTTP answer of any status is an `ok`
 * result — only a failure that produced no response at all (no session,
 * network, abort, timeout) is an `error`, so the typed operations above it
 * own the status-to-code mapping in one place.
 */
export type BillingTransport = (
  request: BillingRequest
) => Promise<BillingResult<BillingHttpResponse>>
