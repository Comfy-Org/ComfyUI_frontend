/**
 * Calling Comfy Router from the browser.
 *
 * The run route is synchronous: one POST carries the input and the response
 * carries the finished result, so there is no job id and nothing to poll.
 * The request body is the partner model's own native JSON input and the
 * success body is its own native JSON output — Router forwards both unchanged
 * rather than wrapping them, which is why `output` below is `unknown` and not
 * a shape this file pretends to know.
 *
 * This calls `fetch` directly rather than going through `@comfyorg/sdk`. The
 * published SDK still imports `node:crypto` and `node:fs` at module scope and
 * so cannot be bundled for a browser; the fix is open but unreleased. The
 * whole contract here is one POST, so waiting on that would buy nothing.
 * Swapping to the SDK later is a change to this file alone.
 */

/** Where Router is served. Matches `COMFY_ROUTER_BASE_URL` in the SDK. */
export const COMFY_ROUTER_BASE_URL = 'https://api.comfy.org'

/** How long a run may take before we give up on it. */
export const WORKSHOP_RUN_TIMEOUT_MS = 300_000

/**
 * Router's machine-readable error buckets, from `RouterErrorType` in the
 * comfy-api spec. Branch on these; the accompanying `detail` is prose meant
 * for a human and is explicitly not to be parsed.
 */
const WORKSHOP_RUN_ERROR_TYPES = [
  'client_disconnected',
  'concurrency_limit_exceeded',
  'content_policy_violation',
  'deadline_exceeded',
  'forbidden',
  'insufficient_credits',
  'internal_error',
  'invalid_input',
  'model_not_found',
  'not_enabled',
  'provider_error',
  'provider_timeout',
  'rate_limited',
  'service_unavailable',
  'unauthorized'
] as const

export type WorkshopRunErrorType =
  | (typeof WORKSHOP_RUN_ERROR_TYPES)[number]
  /** The request never got an answer: offline, DNS, CORS, abort. */
  | 'network_error'

export type WorkshopRunResult =
  | {
      readonly status: 'ok'
      readonly output: unknown
      readonly requestId: string | undefined
    }
  | {
      readonly status: 'error'
      readonly errorType: WorkshopRunErrorType
      readonly detail: string
      readonly requestId: string | undefined
    }

export interface WorkshopRunOptions {
  readonly credentials: string
  readonly signal?: AbortSignal
  /** Injectable so tests do not have to stub a global. */
  readonly fetchImpl?: typeof fetch
  readonly baseUrl?: string
  readonly idempotencyKey?: string
}

const ERROR_TYPES = new Set<string>(WORKSHOP_RUN_ERROR_TYPES)

function isRunErrorType(value: unknown): value is WorkshopRunErrorType {
  return typeof value === 'string' && ERROR_TYPES.has(value)
}

/**
 * What to call a failure when the body did not name a bucket itself. Router
 * always sends one, but a proxy or an edge can answer instead of Router.
 */
function errorTypeForStatus(status: number): WorkshopRunErrorType {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'model_not_found'
  if (status === 422) return 'invalid_input'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'service_unavailable'
  return 'invalid_input'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * A model-level validation failure has its own shape: FastAPI's `detail[]`
 * array, kept as an array so per-field granularity survives. Flatten it for
 * display without pretending the fields are ours to name.
 */
function readDetail(body: unknown, fallback: string): string {
  if (!isRecord(body)) return fallback
  const { detail } = body
  if (typeof detail === 'string' && detail !== '') return detail
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (!isRecord(item)) return undefined
        const location = Array.isArray(item.loc)
          ? item.loc.filter((part) => part !== 'body').join('.')
          : undefined
        const message = typeof item.msg === 'string' ? item.msg : undefined
        if (message === undefined) return undefined
        return location === undefined || location === ''
          ? message
          : `${location}: ${message}`
      })
      .filter((part): part is string => part !== undefined)
    if (parts.length > 0) return parts.join('\n')
  }
  // Not a Router body at all — an edge or proxy answered. echo uses `message`.
  if (typeof body.message === 'string' && body.message !== '') {
    return body.message
  }
  return fallback
}

/**
 * Runs a partner model and returns its native output.
 *
 * Failures come back as an `error` result rather than a thrown exception:
 * every one of them is something the page has to render, and none of them is
 * a programming mistake the caller could have avoided.
 */
export async function runRouterModel(
  modelId: string,
  input: Record<string, unknown>,
  options: WorkshopRunOptions
): Promise<WorkshopRunResult> {
  const {
    credentials,
    signal,
    fetchImpl = globalThis.fetch,
    baseUrl = COMFY_ROUTER_BASE_URL,
    idempotencyKey = crypto.randomUUID()
  } = options

  const url = `${baseUrl}/v2/models/${modelId}`
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        // Router takes a Comfy API key or a Firebase JWT in the same slot,
        // both as a bearer token. This is what the SDK sends for an API key.
        Authorization: `Bearer ${credentials}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Sent so a retry of one logical run cannot dispatch — or bill —
        // twice. Minted per call, so pressing Run again is a new run.
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(input),
      signal
    })
  } catch (cause) {
    return {
      status: 'error',
      errorType:
        cause instanceof DOMException && cause.name === 'AbortError'
          ? 'client_disconnected'
          : 'network_error',
      detail:
        cause instanceof Error && cause.message !== ''
          ? cause.message
          : 'The request could not be sent.',
      requestId: undefined
    }
  }

  const requestId = response.headers.get('X-Comfy-Request-Id') ?? undefined
  const text = await response.text()
  let body: unknown
  try {
    body = text === '' ? undefined : JSON.parse(text)
  } catch {
    body = undefined
  }

  if (!response.ok) {
    const declared = isRecord(body) ? body.error_type : undefined
    return {
      status: 'error',
      // Prefer the header: it is set on every Router error response, and it
      // survives a body we failed to parse.
      errorType: isRunErrorType(response.headers.get('X-Comfy-Error-Type'))
        ? (response.headers.get('X-Comfy-Error-Type') as WorkshopRunErrorType)
        : isRunErrorType(declared)
          ? declared
          : errorTypeForStatus(response.status),
      detail: readDetail(
        body,
        text === '' ? `The model returned ${response.status}.` : text
      ),
      requestId
    }
  }

  return { status: 'ok', output: body, requestId }
}
