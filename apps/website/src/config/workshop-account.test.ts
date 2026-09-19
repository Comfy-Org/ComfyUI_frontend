import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import type { User } from 'firebase/auth'

import {
  captureAuthRefreshFailed,
  captureAuthRefreshSucceeded
} from '../scripts/posthog'
import {
  okFetch,
  testUser,
  testFirebaseUser
} from './__fixtures__/workshopSessionFakes'
import {
  STORAGE_KEY,
  workshopSessionClient,
  workshopIdentity,
  subscribeAuthRefreshTelemetry
} from './workshop-account'
import { workshopIdentity as firebaseIdentity } from './workshop-firebase'

let deliver: ((user: User | null) => void) | undefined

vi.mock(import('../scripts/posthog'))
vi.mock(import('./workshop-firebase'))

function statusFetch(status: number) {
  return vi.fn<typeof fetch>(async () => new Response('{}', { status }))
}

beforeEach(() => {
  sessionStorage.clear()
  workshopSessionClient.invalidate()
  onTestFinished(workshopSessionClient.attachIdentity(workshopIdentity))
  vi.mocked(firebaseIdentity.onUserChanged).mockImplementation((callback) => {
    deliver = callback
    callback(null)
    return () => {
      deliver = undefined
    }
  })
  onTestFinished(() => workshopIdentity.deactivate())
})

describe('workshop session storage adapter', () => {
  it('caches the minted session and serves it back without a network call', async () => {
    const first = await workshopSessionClient.ensureFresh(testUser(), {
      fetchImpl: okFetch()
    })
    expect(first?.status).toBe('ok')
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull()

    const secondFetch = vi.fn<typeof fetch>()
    const second = await workshopSessionClient.ensureFresh(testUser(), {
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

    const result = await workshopSessionClient.ensureFresh(testUser(), {
      fetchImpl: okFetch()
    })

    expect(
      result?.status,
      'disabled cookies/storage must degrade to memory-only, never crash sign-in'
    ).toBe('ok')
  })
})

describe('auth refresh telemetry', () => {
  async function activateIdentity() {
    await workshopIdentity.activate()
    return (user: User | null) => deliver?.(user)
  }

  it('reports one succeeded outcome per minted token', async () => {
    vi.stubGlobal('fetch', okFetch())

    onTestFinished(subscribeAuthRefreshTelemetry())
    const fire = await activateIdentity()

    fire(testFirebaseUser())

    await vi.waitFor(() =>
      expect(captureAuthRefreshSucceeded).toHaveBeenCalledOnce()
    )
    expect(captureAuthRefreshFailed).not.toHaveBeenCalled()
  })

  it('does not repeat the outcome for a cached read of the same token', async () => {
    vi.stubGlobal('fetch', okFetch())

    onTestFinished(subscribeAuthRefreshTelemetry())
    const fire = await activateIdentity()

    fire(testFirebaseUser())
    await vi.waitFor(() =>
      expect(captureAuthRefreshSucceeded).toHaveBeenCalledOnce()
    )
    fire(testFirebaseUser())
    await vi.waitFor(() =>
      expect(workshopSessionClient.getSnapshot().phase).toBe('authenticated')
    )

    expect(
      captureAuthRefreshSucceeded,
      'a cached read is not a new refresh outcome'
    ).toHaveBeenCalledOnce()
  })

  it('reports a permanent failure outcome', async () => {
    vi.stubGlobal('fetch', statusFetch(403))

    onTestFinished(subscribeAuthRefreshTelemetry())
    const fire = await activateIdentity()

    fire(testFirebaseUser())

    await vi.waitFor(() =>
      expect(captureAuthRefreshFailed).toHaveBeenCalledExactlyOnceWith(
        'permanent_failure'
      )
    )
    expect(captureAuthRefreshSucceeded).not.toHaveBeenCalled()
  })

  it('stays silent on a transient failure', async () => {
    vi.stubGlobal('fetch', statusFetch(503))

    onTestFinished(subscribeAuthRefreshTelemetry())
    const fire = await activateIdentity()

    fire(testFirebaseUser())

    await vi.waitFor(() =>
      expect(workshopSessionClient.getSnapshot().phase).toBe('error')
    )
    expect(
      captureAuthRefreshFailed,
      'valid-on-read has no retry machinery, so transient outcomes are cloud-only vocabulary'
    ).not.toHaveBeenCalled()
    expect(captureAuthRefreshSucceeded).not.toHaveBeenCalled()
  })
})
