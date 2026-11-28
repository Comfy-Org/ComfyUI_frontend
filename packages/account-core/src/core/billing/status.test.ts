/**
 * What only the billing status read does. The scope fence, the shared request,
 * and the publish rules it inherits are proved once in `scopedReader.test.ts`.
 */
import { assert, describe, expect, it, vi } from 'vitest'

import type { SessionSnapshot } from '#/core/session'
import { sessionBillingScopeSource } from './billingScope'
import type { BillingTransport } from './billingContracts'
import { createBillingStatusReader } from './status'
import {
  authenticated,
  credential,
  fakeTransport,
  httpOk
} from './__fixtures__/billingTestFixtures'
import type { SessionFake } from './__fixtures__/billingTestFixtures'

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
  ended_at: null,
  scheduled_change: null,
  team_credit_stop: null
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
    assert.isOk(result.status === 'ok')
    expect(result.value.status.pending_billing_op_id).toBe('op-1')
    expect(result.value.status.pending_billing_op_type).toBe('subscription')
    expect(result.value.scope).toEqual({
      userId: 'uid-1',
      workspaceId: 'ws-1',
      role: 'owner'
    })
  })

  it.for([
    { name: 'omitted on an older server', endedAt: undefined },
    { name: 'unknown', endedAt: null },
    { name: 'recorded', endedAt: '2026-10-27T12:00:00Z' }
  ])(
    'preserves an $name end date without inventing one',
    async ({ endedAt }) => {
      const { scopeSource } = fakeSession()
      const body: unknown = JSON.parse(
        JSON.stringify({ ...STATUS, ended_at: endedAt })
      )
      const { transport } = fakeTransport([httpOk(body)])
      const reader = createBillingStatusReader({ transport, scopeSource })

      const result = await reader.read()

      expect(result).toMatchObject({
        status: 'ok',
        value: { status: { has_funds: true } }
      })
      expect(reader.getSnapshot()?.status.ended_at).toBe(endedAt)
      expect(
        Object.hasOwn(reader.getSnapshot()?.status ?? {}, 'ended_at')
      ).toBe(endedAt !== undefined)
    }
  )

  it('keeps a known subscription tier', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([
      httpOk({ ...STATUS, subscription_tier: 'TEAM' })
    ])
    const reader = createBillingStatusReader({ transport, scopeSource })

    await reader.read()

    expect(reader.getSnapshot()?.status.subscription_tier).toBe('TEAM')
  })

  it('reads an unrecognized subscription tier as absent and keeps the rest of the status', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([
      httpOk({ ...STATUS, subscription_tier: 'FUTURE_TIER' })
    ])
    const reader = createBillingStatusReader({ transport, scopeSource })

    const result = await reader.read()

    assert.isOk(result.status === 'ok')
    expect(result.value.status).not.toHaveProperty('subscription_tier')
    expect(result.value.status).toMatchObject({
      is_active: true,
      has_funds: true,
      pending_billing_op_id: 'op-1'
    })
  })

  it.for([
    { name: 'malformed date', body: { ...STATUS, ended_at: 'not-a-date' } },
    { name: 'numeric date', body: { ...STATUS, ended_at: 1730000000 } },
    { name: 'malformed core field', body: { ...STATUS, has_funds: 'true' } },
    { name: 'missing core field', body: { ...STATUS, is_active: undefined } },
    { name: 'null tier', body: { ...STATUS, subscription_tier: null } },
    { name: 'numeric tier', body: { ...STATUS, subscription_tier: 3 } },
    {
      name: 'malformed core field beside an unrecognized tier',
      body: { ...STATUS, subscription_tier: 'FUTURE_TIER', has_funds: 'true' }
    }
  ])('rejects a $name without replacing valid status', async ({ body }) => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([httpOk(STATUS), httpOk(body)])
    const reader = createBillingStatusReader({ transport, scopeSource })
    await reader.read()

    const result = await reader.read()

    expect(result).toEqual({
      status: 'error',
      code: 'MALFORMED_RESPONSE',
      httpStatus: 200
    })
    expect(reader.getSnapshot()?.status).toMatchObject({
      ended_at: null,
      has_funds: true,
      is_active: true
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

  it('serves a fresh read from a new request, and the older answer cannot overwrite it', async () => {
    const { scopeSource } = fakeSession()
    const release: Array<() => void> = []
    const answers = [STATUS, { ...STATUS, pending_billing_op_id: 'op-2' }]
    let call = 0
    const transport: BillingTransport = vi.fn(async () => {
      const answer = answers[call++]
      await new Promise<void>((resolve) => release.push(resolve))
      return httpOk(answer)
    })
    const reader = createBillingStatusReader({ transport, scopeSource })

    const older = reader.read()
    const joined = reader.read()
    const fresh = reader.read({ fresh: true })
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(2))
    release[1]()
    const freshResult = await fresh
    release[0]()
    const [olderResult, joinedResult] = await Promise.all([older, joined])

    expect(transport).toHaveBeenCalledTimes(2)
    expect(freshResult).toMatchObject({
      status: 'ok',
      value: { status: { pending_billing_op_id: 'op-2' } }
    })
    expect(olderResult).toMatchObject({
      status: 'ok',
      value: { status: { pending_billing_op_id: 'op-1' } }
    })
    expect(joinedResult).toMatchObject({
      status: 'ok',
      value: { status: { pending_billing_op_id: 'op-1' } }
    })
    expect(reader.getSnapshot()).toMatchObject({
      status: { pending_billing_op_id: 'op-2' }
    })
  })
})
