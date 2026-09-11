import { describe, expect, it, vi } from 'vitest'

import type { SessionClient, SessionSnapshot } from '../session.js'
import type { AccountCredential } from '../sessionContracts.js'
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

function httpStatus(
  status: number,
  body: unknown = {}
): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: { httpStatus: status, body, header: () => null }
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
    const { session } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(BALANCE)])

    const result = await createCreditsReader({ transport, session }).read()

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].route).toBe('/billing/balance')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.balance.amount_micros).toBe(12_500_000)
    expect(result.value.scope).toEqual({ userId: 'uid-1', workspaceId: 'ws-1' })
  })

  it('keeps the balance in micros rather than converting it', async () => {
    const { session } = fakeSession()
    const { transport } = fakeTransport([httpOk(BALANCE)])

    const result = await createCreditsReader({ transport, session }).read()

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    // Rounding to a display unit here would lose precision before the host
    // ever sees the number, and bake one currency's minor unit into the core.
    expect(result.value.balance.effective_balance_micros).toBe(12_000_000)
    expect(result.value.balance.pending_charges_micros).toBe(500_000)
  })

  it('accepts a response carrying only the required fields', async () => {
    const { session } = fakeSession()
    const { transport } = fakeTransport([
      httpOk({ amount_micros: 0, currency: 'USD' })
    ])

    const result = await createCreditsReader({ transport, session }).read()

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.balance.amount_micros).toBe(0)
    expect(result.value.balance.prepaid_balance_micros).toBeUndefined()
  })

  describe('deduplication', () => {
    it('serves concurrent readers of one scope from a single request', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([httpOk(BALANCE)])
      const reader = createCreditsReader({ transport, session })

      const [first, second] = await Promise.all([reader.read(), reader.read()])

      expect(transport).toHaveBeenCalledTimes(1)
      expect(first).toEqual(second)
    })

    it('requests again on a later read rather than serving the cache', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([httpOk(BALANCE)])
      const reader = createCreditsReader({ transport, session })

      await reader.read()
      await reader.read()

      // A balance moves on every run and carries no server-declared lifetime,
      // so there is no window over which serving a cached one is correct.
      expect(transport).toHaveBeenCalledTimes(2)
    })
  })

  describe('scope safety', () => {
    it('reports SUPERSEDED and caches nothing when the workspace changed in flight', async () => {
      const host = fakeSession()
      let release = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const transport: BillingTransport = vi.fn(async () => {
        await gate
        return httpOk(BALANCE)
      })
      const reader = createCreditsReader({ transport, session: host.session })

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

    it('reports SUPERSEDED and caches nothing when the host signed out in flight', async () => {
      const host = fakeSession()
      let release = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const transport: BillingTransport = vi.fn(async () => {
        await gate
        return httpOk(BALANCE)
      })
      const reader = createCreditsReader({ transport, session: host.session })

      const pending = reader.read()
      host.moveTo(SIGNED_OUT)
      release()

      expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
      expect(reader.getSnapshot()).toBeUndefined()
    })

    it('drops a published balance when the host changes workspace', async () => {
      const host = fakeSession()
      const { transport } = fakeTransport([httpOk(BALANCE)])
      const reader = createCreditsReader({ transport, session: host.session })

      await reader.read()
      expect(reader.getSnapshot()).toBeDefined()

      host.moveTo(
        authenticated(
          credential({ workspace: { id: 'ws-2', name: 'Team', type: 'team' } })
        )
      )

      // Showing one workspace's credits under another's name is the failure
      // this guards; a stale balance is worse than none.
      expect(reader.getSnapshot()).toBeUndefined()
    })

    it('reports NOT_AUTHENTICATED without asking when nobody is signed in', async () => {
      const { session } = fakeSession(SIGNED_OUT)
      const { transport } = fakeTransport([httpOk(BALANCE)])

      const result = await createCreditsReader({ transport, session }).read()

      expect(result).toEqual({ status: 'error', code: 'NOT_AUTHENTICATED' })
      expect(transport).not.toHaveBeenCalled()
    })
  })

  describe('failures', () => {
    it.for([
      [401, 'ACCESS_DENIED'],
      [403, 'ACCESS_DENIED'],
      [404, 'NOT_FOUND'],
      [500, 'REQUEST_FAILED']
    ] as const)('maps %i to %s', async ([status, code]) => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([httpStatus(status)])

      const result = await createCreditsReader({ transport, session }).read()

      expect(result).toEqual({ status: 'error', code, httpStatus: status })
    })

    it('reports a 2xx body that does not match the contract as malformed', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([
        httpOk({ amount_micros: 'a lot', currency: 'USD' })
      ])
      const reader = createCreditsReader({ transport, session })

      const result = await reader.read()

      expect(result).toEqual({
        status: 'error',
        code: 'MALFORMED_RESPONSE',
        httpStatus: 200
      })
      expect(reader.getSnapshot()).toBeUndefined()
    })

    it('keeps the last good balance when a later read fails', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(BALANCE),
        { status: 'error', code: 'REQUEST_FAILED' }
      ])
      const reader = createCreditsReader({ transport, session })

      await reader.read()
      const second = await reader.read()

      // The cache exists to survive a failure, not to skip a read: a transient
      // outage leaves the figure stale rather than blanking it.
      expect(second).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
      expect(reader.getSnapshot()?.balance.amount_micros).toBe(12_500_000)
    })
  })
})
