/**
 * The contract every billing reader inherits from `createScopedReader`, proved
 * once against each reader that is built on it rather than five times over.
 * A reader's own test file keeps what only that reader does: its route, its
 * decoder, its projection, and the cache or invalidation it owns.
 */
import { describe, expect, it, vi } from 'vitest'

import type { SessionSnapshot } from '../session.js'
import type {
  BillingHttpResponse,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import type { BillingScopeSource } from './billingScope.js'
import { sessionBillingScopeSource } from './billingScope.js'
import { createCapabilitiesReader } from './capabilities.js'
import { createCreditsReader } from './credits.js'
import { createBillingEventsReader } from './events.js'
import { createPaymentMethodsReader } from './paymentMethods.js'
import { createPlansReader } from './plans.js'
import { createBillingStatusReader } from './status.js'
import {
  authenticated,
  credential,
  fakeTransport,
  httpOk,
  httpStatus
} from './__fixtures__/billingTestFixtures.js'
import type { SessionFake } from './__fixtures__/billingTestFixtures.js'

const SIGNED_OUT: SessionSnapshot = {
  phase: 'signed-out',
  user: null,
  session: undefined
}

const TEAM = { id: 'ws-2', name: 'Team', type: 'team' } as const

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
    scopeSource: sessionBillingScopeSource(fake),
    moveTo(next: SessionSnapshot) {
      snapshot = next
      for (const listener of [...listeners]) listener(snapshot)
    },
    moveToTeam() {
      this.moveTo(authenticated(credential({ workspace: TEAM })))
    }
  }
}

/** A transport whose every answer waits on a gate this test opens. */
function gatedTransport(answer: BillingResult<BillingHttpResponse>) {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const transport: BillingTransport = vi.fn(async () => {
    await gate
    return answer
  })
  return { transport, release: () => release() }
}

const BALANCE = {
  amount_micros: 12_500_000,
  currency: 'USD',
  prepaid_balance_micros: 10_000_000,
  pending_charges_micros: 500_000,
  effective_balance_micros: 12_000_000
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

const EVENTS_PAGE = {
  events: [
    {
      createdAt: '2026-09-01T12:00:00.000Z',
      event_id: 'evt-1',
      event_type: 'topup_completed'
    }
  ],
  limit: 20,
  page: 1,
  total: 1,
  totalPages: 1
}

const CARD = {
  brand: 'visa',
  id: 'pm_1',
  is_default: true,
  last4: '4242',
  type: 'card'
}

function capabilitiesBody(overrides: Record<string, unknown> = {}) {
  return {
    capabilities: {
      can_cancel: false,
      can_change_seats: false,
      can_downgrade_to_personal: false,
      can_invite_members: false,
      can_reactivate: false,
      can_subscribe_self_serve: false,
      can_top_up: true
    },
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    resolved_for: { user_id: 'uid-1', workspace_id: 'ws-1' },
    revision: 42,
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: true
    },
    ...overrides
  }
}

interface ReaderUnderTest {
  readonly read: () => Promise<BillingResult<unknown>>
  /** A read that reaches the transport even for a reader that paces itself. */
  readonly refetch: () => Promise<BillingResult<unknown>>
  readonly getSnapshot: () => unknown
  readonly dispose: () => void
}

interface ScopedReaderOptions {
  readonly transport: BillingTransport
  readonly scopeSource: BillingScopeSource
}

interface ReaderCase {
  readonly name: string
  /** A 2xx body this reader's decoder accepts. */
  readonly body: unknown
  /** A 2xx body this reader's decoder must reject. */
  readonly malformedBody: unknown
  /** True for a reader that may serve a cached answer instead of asking. */
  readonly paced: boolean
  readonly create: (options: ScopedReaderOptions) => ReaderUnderTest
}

function alwaysRequests(reader: {
  read: () => Promise<BillingResult<unknown>>
  getSnapshot: () => unknown
  dispose: () => void
}): ReaderUnderTest {
  return {
    read: reader.read,
    refetch: reader.read,
    getSnapshot: reader.getSnapshot,
    dispose: reader.dispose
  }
}

