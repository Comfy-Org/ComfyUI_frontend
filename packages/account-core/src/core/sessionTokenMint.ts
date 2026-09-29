/**
 * Workspace tokens for services that cannot read the session cookie. The
 * session mints one at `POST /auth/token` on first use, and each token is
 * reused per (session user, workspace) until it nears expiry. Failures come
 * back as web-session codes; nothing here retries or signs out.
 */
import {
  zErrorResponse,
  zExchangeTokenResponse
} from '@comfyorg/ingest-types/zod'

import { isCredentialFresh } from './credentialCache.js'
import { COMFY_CLIENT } from './requestAuth.js'
import type {
  AccountCredential,
  WebSession,
  WebSessionErrorCode,
  WebSessionFailure
} from './sessionContracts.js'

export interface SessionTokenMintOptions {
  /** Ingest API root, e.g. `https://cloud.comfy.org/api`. */
  readonly apiBaseUrl: string
  readonly fetchImpl: typeof fetch
  /** The live web session, or undefined when signed out. */
  readonly getSession: () => WebSession | undefined
  readonly now?: () => number
  /** Re-mint once a cached token has this long left. Default 60s. */
  readonly refreshBufferMs?: number
}

export interface SessionTokenFailure extends WebSessionFailure {
  /** From a 429's `Retry-After`; no request is sent until it passes. */
  readonly retryAfterMs?: number
}

export type SessionTokenResult =
  | { readonly status: 'ok'; readonly credential: AccountCredential }
  | SessionTokenFailure

export class SessionTokenError extends Error {
  constructor(readonly failure: SessionTokenFailure) {
    super(`Workspace token mint failed: ${failure.code}`)
    this.name = 'SessionTokenError'
  }
}

export interface SessionTokenMint {
  /** Never throws: every outcome is a result. */
  readonly mint: (workspaceId?: string) => Promise<SessionTokenResult>
  /** For `createRequestAuthorizer`; rejects with a `SessionTokenError`. */
  readonly getWorkspaceToken: (workspaceId?: string) => Promise<string>
}

export const DEFAULT_REFRESH_BUFFER_MS = 60_000
const MAX_RETRY_AFTER_MS = 10 * 60 * 1000

interface StatusRule {
  readonly byServerCode: Partial<Record<string, WebSessionErrorCode>>
  readonly fallback: WebSessionErrorCode
}

const STATUS_RULES: Partial<Record<number, StatusRule>> = {
  401: {
    byServerCode: {
      session_expired: 'SESSION_EXPIRED',
      session_revoked: 'SESSION_REVOKED'
    },
    fallback: 'NO_SESSION'
  },
  403: {
    byServerCode: {
      csrf_invalid: 'CSRF_STALE',
      workspace_access_denied: 'WORKSPACE_ACCESS_DENIED'
    },
    fallback: 'SESSION_REQUEST_REFUSED'
  }
}

const zServerCode = zErrorResponse.pick({ code: true })

