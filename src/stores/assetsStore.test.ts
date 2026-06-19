import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'

import { useAssetsStore } from '@/stores/assetsStore'
import { api } from '@/scripts/api'
import type {
  AssetItem,
  AssetResponse
} from '@/platform/assets/schemas/assetSchema'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { assetService } from '@/platform/assets/services/assetService'

// Mock the api module
vi.mock('@/scripts/api', () => ({
  api: {
    getHistory: vi.fn(),
    internalURL: vi.fn((path) => `http://localhost:3000${path}`),
    apiURL: vi.fn((path) => `http://localhost:3000/api${path}`),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    user: 'test-user'
  }
}))

// Mock the asset service
vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetsByTag: vi.fn(),
    getAssetsPageByTag: vi.fn(),
    getAllAssetsByTag: vi.fn(),
    getAssetsForNodeType: vi.fn(),
    getAssetsPageForNodeType: vi.fn(),
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
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)

      await store.updateHistory()

      expect(api.getHistory).toHaveBeenCalledWith(200, { offset: 0 })
      expect(store.historyAssets).toHaveLength(10)
      expect(store.hasMoreHistory).toBe(false) // Less than BATCH_SIZE
      expect(store.historyLoading).toBe(false)
      expect(store.historyError).toBe(null)
    })

    it('should set hasMoreHistory to true when batch is full', async () => {
      const mockHistory = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)

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
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)

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
      vi.mocked(api.getHistory).mockResolvedValueOnce(firstBatch)

      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(200)
      expect(store.hasMoreHistory).toBe(true)

      // Second batch - different items
      const secondBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(200 + i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce(secondBatch)

      await store.loadMoreHistory()

      expect(api.getHistory).toHaveBeenCalledWith(200, { offset: 200 })
      expect(store.historyAssets).toHaveLength(400) // Accumulated
      expect(store.hasMoreHistory).toBe(true)
    })

    it('should prevent duplicate items during pagination', async () => {
      // First batch - full BATCH_SIZE
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce(firstBatch)

      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(200)

      // Second batch with some duplicates
      const secondBatch = [
        createMockJobItem(2), // Duplicate
        createMockJobItem(5), // Duplicate
        ...Array.from({ length: 198 }, (_, i) => createMockJobItem(200 + i)) // New
      ]
      vi.mocked(api.getHistory).mockResolvedValueOnce(secondBatch)

      await store.loadMoreHistory()

      // Should only add new items (198 new, 2 duplicates filtered)
      expect(store.historyAssets).toHaveLength(398)

      // Verify no duplicates
      const assetIds = store.historyAssets.map((a) => a.id)
      const uniqueAssetIds = new Set(assetIds)
      expect(uniqueAssetIds.size).toBe(store.historyAssets.length)
    })

    it('should stop loading when no more items', async () => {
      // First batch - less than BATCH_SIZE
      const firstBatch = Array.from({ length: 50 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce(firstBatch)

      await store.updateHistory()
      expect(store.hasMoreHistory).toBe(false)

      // Try to load more - should return early
      await store.loadMoreHistory()

      // Should only have been called once (initial load)
      expect(api.getHistory).toHaveBeenCalledTimes(1)
    })

    it('should handle race conditions with concurrent loads', async () => {
      // Setup initial state with full batch
      const initialBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce(initialBatch)
      await store.updateHistory()
      expect(store.hasMoreHistory).toBe(true)

      // Clear mock to count only loadMore calls
      vi.mocked(api.getHistory).mockClear()

      // Setup slow API response
      let resolveLoadMore: (value: JobListItem[]) => void
      const loadMorePromise = new Promise<JobListItem[]>((resolve) => {
        resolveLoadMore = resolve
      })
      vi.mocked(api.getHistory).mockReturnValueOnce(loadMorePromise)

      // Start first loadMore
      const firstLoad = store.loadMoreHistory()

      // Try concurrent load - should be ignored
      const secondLoad = store.loadMoreHistory()

      // Resolve
      const secondBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(200 + i)
      )
      resolveLoadMore!(secondBatch)

      await Promise.all([firstLoad, secondLoad])

      // Only one API call
      expect(api.getHistory).toHaveBeenCalledTimes(1)
    })

    it('should respect MAX_HISTORY_ITEMS limit', async () => {
      const BATCH_COUNT = 6 // 6 × 200 = 1200 items

      // Initial load
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce(firstBatch)
      await store.updateHistory()

      // Load additional batches
      for (let batch = 1; batch < BATCH_COUNT; batch++) {
        const items = Array.from({ length: 200 }, (_, i) =>
          createMockJobItem(batch * 200 + i)
        )
        vi.mocked(api.getHistory).mockResolvedValueOnce(items)
        await store.loadMoreHistory()
      }

      // Should be capped at MAX_HISTORY_ITEMS (1000)
      expect(store.historyAssets).toHaveLength(1000)
    })
  })

  describe('Sorting', () => {
    it('should maintain date sorting after pagination', async () => {
      // First batch
      const firstBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce(firstBatch)

      await store.updateHistory()

      // Second batch
      const secondBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(200 + i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce(secondBatch)

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
      vi.mocked(api.getHistory).mockResolvedValueOnce(firstBatch)

      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(200)

      // Second load fails
      const error = new Error('Network error')
      vi.mocked(api.getHistory).mockRejectedValueOnce(error)

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
      vi.mocked(api.getHistory).mockResolvedValueOnce(firstBatch)

      await store.updateHistory()

      // Second load fails
      const error = new Error('Network error')
      vi.mocked(api.getHistory).mockRejectedValueOnce(error)

      await store.loadMoreHistory()
      expect(store.historyError).toBe(error)

      // Third load succeeds
      const thirdBatch = Array.from({ length: 200 }, (_, i) =>
        createMockJobItem(200 + i)
      )
      vi.mocked(api.getHistory).mockResolvedValueOnce(thirdBatch)

      await store.loadMoreHistory()

      // Error should be cleared
      expect(store.historyError).toBe(null)
      expect(store.historyAssets).toHaveLength(400)
    })

    it('should handle errors with proper loading state', async () => {
      const error = new Error('API error')
      vi.mocked(api.getHistory).mockRejectedValue(error)

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
        vi.mocked(api.getHistory).mockResolvedValueOnce(items)

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
        vi.mocked(api.getHistory).mockResolvedValueOnce(items)

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
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)
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
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)
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
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)
      await store.updateHistory()

      const before = store.historyAssets.map((a) => ({ ...a }))
      store.setAssetPreview('does-not-exist.glb', 'p', '/p')

      expect(store.historyAssets).toEqual(before)
    })

    it('only patches the asset whose name matches exactly', async () => {
      const mockHistory = Array.from({ length: 3 }, (_, i) =>
        createMockJobItem(i)
      )
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)
      await store.updateHistory()

      // Patch using a non-matching prefix; the other assets must stay untouched
      store.setAssetPreview('output_1', 'p', '/p')

      for (const asset of store.historyAssets) {
        expect(asset.preview_id).toBeUndefined()
      }
    })

    it('replaces the asset object so reactivity fires for v-for keyed by id', async () => {
      const mockHistory = [createMockJobItem(0)]
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)
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
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)

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
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)

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
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)

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
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)

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
      vi.mocked(api.getHistory).mockResolvedValue(mockHistory)

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

  /** Wraps assets in the paginated response envelope the asset API returns. */
  const makePage = (
    assets: AssetItem[],
    page: { has_more?: boolean; next_cursor?: string } = {}
  ): AssetResponse => ({
    assets,
    total: assets.length,
    has_more: page.has_more ?? false,
    ...(page.next_cursor === undefined ? {} : { next_cursor: page.next_cursor })
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
      vi.mocked(assetService.getAssetsPageForNodeType).mockImplementation(
        async () => {
          callCount++
          return callCount === 1
            ? makePage(firstBatch, { has_more: true })
            : makePage(secondBatch)
        }
      )

      await store.updateModelsForNodeType(nodeType)

      // Wait for background batch loading to complete
      await vi.waitFor(() => {
        expect(
          vi.mocked(assetService.getAssetsPageForNodeType)
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
      vi.mocked(assetService.getAssetsPageForNodeType).mockImplementation(
        async () => {
          callCount++
          return callCount === 1
            ? makePage(firstBatch, { has_more: true })
            : makePage(secondBatch)
        }
      )

      await store.updateModelsForNodeType(nodeType)

      // Wait for background batch loading to complete
      await vi.waitFor(() => {
        expect(
          vi.mocked(assetService.getAssetsPageForNodeType)
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage(assets)
      )
      await store.updateModelsForNodeType(nodeType)

      const firstCall = store.getAssets(nodeType)
      const secondCall = store.getAssets(nodeType)

      expect(secondCall).toBe(firstCall)
      expect(firstCall).toHaveLength(1)
    })
  })

  describe('cursor walk anomalies (regression)', () => {
    it('follows an empty-string cursor instead of falling back to offset paging', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      vi.mocked(assetService.getAssetsPageForNodeType).mockImplementation(
        async (_nodeType, opts) => {
          if (opts?.after === undefined) {
            return makePage([createMockAsset('p1')], {
              has_more: true,
              next_cursor: ''
            })
          }
          return makePage([createMockAsset('p2')])
        }
      )

      await store.updateModelsForNodeType(nodeType)

      const calls = vi.mocked(assetService.getAssetsPageForNodeType).mock.calls
      expect(calls).toHaveLength(2)
      expect(calls[1]?.[1]?.after).toBe('')
      expect(store.getAssets(nodeType).map((a) => a.id)).toEqual(['p1', 'p2'])
    })

    it('keeps previously cached assets when a refresh hits an empty page with has_more', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'
      const cached = [
        createMockAsset('keep-1'),
        createMockAsset('keep-2'),
        createMockAsset('keep-3')
      ]

      // Initial load: a complete walk populates the cache.
      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage(cached)
      )
      await store.updateModelsForNodeType(nodeType)
      expect(store.getAssets(nodeType)).toHaveLength(3)

      // Refresh: the server returns an empty page while still claiming more.
      // The walk must stop without pruning the still-valid cached assets.
      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([], { has_more: true })
      )
      await store.updateModelsForNodeType(nodeType)

      expect(store.getAssets(nodeType).map((a) => a.id)).toEqual([
        'keep-1',
        'keep-2',
        'keep-3'
      ])
    })

    it('terminates on a cycling cursor (A->B->A) instead of looping forever', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      vi.mocked(assetService.getAssetsPageForNodeType).mockImplementation(
        async (_nodeType, opts) => {
          const after = opts?.after
          if (after === undefined) {
            return makePage([createMockAsset('p1')], {
              has_more: true,
              next_cursor: 'B'
            })
          }
          if (after === 'B') {
            return makePage([createMockAsset('p2')], {
              has_more: true,
              next_cursor: 'A'
            })
          }
          // after === 'A' returns cursor 'B' again — a cycle the walk must
          // detect and break out of.
          return makePage([createMockAsset('p3')], {
            has_more: true,
            next_cursor: 'B'
          })
        }
      )

      await store.updateModelsForNodeType(nodeType)

      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).toHaveBeenCalledTimes(3)
      expect(store.getAssets(nodeType).map((a) => a.id)).toEqual([
        'p1',
        'p2',
        'p3'
      ])
    })
  })

  describe('concurrent request handling', () => {
    it('should short-circuit concurrent calls to prevent duplicate work', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'
      const firstBatch = Array.from({ length: 5 }, (_, i) =>
        createMockAsset(`first-${i}`)
      )

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage(firstBatch)
      )

      // Start two concurrent requests for the same category
      const firstRequest = store.updateModelsForNodeType(nodeType)
      const secondRequest = store.updateModelsForNodeType(nodeType)
      await Promise.all([firstRequest, secondRequest])

      // Second request should be short-circuited, only one API call made
      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage(firstBatch)
      )
      await store.updateModelsForNodeType(nodeType)
      expect(store.getAssets(nodeType)).toHaveLength(1)

      // After first completes, a new request should work
      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage(secondBatch)
      )
      store.invalidateCategory('checkpoints')
      await store.updateModelsForNodeType(nodeType)

      expect(store.getAssets(nodeType)).toHaveLength(2)
      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage([])
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage(assets)
      )

      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      expect(store.getAssets('CheckpointLoaderSimple')).toHaveLength(2)
      expect(store.getAssets('ImageOnlyCheckpointLoader')).toHaveLength(2)
      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
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
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).not.toHaveBeenCalled()
    })
  })

  describe('invalidateCategory', () => {
    it('should clear cache for a category', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('asset-1'), createMockAsset('asset-2')]

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage(assets)
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage(initialAssets)
      )
      await store.updateModelsForNodeType('LoraLoader')
      expect(store.getAssets('LoraLoader')).toHaveLength(1)

      store.invalidateCategory('loras')

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage(refreshedAssets)
      )
      await store.updateModelsForNodeType('LoraLoader')

      expect(store.getAssets('LoraLoader')).toHaveLength(2)
    })

    it('should invalidate tag-based caches', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('tag-asset-1')]

      vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
        makePage(assets)
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage(assets)
      )
      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      expect(store.hasCategory('checkpoints')).toBe(true)
    })

    it('should return true for tag-based category when tag: prefix is not used', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('asset-1')]

      vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
        makePage(assets)
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage(assets)
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage(initialAssets)
      )
      await store.updateModelsForNodeType('CheckpointLoaderSimple')
      expect(store.getAssets('CheckpointLoaderSimple')).toHaveLength(1)

      store.invalidateModelsForCategory('checkpoints')

      // Cache should be cleared
      expect(store.hasCategory('checkpoints')).toBe(false)
      expect(store.getAssets('CheckpointLoaderSimple')).toEqual([])

      // Next fetch should get fresh data
      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage(refreshedAssets)
      )
      await store.updateModelsForNodeType('CheckpointLoaderSimple')
      expect(store.getAssets('CheckpointLoaderSimple')).toHaveLength(2)
    })

    it('should clear tag-based caches', async () => {
      const store = useAssetsStore()
      const tagAssets = [createMockAsset('tag-1'), createMockAsset('tag-2')]

      vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
        makePage(tagAssets)
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([original])
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([original])
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([asset])
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([asset])
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([asset])
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([asset])
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([asset])
      )
      await store.updateModelsForNodeType('LoraLoader')
      vi.mocked(assetService.getAssetsPageByTag).mockResolvedValueOnce(
        makePage([asset])
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([asset])
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([asset])
      )
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

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([asset])
      )
      await store.updateModelsForNodeType('LoraLoader')
      vi.mocked(assetService.getAssetsPageByTag).mockResolvedValueOnce(
        makePage([asset])
      )
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

  describe('cursor pagination batch walk', () => {
    it('walks pages via the after cursor even when pages are short', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'
      const firstPage = Array.from({ length: 5 }, (_, i) =>
        createMockAsset(`first-${i}`)
      )
      const secondPage = Array.from({ length: 3 }, (_, i) =>
        createMockAsset(`second-${i}`)
      )

      vi.mocked(assetService.getAssetsPageForNodeType)
        .mockResolvedValueOnce(
          makePage(firstPage, { has_more: true, next_cursor: 'cursor-1' })
        )
        .mockResolvedValueOnce(makePage(secondPage))

      await store.updateModelsForNodeType(nodeType)

      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).toHaveBeenCalledTimes(2)
      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).toHaveBeenNthCalledWith(1, nodeType, {
        limit: 500,
        offset: 0,
        signal: expect.any(AbortSignal)
      })
      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).toHaveBeenNthCalledWith(2, nodeType, {
        limit: 500,
        after: 'cursor-1',
        signal: expect.any(AbortSignal)
      })
      expect(store.getAssets(nodeType)).toHaveLength(8)
    })

    it('terminates when has_more is false even if a cursor is present', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'
      const fullPage = Array.from({ length: 500 }, (_, i) =>
        createMockAsset(`asset-${i}`)
      )

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage(fullPage, { has_more: false, next_cursor: 'cursor-1' })
      )

      await store.updateModelsForNodeType(nodeType)

      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).toHaveBeenCalledTimes(1)
      expect(store.getAssets(nodeType)).toHaveLength(500)
    })

    it('terminates when the cursor stops advancing', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      vi.mocked(assetService.getAssetsPageForNodeType)
        .mockResolvedValueOnce(
          makePage([createMockAsset('a')], {
            has_more: true,
            next_cursor: 'stuck'
          })
        )
        .mockResolvedValueOnce(
          makePage([createMockAsset('b')], {
            has_more: true,
            next_cursor: 'stuck'
          })
        )

      await store.updateModelsForNodeType(nodeType)

      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).toHaveBeenCalledTimes(2)
      expect(store.getAssets(nodeType)).toHaveLength(2)
    })

    it('terminates on an empty page even when has_more is true', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage([], { has_more: true, next_cursor: 'cursor-1' })
      )

      await store.updateModelsForNodeType(nodeType)

      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).toHaveBeenCalledTimes(1)
      expect(store.getAssets(nodeType)).toHaveLength(0)
    })

    it('falls back to the offset walk when responses carry no cursor', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'
      const fullPage = Array.from({ length: 500 }, (_, i) =>
        createMockAsset(`full-${i}`)
      )
      const shortPage = Array.from({ length: 10 }, (_, i) =>
        createMockAsset(`short-${i}`)
      )

      vi.mocked(assetService.getAssetsPageForNodeType)
        .mockResolvedValueOnce(makePage(fullPage, { has_more: true }))
        .mockResolvedValueOnce(makePage(shortPage, { has_more: true }))

      await store.updateModelsForNodeType(nodeType)

      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).toHaveBeenCalledTimes(2)
      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).toHaveBeenNthCalledWith(2, nodeType, {
        limit: 500,
        offset: 500,
        signal: expect.any(AbortSignal)
      })
      expect(store.getAssets(nodeType)).toHaveLength(510)
    })

    it('commits the first cursor batch before the walk finishes', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'
      const firstPage = Array.from({ length: 5 }, (_, i) =>
        createMockAsset(`first-${i}`)
      )

      let resolveSecondPage!: (page: AssetResponse) => void
      const secondPagePromise = new Promise<AssetResponse>((resolve) => {
        resolveSecondPage = resolve
      })

      vi.mocked(assetService.getAssetsPageForNodeType)
        .mockResolvedValueOnce(
          makePage(firstPage, { has_more: true, next_cursor: 'cursor-1' })
        )
        .mockReturnValueOnce(secondPagePromise)

      const update = store.updateModelsForNodeType(nodeType)

      // The first short page is committed and loading flips off while the
      // cursor walk is still in flight (isFirstBatch no longer keys off
      // offset === 0).
      await vi.waitFor(() => {
        expect(store.getAssets(nodeType)).toHaveLength(5)
      })
      expect(store.isModelLoading(nodeType)).toBe(false)

      resolveSecondPage(makePage([createMockAsset('late')]))
      await update

      expect(store.getAssets(nodeType)).toHaveLength(6)
    })

    it('starts a refresh from the first page, not the stale cursor', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      vi.mocked(assetService.getAssetsPageForNodeType)
        .mockResolvedValueOnce(
          makePage([createMockAsset('walk-1')], {
            has_more: true,
            next_cursor: 'cursor-1'
          })
        )
        .mockResolvedValueOnce(makePage([createMockAsset('walk-2')]))
        .mockResolvedValueOnce(makePage([createMockAsset('fresh')]))

      await store.updateModelsForNodeType(nodeType)
      await store.updateModelsForNodeType(nodeType)

      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).toHaveBeenNthCalledWith(3, nodeType, {
        limit: 500,
        offset: 0,
        signal: expect.any(AbortSignal)
      })
      expect(store.getAssets(nodeType).map((a) => a.id)).toEqual(['fresh'])
    })

    it('aborts an in-flight walk when the category is invalidated', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      // Every page claims more work, so the walk only stops if it is aborted.
      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage([createMockAsset('p1')], {
          has_more: true,
          next_cursor: 'c1'
        })
      )

      const walk = store.updateModelsForNodeType(nodeType)

      // Wait for the first fetch, then invalidate during the inter-batch delay
      // so the walk aborts instead of issuing further requests.
      await vi.waitFor(() =>
        expect(
          vi.mocked(assetService.getAssetsPageForNodeType)
        ).toHaveBeenCalledTimes(1)
      )
      store.invalidateCategory('checkpoints')

      await walk

      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).toHaveBeenCalledTimes(1)
    })

    it('does not clear a superseding walk when an aborted walk tears down', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      // Walk A claims more work so it enters the inter-batch delay and can be
      // aborted mid-walk by invalidateCategory.
      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([createMockAsset('a1')], { has_more: true, next_cursor: 'ca' })
      )
      // Walk B stays in-flight (deferred), so its dedupe guard must remain
      // registered while walk A's aborted teardown runs.
      let resolveB!: (page: AssetResponse) => void
      const bPage = new Promise<AssetResponse>((resolve) => {
        resolveB = resolve
      })
      vi.mocked(assetService.getAssetsPageForNodeType).mockReturnValueOnce(
        bPage
      )

      const walkA = store.updateModelsForNodeType(nodeType)
      await vi.waitFor(() =>
        expect(
          vi.mocked(assetService.getAssetsPageForNodeType)
        ).toHaveBeenCalledTimes(1)
      )

      // Abort walk A, then start walk B before A's teardown runs.
      store.invalidateCategory('checkpoints')
      const walkB = store.updateModelsForNodeType(nodeType)
      await vi.waitFor(() =>
        expect(
          vi.mocked(assetService.getAssetsPageForNodeType)
        ).toHaveBeenCalledTimes(2)
      )

      // Let walk A's aborted teardown settle; it must not delete walk B's guard.
      await walkA

      // A concurrent call must dedupe into walk B, not start a duplicate fetch.
      const walkC = store.updateModelsForNodeType(nodeType)
      resolveB(makePage([createMockAsset('b1')]))
      await Promise.all([walkB, walkC])

      expect(
        vi.mocked(assetService.getAssetsPageForNodeType)
      ).toHaveBeenCalledTimes(2)
      expect(store.getAssets(nodeType).map((a) => a.id)).toEqual(['b1'])
    })

    it('drives updateModelsForTag through getAssetsPageByTag with cursors', async () => {
      const store = useAssetsStore()

      vi.mocked(assetService.getAssetsPageByTag)
        .mockResolvedValueOnce(
          makePage([createMockAsset('tag-a')], {
            has_more: true,
            next_cursor: 'cursor-tag'
          })
        )
        .mockResolvedValueOnce(makePage([createMockAsset('tag-b')]))

      await store.updateModelsForTag('models')

      expect(vi.mocked(assetService.getAssetsPageByTag)).toHaveBeenCalledTimes(
        2
      )
      expect(
        vi.mocked(assetService.getAssetsPageByTag)
      ).toHaveBeenNthCalledWith(1, 'models', true, {
        limit: 500,
        offset: 0,
        signal: expect.any(AbortSignal)
      })
      expect(
        vi.mocked(assetService.getAssetsPageByTag)
      ).toHaveBeenNthCalledWith(2, 'models', true, {
        limit: 500,
        after: 'cursor-tag',
        signal: expect.any(AbortSignal)
      })
      expect(store.getAssets('tag:models')).toHaveLength(2)
    })
  })
})

