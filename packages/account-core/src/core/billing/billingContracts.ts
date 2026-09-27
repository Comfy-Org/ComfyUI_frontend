/**
 * The contracts the billing core shares with its hosts. Dependency-neutral
 * by design, the same way `sessionContracts` is: the transport and the typed
 * operations depend on this module, never back on each other.
 *
 * Billing reports failures as coded results rather than thrown errors. The
 * codes carry no text; the copy that belongs to each code is owned by the
 * billing core and localized by the host. Two server values cross this
 * boundary. `serverCode` is a machine identifier and never copy: a command
 * matches it against its own closed set, and a host stores it where it
 * already keeps `WorkspaceApiError.code`. Its brand makes it unforgeable:
 * only the response decoder mints one, and `unwrapServerCode` names the one
 * sanctioned widening. `serverMessage` is the sentence the server wrote for
 * the customer, carried so a host can show it the way the legacy client does;
 * nothing in the core branches on it.
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
  /**
   * The server already had an operation of this kind pending that this
   * attempt did not issue. Refusing is the only honest answer: the status
   * response names no plan, so joining it would settle whatever the earlier
   * attempt chose and report it as this caller's success. Unlike the others
   * this one never comes from a response; the command declines before it
   * sends anything.
   */
  | 'OPERATION_ALREADY_PENDING'

declare const billingServerCodeBrand: unique symbol

/**
 * An unbounded server string that is only ever a machine identifier. Nothing
 * outside `readBillingErrorCode` mints one, so a command cannot invent a code
 * to match. The value stays a `string` underneath: `matchesServerCode` and
 * `unwrapServerCode` name the sanctioned uses rather than making the string
 * unreadable.
 */
export type BillingServerCode = string & {
  readonly [billingServerCodeBrand]: true
}

export type BillingFailure = {
  readonly status: 'error'
  readonly code: BillingErrorCode
  /** Set only when the failure came from an HTTP response. */
  readonly httpStatus?: number
  /**
   * The coded `code` of a generated `ErrorResponse` body, when the server
   * sent one. It is the only server value a command branches on. Compare it
   * through `matchesServerCode`, and widen it through `unwrapServerCode` at
   * a host's error-store boundary. Never render it.
   */
  readonly serverCode?: BillingServerCode
  /**
   * The `message` of that same `ErrorResponse`, present when the server sent
   * a non-empty one. This is what a host shows the customer; the legacy
   * client shows the same string.
   */
  readonly serverMessage?: string
}

/** Whether a failure carries the server code a command names. */
export function matchesServerCode(
  failure: Pick<BillingFailure, 'serverCode'>,
  code: string
): boolean {
  return failure.serverCode === code
}

/**
 * The one widening back to `string`, for a host storing the code beside the
 * codes it already keeps. Rendering it is still a contract violation.
 */
export function unwrapServerCode(code: BillingServerCode): string {
  return code
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
   * True when the transport holds no credential of its own to re-prove with,
   * so a 401 is the host's session ending rather than a refusal.
   */
  readonly authenticationNotRenewable?: true
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
