import { describe, expect, it, vi } from 'vitest'

import type { SessionSnapshot } from '../session.js'
import type { AccountCredential } from '../sessionContracts.js'
import {
  authenticated,
  credential,
  fakeTransport,
  httpOk
} from './__fixtures__/billingTestFixtures.js'
import type { SessionFake } from './__fixtures__/billingTestFixtures.js'
import type { BillingSession, BillingTransport } from './billingContracts.js'
import { sessionBillingScopeSource } from './billingScope.js'
import {
  CAPABILITY_REVISION_HEADER,
  createCapabilitiesReader,
  readCapabilityRevision
} from './capabilities.js'
import { createSessionBillingTransport } from './transport.js'

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
    /** Moves the host to a new snapshot and notifies subscribers. */
    moveTo(next: SessionSnapshot) {
      snapshot = next
      for (const listener of [...listeners]) listener(snapshot)
    }
  }
}

const CAPABILITIES = {
  can_cancel: false,
  can_change_seats: false,
  can_downgrade_to_personal: false,
  can_invite_members: false,
  can_reactivate: false,
  can_subscribe_self_serve: false,
  can_top_up: true
}

const ROLLOUT_DEFAULTS = {
  can_downgrade_to_personal: false,
  can_subscribe_self_serve: false,
  can_top_up: true
}

function capabilitiesBody(overrides: Record<string, unknown> = {}) {
  return {
    capabilities: CAPABILITIES,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    resolved_for: { user_id: 'uid-1', workspace_id: 'ws-1' },
    revision: 42,
    rollout_defaults_applied: ROLLOUT_DEFAULTS,
    ...overrides
  }
}

