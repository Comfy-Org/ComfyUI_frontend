import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  EXCHANGE_URL,
  NINETY_MINUTES_MS,
  deferred,
  manualIdentity,
  memoryStorage,
  mintResponse,
  okFetch,
  testUser
} from './__fixtures__/sessionFakes.js'
import type {
  AccountIdentity,
  SessionClientOptions,
  SessionSnapshot
} from './session.js'
import { createSessionClient } from './session.js'

function makeClient(
  overrides: Partial<SessionClientOptions> = {},
  port?: AccountIdentity
) {
  const storage = memoryStorage()
  const identity = manualIdentity()
  const client = createSessionClient(
    { exchangeUrl: EXCHANGE_URL, storage, ...overrides },
    port ?? identity.port
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
    const identity = manualIdentity()
    const { client } = makeClient({ fetchImpl, ...options }, identity.port)
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
    const identity = manualIdentity()
    const { client } = makeClient({ fetchImpl }, identity.port)
    const seen = phasesOf(client)

    identity.fire(null)

    expect(seen).toEqual(['pending', 'signed-out'])
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('dispose', () => {
  it('returns the snapshot to pending, stops the armed scheduler, and unsubscribes the port exactly once', async () => {
    const fetchImpl = okFetch()
    const identity = manualIdentity()
    const { client } = makeClient(
      {
        fetchImpl,
        refreshScheduler: {}
      },
      identity.port
    )
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
    const identity = manualIdentity()
    const { client } = makeClient({ fetchImpl }, identity.port)

    client.dispose()
    identity.fire(testUser())

    expect(client.getSnapshot().phase).toBe('pending')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('never commits a mint that was in flight when the client was disposed', async () => {
    const mint = deferred<Response>()
    const fetchImpl = vi.fn<typeof fetch>(() => mint.promise)
    const identity = manualIdentity()
    const { client, storage } = makeClient({ fetchImpl }, identity.port)
    identity.fire(testUser())
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce())

    client.dispose()
    mint.resolve(mintResponse('stale-after-dispose'))
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

  it('mints once, for the newer user, when a listener delivers a second user during the publish', async () => {
    const fetchImpl = okFetch()
    const { client, identity } = makeClient({ fetchImpl, refreshScheduler: {} })
    const first = testUser('uid-a', 'id-token-a')
    const second = testUser('uid-b', 'id-token-b')
    let reentered = false
    client.subscribe((snapshot) => {
      if (snapshot.user?.uid === 'uid-a' && !reentered) {
        reentered = true
        identity.fire(second)
      }
    })

    identity.fire(first)
    await vi.advanceTimersByTimeAsync(0)

    expect(
      first.getIdToken,
      'the superseded first delivery must not mint'
    ).not.toHaveBeenCalled()
    expect(second.getIdToken).toHaveBeenCalledOnce()
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('still serves an explicit-user mint after dispose, like a detach, without publishing it', async () => {
    const { client, storage, identity } = makeClient({ fetchImpl: okFetch() })
    identity.fire(testUser())
    await vi.waitFor(() => expect(client.getToken()).toBe('workspace-jwt'))
    client.dispose()

    await expect(client.ensureFresh(testUser())).resolves.toMatchObject({
      status: 'ok'
    })

    expect(storage.raw()).not.toBeNull()
    expect(client.getSnapshot().phase).toBe('pending')
    expect(client.getToken()).toBeUndefined()
  })
})
