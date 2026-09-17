import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  manualIdentity,
  memoryStorage,
  mintResponse,
  okFetch
} from './__fixtures__/sessionFakes.js'
import type {
  AccountUser,
  SessionClientOptions,
  SessionSnapshot
} from './session.js'
import { createSessionClient } from './session.js'

const EXCHANGE_URL = 'https://cloud.test/api/auth/token'
const NINETY_MINUTES_MS = 90 * 60 * 1000

function testUser(uid = 'uid-1'): AccountUser {
  return { uid, getIdToken: vi.fn(async () => 'id-token') }
}

function makeClient(overrides: Partial<SessionClientOptions> = {}) {
  const storage = memoryStorage()
  const identity = manualIdentity()
  const client = createSessionClient(
    { exchangeUrl: EXCHANGE_URL, storage, ...overrides },
    identity.port
  )
  return { client, storage, identity }
}

function phasesOf(client: ReturnType<typeof makeClient>['client']) {
  const phases: SessionSnapshot['phase'][] = []
  client.subscribe((snapshot) => phases.push(snapshot.phase))
  return phases
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe('constructing with identity', () => {
  it.for([
    {
      name: 'auto-mints on the first delivered user',
      options: {},
      phases: ['pending', 'minting', 'authenticated'],
      mints: 1
    },
    {
      name: 'with autoMint: false sets the user and leaves minting to the host',
      options: { autoMint: false },
      phases: ['pending', 'minting'],
      mints: 0
    }
  ] as const)('$name', async ({ options, phases, mints }) => {
    const fetchImpl = okFetch()
    const { client, identity } = makeClient({ fetchImpl, ...options })
    const seen = phasesOf(client)
    const user = testUser()

    identity.fire(user)
    await vi.waitFor(() => expect(seen).toEqual(phases))
    await vi.advanceTimersByTimeAsync(0)

    expect(seen).toEqual(phases)
    expect(client.getSnapshot().user?.uid).toBe(user.uid)
    expect(user.getIdToken).toHaveBeenCalledTimes(mints)
    expect(fetchImpl).toHaveBeenCalledTimes(mints)
  })

  it('settles signed-out without a mint when the first delivery is null', () => {
    const fetchImpl = okFetch()
    const { client, identity } = makeClient({ fetchImpl })
    const seen = phasesOf(client)

    identity.fire(null)

    expect(seen).toEqual(['pending', 'signed-out'])
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('dispose', () => {
  it('returns the snapshot to pending, stops the armed scheduler, and unsubscribes the port exactly once', async () => {
    const fetchImpl = okFetch()
    const { client, identity } = makeClient({
      fetchImpl,
      refreshScheduler: {}
    })
    identity.fire(testUser())
    await vi.waitFor(() => expect(client.getToken()).toBe('workspace-jwt'))

    client.dispose()
    client.dispose()

    expect(client.getSnapshot().phase).toBe('pending')
    expect(client.getToken()).toBeUndefined()
    expect(identity.unsubscribe).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS * 10)
    expect(
      fetchImpl,
      'a disposed client re-minting on a timer would resurrect a dead session'
    ).toHaveBeenCalledOnce()
  })

  it('is a no-op on a client constructed without identity', () => {
    const client = createSessionClient({
      exchangeUrl: EXCHANGE_URL,
      storage: memoryStorage()
    })

    client.dispose()

    expect(client.getSnapshot().phase).toBe('pending')
  })

  it('ignores an identity event delivered after dispose', () => {
    const fetchImpl = okFetch()
    const { client, identity } = makeClient({ fetchImpl })

    client.dispose()
    identity.fire(testUser())

    expect(client.getSnapshot().phase).toBe('pending')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('never commits a mint that was in flight when the client was disposed', async () => {
    let release!: (response: Response) => void
    const fetchImpl = vi.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => (release = resolve))
    )
    const { client, storage, identity } = makeClient({ fetchImpl })
    identity.fire(testUser())
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce())

    client.dispose()
    release(mintResponse('stale-after-dispose'))
    await vi.advanceTimersByTimeAsync(0)

    expect(client.getSnapshot().phase).toBe('pending')
    expect(client.getToken()).toBeUndefined()
    expect(
      storage.raw(),
      'a mint that outlives its identity must not repopulate the cache'
    ).toBeNull()
  })

  it('does not mint when a listener disposes the client during the identity publish', async () => {
    const fetchImpl = okFetch()
    const { client, storage, identity } = makeClient({
      fetchImpl,
      refreshScheduler: {}
    })
    const user = testUser()
    client.subscribe((snapshot) => {
      if (snapshot.phase === 'minting') client.dispose()
    })

    identity.fire(user)
    await vi.advanceTimersByTimeAsync(NINETY_MINUTES_MS * 10)

    expect(client.getSnapshot().phase).toBe('pending')
    expect(user.getIdToken).not.toHaveBeenCalled()
    expect(
      fetchImpl,
      'a client disposed inside the publish no longer tracks the user it would mint for'
    ).not.toHaveBeenCalled()
    expect(storage.raw()).toBeNull()
  })

  it('never publishes an explicit-user mint made after dispose', async () => {
    const { client, identity } = makeClient({ fetchImpl: okFetch() })
    identity.fire(testUser())
    await vi.waitFor(() => expect(client.getToken()).toBe('workspace-jwt'))
    client.dispose()

    await client.ensureFresh(testUser())

    expect(client.getSnapshot().phase).toBe('pending')
    expect(client.getToken()).toBeUndefined()
  })
})