function failure(
  code: WebSessionErrorCode,
  httpStatus?: number,
  serverCode?: string
): SessionTokenFailure {
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

/** Retry-After is delay-seconds or an HTTP-date; either is capped. */
function retryAfterMs(value: string | null, nowMs: number): number | undefined {
  if (value === null) return undefined
  const seconds = Number(value)
  const delayMs = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - nowMs
  return delayMs > 0 ? Math.min(delayMs, MAX_RETRY_AFTER_MS) : undefined
}

function rateLimited(response: Response, nowMs: number): SessionTokenFailure {
  const limited = failure('SESSION_UNAVAILABLE', response.status)
  const waitMs = retryAfterMs(response.headers.get('Retry-After'), nowMs)
  return waitMs === undefined ? limited : { ...limited, retryAfterMs: waitMs }
}

function codeFor(status: number, serverCode: string | undefined) {
  const rule = STATUS_RULES[status]
  if (rule === undefined) return 'SESSION_REQUEST_REFUSED'
  return rule.byServerCode[serverCode ?? ''] ?? rule.fallback
}

async function classifyFailure(
  response: Response,
  nowMs: number
): Promise<SessionTokenFailure> {
  const { status } = response
  if (status === 429) return rateLimited(response, nowMs)
  if (status >= 500) return failure('SESSION_UNAVAILABLE', status)
  const parsed = zServerCode.safeParse(await readJson(response))
  const serverCode = parsed.success ? parsed.data.code : undefined
  return failure(codeFor(status, serverCode), status, serverCode)
}

export function createSessionTokenMint({
  apiBaseUrl,
  fetchImpl,
  getSession,
  now = Date.now,
  refreshBufferMs = DEFAULT_REFRESH_BUFFER_MS
}: SessionTokenMintOptions): SessionTokenMint {
  const tokenUrl = `${apiBaseUrl.replace(/\/+$/, '')}/auth/token`
  /** Keyed by workspace; every entry belongs to `cacheOwner`. */
  const cache = new Map<string | undefined, AccountCredential>()
  const inFlight = new Map<string | undefined, Promise<SessionTokenResult>>()
  let cacheOwner: string | undefined
  /** Bumped on every owner change, so an older owner's answer never lands. */
  let ownerGeneration = 0
  let rateLimit: { until: number; failure: SessionTokenFailure } | undefined

  function adoptOwner(userId: string | undefined): void {
    if (cacheOwner === userId) return
    cacheOwner = userId
    ownerGeneration += 1
    cache.clear()
    inFlight.clear()
    rateLimit = undefined
  }

  async function request(
    session: WebSession,
    workspaceId: string | undefined
  ): Promise<SessionTokenResult> {
    let response: Response
    try {
      response = await fetchImpl(tokenUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Comfy-Client': COMFY_CLIENT,
          'X-CSRF-Token': session.csrfToken,
          ...(workspaceId === undefined
            ? {}
            : { 'X-Comfy-Workspace-ID': workspaceId })
        },
        body: JSON.stringify(
          workspaceId === undefined ? {} : { workspace_id: workspaceId }
        )
      })
    } catch {
      return failure('SESSION_UNAVAILABLE')
    }
    if (!response.ok) return classifyFailure(response, now())

    const parsed = zExchangeTokenResponse.safeParse(await readJson(response))
    const expiresAt = parsed.success
      ? Date.parse(parsed.data.expires_at)
      : Number.NaN
    if (!parsed.success || parsed.data.token === '' || !(expiresAt > now())) {
      return failure('SESSION_UNAVAILABLE', response.status)
    }
    return {
      status: 'ok',
      credential: {
        token: parsed.data.token,
        expiresAt,
        uid: session.user.id,
        workspace: parsed.data.workspace,
        role: parsed.data.role,
        permissions: parsed.data.permissions
      }
    }
  }

  function commit(
    workspaceId: string | undefined,
    generation: number,
    result: SessionTokenResult
  ): void {
    if (generation !== ownerGeneration) return
    if (result.status === 'ok') {
      cache.set(workspaceId, result.credential)
      return
    }
    if (result.httpStatus === 401) cache.clear()
    if (result.retryAfterMs !== undefined) {
      rateLimit = { until: now() + result.retryAfterMs, failure: result }
    }
  }

  async function mint(workspaceId?: string): Promise<SessionTokenResult> {
    const session = getSession()
    adoptOwner(session?.user.id)
    if (session === undefined) return failure('NO_SESSION')
    const userId = session.user.id

    // The cache is checked before the backoff on purpose: a caller already
    // holding a fresh token is still served while new mints wait.
    const cached = cache.get(workspaceId)
    if (cached && isCredentialFresh(cached, now(), refreshBufferMs)) {
      return { status: 'ok', credential: cached }
    }
    if (rateLimit && now() < rateLimit.until) {
      return rateLimit.failure
    }

    const joined = inFlight.get(workspaceId)
    if (joined) return joined
    const generation = ownerGeneration
    const running = request(session, workspaceId).then((result) => {
      if (inFlight.get(workspaceId) === running) inFlight.delete(workspaceId)
      if (getSession()?.user.id !== userId) return failure('IDENTITY_CHANGED')
      commit(workspaceId, generation, result)
      return result
    })
    inFlight.set(workspaceId, running)
    return running
  }

  return {
    mint,
    async getWorkspaceToken(workspaceId) {
      const result = await mint(workspaceId)
      if (result.status === 'ok') return result.credential.token
      throw new SessionTokenError(result)
    }
  }
}
