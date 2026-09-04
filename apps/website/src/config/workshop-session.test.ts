// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopSession, WorkshopSessionUser } from './workshop-session'
import {
  clearWorkshopSession,
  ensureFreshWorkshopSession,
  isWorkshopSessionFresh,
  readCachedWorkshopSession,
  remintWorkshopSession
} from './workshop-session'

const STORAGE_KEY = 'comfy.workshop.session.v1'

const user: WorkshopSessionUser = {
  uid: 'user-1',
  getIdToken: async () => 'firebase-id-token'
}

const mintBody = (overrides: Record<string, unknown> = {}) => ({
  token: 'workspace-jwt',
  expires_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
  workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  ...overrides
})

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const cachedSession = (overrides: Partial<WorkshopSession> = {}) => {
  const session: WorkshopSession = {
    token: 'cached-jwt',
    expiresAt: Date.now() + 60 * 60 * 1000,
    uid: 'user-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    ...overrides
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  return session
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('ensureFreshWorkshopSession', () => {
  it('mints, caches, and returns the session on the happy path', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, mintBody()))

    const result = await ensureFreshWorkshopSession(user, { fetchImpl })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.session.token).toBe('workspace-jwt')
    expect(result.session.workspace.type).toBe('personal')
    expect(readCachedWorkshopSession('user-1')?.token).toBe('workspace-jwt')

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ]
    expect(url).toContain('/api/auth/token')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer firebase-id-token'
    )
    expect(init.body).toBe('{}')
  })

  it('returns a fresh cached session without any network call', async () => {
    const cached = cachedSession()
    const fetchImpl = vi.fn()

    const result = await ensureFreshWorkshopSession(user, { fetchImpl })

    expect(result).toEqual({ status: 'ok', session: cached })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.for([
    ['expiring within the margin', 4 * 60 * 1000],
    ['already expired', -1000]
  ] as const)('re-mints a session %s', async ([, remaining]) => {
    cachedSession({ expiresAt: Date.now() + remaining })
    const fetchImpl = vi.fn(async () => jsonResponse(200, mintBody()))

    const result = await ensureFreshWorkshopSession(user, { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(result.status === 'ok' && result.session.token).toBe('workspace-jwt')
  })

  it('never serves a cached session minted for a different user', async () => {
    cachedSession({ uid: 'someone-else' })
    const fetchImpl = vi.fn(async () => jsonResponse(200, mintBody()))

    const result = await ensureFreshWorkshopSession(user, { fetchImpl })

    expect(
      fetchImpl,
      'a cross-user token reuse is the INV-6 breach'
    ).toHaveBeenCalledOnce()
    expect(result.status === 'ok' && result.session.uid).toBe('user-1')
  })

  it('treats corrupt cache JSON as no cache', async () => {
    sessionStorage.setItem(STORAGE_KEY, '{not json')
    const fetchImpl = vi.fn(async () => jsonResponse(200, mintBody()))

    await ensureFreshWorkshopSession(user, { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it.for([
    ['a 401', async () => jsonResponse(401, {}), 'http', 401],
    ['a 5xx', async () => jsonResponse(503, {}), 'http', 503],
    [
      'a network throw',
      async () => {
        throw new TypeError('failed to fetch')
      },
      'network',
      undefined
    ],
    [
      'a non-JSON body',
      async () => new Response('<html>', { status: 200 }),
      'malformed',
      undefined
    ],
    [
      'an unparseable expires_at',
      async () => jsonResponse(200, mintBody({ expires_at: 'soon' })),
      'malformed',
      undefined
    ],
    [
      'a missing token',
      async () => jsonResponse(200, mintBody({ token: undefined })),
      'malformed',
      undefined
    ]
  ] as const)(
    'surfaces %s as a typed error and caches nothing',
    async ([, fetchImpl, reason, httpStatus]) => {
      const result = await ensureFreshWorkshopSession(user, {
        fetchImpl: vi.fn(fetchImpl)
      })

      expect(result.status).toBe('error')
      if (result.status !== 'error') return
      expect(result.reason).toBe(reason)
      expect(result.httpStatus).toBe(httpStatus)
      expect(readCachedWorkshopSession('user-1')).toBeUndefined()
    }
  )

  it('shares one in-flight mint between concurrent callers', async () => {
    let release!: (response: Response) => void
    const fetchImpl = vi.fn(
      () => new Promise<Response>((resolve) => (release = resolve))
    )

    const first = ensureFreshWorkshopSession(user, { fetchImpl })
    const second = ensureFreshWorkshopSession(user, { fetchImpl })
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled())
    release(jsonResponse(200, mintBody()))
    const [a, b] = await Promise.all([first, second])

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(a).toEqual(b)
  })

  it('never shares an in-flight mint across different users', async () => {
    const other = { uid: 'user-2', getIdToken: async () => 'other-token' }
    let releaseFirst!: (response: Response) => void
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (releaseFirst = resolve))
      )
      .mockImplementationOnce(async () =>
        jsonResponse(200, mintBody({ token: 'user-2-jwt' }))
      )

    const first = ensureFreshWorkshopSession(user, { fetchImpl })
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce())
    const second = ensureFreshWorkshopSession(other, { fetchImpl })
    releaseFirst(jsonResponse(200, mintBody()))
    const [, b] = await Promise.all([first, second])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(
      b.status === 'ok' && b.session.uid,
      'a second user must get their own mint, never the first user’s token'
    ).toBe('user-2')
  })

  it('resolves an expired-cache read with the NEW token when the mint lands after the call', async () => {
    cachedSession({ expiresAt: Date.now() - 1000, token: 'expired-jwt' })
    let release!: (response: Response) => void
    const fetchImpl = vi.fn(
      () => new Promise<Response>((resolve) => (release = resolve))
    )

    const pending = ensureFreshWorkshopSession(user, { fetchImpl })
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled())
    release(jsonResponse(200, mintBody()))
    const result = await pending

    expect(
      result.status === 'ok' && result.session.token,
      'the run path must carry the minted token, never the expired one (ADR 0011)'
    ).toBe('workspace-jwt')
  })
})

describe('remintWorkshopSession', () => {
  it('ignores a fresh cache and mints anew', async () => {
    cachedSession()
    const fetchImpl = vi.fn(async () => jsonResponse(200, mintBody()))

    const result = await remintWorkshopSession(user, { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(result.status === 'ok' && result.session.token).toBe('workspace-jwt')
  })

  it('does not ride a non-forced mint already in flight for the same user', async () => {
    let releaseFirst!: (response: Response) => void
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (releaseFirst = resolve))
      )
      .mockImplementationOnce(async () =>
        jsonResponse(200, mintBody({ token: 'forced-jwt' }))
      )

    const ensure = ensureFreshWorkshopSession(user, { fetchImpl })
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce())
    const forced = remintWorkshopSession(user, { fetchImpl })
    releaseFirst(jsonResponse(200, mintBody({ token: 'stale-jwt' })))

    const forcedResult = await forced
    await ensure
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(forcedResult.status === 'ok' && forcedResult.session.token).toBe(
      'forced-jwt'
    )
  })
})

describe('clearWorkshopSession', () => {
  it('drops the cache', () => {
    cachedSession()
    clearWorkshopSession()
    expect(readCachedWorkshopSession('user-1')).toBeUndefined()
  })
})

describe('isWorkshopSessionFresh', () => {
  it('is exactly the five-minute margin', () => {
    const session = cachedSession({ expiresAt: 1_000_000 })
    expect(isWorkshopSessionFresh(session, 1_000_000 - 5 * 60 * 1000)).toBe(
      false
    )
    expect(isWorkshopSessionFresh(session, 1_000_000 - 5 * 60 * 1000 - 1)).toBe(
      true
    )
  })
})
