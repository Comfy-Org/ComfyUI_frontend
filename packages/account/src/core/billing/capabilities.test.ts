import { describe, expect, it, vi } from 'vitest'

import type { SessionClient, SessionSnapshot } from '../session.js'
import type { AccountCredential } from '../sessionContracts.js'
import type {
  BillingHttpResponse,
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import {
  CAPABILITY_REVISION_HEADER,
  createCapabilitiesReader,
  readCapabilityRevision
} from './capabilities.js'
import { createSessionBillingTransport } from './transport.js'

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

/**
 * The two members a reader is allowed to reach for. Anything else is left
 * undefined at runtime rather than quietly answered, so reaching past them
 * fails the test that does it.
 */
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

function httpOk(
  body: unknown,
  headers: Record<string, string> = {}
): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: {
      httpStatus: 200,
      body,
      header: (name) => headers[name] ?? null
    }
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

/** A transport that answers each call from the queue, then repeats the last. */
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

describe('createCapabilitiesReader', () => {
  it('decodes the server answer and reports the resolved scope', async () => {
    const { session } = fakeSession()
    const { transport } = fakeTransport([httpOk(capabilitiesBody())])
    const reader = createCapabilitiesReader({ transport, session })

    const result = await reader.read()

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.value.capabilities.can_top_up).toBe(true)
    expect(result.value.revision).toBe(42)
    expect(result.value.scope).toEqual({ userId: 'uid-1', workspaceId: 'ws-1' })
    expect(result.value.rolloutDefaultsApplied.can_top_up).toBe(true)
  })

  it('asks the capabilities route with production\u2019s 10s budget', async () => {
    const { session } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(capabilitiesBody())])

    await createCapabilitiesReader({ transport, session }).read()

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].route).toBe('/billing/capabilities')
    expect(calls[0].timeoutMs).toBe(10_000)
  })

  describe('deduplication', () => {
    it('serves concurrent readers of one scope from a single request', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({ transport, session })

      const [first, second, third] = await Promise.all([
        reader.read(),
        reader.read(),
        reader.read()
      ])

      expect(transport).toHaveBeenCalledTimes(1)
      expect(first).toEqual(second)
      expect(second).toEqual(third)
    })

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
        session: host.session
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
      const { session } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({ transport, session })

      await reader.read()
      await reader.read()

      expect(transport).toHaveBeenCalledTimes(1)
    })

    it('refetches when the caller forces a refresh', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({ transport, session })

      await reader.read()
      await reader.read({ forceRefresh: true })

      expect(transport).toHaveBeenCalledTimes(2)
    })
  })

  describe('freshness', () => {
    it('refetches once the server-declared lifetime has passed', async () => {
      const { session } = fakeSession()
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
        session,
        now: () => clock
      })

      await reader.read()
      clock += 31_000
      await reader.read()

      expect(transport).toHaveBeenCalledTimes(2)
    })

    it('falls back to a fixed lifetime when the clock disagrees with the server', async () => {
      const { session } = fakeSession()
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
        session,
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
      const { session } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(capabilitiesBody({ expires_at: 'not-a-timestamp' }))
      ])
      const clock = Date.now()
      const reader = createCapabilitiesReader({
        transport,
        session,
        now: () => clock
      })

      const result = await reader.read()

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.value.freshUntil).toBe(clock + 60_000)
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
        return httpOk(capabilitiesBody())
      })
      const reader = createCapabilitiesReader({
        transport,
        session: host.session
      })

      const pending = reader.read()
      host.moveTo(
        authenticated(
          credential({ workspace: { id: 'ws-2', name: 'Team', type: 'team' } })
        )
      )
      release()
      const result = await pending

      expect(result).toEqual({ status: 'error', code: 'SUPERSEDED' })
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
        return httpOk(capabilitiesBody())
      })
      const reader = createCapabilitiesReader({
        transport,
        session: host.session
      })

      const pending = reader.read()
      host.moveTo(SIGNED_OUT)
      release()

      expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
      expect(reader.getSnapshot()).toBeUndefined()
    })

    it('drops a cached snapshot when the host changes workspace', async () => {
      const host = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({
        transport,
        session: host.session
      })

      await reader.read()
      expect(reader.getSnapshot()).toBeDefined()

      host.moveTo(
        authenticated(
          credential({ workspace: { id: 'ws-2', name: 'Team', type: 'team' } })
        )
      )

      expect(reader.getSnapshot()).toBeUndefined()
    })

    it('refuses an answer the server resolved for another workspace', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(
          capabilitiesBody({
            resolved_for: { user_id: 'uid-1', workspace_id: 'ws-other' }
          })
        )
      ])
      const reader = createCapabilitiesReader({ transport, session })

      const result = await reader.read()

      expect(result).toEqual({
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 200
      })
      expect(reader.getSnapshot()).toBeUndefined()
    })

    it('reports NOT_AUTHENTICATED without asking when nobody is signed in', async () => {
      const { session } = fakeSession(SIGNED_OUT)
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])

      const result = await createCapabilitiesReader({
        transport,
        session
      }).read()

      expect(result).toEqual({ status: 'error', code: 'NOT_AUTHENTICATED' })
      expect(transport).not.toHaveBeenCalled()
    })
  })

  describe('failures', () => {
    it.for([
      [401, 'ACCESS_DENIED'],
      [403, 'ACCESS_DENIED'],
      [404, 'NOT_FOUND'],
      [409, 'CONFLICT'],
      [500, 'REQUEST_FAILED'],
      [503, 'REQUEST_FAILED']
    ] as const)('maps %i to %s', async ([status, code]) => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([httpStatus(status)])

      const result = await createCapabilitiesReader({
        transport,
        session
      }).read()

      expect(result).toEqual({ status: 'error', code, httpStatus: status })
    })

    it('reports a 2xx body that does not match the contract as malformed', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([
        httpOk({ capabilities: { can_top_up: 'yes' } })
      ])
      const reader = createCapabilitiesReader({ transport, session })

      const result = await reader.read()

      expect(result).toEqual({
        status: 'error',
        code: 'MALFORMED_RESPONSE',
        httpStatus: 200
      })
      expect(reader.getSnapshot()).toBeUndefined()
    })

    it('passes a transport failure through without inventing a status', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([
        { status: 'error', code: 'REQUEST_FAILED' }
      ])

      const result = await createCapabilitiesReader({
        transport,
        session
      }).read()

      expect(result).toEqual({ status: 'error', code: 'REQUEST_FAILED' })
    })
  })

  describe('denial reasons', () => {
    it('decodes a reason the server named', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(
          capabilitiesBody({
            denied_reasons: { can_subscribe_self_serve: 'not_workspace_owner' }
          })
        )
      ])

      const result = await createCapabilitiesReader({
        transport,
        session
      }).read()

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.value.denials['can_subscribe_self_serve']).toBe(
        'not_workspace_owner'
      )
    })

    it('falls back to the generic reason for a value it does not recognize', async () => {
      const { session } = fakeSession()
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
        session
      }).read()

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.value.denials['can_subscribe_self_serve']).toBe(
        'unspecified'
      )
    })

    it('keeps the capability set usable when a reason is unrecognized', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([
        httpOk(
          capabilitiesBody({
            denied_reasons: { can_top_up: 'something_new' }
          })
        )
      ])

      const result = await createCapabilitiesReader({
        transport,
        session
      }).read()

      // The point of the lenient decode: a reason this client predates must
      // not cost the caller the capability set that gates its UI.
      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.value.capabilities.can_top_up).toBe(true)
    })

    it('reads an absent denials object as no reasons, not as a granted capability', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])

      const result = await createCapabilitiesReader({
        transport,
        session
      }).read()

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.value.denials).toEqual({})
      expect(result.value.capabilities.can_subscribe_self_serve).toBe(false)
    })
  })

  describe('revision invalidation', () => {
    it('refetches after a mutation reports a different revision', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({ transport, session })

      await reader.read()
      reader.invalidate(43)
      await reader.read()

      expect(transport).toHaveBeenCalledTimes(2)
    })

    it('ignores a revision the cached snapshot already carries', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({ transport, session })

      await reader.read()
      // The read echoes its own revision on the response header. Treating that
      // as an invalidation would mark the read stale and refetch forever.
      reader.invalidate(42)
      await reader.read()

      expect(transport).toHaveBeenCalledTimes(1)
    })

    it('refetches after an unqualified invalidation', async () => {
      const { session } = fakeSession()
      const { transport } = fakeTransport([httpOk(capabilitiesBody())])
      const reader = createCapabilitiesReader({ transport, session })

      await reader.read()
      reader.invalidate()
      await reader.read()

      expect(transport).toHaveBeenCalledTimes(2)
    })

    it('publishes a read invalidated in flight as already stale', async () => {
      const { session } = fakeSession()
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
      const reader = createCapabilitiesReader({ transport, session })

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

  it('stops tracking the host after dispose', async () => {
    const host = fakeSession()
    const { transport } = fakeTransport([httpOk(capabilitiesBody())])
    const reader = createCapabilitiesReader({
      transport,
      session: host.session
    })

    await reader.read()
    reader.dispose()
    host.moveTo(SIGNED_OUT)

    // Dispose detaches the subscription, so the stale snapshot survives. A
    // disposed reader is out of use; what matters is that nothing throws.
    expect(reader.getSnapshot()).toBeDefined()
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
    const fake: Pick<
      SessionClient,
      'ensureFresh' | 'remint' | 'getSnapshot' | 'subscribe'
    > = {
      ensureFresh: vi.fn(next),
      remint: vi.fn(next),
      getSnapshot: () => snapshot,
      subscribe: () => () => {}
    }
    return { session: fake as SessionClient, remint: fake.remint }
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
      reader: createCapabilitiesReader({ transport, session }),
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
