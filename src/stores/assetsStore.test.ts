import { reportError } from '@comfyorg/telemetry/reportError'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useToast } from '@/components/ui/toast/toastStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, toValue, watch } from 'vue'

import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import { useAssetsStore } from '@/stores/assetsStore'
import { getAssetCategories } from '@/platform/assets/utils/assetMetadataUtils'
import { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type {
  AssetItem,
  AssetResponse
} from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import type { JobListItem } from '@comfyorg/api-client/jobTypes'
import { api } from '@/scripts/api'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

beforeEach(() => {
  vi.mocked(api.internalURL).mockImplementation(
    (path) => `http://localhost:3000${path}`
  )
  vi.mocked(api.apiURL).mockImplementation(
    (path) => `http://localhost:3000/api${path}`
  )
  vi.mocked(api.getServerFeature).mockReturnValue(false)
  api.user = 'test-user'
})

vi.mock(import('@/platform/assets/services/assetService'))

// Mock distribution type - hoisted so it can be changed per test
const mockIsCloud = vi.hoisted(() => ({ value: false }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

beforeEach(() => {
  useNodeDefStore().nodeDefsByName = Object.fromEntries(
    [
      'CheckpointLoaderSimple',
      'ImageOnlyCheckpointLoader',
      'LoraLoader',
      'LoraLoaderModelOnly',
      'VAELoader'
    ].map((name) => [
      name,
      new ComfyNodeDefImpl({
        name,
        display_name: name,
        description: '',
        input: {},
        output: [],
        category: 'loaders',
        python_module: 'nodes',
        output_node: false
      })
    ])
  )
})

// Mock asset mappers - add unique timestamps
vi.mock<unknown>(
  import('@/platform/assets/composables/media/assetMappers'),
  () => ({
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
        id: `asset-${task.jobId}`,
        name: output.filename,
        size: 0,
        created_at: new Date(Date.now() - index * 1000).toISOString(),
        tags: ['output'],
        preview_url: output.url,
        user_metadata: { jobId: task.jobId, subfolder: '' }
      }
    }),
    unflattenOutputAssets: vi.fn((items: AssetItem[]) => items)
  })
)

function createHistoryPage(start: number): JobListItem[] {
  return Array.from({ length: 200 }, (_, index) => {
    const id = `job_${start + index}`
    return {
      id,
      status: 'completed',
      create_time: start + index,
      priority: 0,
      outputs_count: 1,
      previewable_outputs_count: 1,
      preview_output: {
        filename: `${id}.png`,
        mediaType: 'images',
        nodeId: '1',
        subfolder: '',
        type: 'output'
      }
    }
  })
}

describe('assetsStore - OSS history pagination', () => {
  it('serializes refresh with pagination without skipping the next offset', async () => {
    let resolveFirstPage!: (jobs: JobListItem[]) => void
    const firstPage = new Promise<JobListItem[]>((resolve) => {
      resolveFirstPage = resolve
    })
    vi.mocked(api.getHistory)
      .mockImplementationOnce(() => firstPage)
      .mockResolvedValueOnce([])
    const store = useAssetsStore()

    const refresh = store.outputAssets.invalidate()
    const pagination = store.outputAssets.loadMore()
    await vi.waitFor(() => expect(api.getHistory).toHaveBeenCalledTimes(1))

    resolveFirstPage(createHistoryPage(0))
    await Promise.all([refresh, pagination])

    expect(
      vi.mocked(api.getHistory).mock.calls.map(([, options]) => options)
    ).toEqual([{ offset: 0 }, { offset: 200 }])
  })

  it('finds the job output when pagination inserts it ahead of resident assets', async () => {
    vi.mocked(api.getHistory)
      .mockResolvedValueOnce(createHistoryPage(200))
      .mockResolvedValueOnce(createHistoryPage(0))
    const store = useAssetsStore()

    await store.outputAssets.loadMore()
    await expect(store.loadOutputAssetByJobId('job_0')).resolves.toEqual(
      expect.objectContaining({ id: 'asset-job_0' })
    )

    expect(
      vi.mocked(api.getHistory).mock.calls.map(([, options]) => options)
    ).toEqual([{ offset: 0 }, { offset: 200 }])
  })

  it('stops looking when history has no more pages', async () => {
    vi.mocked(api.getHistory).mockResolvedValueOnce([])
    const store = useAssetsStore()

    await expect(
      store.loadOutputAssetByJobId('missing-job')
    ).resolves.toBeUndefined()

    expect(api.getHistory).toHaveBeenCalledOnce()
  })

  it('stops lookup after a failed page without retrying the history request', async () => {
    vi.mocked(api.getHistory)
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce([])
    const store = useAssetsStore()

    await expect(
      store.loadOutputAssetByJobId('missing-job')
    ).resolves.toBeUndefined()

    expect(api.getHistory).toHaveBeenCalledOnce()
  })
})

