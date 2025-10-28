/**
 * @fileoverview Tests for history reconciliation (V1 and V2)
 */
import { describe, expect, it } from 'vitest'

import {
  reconcileHistory,
  reconcileHistoryCloud
} from '@/platform/remote/comfyui/history/reconciliation'
import type { TaskItem } from '@/schemas/apiSchema'

const createHistoryItem = (promptId: string, queueIndex = 0): TaskItem => ({
  taskType: 'History',
  prompt: [queueIndex, promptId, {}, {}, []],
  status: { status_str: 'success', completed: true, messages: [] },
  outputs: {}
})

const getAllPromptIds = (result: {
  newItems: TaskItem[]
  reusePromptIds: string[]
}): string[] => {
  return [
    ...result.newItems.map((item) => item.prompt[1]),
    ...result.reusePromptIds
  ]
}

describe('reconcileHistory (V1)', () => {
  describe('queueIndex-based filtering', () => {
    it('should add items with queueIndex > lastKnownQueueIndex', () => {
      const serverHistory = [
        createHistoryItem('new-1', 11),
        createHistoryItem('new-2', 10),
        createHistoryItem('old', 5)
      ]
      const clientHistory = [createHistoryItem('old', 5)]

      const result = reconcileHistory(serverHistory, clientHistory, 9, 10)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(3)
      expect(promptIds).toContain('new-1')
      expect(promptIds).toContain('new-2')
      expect(promptIds).toContain('old')
    })

    it('should NOT add items with queueIndex <= lastKnownQueueIndex', () => {
      const serverHistory = [
        createHistoryItem('new', 11),
        createHistoryItem('existing', 10),
        createHistoryItem('old-should-not-appear', 5)
      ]
      const clientHistory = [createHistoryItem('existing', 10)]

      const result = reconcileHistory(serverHistory, clientHistory, 10, 10)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(2)
      expect(promptIds).toContain('new')
      expect(promptIds).toContain('existing')
      expect(promptIds).not.toContain('old-should-not-appear')
    })

    it('should handle lastKnownQueueIndex of -1 (initial state)', () => {
      const serverHistory = [
        createHistoryItem('item-1', 5),
        createHistoryItem('item-2', 4)
      ]

      const result = reconcileHistory(serverHistory, [], -1, 10)

      expect(result.newItems).toHaveLength(2)
      expect(result.reusePromptIds).toHaveLength(0)
      expect(result.newItems[0].prompt[1]).toBe('item-1')
      expect(result.newItems[1].prompt[1]).toBe('item-2')
    })
  })

  describe('client state preservation', () => {
    it('should keep client items still on server', () => {
      const serverHistory = [
        createHistoryItem('new', 11),
        createHistoryItem('existing-1', 9),
        createHistoryItem('existing-2', 8)
      ]
      const clientHistory = [
        createHistoryItem('existing-1', 9),
        createHistoryItem('existing-2', 8)
      ]

      const result = reconcileHistory(serverHistory, clientHistory, 10, 10)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(3)
      expect(promptIds).toContain('new')
      expect(promptIds).toContain('existing-1')
      expect(promptIds).toContain('existing-2')
    })

    it('should drop client items not on server anymore', () => {
      const serverHistory = [
        createHistoryItem('new', 11),
        createHistoryItem('keep', 9)
      ]
      const clientHistory = [
        createHistoryItem('keep', 9),
        createHistoryItem('removed-from-server', 8)
      ]

      const result = reconcileHistory(serverHistory, clientHistory, 10, 10)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(2)
      expect(promptIds).toContain('new')
      expect(promptIds).toContain('keep')
      expect(promptIds).not.toContain('removed-from-server')
    })
  })

  describe('limiting results', () => {
    it('should limit results to maxItems', () => {
      const serverHistory = Array.from({ length: 10 }, (_, i) =>
        createHistoryItem(`item-${i}`, 20 + i)
      )

      const result = reconcileHistory(serverHistory, [], 15, 5)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(5)
    })

    it('should prioritize new items then existing when limiting', () => {
      const serverHistory = [
        createHistoryItem('new-1', 13),
        createHistoryItem('new-2', 12),
        createHistoryItem('new-3', 11),
        createHistoryItem('existing', 9)
      ]
      const clientHistory = [createHistoryItem('existing', 9)]

      const result = reconcileHistory(serverHistory, clientHistory, 10, 2)

      expect(result.newItems).toHaveLength(2)
      expect(result.newItems[0].prompt[1]).toBe('new-1')
      expect(result.newItems[1].prompt[1]).toBe('new-2')
      expect(result.reusePromptIds.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle empty client history', () => {
      const serverHistory = [
        createHistoryItem('item-1', 10),
        createHistoryItem('item-2', 9)
      ]

      const result = reconcileHistory(serverHistory, [], 8, 10)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(2)
    })

    it('should handle empty server history', () => {
      const clientHistory = [createHistoryItem('item-1', 5)]

      const result = reconcileHistory([], clientHistory, 5, 10)

      expect(result.newItems).toHaveLength(0)
      expect(result.reusePromptIds.length).toBe(0)
    })

    it('should handle both empty', () => {
      const result = reconcileHistory([], [], -1, 10)

      expect(result.newItems).toHaveLength(0)
      expect(result.reusePromptIds.length).toBe(0)
    })
  })
})

describe('reconcileHistoryCloud', () => {
  describe('adding new items', () => {
    it('should add new item to front when promptId not in client history', () => {
      const serverHistory = [
        createHistoryItem('new-item'),
        createHistoryItem('existing-item')
      ]
      const clientHistory = [createHistoryItem('existing-item')]

      const result = reconcileHistoryCloud(serverHistory, clientHistory, 10)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(2)
      expect(result.newItems[0].prompt[1]).toBe('new-item')
      expect(result.reusePromptIds.includes('existing-item')).toBe(true)
    })

    it('should add multiple new items to front in server order', () => {
      const serverHistory = [
        createHistoryItem('new-1'),
        createHistoryItem('new-2'),
        createHistoryItem('existing')
      ]
      const clientHistory = [createHistoryItem('existing')]

      const result = reconcileHistoryCloud(serverHistory, clientHistory, 10)

      expect(result.newItems).toHaveLength(2)
      expect(result.newItems[0].prompt[1]).toBe('new-1')
      expect(result.newItems[1].prompt[1]).toBe('new-2')
      expect(result.reusePromptIds.includes('existing')).toBe(true)
    })
  })

  describe('keeping existing items', () => {
    it('should keep client items that are still on server', () => {
      const serverHistory = [
        createHistoryItem('item-1'),
        createHistoryItem('item-2')
      ]
      const clientHistory = [
        createHistoryItem('item-1'),
        createHistoryItem('item-2')
      ]

      const result = reconcileHistoryCloud(serverHistory, clientHistory, 10)

      expect(result.newItems).toHaveLength(0)
      expect(result.reusePromptIds.includes('item-1')).toBe(true)
      expect(result.reusePromptIds.includes('item-2')).toBe(true)
    })

    it('should drop client items not on server anymore', () => {
      const serverHistory = [createHistoryItem('item-1')]
      const clientHistory = [
        createHistoryItem('item-1'),
        createHistoryItem('old-item')
      ]

      const result = reconcileHistoryCloud(serverHistory, clientHistory, 10)

      expect(result.newItems).toHaveLength(0)
      expect(result.reusePromptIds.includes('item-1')).toBe(true)
      expect(result.reusePromptIds.includes('old-item')).toBe(false)
    })
  })

  describe('synthetic priority handling', () => {
    it('should not rely on queueIndex for detecting new items', () => {
      const serverHistory = [
        createHistoryItem('existing', 100),
        createHistoryItem('new-item', 50)
      ]
      const clientHistory = [createHistoryItem('existing', 100)]

      const result = reconcileHistoryCloud(serverHistory, clientHistory, 10)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toContain('new-item')
      expect(promptIds).toContain('existing')
    })
  })

  describe('limiting results', () => {
    it('should limit results to maxItems', () => {
      const serverHistory = Array.from({ length: 10 }, (_, i) =>
        createHistoryItem(`server-${i}`)
      )
      const clientHistory = Array.from({ length: 5 }, (_, i) =>
        createHistoryItem(`client-${i}`)
      )

      const result = reconcileHistoryCloud(serverHistory, clientHistory, 5)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(5)
    })

    it('should prioritize new items when limiting', () => {
      const serverHistory = [
        createHistoryItem('new-1'),
        createHistoryItem('new-2'),
        createHistoryItem('existing')
      ]
      const clientHistory = [createHistoryItem('existing')]

      const result = reconcileHistoryCloud(serverHistory, clientHistory, 2)

      expect(result.newItems).toHaveLength(2)
      expect(result.newItems[0].prompt[1]).toBe('new-1')
      expect(result.newItems[1].prompt[1]).toBe('new-2')
      expect(result.reusePromptIds.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle empty client history', () => {
      const serverHistory = [
        createHistoryItem('item-1'),
        createHistoryItem('item-2')
      ]

      const result = reconcileHistoryCloud(serverHistory, [], 10)

      expect(result.newItems).toHaveLength(2)
      expect(result.newItems[0].prompt[1]).toBe('item-1')
      expect(result.newItems[1].prompt[1]).toBe('item-2')
      expect(result.reusePromptIds.length).toBe(0)
    })

    it('should handle empty server history', () => {
      const clientHistory = [
        createHistoryItem('item-1'),
        createHistoryItem('item-2')
      ]

      const result = reconcileHistoryCloud([], clientHistory, 10)

      expect(result.newItems).toHaveLength(0)
      expect(result.reusePromptIds.length).toBe(0)
    })

    it('should handle both empty', () => {
      const result = reconcileHistoryCloud([], [], 10)

      expect(result.newItems).toHaveLength(0)
      expect(result.reusePromptIds.length).toBe(0)
    })
  })
})
