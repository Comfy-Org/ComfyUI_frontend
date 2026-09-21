import { beforeEach, describe, expect, it, vi } from 'vitest'

import { okFetch, testUser } from './__fixtures__/workshopSessionFakes'
import { STORAGE_KEY, workshopSessionClient } from './workshop-account'

vi.mock(import('../scripts/posthog'))

beforeEach(() => {
  sessionStorage.clear()
  workshopSessionClient.invalidate()
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
