/**
 * The pure token exchange: POST the signed-in identity's Firebase token to
 * the workspace JWT endpoint, parse the generated contract, and return a
 * usable credential or a coded failure. No state, no storage, no identity
 * ownership — the caller owns all of that and passes the request body (an
 * empty body resolves the personal workspace; `{ workspace_id }` targets
 * one). Cancelable by the caller's signal and bounded by a timeout, which
 * the production store's timer-scheduled callers did not need.
 */
import { zExchangeTokenResponse } from '@comfyorg/ingest-types/zod'

import { isSsoRequiredRefusal, ssoRequiredOrganizationId } from './ssoRequired'
import type {
  AccountCredential,
  AccountUser,
  ExchangeFailureReason,
  SessionErrorCode,
  SessionFailure,
  SessionResult
} from './sessionContracts'

export const CredentialResponseSchema = zExchangeTokenResponse

/** 401/403/404 carry their own codes; everything else is one failure bucket. */
function codeForResponse(status: number): SessionErrorCode {
  if (status === 401) return 'INVALID_FIREBASE_TOKEN'
  if (status === 403) return 'ACCESS_DENIED'
  if (status === 404) return 'WORKSPACE_NOT_FOUND'
  return 'TOKEN_EXCHANGE_FAILED'
}

const MAX_REPORTED_ISSUE_PATHS = 5

const CLOCK_SKEW_TOLERANCE_MS = 30_000
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000

function clockSkewMs(response: Response, headersAt: number): number {
  const serverNow = Date.parse(response.headers.get('Date') ?? '')
  if (Number.isNaN(serverNow)) return 0
  const skew = headersAt - serverNow
  const magnitude = Math.abs(skew)
  return magnitude > CLOCK_SKEW_TOLERANCE_MS && magnitude <= MAX_CLOCK_SKEW_MS
    ? skew
    : 0
}

function unusableBody(
  httpStatus: number,
  reason: ExchangeFailureReason,
  detail?: string
): SessionFailure {
  return {
    status: 'error',
    code: 'TOKEN_EXCHANGE_FAILED',
    httpStatus,
    reason,
    ...(detail === undefined ? {} : { detail })
  }
}

function schemaIssuePaths(
  issues: readonly { readonly path: readonly PropertyKey[] }[]
): string {
  const paths = issues.map((issue) =>
    issue.path.length === 0 ? '(root)' : issue.path.map(String).join('.')
  )
  return [...new Set(paths)].slice(0, MAX_REPORTED_ISSUE_PATHS).join(',')
}

type Refusal = Pick<SessionFailure, 'code' | 'organizationId'>

/** Only a 403's body is read: it tells an SSO refusal from any other. */
async function refusalFor(
  response: Response,
  signal: AbortSignal
): Promise<Refusal> {
  const code = codeForResponse(response.status)
  if (code !== 'ACCESS_DENIED') return { code }
  let body: unknown
  try {
    body = await abortable(response.json(), signal)
  } catch {
    return { code }
  }
  if (!isSsoRequiredRefusal(response.status, body)) return { code }
  const organizationId = ssoRequiredOrganizationId(body)
  return organizationId === undefined
    ? { code: 'SSO_REQUIRED' }
    : { code: 'SSO_REQUIRED', organizationId }
}

export function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

function credentialFromBody(
  user: AccountUser,
  response: Response,
  rawBody: unknown,
  clock: { readonly skewMs: number; readonly localNow: number }
): SessionResult {
  const parsed = CredentialResponseSchema.safeParse(rawBody)
  if (!parsed.success) {
    return unusableBody(
      response.status,
      'schema_mismatch',
      schemaIssuePaths(parsed.error.issues)
    )
  }
  const serverExpiresAt = Date.parse(parsed.data.expires_at)
  if (Number.isNaN(serverExpiresAt)) {
    return unusableBody(response.status, 'invalid_expiry')
  }
  if (parsed.data.token === '') {
    return unusableBody(response.status, 'empty_token')
  }
  const { skewMs, localNow } = clock
  const expiresAt = serverExpiresAt + skewMs
  const expiresInMs = expiresAt - localNow
  if (expiresInMs <= 0) {
    return unusableBody(
      response.status,
      'expired_on_arrival',
      `expires_in_ms=${Math.round(expiresInMs)}` +
        (skewMs === 0 ? '' : `,clock_skew_ms=${Math.round(skewMs)}`)
    )
  }
  const session: AccountCredential = {
    token: parsed.data.token,
    expiresAt,
    uid: user.uid,
    workspace: parsed.data.workspace,
    role: parsed.data.role,
    permissions: parsed.data.permissions
  }
  return { status: 'ok', session }
}

export interface ExchangeRequest {
  readonly exchangeUrl: string
  readonly body: Record<string, unknown>
  readonly fetchImpl: typeof fetch
  readonly signal: AbortSignal | undefined
  readonly timeoutMs: number
  readonly now: () => number
}

export async function exchangeToken(
  user: AccountUser,
  request: ExchangeRequest
): Promise<SessionResult> {
  const { exchangeUrl, body, fetchImpl, signal, timeoutMs, now } = request
  if (signal?.aborted) {
    return { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
  }

  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    let idToken: string
    try {
      idToken = await abortable(user.getIdToken(), controller.signal)
    } catch (error) {
      const coded =
        !controller.signal.aborted &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'NOT_AUTHENTICATED'
      return {
        status: 'error',
        code: coded ? 'NOT_AUTHENTICATED' : 'TOKEN_EXCHANGE_FAILED'
      }
    }

    let response: Response
    try {
      response = await fetchImpl(exchangeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })
    } catch {
      return { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    }

    if (!response.ok) {
      return {
        status: 'error',
        ...(await refusalFor(response, controller.signal)),
        httpStatus: response.status
      }
    }

    const skewMs = clockSkewMs(response, now())
    let rawBody: unknown
    try {
      rawBody = await abortable(response.json(), controller.signal)
    } catch {
      return unusableBody(
        response.status,
        controller.signal.aborted ? 'body_aborted' : 'body_unreadable'
      )
    }

    return credentialFromBody(user, response, rawBody, {
      skewMs,
      localNow: now()
    })
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
