import { describe, expect, it, vi } from 'vitest'

import type {
  AccountCredential,
  AccountUser,
  CredentialStorage,
  IdentityPort,
  SessionClientOptions,
  SessionErrorCode
} from './session.js'
import {
  SESSION_ERROR_MESSAGES,
  SESSION_SUCCESS_MESSAGES,
  createSessionClient,
  isCredentialFresh,
  isPermanentSessionError
} from './session.js'

const EXCHANGE_URL = 'https://cloud.test/api/auth/token'

function memoryStorage(): CredentialStorage & { raw: () => string | null } {
  let value: string | null = null
  return {
    read: () => value,
    write: (next) => {
      value = next
    },
    clear: () => {
      value = null
    },
    raw: () => value
  }
}

function makeClient(overrides: Partial<SessionClientOptions> = {}) {
  const storage = memoryStorage()
  const client = createSessionClient({
    exchangeUrl: EXCHANGE_URL,
    storage,
    ...overrides
  })
  return { client, storage }
}

function testUser(uid = 'uid-1', idToken = 'id-token-1'): AccountUser {
  return { uid, getIdToken: vi.fn(async () => idToken) }
}

function mintBody(overrides: Record<string, unknown> = {}) {
  return {
    token: 'workspace-jwt',
    permissions: ['workspace:read'],
    expires_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    ...overrides
  }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function okFetch(token = 'workspace-jwt') {
  return vi.fn<typeof fetch>(async () => jsonResponse(200, mintBody({ token })))
}

function seedCache(
  storage: CredentialStorage,
  overrides: Partial<AccountCredential> = {}
): AccountCredential {
  const credential: AccountCredential = {
    token: 'cached-jwt',
    permissions: ['workspace:read'],
    expiresAt: Date.now() + 60 * 60 * 1000,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    ...overrides
  }
  storage.write(JSON.stringify(credential))
  return credential
}

function manualIdentity() {
  let deliver: ((user: AccountUser | null) => void) | undefined
  const unsubscribe = vi.fn()
  const port: IdentityPort = {
    onUserChanged: (callback) => {
      deliver = callback
      return unsubscribe
    }
  }
  return {
    port,
    fire: (user: AccountUser | null) => deliver?.(user),
    unsubscribe
  }
}

function hangingFetch() {
  return vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        )
      })
  )
}

