import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AccountCredential,
  AccountUser,
  CredentialStorage,
  CrossTabRefreshPort,
  IdentityPort,
  SessionClientOptions
} from './session.js'
import { createSessionClient } from './session.js'

const EXCHANGE_URL = 'https://cloud.test/api/auth/token'
const NINETY_MINUTES_MS = 90 * 60 * 1000
const DEFAULT_BUFFER_MS = 5 * 60 * 1000

function memoryStorage(): CredentialStorage {
  let value: string | null = null
  return {
    read: () => value,
    write: (next) => {
      value = next
    },
    clear: () => {
      value = null
    }
  }
}

function makeClient(overrides: Partial<SessionClientOptions> = {}) {
  return createSessionClient({
    exchangeUrl: EXCHANGE_URL,
    storage: memoryStorage(),
    refreshScheduler: {},
    ...overrides
  })
}

function testUser(uid = 'uid-1'): AccountUser {
  return { uid, getIdToken: vi.fn(async () => 'id-token') }
}

function mintResponse(token: string) {
  return new Response(
    JSON.stringify({
      token,
      permissions: ['workspace:read'],
      expires_at: new Date(Date.now() + NINETY_MINUTES_MS).toISOString(),
      workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
      role: 'owner'
    }),
    { status: 200 }
  )
}

function manualIdentity() {
  let deliver: ((user: AccountUser | null) => void) | undefined
  const port: IdentityPort = {
    onUserChanged: (callback) => {
      deliver = callback
      return () => undefined
    }
  }
  return {
    port,
    fire: (user: AccountUser | null) => deliver?.(user)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe('opt-in refresh scheduler', () => {
  it('arms a refresh at expiry minus the buffer and re-mints through the same snapshot', async () => {
    let minted = 0
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      mintResponse(`jwt-${(minted += 1)}`)
    )
    const client = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })

    await vi.advanceTimersByTimeAsync(
      NINETY_MINUTES_MS - DEFAULT_BUFFER_MS + 10
    )

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(
      client.getToken(),
      'the scheduled re-mint must publish through the same snapshot the host already watches'
    ).toBe('jwt-2')
  })

  it('retries a transient scheduled failure with capped backoff', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-1'))
      .mockImplementationOnce(async () => new Response('{}', { status: 503 }))
      .mockImplementationOnce(async () => new Response('{}', { status: 503 }))
      .mockImplementationOnce(async () => mintResponse('jwt-2'))
    const client = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })

    await vi.advanceTimersByTimeAsync(
      NINETY_MINUTES_MS - DEFAULT_BUFFER_MS + 10
    )
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5000 + 10)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(10_000 + 10)
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(client.getToken()).toBe('jwt-2')
  })

  it('gives up after max retries and leaves recovery to valid-on-read', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-1'))
      .mockImplementation(async () => new Response('{}', { status: 503 }))
    const client = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })

    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS * 10)

    expect(
      fetchImpl,
      'one scheduled attempt plus three capped retries, then the chain must stop'
    ).toHaveBeenCalledTimes(5)
  })

  it('stops scheduling on sign-out', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => mintResponse('jwt-1'))
    const client = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })
    identity.fire(null)

    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS * 10)

    expect(
      fetchImpl,
      'a signed-out client re-minting on a timer would resurrect a dead session'
    ).toHaveBeenCalledOnce()
  })

  it('stops the chain on a permanent scheduled failure', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-1'))
      .mockImplementation(async () => new Response('{}', { status: 401 }))
    const client = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })

    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS * 10)

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(
      client.getSnapshot().phase,
      'the host observes the permanent failure through the snapshot, not a retry storm'
    ).toBe('error')
  })

  it('reports each scheduled outcome to the host hook, and only scheduled ones', async () => {
    const outcomes: string[] = []
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-1'))
      .mockImplementationOnce(async () => new Response('{}', { status: 503 }))
      .mockImplementationOnce(async () => mintResponse('jwt-2'))
      .mockImplementation(async () => new Response('{}', { status: 503 }))
    const client = makeClient({
      fetchImpl,
      refreshScheduler: {
        onScheduledOutcome: (outcome) => outcomes.push(outcome)
      }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })
    expect(
      outcomes,
      'the login mint is not a scheduled refresh; cloud does not track it'
    ).toEqual([])

    await vi.advanceTimersByTimeAsync(
      NINETY_MINUTES_MS - DEFAULT_BUFFER_MS + 10
    )
    expect(outcomes).toEqual(['retry_scheduled'])
    await vi.advanceTimersByTimeAsync(5000 + 10)
    expect(outcomes).toEqual(['retry_scheduled', 'succeeded'])

    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS * 10)
    expect(outcomes).toEqual([
      'retry_scheduled',
      'succeeded',
      'retry_scheduled',
      'retry_scheduled',
      'retry_scheduled',
      'retries_exhausted'
    ])
  })

  it('reports a permanent scheduled failure to the host hook', async () => {
    const outcomes: string[] = []
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-1'))
      .mockImplementation(async () => new Response('{}', { status: 401 }))
    const client = makeClient({
      fetchImpl,
      refreshScheduler: {
        onScheduledOutcome: (outcome) => outcomes.push(outcome)
      }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })
    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS * 10)

    expect(outcomes).toEqual(['permanent_failure'])
  })

  it('re-mints with the target that produced the credential', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            token: 'jwt-team',
            permissions: ['workspace:read'],
            expires_at: new Date(Date.now() + NINETY_MINUTES_MS).toISOString(),
            workspace: { id: 'ws-team', name: 'Team', type: 'team' },
            role: 'member'
          }),
          { status: 200 }
        )
    )
    const client = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port, { autoMint: false })
    const user = testUser()

    identity.fire(user)
    await client.ensureFresh(user, { workspaceId: 'ws-team' })
    await vi.advanceTimersByTimeAsync(
      NINETY_MINUTES_MS - DEFAULT_BUFFER_MS + 10
    )

    const [, scheduledInit] = fetchImpl.mock.calls[1]
    expect(
      scheduledInit?.body,
      'refreshing a team session with the personal default would silently switch workspaces'
    ).toBe(JSON.stringify({ workspace_id: 'ws-team' }))
  })

  it('never lets a stale scheduled refresh revert a workspace switch', async () => {
    let releaseScheduled!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-personal'))
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (releaseScheduled = resolve))
      )
      .mockImplementationOnce(
        async () =>
          new Response(
            JSON.stringify({
              token: 'jwt-team',
              permissions: ['workspace:read'],
              expires_at: new Date(
                Date.now() + NINETY_MINUTES_MS
              ).toISOString(),
              workspace: { id: 'ws-team', name: 'Team', type: 'team' },
              role: 'member'
            }),
            { status: 200 }
          )
      )
    const client = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    const user = testUser()

    identity.fire(user)
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-personal')
    })

    await vi.advanceTimersByTimeAsync(
      NINETY_MINUTES_MS - DEFAULT_BUFFER_MS + 10
    )
    const switched = await client.remint(user, { workspaceId: 'ws-team' })
    expect(switched?.status).toBe('ok')

    releaseScheduled(mintResponse('jwt-stale-personal'))
    await vi.advanceTimersByTimeAsync(0)

    expect(
      client.getToken(),
      'a scheduled personal refresh resolving after a workspace switch must not silently revert it'
    ).toBe('jwt-team')
    const snapshot = client.getSnapshot()
    expect(
      snapshot.phase === 'authenticated' && snapshot.session.workspace.id
    ).toBe('ws-team')
  })

  it('arms nothing without the opt-in', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => mintResponse('jwt-1'))
    const client = makeClient({ fetchImpl, refreshScheduler: undefined })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })

    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS * 10)

    expect(
      fetchImpl,
      'valid-on-read hosts opted into no timers'
    ).toHaveBeenCalledOnce()
  })
})

