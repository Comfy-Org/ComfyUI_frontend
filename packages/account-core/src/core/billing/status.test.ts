/**
 * What only the billing status read does. The scope fence, the shared request,
 * and the publish rules it inherits are proved once in `scopedReader.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest'

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

  it.for([
    { name: 'omitted on an older server', nextCharge: undefined },
    { name: 'none', nextCharge: null },
    {
      name: 'served',
      nextCharge: {
        amount: 2000,
        currency: 'usd',
        date: '2026-11-27T12:00:00Z',
        reflects_scheduled_change: false
      }
    }
  ])(
    'preserves a $name next charge without inventing one',
    async ({ nextCharge }) => {
      const { scopeSource } = fakeSession()
      const body: unknown = JSON.parse(
        JSON.stringify({ ...STATUS, next_charge: nextCharge })
      )
      const { transport } = fakeTransport([httpOk(body)])
      const reader = createBillingStatusReader({ transport, scopeSource })

      const result = await reader.read()

      expect(result.status).toBe('ok')
      expect(reader.getSnapshot()?.status.next_charge).toStrictEqual(
        nextCharge && { ...nextCharge, amount: BigInt(nextCharge.amount) }
      )
      expect(
        Object.hasOwn(reader.getSnapshot()?.status ?? {}, 'next_charge')
      ).toBe(nextCharge !== undefined)
    }
  )

  it.for([
    { name: 'malformed date', body: { ...STATUS, ended_at: 'not-a-date' } },
    { name: 'numeric date', body: { ...STATUS, ended_at: 1730000000 } },
    { name: 'malformed core field', body: { ...STATUS, has_funds: 'true' } },
    { name: 'missing core field', body: { ...STATUS, is_active: undefined } }
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
})