describe('createCapabilitiesReader', () => {
  it('decodes the server answer and reports the resolved scope', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([httpOk(capabilitiesBody())])
    const reader = createCapabilitiesReader({ transport, scopeSource })

    const result = await reader.read()

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.capabilities.can_top_up).toBe(true)
    expect(result.value.revision).toBe(42)
    expect(result.value.scope).toEqual({
      userId: 'uid-1',
      workspaceId: 'ws-1',
      role: 'owner'
    })
    expect(result.value.rolloutDefaultsApplied.can_top_up).toBe(true)
  })

  it('asks the capabilities route with production\u2019s 10s budget', async () => {
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(capabilitiesBody())])

    await createCapabilitiesReader({ transport, scopeSource }).read()

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].route).toBe('/billing/capabilities')
    expect(calls[0].timeoutMs).toBe(10_000)
  })

  describe('deduplication', () => {
    it('does not join a read belonging to another scope', async () => {
      const host = fakeSession()
      const { transport } = fakeTransport([
        httpOk(capabilitiesBody()),
        httpOk(
          capabilitiesBody({
            resolved_for: { user_id: 'uid-1', workspace_id: 'ws-2' }
          })
        )
      ])
      const reader = createCapabilitiesReader({
        transport,
        scopeSource: host.scopeSource
      })

      const first = reader.read()
      host.moveTo(
        authenticated(
          credential({ workspace: { id: 'ws-2', name: 'Team', type: 'team' } })
        )
      )
      const second = reader.read()
      await Promise.all([first, second])

      expect(transport).toHaveBeenCalledTimes(2)
    })

    it('serves a fresh cached snapshot without asking again', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({ transport, scopeSource })

      await reader.read()
      await reader.read()

      expect(transport).toHaveBeenCalledTimes(1)
    })

    it('refetches when the caller forces a refresh', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({ transport, scopeSource })

      await reader.read()
      await reader.read({ forceRefresh: true })

      expect(transport).toHaveBeenCalledTimes(2)
    })
  })

  describe('freshness', () => {
    it('refetches once the server-declared lifetime has passed', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(
          capabilitiesBody({
            expires_at: new Date(Date.now() + 30_000).toISOString()
          })
        )
      ])
      let clock = Date.now()
      const reader = createCapabilitiesReader({
        transport,
        scopeSource,
        now: () => clock
      })

      await reader.read()
      clock += 31_000
      await reader.read()

      expect(transport).toHaveBeenCalledTimes(2)
    })

    it('falls back to a fixed lifetime when the clock disagrees with the server', async () => {
      const { scopeSource } = fakeSession()
      // Already expired on arrival: the client and server clocks disagree, so
      // expires_at cannot pace anything and the fixed interval is used.
      const { transport } = fakeTransport([
        httpOk(
          capabilitiesBody({
            expires_at: new Date(Date.now() - 60_000).toISOString()
          })
        )
      ])
      const clock = Date.now()
      const reader = createCapabilitiesReader({
        transport,
        scopeSource,
        now: () => clock
      })

      const first = await reader.read()
      expect(first.status).toBe('ok')
      if (first.status !== 'ok') return
      expect(first.value.freshUntil).toBe(clock + 60_000)

      await reader.read()
      expect(transport).toHaveBeenCalledTimes(1)
    })

    it('treats an unparseable expiry as the fixed lifetime rather than failing', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(capabilitiesBody({ expires_at: 'not-a-timestamp' }))
      ])
      const clock = Date.now()
      const reader = createCapabilitiesReader({
        transport,
        scopeSource,
        now: () => clock
      })

      const result = await reader.read()

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.value.freshUntil).toBe(clock + 60_000)
    })
  })

  describe('scope safety', () => {
    it('drops owner capabilities when the role changes in place', async () => {
      const host = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({
        transport,
        scopeSource: host.scopeSource
      })

      await reader.read()
      host.moveTo(authenticated(credential({ role: 'member' })))

      expect(reader.getSnapshot()).toBeUndefined()
      const result = await reader.read()
      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.value.scope.role).toBe('member')
      expect(transport).toHaveBeenCalledTimes(2)
    })

    it('refuses an answer the server resolved for another workspace', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(
          capabilitiesBody({
            resolved_for: { user_id: 'uid-1', workspace_id: 'ws-other' }
          })
        )
      ])
      const reader = createCapabilitiesReader({ transport, scopeSource })

      const result = await reader.read()

      expect(result).toEqual({
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 200
      })
      expect(reader.getSnapshot()).toBeUndefined()
    })

    it('refuses another member\u2019s answer for the caller\u2019s own workspace', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(
          capabilitiesBody({
            // The right workspace, the wrong actor. Capabilities resolve per
            // (user, workspace), so this decides what a different member may
            // be offered — publishing it would hand the caller someone else's
            // rights.
            resolved_for: { user_id: 'uid-other', workspace_id: 'ws-1' },
            capabilities: { ...CAPABILITIES, can_cancel: true }
          })
        )
      ])
      const reader = createCapabilitiesReader({ transport, scopeSource })

      const result = await reader.read()

      expect(result).toEqual({
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 200
      })
      expect(reader.getSnapshot()).toBeUndefined()
    })
  })

  describe('failures', () => {
    it('passes a transport failure through without inventing a status', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([
        { status: 'error', code: 'REQUEST_FAILED' }
      ])

      const result = await createCapabilitiesReader({
        transport,
        scopeSource
      }).read()

      expect(result).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
    })
  })

  describe('denial reasons', () => {
    it('decodes a reason the server named', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(
          capabilitiesBody({
            denied_reasons: { can_subscribe_self_serve: 'not_workspace_owner' }
          })
        )
      ])

      const result = await createCapabilitiesReader({
        transport,
        scopeSource
      }).read()

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.value.denials['can_subscribe_self_serve']).toBe(
        'not_workspace_owner'
      )
    })

    it('falls back to the generic reason for a value it does not recognize', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(
          capabilitiesBody({
            denied_reasons: {
              can_subscribe_self_serve: 'a_branch_this_client_predates'
            }
          })
        )
      ])

      const result = await createCapabilitiesReader({
        transport,
        scopeSource
      }).read()

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.value.denials['can_subscribe_self_serve']).toBe(
        'unspecified'
      )
    })

    it('keeps the capability set usable when a reason is unrecognized', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(
          capabilitiesBody({
            denied_reasons: { can_top_up: 'something_new' }
          })
        )
      ])

      const result = await createCapabilitiesReader({
        transport,
        scopeSource
      }).read()

      // The point of the lenient decode: a reason this client predates must
      // not cost the caller the capability set that gates its UI.
      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.value.capabilities.can_top_up).toBe(true)
    })

    it('reads an absent denials object as no reasons, not as a granted capability', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])

      const result = await createCapabilitiesReader({
        transport,
        scopeSource
      }).read()

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.value.denials).toEqual({})
      expect(result.value.capabilities.can_subscribe_self_serve).toBe(false)
    })
  })

  describe('revision invalidation', () => {
    it('refetches after a mutation reports a different revision', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({ transport, scopeSource })

      await reader.read()
      reader.invalidate(43)
      await reader.read()

      expect(transport).toHaveBeenCalledTimes(2)
    })

    it('ignores a revision the cached snapshot already carries', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({ transport, scopeSource })

      await reader.read()
      // The read echoes its own revision on the response header. Treating that
      // as an invalidation would mark the read stale and refetch forever.
      reader.invalidate(42)
      await reader.read()

      expect(transport).toHaveBeenCalledTimes(1)
    })

    it('refetches after an unqualified invalidation', async () => {
      const { scopeSource } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({ transport, scopeSource })

      await reader.read()
      reader.invalidate()
      await reader.read()

      expect(transport).toHaveBeenCalledTimes(2)
    })

    it('publishes a read invalidated in flight as already stale', async () => {
      const { scopeSource } = fakeSession()
      let release = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let calls = 0
      const transport: BillingTransport = vi.fn(async () => {
        calls++
        if (calls === 1) await gate
        return httpOk(capabilitiesBody())
      })
      const reader = createCapabilitiesReader({ transport, scopeSource })

      const pending = reader.read()
      // A mutation committed while the read was in flight. The revision the
      // read returns cannot prove it saw that mutation, so its answer is
      // published but must not satisfy the next reader.
      reader.invalidate(99)
      release()
      await pending

      expect(reader.getSnapshot()?.freshUntil).toBe(0)
      await reader.read()
      expect(transport).toHaveBeenCalledTimes(2)
    })
  })
})

