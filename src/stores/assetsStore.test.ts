import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'

import { useAssetsStore } from '@/stores/assetsStore'
import type {
  AssetItem,
  AssetResponse
} from '@/platform/assets/schemas/assetSchema'
import {
  JobsApiError,
  fetchHistoryPage
} from '@/platform/remote/comfyui/jobs/fetchJobs'
import type * as fetchJobsModule from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { FetchHistoryPageResult } from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { assetService } from '@/platform/assets/services/assetService'

// Mock the api module
vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    internalURL: vi.fn((path) => `http://localhost:3000${path}`),
    apiURL: vi.fn((path) => `http://localhost:3000/api${path}`),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    user: 'test-user'
  }
}))

// Mock the jobs API fetcher used for history pagination, keeping the real
// JobsApiError class so the store's instanceof narrowing stays meaningful
vi.mock('@/platform/remote/comfyui/jobs/fetchJobs', async (importOriginal) => ({
  ...(await importOriginal<typeof fetchJobsModule>()),
  fetchHistoryPage: vi.fn()
}))

// Helper to build a server pagination page around a set of jobs
const mockHistoryPage = (
  jobs: JobListItem[],
  {
    hasMore = false,
    nextCursor,
    offset = 0,
    total = jobs.length,
    limit = 200
  }: Partial<Omit<FetchHistoryPageResult, 'jobs'>> = {}
): FetchHistoryPageResult => ({
  jobs,
  total,
  offset,
  limit,
  hasMore,
  nextCursor
})

// Mock the asset service
vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetsByTag: vi.fn(),
    getAssetsPageByTag: vi.fn(),
    getAllAssetsByTag: vi.fn(),
    getAssetsForNodeType: vi.fn(),
    invalidateInputAssetsIncludingPublic: vi.fn(),
    updateAsset: vi.fn(),
    addAssetTags: vi.fn(),
    removeAssetTags: vi.fn()
  },
  INPUT_TAG: 'input',
  OUTPUT_TAG: 'output'
}))

// Mock distribution type - hoisted so it can be changed per test
const mockIsCloud = vi.hoisted(() => ({ value: false }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

// Mock modelToNodeStore with proper node providers and category lookups
vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({
    getAllNodeProviders: vi.fn((category: string) => {
      const providers: Record<
        string,
        Array<{ nodeDef: { name: string }; key: string }>
      > = {
        checkpoints: [
          { nodeDef: { name: 'CheckpointLoaderSimple' }, key: 'ckpt_name' },
          { nodeDef: { name: 'ImageOnlyCheckpointLoader' }, key: 'ckpt_name' }
        ],
        loras: [
          { nodeDef: { name: 'LoraLoader' }, key: 'lora_name' },
          { nodeDef: { name: 'LoraLoaderModelOnly' }, key: 'lora_name' }
        ],
        vae: [{ nodeDef: { name: 'VAELoader' }, key: 'vae_name' }]
      }
      return providers[category] ?? []
    }),
    getCategoryForNodeType: vi.fn((nodeType: string) => {
      const nodeToCategory: Record<string, string> = {
        CheckpointLoaderSimple: 'checkpoints',
        ImageOnlyCheckpointLoader: 'checkpoints',
        LoraLoader: 'loras',
        LoraLoaderModelOnly: 'loras',
        VAELoader: 'vae'
      }
      return nodeToCategory[nodeType]
    }),
    getNodeProvider: vi.fn(),
    registerDefaults: vi.fn()
  })
}))

type MockOutput = {
  supportsPreview: boolean
  filename: string
  subfolder: string
  type: string
  url: string
}

// Per-test override for mock outputs (defaults to single output)
const mockOutputOverrides = vi.hoisted(() => ({
  value: null as MockOutput[] | null
}))

// Mock TaskItemImpl
const PREVIEWABLE_MEDIA_TYPES = new Set(['images', 'video', 'audio'])

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
    public jobId: string
    public outputsCount: number | null

    constructor(public job: JobListItem) {
      this.jobId = job.id
      this.outputsCount = job.outputs_count ?? null
      if (mockOutputOverrides.value) {
        this.flatOutputs = mockOutputOverrides.value
        const previewable = mockOutputOverrides.value.filter(
          (o) => o.supportsPreview
        )
        this.previewOutput =
          previewable.findLast((o) => o.type === 'output') ?? previewable.at(-1)
      } else {
        const preview = job.preview_output
        const isPreviewable =
          !!preview?.filename && PREVIEWABLE_MEDIA_TYPES.has(preview.mediaType)
        if (preview && isPreviewable) {
          const item = {
            supportsPreview: true,
            filename: preview.filename!,
            subfolder: preview.subfolder ?? '',
            type: preview.type ?? 'output',
            url: `http://test.com/${preview.filename}`
          }
          this.flatOutputs = [item]
          this.previewOutput = item
        } else {
          this.flatOutputs = []
          this.previewOutput = undefined
        }
      }
    }

    get previewableOutputs() {
      return this.flatOutputs.filter((o) => o.supportsPreview)
    }
  }
}))

// Mock asset mappers - add unique timestamps
vi.mock('@/platform/assets/composables/media/assetMappers', () => ({
  mapInputFileToAssetItem: vi.fn((name, index, type) => ({
    id: `${type}-${index}`,
    name,
    size: 0,
    created_at: new Date(Date.now() - index * 1000).toISOString(),
    tags: [type],
    preview_url: `http://test.com/${name}`
  })),
  mapTaskOutputToAssetItem: vi.fn((task, output) => {
    const index = parseInt(task.jobId.split('_')[1]) || 0
    return {
      id: task.jobId,
      name: output.filename,
      size: 0,
      created_at: new Date(Date.now() - index * 1000).toISOString(),
      tags: ['output'],
      preview_url: output.url,
      user_metadata: {}
    }
  })
}))

