// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AccountUser } from '@comfyorg/account/core'

const h = vi.hoisted(() => ({
  captureSucceeded: vi.fn(),
  captureFailed: vi.fn()
}))

vi.mock('../scripts/posthog', () => ({
  captureAuthRefreshSucceeded: h.captureSucceeded,
  captureAuthRefreshFailed: h.captureFailed
}))

const STORAGE_KEY = 'comfy.workshop.session.v1'

function testUser(uid = 'uid-1'): AccountUser {
  return { uid, getIdToken: vi.fn(async () => 'id-token') }
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
  return mod.workshopSessionClient
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('workshop session storage adapter', () => {
  it('caches the minted session and serves it back without a network call', async () => {
    const client = await importFresh()

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
    const client = await importFresh()

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
  it('reports one succeeded outcome per minted token', async () => {
    const client = await importFresh()

    await client.ensureFresh(testUser(), { fetchImpl: okFetch() })

    expect(h.captureSucceeded).toHaveBeenCalledOnce()
    expect(h.captureFailed).not.toHaveBeenCalled()
  })

  it('does not repeat the outcome for a cached read of the same token', async () => {
    const client = await importFresh()

    await client.ensureFresh(testUser(), { fetchImpl: okFetch() })
    await client.ensureFresh(testUser(), { fetchImpl: vi.fn<typeof fetch>() })

    expect(
      h.captureSucceeded,
      'a cached read is not a new refresh outcome'
    ).toHaveBeenCalledOnce()
  })

  it('reports a permanent failure outcome', async () => {
    const client = await importFresh()

    await client.ensureFresh(testUser(), { fetchImpl: statusFetch(403) })

    expect(h.captureFailed).toHaveBeenCalledExactlyOnceWith('permanent_failure')
    expect(h.captureSucceeded).not.toHaveBeenCalled()
  })

  it('stays silent on a transient failure', async () => {
    const client = await importFresh()

    await client.ensureFresh(testUser(), { fetchImpl: statusFetch(503) })

    expect(
      h.captureFailed,
      'valid-on-read has no retry machinery, so transient outcomes are cloud-only vocabulary'
    ).not.toHaveBeenCalled()
  })
})
