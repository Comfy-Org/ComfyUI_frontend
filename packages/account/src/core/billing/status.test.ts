import { describe, expect, it, vi } from 'vitest'

import type { SessionClient, SessionSnapshot } from '../session.js'
import type { AccountCredential } from '../sessionContracts.js'
import type {
  BillingHttpResponse,
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import { createBillingStatusReader } from './status.js'

function credential(
  overrides: Partial<AccountCredential> = {}
): AccountCredential {
  return {
    token: 'workspace-jwt',
    expiresAt: Date.now() + 60 * 60 * 1000,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: ['workspace:read'],
    ...overrides
  }
}

function authenticated(session: AccountCredential): SessionSnapshot {
  return {
    phase: 'authenticated',
    user: { uid: session.uid, getIdToken: async () => 'id-token' },
    session
  }
}

const SIGNED_OUT: SessionSnapshot = {
  phase: 'signed-out',
  user: null,
  session: undefined
}

type SessionFake = Pick<SessionClient, 'getSnapshot' | 'subscribe'>

function fakeSession(initial: SessionSnapshot = authenticated(credential())) {
  let snapshot = initial
  const listeners = new Set<(next: SessionSnapshot) => void>()
  const fake: SessionFake = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
  return {
    session: fake as SessionClient,
    moveTo(next: SessionSnapshot) {
      snapshot = next
      for (const listener of [...listeners]) listener(snapshot)
    }
  }
}

const STATUS = {
  action_url: 'https://billing.example/continue',
  billing_rail: 'stripe',
  billing_status: 'pending_payment',
  has_funds: true,
  is_active: true,
  max_seats: 10,
  occupied_seats: 4,
  pending_billing_op_id: 'op-1',
  pending_billing_op_type: 'subscription',
  scheduled_change: null,
  team_credit_stop: null
}

function httpOk(body: unknown): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: { httpStatus: 200, body, header: () => null }
  }
}

function httpStatus(status: number): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: { httpStatus: status, body: {}, header: () => null }
  }
}

function fakeTransport(answers: BillingResult<BillingHttpResponse>[]) {
  const calls: BillingRequest[] = []
  let index = 0
  const transport: BillingTransport = vi.fn(async (request) => {
    calls.push(request)
    const answer = answers[Math.min(index, answers.length - 1)]
    index++
    return answer
  })
  return { transport, calls }
}

