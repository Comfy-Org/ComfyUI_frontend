/**
 * The contracts the billing core shares with its hosts. Dependency-neutral
 * by design, the same way `sessionContracts` is: the transport and the typed
 * operations depend on this module, never back on each other.
 *
 * Billing reports failures as coded results rather than thrown errors, so a
 * caller cannot accidentally surface a server or payment-provider string to a
 * user. The codes carry no server text; the copy that belongs to each code is
 * owned by the billing core and localized by the host.
 */

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
}

export type BillingResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | BillingFailure

export interface BillingRequest {
  readonly method: 'GET' | 'POST'
  /** Route below the host's billing base, e.g. `/billing/topup`. */
  readonly route: string
  readonly body?: unknown
  /**
   * Present on a write whose replay the backend deduplicates. It is also
   * what makes a 401 retry safe: see `createSessionBillingTransport`.
   */
  readonly idempotencyKey?: string
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export interface BillingHttpResponse {
  readonly httpStatus: number
  readonly body: unknown
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
