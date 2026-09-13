import { describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'

import type {
  SessionClient,
  SessionRequestOptions,
  SessionSnapshot
} from '../session.js'
import type { AccountCredential, SessionResult } from '../sessionContracts.js'
import { createSessionBillingTransport } from './transport.js'

const BASE = 'https://cloud.test/api'

const PERSONAL_CREDENTIAL = {
  token: 'workspace-jwt',
  expiresAt: Date.now() + 60 * 60 * 1000,
  uid: 'uid-1',
  workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: ['workspace:read']
} satisfies AccountCredential

function credential(
  overrides: Partial<AccountCredential> = {}
): AccountCredential {
  return { ...PERSONAL_CREDENTIAL, ...overrides }
}

const SIGNED_OUT: SessionSnapshot = {
  phase: 'signed-out',
  user: null,
  session: undefined
}

function authenticated(session: AccountCredential): SessionSnapshot {
  return {
    phase: 'authenticated',
    user: { uid: session.uid, getIdToken: async () => 'id-token' },
    session
  }
}

/**
 * The three members the transport is allowed to reach for. Reaching past
 * them is a bug, and this fake keeps it one: the single widening assertion
 * below leaves every other member undefined at runtime rather than
 * quietly answering it.
 */
type SessionFake = Pick<SessionClient, 'ensureFresh' | 'remint' | 'getSnapshot'>

function delayedSessionResult(
  result: SessionResult | undefined,
  delayMs: number,
  requestOptions?: SessionRequestOptions
): Promise<SessionResult | undefined> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timeout)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timeout = setTimeout(() => {
      requestOptions?.signal?.removeEventListener('abort', abort)
      resolve(result)
    }, delayMs)
    if (requestOptions?.signal?.aborted === true) abort()
    else
      requestOptions?.signal?.addEventListener('abort', abort, { once: true })
  })
}

function fakeSession(options: {
  ensureFresh?: SessionResult | undefined
  ensureFreshDelayMs?: number
  remint?: SessionResult | undefined
  remintDelayMs?: number
  snapshot?: SessionSnapshot
}) {
  const ensureFresh = vi.fn(async (_requestedUser, requestOptions) => {
    if (options.ensureFreshDelayMs !== undefined) {
      return delayedSessionResult(
        options.ensureFresh,
        options.ensureFreshDelayMs,
        requestOptions
      )
    }
    return options.ensureFresh
  })
  const remint = vi.fn(async (_requestedUser, requestOptions) => {
    if (options.remintDelayMs !== undefined) {
      return delayedSessionResult(
        options.remint,
        options.remintDelayMs,
        requestOptions
      )
    }
    return options.remint
  })
  const getSnapshot = vi.fn(
    () =>
      options.snapshot ??
      (options.ensureFresh?.status === 'ok'
        ? authenticated(options.ensureFresh.session)
        : SIGNED_OUT)
  )
  const fake: SessionFake = { ensureFresh, remint, getSnapshot }
  return { session: fake as SessionClient, ensureFresh, remint, getSnapshot }
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  })
}

/**
 * Headers arrive, the body never does. The stream fails on the signal the
 * transport passed to `fetch`, the way a real response body fails when its
 * request is aborted, so the body read is only bounded if the transport
 * still holds the timeout and the caller's cancellation over that phase.
 */
