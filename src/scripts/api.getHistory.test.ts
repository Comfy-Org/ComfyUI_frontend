import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

describe('api.getHistory', () => {
  it('resolves to an empty list on failure by default', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('Internal Server Error', { status: 500 })
    )

    await expect(api.getHistory()).resolves.toEqual([])
  })

  it('rejects on failure when throwOnError is set', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('Internal Server Error', { status: 500 })
    )

    await expect(api.getHistory(200, { throwOnError: true })).rejects.toThrow(
      'Failed to fetch jobs: 500'
    )
  })
})