describe('assetsStore - Refactored (Option A)', () => {
  let store: ReturnType<typeof useAssetsStore>

  // Helper function to create mock job items
  const createMockJobItem = (index: number): JobListItem => ({
    id: `prompt_${index}`,
    status: 'completed',
    create_time: 1000 + index,
    update_time: 1000 + index,
    last_state_update: 1000 + index,
    priority: 1000 + index,
    preview_output: {
      filename: `output_${index}.png`,
      subfolder: '',
      type: 'output',
      nodeId: 'node_1',
      mediaType: 'images'
    }
  })

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useAssetsStore()
    vi.clearAllMocks()
  })

  describe('Initial Load', () => {
    it('should load initial history items', async () => {
      const mockHistory = Array.from({ length: 10 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory)
      )

      await store.updateHistory()

      expect(fetchHistoryPage).toHaveBeenCalledWith(expect.any(Function), 200, {
        offset: 0
      })
      expect(store.historyAssets).toHaveLength(10)
      expect(store.hasMoreHistory).toBe(false) // Server reported no more pages
      expect(store.historyLoading).toBe(false)
      expect(store.historyError).toBe(null)
    })

    it('should set hasMoreHistory to true when server reports more pages', async () => {
      const mockHistory = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory, { hasMore: true })
      )

      await store.updateHistory()

      expect(store.historyAssets).toHaveLength(200)
      expect(store.hasMoreHistory).toBe(true)
    })

    it('should handle errors during initial load', async () => {
      const error = new Error('Failed to fetch')
      vi.mocked(fetchHistoryPage).mockRejectedValue(error)

      await store.updateHistory()

      expect(store.historyAssets).toHaveLength(0)
      expect(store.historyError).toBe(error)
      expect(store.historyLoading).toBe(false)
    })

    it('should skip text-only jobs without breaking sibling image jobs', async () => {
      const mockHistory: JobListItem[] = [
        createMockJobItem(0),
        {
          id: 'text-only-job',
          status: 'completed',
          create_time: 2000,
          priority: 2000,
          preview_output: {
            content: 'some generated text',
            nodeId: '5',
            mediaType: 'text'
          } satisfies JobListItem['preview_output']
        },
        createMockJobItem(2)
      ]
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory)
      )

      await store.updateHistory()

      expect(store.historyAssets).toHaveLength(2)
      expect(store.historyAssets.map((a) => a.id)).toEqual([
        'prompt_0',
        'prompt_2'
      ])
    })
  })

  describe('Pagination', () => {
    it('should accumulate items when loading more', async () => {
      // First batch - full BATCH_SIZE
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(firstBatch, { hasMore: true })
      )

      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(200)
      expect(store.hasMoreHistory).toBe(true)

      // Second batch - different items
      const secondBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(200 + i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(secondBatch, { hasMore: true })
      )

      await store.loadMoreHistory()

      // Offset fallback advances by the number of jobs the page returned
      expect(fetchHistoryPage).toHaveBeenCalledWith(expect.any(Function), 200, {
        offset: 200
      })
      expect(store.historyAssets).toHaveLength(400) // Accumulated
      expect(store.hasMoreHistory).toBe(true)
    })

    it('should prevent duplicate items during pagination', async () => {
      // First batch - full BATCH_SIZE
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(firstBatch, { hasMore: true })
      )

      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(200)

      // Second batch with some duplicates
      const secondBatch = [
        createMockJobItem(2), // Duplicate
        createMockJobItem(5), // Duplicate
        ...Array.from({ length: 198 }, (_, i) => createMockJobItem(200 + i)) // New
      ]
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(secondBatch)
      )

      await store.loadMoreHistory()

      // Should only add new items (198 new, 2 duplicates filtered)
      expect(store.historyAssets).toHaveLength(398)

      // Verify no duplicates
      const assetIds = store.historyAssets.map((a) => a.id)
      const uniqueAssetIds = new Set(assetIds)
      expect(uniqueAssetIds.size).toBe(store.historyAssets.length)
    })

    it('should stop loading when no more items', async () => {
      // Server reports no further pages
      const firstBatch = Array.from({ length: 50 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(firstBatch, { hasMore: false })
      )

      await store.updateHistory()
      expect(store.hasMoreHistory).toBe(false)

      // Try to load more - should return early
      await store.loadMoreHistory()

      // Should only have been called once (initial load)
      expect(fetchHistoryPage).toHaveBeenCalledTimes(1)
    })

    it('should handle race conditions with concurrent loads', async () => {
      // Setup initial state with full batch
      const initialBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(initialBatch, { hasMore: true })
      )
      await store.updateHistory()
      expect(store.hasMoreHistory).toBe(true)

      // Clear mock to count only loadMore calls
      vi.mocked(fetchHistoryPage).mockClear()

      // Setup slow API response
      let resolveLoadMore: (value: FetchHistoryPageResult) => void
      const loadMorePromise = new Promise<FetchHistoryPageResult>((resolve) => {
        resolveLoadMore = resolve
      })
      vi.mocked(fetchHistoryPage).mockReturnValueOnce(loadMorePromise)

      // Start first loadMore
      const firstLoad = store.loadMoreHistory()

      // Try concurrent load - should be ignored
      const secondLoad = store.loadMoreHistory()

      // Resolve
      const secondBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(200 + i)
      )
      resolveLoadMore!(mockHistoryPage(secondBatch, { hasMore: true }))

      await Promise.all([firstLoad, secondLoad])

      // Only one API call
      expect(fetchHistoryPage).toHaveBeenCalledTimes(1)
    })

    it('should respect MAX_HISTORY_ITEMS limit', async () => {
      const BATCH_COUNT = 6 // 6 × 200 = 1200 items

      // Initial load
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(firstBatch, { hasMore: true })
      )
      await store.updateHistory()

      // Load additional batches
      for (let batch = 1; batch < BATCH_COUNT; batch++) {
        const items = Array.from({ length: 200 }, (_, i) =>
          createMockJobItem(batch * 200 + i)
        )
        vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
          mockHistoryPage(items, { hasMore: true })
        )
        await store.loadMoreHistory()
      }

      // Should be capped at MAX_HISTORY_ITEMS (1000)
      expect(store.historyAssets).toHaveLength(1000)
    })
  })

  describe('Cursor pagination', () => {
    it('uses { after } for loadMore when the first page returned a cursor', async () => {
      const firstBatch = Array.from({ length: 10 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(firstBatch, { hasMore: true, nextCursor: 'cursor-1' })
      )
      await store.updateHistory()

      const secondBatch = Array.from({ length: 10 }, (_, i) =>
        createMockJobItem(10 + i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(secondBatch)
      )
      await store.loadMoreHistory()

      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        200,
        { after: 'cursor-1' }
      )
    })

    it('bootstraps from offset 0 then walks successive cursors', async () => {
      const pageJobs = (start: number) =>
        Array.from({ length: 10 }, (_, i) => createMockJobItem(start + i))
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(
          mockHistoryPage(pageJobs(0), {
            hasMore: true,
            nextCursor: 'cursor-1'
          })
        )
        .mockResolvedValueOnce(
          mockHistoryPage(pageJobs(10), {
            hasMore: true,
            nextCursor: 'cursor-2'
          })
        )
        .mockResolvedValueOnce(mockHistoryPage(pageJobs(20)))

      await store.updateHistory()
      await store.loadMoreHistory()
      await store.loadMoreHistory()

      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        1,
        expect.any(Function),
        200,
        { offset: 0 }
      )
      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        200,
        { after: 'cursor-1' }
      )
      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        3,
        expect.any(Function),
        200,
        { after: 'cursor-2' }
      )
      expect(store.historyAssets).toHaveLength(30)
    })

    it('falls back to offset paging advanced by returned job count when no cursor is minted', async () => {
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      const secondBatch = Array.from({ length: 150 }, (_, i) =>
        createMockJobItem(200 + i)
      )
      const thirdBatch = Array.from({ length: 10 }, (_, i) =>
        createMockJobItem(350 + i)
      )
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(mockHistoryPage(firstBatch, { hasMore: true }))
        .mockResolvedValueOnce(mockHistoryPage(secondBatch, { hasMore: true }))
        .mockResolvedValueOnce(mockHistoryPage(thirdBatch))

      await store.updateHistory()
      await store.loadMoreHistory()
      await store.loadMoreHistory()

      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        200,
        { offset: 200 }
      )
      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        3,
        expect.any(Function),
        200,
        { offset: 350 }
      )
    })

    it('stops loadMore when the server reports hasMore false despite a full batch', async () => {
      const fullBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(fullBatch, { hasMore: false })
      )

      await store.updateHistory()
      expect(store.hasMoreHistory).toBe(false)

      await store.loadMoreHistory()

      expect(fetchHistoryPage).toHaveBeenCalledTimes(1)
    })

    it('resets to { offset: 0 } on a full reload after a cursor walk', async () => {
      const pageJobs = (start: number) =>
        Array.from({ length: 10 }, (_, i) => createMockJobItem(start + i))
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(
          mockHistoryPage(pageJobs(0), {
            hasMore: true,
            nextCursor: 'cursor-1'
          })
        )
        .mockResolvedValueOnce(
          mockHistoryPage(pageJobs(10), {
            hasMore: true,
            nextCursor: 'cursor-2'
          })
        )
        .mockResolvedValueOnce(mockHistoryPage(pageJobs(0)))

      await store.updateHistory()
      await store.loadMoreHistory()
      await store.updateHistory()

      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        3,
        expect.any(Function),
        200,
        { offset: 0 }
      )
    })

    it('recovers from a rejected cursor by restarting from offset 0 (no drift)', async () => {
      const firstBatch = Array.from({ length: 10 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(
          mockHistoryPage(firstBatch, {
            hasMore: true,
            nextCursor: 'cursor-stale'
          })
        )
        .mockRejectedValueOnce(new JobsApiError(400, 'INVALID_CURSOR'))
        .mockResolvedValueOnce(
          mockHistoryPage(
            Array.from({ length: 10 }, (_, i) => createMockJobItem(10 + i)),
            { hasMore: true, nextCursor: 'cursor-fresh' }
          )
        )

      await store.updateHistory()
      await store.loadMoreHistory()

      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        200,
        { after: 'cursor-stale' }
      )
      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        3,
        expect.any(Function),
        200,
        { offset: 0 }
      )
      // List is replaced (not merged) so there are no duplicates from the reset
      expect(store.historyAssets).toHaveLength(10)
      expect(store.historyError).toBe(null)

      // The recovered page minted a fresh cursor, so the walk resumes in cursor mode
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(mockHistoryPage([]))
      await store.loadMoreHistory()
      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        4,
        expect.any(Function),
        200,
        { after: 'cursor-fresh' }
      )
    })

    it('keeps pagination resumable when the offset-0 retry also fails', async () => {
      const firstBatch = Array.from({ length: 10 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(
          mockHistoryPage(firstBatch, {
            hasMore: true,
            nextCursor: 'cursor-stale'
          })
        )
        .mockRejectedValueOnce(new JobsApiError(400, 'INVALID_CURSOR'))
        .mockRejectedValueOnce(new Error('network down'))

      await store.updateHistory()
      await store.loadMoreHistory()

      expect(store.historyError).toBeInstanceOf(Error)
      expect(store.hasMoreHistory).toBe(true)
      // historyAssets retains the last successful display state across a failed retry
      expect(store.historyAssets).toHaveLength(10)

      // The dropped cursor + reset offset means the next attempt restarts from 0
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(
          Array.from({ length: 5 }, (_, i) => createMockJobItem(i))
        )
      )
      await store.loadMoreHistory()
      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        4,
        expect.any(Function),
        200,
        { offset: 0 }
      )
      expect(store.historyAssets).toHaveLength(5)
    })

    it('releases isLoadingMore when the offset-0 recovery retry also fails, so the next scroll is not dropped', async () => {
      const firstBatch = Array.from({ length: 10 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(
          mockHistoryPage(firstBatch, {
            hasMore: true,
            nextCursor: 'cursor-stale'
          })
        )
        .mockRejectedValueOnce(new JobsApiError(400, 'INVALID_CURSOR'))
        .mockRejectedValueOnce(new Error('network down'))

      await store.updateHistory()
      await store.loadMoreHistory()

      // Recovery bumps the epoch, but loadMoreHistory re-syncs to that
      // self-recovery epoch, so the failure surfaces and the guard releases.
      expect(store.historyError).toBeInstanceOf(Error)
      expect(store.isLoadingMore).toBe(false)

      // A stuck isLoadingMore would silently drop this call; it must fetch.
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(
          Array.from({ length: 3 }, (_, i) => createMockJobItem(20 + i))
        )
      )
      await store.loadMoreHistory()
      expect(fetchHistoryPage).toHaveBeenCalledTimes(4)
      expect(store.historyError).toBe(null)
      expect(store.historyAssets).toHaveLength(3)
    })

    it('does not skip or duplicate rows when items are deleted server-side before cursor recovery', async () => {
      // Client loaded jobs 0-9 (10 items), then some were deleted server-side.
      // When the cursor is rejected, falling back to { offset: 10 } would skip
      // rows because the server now has fewer items before that position.
      // The fix resets to offset 0 and replaces the list.
      const firstBatch = Array.from({ length: 10 }, (_, i) =>
        createMockJobItem(i)
      )
      // Server-side: jobs 0, 3, 7 were deleted; remaining are 1,2,4,5,6,8,9 (7 items)
      // Cursor is rejected; fallback at offset 0 returns the current server state
      const serverStateAfterDeletions = [1, 2, 4, 5, 6, 8, 9].map((i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(
          mockHistoryPage(firstBatch, {
            hasMore: true,
            nextCursor: 'cursor-stale'
          })
        )
        .mockRejectedValueOnce(new JobsApiError(400, 'INVALID_CURSOR'))
        .mockResolvedValueOnce(mockHistoryPage(serverStateAfterDeletions))

      await store.updateHistory()
      await store.loadMoreHistory()

      // Fallback must restart from offset 0, not the stale client offset (10)
      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        3,
        expect.any(Function),
        200,
        { offset: 0 }
      )
      // List is replaced with the fresh server state — no skipped rows, no duplicates
      expect(store.historyAssets).toHaveLength(7)
      const ids = store.historyAssets.map((a) => a.id)
      expect(ids).not.toContain('prompt_0')
      expect(ids).not.toContain('prompt_3')
      expect(ids).not.toContain('prompt_7')
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('preserves the cursor when a transient error rejects the page', async () => {
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(
          mockHistoryPage(
            Array.from({ length: 10 }, (_, i) => createMockJobItem(i)),
            { hasMore: true, nextCursor: 'cursor-1' }
          )
        )
        .mockRejectedValueOnce(new JobsApiError(500, 'server error'))

      await store.updateHistory()
      await store.loadMoreHistory()

      // No offset fallback for transient failures, just a recorded error.
      // Asserting the concrete 500 guards the recover-vs-not classification:
      // only a 400 should drop to the offset fallback.
      expect(fetchHistoryPage).toHaveBeenCalledTimes(2)
      expect(store.historyError).toBeInstanceOf(JobsApiError)
      expect(store.historyError).toMatchObject({ status: 500 })
      expect(store.hasMoreHistory).toBe(true)

      // The still-valid cursor is retried on the next attempt
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(mockHistoryPage([]))
      await store.loadMoreHistory()
      expect(fetchHistoryPage).toHaveBeenLastCalledWith(
        expect.any(Function),
        200,
        { after: 'cursor-1' }
      )
    })

    it('treats a cursorless empty page as terminal even if the server claims more', async () => {
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage([], { hasMore: true })
      )

      await store.updateHistory()

      expect(store.hasMoreHistory).toBe(false)
      await store.loadMoreHistory()
      expect(fetchHistoryPage).toHaveBeenCalledTimes(1)
    })

    it('keeps paging when an empty page still mints a cursor', async () => {
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(
          mockHistoryPage([], { hasMore: true, nextCursor: 'cursor-skip' })
        )
        .mockResolvedValueOnce(mockHistoryPage([createMockJobItem(0)]))

      await store.updateHistory()
      expect(store.hasMoreHistory).toBe(true)

      await store.loadMoreHistory()
      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        200,
        { after: 'cursor-skip' }
      )
    })

    it('keeps paging when a page of jobs maps to no displayable assets', async () => {
      const failedJobs = Array.from({ length: 3 }, (_, i) => ({
        ...createMockJobItem(i),
        status: 'failed' as const,
        preview_output: null
      }))
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(failedJobs, { hasMore: true })
      )

      await store.updateHistory()

      expect(store.historyAssets).toHaveLength(0)
      expect(store.hasMoreHistory).toBe(true)
    })

    it('does not let a stale rejected continuation drop the new walk cursor', async () => {
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(
          Array.from({ length: 10 }, (_, i) => createMockJobItem(i)),
          { hasMore: true, nextCursor: 'cursor-old' }
        )
      )
      await store.updateHistory()

      let rejectStale: (err: Error) => void
      vi.mocked(fetchHistoryPage).mockReturnValueOnce(
        new Promise<FetchHistoryPageResult>((_, reject) => {
          rejectStale = reject
        })
      )
      const staleLoad = store.loadMoreHistory()

      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage([createMockJobItem(100)], {
          hasMore: true,
          nextCursor: 'cursor-fresh'
        })
      )
      await store.updateHistory()

      rejectStale!(new JobsApiError(400, 'INVALID_CURSOR'))
      await staleLoad

      // The superseded walk neither nulled the fresh cursor nor fired an
      // offset retry against the new walk, and must not surface a spurious error
      expect(store.historyError).toBeNull()
      expect(fetchHistoryPage).toHaveBeenCalledTimes(3)
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(mockHistoryPage([]))
      await store.loadMoreHistory()
      expect(fetchHistoryPage).toHaveBeenLastCalledWith(
        expect.any(Function),
        200,
        { after: 'cursor-fresh' }
      )
    })

    it('discards a stale loadMore continuation that resolves after a reset', async () => {
      const firstBatch = Array.from({ length: 10 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(firstBatch, { hasMore: true, nextCursor: 'cursor-1' })
      )
      await store.updateHistory()

      let resolveStale: (page: FetchHistoryPageResult) => void
      vi.mocked(fetchHistoryPage).mockReturnValueOnce(
        new Promise<FetchHistoryPageResult>((resolve) => {
          resolveStale = resolve
        })
      )
      const staleLoad = store.loadMoreHistory()

      const freshBatch = Array.from({ length: 5 }, (_, i) =>
        createMockJobItem(100 + i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(freshBatch, {
          hasMore: true,
          nextCursor: 'cursor-fresh'
        })
      )
      await store.updateHistory()

      resolveStale!(
        mockHistoryPage(
          Array.from({ length: 10 }, (_, i) => createMockJobItem(10 + i)),
          { hasMore: true, nextCursor: 'cursor-stale' }
        )
      )
      await staleLoad

      // The stale page neither merged into the fresh list nor moved its cursor
      expect(store.historyAssets).toHaveLength(5)
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(mockHistoryPage([]))
      await store.loadMoreHistory()
      expect(fetchHistoryPage).toHaveBeenLastCalledWith(
        expect.any(Function),
        200,
        { after: 'cursor-fresh' }
      )
    })

    it('does not blank historyAssets when a stale loadMore resolves mid-reload', async () => {
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(
          Array.from({ length: 10 }, (_, i) => createMockJobItem(i)),
          { hasMore: true, nextCursor: 'cursor-1' }
        )
      )
      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(10)

      let resolveStale: (page: FetchHistoryPageResult) => void
      vi.mocked(fetchHistoryPage).mockReturnValueOnce(
        new Promise<FetchHistoryPageResult>((resolve) => {
          resolveStale = resolve
        })
      )
      const staleLoad = store.loadMoreHistory()

      // Second reload is still in flight: it has reset allHistoryItems to []
      // and bumped the epoch, but has not repopulated historyAssets yet.
      let resolveFresh: (page: FetchHistoryPageResult) => void
      vi.mocked(fetchHistoryPage).mockReturnValueOnce(
        new Promise<FetchHistoryPageResult>((resolve) => {
          resolveFresh = resolve
        })
      )
      const freshUpdate = store.updateHistory()

      resolveStale!(
        mockHistoryPage([createMockJobItem(50)], {
          hasMore: true,
          nextCursor: 'cursor-stale'
        })
      )
      await staleLoad

      // The superseded loadMore must not overwrite the visible list with the
      // transient empty snapshot of the in-flight reload.
      expect(store.historyAssets).toHaveLength(10)

      resolveFresh!(
        mockHistoryPage(
          Array.from({ length: 5 }, (_, i) => createMockJobItem(100 + i)),
          { hasMore: true, nextCursor: 'cursor-fresh' }
        )
      )
      await freshUpdate
      expect(store.historyAssets).toHaveLength(5)
    })

    it('terminates the walk when the backend returns the same cursor it was given (stuck cursor)', async () => {
      // Page 1: initial load mints cursor-1
      const firstBatch = Array.from({ length: 10 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(firstBatch, { hasMore: true, nextCursor: 'cursor-1' })
      )
      await store.updateHistory()
      expect(store.hasMoreHistory).toBe(true)

      // Page 2: backend echoes back cursor-1 (same as the requested after),
      // with has_more:true and a non-empty page — the stuck-cursor shape.
      // Without the guard, mergeHistoryAssets dedupes every row and
      // hasMoreHistory stays true, causing an infinite spin.
      const stuckPage = Array.from(
        { length: 10 },
        (_, i) => createMockJobItem(i) // same ids as page 1 → all deduped
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(stuckPage, { hasMore: true, nextCursor: 'cursor-1' })
      )
      await store.loadMoreHistory()

      // Guard must have fired: hasMoreHistory forced off, cursor dropped
      expect(store.hasMoreHistory).toBe(false)

      // A subsequent loadMoreHistory must not issue another fetch
      await store.loadMoreHistory()
      expect(fetchHistoryPage).toHaveBeenCalledTimes(2)
    })
  })

  describe('refreshHistoryHead', () => {
    it('performs a full initial load when the list is empty', async () => {
      const jobs = Array.from({ length: 5 }, (_, i) => createMockJobItem(i))
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(mockHistoryPage(jobs))

      await store.refreshHistoryHead()

      expect(fetchHistoryPage).toHaveBeenCalledWith(expect.any(Function), 200, {
        offset: 0
      })
      expect(store.historyAssets).toHaveLength(5)
      expect(store.historyLoading).toBe(false)
    })

    it('prepends new completions without resetting the stored cursor', async () => {
      const initialJobs = [createMockJobItem(1), createMockJobItem(2)]
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(
          mockHistoryPage(initialJobs, {
            hasMore: true,
            nextCursor: 'cursor-1'
          })
        )
        .mockResolvedValueOnce(
          mockHistoryPage([createMockJobItem(0), createMockJobItem(1)], {
            hasMore: true,
            nextCursor: 'cursor-head'
          })
        )
        .mockResolvedValueOnce(mockHistoryPage([createMockJobItem(3)]))

      await store.updateHistory()
      await store.refreshHistoryHead()

      // Head page re-fetched from the top, new job prepended, existing kept
      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        200,
        { offset: 0 }
      )
      expect(store.historyAssets.map((a) => a.id)).toEqual([
        'prompt_0',
        'prompt_1',
        'prompt_2'
      ])

      // Subsequent loadMore still resumes from the pre-refresh cursor
      await store.loadMoreHistory()
      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        3,
        expect.any(Function),
        200,
        { after: 'cursor-1' }
      )
    })

    it('keeps existing items and records the error when the head fetch fails', async () => {
      const initialJobs = Array.from({ length: 3 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(initialJobs, { hasMore: true })
      )
      await store.updateHistory()

      const error = new Error('refresh failed')
      vi.mocked(fetchHistoryPage).mockRejectedValueOnce(error)

      await store.refreshHistoryHead()

      expect(store.historyAssets).toHaveLength(3)
      expect(store.historyError).toBe(error)
    })

    it('restarts the walk when the head page does not reach the loaded items', async () => {
      const overflowPage = () =>
        Array.from({ length: 200 }, (_, i) => createMockJobItem(1000 + i))
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(
          mockHistoryPage(
            Array.from({ length: 10 }, (_, i) => createMockJobItem(i)),
            { hasMore: true, nextCursor: 'cursor-1' }
          )
        )
        .mockResolvedValueOnce(
          mockHistoryPage(overflowPage(), {
            hasMore: true,
            nextCursor: 'cursor-head'
          })
        )
        .mockResolvedValueOnce(
          mockHistoryPage(overflowPage(), {
            hasMore: true,
            nextCursor: 'cursor-head-2'
          })
        )

      await store.updateHistory()
      await store.refreshHistoryHead()

      // No overlap with loaded items while more rows remain means merging
      // would leave an unfillable hole, so the walk restarts from the top
      expect(fetchHistoryPage).toHaveBeenCalledTimes(3)
      expect(fetchHistoryPage).toHaveBeenNthCalledWith(
        3,
        expect.any(Function),
        200,
        { offset: 0 }
      )
      expect(store.historyAssets).toHaveLength(200)
      expect(store.historyAssets.some((asset) => asset.id === 'prompt_0')).toBe(
        false
      )
    })

    it('rebuilds from the head page in offset mode so the next page request does not drift', async () => {
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      const secondBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(200 + i)
      )
      const headPage = [
        createMockJobItem(400),
        ...Array.from({ length: 199 }, (_, i) => createMockJobItem(i))
      ]
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(mockHistoryPage(firstBatch, { hasMore: true }))
        .mockResolvedValueOnce(mockHistoryPage(secondBatch, { hasMore: true }))
        .mockResolvedValueOnce(mockHistoryPage(headPage, { hasMore: true }))
        .mockResolvedValueOnce(mockHistoryPage([], { hasMore: false }))

      await store.updateHistory()
      await store.loadMoreHistory()
      await store.refreshHistoryHead()

      // The new completion is surfaced, and rows below the head page are
      // dropped because offset paging can't safely keep them once the
      // timeline shifts.
      expect(store.historyAssets.some((a) => a.id === 'prompt_400')).toBe(true)
      expect(store.historyAssets.some((a) => a.id === 'prompt_399')).toBe(false)

      await store.loadMoreHistory()

      // historyOffset was rebuilt to the head page length (200), not left at
      // the pre-refresh 400 that the shifted timeline would have skipped past.
      expect(fetchHistoryPage).toHaveBeenLastCalledWith(
        expect.any(Function),
        200,
        { offset: 200 }
      )
    })

    it('preserves the loaded terminal pages when a completion arrives after the cursor is exhausted', async () => {
      vi.mocked(fetchHistoryPage)
        // Initial page mints a cursor (keyset mode) and reports more rows.
        .mockResolvedValueOnce(
          mockHistoryPage([createMockJobItem(2), createMockJobItem(3)], {
            hasMore: true,
            nextCursor: 'cursor-1'
          })
        )
        // Load-more walks to the terminal page: no cursor, no more rows.
        .mockResolvedValueOnce(
          mockHistoryPage([createMockJobItem(0), createMockJobItem(1)], {
            hasMore: false
          })
        )
        // A new completion refreshes the head; hasMore is true again and the
        // page overlaps the loaded items, but the stored cursor is now null.
        .mockResolvedValueOnce(
          mockHistoryPage(
            [createMockJobItem(4), createMockJobItem(2), createMockJobItem(3)],
            { hasMore: true }
          )
        )

      await store.updateHistory()
      await store.loadMoreHistory()
      expect(store.hasMoreHistory).toBe(false)

      await store.refreshHistoryHead()

      // The exhausted cursor must not be mistaken for offset-fallback mode: the
      // already-loaded terminal pages survive and the new completion is added.
      const ids = store.historyAssets.map((a) => a.id)
      expect(ids).toContain('prompt_0')
      expect(ids).toContain('prompt_1')
      expect(ids).toContain('prompt_4')
      expect(new Set(ids).size).toBe(5)
    })

    it('coalesces a burst into a leading fetch plus one trailing refresh', async () => {
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage([createMockJobItem(0)], {
          hasMore: true,
          nextCursor: 'cursor-1'
        })
      )
      await store.updateHistory()

      let resolveLeading: (page: FetchHistoryPageResult) => void
      vi.mocked(fetchHistoryPage).mockReturnValueOnce(
        new Promise<FetchHistoryPageResult>((resolve) => {
          resolveLeading = resolve
        })
      )

      const first = store.refreshHistoryHead()
      const second = store.refreshHistoryHead()
      const third = store.refreshHistoryHead()

      // The trailing refresh re-fetches the head and sees the job the
      // leading response was dispatched too early to include
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage([createMockJobItem(0), createMockJobItem(1)], {
          hasMore: true
        })
      )
      resolveLeading!(
        mockHistoryPage([createMockJobItem(0)], { hasMore: true })
      )
      await Promise.all([first, second, third])

      // Initial load + leading head fetch + exactly one trailing head fetch
      expect(fetchHistoryPage).toHaveBeenCalledTimes(3)
      expect(store.historyAssets).toHaveLength(2)
    })

    it('runs a fresh fetch for sequential refreshes', async () => {
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage([createMockJobItem(0)], { hasMore: true })
      )
      await store.updateHistory()

      await store.refreshHistoryHead()
      await store.refreshHistoryHead()

      expect(fetchHistoryPage).toHaveBeenCalledTimes(3)
    })

    it('prunes server-side deletions when the head page spans the whole timeline', async () => {
      vi.mocked(fetchHistoryPage)
        .mockResolvedValueOnce(
          mockHistoryPage([
            createMockJobItem(0),
            createMockJobItem(1),
            createMockJobItem(2)
          ])
        )
        .mockResolvedValueOnce(
          mockHistoryPage([createMockJobItem(0), createMockJobItem(2)])
        )

      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(3)

      await store.refreshHistoryHead()

      expect(store.historyAssets.map((asset) => asset.id)).toEqual([
        'prompt_0',
        'prompt_2'
      ])
    })

    it('does not restart the walk when the head page overlaps only previously loaded non-asset jobs', async () => {
      const failedJob = (index: number): JobListItem => ({
        ...createMockJobItem(index),
        status: 'failed' as const,
        preview_output: null
      })

      // Initial page: one displayable asset plus a failed job that maps to no
      // asset but is still part of the loaded timeline.
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage([createMockJobItem(0), failedJob(1)], {
          hasMore: true,
          nextCursor: 'cursor-1'
        })
      )
      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(1)

      // Head refresh returns a burst of failed jobs; the only overlap with the
      // loaded timeline is the previously seen failed job, which never entered
      // the displayable-asset set.
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage([failedJob(2), failedJob(1)], { hasMore: true })
      )
      await store.refreshHistoryHead()

      // Gap detection must recognise the overlap and merge, not trigger a full
      // reload (which would refetch from offset 0 and drop scroll position).
      expect(fetchHistoryPage).toHaveBeenCalledTimes(2)
      expect(store.historyAssets.map((a) => a.id)).toEqual(['prompt_0'])
    })

    it('discards a stale head refresh when a reset bumps the epoch mid-flight', async () => {
      const firstBatch = Array.from({ length: 10 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(firstBatch, { hasMore: true, nextCursor: 'cursor-1' })
      )
      await store.updateHistory()

      let resolveHead: (page: FetchHistoryPageResult) => void
      vi.mocked(fetchHistoryPage).mockReturnValueOnce(
        new Promise<FetchHistoryPageResult>((resolve) => {
          resolveHead = resolve
        })
      )
      const staleRefresh = store.refreshHistoryHead()

      // A concurrent full reload bumps the fetch epoch while the head fetch is
      // still in flight.
      const freshBatch = Array.from({ length: 5 }, (_, i) =>
        createMockJobItem(100 + i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(freshBatch)
      )
      await store.updateHistory()

      // The now-stale head page resolves with pre-reset data.
      resolveHead!(
        mockHistoryPage(
          Array.from({ length: 10 }, (_, i) => createMockJobItem(i)),
          { hasMore: true }
        )
      )
      await staleRefresh

      // Epoch guard must drop the stale head result so only the reload survives.
      expect(store.historyAssets.map((a) => a.id)).toEqual([
        'prompt_100',
        'prompt_101',
        'prompt_102',
        'prompt_103',
        'prompt_104'
      ])
    })

    it('discards a concurrent head refresh when cursor recovery resets the walk mid-flight', async () => {
      const firstBatch = Array.from({ length: 10 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(firstBatch, { hasMore: true, nextCursor: 'cursor-1' })
      )
      await store.updateHistory()

      // A head refresh captures the current epoch and issues its offset-0 fetch.
      let resolveHead: (page: FetchHistoryPageResult) => void
      vi.mocked(fetchHistoryPage).mockReturnValueOnce(
        new Promise<FetchHistoryPageResult>((resolve) => {
          resolveHead = resolve
        })
      )
      const refresh = store.refreshHistoryHead()

      // Concurrently, a loadMore's cursor is rejected; recovery resets the list
      // and — with the fix — bumps the epoch so the in-flight head refresh is
      // superseded. The offset-0 recovery retry returns a fresh page.
      const recoveredBatch = Array.from({ length: 5 }, (_, i) =>
        createMockJobItem(100 + i)
      )
      vi.mocked(fetchHistoryPage)
        .mockRejectedValueOnce(new JobsApiError(400, 'INVALID_CURSOR'))
        .mockResolvedValueOnce(mockHistoryPage(recoveredBatch))
      await store.loadMoreHistory()

      expect(store.historyAssets.map((a) => a.id)).toEqual([
        'prompt_100',
        'prompt_101',
        'prompt_102',
        'prompt_103',
        'prompt_104'
      ])

      // The now-stale head page resolves against the epoch it captured before
      // recovery; the guard must drop it instead of clobbering the recovered
      // list or triggering a spurious full reload.
      resolveHead!(mockHistoryPage(firstBatch, { hasMore: true }))
      await refresh

      expect(store.historyAssets.map((a) => a.id)).toEqual([
        'prompt_100',
        'prompt_101',
        'prompt_102',
        'prompt_103',
        'prompt_104'
      ])
      expect(fetchHistoryPage).toHaveBeenCalledTimes(4)
    })
  })

  describe('Sorting', () => {
    it('should maintain date sorting after pagination', async () => {
      // First batch
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(firstBatch, { hasMore: true })
      )

      await store.updateHistory()

      // Second batch
      const secondBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(200 + i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(secondBatch)
      )

      await store.loadMoreHistory()

      // Verify sorting (newest first - lower index = newer)
      for (let i = 1; i < store.historyAssets.length; i++) {
        const prevDate = new Date(store.historyAssets[i - 1].created_at ?? 0)
        const currDate = new Date(store.historyAssets[i].created_at ?? 0)
        expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime())
      }
    })
  })

  describe('Error Handling', () => {
    it('should preserve existing data when loadMore fails', async () => {
      // First successful load - full batch
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(firstBatch, { hasMore: true })
      )

      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(200)

      // Second load fails
      const error = new Error('Network error')
      vi.mocked(fetchHistoryPage).mockRejectedValueOnce(error)

      await store.loadMoreHistory()

      // Should keep existing data
      expect(store.historyAssets).toHaveLength(200)
      expect(store.historyError).toBe(error)
      expect(store.isLoadingMore).toBe(false)
    })

    it('should clear error state on successful retry', async () => {
      // First load succeeds
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(firstBatch, { hasMore: true })
      )

      await store.updateHistory()

      // Second load fails
      const error = new Error('Network error')
      vi.mocked(fetchHistoryPage).mockRejectedValueOnce(error)

      await store.loadMoreHistory()
      expect(store.historyError).toBe(error)

      // Third load succeeds
      const thirdBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(200 + i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
        mockHistoryPage(thirdBatch)
      )

      await store.loadMoreHistory()

      // Error should be cleared
      expect(store.historyError).toBe(null)
      expect(store.historyAssets).toHaveLength(400)
    })

    it('should handle errors with proper loading state', async () => {
      const error = new Error('API error')
      vi.mocked(fetchHistoryPage).mockRejectedValue(error)

      await store.updateHistory()

      expect(store.historyLoading).toBe(false)
      expect(store.historyError).toBe(error)
    })
  })

  describe('Memory Management', () => {
    it('should cleanup when exceeding MAX_HISTORY_ITEMS', async () => {
      // Load 1200 items (exceeds 1000 limit)
      const batches = 6

      for (let batch = 0; batch < batches; batch++) {
        const items = Array.from({ length: 200 }, (_, i) =>
          createMockJobItem(batch * 200 + i)
        )
        vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
          mockHistoryPage(items, { hasMore: true })
        )

        if (batch === 0) {
          await store.updateHistory()
        } else {
          await store.loadMoreHistory()
        }
      }

      // Should be limited to 1000
      expect(store.historyAssets).toHaveLength(1000)

      // All items should be unique (Set cleanup works)
      const assetIds = store.historyAssets.map((a) => a.id)
      const uniqueAssetIds = new Set(assetIds)
      expect(uniqueAssetIds.size).toBe(1000)
    })

    it('should maintain correct state after cleanup', async () => {
      // Load items beyond limit
      for (let batch = 0; batch < 6; batch++) {
        const items = Array.from({ length: 200 }, (_, i) =>
          createMockJobItem(batch * 200 + i)
        )
        vi.mocked(fetchHistoryPage).mockResolvedValueOnce(
          mockHistoryPage(items, { hasMore: true })
        )

        if (batch === 0) {
          await store.updateHistory()
        } else {
          await store.loadMoreHistory()
        }
      }

      expect(store.historyAssets).toHaveLength(1000)

      // Should still maintain sorting
      for (let i = 1; i < store.historyAssets.length; i++) {
        const prevDate = new Date(store.historyAssets[i - 1].created_at ?? 0)
        const currDate = new Date(store.historyAssets[i].created_at ?? 0)
        expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime())
      }
    })
  })

  describe('setAssetPreview', () => {
    it('patches preview_id and preview_url on the matching history asset by name', async () => {
      const mockHistory = Array.from({ length: 3 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory)
      )
      await store.updateHistory()

      const target = store.historyAssets[1]
      const targetName = target.name

      store.setAssetPreview(
        targetName,
        'preview-xyz',
        '/assets/preview-xyz/content'
      )

      const updated = store.historyAssets.find((a) => a.name === targetName)
      expect(updated?.preview_id).toBe('preview-xyz')
      expect(updated?.preview_url).toBe('/assets/preview-xyz/content')
    })

    it('matches by name even when ids differ between APIs', async () => {
      const mockHistory = [createMockJobItem(0)]
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory)
      )
      await store.updateHistory()

      const historyAssetId = store.historyAssets[0].id
      const targetName = store.historyAssets[0].name

      // Simulate the cloud-api side using a different id space
      store.setAssetPreview(targetName, 'p1', '/assets/p1/content')

      expect(store.historyAssets[0].id).toBe(historyAssetId)
      expect(store.historyAssets[0].preview_id).toBe('p1')
      expect(store.historyAssets[0].preview_url).toBe('/assets/p1/content')
    })

    it('does nothing when no asset with that name is loaded', async () => {
      const mockHistory = Array.from({ length: 2 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory)
      )
      await store.updateHistory()

      const before = store.historyAssets.map((a) => ({ ...a }))
      store.setAssetPreview('does-not-exist.glb', 'p', '/p')

      expect(store.historyAssets).toEqual(before)
    })

    it('only patches the asset whose name matches exactly', async () => {
      const mockHistory = Array.from({ length: 3 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory)
      )
      await store.updateHistory()

      // Patch using a non-matching prefix; the other assets must stay untouched
      store.setAssetPreview('output_1', 'p', '/p')

      for (const asset of store.historyAssets) {
        expect(asset.preview_id).toBeUndefined()
      }
    })

    it('replaces the asset object so reactivity fires for v-for keyed by id', async () => {
      const mockHistory = [createMockJobItem(0)]
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory)
      )
      await store.updateHistory()

      const before = store.historyAssets[0]
      const targetName = before.name

      store.setAssetPreview(targetName, 'p', '/p')

      // setAssetPreview replaces the item with a new object via list[idx] = {...}
      // (rather than mutating in place) so Vue triggers dependent watchers.
      expect(store.historyAssets[0]).not.toBe(before)
    })
  })

  describe('jobDetailView Support', () => {
    it('should include outputCount and allOutputs in user_metadata', async () => {
      const mockHistory = Array.from({ length: 5 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory)
      )

      await store.updateHistory()

      // Check first asset
      const asset = store.historyAssets[0]
      expect(asset.user_metadata).toBeDefined()
      expect(asset.user_metadata).toHaveProperty('outputCount')
      expect(asset.user_metadata).toHaveProperty('allOutputs')
      expect(Array.isArray(asset.user_metadata!.allOutputs)).toBe(true)
    })
  })

  describe('Cover Image Selection', () => {
    afterEach(() => {
      mockOutputOverrides.value = null
    })

    it('should use the last saved output as cover for multi-output batches', async () => {
      mockOutputOverrides.value = [
        {
          supportsPreview: true,
          filename: 'batch_00001.png',
          subfolder: '',
          type: 'output',
          url: 'http://test.com/batch_00001.png'
        },
        {
          supportsPreview: true,
          filename: 'batch_00005.png',
          subfolder: '',
          type: 'output',
          url: 'http://test.com/batch_00005.png'
        },
        {
          supportsPreview: true,
          filename: 'batch_00010.png',
          subfolder: '',
          type: 'output',
          url: 'http://test.com/batch_00010.png'
        }
      ]

      const mockHistory = [createMockJobItem(0)]
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory)
      )

      await store.updateHistory()

      expect(store.historyAssets).toHaveLength(1)
      // Cover should be the last output (most recent in batch)
      expect(store.historyAssets[0].name).toBe('batch_00010.png')
    })

    it('should prefer last saved output over temp previews', async () => {
      mockOutputOverrides.value = [
        {
          supportsPreview: true,
          filename: 'saved_first.png',
          subfolder: '',
          type: 'output',
          url: 'http://test.com/saved_first.png'
        },
        {
          supportsPreview: true,
          filename: 'saved_last.png',
          subfolder: '',
          type: 'output',
          url: 'http://test.com/saved_last.png'
        },
        {
          supportsPreview: true,
          filename: 'temp_preview.png',
          subfolder: '',
          type: 'temp',
          url: 'http://test.com/temp_preview.png'
        }
      ]

      const mockHistory = [createMockJobItem(0)]
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory)
      )

      await store.updateHistory()

      expect(store.historyAssets).toHaveLength(1)
      // Should pick last saved output, not the temp preview
      expect(store.historyAssets[0].name).toBe('saved_last.png')
    })

    it('should fall back to last temp output when no saved outputs exist', async () => {
      mockOutputOverrides.value = [
        {
          supportsPreview: true,
          filename: 'temp_first.png',
          subfolder: '',
          type: 'temp',
          url: 'http://test.com/temp_first.png'
        },
        {
          supportsPreview: true,
          filename: 'temp_last.png',
          subfolder: '',
          type: 'temp',
          url: 'http://test.com/temp_last.png'
        }
      ]

      const mockHistory = [createMockJobItem(0)]
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory)
      )

      await store.updateHistory()

      expect(store.historyAssets).toHaveLength(1)
      // No saved outputs, should fall back to last previewable
      expect(store.historyAssets[0].name).toBe('temp_last.png')
    })

    it('should skip jobs with no previewable outputs', async () => {
      mockOutputOverrides.value = [
        {
          supportsPreview: false,
          filename: 'not_previewable.dat',
          subfolder: '',
          type: 'output',
          url: 'http://test.com/not_previewable.dat'
        }
      ]

      const mockHistory = [createMockJobItem(0)]
      vi.mocked(fetchHistoryPage).mockResolvedValue(
        mockHistoryPage(mockHistory)
      )

      await store.updateHistory()

      // No previewable outputs → job should be skipped
      expect(store.historyAssets).toHaveLength(0)
    })
  })
})