describe('ensureFresh', () => {
  it('mints, caches, and returns the session on the happy path', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, mintBody())
    )
    const { client, storage } = makeClient({ fetchImpl })

    const result = await client.ensureFresh(testUser(), {})

    expect(result?.status).toBe('ok')
    if (result?.status !== 'ok') return
    expect(result.session.token).toBe('workspace-jwt')
    expect(result.session.workspace.type).toBe('personal')
    expect(result.session.uid).toBe('uid-1')
    expect(storage.raw(), 'a successful mint must cache').not.toBeNull()

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(EXCHANGE_URL)
    const headers = new Headers(init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer id-token-1')
    expect(init?.body).toBe('{}')
    expect(init?.method).toBe('POST')
  })

  it('returns a fresh cached session without any network call', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const { client, storage } = makeClient({ fetchImpl })
    const cached = seedCache(storage)

    const result = await client.ensureFresh(testUser(), {})

    expect(result).toEqual({ status: 'ok', session: cached })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.for([
    ['expiring within the margin', 4 * 60 * 1000],
    ['already expired', -1000]
  ] as const)('re-mints a session %s', async ([, remaining]) => {
    const fetchImpl = okFetch()
    const { client, storage } = makeClient({ fetchImpl })
    seedCache(storage, { expiresAt: Date.now() + remaining })

    const result = await client.ensureFresh(testUser(), {})

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(result?.status === 'ok' && result.session.token).toBe(
      'workspace-jwt'
    )
  })

  it('never serves a cached session minted for a different user', async () => {
    const fetchImpl = okFetch()
    const { client, storage } = makeClient({ fetchImpl })
    seedCache(storage, { uid: 'someone-else' })

    const result = await client.ensureFresh(testUser(), {})

    expect(
      fetchImpl,
      'a cross-user token reuse is the INV-6 breach'
    ).toHaveBeenCalledOnce()
    expect(result?.status === 'ok' && result.session.uid).toBe('uid-1')
  })

  it('treats corrupt cache JSON as no cache', async () => {
    const fetchImpl = okFetch()
    const { client, storage } = makeClient({ fetchImpl })
    storage.write('{not json')

    await client.ensureFresh(testUser(), {})

    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it.for([
    ['a 401', 401, 'INVALID_FIREBASE_TOKEN', 401],
    ['a 403', 403, 'ACCESS_DENIED', 403],
    ['a 404', 404, 'WORKSPACE_NOT_FOUND', 404],
    ['a 5xx', 503, 'TOKEN_EXCHANGE_FAILED', 503]
  ] as const)(
    'maps %s to the production error code and caches nothing',
    async ([, status, code, httpStatus]) => {
      const { client, storage } = makeClient({
        fetchImpl: vi.fn<typeof fetch>(async () => jsonResponse(status, {}))
      })

      const result = await client.ensureFresh(testUser(), {})

      expect(result).toEqual({ status: 'error', code, httpStatus })
      expect(storage.raw()).toBeNull()
    }
  )

  it.for([
    [
      'a network throw',
      async () => {
        throw new TypeError('failed to fetch')
      },
      undefined
    ],
    [
      'a non-JSON body',
      async () => new Response('<html>', { status: 200 }),
      200
    ],
    [
      'an unparseable expires_at',
      async () => jsonResponse(200, mintBody({ expires_at: 'soon' })),
      200
    ],
    [
      'a missing token',
      async () => jsonResponse(200, mintBody({ token: undefined })),
      200
    ]
  ] as const)(
    'collapses %s into TOKEN_EXCHANGE_FAILED and caches nothing',
    async ([, respond, httpStatus]) => {
      const { client, storage } = makeClient({
        fetchImpl: vi.fn<typeof fetch>(respond)
      })

      const result = await client.ensureFresh(testUser(), {})

      expect(result?.status).toBe('error')
      if (result?.status !== 'error') return
      expect(result.code).toBe('TOKEN_EXCHANGE_FAILED')
      expect(result.httpStatus).toBe(httpStatus)
      expect(storage.raw()).toBeNull()
    }
  )

  it('shares one in-flight mint between concurrent callers', async () => {
    let release!: (response: Response) => void
    const fetchImpl = vi.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => (release = resolve))
    )
    const { client } = makeClient({ fetchImpl })
    const user = testUser()

    const first = client.ensureFresh(user, {})
    const second = client.ensureFresh(user, {})
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled())
    release(jsonResponse(200, mintBody()))
    const [a, b] = await Promise.all([first, second])

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(a).toEqual(b)
  })

  it('aborts a hung request at the configured timeout', async () => {
    const { client } = makeClient({ fetchImpl: hangingFetch() })

    const result = await client.ensureFresh(testUser(), { timeoutMs: 1 })

    expect(result).toEqual({ status: 'error', code: 'TOKEN_EXCHANGE_FAILED' })
  })

  it('aborts a response whose headers arrive but whose body stalls forever', async () => {
    const stalledBody = new ReadableStream<Uint8Array>({
      start: () => undefined
    })
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(stalledBody, {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
    )
    const { client, storage } = makeClient({ fetchImpl })

    const result = await client.ensureFresh(testUser(), { timeoutMs: 25 })

    expect(
      result,
      'clearing the timeout once headers arrive leaves the body read unbounded and the mint pending forever'
    ).toEqual({
      status: 'error',
      code: 'TOKEN_EXCHANGE_FAILED',
      httpStatus: 200
    })
    expect(storage.raw()).toBeNull()
  })

  it('also times out while Firebase is still resolving its ID token', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const { client } = makeClient({ fetchImpl })
    const slowUser: AccountUser = {
      uid: 'uid-1',
      getIdToken: () => new Promise<string>(() => {})
    }

    const result = await client.ensureFresh(slowUser, { timeoutMs: 1 })

    expect(result).toEqual({ status: 'error', code: 'TOKEN_EXCHANGE_FAILED' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('forwards caller cancellation to the request', async () => {
    const controller = new AbortController()
    const { client } = makeClient({ fetchImpl: hangingFetch() })

    const pending = client.ensureFresh(testUser(), {
      signal: controller.signal
    })
    controller.abort()

    await expect(pending).resolves.toEqual({
      status: 'error',
      code: 'TOKEN_EXCHANGE_FAILED'
    })
  })

  it('never shares an in-flight mint across different users', async () => {
    let releaseFirst!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (releaseFirst = resolve))
      )
      .mockImplementationOnce(async () =>
        jsonResponse(200, mintBody({ token: 'user-2-jwt' }))
      )
    const { client } = makeClient({ fetchImpl })

    const first = client.ensureFresh(testUser(), {})
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce())
    const second = client.ensureFresh(testUser('uid-2', 'id-token-2'), {})
    releaseFirst(jsonResponse(200, mintBody()))
    const [, b] = await Promise.all([first, second])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(
      b?.status === 'ok' && b.session.uid,
      'a second user must get their own mint, never the first user’s token'
    ).toBe('uid-2')
  })

  it('threads workspace_id into the mint body when a workspace is requested', async () => {
    const fetchImpl = okFetch()
    const { client } = makeClient({ fetchImpl })

    await client.ensureFresh(testUser(), { workspaceId: 'ws-9' })

    const [, init] = fetchImpl.mock.calls[0]
    expect(
      init?.body,
      'the workspace mint body must match requestToken: workspace_id or empty'
    ).toBe(JSON.stringify({ workspace_id: 'ws-9' }))
  })

  it('never serves a cached personal credential for an explicit workspace request', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        200,
        mintBody({ workspace: { id: 'ws-9', name: 'Team', type: 'team' } })
      )
    )
    const { client, storage } = makeClient({ fetchImpl })
    seedCache(storage)

    const result = await client.ensureFresh(testUser(), {
      workspaceId: 'ws-9'
    })

    expect(
      fetchImpl,
      'a personal credential authorizes the wrong workspace'
    ).toHaveBeenCalledOnce()
    expect(result?.status === 'ok' && result.session.workspace.id).toBe('ws-9')
  })

  it('serves a fresh cached credential for its own workspace without a network call', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const { client, storage } = makeClient({ fetchImpl })
    seedCache(storage, {
      workspace: { id: 'ws-9', name: 'Team', type: 'team' }
    })

    const result = await client.ensureFresh(testUser(), {
      workspaceId: 'ws-9'
    })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result?.status === 'ok' && result.session.workspace.id).toBe('ws-9')
  })

  it('never shares an in-flight mint across different workspace targets', async () => {
    let releaseFirst!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (releaseFirst = resolve))
      )
      .mockImplementationOnce(async () =>
        jsonResponse(
          200,
          mintBody({ workspace: { id: 'ws-9', name: 'Team', type: 'team' } })
        )
      )
    const { client } = makeClient({ fetchImpl })
    const user = testUser()

    const personal = client.ensureFresh(user, {})
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce())
    const team = client.ensureFresh(user, { workspaceId: 'ws-9' })
    releaseFirst(jsonResponse(200, mintBody()))
    const [, teamResult] = await Promise.all([personal, team])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(
      teamResult?.status === 'ok' && teamResult.session.workspace.id,
      'a workspace mint joining a personal mint would hand back the wrong scope'
    ).toBe('ws-9')
  })

  it('never lets a slower personal mint commit over a completed workspace switch', async () => {
    let releasePersonal!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (releasePersonal = resolve))
      )
      .mockImplementationOnce(async () =>
        jsonResponse(
          200,
          mintBody({
            token: 'team-jwt',
            workspace: { id: 'ws-9', name: 'Team', type: 'team' }
          })
        )
      )
    const { client } = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port, { autoMint: false })
    const user = testUser()
    identity.fire(user)

    const personal = client.ensureFresh(user, {})
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce())
    const team = await client.remint(user, { workspaceId: 'ws-9' })
    expect(team?.status === 'ok' && team.session.token).toBe('team-jwt')

    releasePersonal(jsonResponse(200, mintBody({ token: 'personal-jwt' })))
    const superseded = await personal

    expect(
      client.getToken(),
      'a slower personal mint resolving after a workspace switch must not silently revert it'
    ).toBe('team-jwt')
    expect(
      superseded,
      'a superseded mint resolves undefined, like one outlived by an identity change'
    ).toBeUndefined()
  })

  it('resolves an expired-cache read with the NEW token when the mint lands after the call', async () => {
    let release!: (response: Response) => void
    const fetchImpl = vi.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => (release = resolve))
    )
    const { client, storage } = makeClient({ fetchImpl })
    seedCache(storage, { expiresAt: Date.now() - 1000, token: 'expired-jwt' })

    const pending = client.ensureFresh(testUser(), {})
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled())
    release(jsonResponse(200, mintBody()))
    const result = await pending

    expect(
      result?.status === 'ok' && result.session.token,
      'the run path must carry the minted token, never the expired one (AUTH-CREDENTIALS-0011)'
    ).toBe('workspace-jwt')
  })
})

