import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestIdentity } from '../testing.js'
import type {
  AccountUser,
  CredentialStorage,
  SessionClientOptions,
  SessionSnapshot
} from './session.js'
import { createSessionClient } from './session.js'

const EXCHANGE_URL = 'https://cloud.test/api/auth/token'
const NINETY_MINUTES_MS = 90 * 60 * 1000

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

function okFetch(token = 'workspace-jwt') {
  return vi.fn<typeof fetch>(async () => mintResponse(token))
}

function manualIdentity() {
  let deliver: ((user: AccountUser | null) => void) | undefined
  const unsubscribe = vi.fn()
  const port = createTestIdentity<AccountUser>({
    onUserChanged: (callback) => {
      deliver = callback
      return unsubscribe
    }
  })
  return {
    port,
    fire: (user: AccountUser | null) => deliver?.(user),
    unsubscribe
  }
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
    expect(client.getSnapshot().user?.uid).toBe(user.uid)
    expect(fetchImpl).toHaveBeenCalledTimes(mints)
  })

  it('refuses a port that did not come from the package entry or the testing seam', () => {
    expect(() =>
      createSessionClient(
        { exchangeUrl: EXCHANGE_URL, storage: memoryStorage() },
        // @ts-expect-error an unbranded port is not an AccountIdentity
        { onUserChanged: () => () => undefined }
      )
    ).toThrow('attachIdentity needs the identity')
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

  it('leaves the client attachable again, like a detach', async () => {
    const { client, identity } = makeClient({ fetchImpl: okFetch('jwt-b') })
    client.dispose()
    const replacement = manualIdentity()

    client.attachIdentity(replacement.port)
    replacement.fire(testUser('uid-2'))

    await vi.waitFor(() => expect(client.getToken()).toBe('jwt-b'))
    expect(identity.unsubscribe).toHaveBeenCalledOnce()
  })
})

describe('attachIdentity on a client constructed with identity', () => {
  it('replaces the constructed subscription', async () => {
    const { client, identity } = makeClient({ fetchImpl: okFetch('jwt-b') })
    const replacement = manualIdentity()

    client.attachIdentity(replacement.port)
    replacement.fire(testUser('uid-2'))
    await vi.waitFor(() => expect(client.getToken()).toBe('jwt-b'))
    identity.fire(null)

    expect(identity.unsubscribe).toHaveBeenCalledOnce()
    expect(
      client.getSnapshot().phase,
      'the constructed port is superseded; its events must not sign the client out'
    ).toBe('authenticated')
    expect(client.getToken()).toBe('jwt-b')
  })
})