const CASES: readonly ReaderCase[] = [
  {
    name: 'credits',
    body: BALANCE,
    malformedBody: { amount_micros: 'a lot', currency: 'USD' },
    paced: false,
    create: (options) => alwaysRequests(createCreditsReader(options))
  },
  {
    name: 'billing status',
    body: STATUS,
    malformedBody: { ...STATUS, pending_billing_op_type: 'refund' },
    paced: false,
    create: (options) => alwaysRequests(createBillingStatusReader(options))
  },
  {
    name: 'plans',
    body: CATALOG,
    malformedBody: { plans: [{ ...PLAN, tier: 'GOLD' }] },
    paced: false,
    create: (options) => alwaysRequests(createPlansReader(options))
  },
  {
    name: 'payment methods',
    body: [CARD],
    malformedBody: [{ ...CARD, id: 'card_1' }],
    paced: false,
    create: (options) => alwaysRequests(createPaymentMethodsReader(options))
  },
  {
    name: 'billing events',
    body: EVENTS_PAGE,
    malformedBody: { ...EVENTS_PAGE, total: 'a few' },
    paced: false,
    create: (options) => alwaysRequests(createBillingEventsReader(options))
  },
  {
    name: 'capabilities',
    body: capabilitiesBody(),
    malformedBody: capabilitiesBody({ revision: 'forty-two' }),
    paced: true,
    create: (options) => {
      const reader = createCapabilitiesReader(options)
      return {
        read: () => reader.read(),
        refetch: () => reader.read({ forceRefresh: true }),
        getSnapshot: reader.getSnapshot,
        dispose: reader.dispose
      }
    }
  }
]

/** Readers that publish no cache to serve, so every read reaches the transport. */
const UNPACED = CASES.filter((readerCase) => !readerCase.paced)

