/**
 * The billing transport for a host whose credentials it never holds: a BFF
 * that proxies the cloud API with server-held secrets on its own origin, or a
 * hosted app the backend has given a session cookie. The request carries
 * `credentials` and no `Authorization` header, and the scope comes from the
 * host's scope source rather than from a minted credential.
 *
 * There is no 401 retry here, because there is nothing this client can
 * re-mint. A 401 is returned as an HTTP answer like any other, marked
 * `authenticationNotRenewable` so that `codeForHttpStatus` reads it as the
 * host's session ending rather than a refusal: nothing was ever minted or
 * proved, so it says the credential expired, not that the user lacks access.
 * `authenticationRetrySkipped` stays unset; it means a replayable retry was
 * possible and skipped, which is never the case on this transport.
 *
 * Without a web session no CSRF header is sent. What stands in for one is
 * the JSON content type `exchangeBillingRequest` always sends: it makes
 * every request non-simple, so a cross-site caller has to clear a preflight
 * it cannot satisfy. That rests on the cookie's `SameSite` attribute and the
 * backend's CORS allowlist, neither of which is enforced here — sending a
 * form-encoded or otherwise CORS-simple request from this transport removes
 * the protection.
 * A host on the shared web session opts in through `webSession`: headers
 * then come from `authorize`, and a `csrf_invalid` answer is retried once
 * after re-reading the session, only while it still belongs to the same user.
 */
