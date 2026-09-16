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

const SIGNED_OUT: SessionSnapshot = {
  phase: 'signed-out',
  user: null,
  session: undefined
}

const TEAM = { id: 'ws-2', name: 'Team', type: 'team' } as const

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
    scopeSource: sessionBillingScopeSource(fake),
    moveTo(next: SessionSnapshot) {
      snapshot = next
      for (const listener of [...listeners]) listener(snapshot)
    }
  }
}

const CARD = {
  brand: 'visa',
  id: 'pm_1',
  is_default: true,
  last4: '4242',
  type: 'card'
}

const METHODS = [CARD]

function httpOk(body: unknown): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: { httpStatus: 200, body, header: () => null }
  }
}

function httpStatus(
  status: number,
  extra: { readonly authenticationRetrySkipped?: true } = {}
): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: { httpStatus: status, body: {}, header: () => null, ...extra }
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

  it('serves concurrent readers of one scope from a single request', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([httpOk(METHODS)])
    const reader = createPaymentMethodsReader({ transport, scopeSource })

    const [first, second] = await Promise.all([reader.read(), reader.read()])

    expect(transport).toHaveBeenCalledTimes(1)
    expect(first).toEqual(second)
  })

  it('drops the published list on invalidate and republishes on the next read', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([
      httpOk(METHODS),
      httpOk([{ ...CARD, id: 'pm_2', last4: '1881' }])
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

  describe('scope safety', () => {
    it('reports SUPERSEDED and caches nothing when the workspace changed in flight', async () => {
      const host = fakeSession()
      let release = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const transport: BillingTransport = vi.fn(async () => {
        await gate
        return httpOk(METHODS)
      })
      const reader = createPaymentMethodsReader({
        transport,
        scopeSource: host.scopeSource
      })

      const pending = reader.read()
      host.moveTo(authenticated(credential({ workspace: TEAM })))
      release()

      expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
      expect(reader.getSnapshot()).toBeUndefined()
    })

    it('drops a published list when the host changes workspace', async () => {
      const host = fakeSession()
      const { transport } = fakeTransport([httpOk(METHODS)])
      const reader = createPaymentMethodsReader({
        transport,
        scopeSource: host.scopeSource
      })

      await reader.read()
      expect(reader.getSnapshot()).toBeDefined()

      host.moveTo(authenticated(credential({ workspace: TEAM })))

      // Naming one workspace's card as chargeable by another is the failure
      // this guards.
      expect(reader.getSnapshot()).toBeUndefined()
    })

    it('reports NOT_AUTHENTICATED without asking when nobody is signed in', async () => {
      const { scopeSource } = fakeSession(SIGNED_OUT)
      const { transport } = fakeTransport([httpOk(METHODS)])

      const result = await createPaymentMethodsReader({
        transport,
        scopeSource
      }).read()

      expect(result).toEqual({ status: 'error', code: 'NOT_AUTHENTICATED' })
      expect(transport).not.toHaveBeenCalled()
    })
  })

  describe('failures', () => {
    it.for([
      [401, false, 'ACCESS_DENIED'],
      [401, true, 'REQUEST_FAILED'],
      [403, false, 'ACCESS_DENIED'],
      [404, false, 'NOT_FOUND'],
      [500, false, 'REQUEST_FAILED']
    ] as const)(
      'maps %i (retry skipped: %s) to %s',
      async ([status, retrySkipped, code]) => {
        const { scopeSource } = fakeSession()
        const { transport } = fakeTransport([
          httpStatus(
            status,
            retrySkipped ? { authenticationRetrySkipped: true } : {}
          )
        ])

        const result = await createPaymentMethodsReader({
          transport,
          scopeSource
        }).read()

        expect(result).toEqual({ status: 'error', code, httpStatus: status })
      }
    )

    it('reports a 2xx body that does not match the contract as malformed', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([httpOk([{ ...CARD, id: 'card_1' }])])
      const reader = createPaymentMethodsReader({ transport, scopeSource })

      const result = await reader.read()

      expect(result).toEqual({
        status: 'error',
        code: 'MALFORMED_RESPONSE',
        httpStatus: 200
      })
      expect(reader.getSnapshot()).toBeUndefined()
    })

    it('keeps the last good list when a later read fails', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(METHODS),
        { status: 'error', code: 'REQUEST_FAILED' }
      ])
      const reader = createPaymentMethodsReader({ transport, scopeSource })

      await reader.read()
      const second = await reader.read()

      expect(second).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
      expect(reader.getSnapshot()?.methods[0].id).toBe('pm_1')
    })
  })

  it('clears the list and rejects an in-flight result after dispose', async () => {
    const { scopeSource } = fakeSession()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let calls = 0
    const transport: BillingTransport = vi.fn(async () => {
      calls++
      if (calls === 2) await gate
      return httpOk(METHODS)
    })
    const reader = createPaymentMethodsReader({ transport, scopeSource })

    await reader.read()
    const pending = reader.read()
    reader.dispose()

    expect(reader.getSnapshot()).toBeUndefined()
    release()
    expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
    expect(await reader.read()).toEqual({
      status: 'error',
      code: 'SUPERSEDED'
    })
  })
})