describe('assetsStore - Model Assets Cache (Cloud)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockIsCloud.value = true
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockIsCloud.value = false
  })

  const createMockAsset = (id: string, tags: string[] = ['models']) => ({
    id,
    name: `asset-${id}`,
    size: 100,
    created_at: new Date().toISOString(),
    tags,
    preview_url: `http://test.com/${id}`
  })

  describe('getAssets cache invalidation', () => {
    it('should invalidate cache before mutating assets during batch loading', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      const firstBatch = Array.from({ length: 500 }, (_, i) =>
        createMockAsset(`asset-${i}`)
      )
      const secondBatch = Array.from({ length: 100 }, (_, i) =>
        createMockAsset(`asset-${500 + i}`)
      )

      let callCount = 0
      vi.mocked(assetService.getAssetsForNodeType).mockImplementation(
        async () => {
          callCount++
          return callCount === 1 ? firstBatch : secondBatch
        }
      )

      await store.updateModelsForNodeType(nodeType)

      // Wait for background batch loading to complete
      await vi.waitFor(() => {
        expect(
          vi.mocked(assetService.getAssetsForNodeType)
        ).toHaveBeenCalledTimes(2)
      })

      const assets = store.getAssets(nodeType)
      expect(assets).toHaveLength(600)
    })

    it('should not return stale cached array after background batch completes', async () => {
      const store = useAssetsStore()
      const nodeType = 'LoraLoader'

      // First batch must be exactly MODEL_BATCH_SIZE (500) to trigger hasMore
      const firstBatch = Array.from({ length: 500 }, (_, i) =>
        createMockAsset(`first-${i}`)
      )
      const secondBatch = [createMockAsset('new-asset')]

      let callCount = 0
      vi.mocked(assetService.getAssetsForNodeType).mockImplementation(
        async () => {
          callCount++
          return callCount === 1 ? firstBatch : secondBatch
        }
      )

      await store.updateModelsForNodeType(nodeType)

      // Wait for background batch loading to complete
      await vi.waitFor(() => {
        expect(
          vi.mocked(assetService.getAssetsForNodeType)
        ).toHaveBeenCalledTimes(2)
      })

      const assets = store.getAssets(nodeType)
      expect(assets).toHaveLength(501)
      expect(assets.map((a) => a.id)).toContain('new-asset')
    })

    it('should return cached array on subsequent getAssets calls', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'
      const assets = [createMockAsset('cache-test-1')]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue(assets)
      await store.updateModelsForNodeType(nodeType)

      const firstCall = store.getAssets(nodeType)
      const secondCall = store.getAssets(nodeType)

      expect(secondCall).toBe(firstCall)
      expect(firstCall).toHaveLength(1)
    })
  })

  describe('concurrent request handling', () => {
    it('should short-circuit concurrent calls to prevent duplicate work', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'
      const firstBatch = Array.from({ length: 5 }, (_, i) =>
        createMockAsset(`first-${i}`)
      )

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue(firstBatch)

      // Start two concurrent requests for the same category
      const firstRequest = store.updateModelsForNodeType(nodeType)
      const secondRequest = store.updateModelsForNodeType(nodeType)
      await Promise.all([firstRequest, secondRequest])

      // Second request should be short-circuited, only one API call made
      expect(
        vi.mocked(assetService.getAssetsForNodeType)
      ).toHaveBeenCalledTimes(1)
      expect(store.getAssets(nodeType)).toHaveLength(5)
    })

    it('should allow new request after previous completes', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'
      const firstBatch = [createMockAsset('first-1')]
      const secondBatch = [
        createMockAsset('second-1'),
        createMockAsset('second-2')
      ]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce(
        firstBatch
      )
      await store.updateModelsForNodeType(nodeType)
      expect(store.getAssets(nodeType)).toHaveLength(1)

      // After first completes, a new request should work
      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce(
        secondBatch
      )
      store.invalidateCategory('checkpoints')
      await store.updateModelsForNodeType(nodeType)

      expect(store.getAssets(nodeType)).toHaveLength(2)
      expect(
        vi.mocked(assetService.getAssetsForNodeType)
      ).toHaveBeenCalledTimes(2)
    })
  })

  describe('shallowReactive state reactivity', () => {
    it('should trigger reactivity on isModelLoading change', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      const loadingStates: boolean[] = []
      watch(
        () => store.isModelLoading(nodeType),
        (val) => loadingStates.push(val),
        { immediate: true }
      )

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue([])
      await store.updateModelsForNodeType(nodeType)
      await nextTick()

      expect(loadingStates).toContain(true)
      expect(loadingStates).toContain(false)
    })
  })

  describe('category-keyed cache', () => {
    it('should share cache between node types of the same category', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('shared-1'), createMockAsset('shared-2')]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue(assets)

      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      expect(store.getAssets('CheckpointLoaderSimple')).toHaveLength(2)
      expect(store.getAssets('ImageOnlyCheckpointLoader')).toHaveLength(2)
      expect(
        vi.mocked(assetService.getAssetsForNodeType)
      ).toHaveBeenCalledTimes(1)
    })

    it('should return empty array for unknown node types', () => {
      const store = useAssetsStore()
      expect(store.getAssets('UnknownNodeType')).toEqual([])
    })

    it('should not fetch for unknown node types', async () => {
      const store = useAssetsStore()
      await store.updateModelsForNodeType('UnknownNodeType')
      expect(
        vi.mocked(assetService.getAssetsForNodeType)
      ).not.toHaveBeenCalled()
    })
  })

  describe('invalidateCategory', () => {
    it('should clear cache for a category', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('asset-1'), createMockAsset('asset-2')]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue(assets)
      await store.updateModelsForNodeType('CheckpointLoaderSimple')
      expect(store.getAssets('CheckpointLoaderSimple')).toHaveLength(2)

      store.invalidateCategory('checkpoints')

      expect(store.getAssets('CheckpointLoaderSimple')).toEqual([])
      expect(store.hasAssetKey('CheckpointLoaderSimple')).toBe(false)
    })

    it('should allow refetch after invalidation', async () => {
      const store = useAssetsStore()
      const initialAssets = [createMockAsset('initial-1')]
      const refreshedAssets = [
        createMockAsset('refreshed-1'),
        createMockAsset('refreshed-2')
      ]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce(
        initialAssets
      )
      await store.updateModelsForNodeType('LoraLoader')
      expect(store.getAssets('LoraLoader')).toHaveLength(1)

      store.invalidateCategory('loras')

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce(
        refreshedAssets
      )
      await store.updateModelsForNodeType('LoraLoader')

      expect(store.getAssets('LoraLoader')).toHaveLength(2)
    })

    it('should invalidate tag-based caches', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('tag-asset-1')]

      vi.mocked(assetService.getAssetsByTag).mockResolvedValue(assets)
      await store.updateModelsForTag('models')
      expect(store.getAssets('tag:models')).toHaveLength(1)

      store.invalidateCategory('tag:models')

      expect(store.getAssets('tag:models')).toEqual([])
    })
  })

  describe('hasCategory', () => {
    it('should return true for loaded categories', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('asset-1')]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue(assets)
      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      expect(store.hasCategory('checkpoints')).toBe(true)
    })

    it('should return true for tag-based category when tag: prefix is not used', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('asset-1')]

      vi.mocked(assetService.getAssetsByTag).mockResolvedValue(assets)
      await store.updateModelsForTag('models')

      // hasCategory('models') checks for both 'models' and 'tag:models'
      expect(store.hasCategory('models')).toBe(true)
    })

    it('should return false for unloaded categories', () => {
      const store = useAssetsStore()

      expect(store.hasCategory('checkpoints')).toBe(false)
      expect(store.hasCategory('unknown-category')).toBe(false)
    })

    it('should return false after category is invalidated', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('asset-1')]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue(assets)
      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      expect(store.hasCategory('checkpoints')).toBe(true)

      store.invalidateCategory('checkpoints')

      expect(store.hasCategory('checkpoints')).toBe(false)
    })
  })

  describe('invalidateModelsForCategory', () => {
    it('should clear cache for category and trigger refetch on next access', async () => {
      const store = useAssetsStore()
      const initialAssets = [createMockAsset('initial-1')]
      const refreshedAssets = [
        createMockAsset('refreshed-1'),
        createMockAsset('refreshed-2')
      ]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce(
        initialAssets
      )
      await store.updateModelsForNodeType('CheckpointLoaderSimple')
      expect(store.getAssets('CheckpointLoaderSimple')).toHaveLength(1)

      store.invalidateModelsForCategory('checkpoints')

      // Cache should be cleared
      expect(store.hasCategory('checkpoints')).toBe(false)
      expect(store.getAssets('CheckpointLoaderSimple')).toEqual([])

      // Next fetch should get fresh data
      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce(
        refreshedAssets
      )
      await store.updateModelsForNodeType('CheckpointLoaderSimple')
      expect(store.getAssets('CheckpointLoaderSimple')).toHaveLength(2)
    })

    it('should clear tag-based caches', async () => {
      const store = useAssetsStore()
      const tagAssets = [createMockAsset('tag-1'), createMockAsset('tag-2')]

      vi.mocked(assetService.getAssetsByTag).mockResolvedValue(tagAssets)
      await store.updateModelsForTag('checkpoints')
      await store.updateModelsForTag('models')

      expect(store.getAssets('tag:checkpoints')).toHaveLength(2)
      expect(store.getAssets('tag:models')).toHaveLength(2)

      store.invalidateModelsForCategory('checkpoints')

      expect(store.getAssets('tag:checkpoints')).toEqual([])
      expect(store.getAssets('tag:models')).toEqual([])
    })

    it('should handle unknown categories gracefully', () => {
      const store = useAssetsStore()

      expect(() =>
        store.invalidateModelsForCategory('unknown-category')
      ).not.toThrow()
    })
  })

  describe('updateAssetMetadata optimistic cache', () => {
    it('reflects the server response in the cache after a successful update', async () => {
      const store = useAssetsStore()
      const original = {
        ...createMockAsset('opt-1'),
        user_metadata: { note: 'before' } as Record<string, unknown>
      }

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce([
        original
      ])
      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      const serverResponse = {
        ...original,
        user_metadata: { note: 'server-confirmed' }
      }
      vi.mocked(assetService.updateAsset).mockResolvedValueOnce(serverResponse)

      await store.updateAssetMetadata(
        original,
        { note: 'optimistic' },
        'CheckpointLoaderSimple'
      )

      const cached = store.getAssets('CheckpointLoaderSimple')[0]
      expect(cached.user_metadata).toEqual({ note: 'server-confirmed' })
    })

    it('rolls back to the original metadata when the server rejects', async () => {
      const store = useAssetsStore()
      const original = {
        ...createMockAsset('opt-2'),
        user_metadata: { note: 'before' } as Record<string, unknown>
      }

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce([
        original
      ])
      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      vi.mocked(assetService.updateAsset).mockRejectedValueOnce(
        new Error('500 Internal Error')
      )
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await store.updateAssetMetadata(
        original,
        { note: 'will be reverted' },
        'CheckpointLoaderSimple'
      )

      const cached = store.getAssets('CheckpointLoaderSimple')[0]
      expect(cached.user_metadata).toEqual({ note: 'before' })
      consoleSpy.mockRestore()
    })
  })

  describe('updateAssetTags diff-based dispatch', () => {
    it('skips both endpoints and does not mutate the cache when tags are unchanged', async () => {
      const store = useAssetsStore()
      const asset = createMockAsset('tags-noop', ['models', 'checkpoints'])

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce([
        asset
      ])
      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      await store.updateAssetTags(
        asset,
        ['checkpoints', 'models'],
        'CheckpointLoaderSimple'
      )

      expect(vi.mocked(assetService.addAssetTags)).not.toHaveBeenCalled()
      expect(vi.mocked(assetService.removeAssetTags)).not.toHaveBeenCalled()
    })

    it('calls only the add endpoint when there are no tags to remove', async () => {
      const store = useAssetsStore()
      const asset = createMockAsset('tags-add-only', ['models'])

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce([
        asset
      ])
      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      vi.mocked(assetService.addAssetTags).mockResolvedValueOnce({
        added: ['featured'],
        total_tags: ['models', 'featured']
      })

      await store.updateAssetTags(
        asset,
        ['models', 'featured'],
        'CheckpointLoaderSimple'
      )

      expect(vi.mocked(assetService.addAssetTags)).toHaveBeenCalledWith(
        'tags-add-only',
        ['featured']
      )
      expect(vi.mocked(assetService.removeAssetTags)).not.toHaveBeenCalled()
      expect(store.getAssets('CheckpointLoaderSimple')[0].tags).toEqual([
        'models',
        'featured'
      ])
    })
  })

  describe('updateAssetTags partial-failure compensation', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    it('re-adds removed tags when add fails so cache and server converge', async () => {
      const store = useAssetsStore()
      const asset = createMockAsset('tags-partial-fail', ['models', 'loras'])

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce([
        asset
      ])
      await store.updateModelsForNodeType('LoraLoader')

      vi.mocked(assetService.removeAssetTags).mockResolvedValueOnce({
        removed: ['loras'],
        total_tags: ['models']
      })
      vi.mocked(assetService.addAssetTags)
        .mockRejectedValueOnce(new Error('500 add failed'))
        .mockResolvedValueOnce({
          added: ['loras'],
          total_tags: ['models', 'loras']
        })

      await store.updateAssetTags(
        asset,
        ['models', 'checkpoints'],
        'LoraLoader'
      )

      expect(vi.mocked(assetService.addAssetTags)).toHaveBeenNthCalledWith(
        1,
        'tags-partial-fail',
        ['checkpoints']
      )
      expect(vi.mocked(assetService.addAssetTags)).toHaveBeenNthCalledWith(
        2,
        'tags-partial-fail',
        ['loras']
      )
      expect(store.getAssets('LoraLoader')[0].tags).toEqual(['models', 'loras'])
    })

    it('invalidates the category cache when compensation also fails', async () => {
      const store = useAssetsStore()
      const asset = createMockAsset('tags-compensation-fail', [
        'models',
        'loras'
      ])

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce([
        asset
      ])
      await store.updateModelsForNodeType('LoraLoader')

      vi.mocked(assetService.removeAssetTags).mockResolvedValueOnce({
        removed: ['loras'],
        total_tags: ['models']
      })
      vi.mocked(assetService.addAssetTags)
        .mockRejectedValueOnce(new Error('500 add failed'))
        .mockRejectedValueOnce(new Error('503 compensation failed'))

      await store.updateAssetTags(
        asset,
        ['models', 'checkpoints'],
        'LoraLoader'
      )

      expect(store.hasCategory('loras')).toBe(false)
      expect(vi.mocked(assetService.addAssetTags)).toHaveBeenCalledTimes(2)
    })

    it('invalidates overlapping tag caches that also contain the asset when cacheKey is provided', async () => {
      const store = useAssetsStore()
      const asset = createMockAsset('tags-overlap-fail', ['models', 'loras'])

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce([
        asset
      ])
      await store.updateModelsForNodeType('LoraLoader')
      vi.mocked(assetService.getAssetsByTag).mockResolvedValueOnce([asset])
      await store.updateModelsForTag('models')

      expect(store.hasCategory('loras')).toBe(true)
      expect(store.hasCategory('tag:models')).toBe(true)

      vi.mocked(assetService.removeAssetTags).mockResolvedValueOnce({
        removed: ['loras'],
        total_tags: ['models']
      })
      vi.mocked(assetService.addAssetTags)
        .mockRejectedValueOnce(new Error('500 add failed'))
        .mockRejectedValueOnce(new Error('503 compensation failed'))

      await store.updateAssetTags(
        asset,
        ['models', 'checkpoints'],
        'LoraLoader'
      )

      expect(store.hasCategory('loras')).toBe(false)
      expect(store.hasCategory('tag:models')).toBe(false)
    })

    it('does not attempt compensation when only the add was attempted', async () => {
      const store = useAssetsStore()
      const asset = createMockAsset('tags-add-only-fail', ['models'])

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce([
        asset
      ])
      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      vi.mocked(assetService.addAssetTags).mockRejectedValueOnce(
        new Error('500 add failed')
      )

      await store.updateAssetTags(
        asset,
        ['models', 'featured'],
        'CheckpointLoaderSimple'
      )

      expect(vi.mocked(assetService.addAssetTags)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(assetService.removeAssetTags)).not.toHaveBeenCalled()
      expect(store.getAssets('CheckpointLoaderSimple')[0].tags).toEqual([
        'models'
      ])
    })

    it('treats removeAssetTags resolution as success even when removed is empty', async () => {
      const store = useAssetsStore()
      const asset = createMockAsset('tags-empty-removed', ['models', 'loras'])

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce([
        asset
      ])
      await store.updateModelsForNodeType('LoraLoader')

      vi.mocked(assetService.removeAssetTags).mockResolvedValueOnce({
        removed: [],
        not_present: ['loras'],
        total_tags: ['models']
      })
      vi.mocked(assetService.addAssetTags).mockRejectedValueOnce(
        new Error('500 add failed')
      )

      await store.updateAssetTags(
        asset,
        ['models', 'checkpoints'],
        'LoraLoader'
      )

      expect(vi.mocked(assetService.addAssetTags)).toHaveBeenCalledTimes(1)
      expect(store.getAssets('LoraLoader')[0].tags).toEqual(['models', 'loras'])
    })

    it('invalidates every category containing the asset when no cacheKey is provided', async () => {
      const store = useAssetsStore()
      const asset = createMockAsset('tags-no-cachekey', ['models', 'loras'])

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce([
        asset
      ])
      await store.updateModelsForNodeType('LoraLoader')
      vi.mocked(assetService.getAssetsByTag).mockResolvedValueOnce([asset])
      await store.updateModelsForTag('models')

      expect(store.hasCategory('loras')).toBe(true)
      expect(store.hasCategory('tag:models')).toBe(true)

      vi.mocked(assetService.removeAssetTags).mockResolvedValueOnce({
        removed: ['loras'],
        total_tags: ['models']
      })
      vi.mocked(assetService.addAssetTags)
        .mockRejectedValueOnce(new Error('500 add failed'))
        .mockRejectedValueOnce(new Error('503 compensation failed'))

      await store.updateAssetTags(asset, ['models', 'checkpoints'])

      expect(store.hasCategory('loras')).toBe(false)
      expect(store.hasCategory('tag:models')).toBe(false)
    })
  })
})

