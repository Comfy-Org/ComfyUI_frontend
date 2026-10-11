/**
 * Client for the shared web session on ingest (`/api/auth/session*`). It only
 * sends and classifies: retries, boot rules, and sign-out belong to callers.
 * Identity proof is an opaque string from the caller, so no provider leaks in.
 */
import {
  zCreateSessionResponse,
  zDeleteSessionResponse,
  zErrorResponse,
  zGetSessionResponse,
  zRevokeAllSessionsResponse,
  zWebSessionUser
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import { COMFY_CLIENT } from './requestAuth.js'
import { timedSignal } from './requestTimeout.js'
import {
  SSO_REQUIRED_SERVER_CODE,
  ssoRequiredOrganizationId
} from './ssoRequired.js'
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
  /** Caps each request, body included; a timeout is `SESSION_UNAVAILABLE`. Default: none. */
  readonly timeoutMs?: number
}

const UNAUTHORIZED_CODES: Readonly<Record<string, WebSessionErrorCode>> = {
  no_session: 'NO_SESSION',
  session_expired: 'SESSION_EXPIRED',
  session_revoked: 'SESSION_REVOKED',
  TOKEN_REVOKED: 'SESSION_REVOKED'
}

const FORBIDDEN_CODES: Readonly<Record<string, WebSessionErrorCode>> = {
  csrf_invalid: 'CSRF_STALE',
  workspace_access_denied: 'WORKSPACE_ACCESS_DENIED',
  [SSO_REQUIRED_SERVER_CODE]: 'SSO_REQUIRED'
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

/** Adds `has_personal_workspace` until ingest-types carries it. */
const zSessionResponse = zGetSessionResponse.extend({
  user: zWebSessionUser.extend({
    has_personal_workspace: z.boolean().optional()
  })
})

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

/** Classifies an ingest refusal the way every session call does. */
export function classifyWebSessionFailure(
  status: number,
  body: unknown
): WebSessionFailure {
  if (status === 429 || status >= 500) {
    return failure('SESSION_UNAVAILABLE', status)
  }
  const parsed = zErrorResponse.safeParse(body)
  if (!parsed.success) return failure('SESSION_REQUEST_REFUSED', status)
  const serverCode = parsed.data.code
  const byServerCode =
    status === 401
      ? (UNAUTHORIZED_CODES[serverCode] ?? 'NO_SESSION')
      : status === 403
        ? (FORBIDDEN_CODES[serverCode] ?? 'SESSION_REQUEST_REFUSED')
        : 'SESSION_REQUEST_REFUSED'
  const refusal = failure(byServerCode, status, serverCode)
  const organizationId =
    byServerCode === 'SSO_REQUIRED'
      ? ssoRequiredOrganizationId(body)
      : undefined
  return organizationId === undefined ? refusal : { ...refusal, organizationId }
}

interface Answered {
  readonly status: number
  readonly body: unknown
}

async function send(
  options: WebSessionOptions,
  path: string,
  init: RequestInit
): Promise<Answered | WebSessionFailure> {
  const { signal, release } = timedSignal(options.signal, options.timeoutMs)
  try {
    const response = await options.fetchImpl(
      `${options.apiBaseUrl.replace(/\/+$/, '')}${path}`,
      { ...init, credentials: 'include', signal }
    )
    const body = await readJson(response)
    if (signal?.aborted) return failure('SESSION_UNAVAILABLE')
    const { status } = response
    return response.ok
      ? { status, body }
      : classifyWebSessionFailure(status, body)
  } catch {
    return failure('SESSION_UNAVAILABLE')
  } finally {
    release()
  }
}

export async function readWebSession(
  options: WebSessionOptions,
  { expectedUserId }: { readonly expectedUserId?: string } = {}
): Promise<WebSessionResult> {
  const sent = await send(options, '/auth/session', {
    method: 'GET',
    cache: 'no-store'
  })
  if ('code' in sent) return sent

  const { status } = sent
  const parsed = zSessionResponse.safeParse(sent.body)
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
        signInProvider: user.sign_in_provider,
        hasPersonalWorkspace: user.has_personal_workspace
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
  if ('code' in sent) return sent

  const parsed = zCreateSessionResponse.safeParse(sent.body)
  if (!parsed.success || !parsed.data.success) {
    return failure('SESSION_UNAVAILABLE', sent.status)
  }
  return readWebSession(options, { expectedUserId })
}

/** Sends no CSRF token: sign-out must work against a dead session. */
export async function deleteWebSession(
  options: WebSessionOptions
): Promise<WebSessionCommandResult> {
  const sent = await send(options, '/auth/session', { method: 'DELETE' })
  if ('code' in sent) return sent

  const parsed = zDeleteSessionResponse.safeParse(sent.body)
  if (!parsed.success || !parsed.data.success) {
    return failure('SESSION_UNAVAILABLE', sent.status)
  }
  return { status: 'ok' }
}

/**
 * Signs the user out of every device with the session cookie alone. Only a
 * body the contract recognises is ok: the caller tells the user every device
 * is signed out on that answer.
 */
export async function revokeAllWebSessions(
  options: WebSessionOptions,
  csrfToken: string
): Promise<WebSessionCommandResult> {
  const sent = await send(options, '/auth/sessions/revoke-all', {
    method: 'POST',
    headers: { 'X-Comfy-Client': COMFY_CLIENT, 'X-CSRF-Token': csrfToken }
  })
  if ('code' in sent) return sent

  const parsed = zRevokeAllSessionsResponse.safeParse(sent.body)
  if (!parsed.success) {
    return failure('SESSION_UNAVAILABLE', sent.status)
  }
  return { status: 'ok' }
}
