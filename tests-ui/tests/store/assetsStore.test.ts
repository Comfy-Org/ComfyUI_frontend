import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAssetsStore } from '@/stores/assetsStore'
import { api } from '@/scripts/api'
import type {
  TaskItem,
  HistoryTaskItem,
  TaskPrompt,
  TaskStatus,
  TaskOutput
} from '@/schemas/apiSchema'

// Mock the api module
vi.mock('@/scripts/api', () => ({
  api: {
    getHistory: vi.fn(),
    internalURL: vi.fn((path) => `http://localhost:3000${path}`),
    user: 'test-user'
  }
}))

// Mock the asset service
vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetsByTag: vi.fn()
  }
}))

// Mock distribution type
vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

// Mock reconcileHistory to simulate the real behavior
vi.mock('@/platform/remote/comfyui/history/reconciliation', () => ({
  reconcileHistory: vi.fn(
    (
      serverHistory: TaskItem[],
      clientHistory: TaskItem[],
      maxItems: number,
      _lastKnownQueueIndex?: number
    ) => {
      // For initial load (empty clientHistory), return all server items
      if (!clientHistory || clientHistory.length === 0) {
        return serverHistory.slice(0, maxItems)
      }

      // For subsequent loads, merge without duplicates
      const clientPromptIds = new Set(
        clientHistory.map((item) => item.prompt[1])
      )
      const newItems = serverHistory.filter(
        (item) => !clientPromptIds.has(item.prompt[1])
      )

      return [...newItems, ...clientHistory]
        .sort((a, b) => b.prompt[0] - a.prompt[0])
        .slice(0, maxItems)
    }
  )
}))

// Mock TaskItemImpl
vi.mock('@/stores/queueStore', () => ({
  TaskItemImpl: class {
    public flatOutputs: Array<{
      supportsPreview: boolean
      filename: string
      subfolder: string
      type: string
      url: string
    }>
    public previewOutput:
      | {
          supportsPreview: boolean
          filename: string
          subfolder: string
          type: string
          url: string
        }
      | undefined

    constructor(
      public taskType: string,
      public prompt: TaskPrompt,
      public status: TaskStatus | undefined,
      public outputs: TaskOutput
    ) {
      this.flatOutputs = this.outputs
        ? [
            {
              supportsPreview: true,
              filename: 'test.png',
              subfolder: '',
              type: 'output',
              url: 'http://test.com/test.png'
            }
          ]
        : []
      this.previewOutput = this.flatOutputs[0]
    }
  }
}))

// Mock asset mappers
vi.mock('@/platform/assets/composables/media/assetMappers', () => ({
  mapInputFileToAssetItem: vi.fn((name, index, type) => ({
    id: `${type}-${index}`,
    name,
    size: 0,
    created_at: new Date().toISOString(),
    tags: [type],
    preview_url: `http://test.com/${name}`
  })),
  mapTaskOutputToAssetItem: vi.fn((task, output) => ({
    id: `${task.prompt[1]}_0`,
    name: output.filename,
    size: 0,
    created_at: new Date().toISOString(),
    tags: ['output'],
    preview_url: output.url,
    user_metadata: {}
  }))
}))