function fakeCrossTabPort() {
  let acquire: (() => void) | undefined
  let feed: ((message: unknown) => void) | undefined
  const abandonLeadership = vi.fn()
  const stopFeed = vi.fn()
  const published: AccountCredential[] = []
  const keys: string[] = []
  const port: CrossTabRefreshPort = {
    requestLeadership: (key, onAcquired) => {
      keys.push(key)
      acquire = onAcquired
      return abandonLeadership
    },
    publishCredential: (_key, credential) => {
      published.push(credential)
    },
    onCredential: (_key, callback) => {
      feed = callback
      return stopFeed
    }
  }
  return {
    port,
    grantLeadership: () => acquire?.(),
    receive: (message: unknown) => feed?.(message),
    published,
    keys,
    abandonLeadership,
    stopFeed
  }
}

function publishedCredential(
  overrides: Partial<AccountCredential> = {}
): AccountCredential {
  return {
    token: 'jwt-from-leader',
    expiresAt: Date.now() + NINETY_MINUTES_MS,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: ['workspace:read'],
    ...overrides
  }
}

describe('cross-tab refresh coordination', () => {
  it('the leader refreshes on schedule and publishes the result', async () => {
    let minted = 0
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      mintResponse(`jwt-${(minted += 1)}`)
    )
    const tab = fakeCrossTabPort()
    const client = makeClient({
      fetchImpl,
      refreshScheduler: { crossTab: { port: tab.port } }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })
    tab.grantLeadership()

    await vi.advanceTimersByTimeAsync(
      NINETY_MINUTES_MS - DEFAULT_BUFFER_MS + 10
    )

    expect(client.getToken()).toBe('jwt-2')
    expect(
      tab.published.map((credential) => credential.token),
      'every coordinated commit is published, so siblings adopt instead of minting their own'
    ).toEqual(['jwt-1', 'jwt-2'])
    expect(
      tab.keys[0],
      'the key scopes the lease and channel by user AND workspace; a broader key mixes scopes'
    ).toBe('comfy-account-refresh:uid-1:')
  })

  it('a follower adopts the published credential instead of minting', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => mintResponse('jwt-own'))
    const tab = fakeCrossTabPort()
    const client = makeClient({
      fetchImpl,
      refreshScheduler: { crossTab: { port: tab.port } }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-own')
    })

    tab.receive(publishedCredential())
    expect(
      client.getToken(),
      'a fresher published credential replaces the token this tab minted'
    ).toBe('jwt-from-leader')

    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS / 2)
    expect(
      fetchImpl,
      'an adopted credential re-arms the follower; no own mint before its refresh point'
    ).toHaveBeenCalledOnce()
  })

  it('a follower falls back to its own mint when the leader goes quiet', async () => {
    let minted = 0
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      mintResponse(`jwt-${(minted += 1)}`)
    )
    const tab = fakeCrossTabPort()
    const client = makeClient({
      fetchImpl,
      refreshScheduler: {
        crossTab: { port: tab.port, followerJitterMs: 10_000 }
      }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })

    await vi.advanceTimersByTimeAsync(
      NINETY_MINUTES_MS - DEFAULT_BUFFER_MS + 10_000 + 10
    )

    expect(
      client.getToken(),
      'a quiet leader must never strand the follower on an expiring token'
    ).toBe('jwt-2')
    expect(
      tab.published.map((credential) => credential.token),
      'the fallback mint is published so the rest of a leaderless cohort adopts instead of stampeding'
    ).toEqual(['jwt-1', 'jwt-2'])
  })

  it('a promoted follower retakes the schedule without jitter', async () => {
    let minted = 0
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      mintResponse(`jwt-${(minted += 1)}`)
    )
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const tab = fakeCrossTabPort()
    const client = makeClient({
      fetchImpl,
      refreshScheduler: {
        crossTab: { port: tab.port, followerJitterMs: 60_000 }
      }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })

    tab.grantLeadership()
    await vi.advanceTimersByTimeAsync(
      NINETY_MINUTES_MS - DEFAULT_BUFFER_MS + 10
    )

    expect(
      client.getToken(),
      'promotion must rearm at the refresh point, not the jittered fallback of the dead leader'
    ).toBe('jwt-2')
    expect(tab.published.map((credential) => credential.token)).toEqual([
      'jwt-1',
      'jwt-2'
    ])
  })

  it('never adopts a credential minted for a different workspace', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            token: 'jwt-team',
            permissions: ['workspace:read'],
            expires_at: new Date(Date.now() + NINETY_MINUTES_MS).toISOString(),
            workspace: { id: 'ws-team', name: 'Team', type: 'team' },
            role: 'member'
          }),
          { status: 200 }
        )
    )
    const tab = fakeCrossTabPort()
    const client = makeClient({
      fetchImpl,
      refreshScheduler: { crossTab: { port: tab.port } }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port, { autoMint: false })
    const user = testUser()
    identity.fire(user)
    await client.ensureFresh(user, { workspaceId: 'ws-team' })
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-team')
    })

    tab.receive(
      publishedCredential({
        token: 'jwt-cross-workspace',
        expiresAt: Date.now() + NINETY_MINUTES_MS * 2
      })
    )

    expect(
      client.getToken(),
      'a published credential scoped to another workspace must never switch this tab'
    ).toBe('jwt-team')
    const snapshot = client.getSnapshot()
    expect(
      snapshot.phase === 'authenticated' && snapshot.session.workspace.id
    ).toBe('ws-team')
  })

  it('the leader publishes a reactive re-mint, not only scheduled ones', async () => {
    let minted = 0
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      mintResponse(`jwt-${(minted += 1)}`)
    )
    const tab = fakeCrossTabPort()
    const client = makeClient({
      fetchImpl,
      refreshScheduler: { crossTab: { port: tab.port } }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    const user = testUser()

    identity.fire(user)
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })
    tab.grantLeadership()

    await client.remint(user, {})

    expect(
      tab.published.map((credential) => credential.token),
      'a 401-driven re-mint rotates the token; siblings left unpublished keep serving the rotated-out one'
    ).toEqual(['jwt-1', 'jwt-2'])
  })

  it('never adopts a credential for another user or a malformed message', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => mintResponse('jwt-own'))
    const tab = fakeCrossTabPort()
    const client = makeClient({
      fetchImpl,
      refreshScheduler: { crossTab: { port: tab.port } }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-own')
    })

    tab.receive(publishedCredential({ uid: 'someone-else' }))
    tab.receive({ token: 'garbage' })
    tab.receive('not even an object')

    expect(
      client.getToken(),
      'the broadcast crosses a serialization boundary; only a valid same-user credential commits'
    ).toBe('jwt-own')
  })

  it('an adopted credential supersedes the in-flight own mint', async () => {
    let releaseOwn!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-1'))
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (releaseOwn = resolve))
      )
    const tab = fakeCrossTabPort()
    const client = makeClient({
      fetchImpl,
      refreshScheduler: {
        crossTab: { port: tab.port, followerJitterMs: 10_000 }
      }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })

    await vi.advanceTimersByTimeAsync(
      NINETY_MINUTES_MS - DEFAULT_BUFFER_MS + 10_000 + 10
    )
    tab.receive(publishedCredential())
    releaseOwn(mintResponse('jwt-own-late'))
    await vi.advanceTimersByTimeAsync(0)

    expect(
      client.getToken(),
      'a late own mint resolving after an adoption must not overwrite it'
    ).toBe('jwt-from-leader')
  })
})
