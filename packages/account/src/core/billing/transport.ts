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
import type { SessionRequestOptions } from '../session.js'
import type {
  AccountCredential,
  SessionErrorCode,
  SessionFailure
} from '../sessionContracts.js'
import type {
  BillingErrorCode,
  BillingFailure,
  BillingHttpResponse,
  BillingRequest,
  BillingResult,
  BillingSession,
  BillingTransport
} from './billingContracts.js'

const DEFAULT_TIMEOUT_MS = 30_000

function startRequestBudget(
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

export interface SessionBillingTransportOptions {
  readonly session: BillingSession
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

function billingFailureForSession(failure: SessionFailure): BillingFailure {
  return {
    status: 'error',
    code: codeForSessionFailure(failure.code),
    ...(failure.httpStatus === undefined
      ? {}
      : { httpStatus: failure.httpStatus })
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

  async function ensureBillingSession(
    mintOptions: SessionRequestOptions
  ): Promise<BillingResult<AccountCredential>> {
    const minted = await session.ensureFresh(undefined, mintOptions)
    if (minted === undefined) {
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }
    if (minted.status === 'error') return billingFailureForSession(minted)
    return { status: 'ok', value: minted.session }
  }

  async function send(
    request: BillingRequest,
    token: string,
    signal: AbortSignal
  ): Promise<BillingResult<BillingHttpResponse>> {
    let response: Response
    try {
      response = await fetchImpl(resolveUrl(request.route), {
        method: request.method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(request.idempotencyKey === undefined
            ? {}
            : { 'Idempotency-Key': request.idempotencyKey })
        },
        ...(request.method === 'GET' || request.body === undefined
          ? {}
          : { body: JSON.stringify(request.body) }),
        signal
      })
    } catch {
      return { status: 'error', code: 'REQUEST_FAILED' }
    }

    try {
      return {
        status: 'ok',
        value: {
          httpStatus: response.status,
          body: await readBody(response),
          header: (name) => response.headers.get(name)
        }
      }
    } catch {
      if (signal.aborted) {
        return { status: 'error', code: 'REQUEST_FAILED' }
      }
      return {
        status: 'ok',
        value: {
          httpStatus: response.status,
          body: undefined,
          header: (name) => response.headers.get(name)
        }
      }
    }
  }

  async function retryUnauthorized(
    request: BillingRequest,
    response: BillingHttpResponse,
    mintOptions: SessionRequestOptions & { readonly signal: AbortSignal },
    expectedUid: string,
    expectedWorkspace: string
  ): Promise<BillingResult<BillingHttpResponse>> {
    if (response.httpStatus !== 401) return { status: 'ok', value: response }

    const replayable =
      request.method === 'GET' || request.idempotencyKey !== undefined
    if (!replayable) {
      return {
        status: 'ok',
        value: { ...response, authenticationRetrySkipped: true }
      }
    }

    const reminted = await session.remint(undefined, mintOptions)
    if (reminted?.status !== 'ok') return { status: 'ok', value: response }
    if (
      reminted.session.uid !== expectedUid ||
      reminted.session.workspace.id !== expectedWorkspace
    ) {
      return { status: 'error', code: 'SUPERSEDED' }
    }
    return send(request, reminted.session.token, mintOptions.signal)
  }

  return async function transport(
    request: BillingRequest
  ): Promise<BillingResult<BillingHttpResponse>> {
    const timeoutMs = request.timeoutMs ?? defaultTimeoutMs
    const budget = startRequestBudget(request.signal, timeoutMs)
    const target = workspaceId?.()
    const mintOptions = {
      signal: budget.signal,
      timeoutMs,
      ...(target === undefined ? {} : { workspaceId: target })
    }

    try {
      const minted = await ensureBillingSession(mintOptions)
      if (minted.status === 'error') return minted

      const { uid } = minted.value
      const workspace = minted.value.workspace.id
      const firstAttempt = await send(
        request,
        minted.value.token,
        budget.signal
      )
      if (firstAttempt.status === 'error') return firstAttempt

      const finalAttempt = await retryUnauthorized(
        request,
        firstAttempt.value,
        mintOptions,
        uid,
        workspace
      )
      if (finalAttempt.status === 'error') return finalAttempt

      if (superseded(uid, workspace)) {
        return { status: 'error', code: 'SUPERSEDED' }
      }

      return finalAttempt
    } catch {
      return { status: 'error', code: 'REQUEST_FAILED' }
    } finally {
      budget.close()
    }
  }
}