describe('remint', () => {
  it('ignores a fresh cache and mints anew', async () => {
    const fetchImpl = okFetch()
    const { client, storage } = makeClient({ fetchImpl })
    seedCache(storage)

    const result = await client.remint(testUser(), {})

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(result?.status === 'ok' && result.session.token).toBe(
      'workspace-jwt'
    )
  })

  it('does not ride a non-forced mint already in flight for the same user', async () => {
    let releaseFirst!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (releaseFirst = resolve))
      )
      .mockImplementationOnce(async () =>
        jsonResponse(200, mintBody({ token: 'forced-jwt' }))
      )
    const { client } = makeClient({ fetchImpl })
    const user = testUser()

    const ensure = client.ensureFresh(user, {})
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce())
    const forced = client.remint(user, {})
    releaseFirst(jsonResponse(200, mintBody({ token: 'stale-jwt' })))

    const forcedResult = await forced
    await ensure
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(forcedResult?.status === 'ok' && forcedResult.session.token).toBe(
      'forced-jwt'
    )
  })

  it('does not let an older mint clear a newer forced single-flight', async () => {
    let releaseFirst!: (response: Response) => void
    let releaseForced!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (releaseFirst = resolve))
      )
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (releaseForced = resolve))
      )
    const { client } = makeClient({ fetchImpl })
    const user = testUser()

    const first = client.ensureFresh(user, {})
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce())
    const forced = client.remint(user, {})
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))

    releaseFirst(jsonResponse(200, mintBody({ token: 'older-jwt' })))
    await first
    const joinedForced = client.remint(user, {})

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    releaseForced(jsonResponse(200, mintBody({ token: 'forced-jwt' })))
    expect(await joinedForced).toEqual(await forced)
  })
})

