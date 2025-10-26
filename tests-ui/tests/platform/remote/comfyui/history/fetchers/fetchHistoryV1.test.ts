/**
 * @fileoverview Unit tests for V1 history fetcher.
 */
import { describe, expect, it, vi } from 'vitest'

import { fetchHistoryV1 } from '@/platform/remote/comfyui/history/fetchers/fetchHistoryV1'

import { historyV1RawResponse } from '@tests-ui/fixtures/historyFixtures'

describe('fetchHistoryV1', () => {
  const mockFetchApi = vi.fn().mockResolvedValue({
    json: async () => historyV1RawResponse
  })

  it('should fetch from /history endpoint with default max_items', async () => {
    await fetchHistoryV1(mockFetchApi)

    expect(mockFetchApi).toHaveBeenCalledWith('/history?max_items=200')
  })

  it('should fetch with custom max_items parameter', async () => {
    await fetchHistoryV1(mockFetchApi, 50)

    expect(mockFetchApi).toHaveBeenCalledWith('/history?max_items=50')
  })

  it('should transform object response to array with taskType and preserve fields', async () => {
    const result = await fetchHistoryV1(mockFetchApi)

    expect(result.History).toHaveLength(2)
    result.History.forEach((item) => {
      expect(item.taskType).toBe('History')
    })
    expect(result.History[0]).toMatchObject({
      taskType: 'History',
      prompt: [24, 'complete-item-id', {}, expect.any(Object), ['9']],
      outputs: expect.any(Object),
      status: expect.any(Object),
      meta: expect.any(Object)
    })
  })

  it('should handle empty response object', async () => {
    const emptyMock = vi.fn().mockResolvedValue({
      json: async () => ({})
    })

    const result = await fetchHistoryV1(emptyMock)

    expect(result.History).toEqual([])
  })
})
