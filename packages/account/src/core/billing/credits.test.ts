/**
 * What only the credits read does. The scope fence, the shared request, and
 * the publish rules it inherits are proved once in `scopedReader.test.ts`.
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
import { createCreditsReader } from './credits.js'

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

const BALANCE = {
  amount_micros: 12_500_000,
  currency: 'USD',
  prepaid_balance_micros: 10_000_000,
  pending_charges_micros: 500_000,
  effective_balance_micros: 12_000_000
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

describe('createCreditsReader', () => {
  it('reads the balance from the billing balance route', async () => {
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(BALANCE)])

    const result = await createCreditsReader({ transport, scopeSource }).read()

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].route).toBe('/billing/balance')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.balance.amount_micros).toBe(12_500_000)
    expect(result.value.scope).toEqual({
      userId: 'uid-1',
      workspaceId: 'ws-1',
      role: 'owner'
    })
  })

  it('keeps the balance in micros rather than converting it', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([httpOk(BALANCE)])

    const result = await createCreditsReader({ transport, scopeSource }).read()

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    // Rounding to a display unit here would lose precision before the host
    // ever sees the number, and bake one currency's minor unit into the core.
    expect(result.value.balance.effective_balance_micros).toBe(12_000_000)
    expect(result.value.balance.pending_charges_micros).toBe(500_000)
  })

  it('accepts a response carrying only the required fields', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([
      httpOk({ amount_micros: 0, currency: 'USD' })
    ])

    const result = await createCreditsReader({ transport, scopeSource }).read()

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.balance.amount_micros).toBe(0)
    expect(result.value.balance.prepaid_balance_micros).toBeUndefined()
  })
})
