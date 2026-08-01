import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { probeFrontendVersion } from './frontendVersionProbe'

describe('probeFrontendVersion', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reads the version and bucket headers from an OK response', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        headers: {
          'X-Frontend-Version': 'abc123',
          'X-Frontend-Bucket': 'canary'
        }
      })
    )

    await expect(probeFrontendVersion()).resolves.toEqual({
      version: 'abc123',
      bucket: 'canary'
    })
  })

  it('issues a HEAD request against the current origin, no-store', async () => {
    fetchMock.mockResolvedValue(new Response(null))

    await probeFrontendVersion()

    expect(fetchMock).toHaveBeenCalledWith(
      window.location.origin,
      expect.objectContaining({ method: 'HEAD', cache: 'no-store' })
    )
  })

  it('returns null header values when the headers are absent', async () => {
    fetchMock.mockResolvedValue(new Response(null))

    await expect(probeFrontendVersion()).resolves.toEqual({
      version: null,
      bucket: null
    })
  })

  it('returns null when the response is not OK', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }))

    await expect(probeFrontendVersion()).resolves.toBeNull()
  })

  it('propagates network errors to the caller', async () => {
    fetchMock.mockRejectedValue(new Error('network error'))

    await expect(probeFrontendVersion()).rejects.toThrow('network error')
  })

  it('passes an abort signal so the probe can time out', async () => {
    fetchMock.mockResolvedValue(new Response(null))

    await probeFrontendVersion(500)

    const init = fetchMock.mock.calls[0][1]
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })
})