describe('the scope fence every billing reader inherits', () => {
  it.for(CASES)(
    'reports NOT_AUTHENTICATED without asking, for $name',
    async (readerCase) => {
      const { scopeSource } = fakeSession(SIGNED_OUT)
      const { transport } = fakeTransport([httpOk(readerCase.body)])

      const result = await readerCase.create({ transport, scopeSource }).read()

      expect(result).toEqual({ status: 'error', code: 'NOT_AUTHENTICATED' })
      expect(transport).not.toHaveBeenCalled()
    }
  )

  it.for(CASES)(
    'reports SUPERSEDED and publishes nothing when the workspace changes in flight, for $name',
    async (readerCase) => {
      const host = fakeSession()
      const { transport, release } = gatedTransport(httpOk(readerCase.body))
      const reader = readerCase.create({
        transport,
        scopeSource: host.scopeSource
      })

      const pending = reader.read()
      host.moveToTeam()
      release()

      expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
      expect(reader.getSnapshot()).toBeUndefined()
    }
  )

  it.for(CASES)(
    'reports SUPERSEDED and publishes nothing when the host signs out in flight, for $name',
    async (readerCase) => {
      const host = fakeSession()
      const { transport, release } = gatedTransport(httpOk(readerCase.body))
      const reader = readerCase.create({
        transport,
        scopeSource: host.scopeSource
      })

      const pending = reader.read()
      host.moveTo(SIGNED_OUT)
      release()

      expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
      expect(reader.getSnapshot()).toBeUndefined()
    }
  )

  it.for(CASES)(
    'reports SUPERSEDED when a failure lands after the workspace changes, for $name',
    async (readerCase) => {
      const host = fakeSession()
      const { transport, release } = gatedTransport(httpStatus(500))
      const reader = readerCase.create({
        transport,
        scopeSource: host.scopeSource
      })

      const pending = reader.read()
      host.moveToTeam()
      release()

      expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
    }
  )

  // Disposal short-circuits the same guard for every reader, so one stands in
  // for all five rather than crossing the trigger with the reader dimension.
  it('reports SUPERSEDED when a failure lands after dispose', async () => {
    const { scopeSource } = fakeSession()
    const { transport, release } = gatedTransport(httpStatus(500))
    const reader = createCreditsReader({ transport, scopeSource })

    const pending = reader.read()
    reader.dispose()
    release()

    expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
  })

  it.for(CASES)(
    'drops the published snapshot and refuses the next read when the host signs out, for $name',
    async (readerCase) => {
      const host = fakeSession()
      const { transport } = fakeTransport([httpOk(readerCase.body)])
      const reader = readerCase.create({
        transport,
        scopeSource: host.scopeSource
      })

      await reader.read()
      host.moveTo(SIGNED_OUT)

      expect(reader.getSnapshot()).toBeUndefined()
      expect(await reader.read()).toEqual({
        status: 'error',
        code: 'NOT_AUTHENTICATED'
      })
    }
  )

  it.for(CASES)(
    'drops the published snapshot when the host changes workspace, for $name',
    async (readerCase) => {
      const host = fakeSession()
      const { transport } = fakeTransport([httpOk(readerCase.body)])
      const reader = readerCase.create({
        transport,
        scopeSource: host.scopeSource
      })

      await reader.read()
      expect(reader.getSnapshot()).toBeDefined()

      host.moveToTeam()

      // Showing one workspace's billing state under another's name is the
      // failure this guards; a stale answer is worse than none.
      expect(reader.getSnapshot()).toBeUndefined()
    }
  )

  it.for(CASES)(
    'clears the published snapshot and rejects an in-flight result after dispose, for $name',
    async (readerCase) => {
      const { scopeSource } = fakeSession()
      let release = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let calls = 0
      const transport: BillingTransport = vi.fn(async () => {
        calls++
        if (calls === 2) await gate
        return httpOk(readerCase.body)
      })
      const reader = readerCase.create({ transport, scopeSource })

      await reader.read()
      const pending = reader.refetch()
      reader.dispose()

      expect(reader.getSnapshot()).toBeUndefined()
      release()
      expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
      expect(reader.getSnapshot()).toBeUndefined()
    }
  )
})

describe('what a settled read does to the published snapshot', () => {
  it.for(CASES)(
    'reports a 2xx body that does not match the contract as malformed, for $name',
    async (readerCase) => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([httpOk(readerCase.malformedBody)])
      const reader = readerCase.create({ transport, scopeSource })

      const result = await reader.read()

      expect(result).toEqual({
        status: 'error',
        code: 'MALFORMED_RESPONSE',
        httpStatus: 200
      })
      expect(reader.getSnapshot()).toBeUndefined()
    }
  )

  it.for(CASES)(
    'drops the published snapshot when a later read is denied, for $name',
    async (readerCase) => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(readerCase.body),
        httpStatus(403)
      ])
      const reader = readerCase.create({ transport, scopeSource })

      await reader.read()
      const result = await reader.refetch()

      expect(result).toEqual({
        status: 'error',
        code: 'ACCESS_DENIED',
        httpStatus: 403
      })
      expect(reader.getSnapshot()).toBeUndefined()
    }
  )

  it.for(CASES)(
    'keeps the published snapshot when a later read fails transiently, for $name',
    async (readerCase) => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(readerCase.body),
        { status: 'error', code: 'REQUEST_FAILED' }
      ])
      const reader = readerCase.create({ transport, scopeSource })

      await reader.read()
      const result = await reader.refetch()

      // The cache exists to survive a failure, not to skip a read: a transient
      // outage leaves the answer stale rather than blanking it.
      expect(result).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
      expect(reader.getSnapshot()).toBeDefined()
    }
  )

  // Capabilities is excluded because it paces itself: a second read inside the
  // server-declared lifetime is served from the cache by design, which its own
  // test file covers.
  it.for(UNPACED)(
    'requests again on a later read rather than serving the cache, for $name',
    async (readerCase) => {
      const { scopeSource } = fakeSession()
      const { transport, calls } = fakeTransport([httpOk(readerCase.body)])
      const reader = readerCase.create({ transport, scopeSource })

      await reader.read()
      await reader.read()

      expect(calls).toHaveLength(2)
    }
  )

  it.for([
    [401, 'ACCESS_DENIED'],
    [403, 'ACCESS_DENIED'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [500, 'REQUEST_FAILED'],
    [503, 'REQUEST_FAILED']
  ] as const)('maps %i to %s', async ([status, code]) => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([httpStatus(status)])

    const result = await createCreditsReader({ transport, scopeSource }).read()

    expect(result).toEqual({ status: 'error', code, httpStatus: status })
  })
})

