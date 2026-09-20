import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import type { User } from 'firebase/auth'

import type { LazyIdentity } from '@comfyorg/account-core/lazyIdentity'

import { okFetch, testUser } from './__fixtures__/workshopSessionFakes'
import { STORAGE_KEY } from './workshop-account'

const h = vi.hoisted(() => ({
  captureSucceeded: vi.fn(),
  captureFailed: vi.fn(),
  firebaseEvaluated: vi.fn(),
  deliver: undefined as ((user: User | null) => void) | undefined
}))

vi.mock<unknown>(import('../scripts/posthog'), () => ({
  captureAuthRefreshSucceeded: h.captureSucceeded,
  captureAuthRefreshFailed: h.captureFailed
}))

vi.mock<unknown>(import('./workshop-firebase'), async () => {
  const { createTestIdentity } = await import('@comfyorg/account-core/testing')
  h.firebaseEvaluated()
  return {
    workshopIdentity: createTestIdentity<User>({
      onUserChanged: (callback) => {
        h.deliver = callback
        callback(null)
        return () => {
          h.deliver = undefined
        }
      }
    })
  }
})

function testFirebaseUser(uid = 'uid-1'): User {
  return testUser(uid) as Partial<User> as User
}

function statusFetch(status: number) {
  return vi.fn<typeof fetch>(async () => new Response('{}', { status }))
}

async function importFresh() {
  vi.resetModules()
  const mod = await import('./workshop-account')
  return {
    client: mod.workshopSessionClient,
    identity: mod.workshopIdentity,
    startTelemetry: mod.subscribeAuthRefreshTelemetry
  }
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('workshop session storage adapter', () => {
  it('caches the minted session and serves it back without a network call', async () => {
    const { client } = await importFresh()

    const first = await client.ensureFresh(testUser(), {
      fetchImpl: okFetch()
    })
    expect(first?.status).toBe('ok')
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull()

    const secondFetch = vi.fn<typeof fetch>()
    const second = await client.ensureFresh(testUser(), {
      fetchImpl: secondFetch
    })
    expect(second?.status).toBe('ok')
    expect(
      secondFetch,
      'a fresh cache must satisfy the read'
    ).not.toHaveBeenCalled()
  })

  it('still mints when sessionStorage throws outright', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('storage disabled')
      },
      setItem: () => {
        throw new Error('storage disabled')
      },
      removeItem: () => {
        throw new Error('storage disabled')
      }
    })
    const { client } = await importFresh()

    const result = await client.ensureFresh(testUser(), {
      fetchImpl: okFetch()
    })

    expect(
      result?.status,
      'disabled cookies/storage must degrade to memory-only, never crash sign-in'
    ).toBe('ok')
  })
})

describe('workshop identity', () => {
  it('leaves the Firebase module unloaded until the identity is activated', async () => {
    const { identity } = await importFresh()

    expect(h.firebaseEvaluated).not.toHaveBeenCalled()
    await identity.activate()
    expect(h.firebaseEvaluated).toHaveBeenCalledOnce()
  })
})

describe('auth refresh telemetry', () => {
  async function activateIdentity(identity: LazyIdentity<User>) {
    await identity.activate()
    return (user: User | null) => h.deliver?.(user)
  }

  it('reports one succeeded outcome per minted token', async () => {
    vi.stubGlobal('fetch', okFetch())
    const { identity, startTelemetry } = await importFresh()
    onTestFinished(startTelemetry())
    const fire = await activateIdentity(identity)

    fire(testFirebaseUser())

    await vi.waitFor(() => expect(h.captureSucceeded).toHaveBeenCalledOnce())
    expect(h.captureFailed).not.toHaveBeenCalled()
  })

  it('does not repeat the outcome for a cached read of the same token', async () => {
    vi.stubGlobal('fetch', okFetch())
    const { client, identity, startTelemetry } = await importFresh()
    onTestFinished(startTelemetry())
    const fire = await activateIdentity(identity)

    fire(testFirebaseUser())
    await vi.waitFor(() => expect(h.captureSucceeded).toHaveBeenCalledOnce())
    fire(testFirebaseUser())
    await vi.waitFor(() =>
      expect(client.getSnapshot().phase).toBe('authenticated')
    )

    expect(
      h.captureSucceeded,
      'a cached read is not a new refresh outcome'
    ).toHaveBeenCalledOnce()
  })

  it('reports a permanent failure outcome', async () => {
    vi.stubGlobal('fetch', statusFetch(403))
    const { identity, startTelemetry } = await importFresh()
    onTestFinished(startTelemetry())
    const fire = await activateIdentity(identity)

    fire(testFirebaseUser())

    await vi.waitFor(() =>
      expect(h.captureFailed).toHaveBeenCalledExactlyOnceWith(
        'permanent_failure'
      )
    )
    expect(h.captureSucceeded).not.toHaveBeenCalled()
  })

  it('stays silent on a transient failure', async () => {
    vi.stubGlobal('fetch', statusFetch(503))
    const { client, identity, startTelemetry } = await importFresh()
    onTestFinished(startTelemetry())
    const fire = await activateIdentity(identity)

    fire(testFirebaseUser())

    await vi.waitFor(() => expect(client.getSnapshot().phase).toBe('error'))
    expect(
      h.captureFailed,
      'valid-on-read has no retry machinery, so transient outcomes are cloud-only vocabulary'
    ).not.toHaveBeenCalled()
    expect(h.captureSucceeded).not.toHaveBeenCalled()
  })
})
