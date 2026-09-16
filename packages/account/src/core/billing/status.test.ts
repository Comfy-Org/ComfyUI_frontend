/**
 * What only the billing status read does. The scope fence, the shared request,
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

type SessionFake = Pick<SessionClient, 'getSnapshot' | 'subscribe'>

function fakeSession(snapshot: SessionSnapshot = authenticated(credential())) {
  const fake: SessionFake = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {}
  }
  return { scopeSource: sessionBillingScopeSource(fake) }
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
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(STATUS)])

    const result = await createBillingStatusReader({
      transport,
      scopeSource
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

  it('reports a malformed successful response without replacing the last snapshot', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([
      httpOk(STATUS),
      httpOk({ ...STATUS, pending_billing_op_type: 'refund' })
    ])
    const reader = createBillingStatusReader({ transport, scopeSource })

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

  it('normalizes a throwing host transport to a coded failure', async () => {
    const { scopeSource } = fakeSession()
    const transport: BillingTransport = vi.fn(() => {
      throw new TypeError('host transport failed')
    })

    const result = await createBillingStatusReader({
      transport,
      scopeSource
    }).read()

    expect(result).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
  })
})
