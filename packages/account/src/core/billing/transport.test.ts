import { describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'

import type { SessionClient, SessionSnapshot } from '../session.js'
import type { AccountCredential, SessionResult } from '../sessionContracts.js'
import { createSessionBillingTransport } from './transport.js'

const BASE = 'https://cloud.test/api'

function credential(overrides: Partial<AccountCredential> = {}) {
  return {
    token: 'workspace-jwt',
    expiresAt: Date.now() + 60 * 60 * 1000,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: ['workspace:read'],
    ...overrides
  } as AccountCredential
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
 * Only the three members the transport uses are real; anything else it
 * reaches for is a bug this fake should fail on rather than answer.
 */
function fakeSession(options: {
  ensureFresh?: SessionResult | undefined
  remint?: SessionResult | undefined
  snapshot?: SessionSnapshot
}) {
  const ensureFresh = vi.fn(async () => options.ensureFresh)
  const remint = vi.fn(async () => options.remint)
  const getSnapshot = vi.fn(
    () =>
      options.snapshot ??
      (options.ensureFresh?.status === 'ok'
        ? authenticated(options.ensureFresh.session)
        : SIGNED_OUT)
  )
  const session = {
    ensureFresh,
    remint,
    getSnapshot
  } as unknown as SessionClient
  return { session, ensureFresh, remint, getSnapshot }
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

function makeTransport(
  options: {
    ensureFresh?: SessionResult | undefined
    remint?: SessionResult | undefined
    snapshot?: SessionSnapshot
    responses?: Response[]
    fetchImpl?: typeof fetch
    workspaceId?: () => string | undefined
  } = {}
) {
  const session = fakeSession({
    // `ensureFresh: undefined` is the signed-out case, not an omitted option.
    ensureFresh:
      'ensureFresh' in options
        ? options.ensureFresh
        : { status: 'ok', session: credential() },
    ...(options.remint === undefined ? {} : { remint: options.remint }),
    ...(options.snapshot === undefined ? {} : { snapshot: options.snapshot })
  })
  const queue = [...(options.responses ?? [jsonResponse(200, { ok: true })])]
  const fetchImpl = (options.fetchImpl ??
    vi.fn(
      async () => queue.shift() ?? jsonResponse(200, {})
    )) as unknown as MockedFunction<typeof fetch>
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

function requestInit(fetchImpl: MockedFunction<typeof fetch>, call = 0) {
  return fetchImpl.mock.calls[call]?.[1] as RequestInit & {
    headers: Record<string, string>
  }
}

describe('createSessionBillingTransport', () => {
  it('signs the request with the minted session and resolves the route', async () => {
    const { transport, fetchImpl } = makeTransport()

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(result).toMatchObject({ status: 'ok' })
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/billing/status`)
    expect(requestInit(fetchImpl).headers.Authorization).toBe(
      'Bearer workspace-jwt'
    )
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

  it('maps a session failure to its billing code and keeps the status', async () => {
    const { transport } = makeTransport({
      ensureFresh: { status: 'error', code: 'ACCESS_DENIED', httpStatus: 403 }
    })

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(result).toEqual({
      status: 'error',
      code: 'ACCESS_DENIED',
      httpStatus: 403
    })
  })

  it('re-mints once and retries once when a read is answered 401', async () => {
    const { transport, fetchImpl, remint } = makeTransport({
      remint: { status: 'ok', session: credential({ token: 'fresh-jwt' }) },
      responses: [jsonResponse(401, {}), jsonResponse(200, { balance: 1 })]
    })

    const result = await transport({ method: 'GET', route: '/billing/balance' })

    expect(remint).toHaveBeenCalledTimes(1)
    expect(requestInit(fetchImpl, 1).headers.Authorization).toBe(
      'Bearer fresh-jwt'
    )
    expect(result).toMatchObject({
      status: 'ok',
      value: { httpStatus: 200, body: { balance: 1 } }
    })
  })

  it('never replays a write the backend cannot deduplicate', async () => {
    const { transport, fetchImpl, remint } = makeTransport({
      remint: { status: 'ok', session: credential({ token: 'fresh-jwt' }) },
      responses: [jsonResponse(401, {})]
    })

    const result = await transport({ method: 'POST', route: '/billing/topup' })

    expect(remint).not.toHaveBeenCalled()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ status: 'ok', value: { httpStatus: 401 } })
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

    expect(requestInit(fetchImpl, 1).headers['Idempotency-Key']).toBe('key-1')
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
      fetchImpl: vi.fn(async () => {
        throw new TypeError('network down')
      }) as unknown as typeof fetch
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
      responses: [new Response('', { status: 204 })]
    })

    const result = await transport({ method: 'GET', route: '/billing/status' })

    expect(result).toMatchObject({
      status: 'ok',
      value: { httpStatus: 204, body: undefined }
    })
  })
})
