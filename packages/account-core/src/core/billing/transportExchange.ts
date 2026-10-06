/**
 * What every billing transport does identically, regardless of how the
 * request is credentialed: hold one timeout budget over the whole exchange,
 * send the request, and shape any answer into a `BillingHttpResponse`.
 *
 * Only the credential differs between transports, so only the credential
 * lives in them; keeping the budget and the response shaping here is what
 * lets a bearer-token host and a cookie host report the same failures.
 */
import type {
  BillingHttpResponse,
  BillingRequest,
  BillingResult
} from './billingContracts.js'

export const DEFAULT_BILLING_TIMEOUT_MS = 30_000

export function startRequestBudget(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number
) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (callerSignal?.aborted === true) {
    controller.abort()
  } else {
    callerSignal?.addEventListener('abort', abort, { once: true })
  }
  const timeout = setTimeout(abort, timeoutMs)
  return {
    signal: controller.signal,
    close: () => {
      clearTimeout(timeout)
      callerSignal?.removeEventListener('abort', abort)
    }
  }
}

export interface BillingExchange {
  readonly fetchImpl: typeof fetch
  readonly url: string
  readonly signal: AbortSignal
  /** Merged over the headers the request itself implies. */
  readonly headers?: Record<string, string>
  readonly credentials?: RequestCredentials
}

export async function exchangeBillingRequest(
  request: BillingRequest,
  exchange: BillingExchange
): Promise<BillingResult<BillingHttpResponse>> {
  // Called detached: the browser's fetch refuses any receiver but its global.
  const { fetchImpl, url, signal, headers, credentials } = exchange
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...(request.idempotencyKey === undefined
          ? {}
          : { 'Idempotency-Key': request.idempotencyKey }),
        ...headers
      },
      ...(request.method === 'GET' || request.body === undefined
        ? {}
        : { body: JSON.stringify(request.body) }),
      ...(credentials === undefined ? {} : { credentials }),
      signal
    })
  } catch {
    return { status: 'error', code: 'REQUEST_FAILED' }
  }

  return shapeResponse(response, signal)
}

async function shapeResponse(
  response: Response,
  signal: AbortSignal
): Promise<BillingResult<BillingHttpResponse>> {
  const header = (name: string) => response.headers.get(name)
  try {
    return {
      status: 'ok',
      value: {
        httpStatus: response.status,
        body: await readBody(response),
        header
      }
    }
  } catch {
    if (signal.aborted) {
      return { status: 'error', code: 'REQUEST_FAILED' }
    }
    return {
      status: 'ok',
      value: { httpStatus: response.status, body: undefined, header }
    }
  }
}

/** A body that is absent, empty, or not JSON reaches callers as undefined. */
async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text === '') return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
