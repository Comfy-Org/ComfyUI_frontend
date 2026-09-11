/**
 * The billing transport: one request carrying the workspace session, with the
 * reactive 401 guard the cloud app installs on its billing axios client
 * (`attachUnifiedRemintInterceptor` in
 * src/platform/auth/unified/remintRetry.ts) — re-mint once, retry once, and
 * surface a persistent 401 unchanged. Keep the two in step.
 *
 * Two deliberate differences from that interceptor. It gates the retry on a
 * replayable body; here the gate is an idempotency key, because a billing
 * write that the backend does not deduplicate must never be replayed by the
 * client even when its body is replayable. And scope comes from the minted
 * credential rather than a request header: the workspace a request runs
 * against is the workspace its JWT was minted for, and a response that
 * arrives after the host moved to another workspace (or signed out) is
 * reported as SUPERSEDED instead of being handed to a caller that would
 * attribute it to the wrong account.
 */
import type { SessionClient } from '../session.js'
import type { SessionErrorCode } from '../sessionContracts.js'
import type {
  BillingErrorCode,
  BillingHttpResponse,
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'

const DEFAULT_TIMEOUT_MS = 30_000

export interface SessionBillingTransportOptions {
  readonly session: SessionClient
  /**
   * Resolves a route to an absolute URL. The cloud app's own resolver
   * (`workspaceApiUrl`) differs per distribution, so the host owns it.
   */
  readonly resolveUrl: (route: string) => string
  /** The workspace to mint for; absent resolves the personal workspace. */
  readonly workspaceId?: () => string | undefined
  readonly fetchImpl?: typeof fetch
  readonly defaultTimeoutMs?: number
}

function codeForSessionFailure(code: SessionErrorCode): BillingErrorCode {
  if (code === 'ACCESS_DENIED') return 'ACCESS_DENIED'
  if (code === 'WORKSPACE_NOT_FOUND') return 'NOT_FOUND'
  if (code === 'NOT_AUTHENTICATED' || code === 'INVALID_FIREBASE_TOKEN') {
    return 'NOT_AUTHENTICATED'
  }
  return 'REQUEST_FAILED'
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

export function createSessionBillingTransport(
  options: SessionBillingTransportOptions
): BillingTransport {
  const {
    session,
    resolveUrl,
    workspaceId,
    fetchImpl = fetch,
    defaultTimeoutMs = DEFAULT_TIMEOUT_MS
  } = options

  /**
   * The identity and workspace a response is allowed to be attributed to.
   * A snapshot still minting or not yet settled is no evidence of a change,
   * so only a delivered sign-out or a different uid or workspace supersedes.
   */
  const superseded = (uid: string, workspace: string): boolean => {
    const snapshot = session.getSnapshot()
    if (snapshot.phase === 'signed-out') return true
    if (snapshot.user !== null && snapshot.user.uid !== uid) return true
    return (
      snapshot.session !== undefined &&
      snapshot.session.workspace.id !== workspace
    )
  }

  return async (
    request: BillingRequest
  ): Promise<BillingResult<BillingHttpResponse>> => {
    const target = workspaceId?.()
    const mintOptions = {
      ...(request.signal === undefined ? {} : { signal: request.signal }),
      ...(target === undefined ? {} : { workspaceId: target })
    }

    const minted = await session.ensureFresh(undefined, mintOptions)
    if (minted === undefined) {
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }
    if (minted.status === 'error') {
      return {
        status: 'error',
        code: codeForSessionFailure(minted.code),
        ...(minted.httpStatus === undefined
          ? {}
          : { httpStatus: minted.httpStatus })
      }
    }

    const { uid } = minted.session
    const workspace = minted.session.workspace.id
    // A 401 retry is safe for a read, and for a write only because the
    // backend deduplicates the replay by its idempotency key.
    const replayable =
      request.method === 'GET' || request.idempotencyKey !== undefined

    const send = async (token: string): Promise<Response> => {
      const controller = new AbortController()
      const abort = () => controller.abort()
      request.signal?.addEventListener('abort', abort, { once: true })
      const timeout = setTimeout(
        () => controller.abort(),
        request.timeoutMs ?? defaultTimeoutMs
      )
      try {
        return await fetchImpl(resolveUrl(request.route), {
          method: request.method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(request.idempotencyKey === undefined
              ? {}
              : { 'Idempotency-Key': request.idempotencyKey })
          },
          ...(request.body === undefined
            ? {}
            : { body: JSON.stringify(request.body) }),
          signal: controller.signal
        })
      } finally {
        clearTimeout(timeout)
        request.signal?.removeEventListener('abort', abort)
      }
    }

    let response: Response
    try {
      response = await send(minted.session.token)
    } catch {
      return { status: 'error', code: 'REQUEST_FAILED' }
    }

    if (response.status === 401 && replayable) {
      const reminted = await session.remint(undefined, mintOptions)
      if (reminted?.status === 'ok') {
        try {
          response = await send(reminted.session.token)
        } catch {
          return { status: 'error', code: 'REQUEST_FAILED' }
        }
      }
    }

    if (superseded(uid, workspace)) {
      return { status: 'error', code: 'SUPERSEDED' }
    }

    return {
      status: 'ok',
      value: {
        httpStatus: response.status,
        body: await readBody(response),
        header: (name) => response.headers.get(name)
      }
    }
  }
}