import type { RequestAuthorization, RequestAuthorizer } from '../requestAuth.js'
import type {
  WebSession,
  WebSessionErrorCode,
  WebSessionFailure,
  WebSessionResult
} from '../sessionContracts.js'
import type {
  BillingHttpResponse,
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import type { BillingScope, BillingScopeSource } from './billingScope.js'
import { sameBillingScope } from './billingScope.js'
import { readBillingErrorCode } from './billingErrorBody.js'
import {
  DEFAULT_BILLING_TIMEOUT_MS,
  exchangeBillingRequest,
  startRequestBudget
} from './transportExchange.js'

export interface CredentialedBillingTransportOptions {
  /** Resolves a route to an absolute URL, as the session transport's does. */
  readonly resolveUrl: (route: string) => string
  readonly scopeSource: BillingScopeSource
  /** Default `'include'`, so a cookie survives a cross-origin billing host. */
  readonly credentials?: RequestCredentials
  readonly fetchImpl?: typeof fetch
  readonly defaultTimeoutMs?: number
  /** Opt-in cookie-session headers; `credentials` is then ignored. */
  readonly webSession?: CredentialedWebSession
}

export interface CredentialedWebSession {
  readonly authorize: RequestAuthorizer
  readonly getSession: () => WebSession | undefined
  /** `readWebSession` bound to the host's ingest options. */
  readonly readSession: (request: {
    readonly expectedUserId: string
    readonly signal: AbortSignal
  }) => Promise<WebSessionResult>
}

type Exchange = BillingResult<BillingHttpResponse>

/**
 * Any scope other than the captured one supersedes the response, undefined
 * included. A source has no "still minting" state: undefined means the scope
 * is gone — a sign-out or a workspace teardown — which is how
 * `createBillingScopeTracker` reads it, and how the session transport reads a
 * delivered sign-out. Attributing the response anyway would land it in a
 * reader that has already dropped that scope.
 */
function movedOutOfScope(
  source: BillingScopeSource,
  captured: BillingScope
): boolean {
  const current = source.getScope()
  return current === undefined || !sameBillingScope(captured, current)
}

/**
 * A 401 reaching here means the host's credential is gone, not that access
 * was refused: this transport never held one to re-prove with.
 */
function markSessionEnded(response: BillingHttpResponse): BillingHttpResponse {
  if (response.httpStatus !== 401) return response
  return { ...response, authenticationNotRenewable: true }
}

const SESSION_ENDED: ReadonlySet<WebSessionErrorCode> = new Set([
  'NO_SESSION',
  'SESSION_EXPIRED',
  'SESSION_REVOKED'
])

function isCsrfInvalid(response: BillingHttpResponse): boolean {
  return (
    response.httpStatus === 403 &&
    readBillingErrorCode(response.body) === 'csrf_invalid'
  )
}

function rereadFailure({ code }: WebSessionFailure): Exchange {
  if (code === 'IDENTITY_CHANGED')
    return { status: 'error', code: 'SUPERSEDED' }
  return {
    status: 'error',
    code: SESSION_ENDED.has(code) ? 'NOT_AUTHENTICATED' : 'REQUEST_FAILED'
  }
}

/**
 * `csrf_invalid` is the one refusal a fresh token can fix, and the server
 * refused before acting, so the replay is safe for a write too. The re-read
 * is pinned to the user the request started as, and the retry to the
 * captured workspace: a changed user abandons the request rather than
 * finishing it as someone else.
 */
async function exchangeWithSession(
  request: BillingRequest,
  webSession: CredentialedWebSession,
  session: WebSession,
  context: {
    readonly workspaceId: string
    readonly signal: AbortSignal
    readonly stillInScope: () => boolean
    readonly send: (authorization: RequestAuthorization) => Promise<Exchange>
  }
): Promise<Exchange> {
  const sendAs = async (current: WebSession) => {
    const authorization = await webSession.authorize(
      { kind: 'session', session: current },
      {
        target: 'ingest',
        method: request.method,
        workspaceId: context.workspaceId
      }
    )
    return context.send(authorization)
  }

  const first = await sendAs(session)
  if (first.status === 'error' || !isCsrfInvalid(first.value)) return first
  if (!context.stillInScope()) return { status: 'error', code: 'SUPERSEDED' }

  const reread = await webSession.readSession({
    expectedUserId: session.user.id,
    signal: context.signal
  })
  if (reread.status === 'error') return rereadFailure(reread)
  if (!context.stillInScope()) return { status: 'error', code: 'SUPERSEDED' }
  return sendAs(reread.session)
}

export function createCredentialedBillingTransport(
  options: CredentialedBillingTransportOptions
): BillingTransport {
  const {
    resolveUrl,
    scopeSource,
    credentials = 'include',
    fetchImpl = fetch,
    defaultTimeoutMs = DEFAULT_BILLING_TIMEOUT_MS,
    webSession
  } = options

  type Send = (
    request: BillingRequest,
    captured: BillingScope,
    signal: AbortSignal
  ) => Promise<Exchange>

  const exchange = (
    request: BillingRequest,
    signal: AbortSignal,
    auth: {
      readonly credentials?: RequestCredentials
      readonly headers?: Readonly<Record<string, string>>
    }
  ) =>
    exchangeBillingRequest(request, {
      fetchImpl,
      url: resolveUrl(request.route),
      signal,
      ...auth
    })

  const sendPlain: Send = (request, _captured, signal) =>
    exchange(request, signal, { credentials })

  function sessionSender(session: WebSession | undefined): Send | undefined {
    if (webSession === undefined || session === undefined) return undefined
    return (request, captured, signal) =>
      exchangeWithSession(request, webSession, session, {
        workspaceId: captured.workspaceId,
        signal,
        stillInScope: () => !movedOutOfScope(scopeSource, captured),
        send: (authorization) => exchange(request, signal, authorization)
      })
  }

  return async function transport(
    request: BillingRequest
  ): Promise<BillingResult<BillingHttpResponse>> {
    const captured = scopeSource.getScope()
    const send =
      webSession === undefined
        ? sendPlain
        : sessionSender(webSession.getSession())
    if (captured === undefined || send === undefined) {
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }

    const budget = startRequestBudget(
      request.signal,
      request.timeoutMs ?? defaultTimeoutMs
    )
    try {
      const response = await send(request, captured, budget.signal)
      if (response.status === 'error') return response
      if (movedOutOfScope(scopeSource, captured)) {
        return { status: 'error', code: 'SUPERSEDED' }
      }
      return { status: 'ok', value: markSessionEnded(response.value) }
    } catch {
      return { status: 'error', code: 'REQUEST_FAILED' }
    } finally {
      budget.close()
    }
  }
}
