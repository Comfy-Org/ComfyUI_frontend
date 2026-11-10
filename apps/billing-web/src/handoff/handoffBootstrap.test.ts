import { runHandoffBootstrap } from '@/handoff/handoffBootstrap'
import type { HandoffBootEnv } from '@/handoff/handoffBootstrap'
import type { HandoffState, TabStorage } from '@/handoff/handoffTab'
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

function setup(
  url: string,
  {
    storage = memoryStorage(),
    respond = () => json(200, exchanged),
    stripWorks = true
  }: {
    storage?: TabStorage
    respond?: () => Response | Promise<Response>
    stripWorks?: boolean
  } = {}
) {
  const location = new URL(url, 'https://testbilling.comfy.org')
  let hash = location.hash
  const fetchImpl = vi.fn<typeof fetch>(async () => respond())
  const replaceUrl = vi.fn((next: string) => {
    if (stripWorks) hash = new URL(next, location).hash
  })
  const env: HandoffBootEnv = {
    pathname: location.pathname,
    search: location.search,
    hash: () => hash,
    replaceUrl,
    storage,
    fetchImpl,
    cloudBaseUrl: CLOUD,
    now: () => NOW
  }
  return { env, fetchImpl, replaceUrl, storage }
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

  it('strips the token from the URL, then exchanges it once without cookies', async () => {
    const { env, fetchImpl, replaceUrl } = setup('/handoff#token=tok-1')

    await expect(runHandoffBootstrap(env)).resolves.toBe('handoff')

    expect(replaceUrl).toHaveBeenCalledWith('/handoff')
    expect(replaceUrl.mock.invocationCallOrder[0]).toBeLessThan(
      fetchImpl.mock.invocationCallOrder[0]
    )
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${CLOUD}/api/auth/handoffs/exchange`)
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit' })
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'tok-1' })
    expect(handoffTab.value).toEqual(liveSession)
  })

  it('keeps the session for a reload and never stores the handoff token', async () => {
    const storage = memoryStorage()
    const { env } = setup('/handoff#token=tok-1', { storage })

    await runHandoffBootstrap(env)

    expect(readHandoffState(storage)).toEqual(liveSession)
    expect([...storage.items.values()].join()).not.toContain('tok-1')
  })

  it('stops startup when the token cannot be removed from the URL', async () => {
    const { env, fetchImpl } = setup('/handoff#token=tok-1', {
      stripWorks: false
    })

    await expect(runHandoffBootstrap(env)).resolves.toBe('halt')

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(handoffTab.value).toBeUndefined()
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

  it('ends a stored session that expired before the reload', async () => {
    const storage = memoryStorage()
    storage.setItem(
      'comfy.billing-web.handoff.v1',
      JSON.stringify({
        kind: 'session',
        exchange: { ...exchanged, expires_at: '2026-11-09T11:59:59Z' }
      })
    )
    const { env } = setup('/handoff', { storage })

    await runHandoffBootstrap(env)

    expect(handoffTab.value).toEqual({ kind: 'ended', ending: 'session_ended' })
  })

  it('keeps a terminal state across a reload', async () => {
    const storage = memoryStorage()
    storage.setItem(
      'comfy.billing-web.handoff.v1',
      JSON.stringify({ kind: 'ended', ending: 'link_unavailable' })
    )
    const { env } = setup('/handoff', { storage })

    await runHandoffBootstrap(env)

    expect(handoffTab.value).toEqual({
      kind: 'ended',
      ending: 'link_unavailable'
    })
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
})
