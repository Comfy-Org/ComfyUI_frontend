import { captureHandoffToken } from '@/handoff/captureHandoffToken'
import { runHandoffBootstrap } from '@/handoff/handoffBootstrap'
import type { HandoffBootEnv } from '@/handoff/handoffBootstrap'
import type { HandoffState, TabMarker, TabStorage } from '@/handoff/handoffTab'
import { handoffTab, readHandoffState } from '@/handoff/handoffTab'

const CLOUD = 'https://testcloud.comfy.org'
const NOW = Date.parse('2026-11-09T12:00:00Z')

const exchanged = {
  session_token: 'comfy-scoped-session-1',
  expires_at: '2026-11-09T12:30:00Z',
  user: { id: 'user-1', email: 'a@example.com' },
  workspace: { id: 'ws-1', name: 'Studio', type: 'team' },
  role: 'owner'
}

const liveSession: HandoffState = {
  kind: 'session',
  session: {
    token: 'comfy-scoped-session-1',
    expiresAt: Date.parse('2026-11-09T12:30:00Z'),
    userId: 'user-1',
    email: 'a@example.com',
    workspace: { id: 'ws-1', name: 'Studio', type: 'team' },
    role: 'owner'
  }
}

function memoryStorage(): TabStorage & { items: Map<string, string> } {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key)
  }
}