describe('assetsStore - Model Assets Cache (non-cloud)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockIsCloud.value = false
    vi.clearAllMocks()
  })

  it('caches model assets fetched by tag on non-cloud builds', async () => {
    const store = useAssetsStore()
    vi.mocked(assetService.getAssetsByTag).mockResolvedValue([
      {
        id: 'm1',
        name: 'sd_xl_base_1.0.safetensors',
        tags: ['checkpoints', 'models']
      },
      { id: 'm2', name: 'lora.safetensors', tags: ['loras', 'models'] }
    ])

    await store.updateModelsForTag('models')

    expect(assetService.getAssetsByTag).toHaveBeenCalledWith(
      'models',
      true,
      expect.anything()
    )
    expect(store.getAssets('tag:models')).toHaveLength(2)
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

  it('threads an empty-string cursor into after instead of falling back to offset', async () => {
    vi.mocked(assetService.getAssetsPageByTag)
      .mockResolvedValueOnce(
        makePage([makeAsset('a1', 'f1.png')], {
          hasMore: true,
          nextCursor: ''
        })
      )
      .mockResolvedValueOnce(makePage([makeAsset('a2', 'f2.png')]))

    const store = useAssetsStore()
    await store.updateFlatOutputs()
    await store.loadMoreFlatOutputs()

    expect(assetService.getAssetsPageByTag).toHaveBeenLastCalledWith(
      'output',
      true,
      { limit: FLAT_OUTPUT_PAGE_SIZE, after: '' }
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
