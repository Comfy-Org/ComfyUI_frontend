/**
 * @fileoverview Unit tests for V2 to V1 history adapter.
 */
import { describe, expect, it } from 'vitest'

import { mapHistoryV2toHistory } from '@/platform/remote/comfyui/history/adapters/v2ToV1Adapter'
import { zRawHistoryItemV2 } from '@/platform/remote/comfyui/history/types/historyV2Types'
import type { HistoryResponseV2 } from '@/platform/remote/comfyui/history/types/historyV2Types'

import {
  expectedV1Fixture,
  historyV2Fixture
} from '@tests-ui/fixtures/historyFixtures'
import {
  historyV2FiveItemsSorting,
  historyV2MultipleNoTimestamp,
  historyV2WithMissingTimestamp
} from '@tests-ui/fixtures/historySortingFixtures'
import type { HistoryTaskItem } from '@/platform/remote/comfyui/history/types/historyV1Types'

function findResultByPromptId(
  result: HistoryTaskItem[],
  promptId: string
): HistoryTaskItem {
  const item = result.find((item) => item.prompt[1] === promptId)
  if (!item) {
    throw new Error(`Expected item with promptId ${promptId} not found`)
  }
  return item
}

describe('mapHistoryV2toHistory', () => {
  describe('fixture validation', () => {
    it('should have valid fixture data', () => {
      // Validate all items in the fixture to ensure test data is correct
      historyV2Fixture.history.forEach((item: unknown) => {
        expect(() => zRawHistoryItemV2.parse(item)).not.toThrow()
      })
    })
  })

  describe('given a complete V2 history response with edge cases', () => {
    const history = mapHistoryV2toHistory(historyV2Fixture)

    it('should transform all items to V1 format with correct structure', () => {
      expect(history).toEqual(expectedV1Fixture)
    })

    it('should add taskType "History" to all items', () => {
      history.forEach((item) => {
        expect(item.taskType).toBe('History')
      })
    })

    it('should transform prompt to V1 tuple [priority, id, {}, extra_data, outputNodeIds]', () => {
      const firstItem = history[0]

      expect(firstItem.prompt[0]).toBe(1) // Synthetic priority based on timestamp
      expect(firstItem.prompt[1]).toBe('complete-item-id')
      expect(firstItem.prompt[2]).toEqual({}) // history v2 does not return this data
      expect(firstItem.prompt[3]).toMatchObject({ client_id: 'test-client' })
      expect(firstItem.prompt[4]).toEqual(['9'])
    })

    it('should handle missing optional status field', () => {
      expect(history[1].prompt[1]).toBe('no-status-id')
      expect(history[1].status).toBeUndefined()
    })

    it('should handle missing optional meta field', () => {
      expect(history[2].prompt[1]).toBe('no-meta-id')
      expect(history[2].meta).toBeUndefined()
    })

    it('should derive output node IDs from outputs object keys', () => {
      const multiOutputItem = history[3]

      expect(multiOutputItem.prompt[4]).toEqual(
        expect.arrayContaining(['3', '9', '12'])
      )
      expect(multiOutputItem.prompt[4]).toHaveLength(3)
    })
  })

  describe('given empty history array', () => {
    it('should return empty array', () => {
      const emptyResponse: HistoryResponseV2 = { history: [] }
      const history = mapHistoryV2toHistory(emptyResponse)

      expect(history).toEqual([])
    })
  })

  describe('given empty outputs object', () => {
    it('should return empty array for output node IDs', () => {
      const v2Response: HistoryResponseV2 = {
        history: [
          {
            prompt_id: 'test-id',
            prompt: {
              priority: 0,
              prompt_id: 'test-id',
              extra_data: { client_id: 'test' }
            },
            outputs: {}
          }
        ]
      }

      const history = mapHistoryV2toHistory(v2Response)

      expect(history[0].prompt[4]).toEqual([])
    })
  })

  describe('given missing client_id', () => {
    it('should accept history items without client_id', () => {
      const v2Response: HistoryResponseV2 = {
        history: [
          {
            prompt_id: 'test-id',
            prompt: {
              priority: 0,
              prompt_id: 'test-id',
              extra_data: {}
            },
            outputs: {}
          }
        ]
      }

      const history = mapHistoryV2toHistory(v2Response)

      expect(history[0].prompt[3].client_id).toBeUndefined()
    })
  })

  describe('timestamp-based priority assignment', () => {
    it('assigns priority 0 to items without execution_success timestamp', () => {
      const result = mapHistoryV2toHistory(historyV2WithMissingTimestamp)

      expect(result).toHaveLength(3)

      const item1000 = findResultByPromptId(result, 'item-timestamp-1000')
      const item2000 = findResultByPromptId(result, 'item-timestamp-2000')
      const itemNoTimestamp = findResultByPromptId(result, 'item-no-timestamp')

      expect(item2000.prompt[0]).toBe(2)
      expect(item1000.prompt[0]).toBe(1)
      expect(itemNoTimestamp.prompt[0]).toBe(0)
    })

    it('correctly sorts and assigns priorities for multiple items', () => {
      const result = mapHistoryV2toHistory(historyV2FiveItemsSorting)

      expect(result).toHaveLength(5)

      const item1000 = findResultByPromptId(result, 'item-timestamp-1000')
      const item2000 = findResultByPromptId(result, 'item-timestamp-2000')
      const item3000 = findResultByPromptId(result, 'item-timestamp-3000')
      const item4000 = findResultByPromptId(result, 'item-timestamp-4000')
      const item5000 = findResultByPromptId(result, 'item-timestamp-5000')

      expect(item5000.prompt[0]).toBe(5)
      expect(item4000.prompt[0]).toBe(4)
      expect(item3000.prompt[0]).toBe(3)
      expect(item2000.prompt[0]).toBe(2)
      expect(item1000.prompt[0]).toBe(1)
    })

    it('assigns priority 0 to all items when multiple items lack timestamps', () => {
      const result = mapHistoryV2toHistory(historyV2MultipleNoTimestamp)

      expect(result).toHaveLength(3)

      const item1 = findResultByPromptId(result, 'item-no-timestamp-1')
      const item2 = findResultByPromptId(result, 'item-no-timestamp-2')
      const item3 = findResultByPromptId(result, 'item-no-timestamp-3')

      expect(item1.prompt[0]).toBe(0)
      expect(item2.prompt[0]).toBe(0)
      expect(item3.prompt[0]).toBe(0)
    })
  })
})