const blockedStorage: TabStorage = {
  getItem: () => {
    throw new DOMException('blocked', 'SecurityError')
  },
  setItem: () => {
    throw new DOMException('blocked', 'SecurityError')
  },
  removeItem: () => {
    throw new DOMException('blocked', 'SecurityError')
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function memoryMarker(): TabMarker {
  let value = ''
  return {
    read: () => value,
    write: (next) => {
      value = next
    }
  }
}

function setup(
  url: string,
  {
    storage = memoryStorage(),
    marker = memoryMarker(),
    respond = () => json(200, exchanged),
    exchangeTimeoutMs = 10_000
  }: {
    storage?: TabStorage
    marker?: TabMarker
    respond?: (init?: RequestInit) => Response | Promise<Response>
    exchangeTimeoutMs?: number
  } = {}
) {
  const location = new URL(url, 'https://testbilling.comfy.org')
  let hash = location.hash
  const capture = captureHandoffToken({
    pathname: location.pathname,
    search: location.search,
    hash: () => hash,
    replaceUrl: () => {
      hash = ''
    },
    markExchangePending: () => {}
  })
  if (capture.kind !== 'captured') throw new Error('capture halted')
  const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => respond(init))
  const env: HandoffBootEnv = {
    capture,
    storage,
    marker,
    fetchImpl,
    cloudBaseUrl: CLOUD,
    now: () => NOW,
    exchangeTimeoutMs
  }
  return { env, fetchImpl, storage }
}

beforeEach(() => {
  handoffTab.value = undefined
})

describe('runHandoffBootstrap', () => {
  it('leaves a tab that never held a handoff to its own sign-in', async () => {
    const { env, fetchImpl } = setup('/v1/subscription')

    await expect(runHandoffBootstrap(env)).resolves.toBe('not-handoff')

    expect(handoffTab.value).toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('exchanges the captured token once, without cookies', async () => {
    const { env, fetchImpl } = setup('/handoff#token=tok-1')

    await expect(runHandoffBootstrap(env)).resolves.toBe('handoff')

    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${CLOUD}/api/auth/handoffs/exchange`)
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit' })
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'tok-1' })
    expect(handoffTab.value).toEqual(liveSession)
  })

  it('accepts the handoff route with a trailing slash', async () => {
    const { env, fetchImpl } = setup('/handoff/#token=tok-1')

    await runHandoffBootstrap(env)

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(handoffTab.value).toEqual(liveSession)
  })

  it('keeps the session for a reload and never stores the handoff token', async () => {
    const storage = memoryStorage()
    const { env } = setup('/handoff#token=tok-1', { storage })

    await runHandoffBootstrap(env)

    expect(readHandoffState(storage)).toEqual(liveSession)
    expect([...storage.items.values()].join()).not.toContain('tok-1')
  })

  it.for([
    {
      name: 'a spent or expired link (410)',
      status: 410,
      ending: 'link_unavailable'
    },
    { name: 'a refused issuance (403)', status: 403, ending: 'refused' },
    { name: 'a server error', status: 503, ending: 'exchange_lost' }
  ])('ends on $name without retrying', async ({ status, ending }) => {
    const { env, fetchImpl } = setup('/handoff#token=tok-1', {
      respond: () => json(status, { code: 'X' })
    })

    await runHandoffBootstrap(env)

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(handoffTab.value).toEqual({ kind: 'ended', ending })
  })

  it.for([
    {
      name: 'a lost response',
      respond: () => Promise.reject(new TypeError('offline'))
    },
    {
      name: 'an unreadable body',
      respond: () => json(200, { session_token: 'x' })
    }
  ])('treats $name as a spent token', async ({ respond }) => {
    const { env, fetchImpl } = setup('/handoff#token=tok-1', { respond })

    await runHandoffBootstrap(env)

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(handoffTab.value).toEqual({ kind: 'ended', ending: 'exchange_lost' })
  })

  it('ends a hung exchange as a spent token once the request times out', async () => {
    const { env } = setup('/handoff#token=tok-1', {
      exchangeTimeoutMs: 5,
      respond: (init) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason)
          )
        )
    })

    await runHandoffBootstrap(env)

    expect(handoffTab.value).toEqual({ kind: 'ended', ending: 'exchange_lost' })
  })

  it.for(['owner', 'member'] as const)(
    'signs the tab in with the %s role the exchange reports',
    async (role) => {
      const { env } = setup('/handoff#token=tok-1', {
        respond: () => json(200, { ...exchanged, role })
      })

      await runHandoffBootstrap(env)

      expect(handoffTab.value).toMatchObject({
        kind: 'session',
        session: { role }
      })
    }
  )

  it('ends instead of keeping the session only in memory when storing it fails', async () => {
    const storage = memoryStorage()
    const realSet = storage.setItem
    const { env } = setup('/handoff#token=tok-1', { storage })
    let writes = 0
    storage.setItem = (key, value) => {
      writes += 1
      if (value.includes('comfy-scoped-session-1'))
        throw new DOMException('full', 'QuotaExceededError')
      realSet(key, value)
    }

    await runHandoffBootstrap(env)

    expect(writes).toBeGreaterThan(0)
    expect(handoffTab.value).toEqual({
      kind: 'ended',
      ending: 'storage_unavailable'
    })
    expect(readHandoffState(storage)).toEqual({
      kind: 'ended',
      ending: 'storage_unavailable'
    })
  })

  it('replaces an earlier session before exchanging, so a reload mid-exchange cannot bring it back', async () => {
    const storage = memoryStorage()
    storage.setItem(
      'comfy.billing-web.handoff.v1',
      JSON.stringify({ kind: 'session', exchange: exchanged })
    )
    let storedDuringExchange: unknown
    const { env } = setup('/handoff#token=tok-2', {
      storage,
      respond: () => {
        storedDuringExchange = readHandoffState(storage)
        return Promise.reject(new TypeError('reloaded'))
      }
    })

    await runHandoffBootstrap(env)

    expect(storedDuringExchange).toEqual({
      kind: 'ended',
      ending: 'exchange_lost'
    })
  })

  it('does not spend the token when the tab cannot keep a session', async () => {
    const { env, fetchImpl } = setup('/handoff#token=tok-1', {
      storage: blockedStorage
    })

    await expect(runHandoffBootstrap(env)).resolves.toBe('handoff')

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(handoffTab.value).toEqual({
      kind: 'ended',
      ending: 'storage_unavailable'
    })
  })

  it.for([
    { name: '/handoff', path: '/handoff' },
    { name: 'a return page', path: '/return/topup' }
  ])(
    'restores the stored session on $name after a reload, without exchanging',
    async ({ path }) => {
      const storage = memoryStorage()
      storage.setItem(
        'comfy.billing-web.handoff.v1',
        JSON.stringify({ kind: 'session', exchange: exchanged })
      )
      const { env, fetchImpl } = setup(path, { storage })

      await expect(runHandoffBootstrap(env)).resolves.toBe('handoff')

      expect(fetchImpl).not.toHaveBeenCalled()
      expect(handoffTab.value).toEqual(liveSession)
    }
  )

  it('restores a session that sent a payment request as one that still may have charged', async () => {
    const storage = memoryStorage()
    storage.setItem(
      'comfy.billing-web.handoff.v1',
      JSON.stringify({
        kind: 'session',
        exchange: exchanged,
        chargeAttempted: true
      })
    )

    await runHandoffBootstrap(setup('/return/topup', { storage }).env)

    expect(handoffTab.value).toEqual({ ...liveSession, chargeAttempted: true })
    expect(readHandoffState(storage)).toEqual({
      ...liveSession,
      chargeAttempted: true
    })
  })

  it.for([
    {
      name: 'that sent nothing that can charge as a link that no longer works',
      stored: {},
      ending: 'link_unavailable'
    },
    {
      name: 'that sent a payment request as an unconfirmed payment',
      stored: { chargeAttempted: true },
      ending: 'unconfirmed'
    }
  ])(
    'ends a stored session $name when it expired before the reload',
    async ({ stored, ending }) => {
      const storage = memoryStorage()
      storage.setItem(
        'comfy.billing-web.handoff.v1',
        JSON.stringify({
          kind: 'session',
          exchange: { ...exchanged, expires_at: '2026-11-09T11:59:59Z' },
          ...stored
        })
      )
      const { env } = setup('/handoff', { storage })

      await runHandoffBootstrap(env)

      expect(handoffTab.value).toEqual({ kind: 'ended', ending })
    }
  )

  it('restores an expired session with a payment still settling as checking that payment', async () => {
    const storage = memoryStorage()
    storage.setItem(
      'comfy.billing-web.handoff.v1',
      JSON.stringify({
        kind: 'session',
        exchange: { ...exchanged, expires_at: '2026-11-09T11:59:59Z' }
      })
    )
    storage.setItem(
      'comfy:billing:operation:user-1:ws-1',
      JSON.stringify({
        operationId: 'op-7',
        kind: 'subscription',
        presentation: 'hosted',
        attemptStartedAt: NOW - 40 * 60_000,
        awaited: true
      })
    )
    const ended = {
      kind: 'ended',
      ending: 'payment_pending',
      reference: 'op-7'
    }

    await runHandoffBootstrap(setup('/return/topup', { storage }).env)
    expect(handoffTab.value).toEqual(ended)

    await runHandoffBootstrap(setup('/handoff', { storage }).env)
    expect(handoffTab.value).toEqual(ended)
  })

  it('restores an expired session whose payment succeeded as completed, with its workspace and reference', async () => {
    const storage = memoryStorage()
    storage.setItem(
      'comfy.billing-web.handoff.v1',
      JSON.stringify({
        kind: 'session',
        exchange: { ...exchanged, expires_at: '2026-11-09T11:59:59Z' },
        chargeAttempted: true
      })
    )
    storage.setItem(
      'comfy:billing:operation:user-1:ws-1',
      JSON.stringify({
        operationId: 'op-7',
        kind: 'topup',
        presentation: 'embedded',
        attemptStartedAt: NOW - 40 * 60_000,
        settled: 'succeeded'
      })
    )
    const ended = {
      kind: 'ended',
      ending: 'completed',
      workspace: 'Studio',
      reference: 'op-7'
    }

    await runHandoffBootstrap(setup('/return/topup', { storage }).env)
    expect(handoffTab.value).toEqual(ended)

    await runHandoffBootstrap(setup('/handoff', { storage }).env)
    expect(handoffTab.value).toEqual(ended)
  })

  it.for<{ name: string; stored: object; restored: HandoffState }>([
    {
      name: 'a link that no longer works',
      stored: { ending: 'link_unavailable' },
      restored: { kind: 'ended', ending: 'link_unavailable' }
    },
    {
      name: "an older build's session end as unconfirmed",
      stored: { ending: 'session_ended' },
      restored: { kind: 'ended', ending: 'unconfirmed' }
    },
    {
      name: 'a completed payment that lost its workspace as unconfirmed',
      stored: { ending: 'completed', reference: 'op-7' },
      restored: { kind: 'ended', ending: 'unconfirmed' }
    }
  ])('keeps $name across a reload', async ({ stored, restored }) => {
    const storage = memoryStorage()
    storage.setItem(
      'comfy.billing-web.handoff.v1',
      JSON.stringify({ kind: 'ended', ...stored })
    )
    const { env } = setup('/handoff', { storage })

    await runHandoffBootstrap(env)

    expect(handoffTab.value).toEqual(restored)
  })

  it('treats /handoff with no token and nothing stored as a broken link', async () => {
    const { env, fetchImpl } = setup('/handoff')

    await runHandoffBootstrap(env)

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(handoffTab.value).toEqual({
      kind: 'ended',
      ending: 'link_unavailable'
    })
  })

  it('ends a live handoff whose storage became unreadable as unconfirmed, which never says nothing was charged', async () => {
    const marker = memoryMarker()
    await runHandoffBootstrap(setup('/handoff#token=tok-1', { marker }).env)

    const reload = setup('/', { storage: blockedStorage, marker })

    await expect(runHandoffBootstrap(reload.env)).resolves.toBe('handoff')
    expect(handoffTab.value).toEqual({ kind: 'ended', ending: 'unconfirmed' })
  })

  it('keeps the storage ending across a reload when storage was blocked from the start', async () => {
    const marker = memoryMarker()
    await runHandoffBootstrap(
      setup('/handoff#token=tok-1', { storage: blockedStorage, marker }).env
    )

    await runHandoffBootstrap(
      setup('/handoff', { storage: blockedStorage, marker }).env
    )

    expect(handoffTab.value).toEqual({
      kind: 'ended',
      ending: 'storage_unavailable'
    })
  })

  it('ends a handoff tab whose stored session disappeared', async () => {
    const marker = memoryMarker()
    await runHandoffBootstrap(setup('/handoff#token=tok-1', { marker }).env)

    await expect(runHandoffBootstrap(setup('/', { marker }).env)).resolves.toBe(
      'handoff'
    )

    expect(handoffTab.value).toEqual({ kind: 'ended', ending: 'unconfirmed' })
  })

  it.for([
    { name: 'a completed payment', marked: 'completed' },
    { name: "an older build's session end", marked: 'session_ended' }
  ])(
    'ends a tab marked as $name whose storage is gone as unconfirmed',
    async ({ marked }) => {
      const marker = memoryMarker()
      marker.write(`comfy-billing-handoff:${marked}`)

      await runHandoffBootstrap(setup('/handoff', { marker }).env)

      expect(handoffTab.value).toEqual({ kind: 'ended', ending: 'unconfirmed' })
    }
  )

  it('leaves a normal tab with blocked storage to its own sign-in', async () => {
    const { env } = setup('/v1/subscription', { storage: blockedStorage })

    await expect(runHandoffBootstrap(env)).resolves.toBe('not-handoff')
  })
})