describe('assetsStore - Deletion State and Input Mapping', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  describe('setAssetDeleting / isAssetDeleting', () => {
    it('tracks per-asset deletion state and clears it on flip', () => {
      const store = useAssetsStore()

      expect(store.isAssetDeleting('asset-A')).toBe(false)

      store.setAssetDeleting('asset-A', true)
      expect(store.isAssetDeleting('asset-A')).toBe(true)
      expect(store.isAssetDeleting('asset-B')).toBe(false)

      store.setAssetDeleting('asset-A', false)
      expect(store.isAssetDeleting('asset-A')).toBe(false)
    })
  })

  describe('getInputName', () => {
    it('resolves a hashed filename to the human-readable name when the input asset is in the cache', async () => {
      mockIsCloud.value = true
      try {
        setActivePinia(createTestingPinia({ stubActions: false }))
        const store = useAssetsStore()

        vi.mocked(assetService.getAssetsByTag).mockResolvedValueOnce([
          {
            id: 'input-1',
            name: 'cute-puppy.png',
            hash: 'abc123def.png',
            tags: ['input']
          }
        ])
        await store.updateInputs()

        expect(store.getInputName('abc123def.png')).toBe('cute-puppy.png')
      } finally {
        mockIsCloud.value = false
      }
    })

    it('falls back to the original filename when the input asset is not cached', () => {
      const store = useAssetsStore()
      expect(store.getInputName('unknown.png')).toBe('unknown.png')
    })
  })

  describe('updateInputs cloud routing', () => {
    it('reads from assetService.getAssetsByTag with limit 100 when isCloud is true', async () => {
      mockIsCloud.value = true
      try {
        setActivePinia(createTestingPinia({ stubActions: false }))
        const store = useAssetsStore()

        vi.mocked(assetService.getAssetsByTag).mockResolvedValueOnce([])
        await store.updateInputs()

        expect(vi.mocked(assetService.getAssetsByTag)).toHaveBeenCalledWith(
          'input',
          false,
          { limit: 100 }
        )
        expect(
          assetService.invalidateInputAssetsIncludingPublic
        ).toHaveBeenCalledOnce()
      } finally {
        mockIsCloud.value = false
      }
    })
  })
})