describe('assetsStore - Model Assets Cache (Cloud)', () => {
  beforeEach(() => {
    mockIsCloud.value = true
  })

  afterEach(() => {
    mockIsCloud.value = false
  })

  const createMockAsset = (id: string, tags: string[] = ['models']) =>
    fromPartial<AssetItem>({
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

  it('bounds output lookup when pagination never reports exhaustion', async () => {
    vi.mocked(useFeatureFlags().flags).assetsEnabled = true
    let outputPage = 0
    vi.mocked(api.fetchApi).mockImplementation(async (url) => {
      const isInputQuery = url.includes('tags_any=input')
      const body: AssetResponse = isInputQuery
        ? makePage([])
        : makePage(
            [
              fromPartial<AssetItem>({
                id: `output-${++outputPage}`,
                name: `output-${outputPage}.png`,
                loader_path: `output-${outputPage}.png`,
                tags: ['output'],
                created_at: '2026-09-22T00:00:00Z',
                updated_at: '2026-09-22T00:00:00Z'
              })
            ],
            { has_more: true, next_cursor: `page-${outputPage + 1}` }
          )
      return new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' }
      })
    })
    const store = useAssetsStore()
    await vi.waitFor(() =>
      expect(toValue(store.outputAssets.isLoading)).toBe(false)
    )

    await expect(
      store.loadOutputAssetByJobId('missing-output')
    ).resolves.toBeUndefined()

    expect(outputPage).toBe(21)
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
        expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(2)
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
        expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(2)
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

      expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(3)
      expect(store.getAssets(nodeType).map((a) => a.id)).toEqual([
        'p1',
        'p2',
        'p3'
      ])
    })
  })

  describe('refresh error surfacing', () => {
    it('surfaces a failed refresh on the committed state consumers read', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValueOnce(
        makePage([createMockAsset('existing')])
      )
      await store.updateModelsForNodeType(nodeType)
      expect(store.getError(nodeType)).toBeUndefined()

      vi.mocked(assetService.getAssetsPageForNodeType).mockRejectedValueOnce(
        new Error('backend down')
      )
      await store.updateModelsForNodeType(nodeType)

      expect(store.getAssets(nodeType).map((a) => a.id)).toEqual(['existing'])
      expect(store.getError(nodeType)?.message).toBe('backend down')
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
      expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(1)
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
      expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(2)
    })

    it('keeps a newer request single-flighted when a stale request finishes after invalidation', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      let resolveFirst!: (response: AssetResponse) => void
      const firstFetch = new Promise<AssetResponse>((resolve) => {
        resolveFirst = resolve
      })
      vi.mocked(assetService.getAssetsPageForNodeType)
        .mockReturnValueOnce(firstFetch)
        .mockReturnValue(new Promise<AssetResponse>(() => {}))

      const staleRequest = store.updateModelsForNodeType(nodeType)
      store.invalidateCategory('checkpoints')
      void store.updateModelsForNodeType(nodeType)

      resolveFirst(makePage([createMockAsset('stale')]))
      await staleRequest

      // The stale request's teardown must not evict the newer request's
      // single-flight entry: a third call short-circuits instead of starting
      // a duplicate walk.
      void store.updateModelsForNodeType(nodeType)
      expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(2)
    })

    const completeLoraDownload = () => {
      useAssetDownloadStore().lastCompletedDownload = {
        taskId: 'task-lora',
        modelType: 'loras',
        timestamp: Date.now()
      }
    }

    const modelsTagCalls = () =>
      vi
        .mocked(assetService.getAssetsPageByTag)
        .mock.calls.filter(([tag]) => tag === 'models')

    const settleMicrotasks = () =>
      new Promise((resolve) => setTimeout(resolve, 0))

    interface PendingPage {
      resolve: (page: AssetResponse) => void
      reject: (error: Error) => void
    }

    const abortablePage = (pages: PendingPage[], signal?: AbortSignal) =>
      new Promise<AssetResponse>((resolve, reject) => {
        pages.push({ resolve, reject })
        signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        )
      })

    it('refetches the models library when a download completes during an in-flight fetch', async () => {
      const store = useAssetsStore()
      const newLora = createMockAsset('new-lora', ['models', 'loras'])

      let resolveStalePage!: (page: AssetResponse) => void
      const stalePage = new Promise<AssetResponse>((resolve) => {
        resolveStalePage = resolve
      })
      vi.mocked(assetService.getAssetsPageByTag)
        .mockReturnValueOnce(stalePage)
        .mockResolvedValue(makePage([newLora]))
      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage([newLora])
      )

      const staleRequest = store.updateModelsForTag('models')
      completeLoraDownload()
      await nextTick()

      resolveStalePage(makePage([]))
      await staleRequest

      await vi.waitFor(() =>
        expect(store.getAssets('tag:models').map((a) => a.id)).toEqual([
          'new-lora'
        ])
      )
      expect(store.isModelLoading('tag:models')).toBe(false)
      expect(modelsTagCalls()).toHaveLength(2)
    })

    it('keeps the replacement models when the cancelled request answers late', async () => {
      const store = useAssetsStore()
      const olderLora = createMockAsset('older-lora', ['models', 'loras'])
      const newLora = createMockAsset('new-lora', ['models', 'loras'])

      let resolveCancelledPage!: (page: AssetResponse) => void
      const cancelledPage = new Promise<AssetResponse>((resolve) => {
        resolveCancelledPage = resolve
      })
      vi.mocked(assetService.getAssetsPageByTag)
        .mockResolvedValueOnce(makePage([olderLora]))
        .mockReturnValueOnce(cancelledPage)
        .mockResolvedValue(makePage([olderLora, newLora]))
      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage([olderLora, newLora])
      )

      await store.updateModelsForTag('models')
      expect(store.getAssets('tag:models').map((a) => a.id)).toEqual([
        'older-lora'
      ])

      const cancelledRequest = store.updateModelsForTag('models')
      completeLoraDownload()
      await vi.waitFor(() =>
        expect(store.getAssets('tag:models').map((a) => a.id)).toContain(
          'new-lora'
        )
      )

      resolveCancelledPage(makePage([olderLora]))
      await cancelledRequest
      await settleMicrotasks()

      expect(store.getAssets('tag:models').map((a) => a.id)).toEqual([
        'older-lora',
        'new-lora'
      ])
      expect(store.isModelLoading('tag:models')).toBe(false)
    })

    it('stays loading while a restart supersedes an initial load', async () => {
      const store = useAssetsStore()
      const newLora = createMockAsset('new-lora', ['models', 'loras'])

      let resolveFreshPage!: (page: AssetResponse) => void
      const freshPage = new Promise<AssetResponse>((resolve) => {
        resolveFreshPage = resolve
      })
      vi.mocked(assetService.getAssetsPageByTag)
        .mockImplementationOnce(
          (_tag, _includePublic, options) =>
            new Promise<AssetResponse>((_resolve, reject) => {
              options?.signal?.addEventListener('abort', () =>
                reject(new DOMException('Aborted', 'AbortError'))
              )
            })
        )
        .mockResolvedValueOnce(makePage([newLora]))
        .mockReturnValueOnce(freshPage)
      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage([newLora])
      )

      const initialLoad = store.updateModelsForTag('models')
      completeLoraDownload()
      await nextTick()
      expect(modelsTagCalls()).toHaveLength(2)
      await settleMicrotasks()

      expect(store.isModelLoading('tag:models')).toBe(true)

      resolveFreshPage(makePage([newLora]))
      await initialLoad

      expect(store.getAssets('tag:models').map((a) => a.id)).toEqual([
        'new-lora'
      ])
      expect(store.isModelLoading('tag:models')).toBe(false)
    })

    describe('when a restart supersedes a running refresh', () => {
      const queueModelPages = () => {
        const pages: PendingPage[] = []
        vi.mocked(assetService.getAssetsPageByTag).mockImplementation(
          (_tag, _includePublic, options) =>
            abortablePage(pages, options?.signal)
        )
        return pages
      }

      const recordSettlement = (
        store: ReturnType<typeof useAssetsStore>,
        settlements: string[][],
        refresh: Promise<void>
      ) =>
        refresh.then(() => {
          settlements.push(store.getAssets('tag:models').map((a) => a.id))
        })

      const expectCallerAndJoinerToWaitForReplacement = async (
        store: ReturnType<typeof useAssetsStore>,
        pages: PendingPage[]
      ) => {
        const settlements: string[][] = []
        const waiters = [
          recordSettlement(
            store,
            settlements,
            store.updateModelsForTag('models')
          ),
          recordSettlement(
            store,
            settlements,
            store.updateModelsForTag('models')
          )
        ]
        const replacement = store.updateModelsForTag('models', {
          restart: true
        })
        await settleMicrotasks()

        expect(settlements).toEqual([])

        pages.at(-1)!.resolve(makePage([createMockAsset('new-lora')]))
        await Promise.all([...waiters, replacement])

        expect(settlements).toEqual([['new-lora'], ['new-lora']])
        expect(store.isModelLoading('tag:models')).toBe(false)
      }

      it('keeps the caller and a joiner waiting for the replacement of an initial load', async () => {
        const store = useAssetsStore()
        const pages = queueModelPages()

        await expectCallerAndJoinerToWaitForReplacement(store, pages)
      })

      it('keeps the caller and a joiner waiting for the replacement of a refresh over listed models', async () => {
        const store = useAssetsStore()
        const pages = queueModelPages()
        const firstLoad = store.updateModelsForTag('models')
        pages[0].resolve(makePage([createMockAsset('old')]))
        await firstLoad

        await expectCallerAndJoinerToWaitForReplacement(store, pages)
      })

      it('keeps every waiter attached across a second restart', async () => {
        const store = useAssetsStore()
        const pages = queueModelPages()
        const settlements: string[][] = []

        const original = recordSettlement(
          store,
          settlements,
          store.updateModelsForTag('models')
        )
        void store.updateModelsForTag('models', { restart: true })
        const joinerOfFirstReplacement = recordSettlement(
          store,
          settlements,
          store.updateModelsForTag('models')
        )
        const secondReplacement = store.updateModelsForTag('models', {
          restart: true
        })
        await settleMicrotasks()

        expect(settlements).toEqual([])

        pages[2].resolve(makePage([createMockAsset('new-lora')]))
        await Promise.all([
          original,
          joinerOfFirstReplacement,
          secondReplacement
        ])

        expect(settlements).toEqual([['new-lora'], ['new-lora']])
        expect(store.isModelLoading('tag:models')).toBe(false)
      })

      it('records a failed replacement without rejecting the waiters', async () => {
        const store = useAssetsStore()
        const pages = queueModelPages()
        const failure = new Error('offline')

        const caller = store.updateModelsForTag('models')
        const joiner = store.updateModelsForTag('models')
        const replacement = store.updateModelsForTag('models', {
          restart: true
        })
        await settleMicrotasks()
        pages[1].reject(failure)

        await expect(
          Promise.all([caller, joiner, replacement])
        ).resolves.toBeDefined()
        expect(store.getError('tag:models')).toBe(failure)
        expect(store.isModelLoading('tag:models')).toBe(false)
      })

      it('releases the waiters when the category is invalidated during the replacement', async () => {
        const store = useAssetsStore()
        queueModelPages()

        const caller = store.updateModelsForTag('models')
        const replacement = store.updateModelsForTag('models', {
          restart: true
        })
        store.invalidateCategory('tag:models')

        await expect(Promise.all([caller, replacement])).resolves.toBeDefined()
      })

      it('keeps a node type refresh waiting when an import completes during it', async () => {
        const store = useAssetsStore()
        const pages: PendingPage[] = []
        vi.mocked(assetService.getAssetsPageForNodeType).mockImplementation(
          (_nodeType, options) => abortablePage(pages, options?.signal)
        )
        vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
          makePage([])
        )
        const settlements: string[][] = []

        const refresh = store.updateModelsForNodeType('LoraLoader').then(() => {
          settlements.push(store.getAssets('LoraLoader').map((a) => a.id))
        })
        completeLoraDownload()
        await nextTick()
        await settleMicrotasks()

        expect(settlements).toEqual([])

        pages.at(-1)!.resolve(makePage([createMockAsset('installed-lora')]))
        await refresh

        expect(settlements).toEqual([['installed-lora']])
      })

      it('sends one request per category when an import completes during a fetch', async () => {
        const store = useAssetsStore()
        const pages: PendingPage[] = []
        vi.mocked(assetService.getAssetsPageForNodeType).mockImplementation(
          (_nodeType, options) => abortablePage(pages, options?.signal)
        )
        vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
          makePage([])
        )

        const refresh = store.updateModelsForNodeType('LoraLoader')
        expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledOnce()

        completeLoraDownload()
        await nextTick()
        await settleMicrotasks()

        expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(2)

        pages.at(-1)!.resolve(makePage([createMockAsset('installed-lora')]))
        await refresh

        expect(
          ['LoraLoader', 'LoraLoaderModelOnly'].map((nodeType) =>
            store.getAssets(nodeType).map((a) => a.id)
          )
        ).toEqual([['installed-lora'], ['installed-lora']])
      })
    })

    it('joins the in-flight models fetch when no restart is requested', async () => {
      const store = useAssetsStore()

      let resolvePage!: (page: AssetResponse) => void
      const page = new Promise<AssetResponse>((resolve) => {
        resolvePage = resolve
      })
      vi.mocked(assetService.getAssetsPageByTag).mockReturnValueOnce(page)

      const first = store.updateModelsForTag('models')
      const second = store.updateModelsForTag('models')
      resolvePage(makePage([createMockAsset('existing')]))
      await Promise.all([first, second])

      expect(assetService.getAssetsPageByTag).toHaveBeenCalledOnce()
      expect(store.getAssets('tag:models').map((a) => a.id)).toEqual([
        'existing'
      ])
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
      expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(1)
    })

    it('should return empty array for unknown node types', () => {
      const store = useAssetsStore()
      expect(store.getAssets('UnknownNodeType')).toEqual([])
    })

    it('should not fetch for unknown node types', async () => {
      const store = useAssetsStore()
      await store.updateModelsForNodeType('UnknownNodeType')
      expect(assetService.getAssetsPageForNodeType).not.toHaveBeenCalled()
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

      await store.updateAssetMetadata(
        original,
        { note: 'will be reverted' },
        'CheckpointLoaderSimple'
      )

      const cached = store.getAssets('CheckpointLoaderSimple')[0]
      expect(cached.user_metadata).toEqual({ note: 'before' })
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

      expect(assetService.addAssetTags).not.toHaveBeenCalled()
      expect(assetService.removeAssetTags).not.toHaveBeenCalled()
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

      expect(assetService.addAssetTags).toHaveBeenCalledWith('tags-add-only', [
        'featured'
      ])
      expect(assetService.removeAssetTags).not.toHaveBeenCalled()
      expect(store.getAssets('CheckpointLoaderSimple')[0].tags).toEqual([
        'models',
        'featured'
      ])
    })
  })

  describe('updateAssetTags partial-failure compensation', () => {
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

      expect(assetService.addAssetTags).toHaveBeenNthCalledWith(
        1,
        'tags-partial-fail',
        ['checkpoints']
      )
      expect(assetService.addAssetTags).toHaveBeenNthCalledWith(
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
      expect(assetService.addAssetTags).toHaveBeenCalledTimes(2)
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

      expect(assetService.addAssetTags).toHaveBeenCalledTimes(1)
      expect(assetService.removeAssetTags).not.toHaveBeenCalled()
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

      expect(assetService.addAssetTags).toHaveBeenCalledTimes(1)
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

      expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(2)
      expect(assetService.getAssetsPageForNodeType).toHaveBeenNthCalledWith(
        1,
        nodeType,
        {
          limit: 500,
          offset: 0,
          signal: expect.any(AbortSignal)
        }
      )
      expect(assetService.getAssetsPageForNodeType).toHaveBeenNthCalledWith(
        2,
        nodeType,
        {
          limit: 500,
          after: 'cursor-1',
          signal: expect.any(AbortSignal)
        }
      )
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

      expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(1)
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

      expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(2)
      expect(store.getAssets(nodeType)).toHaveLength(2)
    })

    it('terminates on an empty page even when has_more is true', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(
        makePage([], { has_more: true, next_cursor: 'cursor-1' })
      )

      await store.updateModelsForNodeType(nodeType)

      expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(1)
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

      expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(2)
      expect(assetService.getAssetsPageForNodeType).toHaveBeenNthCalledWith(
        2,
        nodeType,
        {
          limit: 500,
          offset: 500,
          signal: expect.any(AbortSignal)
        }
      )
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

      expect(assetService.getAssetsPageForNodeType).toHaveBeenNthCalledWith(
        3,
        nodeType,
        {
          limit: 500,
          offset: 0,
          signal: expect.any(AbortSignal)
        }
      )
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
        expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(1)
      )
      store.invalidateCategory('checkpoints')

      await walk

      expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(1)
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
        expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(1)
      )

      // Abort walk A, then start walk B before A's teardown runs.
      store.invalidateCategory('checkpoints')
      const walkB = store.updateModelsForNodeType(nodeType)
      await vi.waitFor(() =>
        expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(2)
      )

      // Let walk A's aborted teardown settle; it must not delete walk B's guard.
      await walkA

      // A concurrent call must dedupe into walk B, not start a duplicate fetch.
      const walkC = store.updateModelsForNodeType(nodeType)
      resolveB(makePage([createMockAsset('b1')]))
      await Promise.all([walkB, walkC])

      expect(assetService.getAssetsPageForNodeType).toHaveBeenCalledTimes(2)
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

      expect(assetService.getAssetsPageByTag).toHaveBeenCalledTimes(2)
      expect(assetService.getAssetsPageByTag).toHaveBeenNthCalledWith(
        1,
        'models',
        true,
        {
          limit: 500,
          offset: 0,
          signal: expect.any(AbortSignal)
        }
      )
      expect(assetService.getAssetsPageByTag).toHaveBeenNthCalledWith(
        2,
        'models',
        true,
        {
          limit: 500,
          after: 'cursor-tag',
          signal: expect.any(AbortSignal)
        }
      )
      expect(store.getAssets('tag:models')).toHaveLength(2)
    })
  })
})

