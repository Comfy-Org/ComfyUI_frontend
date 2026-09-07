import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AccountUser,
  CredentialStorage,
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
