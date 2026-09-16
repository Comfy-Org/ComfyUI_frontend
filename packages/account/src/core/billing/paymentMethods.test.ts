/**
 * What only the saved payment methods read does — its route, its projection,
 * and the invalidation the host drives. The scope fence, the shared request,
 * and the publish rules it inherits are proved once in `scopedReader.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest'

import type { SessionClient, SessionSnapshot } from '../session.js'
import type { AccountCredential } from '../sessionContracts.js'
import { sessionBillingScopeSource } from './billingScope.js'
import type {
  BillingHttpResponse,
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import { createPaymentMethodsReader } from './paymentMethods.js'

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

type SessionFake = Pick<SessionClient, 'getSnapshot' | 'subscribe'>

function fakeSession(snapshot: SessionSnapshot = authenticated(credential())) {
  const fake: SessionFake = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {}
  }
  return { scopeSource: sessionBillingScopeSource(fake) }
}

const CARD = {
  brand: 'visa',
  id: 'pm_1',
  is_default: true,
  last4: '4242',
  type: 'card'
}

const METHODS = [CARD]

const REPLACEMENT_CARD = { ...CARD, id: 'pm_2', last4: '1881' }

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

/** Holds the first answer open so an invalidation can land mid-flight. */
function transportWithSlowFirstAnswer(
  first: BillingResult<BillingHttpResponse>
) {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let calls = 0
  const transport: BillingTransport = vi.fn(async () => {
    calls++
    if (calls > 1) return httpOk([REPLACEMENT_CARD])
    await gate
    return first
  })
  return { transport, release: () => release() }
}

describe('createPaymentMethodsReader', () => {
  it('reads the saved cards from the payment methods route', async () => {
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(METHODS)])

    const result = await createPaymentMethodsReader({
      transport,
      scopeSource,
      now: () => 1_700
    }).read()

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].route).toBe('/billing/payment-methods')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.methods).toEqual([CARD])
    expect(result.value.readAt).toBe(1_700)
    expect(result.value.scope).toEqual({
      userId: 'uid-1',
      workspaceId: 'ws-1',
      role: 'owner'
    })
  })

  it('reads a workspace with no saved card as an empty list', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([httpOk([])])

    const result = await createPaymentMethodsReader({
      transport,
      scopeSource
    }).read()

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.methods).toEqual([])
  })

  it('bounds the request with the caller timeout', async () => {
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(METHODS)])

    await createPaymentMethodsReader({ transport, scopeSource }).read({
      timeoutMs: 5_000
    })

    expect(calls[0].timeoutMs).toBe(5_000)
  })

  it('drops the published list on invalidate and republishes on the next read', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([
      httpOk(METHODS),
      httpOk([REPLACEMENT_CARD])
    ])
    const reader = createPaymentMethodsReader({ transport, scopeSource })

    await reader.read()
    reader.invalidate()

    // A payment-portal round trip changed the list outside this reader, so
    // the cached one must not be shown while the next read is pending.
    expect(reader.getSnapshot()).toBeUndefined()

    const result = await reader.read()

    expect(transport).toHaveBeenCalledTimes(2)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.methods[0].id).toBe('pm_2')
    expect(reader.getSnapshot()?.methods[0].id).toBe('pm_2')
  })

  it('fences a request that predates an invalidation from publishing', async () => {
    const { scopeSource } = fakeSession()
    const { transport, release } = transportWithSlowFirstAnswer(httpOk(METHODS))
    const reader = createPaymentMethodsReader({ transport, scopeSource })

    const stale = reader.read()
    reader.invalidate()
    const fresh = reader.read()

    // The read that follows an invalidation issues its own request rather than
    // joining the one that resolved the list the host just reported as wrong.
    expect(transport).toHaveBeenCalledTimes(2)
    const result = await fresh
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.methods[0].id).toBe('pm_2')

    release()
    await stale

    expect(reader.getSnapshot()?.methods[0].id).toBe('pm_2')
  })

  it('keeps the fresh list when an invalidated request is denied late', async () => {
    const { scopeSource } = fakeSession()
    const { transport, release } = transportWithSlowFirstAnswer(httpStatus(403))
    const reader = createPaymentMethodsReader({ transport, scopeSource })

    const stale = reader.read()
    reader.invalidate()
    await reader.read()

    expect(reader.getSnapshot()?.methods[0].id).toBe('pm_2')

    release()
    await stale

    expect(reader.getSnapshot()?.methods[0].id).toBe('pm_2')
  })
})