describe('assetsStore - Model Assets Cache (non-cloud)', () => {
  beforeEach(() => {
    mockIsCloud.value = false
  })

  it('caches model assets fetched by tag on non-cloud builds', async () => {
    const store = useAssetsStore()
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue({
      assets: [
        fromPartial({
          id: 'm1',
          name: 'sd_xl_base_1.0.safetensors',
          tags: ['checkpoints', 'models']
        }),
        fromPartial({
          id: 'm2',
          name: 'lora.safetensors',
          tags: ['loras', 'models']
        })
      ],
      total: 2,
      has_more: false
    })

    await store.updateModelsForTag('models')

    expect(assetService.getAssetsPageByTag).toHaveBeenCalledWith(
      'models',
      true,
      expect.anything()
    )
    expect(store.getAssets('tag:models')).toHaveLength(2)
  })
})

describe('assetsStore - Deletion State and Input Mapping', () => {
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
})

describe('assetsStore - assets.seed.completed', () => {
  const seed = { created: 0, elapsed: 0, enriched: 0, skipped: 0, total: 0 }
  const invalidated = { invalidate: 1, loadNew: 0 }

  it.for([
    {
      case: 'full phase invalidates',
      detail: { phase: 'full', created: 2, enriched: 2 },
      calls: invalidated
    },
    {
      case: 'enrich phase invalidates even with no enriched count',
      detail: { phase: 'enrich' },
      calls: invalidated
    },
    {
      case: 'fast phase with new assets loads new',
      detail: { phase: 'fast', created: 2 },
      calls: { invalidate: 0, loadNew: 1 }
    },
    {
      case: 'fast phase with nothing created does nothing',
      detail: { phase: 'fast' },
      calls: { invalidate: 0, loadNew: 0 }
    }
  ] as const)('$case', async ({ detail, calls }) => {
    const store = useAssetsStore()
    const pagedList = () => ({
      items: [],
      hasMore: false,
      isLoading: false,
      loadMore: vi.fn(async () => false),
      loadNew: vi.fn(async () => {}),
      invalidate: vi.fn(async () => {})
    })
    const lists = [pagedList(), pagedList()]
    ;[store.inputAssets, store.outputAssets] = lists
    const handler = vi
      .mocked(api.addEventListener)
      .mock.calls.findLast(([type]) => type === 'assets.seed.completed')?.[1]
    if (typeof handler !== 'function') throw new Error('no listener')

    await handler(
      new CustomEvent('assets.seed.completed', {
        detail: { ...seed, ...detail }
      })
    )

    expect(
      lists.map((list) => ({
        invalidate: list.invalidate.mock.calls.length,
        loadNew: list.loadNew.mock.calls.length
      }))
    ).toEqual([calls, calls])
  })
})