describe('clearCache', () => {
  it('drops the cache', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const { client, storage } = makeClient({ fetchImpl })
    seedCache(storage)

    client.clearCache()

    expect(storage.raw()).toBeNull()
  })
})

describe('isCredentialFresh', () => {
  it('is exactly the five-minute margin', () => {
    const session: AccountCredential = {
      token: 'cached-jwt',
      permissions: [],
      expiresAt: 1_000_000,
      uid: 'uid-1',
      workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
      role: 'owner'
    }
    expect(isCredentialFresh(session, 1_000_000 - 5 * 60 * 1000)).toBe(false)
    expect(isCredentialFresh(session, 1_000_000 - 5 * 60 * 1000 - 1)).toBe(true)
  })
})

describe('isPermanentSessionError', () => {
  it.for([
    ['NOT_AUTHENTICATED', true],
    ['INVALID_FIREBASE_TOKEN', true],
    ['ACCESS_DENIED', true],
    ['WORKSPACE_NOT_FOUND', true],
    ['TOKEN_EXCHANGE_FAILED', false]
  ] as const satisfies readonly (readonly [SessionErrorCode, boolean])[])(
    'classifies %s like the production store',
    ([code, permanent]) => {
      expect(isPermanentSessionError(code)).toBe(permanent)
    }
  )
})

