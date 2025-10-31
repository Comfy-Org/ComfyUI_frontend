/**
 * @fileoverview Tests for history reconciliation (V1 and V2)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reconcileHistory } from '@/platform/remote/comfyui/history/reconciliation'
import type { TaskItem } from '@/schemas/apiSchema'

// Mock distribution types
vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isDesktop: true
}))

function createHistoryItem(promptId: string, queueIndex = 0): TaskItem {
  return {
    taskType: 'History',
    prompt: [queueIndex, promptId, {}, {}, []],
    status: { status_str: 'success', completed: true, messages: [] },
    outputs: {}
  }
}

function getAllPromptIds(result: TaskItem[]): string[] {
  return result.map((item) => item.prompt[1])
}

describe('reconcileHistory (V1)', () => {
  beforeEach(async () => {
    const distTypes = await import('@/platform/distribution/types')
    vi.mocked(distTypes).isCloud = false
  })

  describe('when filtering by queueIndex', () => {
    it('should retain items with queueIndex greater than lastKnownQueueIndex', () => {
      const serverHistory = [
        createHistoryItem('new-1', 11),
        createHistoryItem('new-2', 10),
        createHistoryItem('old', 5)
      ]
      const clientHistory = [createHistoryItem('old', 5)]

      const result = reconcileHistory(serverHistory, clientHistory, 10, 9)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(3)
      expect(promptIds).toContain('new-1')
      expect(promptIds).toContain('new-2')
      expect(promptIds).toContain('old')
    })

    it('should evict items with queueIndex less than or equal to lastKnownQueueIndex', () => {
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

    it('should retain all server items when lastKnownQueueIndex is undefined', () => {
      const serverHistory = [
        createHistoryItem('item-1', 5),
        createHistoryItem('item-2', 4)
      ]

      const result = reconcileHistory(serverHistory, [], 10, undefined)

      expect(result).toHaveLength(2)
      expect(result[0].prompt[1]).toBe('item-1')
      expect(result[1].prompt[1]).toBe('item-2')
    })
  })

  describe('when reconciling with existing client items', () => {
    it('should retain client items that still exist on server', () => {
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

    it('should evict client items that no longer exist on server', () => {
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

  describe('when limiting the result count', () => {
    it('should respect the maxItems constraint', () => {
      const serverHistory = Array.from({ length: 10 }, (_, i) =>
        createHistoryItem(`item-${i}`, 20 + i)
      )

      const result = reconcileHistory(serverHistory, [], 5, 15)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(5)
    })

    it('should evict lowest priority items when exceeding capacity', () => {
      const serverHistory = [
        createHistoryItem('new-1', 13),
        createHistoryItem('new-2', 12),
        createHistoryItem('new-3', 11),
        createHistoryItem('existing', 9)
      ]
      const clientHistory = [createHistoryItem('existing', 9)]

      const result = reconcileHistory(serverHistory, clientHistory, 2, 10)

      expect(result).toHaveLength(2)
      expect(result[0].prompt[1]).toBe('new-1')
      expect(result[1].prompt[1]).toBe('new-2')
    })
  })

  describe('when handling empty collections', () => {
    it('should return all server items when client history is empty', () => {
      const serverHistory = [
        createHistoryItem('item-1', 10),
        createHistoryItem('item-2', 9)
      ]

      const result = reconcileHistory(serverHistory, [], 10, 8)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(2)
    })

    it('should return empty result when server history is empty', () => {
      const clientHistory = [createHistoryItem('item-1', 5)]

      const result = reconcileHistory([], clientHistory, 10, 5)

      expect(result).toHaveLength(0)
    })

    it('should return empty result when both collections are empty', () => {
      const result = reconcileHistory([], [], 10, undefined)

      expect(result).toHaveLength(0)
    })
  })
})

describe('reconcileHistory (V2/Cloud)', () => {
  beforeEach(async () => {
    const distTypes = await import('@/platform/distribution/types')
    vi.mocked(distTypes).isCloud = true
  })

  describe('when adding new items from server', () => {
    it('should retain items with promptIds not present in client history', () => {
      const serverHistory = [
        createHistoryItem('new-item'),
        createHistoryItem('existing-item')
      ]
      const clientHistory = [createHistoryItem('existing-item')]

      const result = reconcileHistory(serverHistory, clientHistory, 10)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(2)
      expect(promptIds).toContain('new-item')
      expect(promptIds).toContain('existing-item')
    })

    it('should respect priority ordering when retaining multiple new items', () => {
      const serverHistory = [
        createHistoryItem('new-1'),
        createHistoryItem('new-2'),
        createHistoryItem('existing')
      ]
      const clientHistory = [createHistoryItem('existing')]

      const result = reconcileHistory(serverHistory, clientHistory, 10)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(3)
      expect(promptIds).toContain('new-1')
      expect(promptIds).toContain('new-2')
      expect(promptIds).toContain('existing')
    })
  })

  describe('when reconciling with existing client items', () => {
    it('should retain client items that still exist on server', () => {
      const serverHistory = [
        createHistoryItem('item-1'),
        createHistoryItem('item-2')
      ]
      const clientHistory = [
        createHistoryItem('item-1'),
        createHistoryItem('item-2')
      ]

      const result = reconcileHistory(serverHistory, clientHistory, 10)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(2)
      expect(promptIds).toContain('item-1')
      expect(promptIds).toContain('item-2')
    })

    it('should evict client items that no longer exist on server', () => {
      const serverHistory = [createHistoryItem('item-1')]
      const clientHistory = [
        createHistoryItem('item-1'),
        createHistoryItem('old-item')
      ]

      const result = reconcileHistory(serverHistory, clientHistory, 10)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(1)
      expect(promptIds).toContain('item-1')
      expect(promptIds).not.toContain('old-item')
    })
  })

  describe('when detecting new items by promptId', () => {
    it('should retain new items regardless of queueIndex values', () => {
      const serverHistory = [
        createHistoryItem('existing', 100),
        createHistoryItem('new-item', 50)
      ]
      const clientHistory = [createHistoryItem('existing', 100)]

      const result = reconcileHistory(serverHistory, clientHistory, 10)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toContain('new-item')
      expect(promptIds).toContain('existing')
    })
  })

  describe('when limiting the result count', () => {
    it('should respect the maxItems constraint', () => {
      const serverHistory = Array.from({ length: 10 }, (_, i) =>
        createHistoryItem(`server-${i}`)
      )
      const clientHistory = Array.from({ length: 5 }, (_, i) =>
        createHistoryItem(`client-${i}`)
      )

      const result = reconcileHistory(serverHistory, clientHistory, 5)

      const promptIds = getAllPromptIds(result)
      expect(promptIds).toHaveLength(5)
    })

    it('should evict lowest priority items when exceeding capacity', () => {
      const serverHistory = [
        createHistoryItem('new-1'),
        createHistoryItem('new-2'),
        createHistoryItem('existing')
      ]
      const clientHistory = [createHistoryItem('existing')]

      const result = reconcileHistory(serverHistory, clientHistory, 2)

      expect(result).toHaveLength(2)
      expect(result[0].prompt[1]).toBe('new-1')
      expect(result[1].prompt[1]).toBe('new-2')
    })
  })

  describe('when handling empty collections', () => {
    it('should return all server items when client history is empty', () => {
      const serverHistory = [
        createHistoryItem('item-1'),
        createHistoryItem('item-2')
      ]

      const result = reconcileHistory(serverHistory, [], 10)

      expect(result).toHaveLength(2)
      expect(result[0].prompt[1]).toBe('item-1')
      expect(result[1].prompt[1]).toBe('item-2')
    })

    it('should return empty result when server history is empty', () => {
      const clientHistory = [
        createHistoryItem('item-1'),
        createHistoryItem('item-2')
      ]

      const result = reconcileHistory([], clientHistory, 10)

      expect(result).toHaveLength(0)
    })

    it('should return empty result when both collections are empty', () => {
      const result = reconcileHistory([], [], 10)

      expect(result).toHaveLength(0)
    })
  })
})