describe('assetsStore - Flat Output Assets (cloud-only)', () => {
  const FLAT_OUTPUT_PAGE_SIZE = 200

  const makeAsset = (id: string, name: string, hash?: string): AssetItem => ({
    id,
    name,
    hash,
    size: 0,
    tags: ['output']
  })

  const makePage = (
    assets: AssetItem[],
    {
      hasMore = false,
      nextCursor
    }: { hasMore?: boolean; nextCursor?: string } = {}
  ): AssetResponse => ({
    assets,
    total: assets.length,
    has_more: hasMore,
    ...(nextCursor === undefined ? {} : { next_cursor: nextCursor })
  })

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetAllMocks()
  })

  it('fetches the first page via getAssetsPageByTag with the output tag and page size', async () => {
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValueOnce(
      makePage([
        makeAsset('a1', 'image1.png', 'hash1.png'),
        makeAsset('a2', 'image2.png', 'hash2.png')
      ])
    )

    const store = useAssetsStore()
    await store.updateFlatOutputs()

    expect(assetService.getAssetsPageByTag).toHaveBeenCalledWith(
      'output',
      true,
      {
        limit: FLAT_OUTPUT_PAGE_SIZE,
        offset: 0
      }
    )
    expect(store.flatOutputAssets.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('trusts server has_more over page size for a short page', async () => {
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValueOnce(
      makePage([makeAsset('a1', 'one.png')], { hasMore: true })
    )

    const store = useAssetsStore()
    await store.updateFlatOutputs()

    expect(store.flatOutputHasMore).toBe(true)
  })

  it('marks hasMore=false when the server reports the last page', async () => {
    const fullPage = Array.from({ length: FLAT_OUTPUT_PAGE_SIZE }, (_, i) =>
      makeAsset(`a${i}`, `f${i}.png`)
    )
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValueOnce(
      makePage(fullPage, { hasMore: false })
    )

    const store = useAssetsStore()
    await store.updateFlatOutputs()

    expect(store.flatOutputHasMore).toBe(false)
  })

  it('threads the minted cursor into after on loadMore and omits offset', async () => {
    vi.mocked(assetService.getAssetsPageByTag)
      .mockResolvedValueOnce(
        makePage([makeAsset('a1', 'f1.png')], {
          hasMore: true,
          nextCursor: 'cursor-1'
        })
      )
      .mockResolvedValueOnce(makePage([makeAsset('a2', 'f2.png')]))

    const store = useAssetsStore()
    await store.updateFlatOutputs()
    await store.loadMoreFlatOutputs()

    expect(assetService.getAssetsPageByTag).toHaveBeenLastCalledWith(
      'output',
      true,
      { limit: FLAT_OUTPUT_PAGE_SIZE, after: 'cursor-1' }
    )
  })

  it('falls back to offset paging when the server mints no cursor', async () => {
    vi.mocked(assetService.getAssetsPageByTag)
      .mockResolvedValueOnce(
        makePage([makeAsset('a1', 'f1.png'), makeAsset('a2', 'f2.png')], {
          hasMore: true
        })
      )
      .mockResolvedValueOnce(makePage([makeAsset('a3', 'f3.png')]))

    const store = useAssetsStore()
    await store.updateFlatOutputs()
    await store.loadMoreFlatOutputs()

    expect(assetService.getAssetsPageByTag).toHaveBeenLastCalledWith(
      'output',
      true,
      { limit: FLAT_OUTPUT_PAGE_SIZE, offset: 2 }
    )
  })

  it('stops when the server returns a non-advancing cursor', async () => {
    vi.mocked(assetService.getAssetsPageByTag)
      .mockResolvedValueOnce(
        makePage([makeAsset('a1', 'f1.png')], {
          hasMore: true,
          nextCursor: 'stuck'
        })
      )
      .mockResolvedValueOnce(
        makePage([makeAsset('a2', 'f2.png')], {
          hasMore: true,
          nextCursor: 'stuck'
        })
      )

    const store = useAssetsStore()
    await store.updateFlatOutputs()
    await store.loadMoreFlatOutputs()

    expect(store.flatOutputHasMore).toBe(false)
  })

  it('treats an empty page as terminal even when has_more is true', async () => {
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValueOnce(
      makePage([], { hasMore: true })
    )

    const store = useAssetsStore()
    await store.updateFlatOutputs()

    expect(store.flatOutputHasMore).toBe(false)
  })

  it('appends and dedupes on loadMoreFlatOutputs', async () => {
    const firstPage = Array.from({ length: FLAT_OUTPUT_PAGE_SIZE }, (_, i) =>
      makeAsset(`a${i}`, `f${i}.png`)
    )
    const secondPage = [
      makeAsset('a0', 'duplicate.png'),
      makeAsset('newId', 'new.png')
    ]
    vi.mocked(assetService.getAssetsPageByTag)
      .mockResolvedValueOnce(makePage(firstPage, { hasMore: true }))
      .mockResolvedValueOnce(makePage(secondPage))

    const store = useAssetsStore()
    await store.updateFlatOutputs()
    await store.loadMoreFlatOutputs()

    expect(store.flatOutputAssets).toHaveLength(FLAT_OUTPUT_PAGE_SIZE + 1)
    expect(store.flatOutputAssets.at(-1)?.id).toBe('newId')
  })

  it('records error and resolves to an empty list on initial-fetch failure', async () => {
    const err = new Error('network down')
    vi.mocked(assetService.getAssetsPageByTag).mockRejectedValueOnce(err)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const store = useAssetsStore()
      const result = await store.updateFlatOutputs()

      expect(result).toEqual([])
      expect(store.flatOutputError).toBe(err)
      expect(store.flatOutputLoading).toBe(false)
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('preserves the cursor for retry when loadMore fails', async () => {
    const err = new Error('network down')
    vi.mocked(assetService.getAssetsPageByTag)
      .mockResolvedValueOnce(
        makePage([makeAsset('a1', 'f1.png')], {
          hasMore: true,
          nextCursor: 'cursor-1'
        })
      )
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce(makePage([makeAsset('a2', 'f2.png')]))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const store = useAssetsStore()
      await store.updateFlatOutputs()
      await store.loadMoreFlatOutputs()

      expect(store.flatOutputError).toBe(err)
      expect(store.flatOutputAssets.map((a) => a.id)).toEqual(['a1'])
      expect(store.flatOutputHasMore).toBe(true)

      await store.loadMoreFlatOutputs()

      expect(assetService.getAssetsPageByTag).toHaveBeenLastCalledWith(
        'output',
        true,
        { limit: FLAT_OUTPUT_PAGE_SIZE, after: 'cursor-1' }
      )
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('restarts from the head when loadMore follows a failed refresh', async () => {
    vi.mocked(assetService.getAssetsPageByTag)
      .mockResolvedValueOnce(
        makePage([makeAsset('a1', 'f1.png')], {
          hasMore: true,
          nextCursor: 'cursor-1'
        })
      )
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(makePage([makeAsset('a2', 'f2.png')]))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const store = useAssetsStore()
      await store.updateFlatOutputs()
      await store.updateFlatOutputs()
      await store.loadMoreFlatOutputs()

      expect(assetService.getAssetsPageByTag).toHaveBeenLastCalledWith(
        'output',
        true,
        { limit: FLAT_OUTPUT_PAGE_SIZE, offset: 0 }
      )
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('refresh resets pagination', async () => {
    vi.mocked(assetService.getAssetsPageByTag)
      .mockResolvedValueOnce(
        makePage([makeAsset('a1', 'f1.png')], {
          hasMore: true,
          nextCursor: 'cursor-1'
        })
      )
      .mockResolvedValueOnce(makePage([makeAsset('fresh', 'fresh.png')]))

    const store = useAssetsStore()
    await store.updateFlatOutputs()
    await store.updateFlatOutputs()

    expect(assetService.getAssetsPageByTag).toHaveBeenLastCalledWith(
      'output',
      true,
      { limit: FLAT_OUTPUT_PAGE_SIZE, offset: 0 }
    )
    expect(store.flatOutputAssets.map((a) => a.id)).toEqual(['fresh'])
    expect(store.flatOutputHasMore).toBe(false)
  })

  it('dedupes concurrent fetches into a single request', async () => {
    let resolvePage!: (page: AssetResponse) => void
    const pagePromise = new Promise<AssetResponse>((res) => {
      resolvePage = res
    })
    vi.mocked(assetService.getAssetsPageByTag).mockReturnValueOnce(pagePromise)

    const store = useAssetsStore()
    const p1 = store.updateFlatOutputs()
    const p2 = store.updateFlatOutputs()

    expect(vi.mocked(assetService.getAssetsPageByTag)).toHaveBeenCalledTimes(1)

    resolvePage(makePage([makeAsset('shared-1', 'shared.png', 'h.png')]))
    await Promise.all([p1, p2])

    expect(store.flatOutputAssets.map((x) => x.id)).toEqual(['shared-1'])
  })
})