describe('identity token failures', () => {
  it('maps a NOT_AUTHENTICATED-coded identity failure to the production code', async () => {
    const { client } = makeClient({ fetchImpl: vi.fn<typeof fetch>() })
    const user: AccountUser = {
      uid: 'uid-1',
      getIdToken: async () => {
        throw Object.assign(new Error('no identity'), {
          code: 'NOT_AUTHENTICATED'
        })
      }
    }

    const result = await client.ensureFresh(user, {})

    expect(result).toEqual({ status: 'error', code: 'NOT_AUTHENTICATED' })
  })

  it('keeps an uncoded identity failure in the transient bucket', async () => {
    const { client } = makeClient({ fetchImpl: vi.fn<typeof fetch>() })
    const user: AccountUser = {
      uid: 'uid-1',
      getIdToken: async () => {
        throw new Error('identity provider re-initializing')
      }
    }

    const result = await client.ensureFresh(user, {})

    expect(result).toEqual({ status: 'error', code: 'TOKEN_EXCHANGE_FAILED' })
  })
})

describe('attachIdentity without auto-mint', () => {
  it('sets the user and publishes, but leaves minting to the host', async () => {
    const fetchImpl = okFetch('host-driven-jwt')
    const { client } = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port, { autoMint: false })
    const user = testUser()

    identity.fire(user)
    expect(
      user.getIdToken,
      'a host that mints explicitly must not get a second mint per identity event'
    ).not.toHaveBeenCalled()
    expect(client.getSnapshot().phase).toBe('minting')

    const result = await client.ensureFresh(user, {})

    expect(result?.status).toBe('ok')
    expect(client.getSnapshot().phase).toBe('authenticated')
    expect(client.getToken()).toBe('host-driven-jwt')
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
})

describe('host-driven invalidation', () => {
  it('drops the credential and blocks in-flight commits while keeping the identity attached', async () => {
    let release!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => jsonResponse(200, mintBody()))
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (release = resolve))
      )
      .mockImplementationOnce(async () =>
        jsonResponse(200, mintBody({ token: 'post-invalidate-jwt' }))
      )
    const { client } = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    const user = testUser()

    identity.fire(user)
    await vi.waitFor(() => expect(client.getToken()).toBe('workspace-jwt'))
    const inFlight = client.remint(user, {})
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))
    client.invalidate()

    expect(
      client.getToken(),
      'a host failing closed must never serve the previous scope mid-switch'
    ).toBeUndefined()
    release(jsonResponse(200, mintBody({ token: 'stale-jwt' })))
    expect(await inFlight).toBeUndefined()
    expect(client.getToken()).toBeUndefined()

    const after = await client.remint(user, {})
    expect(
      after?.status === 'ok' && after.session.token,
      'the attachment survives invalidation, so a targeted re-mint commits normally'
    ).toBe('post-invalidate-jwt')
  })

  it('reads signed-out immediately after invalidation, not minting', async () => {
    const { client } = makeClient({ fetchImpl: okFetch() })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    identity.fire(testUser())
    await vi.waitFor(() => expect(client.getToken()).toBe('workspace-jwt'))

    client.invalidate()

    expect(
      client.getSnapshot().phase,
      "an invalidated client claiming 'minting' hands a signed-out host a stale identity until the port re-diffs"
    ).toBe('signed-out')
  })
})

describe('transient-failure credential preservation', () => {
  it('keeps a live credential when an opt-in remint fails transiently', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => jsonResponse(200, mintBody()))
      .mockImplementationOnce(async () => jsonResponse(503, {}))
      .mockImplementationOnce(async () => jsonResponse(401, {}))
    const { client } = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    const user = testUser()

    identity.fire(user)
    await vi.waitFor(() => expect(client.getToken()).toBe('workspace-jwt'))

    const transient = await client.remint(user, {
      preserveCredentialOnTransientFailure: true
    })
    expect(transient?.status).toBe('error')
    expect(
      client.getToken(),
      'a transient re-mint failure must not destroy a still-valid credential'
    ).toBe('workspace-jwt')

    const permanent = await client.remint(user, {
      preserveCredentialOnTransientFailure: true
    })
    expect(permanent?.status).toBe('error')
    expect(
      client.getToken(),
      'preservation is transient-only; a permanent failure still commits'
    ).toBeUndefined()
  })
})