function stallingFetch(): MockedFunction<typeof fetch> {
  return vi.fn<typeof fetch>(
    async (_input, init) =>
      new Response(
        new ReadableStream<Uint8Array>({
          pull: () =>
            new Promise<void>((_resolve, reject) => {
              init?.signal?.addEventListener(
                'abort',
                () => reject(new DOMException('Aborted', 'AbortError')),
                { once: true }
              )
            })
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
  )
}

function makeTransport(
  options: {
    ensureFresh?: SessionResult | undefined
    ensureFreshDelayMs?: number
    remint?: SessionResult | undefined
    remintDelayMs?: number
    snapshot?: SessionSnapshot
    responses?: Response[]
    fetchImpl?: MockedFunction<typeof fetch>
    workspaceId?: () => string | undefined
  } = {}
) {
  const session = fakeSession({
    // `ensureFresh: undefined` is the signed-out case, not an omitted option.
    ensureFresh:
      'ensureFresh' in options
        ? options.ensureFresh
        : { status: 'ok', session: credential() },
    ...(options.ensureFreshDelayMs === undefined
      ? {}
      : { ensureFreshDelayMs: options.ensureFreshDelayMs }),
    ...(options.remint === undefined ? {} : { remint: options.remint }),
    ...(options.remintDelayMs === undefined
      ? {}
      : { remintDelayMs: options.remintDelayMs }),
    ...(options.snapshot === undefined ? {} : { snapshot: options.snapshot })
  })
  const queue = [...(options.responses ?? [jsonResponse(200, { ok: true })])]
  const fetchImpl =
    options.fetchImpl ??
    vi.fn<typeof fetch>(async () => queue.shift() ?? jsonResponse(200, {}))
  const transport = createSessionBillingTransport({
    session: session.session,
    resolveUrl: (route) => `${BASE}${route}`,
    fetchImpl,
    ...(options.workspaceId === undefined
      ? {}
      : { workspaceId: options.workspaceId })
  })
  return { transport, fetchImpl, ...session }
}

/** The headers of one recorded call, read through the platform object. */
function sentHeaders(
  fetchImpl: MockedFunction<typeof fetch>,
  call = 0
): Headers {
  return new Headers(fetchImpl.mock.calls[call]?.[1]?.headers)
}

describe('createSessionBillingTransport', () => {
  it('signs the request with the minted session and resolves the route', async () => {
    const { transport, fetchImpl } = makeTransport()

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(result).toMatchObject({ status: 'ok' })
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/billing/status`)
    expect(sentHeaders(fetchImpl).get('Authorization')).toBe(
      'Bearer workspace-jwt'
    )
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toBeUndefined()
  })

  it('mints for the host-selected workspace', async () => {
    const { transport, ensureFresh } = makeTransport({
      workspaceId: () => 'ws-7'
    })

    await transport({ method: 'GET', route: '/billing/status' })

    expect(ensureFresh).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ workspaceId: 'ws-7' })
    )
  })

  it('reports NOT_AUTHENTICATED without sending a request', async () => {
    const { transport, fetchImpl } = makeTransport({ ensureFresh: undefined })

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(result).toEqual({ status: 'error', code: 'NOT_AUTHENTICATED' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.for([
    ['ACCESS_DENIED', 'ACCESS_DENIED'],
    ['WORKSPACE_NOT_FOUND', 'NOT_FOUND'],
    ['NOT_AUTHENTICATED', 'NOT_AUTHENTICATED'],
    ['INVALID_FIREBASE_TOKEN', 'NOT_AUTHENTICATED'],
    ['TOKEN_EXCHANGE_FAILED', 'REQUEST_FAILED']
  ] as const)(
    'maps session failure %s to %s and keeps the status',
    async ([sessionCode, billingCode]) => {
      const { transport } = makeTransport({
        ensureFresh: { status: 'error', code: sessionCode, httpStatus: 403 }
      })

      const result = await transport({
        method: 'GET',
        route: '/billing/status'
      })

      expect(result).toEqual({
        status: 'error',
        code: billingCode,
        httpStatus: 403
      })
    }
  )

  it('shares one timeout budget across minting, re-minting, and retry', async () => {
    const fetchImpl = stallingFetch()
    fetchImpl.mockResolvedValueOnce(jsonResponse(401, {}))
    const { transport } = makeTransport({
      ensureFreshDelayMs: 300,
      remint: { status: 'ok', session: credential({ token: 'fresh-jwt' }) },
      remintDelayMs: 300,
      fetchImpl,
      snapshot: authenticated(credential())
    })

    const pending = transport({
      method: 'GET',
      route: '/billing/status',
      timeoutMs: 1_000
    })
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(pending).resolves.toEqual({
      status: 'error',
      code: 'REQUEST_FAILED'
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('returns a coded failure when the request budget aborts session minting', async () => {
    const { transport, fetchImpl } = makeTransport({
      ensureFreshDelayMs: 2_000
    })

    const pending = transport({
      method: 'GET',
      route: '/billing/status',
      timeoutMs: 1_000
    })
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(pending).resolves.toEqual({
      status: 'error',
      code: 'REQUEST_FAILED'
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns a coded failure when the request budget aborts session re-minting', async () => {
    const { transport, fetchImpl } = makeTransport({
      remint: { status: 'ok', session: credential({ token: 'fresh-jwt' }) },
      remintDelayMs: 2_000,
      responses: [jsonResponse(401, {})]
    })

    const pending = transport({
      method: 'GET',
      route: '/billing/status',
      timeoutMs: 1_000
    })
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(pending).resolves.toEqual({
      status: 'error',
      code: 'REQUEST_FAILED'
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('re-mints once and retries once when a read is answered 401', async () => {
    const { transport, fetchImpl, remint } = makeTransport({
      remint: { status: 'ok', session: credential({ token: 'fresh-jwt' }) },
      responses: [jsonResponse(401, {}), jsonResponse(200, { balance: 1 })]
    })

    const result = await transport({ method: 'GET', route: '/billing/balance' })

    expect(remint).toHaveBeenCalledTimes(1)
    expect(sentHeaders(fetchImpl, 1).get('Authorization')).toBe(
      'Bearer fresh-jwt'
    )
    expect(result).toMatchObject({
      status: 'ok',
      value: { httpStatus: 200, body: { balance: 1 } }
    })
  })

  it.for([
    credential({ uid: 'uid-2', token: 'other-user-jwt' }),
    credential({
      token: 'other-workspace-jwt',
      workspace: { id: 'ws-2', name: 'Team', type: 'team' }
    })
  ])(
    'does not retry under a re-minted session outside the original scope',
    async (remintedSession) => {
      const { transport, fetchImpl } = makeTransport({
        remint: { status: 'ok', session: remintedSession },
        responses: [jsonResponse(401, {})]
      })

      const result = await transport({
        method: 'GET',
        route: '/billing/status'
      })

      expect(result).toEqual({ status: 'error', code: 'SUPERSEDED' })
      expect(fetchImpl).toHaveBeenCalledOnce()
    }
  )

  it('never replays a write the backend cannot deduplicate', async () => {
    const { transport, fetchImpl, remint } = makeTransport({
      remint: { status: 'ok', session: credential({ token: 'fresh-jwt' }) },
      responses: [jsonResponse(401, {})]
    })

    const result = await transport({ method: 'POST', route: '/billing/topup' })

    expect(remint).not.toHaveBeenCalled()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      status: 'ok',
      value: { httpStatus: 401, authenticationRetrySkipped: true }
    })
  })

  it('replays a write that carries an idempotency key', async () => {
    const { transport, fetchImpl } = makeTransport({
      remint: { status: 'ok', session: credential({ token: 'fresh-jwt' }) },
      responses: [jsonResponse(401, {}), jsonResponse(200, { topup_id: 't1' })]
    })

    const result = await transport({
      method: 'POST',
      route: '/billing/topup',
      body: { amount_cents: 500 },
      idempotencyKey: 'key-1'
    })

    expect(sentHeaders(fetchImpl, 1).get('Idempotency-Key')).toBe('key-1')
    expect(result).toMatchObject({ status: 'ok', value: { httpStatus: 200 } })
  })

  it('surfaces a persistent 401 instead of retrying again', async () => {
    const { transport, fetchImpl, remint } = makeTransport({
      remint: { status: 'ok', session: credential({ token: 'fresh-jwt' }) },
      responses: [jsonResponse(401, {}), jsonResponse(401, {})]
    })

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(remint).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ status: 'ok', value: { httpStatus: 401 } })
  })

  it('reports a network failure while replaying after re-minting', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockRejectedValueOnce(new TypeError('network down'))
    const { transport, remint } = makeTransport({
      remint: { status: 'ok', session: credential({ token: 'fresh-jwt' }) },
      fetchImpl
    })

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(result).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
    expect(remint).toHaveBeenCalledOnce()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('refuses to attribute a response to a workspace the host has left', async () => {
    const { transport } = makeTransport({
      snapshot: authenticated(
        credential({
          workspace: { id: 'ws-2', name: 'Team', type: 'team' }
        })
      )
    })

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(result).toEqual({ status: 'error', code: 'SUPERSEDED' })
  })

  it('refuses to attribute a response to a session that signed out', async () => {
    const { transport } = makeTransport({ snapshot: SIGNED_OUT })

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(result).toEqual({ status: 'error', code: 'SUPERSEDED' })
  })

  it('treats a request that produced no response as the transient failure', async () => {
    const { transport } = makeTransport({
      fetchImpl: vi.fn<typeof fetch>(async () => {
        throw new TypeError('network down')
      })
    })

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(result).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
  })

  it('exposes response headers so the capability revision can be read', async () => {
    const { transport } = makeTransport({
      responses: [jsonResponse(200, {}, { 'X-Capability-Revision': '42' })]
    })

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(
      result.status === 'ok' && result.value.header('X-Capability-Revision')
    ).toBe('42')
  })

  it('reads an empty or non-JSON body as no body at all', async () => {
    const { transport } = makeTransport({
      responses: [
        new Response('', { status: 204 }),
        new Response('<html>gateway error</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' }
        })
      ]
    })

    const empty = await transport({ method: 'GET', route: '/billing/status' })
    const html = await transport({ method: 'GET', route: '/billing/status' })

    expect(empty).toMatchObject({
      status: 'ok',
      value: { httpStatus: 204, body: undefined }
    })
    expect(html).toMatchObject({
      status: 'ok',
      value: { httpStatus: 502, body: undefined }
    })
  })

  it('re-mints from a 401 whose response body cannot be read', async () => {
    const unreadable = new Response(
      new ReadableStream({
        pull() {
          throw new TypeError('stream failed')
        }
      }),
      { status: 401, headers: { 'Retry-After': '5' } }
    )
    const { transport, remint } = makeTransport({ responses: [unreadable] })

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(result).toMatchObject({
      status: 'ok',
      value: { httpStatus: 401, body: undefined }
    })
    expect(remint).toHaveBeenCalledOnce()
    expect(result.status === 'ok' && result.value.header('Retry-After')).toBe(
      '5'
    )
  })

  it('cancels a request whose caller signal was already aborted', async () => {
    const { transport } = makeTransport({
      fetchImpl: vi.fn<typeof fetch>(async (_input, init) => {
        if (init?.signal?.aborted === true) {
          throw new DOMException('Aborted', 'AbortError')
        }
        return jsonResponse(200, {})
      })
    })

    const result = await transport({
      method: 'GET',
      route: '/billing/status',
      signal: AbortSignal.abort()
    })

    expect(result).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
  })

  it('times out a body that never arrives', async () => {
    const { transport } = makeTransport({ fetchImpl: stallingFetch() })

    const pending = transport({
      method: 'GET',
      route: '/billing/status',
      timeoutMs: 1_000
    })
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(pending).resolves.toEqual({
      status: 'error',
      code: 'REQUEST_FAILED'
    })
  })

  it('cancels a body that never arrives when the caller aborts', async () => {
    const { transport } = makeTransport({ fetchImpl: stallingFetch() })
    const caller = new AbortController()

    const pending = transport({
      method: 'GET',
      route: '/billing/status',
      signal: caller.signal
    })
    await vi.advanceTimersByTimeAsync(0)
    caller.abort()

    await expect(pending).resolves.toEqual({
      status: 'error',
      code: 'REQUEST_FAILED'
    })
  })
})
