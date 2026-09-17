/**
 * What only the plans read does. The scope fence, the shared request, and the
 * publish rules it inherits are proved once in `scopedReader.test.ts`.
 */
import { describe, expect, it } from 'vitest'

import type { SessionSnapshot } from '../session.js'
import { sessionBillingScopeSource } from './billingScope.js'
import { createPlansReader } from './plans.js'
import {
  authenticated,
  credential,
  fakeTransport,
  httpOk
} from './__fixtures__/billingTestFixtures.js'
import type { SessionFake } from './__fixtures__/billingTestFixtures.js'

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