describe('re-mint observability', () => {
  it('publishes a fresh authenticated snapshot on every re-mint', async () => {
    let minted = 0
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, mintBody({ token: `jwt-${(minted += 1)}` }))
    )
    const { client } = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    const seenTokens: string[] = []
    client.subscribe((snapshot) => {
      if (snapshot.phase === 'authenticated') {
        seenTokens.push(snapshot.session.token)
      }
    })

    identity.fire(testUser())
    await vi.waitFor(() => expect(client.getToken()).toBe('jwt-1'))
    await client.remint()

    expect(
      seenTokens,
      'a host hook rotating cookies on re-mint needs a guaranteed snapshot per new token'
    ).toEqual(['jwt-1', 'jwt-2'])
  })
})

describe('sign-in state ownership', () => {
  it('publishes an error phase when the initial mint fails', async () => {
    const { client } = makeClient({
      fetchImpl: vi.fn<typeof fetch>(async () => jsonResponse(503, {}))
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())

    await vi.waitFor(() => {
      expect(client.getSnapshot().phase).toBe('error')
    })
    const snapshot = client.getSnapshot()
    if (snapshot.phase !== 'error') throw new Error('unreachable')
    expect(snapshot.failure).toEqual({
      status: 'error',
      code: 'TOKEN_EXCHANGE_FAILED',
      httpStatus: 503
    })
  })

  it('clears the cache and publishes signed-out on sign-out', async () => {
    const { client, storage } = makeClient({ fetchImpl: okFetch() })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getSnapshot().phase).toBe('authenticated')
    })
    identity.fire(null)

    expect(client.getSnapshot().phase).toBe('signed-out')
    expect(storage.raw()).toBeNull()
  })

  it('discards a mint that lands after the signed-in user changed', async () => {
    const { client } = makeClient({ fetchImpl: okFetch() })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    const result = client.ensureFresh(testUser(), {})
    identity.fire(testUser('uid-2', 'id-token-2'))

    expect(await result).toBeUndefined()
  })

  it('getToken is sync, uid-guarded, and empty after detach', async () => {
    const { client } = makeClient({ fetchImpl: okFetch('jwt-sync') })
    const identity = manualIdentity()
    const detach = client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-sync')
    })
    detach()

    expect(client.getToken()).toBeUndefined()
    expect(client.getSnapshot().phase).toBe('signed-out')
  })

  it('invalidates an explicit-user mint that resolves after external sign-out', async () => {
    let release!: (response: Response) => void
    const fetchImpl = vi.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => (release = resolve))
    )
    const { client } = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    const user = testUser()

    identity.fire(user)
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled())
    const explicit = client.ensureFresh(user, {})
    identity.fire(null)
    release(jsonResponse(200, mintBody()))

    expect(
      await explicit,
      'resolving ok after sign-out is the AUTH-CREDENTIALS-0011 violation'
    ).toBeUndefined()
    expect(client.getSnapshot().phase).toBe('signed-out')
    expect(client.getToken()).toBeUndefined()
  })

  it('still publishes an explicit-user popup mint when the listener has not settled yet', async () => {
    const { client } = makeClient({ fetchImpl: okFetch('popup-jwt') })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    const result = await client.ensureFresh(testUser(), {})

    expect(
      result?.status === 'ok' && result.session.token,
      'the popup path mints before the identity listener first fires'
    ).toBe('popup-jwt')
  })

  it('exposes a popup mint through the snapshot only once the identity port delivers the user', async () => {
    const fetchImpl = okFetch('popup-jwt')
    const { client } = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    const user = testUser()

    const result = await client.ensureFresh(user, {})

    expect(result?.status).toBe('ok')
    expect(
      client.getSnapshot().phase,
      'the snapshot user belongs to the identity port, which has not fired yet'
    ).toBe('signed-out')
    expect(client.getToken()).toBeUndefined()

    identity.fire(user)

    await vi.waitFor(() => {
      expect(client.getSnapshot().phase).toBe('authenticated')
    })
    expect(client.getToken()).toBe('popup-jwt')
    expect(
      fetchImpl,
      'the listener settles from the cached popup credential, not a second mint'
    ).toHaveBeenCalledOnce()
  })

  it('ignores a stale detach from a superseded attachIdentity call', async () => {
    const { client } = makeClient({ fetchImpl: okFetch('jwt-b') })
    const identityA = manualIdentity()
    const identityB = manualIdentity()
    const detachA = client.attachIdentity(identityA.port)
    client.attachIdentity(identityB.port)

    identityB.fire(testUser('uid-2', 'id-token-2'))
    await vi.waitFor(() => {
      expect(client.getSnapshot().phase).toBe('authenticated')
    })
    detachA()

    expect(
      client.getSnapshot().phase,
      'a superseded detach must not clear the live identity'
    ).toBe('authenticated')
    expect(client.getToken()).toBe('jwt-b')
  })

  it('ignores a callback from an identity port that was already detached', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const { client } = makeClient({ fetchImpl })
    const identity = manualIdentity()
    const detach = client.attachIdentity(identity.port)

    detach()
    identity.fire(testUser())

    expect(client.getSnapshot().phase).toBe('signed-out')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('storage writes after identity changes', () => {
  it('never writes a credential minted before an external sign-out', async () => {
    let release!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => jsonResponse(200, mintBody()))
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (release = resolve))
      )
    const { client, storage } = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    const user = testUser()

    identity.fire(user)
    await vi.waitFor(() => expect(client.getToken()).toBe('workspace-jwt'))
    const late = client.remint(user, {})
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))
    identity.fire(null)
    expect(storage.raw()).toBeNull()
    release(jsonResponse(200, mintBody({ token: 'stale-after-signout' })))

    expect(await late).toBeUndefined()
    expect(
      storage.raw(),
      'the in-memory guard is not enough; a late mint must not resurrect a signed-out session in storage'
    ).toBeNull()
  })

  it('never writes a credential minted before a detach', async () => {
    let release!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => jsonResponse(200, mintBody()))
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (release = resolve))
      )
    const { client, storage } = makeClient({ fetchImpl })
    const identity = manualIdentity()
    const detach = client.attachIdentity(identity.port)
    const user = testUser()

    identity.fire(user)
    await vi.waitFor(() => expect(client.getToken()).toBe('workspace-jwt'))
    const late = client.remint(user, {})
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))
    detach()
    client.clearCache()
    release(jsonResponse(200, mintBody({ token: 'stale-after-detach' })))
    await late

    expect(
      storage.raw(),
      'a mint that outlives its attachment must not repopulate the cache the host cleared'
    ).toBeNull()
  })
})