describe('createBillingStatusReader', () => {
  it('reads and validates the authoritative billing status', async () => {
    const { session } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(STATUS)])

    const result = await createBillingStatusReader({
      transport,
      session
    }).read()

    expect(calls).toEqual([{ method: 'GET', route: '/billing/status' }])
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.status.pending_billing_op_id).toBe('op-1')
    expect(result.value.status.pending_billing_op_type).toBe('subscription')
    expect(result.value.scope).toEqual({
      userId: 'uid-1',
      workspaceId: 'ws-1',
      role: 'owner'
    })
  })

  it('deduplicates concurrent reads but refetches on a later read', async () => {
    const { session } = fakeSession()
    const { transport } = fakeTransport([httpOk(STATUS)])
    const reader = createBillingStatusReader({ transport, session })

    const [first, second] = await Promise.all([reader.read(), reader.read()])
    await reader.read()

    expect(first).toEqual(second)
    expect(transport).toHaveBeenCalledTimes(2)
  })

  it('releases an aborted caller without cancelling the shared read', async () => {
    const { session } = fakeSession()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const transport: BillingTransport = vi.fn(async () => {
      await gate
      return httpOk(STATUS)
    })
    const reader = createBillingStatusReader({ transport, session })

    const controller = new AbortController()
    const abandoned = reader.read({ signal: controller.signal })
    const remaining = reader.read()
    controller.abort()

    expect(await abandoned).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
    release()
    expect((await remaining).status).toBe('ok')
    expect(reader.getSnapshot()?.status.pending_billing_op_id).toBe('op-1')
  })

  it('rejects a response that settles after a workspace change', async () => {
    const host = fakeSession()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const transport: BillingTransport = vi.fn(async () => {
      await gate
      return httpOk(STATUS)
    })
    const reader = createBillingStatusReader({
      transport,
      session: host.session
    })

    const pending = reader.read()
    host.moveTo(
      authenticated(
        credential({ workspace: { id: 'ws-2', name: 'Team', type: 'team' } })
      )
    )
    release()

    expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
    expect(reader.getSnapshot()).toBeUndefined()
  })

  it('clears a published status when the session scope changes', async () => {
    const host = fakeSession()
    const { transport } = fakeTransport([httpOk(STATUS)])
    const reader = createBillingStatusReader({
      transport,
      session: host.session
    })

    await reader.read()
    host.moveTo(SIGNED_OUT)

    expect(reader.getSnapshot()).toBeUndefined()
    expect(await reader.read()).toEqual({
      status: 'error',
      code: 'NOT_AUTHENTICATED'
    })
  })

  it.for([
    [401, 'ACCESS_DENIED'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [503, 'REQUEST_FAILED']
  ] as const)('maps %i to %s', async ([status, code]) => {
    const { session } = fakeSession()
    const { transport } = fakeTransport([httpStatus(status)])

    const result = await createBillingStatusReader({
      transport,
      session
    }).read()

    expect(result).toEqual({ status: 'error', code, httpStatus: status })
  })

  it('reports a malformed successful response without replacing the last snapshot', async () => {
    const { session } = fakeSession()
    const { transport } = fakeTransport([
      httpOk(STATUS),
      httpOk({ ...STATUS, pending_billing_op_type: 'refund' })
    ])
    const reader = createBillingStatusReader({ transport, session })

    await reader.read()
    const result = await reader.read()

    expect(result).toEqual({
      status: 'error',
      code: 'MALFORMED_RESPONSE',
      httpStatus: 200
    })
    expect(reader.getSnapshot()?.status.pending_billing_op_type).toBe(
      'subscription'
    )
  })

  it('passes transport failures through without replacing the last snapshot', async () => {
    const { session } = fakeSession()
    const { transport } = fakeTransport([
      httpOk(STATUS),
      { status: 'error', code: 'REQUEST_FAILED' }
    ])
    const reader = createBillingStatusReader({ transport, session })

    await reader.read()
    const result = await reader.read()

    expect(result).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
    expect(reader.getSnapshot()?.status.pending_billing_op_id).toBe('op-1')
  })

  it('drops the last status snapshot when a later read is denied', async () => {
    const { session } = fakeSession()
    const { transport } = fakeTransport([httpOk(STATUS), httpStatus(403)])
    const reader = createBillingStatusReader({ transport, session })

    await reader.read()
    const result = await reader.read()

    expect(result).toEqual({
      status: 'error',
      code: 'ACCESS_DENIED',
      httpStatus: 403
    })
    expect(reader.getSnapshot()).toBeUndefined()
  })

  it('normalizes a throwing host transport to a coded failure', async () => {
    const { session } = fakeSession()
    const transport: BillingTransport = vi.fn(() => {
      throw new TypeError('host transport failed')
    })

    const result = await createBillingStatusReader({
      transport,
      session
    }).read()

    expect(result).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
  })

  it('clears account data and rejects an in-flight result after dispose', async () => {
    const { session } = fakeSession()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let calls = 0
    const transport: BillingTransport = vi.fn(async () => {
      calls++
      if (calls === 2) await gate
      return httpOk(STATUS)
    })
    const reader = createBillingStatusReader({ transport, session })

    await reader.read()
    const pending = reader.read()
    reader.dispose()

    expect(reader.getSnapshot()).toBeUndefined()
    release()
    expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
    expect(reader.getSnapshot()).toBeUndefined()
  })
})
