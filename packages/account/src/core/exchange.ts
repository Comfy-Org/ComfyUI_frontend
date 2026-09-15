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

import type {
  AccountCredential,
  AccountUser,
  SessionErrorCode,
  SessionResult
} from './sessionContracts.js'

export const CredentialResponseSchema = zExchangeTokenResponse

/** 401/403/404 carry their own codes; everything else is one failure bucket. */
function codeForResponse(status: number): SessionErrorCode {
  if (status === 401) return 'INVALID_FIREBASE_TOKEN'
  if (status === 403) return 'ACCESS_DENIED'
  if (status === 404) return 'WORKSPACE_NOT_FOUND'
  return 'TOKEN_EXCHANGE_FAILED'
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
      // A missing identity token is NOT_AUTHENTICATED; an identity failure
      // carrying that code keeps it, anything else (including our own abort)
      // stays in the transient bucket.
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
        code: codeForResponse(response.status),
        httpStatus: response.status
      }
    }

    let rawBody: unknown
    try {
      // The timeout stays armed through the body read: headers arriving does
      // not bound the body, and a stalled body must abort like a stalled connect.
      rawBody = await abortable(response.json(), controller.signal)
    } catch {
      return {
        status: 'error',
        code: 'TOKEN_EXCHANGE_FAILED',
        httpStatus: response.status
      }
    }

    const parsed = CredentialResponseSchema.safeParse(rawBody)
    if (!parsed.success) {
      return {
        status: 'error',
        code: 'TOKEN_EXCHANGE_FAILED',
        httpStatus: response.status
      }
    }
    // Date.parse can yield NaN on a schema-valid string, so the expiry is
    // checked after the schema. A token dead on arrival can never authorize
    // anything; a short-but-future one is left to the valid-on-read path; an
    // empty token is never a session.
    const expiresAt = Date.parse(parsed.data.expires_at)
    if (
      Number.isNaN(expiresAt) ||
      parsed.data.token === '' ||
      expiresAt <= now()
    ) {
      return {
        status: 'error',
        code: 'TOKEN_EXCHANGE_FAILED',
        httpStatus: response.status
      }
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
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