describe('deployment Model Library', () => {
  function asset(
    id: string,
    category = 'loras',
    loaderPath = `${id}.safetensors`
  ): AssetItem {
    return {
      id,
      name: 'uploaded.safetensors',
      loader_path: loaderPath,
      tags: ['models', category],
      created_at: '2026-11-06T00:00:00Z',
      updated_at: '2026-11-06T00:00:00Z',
      is_immutable: false,
      user_metadata: { filename: 'uploaded.safetensors' }
    }
  }

  function page(assets: AssetItem[], next_cursor?: string): AssetResponse {
    return {
      assets,
      total: assets.length,
      has_more: next_cursor !== undefined,
      next_cursor
    }
  }

  beforeEach(() => {
    mockIsCloud.value = true
    vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = true
    vi.spyOn(useTeamWorkspaceStore(), 'workspaceId', 'get').mockReturnValue(
      'workspace-1'
    )
    useDeploymentPickStore().bootDeployment = {
      deployment_id: 'deployment-1',
      release_id: 'release-1',
      status: 'ready',
      can_start: false,
      created_at: '2026-11-06T00:00:00Z'
    }
    return () => {
      mockIsCloud.value = false
    }
  })

  it.for([false, true])(
    'walks both sources and keeps Release collisions in model type mode %s',
    async (modelTypeMode) => {
      vi.mocked(useFeatureFlags().flags).supportsModelTypeTags = modelTypeMode
      const release = {
        ...asset('release', 'loras', 'shared.safetensors'),
        is_immutable: true
      }
      const collision = asset('collision', 'loras', 'shared.safetensors')
      const otherCategory = asset(
        'other-category',
        'checkpoints',
        'shared.safetensors'
      )
      const upload = asset('upload', 'loras', 'style.safetensors')
      const releaseLast = asset('release-last')
      const withTypes = (row: AssetItem) =>
        modelTypeMode
          ? {
              ...row,
              tags: [
                ...row.tags,
                ...row.tags
                  .filter((tag) => tag !== 'models')
                  .map((tag) => `model_type:${tag}`)
              ]
            }
          : row
      vi.mocked(assetService.getAssetsPageByTag).mockImplementation(
        async (_tag, _public, options) =>
          options?.after === 'release-next'
            ? page([withTypes(releaseLast)])
            : page([withTypes(release)], 'release-next')
      )
      vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockImplementation(
        async (options) =>
          options?.after === 'library-next'
            ? page([withTypes(upload)])
            : page(
                [withTypes(collision), withTypes(otherCategory)],
                'library-next'
              )
      )
      const store = useAssetsStore()
      await store.updateModelsForTag('models')
      expect(store.getAssets('tag:models')).toEqual([
        withTypes(release),
        withTypes(releaseLast),
        { ...withTypes(upload), isWorkspaceLibrary: true },
        { ...withTypes(otherCategory), isWorkspaceLibrary: true }
      ])
      expect(store.hasMore('tag:models')).toBe(false)
    }
  )

  it.for([
    { transition: 'workspace', nextWorkspace: 'workspace-2', nextIdentity: 1 },
    { transition: 'identity', nextWorkspace: 'workspace-1', nextIdentity: 2 }
  ])(
    'clears private cards and rejects pending reads after a $transition change',
    async ({ nextWorkspace, nextIdentity }) => {
      const workspace = ref('workspace-1')
      const identity = ref(1)
      const workspaceStore = useTeamWorkspaceStore()
      vi.spyOn(workspaceStore, 'workspaceId', 'get').mockImplementation(
        () => workspace.value
      )
      vi.spyOn(workspaceStore, 'identityGeneration', 'get').mockImplementation(
        () => identity.value
      )
      vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(page([]))
      vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockResolvedValue(
        page([asset('private')])
      )
      const store = useAssetsStore()
      await store.updateModelsForTag('models')
      let resolveOld!: (response: AssetResponse) => void
      vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve
        })
      )
      const pending = store.updateModelsForTag('models', { restart: true })
      workspace.value = nextWorkspace
      identity.value = nextIdentity
      expect(store.getAssets('tag:models')).toEqual([])
      let resolveNew!: (response: AssetResponse) => void
      vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveNew = resolve
        })
      )
      const current = store.updateModelsForTag('models')
      resolveOld(page([asset('stale-private')]))
      await pending
      expect(store.isModelLoading('tag:models')).toBe(true)
      expect(store.getError('tag:models')).toBeUndefined()
      expect(store.getAssets('tag:models')).toEqual([])
      resolveNew(page([asset('current-private')]))
      await current
      expect(store.getAssets('tag:models')).toEqual([
        { ...asset('current-private'), isWorkspaceLibrary: true }
      ])
      expect(store.isModelLoading('tag:models')).toBe(false)
    }
  )

  it('keeps only the runtime winner for each folder and name across pages', async () => {
    const old = {
      ...asset('old', 'loras', 'style.safetensors'),
      created_at: '2026-11-01T00:00:00Z'
    }
    const winner = asset('winner', 'loras', 'style.safetensors')
    const tied = asset('tied', 'loras', 'style.safetensors')
    const other = asset('other', 'checkpoints', 'style.safetensors')
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(page([]))
    vi.mocked(assetService.getWorkspaceLibraryAssetsPage)
      .mockResolvedValueOnce(page([old, tied, other], 'next'))
      .mockResolvedValueOnce(page([winner]))
    const store = useAssetsStore()
    await store.updateModelsForTag('models')
    expect(store.getAssets('tag:models').map((row) => row.id)).toEqual([
      'winner',
      'other'
    ])
  })

  it.for([
    { modelTypeMode: false, source: 'library' },
    { modelTypeMode: true, source: 'library' },
    { modelTypeMode: true, source: 'release' }
  ])(
    'keeps unshadowed memberships after a $source collision in type mode $modelTypeMode',
    async ({ modelTypeMode, source }) => {
      vi.mocked(useFeatureFlags().flags).supportsModelTypeTags = modelTypeMode
      const older = {
        ...asset('older', 'loras', 'style.safetensors'),
        created_at: '2026-11-01T00:00:00Z',
        tags: modelTypeMode
          ? ['models', 'model_type:loras', 'model_type:vae']
          : ['models', 'loras', 'vae']
      }
      const newer = {
        ...asset('newer', 'loras', 'style.safetensors'),
        tags: modelTypeMode
          ? ['models', 'model_type:loras']
          : ['models', 'loras']
      }
      vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
        page(source === 'release' ? [newer] : [])
      )
      vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockResolvedValue(
        page(source === 'release' ? [older] : [older, newer])
      )
      const store = useAssetsStore()
      await store.updateModelsForTag('models')
      const cards = store.getAssets('tag:models')
      expect(
        cards.map((card) => ({
          id: card.id,
          categories: getAssetCategories(card, modelTypeMode)
        }))
      ).toEqual([
        { id: 'newer', categories: ['loras'] },
        { id: 'older', categories: ['vae'] }
      ])
      expect(cards.find((card) => card.id === 'older')?.tags).toEqual(
        older.tags
      )
    }
  )

  it.for([
    { category: 'loras', name: 'legacy.ckpt' },
    { category: 'loras', name: 'nested/style.safetensors' },
    { category: 'ipadapter', name: 'style.safetensors' }
  ])(
    'omits library models the deployment cannot download: $category/$name',
    async ({ category, name }) => {
      vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
        page([asset('release')])
      )
      vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockResolvedValue(
        page([asset('unloadable', category, name), asset('valid')])
      )
      const store = useAssetsStore()
      await store.updateModelsForTag('models')
      expect(store.getAssets('tag:models').map((row) => row.id)).toEqual([
        'release',
        'valid'
      ])
    }
  )

  it('clears cached library cards and pending reads when runtime support is disabled', async () => {
    const flags = vi.mocked(useFeatureFlags().flags)
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
      page([asset('release')])
    )
    vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockResolvedValueOnce(
      page([asset('private')])
    )
    const store = useAssetsStore()
    await store.updateModelsForTag('models')
    let resolveOld!: (response: AssetResponse) => void
    vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve
      })
    )
    const pending = store.updateModelsForTag('models', { restart: true })
    flags.runtimeLibraryModelsEnabled = false
    expect(store.getAssets('tag:models').map((row) => row.id)).toEqual([
      'release'
    ])
    await store.updateModelsForTag('models')
    expect(assetService.getWorkspaceLibraryAssetsPage).toHaveBeenCalledTimes(2)
    flags.runtimeLibraryModelsEnabled = true
    resolveOld(page([asset('stale-private')]))
    await pending
    expect(store.getAssets('tag:models').map((row) => row.id)).toEqual([
      'release'
    ])
    vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockResolvedValueOnce(
      page([asset('fresh')])
    )
    await store.updateModelsForTag('models')
    expect(store.getAssets('tag:models').map((row) => row.id)).toEqual([
      'release',
      'fresh'
    ])
  })

  it('reports a rejected teammate metadata save and restores the original details', async () => {
    const teammate = asset('teammate')
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(page([]))
    vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockResolvedValue(
      page([teammate])
    )
    vi.mocked(assetService.updateAsset).mockRejectedValueOnce(
      new Error('Asset not found')
    )
    const store = useAssetsStore()
    await store.updateModelsForTag('models')
    const result = await store.updateAssetMetadata(
      teammate,
      { name: 'changed' },
      'tag:models'
    )
    expect(result).toBe(false)
    expect(store.getAssets('tag:models')[0].user_metadata).toEqual(
      teammate.user_metadata
    )
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'error',
        title: expect.stringContaining('save')
      })
    ])
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        surface: 'assets',
        errorType: 'error_updating_asset_metadata'
      })
    )
  })

  it('keeps Release cards and reports a failed library read', async () => {
    const release = asset('release')
    const error = new Error('library unavailable')
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
      page([release])
    )
    vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockRejectedValue(
      error
    )
    const store = useAssetsStore()
    await store.updateModelsForTag('models')
    expect(store.getAssets('tag:models')).toEqual([release])
    expect(store.getError('tag:models')).toBe(error)
    expect(reportError).toHaveBeenCalledWith(error, {
      surface: 'assets',
      errorType: 'error_loading_workspace_library_models'
    })
  })

  it('ignores an older library response after a refresh replaces it', async () => {
    let resolveOld!: (response: AssetResponse) => void
    const old = new Promise<AssetResponse>((resolve) => {
      resolveOld = resolve
    })
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
      page([asset('release')])
    )
    vi.mocked(assetService.getWorkspaceLibraryAssetsPage)
      .mockReturnValueOnce(old)
      .mockResolvedValue(page([asset('new-upload')]))
    const store = useAssetsStore()
    const first = store.updateModelsForTag('models')
    await store.updateModelsForTag('models', { restart: true })
    resolveOld(page([asset('old-upload')]))
    await first
    expect(store.getAssets('tag:models').map((row) => row.id)).toEqual([
      'release',
      'new-upload'
    ])
  })

  it('shows a completed upload without reopening the library', async () => {
    const store = useAssetsStore()
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
      page([asset('release')])
    )
    vi.mocked(assetService.getAssetsPageForNodeType).mockResolvedValue(page([]))
    vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockResolvedValue(
      page([])
    )
    await store.updateModelsForTag('models')
    vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockResolvedValue(
      page([asset('finished-upload')])
    )
    useAssetDownloadStore().lastCompletedDownload = {
      taskId: 'finished-upload',
      modelType: 'loras',
      timestamp: Date.now()
    }
    await nextTick()
    await vi.waitFor(() =>
      expect(store.getAssets('tag:models').map((row) => row.id)).toEqual([
        'release',
        'finished-upload'
      ])
    )
  })

  it('drops a canceled library response after invalidation', async () => {
    let resolveOld!: (response: AssetResponse) => void
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
      page([asset('release')])
    )
    vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockReturnValue(
      new Promise((resolve) => {
        resolveOld = resolve
      })
    )
    const store = useAssetsStore()
    const pending = store.updateModelsForTag('models')
    store.invalidateCategory('tag:models')
    resolveOld(page([asset('canceled-upload')]))
    await pending
    expect(store.getAssets('tag:models')).toEqual([])
  })

  it('updates library metadata and model type through the visible cache key and removes deleted cards on refresh', async () => {
    const upload = asset('upload')
    vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(page([]))
    vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockResolvedValue(
      page([upload])
    )
    vi.mocked(assetService.updateAsset).mockResolvedValue({
      ...upload,
      user_metadata: { name: 'My model' }
    })
    vi.mocked(assetService.removeAssetTags).mockResolvedValue({
      total_tags: ['models']
    })
    vi.mocked(assetService.addAssetTags).mockResolvedValue({
      total_tags: ['models', 'checkpoints']
    })
    const store = useAssetsStore()
    await store.updateModelsForTag('models')
    await store.updateAssetMetadata(upload, { name: 'My model' }, 'tag:models')
    expect(store.getAssets('tag:models')[0].user_metadata).toEqual({
      name: 'My model'
    })
    await store.updateAssetTags(upload, ['models', 'checkpoints'], 'tag:models')
    expect(store.getAssets('tag:models')[0].tags).toEqual([
      'models',
      'checkpoints'
    ])
    vi.mocked(assetService.getWorkspaceLibraryAssetsPage).mockResolvedValue(
      page([])
    )
    await store.updateModelsForTag('models')
    expect(store.getAssets('tag:models')).toEqual([])
  })

  it.for(['cloud', 'local'])(
    'keeps the existing list on %s without reading the library',
    async (distribution) => {
      if (distribution === 'cloud')
        useDeploymentPickStore().bootDeployment = null
      else mockIsCloud.value = false
      const existing = asset('existing')
      vi.mocked(assetService.getAssetsPageByTag).mockResolvedValue(
        page([existing])
      )
      const store = useAssetsStore()
      await store.updateModelsForTag('models')
      expect(store.getAssets('tag:models')).toEqual([existing])
      expect(assetService.getWorkspaceLibraryAssetsPage).not.toHaveBeenCalled()
    }
  )
})