/**
 * The reader is built on the real transport here rather than a fake, because
 * the one guarantee these cases are about — a read re-mints once on a 401 and
 * retries once, never more — lives in the transport. A fake would assert the
 * fake.
 */
describe('createCapabilitiesReader over the session transport', () => {
  function sessionFor(credentials: AccountCredential[]) {
    const snapshot = authenticated(credentials[0])
    let index = 0
    const next = async () => ({
      status: 'ok' as const,
      session: credentials[Math.min(index++, credentials.length - 1)]
    })
    const fake: BillingSession = {
      ensureFresh: vi.fn(next),
      remint: vi.fn(next),
      getSnapshot: () => snapshot,
      subscribe: () => () => {}
    }
    return { session: fake, remint: fake.remint }
  }

  function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  function readerOver(responses: Response[]) {
    const { session, remint } = sessionFor([
      credential({ token: 'stale-jwt' }),
      credential({ token: 'fresh-jwt' })
    ])
    let index = 0
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      responses[Math.min(index++, responses.length - 1)].clone()
    )
    const transport = createSessionBillingTransport({
      session,
      resolveUrl: (route) => `https://cloud.test/api${route}`,
      fetchImpl
    })
    return {
      reader: createCapabilitiesReader({
        transport,
        scopeSource: sessionBillingScopeSource(session)
      }),
      fetchImpl,
      remint
    }
  }

  it('re-mints once and retries when the first attempt is refused', async () => {
    const { reader, fetchImpl, remint } = readerOver([
      jsonResponse(401, { message: 'expired' }),
      jsonResponse(200, capabilitiesBody())
    ])

    const result = await reader.read()

    expect(result.status).toBe('ok')
    expect(remint).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const retried = fetchImpl.mock.calls[1][1] as RequestInit
    expect((retried.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer fresh-jwt'
    )
  })

  it('surfaces a refusal that survives the retry, without retrying again', async () => {
    const { reader, fetchImpl, remint } = readerOver([jsonResponse(401, {})])

    const result = await reader.read()

    expect(result).toEqual({
      status: 'error',
      code: 'ACCESS_DENIED',
      httpStatus: 401
    })
    expect(remint).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(reader.getSnapshot()).toBeUndefined()
  })
})

describe('readCapabilityRevision', () => {
  it('reads the revision a response reports', () => {
    expect(
      readCapabilityRevision((name) =>
        name === CAPABILITY_REVISION_HEADER ? '17' : null
      )
    ).toBe(17)
  })

  it.for([
    ['an absent header', null],
    ['a non-numeric value', 'latest'],
    ['a zero revision', '0'],
    ['a negative revision', '-1'],
    ['a fractional revision', '1.5'],
    ['a value beyond the safe integer range', '9007199254740993']
  ] as const)('reports nothing for %s', ([, value]) => {
    expect(readCapabilityRevision(() => value)).toBeUndefined()
  })
})
