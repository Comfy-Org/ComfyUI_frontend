// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import type { User } from 'firebase/auth'

import type { AccountUser, SessionClient } from '@comfyorg/account/session'

const h = vi.hoisted(() => ({
  captureSucceeded: vi.fn(),
  captureFailed: vi.fn()
}))

vi.mock<unknown>(import('../scripts/posthog'), () => ({
  captureAuthRefreshSucceeded: h.captureSucceeded,
  captureAuthRefreshFailed: h.captureFailed
}))

const STORAGE_KEY = 'comfy.workshop.session.v1'

function testUser(uid = 'uid-1'): AccountUser {
  return { uid, getIdToken: vi.fn(async () => 'id-token') }
}

function testFirebaseUser(uid = 'uid-1'): User {
  return testUser(uid) as Partial<User> as User
}

function mintBody(token: string) {
  return {
    token,
    permissions: ['workspace:read'],
    expires_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner'
  }
}

function okFetch(token = 'jwt-1') {
  return vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(mintBody(token)), { status: 200 })
  )
}

function statusFetch(status: number) {
  return vi.fn<typeof fetch>(async () => new Response('{}', { status }))
}

async function importFresh() {
  vi.resetModules()
  const mod = await import('./workshop-account')
  return {
    client: mod.workshopSessionClient,
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

describe('auth refresh telemetry', () => {
  async function attachManualPort(client: SessionClient<User>) {
    const { createTestIdentity } = await import('@comfyorg/account/testing')
    let deliver: ((user: User | null) => void) | undefined
    client.attachIdentity(
      createTestIdentity<User>({
        onUserChanged: (callback) => {
          deliver = callback
          return () => undefined
        }
      })
    )
    return (user: User | null) => deliver?.(user)
  }

  it('reports one succeeded outcome per minted token', async () => {
    vi.stubGlobal('fetch', okFetch())
    const { client, startTelemetry } = await importFresh()
    onTestFinished(startTelemetry())
    const fire = await attachManualPort(client)

    fire(testFirebaseUser())

    await vi.waitFor(() => expect(h.captureSucceeded).toHaveBeenCalledOnce())
    expect(h.captureFailed).not.toHaveBeenCalled()
  })

  it('does not repeat the outcome for a cached read of the same token', async () => {
    vi.stubGlobal('fetch', okFetch())
    const { client, startTelemetry } = await importFresh()
    onTestFinished(startTelemetry())
    const fire = await attachManualPort(client)

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
    const { client, startTelemetry } = await importFresh()
    onTestFinished(startTelemetry())
    const fire = await attachManualPort(client)

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
    const { client, startTelemetry } = await importFresh()
    onTestFinished(startTelemetry())
    const fire = await attachManualPort(client)

    fire(testFirebaseUser())

    await vi.waitFor(() => expect(client.getSnapshot().phase).toBe('error'))
    expect(
      h.captureFailed,
      'valid-on-read has no retry machinery, so transient outcomes are cloud-only vocabulary'
    ).not.toHaveBeenCalled()
    expect(h.captureSucceeded).not.toHaveBeenCalled()
  })
})
