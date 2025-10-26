/**
 * @fileoverview Unit tests for V2 history fetcher.
 */
import { describe, expect, it, vi } from 'vitest'

import { fetchHistoryV2 } from '@/platform/remote/comfyui/history/fetchers/fetchHistoryV2'

import {
  expectedV1Fixture,
  historyV2Fixture
} from '@tests-ui/fixtures/historyFixtures'

describe('fetchHistoryV2', () => {
  const mockFetchApi = vi.fn().mockResolvedValue({
    json: async () => historyV2Fixture
  })

  it('should fetch from /history_v2 endpoint with default max_items', async () => {
    await fetchHistoryV2(mockFetchApi)

    expect(mockFetchApi).toHaveBeenCalledWith('/history_v2?max_items=200')
  })

  it('should fetch with custom max_items parameter', async () => {
    await fetchHistoryV2(mockFetchApi, 50)

    expect(mockFetchApi).toHaveBeenCalledWith('/history_v2?max_items=50')
  })

  it('should adapt V2 response to V1-compatible format', async () => {
    const result = await fetchHistoryV2(mockFetchApi)

    expect(result.History).toEqual(expectedV1Fixture)
    expect(result).toHaveProperty('History')
    expect(Array.isArray(result.History)).toBe(true)
    result.History.forEach((item) => {
      expect(item.taskType).toBe('History')
      expect(item.prompt).toHaveLength(5)
    })
  })
})