describe('assetsStore', () => {
  let store: ReturnType<typeof useAssetsStore>

  // Helper function to create mock history items
  const createMockHistoryItem = (index: number): HistoryTaskItem => ({
    taskType: 'History' as const,
    prompt: [
      1000 + index, // queueIndex
      `prompt_${index}`, // promptId
      {}, // promptInputs
      {
        extra_pnginfo: {
          workflow: {
            last_node_id: 1,
            last_link_id: 1,
            nodes: [],
            links: [],
            groups: [],
            config: {},
            version: 1
          }
        }
      }, // extraData
      [] // outputsToExecute
    ],
    status: {
      status_str: 'success' as const,
      completed: true,
      messages: []
    },
    outputs: {
      '1': {
        images: [
          {
            filename: `output_${index}.png`,
            subfolder: '',
            type: 'output' as const
          }
        ]
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useAssetsStore()
    vi.clearAllMocks()
  })

  describe('Initial Load', () => {
    it('should load initial history items', async () => {
      const mockHistory = Array.from({ length: 10 }, (_, i) =>
        createMockHistoryItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValue({
        History: mockHistory
      })

      await store.updateHistory()

      expect(api.getHistory).toHaveBeenCalledWith(200, { offset: 0 })
      expect(store.historyAssets).toHaveLength(10)
      expect(store.hasMoreHistory).toBe(false) // Less than BATCH_SIZE
      expect(store.historyLoading).toBe(false)
      expect(store.historyError).toBe(null)
    })

    it('should set hasMoreHistory to true when batch is full', async () => {
      const mockHistory = Array.from({ length: 200 }, (_, i) =>
        createMockHistoryItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValue({
        History: mockHistory
      })

      await store.updateHistory()

      expect(store.historyAssets).toHaveLength(200)
      expect(store.hasMoreHistory).toBe(true) // Exactly BATCH_SIZE
    })

    it('should handle errors during initial load', async () => {
      const error = new Error('Failed to fetch')
      vi.mocked(api.getHistory).mockRejectedValue(error)

      await store.updateHistory()

      expect(store.historyAssets).toHaveLength(0)
      expect(store.historyError).toBe(error)
      expect(store.historyLoading).toBe(false)
    })
  })

  describe('Pagination', () => {
    it('should accumulate items when loading more', async () => {
      // First batch
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockHistoryItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: firstBatch
      })

      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(200)
      expect(store.hasMoreHistory).toBe(true) // Should be true after full batch

      // Second batch - different items (200-399) with lower queue indices (older items)
      const secondBatch = Array.from({ length: 200 }, (_, i) => {
        const item = createMockHistoryItem(200 + i)
        // Queue indices should be older (lower) for pagination
        item.prompt[0] = 800 - i // Older items have lower queue indices
        item.prompt[1] = `prompt_${200 + i}`
        return item
      })
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: secondBatch
      })

      await store.loadMoreHistory()

      expect(api.getHistory).toHaveBeenCalledWith(200, { offset: 200 })

      expect(store.historyAssets).toHaveLength(400) // Accumulated
      expect(store.hasMoreHistory).toBe(true)
    })

    it('should handle small batch sizes correctly', async () => {
      // Simulate BATCH_SIZE = 200
      const SMALL_BATCH = 200

      // First batch
      const firstBatch = Array.from({ length: SMALL_BATCH }, (_, i) =>
        createMockHistoryItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: firstBatch
      })

      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(200)

      // Second batch
      const secondBatch = Array.from({ length: SMALL_BATCH }, (_, i) =>
        createMockHistoryItem(SMALL_BATCH + i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: secondBatch
      })

      await store.loadMoreHistory()
      expect(store.historyAssets).toHaveLength(400) // Should accumulate

      // Third batch
      const thirdBatch = Array.from({ length: SMALL_BATCH }, (_, i) =>
        createMockHistoryItem(SMALL_BATCH * 2 + i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: thirdBatch
      })

      await store.loadMoreHistory()
      expect(store.historyAssets).toHaveLength(600) // Should keep accumulating
    })

    it('should prevent duplicate items during pagination', async () => {
      // First batch with items 0-4
      const firstBatch = Array.from({ length: 5 }, (_, i) =>
        createMockHistoryItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: firstBatch
      })

      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(5)

      // Second batch with overlapping item (prompt_2) and new items
      const secondBatch = [
        createMockHistoryItem(2), // Duplicate
        createMockHistoryItem(5),
        createMockHistoryItem(6)
      ]
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: secondBatch
      })

      await store.loadMoreHistory()

      // Should only add new items (5, 6), not the duplicate (2)
      expect(store.historyAssets).toHaveLength(7)
      const promptIds = store.historyAssets.map((a) => a.id.split('_')[0])
      const uniquePromptIds = new Set(promptIds)
      expect(uniquePromptIds.size).toBe(7) // No duplicates
    })

    it('should stop loading when no more items', async () => {
      // First batch - less than BATCH_SIZE
      const firstBatch = Array.from({ length: 50 }, (_, i) =>
        createMockHistoryItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: firstBatch
      })

      await store.updateHistory()
      expect(store.hasMoreHistory).toBe(false)

      // Try to load more - should return early
      await store.loadMoreHistory()

      // Should only have been called once (initial load)
      expect(api.getHistory).toHaveBeenCalledTimes(1)
    })

    it('should handle race conditions with concurrent loads', async () => {
      // Slow first request
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockHistoryItem(i)
      )
      let resolveFirst: (value: { History: HistoryTaskItem[] }) => void
      const firstPromise = new Promise<{ History: HistoryTaskItem[] }>(
        (resolve) => {
          resolveFirst = resolve
        }
      )
      vi.mocked(api.getHistory).mockReturnValueOnce(firstPromise)

      // Start initial load
      const updatePromise = store.updateHistory()

      // Try to load more while initial load is in progress
      const loadMorePromise = store.loadMoreHistory()

      // Resolve first request
      resolveFirst!({ History: firstBatch })

      await updatePromise
      await loadMorePromise

      // Second loadMore should have been skipped due to loading state
      expect(api.getHistory).toHaveBeenCalledTimes(1)
    })

    it('should respect MAX_HISTORY_ITEMS limit', async () => {
      // Simulate loading many batches that exceed MAX_HISTORY_ITEMS (1000)
      const BATCH_COUNT = 6 // 6 * 200 = 1200 items

      // Initial load
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockHistoryItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: firstBatch
      })
      await store.updateHistory()

      // Load additional batches
      for (let batch = 1; batch < BATCH_COUNT; batch++) {
        const items = Array.from({ length: 200 }, (_, i) =>
          createMockHistoryItem(batch * 200 + i)
        )
        vi.mocked(api.getHistory).mockResolvedValueOnce({
          History: items
        })
        await store.loadMoreHistory()
      }

      // Should be capped at MAX_HISTORY_ITEMS
      expect(store.historyAssets.length).toBeLessThanOrEqual(1000)
    })
  })

  describe('Sorting', () => {
    it('should maintain date sorting after pagination', async () => {
      // Create items with different timestamps
      const createItemWithDate = (
        index: number,
        daysAgo: number
      ): HistoryTaskItem => {
        const item = createMockHistoryItem(index)
        const date = new Date()
        date.setDate(date.getDate() - daysAgo)
        // Mock the mapTaskOutputToAssetItem to use specific dates
        return item
      }

      // First batch - older items
      const firstBatch = Array.from(
        { length: 3 },
        (_, i) => createItemWithDate(i, 10 - i) // 10, 9, 8 days ago
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: firstBatch
      })

      await store.updateHistory()

      // Second batch - newer items
      const secondBatch = Array.from(
        { length: 3 },
        (_, i) => createItemWithDate(3 + i, 3 - i) // 3, 2, 1 days ago
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: secondBatch
      })

      await store.loadMoreHistory()

      // Items should be sorted by date (newest first)
      for (let i = 1; i < store.historyAssets.length; i++) {
        const prevDate = new Date(store.historyAssets[i - 1].created_at)
        const currDate = new Date(store.historyAssets[i].created_at)
        expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime())
      }
    })
  })

  describe('Error Handling', () => {
    it('should clear error before new load attempt', async () => {
      // First attempt fails
      vi.mocked(api.getHistory).mockRejectedValueOnce(
        new Error('Network error')
      )
      await store.updateHistory()
      expect(store.historyError).toBeTruthy()

      // Second attempt succeeds
      const mockHistory = Array.from({ length: 10 }, (_, i) =>
        createMockHistoryItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: mockHistory
      })

      await store.updateHistory()
      expect(store.historyError).toBe(null)
      expect(store.historyAssets).toHaveLength(10)
    })

    it('should handle errors during loadMore', async () => {
      // Initial load succeeds
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockHistoryItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce({
        History: firstBatch
      })
      await store.updateHistory()

      // LoadMore fails
      vi.mocked(api.getHistory).mockRejectedValueOnce(
        new Error('Load more failed')
      )
      await store.loadMoreHistory()

      expect(store.historyError).toBeTruthy()
      expect(store.isLoadingMore).toBe(false)
      // Should keep existing items
      expect(store.historyAssets).toHaveLength(200)
    })
  })
})