/**
 * One reader stands in for all five here: the sharing and release path is the
 * skeleton's alone, and these assertions need a concrete snapshot to read.
 */
describe('sharing one request per scope', () => {
  it('serves concurrent readers of one scope from a single request', async () => {
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(BALANCE)])
    const reader = createCreditsReader({ transport, scopeSource })

    const [first, second] = await Promise.all([reader.read(), reader.read()])

    expect(calls).toHaveLength(1)
    expect(first).toEqual(second)
  })

  it('does not join a read belonging to another scope', async () => {
    const host = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(BALANCE)])
    const reader = createCreditsReader({
      transport,
      scopeSource: host.scopeSource
    })

    const personal = reader.read()
    host.moveToTeam()
    const team = reader.read()
    await Promise.all([personal, team])

    expect(calls).toHaveLength(2)
    expect(await personal).toEqual({ status: 'error', code: 'SUPERSEDED' })
  })

  it('releases a joining caller that aborts, without disturbing the shared read', async () => {
    const { scopeSource } = fakeSession()
    const { transport, release } = gatedTransport(httpOk(BALANCE))
    const reader = createCreditsReader({ transport, scopeSource })
    const joiner = new AbortController()

    const shared = reader.read()
    const joined = reader.read({ signal: joiner.signal })
    joiner.abort()

    expect(await joined).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
    release()
    expect((await shared).status).toBe('ok')
    expect(reader.getSnapshot()?.balance.amount_micros).toBe(12_500_000)
  })

  it('keeps joined callers alive when the initiating caller aborts', async () => {
    const { scopeSource } = fakeSession()
    const { transport, release } = gatedTransport(httpOk(BALANCE))
    const reader = createCreditsReader({ transport, scopeSource })
    const initiator = new AbortController()

    const first = reader.read({ signal: initiator.signal })
    const joined = reader.read()
    initiator.abort()

    expect(await first).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
    release()
    expect((await joined).status).toBe('ok')
  })

  it('releases a caller whose signal was already aborted', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([httpOk(BALANCE)])
    const reader = createCreditsReader({ transport, scopeSource })

    const result = await reader.read({ signal: AbortSignal.abort() })

    expect(result).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
  })

  it('prevents an older read from publishing after a scope round trip', async () => {
    const host = fakeSession()
    const releases: Array<(balance: typeof BALANCE) => void> = []
    const transport: BillingTransport = vi.fn(
      () =>
        new Promise<BillingResult<BillingHttpResponse>>((resolve) => {
          releases.push((balance) => resolve(httpOk(balance)))
        })
    )
    const reader = createCreditsReader({
      transport,
      scopeSource: host.scopeSource
    })

    const firstA = reader.read()
    host.moveToTeam()
    const readB = reader.read()
    host.moveTo(authenticated(credential()))
    const latestA = reader.read()

    releases[2]({ ...BALANCE, amount_micros: 99 })
    await latestA
    releases[0]({ ...BALANCE, amount_micros: 10 })
    releases[1]({ ...BALANCE, amount_micros: 20 })

    expect(await firstA).toEqual({ status: 'error', code: 'SUPERSEDED' })
    expect(await readB).toEqual({ status: 'error', code: 'SUPERSEDED' })
    expect(reader.getSnapshot()?.balance.amount_micros).toBe(99)
  })
})
