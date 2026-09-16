/**
 * What only the plans read does. The scope fence, the shared request, and the
 * publish rules it inherits are proved once in `scopedReader.test.ts`.
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
import { createPlansReader } from './plans.js'

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

const PLAN = {
  availability: { available: true },
  credits_cents: 2000,
  duration: 'MONTHLY',
  max_seats: 1,
  price_cents: 2000,
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 2000,
    total_credits_cents: 2000
  },
  slug: 'creator_monthly',
  tier: 'CREATOR'
}

const CATALOG = { current_plan_slug: 'free', plans: [PLAN] }

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

describe('createPlansReader', () => {
  it('reads the catalog from the billing plans route', async () => {
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(CATALOG)])

    const result = await createPlansReader({
      transport,
      scopeSource,
      now: () => 1_700
    }).read()

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].route).toBe('/billing/plans')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.data.current_plan_slug).toBe('free')
    expect(result.value.data.plans[0].slug).toBe('creator_monthly')
    expect(result.value.data.plans[0].price_cents).toBe(2000n)
    expect(result.value.readAt).toBe(1_700)
    expect(result.value.scope).toEqual({
      userId: 'uid-1',
      workspaceId: 'ws-1',
      role: 'owner'
    })
  })

  it('bounds the request with the caller timeout', async () => {
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(CATALOG)])

    await createPlansReader({ transport, scopeSource }).read({
      timeoutMs: 5_000
    })

    expect(calls[0].timeoutMs).toBe(5_000)
  })
})
