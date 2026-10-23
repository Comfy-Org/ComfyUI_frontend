import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

describe('api.getNodeDefs', () => {
  it('serves the prefetched response once, then fetches fresh definitions', async () => {
    vi.spyOn(api, 'fetchApi')
      .mockResolvedValueOnce(Response.json({ KSampler: { name: 'KSampler' } }))
      .mockResolvedValueOnce(
        Response.json({ VAEDecode: { name: 'VAEDecode' } })
      )

    api.prefetchNodeDefs()
    api.prefetchNodeDefs()

    await expect(api.getNodeDefs()).resolves.toEqual({
      KSampler: { name: 'KSampler' }
    })
    await expect(api.getNodeDefs()).resolves.toEqual({
      VAEDecode: { name: 'VAEDecode' }
    })
    expect(api.fetchApi).toHaveBeenCalledTimes(2)
  })
  it('fetches fresh definitions when the prefetch failed', async () => {
    vi.spyOn(api, 'fetchApi')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(Response.json({ KSampler: { name: 'KSampler' } }))

    api.prefetchNodeDefs()

    await expect(api.getNodeDefs()).resolves.toEqual({
      KSampler: { name: 'KSampler' }
    })
  })
})