describe('storage resilience', () => {
  it('degrades a throwing storage read to a cache miss', async () => {
    const fetchImpl = okFetch()
    const client = createSessionClient({
      exchangeUrl: EXCHANGE_URL,
      fetchImpl,
      storage: {
        read: () => {
          throw new Error('storage unavailable')
        },
        write: () => undefined,
        clear: () => undefined
      }
    })

    const result = await client.ensureFresh(testUser(), {})

    expect(result?.status).toBe('ok')
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('never fails a successful mint on a throwing storage write', async () => {
    const client = createSessionClient({
      exchangeUrl: EXCHANGE_URL,
      fetchImpl: okFetch(),
      storage: {
        read: () => null,
        write: () => {
          throw new Error('quota exceeded')
        },
        clear: () => undefined
      }
    })

    const result = await client.ensureFresh(testUser(), {})

    expect(
      result?.status,
      'a failed cache write must not fail an already-fetched mint'
    ).toBe('ok')
  })

  it('still publishes signed-out when the sign-out cache clear throws', async () => {
    const client = createSessionClient({
      exchangeUrl: EXCHANGE_URL,
      fetchImpl: okFetch(),
      storage: {
        read: () => null,
        write: () => undefined,
        clear: () => {
          throw new Error('storage unavailable')
        }
      }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getSnapshot().phase).toBe('authenticated')
    })
    identity.fire(null)

    expect(client.getSnapshot().phase).toBe('signed-out')
  })
})

describe('shared session copy', () => {
  it('covers every session error code and both success states', () => {
    const codes: SessionErrorCode[] = [
      'NOT_AUTHENTICATED',
      'INVALID_FIREBASE_TOKEN',
      'ACCESS_DENIED',
      'WORKSPACE_NOT_FOUND',
      'TOKEN_EXCHANGE_FAILED'
    ]
    for (const code of codes) {
      expect(SESSION_ERROR_MESSAGES[code]).toBeTruthy()
    }
    expect(SESSION_SUCCESS_MESSAGES.signedInHeading).toBeTruthy()
    expect(SESSION_SUCCESS_MESSAGES.signedInAs).toBeTruthy()
  })
})
