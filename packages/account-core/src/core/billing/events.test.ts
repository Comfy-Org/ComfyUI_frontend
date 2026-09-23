/**
 * What only the billing events read does. The scope fence, the shared request,
 * and the publish rules it inherits are proved once in `scopedReader.test.ts`.
 */
import { describe, expect, it } from 'vitest'

import type { SessionSnapshot } from '../session.js'
import {
  authenticated,
  credential,
  fakeTransport,
  httpOk
} from './__fixtures__/billingTestFixtures.js'
import type { SessionFake } from './__fixtures__/billingTestFixtures.js'
import { sessionBillingScopeSource } from './billingScope.js'
import { createBillingEventsReader } from './events.js'

function fakeSession(snapshot: SessionSnapshot = authenticated(credential())) {
  const fake: SessionFake = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {}
  }
  return { scopeSource: sessionBillingScopeSource(fake) }
}

const EVENT = {
  createdAt: '2026-09-01T12:00:00.000Z',
  event_id: 'evt-1',
  event_type: 'topup_completed',
  params: { amount_cents: 2000 }
}

const PAGE = {
  events: [EVENT],
  limit: 20,
  page: 2,
  total: 21,
  totalPages: 2
}

describe('createBillingEventsReader', () => {
  it('reads a page of events and reports the scope it read for', async () => {
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(PAGE)])

    const result = await createBillingEventsReader({
      transport,
      scopeSource,
      now: () => 1_700
    }).read({ page: 2, limit: 20 })

    expect(calls).toEqual([
      { method: 'GET', route: '/billing/events?page=2&limit=20' }
    ])
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.events).toEqual([EVENT])
    expect(result.value.page).toBe(2)
    expect(result.value.totalPages).toBe(2)
    expect(result.value.readAt).toBe(1_700)
    expect(result.value.scope).toEqual({
      userId: 'uid-1',
      workspaceId: 'ws-1',
      role: 'owner'
    })
  })

  it.for([
    { name: 'neither', options: undefined, route: '/billing/events' },
    {
      name: 'only page',
      options: { page: 3 },
      route: '/billing/events?page=3'
    },
    {
      name: 'only limit',
      options: { limit: 50 },
      route: '/billing/events?limit=50'
    }
  ])(
    'asks the endpoint for its own default when given $name',
    async (fixture) => {
      const { scopeSource } = fakeSession()
      const { transport, calls } = fakeTransport([httpOk(PAGE)])

      await createBillingEventsReader({ transport, scopeSource }).read(
        fixture.options
      )

      expect(calls).toEqual([{ method: 'GET', route: fixture.route }])
    }
  )

  it('does not serve one page from another page in flight', async () => {
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([
      httpOk(PAGE),
      httpOk({ ...PAGE, page: 1, events: [] })
    ])
    const reader = createBillingEventsReader({ transport, scopeSource })

    const [second, first] = await Promise.all([
      reader.read({ page: 2, limit: 20 }),
      reader.read({ page: 1, limit: 20 })
    ])

    expect(calls).toHaveLength(2)
    expect(second.status === 'ok' && second.value.page).toBe(2)
    expect(first.status === 'ok' && first.value.page).toBe(1)
  })

  it('serves concurrent readers of one page from a single request', async () => {
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(PAGE)])
    const reader = createBillingEventsReader({ transport, scopeSource })

    const [first, second] = await Promise.all([
      reader.read({ page: 2, limit: 20 }),
      reader.read({ page: 2, limit: 20 })
    ])

    expect(calls).toHaveLength(1)
    expect(first).toEqual(second)
  })

  it('reports a page whose event the decoder rejects as malformed', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([
      httpOk({ ...PAGE, events: [{ ...EVENT, createdAt: 'last Tuesday' }] })
    ])

    const result = await createBillingEventsReader({
      transport,
      scopeSource
    }).read()

    expect(result).toEqual({
      status: 'error',
      code: 'MALFORMED_RESPONSE',
      httpStatus: 200
    })
  })
})
