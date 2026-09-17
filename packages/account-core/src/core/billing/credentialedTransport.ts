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
 * No CSRF header is sent. What stands in for one is the JSON content type
 * `exchangeBillingRequest` always sends: it makes every request non-simple,
 * so a cross-site caller has to clear a preflight it cannot satisfy. That
 * rests on the cookie's `SameSite` attribute and the backend's CORS
 * allowlist, neither of which is enforced here — sending a form-encoded or
 * otherwise CORS-simple request from this transport removes the protection.
 * A CSRF header is added here when the backend names one.
 */
import type {
  BillingHttpResponse,
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import type { BillingScope, BillingScopeSource } from './billingScope.js'
import { sameBillingScope } from './billingScope.js'
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
}

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

export function createCredentialedBillingTransport(
  options: CredentialedBillingTransportOptions
): BillingTransport {
  const {
    resolveUrl,
    scopeSource,
    credentials = 'include',
    fetchImpl = fetch,
    defaultTimeoutMs = DEFAULT_BILLING_TIMEOUT_MS
  } = options

  return async function transport(
    request: BillingRequest
  ): Promise<BillingResult<BillingHttpResponse>> {
    const captured = scopeSource.getScope()
    if (captured === undefined) {
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }

    const budget = startRequestBudget(
      request.signal,
      request.timeoutMs ?? defaultTimeoutMs
    )
    try {
      const response = await exchangeBillingRequest(request, {
        fetchImpl,
        url: resolveUrl(request.route),
        signal: budget.signal,
        credentials
      })
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
