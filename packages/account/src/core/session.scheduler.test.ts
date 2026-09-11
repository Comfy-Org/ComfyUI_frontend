import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AccountCredential,
  AccountUser,
  CredentialStorage,
  CrossTabRefreshPort,
  SessionClientOptions
} from './session.js'
import { createTestIdentity } from '../testing.js'
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
  const port = createTestIdentity<AccountUser>({
    onUserChanged: (callback) => {
      deliver = callback
      return () => undefined
    }
  })
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

  it('gives up after max retries, keeps the token to its expiry, then fails closed', async () => {
    const outcomes: string[] = []
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-1'))
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

    // The refresh point, then the three retries (5 s, 10 s, 20 s).
    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS - DEFAULT_BUFFER_MS)
    await vi.advanceTimersByTimeAsync(35_000 + 10)
    expect(
      fetchImpl,
      'one scheduled attempt plus three capped retries, then the chain must stop'
    ).toHaveBeenCalledTimes(5)
    expect(
      client.getToken(),
      'a still-valid token keeps serving while there is time on it'
    ).toBe('jwt-1')

    await vi.advanceTimersByTimeAsync(DEFAULT_BUFFER_MS)

    expect(
      client.getToken(),
      'an expired token with a dead scheduler must never stay in circulation'
    ).toBeUndefined()
    expect(client.getSnapshot().phase).toBe('error')
    expect(outcomes.at(-1)).toBe('expired')
    expect(fetchImpl).toHaveBeenCalledTimes(5)
  })

  it('never arms a refresh tighter than one retry interval', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            token: 'short-jwt',
            permissions: [],
            // Already inside the buffer: a zero delay would loop the mint.
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
            role: 'owner'
          }),
          { status: 200 }
        )
    )
    const client = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('short-jwt')
    })
    await vi.advanceTimersByTimeAsync(4_000)

    expect(fetchImpl, 'no re-mint before the floor').toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_100)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
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

  it('stops the armed scheduler when a caller-initiated remint fails permanently', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-1'))
      .mockImplementationOnce(async () => new Response('{}', { status: 401 }))
      .mockImplementation(async () => mintResponse('jwt-resurrected'))
    const client = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })

    const failed = await client.remint(testUser())
    expect(failed?.status).toBe('error')
    expect(client.getToken()).toBeUndefined()

    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS * 10)

    expect(
      fetchImpl,
      'the old refresh timer must not resurrect a permanently-failed session'
    ).toHaveBeenCalledTimes(2)
    expect(client.getToken()).toBeUndefined()
  })

  it('fails closed when a scheduled refresh returns a workspace other than the target', async () => {
    const workspaceResponse = (token: string, wsId: string) =>
      new Response(
        JSON.stringify({
          token,
          permissions: ['workspace:read'],
          expires_at: new Date(Date.now() + NINETY_MINUTES_MS).toISOString(),
          workspace: { id: wsId, name: 'Team', type: 'team' },
          role: 'member'
        }),
        { status: 200 }
      )
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () =>
        workspaceResponse('jwt-team', 'ws-team')
      )
      .mockImplementation(async () =>
        workspaceResponse('jwt-wrong', 'ws-other')
      )
    const client = makeClient({ fetchImpl })
    const identity = manualIdentity()
    client.attachIdentity(identity.port, { autoMint: false })
    const user = testUser()

    identity.fire(user)
    await client.ensureFresh(user, { workspaceId: 'ws-team' })
    expect(client.getToken()).toBe('jwt-team')

    await vi.advanceTimersByTimeAsync(
      NINETY_MINUTES_MS - DEFAULT_BUFFER_MS + 10
    )

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(
      client.getToken(),
      'a scheduled 200 for the wrong workspace must not be committed under the target'
    ).toBeUndefined()
    expect(client.getSnapshot().phase).toBe('error')
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
      'retries_exhausted',
      'expired'
    ])
  })

  it('hands the committed failure to the host hook with a permanent outcome', async () => {
    const reported: unknown[] = []
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-1'))
      .mockImplementation(async () => new Response('{}', { status: 403 }))
    const client = makeClient({
      fetchImpl,
      refreshScheduler: {
        onScheduledOutcome: (outcome, failure) =>
          reported.push([outcome, failure])
      }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })

    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS)

    expect(reported.at(-1)).toEqual([
      'permanent_failure',
      { status: 'error', code: 'ACCESS_DENIED', httpStatus: 403 }
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
  const leadershipRequests: Array<{
    key: string
    onAcquired: () => void
    abandoned: boolean
  }> = []
  let feed: ((message: unknown) => void) | undefined
  const stopFeed = vi.fn()
  const published: AccountCredential[] = []
  const keys: string[] = []
  const port: CrossTabRefreshPort = {
    requestLeadership: (key, onAcquired) => {
      const request = { key, onAcquired, abandoned: false }
      leadershipRequests.push(request)
      keys.push(key)
      return () => {
        request.abandoned = true
      }
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
    // Grants the latest request by default; pass an index to grant a
    // specific (possibly abandoned) one, as the real lock manager may.
    grantLeadership: (index?: number) =>
      leadershipRequests[index ?? leadershipRequests.length - 1]?.onAcquired(),
    receive: (message: unknown) => feed?.(message),
    leadershipRequests,
    published,
    keys,
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
      'the key must carry the SERVER-RESOLVED workspace: target-based keys collide across workspaces minted via the personal {} body'
    ).toBe('comfy-account-refresh:uid-1:ws-1')
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

  it('a synchronously granted lease arms exactly one refresh chain', async () => {
    const outcomes: string[] = []
    let minted = 0
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      mintResponse(`jwt-${(minted += 1)}`)
    )
    // An uncontended real Web Lock is effectively a synchronous grant: the
    // onAcquired re-arm fires from inside armScheduledRefresh itself.
    const port: CrossTabRefreshPort = {
      requestLeadership: (_key, onAcquired) => {
        onAcquired()
        return vi.fn()
      },
      publishCredential: vi.fn(),
      onCredential: () => vi.fn()
    }
    const client = makeClient({
      fetchImpl,
      refreshScheduler: {
        crossTab: { port },
        onScheduledOutcome: (outcome) => outcomes.push(outcome)
      }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })
    await vi.advanceTimersByTimeAsync(
      NINETY_MINUTES_MS - DEFAULT_BUFFER_MS + 10
    )

    expect(client.getToken()).toBe('jwt-2')
    expect(
      outcomes,
      'a reentrant double-arm leaks a second timer and reports the one refresh twice'
    ).toEqual(['succeeded'])
  })

  it('ignores a leadership grant for an abandoned same-key request', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => mintResponse('jwt-1'))
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
    identity.fire(null)
    identity.fire(user)
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })
    expect(tab.leadershipRequests).toHaveLength(2)
    expect(tab.leadershipRequests[0].abandoned).toBe(true)

    tab.grantLeadership(0)
    tab.receive(
      publishedCredential({
        token: 'jwt-from-real-leader',
        expiresAt: Date.now() + NINETY_MINUTES_MS * 2
      })
    )

    expect(
      client.getToken(),
      'an abandoned request winning the grant race must not promote this tab into an adoption-deaf false leader'
    ).toBe('jwt-from-real-leader')
  })

  it('re-arms the refresh on promotion even after retries exhausted the timer', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-1'))
      .mockImplementationOnce(async () => new Response('{}', { status: 503 }))
      .mockImplementationOnce(async () => new Response('{}', { status: 503 }))
      .mockImplementationOnce(async () => new Response('{}', { status: 503 }))
      .mockImplementationOnce(async () => new Response('{}', { status: 503 }))
      .mockImplementation(async () => mintResponse('jwt-2'))
    const tab = fakeCrossTabPort()
    const client = makeClient({
      fetchImpl,
      refreshScheduler: { crossTab: { port: tab.port, followerJitterMs: 0 } }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)

    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })
    // The refresh point plus the three retries: the chain is dead, the
    // token still has minutes on it.
    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS - DEFAULT_BUFFER_MS)
    await vi.advanceTimersByTimeAsync(35_000 + 10)
    expect(fetchImpl).toHaveBeenCalledTimes(5)
    expect(client.getToken()).toBe('jwt-1')

    tab.grantLeadership()
    // Re-armed at the floor, since the refresh point is already behind.
    await vi.advanceTimersByTimeAsync(5_000 + 10)

    expect(
      client.getToken(),
      'a promoted leader with a dead retry chain must retake the schedule, not sit refreshless and adoption-deaf'
    ).toBe('jwt-2')
    await vi.advanceTimersByTimeAsync(DEFAULT_BUFFER_MS)
    expect(
      client.getToken(),
      'the fresh credential cancels the pending clear-at-expiry of the old one'
    ).toBe('jwt-2')
  })

  it("an exhausted leader releases the lease, re-queues as a follower, and adopts a sibling's credential", async () => {
    const adopted: AccountCredential[] = []
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-1'))
      .mockImplementation(async () => new Response('{}', { status: 503 }))
    const tab = fakeCrossTabPort()
    const client = makeClient({
      fetchImpl,
      refreshScheduler: {
        crossTab: {
          port: tab.port,
          onCredentialAdopted: (credential) => adopted.push(credential)
        }
      }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })
    tab.grantLeadership()
    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS - DEFAULT_BUFFER_MS)
    await vi.advanceTimersByTimeAsync(35_000 + 10)
    expect(fetchImpl).toHaveBeenCalledTimes(5)

    expect(
      tab.leadershipRequests[0].abandoned,
      'a leader with a dead chain must not sit on the lease'
    ).toBe(true)
    expect(
      tab.leadershipRequests.length,
      'and must queue again so it can be promoted back if nobody else leads'
    ).toBe(2)

    tab.receive(publishedCredential({ token: 'jwt-from-sibling' }))
    expect(
      client.getToken(),
      'the sibling that took the lease refreshes for everyone, this tab included'
    ).toBe('jwt-from-sibling')
    expect(adopted.map((credential) => credential.token)).toEqual([
      'jwt-from-sibling'
    ])
  })

  it('fails closed at expiry even when the lock manager regrants the same tab after every exhausted chain', async () => {
    const outcomes: string[] = []
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => mintResponse('jwt-1'))
      .mockImplementation(async () => new Response('{}', { status: 503 }))
    // A single tab: every leadership request is granted at once, so an
    // exhausted chain that yields the lease gets it straight back.
    const port: CrossTabRefreshPort = {
      requestLeadership: (_key, onAcquired) => {
        onAcquired()
        return () => undefined
      },
      publishCredential: () => undefined,
      onCredential: () => () => undefined
    }
    const client = makeClient({
      fetchImpl,
      refreshScheduler: {
        crossTab: { port },
        onScheduledOutcome: (outcome) => outcomes.push(outcome)
      }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-1')
    })

    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS + 60_000)

    expect(
      client.getToken(),
      'a regrant re-arms the refresh; it must never cancel the hard expiry'
    ).toBeUndefined()
    expect(outcomes).toContain('expired')
    const callsAtExpiry = fetchImpl.mock.calls.length
    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS)
    expect(
      fetchImpl.mock.calls.length,
      'no chain keeps hammering the exchange after the credential is gone'
    ).toBe(callsAtExpiry)
  })

  it('tells the host when a credential was adopted, since the tab did not rotate it itself', async () => {
    const adopted: string[] = []
    const fetchImpl = vi.fn<typeof fetch>(async () => mintResponse('jwt-own'))
    const tab = fakeCrossTabPort()
    const client = makeClient({
      fetchImpl,
      refreshScheduler: {
        crossTab: {
          port: tab.port,
          onCredentialAdopted: (credential) => adopted.push(credential.token)
        }
      }
    })
    const identity = manualIdentity()
    client.attachIdentity(identity.port)
    identity.fire(testUser())
    await vi.waitFor(() => {
      expect(client.getToken()).toBe('jwt-own')
    })

    tab.receive(publishedCredential())

    expect(adopted).toEqual(['jwt-from-leader'])
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
