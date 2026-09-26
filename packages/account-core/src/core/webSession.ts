/**
 * Client for the shared web session on ingest (`/api/auth/session*`). It only
 * sends and classifies: retries, boot rules, and sign-out belong to callers.
 * Identity proof is an opaque string from the caller, so no provider leaks in.
 */
import {
  zCreateSessionResponse,
  zDeleteSessionResponse,
  zErrorResponse,
  zGetSessionResponse
} from '@comfyorg/ingest-types/zod'

import type {
  WebSessionCommandResult,
  WebSessionErrorCode,
  WebSessionFailure,
  WebSessionResult
} from './sessionContracts.js'

export type {
  WebSession,
  WebSessionCommandResult,
  WebSessionErrorCode,
  WebSessionFailure,
  WebSessionResult,
  WebSessionUser
} from './sessionContracts.js'

export interface WebSessionOptions {
  /** Ingest API root, e.g. `https://cloud.comfy.org/api`. */
  readonly apiBaseUrl: string
  readonly fetchImpl: typeof fetch
  readonly signal?: AbortSignal
}

const UNAUTHORIZED_CODES: Readonly<Record<string, WebSessionErrorCode>> = {
  no_session: 'NO_SESSION',
  session_expired: 'SESSION_EXPIRED',
  session_revoked: 'SESSION_REVOKED'
}

const FORBIDDEN_CODES: Readonly<Record<string, WebSessionErrorCode>> = {
  csrf_invalid: 'CSRF_STALE',
  workspace_access_denied: 'WORKSPACE_ACCESS_DENIED'
}

function failure(
  code: WebSessionErrorCode,
  httpStatus?: number,
  serverCode?: string
): WebSessionFailure {
  return {
    status: 'error',
    code,
    retryable: code === 'SESSION_UNAVAILABLE',
    ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(serverCode === undefined ? {} : { serverCode })
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

async function classifyFailure(response: Response): Promise<WebSessionFailure> {
  const { status } = response
  if (status === 429 || status >= 500) {
    return failure('SESSION_UNAVAILABLE', status)
  }
  const parsed = zErrorResponse.safeParse(await readJson(response))
  if (!parsed.success) return failure('SESSION_REQUEST_REFUSED', status)
  const serverCode = parsed.data.code
  const byServerCode =
    status === 401
      ? (UNAUTHORIZED_CODES[serverCode] ?? 'NO_SESSION')
      : status === 403
        ? (FORBIDDEN_CODES[serverCode] ?? 'SESSION_REQUEST_REFUSED')
        : 'SESSION_REQUEST_REFUSED'
  return failure(byServerCode, status, serverCode)
}

async function send(
  options: WebSessionOptions,
  path: string,
  init: RequestInit
): Promise<{ readonly response: Response } | WebSessionFailure> {
  let response: Response
  try {
    response = await options.fetchImpl(
      `${options.apiBaseUrl.replace(/\/+$/, '')}${path}`,
      { ...init, credentials: 'include', signal: options.signal }
    )
  } catch {
    return failure('SESSION_UNAVAILABLE')
  }
  return response.ok ? { response } : classifyFailure(response)
}

export async function readWebSession(
  options: WebSessionOptions,
  { expectedUserId }: { readonly expectedUserId?: string } = {}
): Promise<WebSessionResult> {
  const sent = await send(options, '/auth/session', {
    method: 'GET',
    cache: 'no-store'
  })
  if (!('response' in sent)) return sent

  const { status } = sent.response
  const parsed = zGetSessionResponse.safeParse(await readJson(sent.response))
  if (!parsed.success) return failure('SESSION_UNAVAILABLE', status)
  const { user, csrf_token, expires_at, absolute_expires_at } = parsed.data
  if (expectedUserId !== undefined && user.id !== expectedUserId) {
    return failure('IDENTITY_CHANGED', status)
  }
  return {
    status: 'ok',
    session: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.email_verified,
        signInProvider: user.sign_in_provider
      },
      csrfToken: csrf_token,
      expiresAt: Date.parse(expires_at),
      absoluteExpiresAt: Date.parse(absolute_expires_at)
    }
  }
}

/**
 * Creates the session, then reads it back for the user and CSRF token. A
 * failure to produce the proof is the provider's error and propagates.
 */
export async function createWebSession(
  options: WebSessionOptions,
  getIdentityProof: () => Promise<string>,
  { expectedUserId }: { readonly expectedUserId?: string } = {}
): Promise<WebSessionResult> {
  const proof = await getIdentityProof()
  const sent = await send(options, '/auth/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${proof}` }
  })
  if (!('response' in sent)) return sent

  const parsed = zCreateSessionResponse.safeParse(await readJson(sent.response))
  if (!parsed.success || !parsed.data.success) {
    return failure('SESSION_UNAVAILABLE', sent.response.status)
  }
  return readWebSession(options, { expectedUserId })
}

/** Sends no CSRF token: sign-out must work against a dead session. */
export async function deleteWebSession(
  options: WebSessionOptions
): Promise<WebSessionCommandResult> {
  const sent = await send(options, '/auth/session', { method: 'DELETE' })
  if (!('response' in sent)) return sent

  const parsed = zDeleteSessionResponse.safeParse(await readJson(sent.response))
  if (!parsed.success || !parsed.data.success) {
    return failure('SESSION_UNAVAILABLE', sent.response.status)
  }
  return { status: 'ok' }
}
