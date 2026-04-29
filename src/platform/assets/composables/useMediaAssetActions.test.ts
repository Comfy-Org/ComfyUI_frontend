import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, provide, ref } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { MediaAssetKey } from '@/platform/assets/schemas/mediaAssetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { AssetMeta } from '@/platform/assets/schemas/mediaAssetSchema'
import { useMediaAssetActions } from './useMediaAssetActions'

// Use vi.hoisted to create a mutable reference for isCloud
const mockIsCloud = vi.hoisted(() => ({ value: false }))

// Track the filename passed to createAnnotatedPath
const capturedFilenames = vi.hoisted(() => ({ values: [] as string[] }))

const mockDownloadFile = vi.hoisted(() => vi.fn())
vi.mock('@/base/common/downloadUtil', () => ({
  downloadFile: mockDownloadFile
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const mockToastAdd = vi.hoisted(() => vi.fn())
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, count?: number) =>
      count !== undefined ? `${key}:${count}` : key
  }),
  createI18n: () => ({
    global: {
      t: (key: string, count?: number) =>
        count !== undefined ? `${key}:${count}` : key
    }
  })
}))

const mockShowDialog = vi.hoisted(() => vi.fn())
vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    showDialog: mockShowDialog
  })
}))

const mockInvalidateModelsForCategory = vi.hoisted(() => vi.fn())
const mockSetAssetDeleting = vi.hoisted(() => vi.fn())
const mockUpdateHistory = vi.hoisted(() => vi.fn())
const mockUpdateInputs = vi.hoisted(() => vi.fn())
const mockHasCategory = vi.hoisted(() => vi.fn())
vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    setAssetDeleting: mockSetAssetDeleting,
    updateHistory: mockUpdateHistory,
    updateInputs: mockUpdateInputs,
    invalidateModelsForCategory: mockInvalidateModelsForCategory,
    hasCategory: mockHasCategory
  })
}))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({})
}))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copyToClipboard: vi.fn()
  })
}))

vi.mock('@/platform/workflow/core/services/workflowActionsService', () => ({
  useWorkflowActionsService: () => ({
    openWorkflowAction: vi.fn(),
    exportWorkflowAction: vi.fn()
  })
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({
    addNodeOnGraph: vi.fn().mockReturnValue(
      fromAny<LGraphNode, unknown>({
        widgets: [{ name: 'image', value: '', callback: vi.fn() }],
        graph: { setDirtyCanvas: vi.fn() }
      })
    ),
    getCanvasCenter: vi.fn().mockReturnValue([100, 100])
  })
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    nodeDefsByName: {
      LoadImage: {
        name: 'LoadImage',
        display_name: 'Load Image'
      }
    }
  })
}))

vi.mock('@/utils/createAnnotatedPath', () => ({
  createAnnotatedPath: vi.fn((item: { filename: string }) => {
    capturedFilenames.values.push(item.filename)
    return item.filename
  })
}))

vi.mock('@/utils/loaderNodeUtil', () => ({
  detectNodeTypeFromFilename: vi.fn().mockReturnValue({
    nodeType: 'LoadImage',
    widgetName: 'image'
  })
}))

vi.mock('@/utils/typeGuardUtil', () => ({
  isResultItemType: vi.fn().mockReturnValue(true)
}))

const mockGetAssetType = vi.hoisted(() => vi.fn())
vi.mock('@/platform/assets/utils/assetTypeUtil', () => ({
  getAssetType: mockGetAssetType
}))

const mockGetOutputAssetMetadata = vi.hoisted(() =>
  vi.fn().mockReturnValue(null)
)
vi.mock('../schemas/assetMetadataSchema', () => ({
  getOutputAssetMetadata: mockGetOutputAssetMetadata
}))

const mockDeleteAsset = vi.hoisted(() => vi.fn())
const mockCreateAssetExport = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ task_id: 'test-task-id', status: 'pending' })
)
vi.mock('../services/assetService', () => ({
  assetService: {
    deleteAsset: mockDeleteAsset,
    createAssetExport: mockCreateAssetExport
  }
}))

const mockTrackExport = vi.hoisted(() => vi.fn())
vi.mock('@/stores/assetExportStore', () => ({
  useAssetExportStore: () => ({
    trackExport: mockTrackExport
  })
}))

vi.mock('@/scripts/api', () => ({
  api: {
    deleteItem: vi.fn(),
    apiURL: vi.fn((path: string) => `http://localhost:8188/api${path}`),
    internalURL: vi.fn((path: string) => `http://localhost:8188${path}`),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    user: 'test-user'
  }
}))

function createMockAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'test-asset-id',
    name: 'original-name.jpeg',
    size: 1024,
    created_at: '2025-01-01T00:00:00Z',
    tags: ['input'],
    ...overrides
  }
}

function createMockMediaAsset(overrides: Partial<AssetMeta> = {}): AssetMeta {
  return {
    ...createMockAsset(),
    kind: 'image',
    src: 'https://example.com/default-preview.png',
    ...overrides
  }
}

function mountMediaActions(asset?: AssetMeta) {
  let actions: ReturnType<typeof useMediaAssetActions> | undefined

  const ChildComponent = defineComponent({
    setup() {
      actions = useMediaAssetActions()
      return () => null
    }
  })

  const HostComponent = defineComponent({
    setup() {
      provide(MediaAssetKey, {
        asset: ref(asset),
        context: ref({ type: 'input' as const }),
        isVideoPlaying: ref(false),
        showVideoControls: ref(false)
      })
      return () => h(ChildComponent)
    }
  })

  const host = document.createElement('div')
  const app = createApp(HostComponent)
  app.mount(host)

  if (!actions) throw new Error('media asset actions not initialized')

  return {
    actions,
    unmount: () => app.unmount()
  }
}

describe('useMediaAssetActions', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    capturedFilenames.values = []
    mockIsCloud.value = false
    mockGetOutputAssetMetadata.mockReset()
    mockGetOutputAssetMetadata.mockReturnValue(null)
    mockGetAssetType.mockReset()
  })

  describe('addWorkflow', () => {
    describe('OSS mode (isCloud = false)', () => {
      beforeEach(() => {
        mockIsCloud.value = false
      })

      it('should use asset.name as filename', async () => {
        const actions = useMediaAssetActions()

        const asset = createMockAsset({
          name: 'my-image.jpeg',
          asset_hash: 'hash123.jpeg'
        })

        await actions.addWorkflow(asset)

        expect(capturedFilenames.values).toContain('my-image.jpeg')
      })
    })

    describe('Cloud mode (isCloud = true)', () => {
      beforeEach(() => {
        mockIsCloud.value = true
      })

      it('should use asset_hash as filename when available', async () => {
        const actions = useMediaAssetActions()

        const asset = createMockAsset({
          name: 'original.jpeg',
          asset_hash: 'abc123hash.jpeg'
        })

        await actions.addWorkflow(asset)

        expect(capturedFilenames.values).toContain('abc123hash.jpeg')
      })

      it('should fall back to asset.name when asset_hash is not available', async () => {
        const actions = useMediaAssetActions()

        const asset = createMockAsset({
          name: 'fallback-name.jpeg',
          asset_hash: undefined
        })

        await actions.addWorkflow(asset)

        expect(capturedFilenames.values).toContain('fallback-name.jpeg')
      })

      it('should fall back to asset.name when asset_hash is null', async () => {
        const actions = useMediaAssetActions()

        const asset = createMockAsset({
          name: 'fallback-null.jpeg',
          asset_hash: null
        })

        await actions.addWorkflow(asset)

        expect(capturedFilenames.values).toContain('fallback-null.jpeg')
      })
    })
  })

  describe('addMultipleToWorkflow', () => {
    describe('Cloud mode (isCloud = true)', () => {
      beforeEach(() => {
        mockIsCloud.value = true
      })

      it('should use asset_hash for each asset', async () => {
        const actions = useMediaAssetActions()

        const assets = [
          createMockAsset({
            id: '1',
            name: 'file1.jpeg',
            asset_hash: 'hash1.jpeg'
          }),
          createMockAsset({
            id: '2',
            name: 'file2.jpeg',
            asset_hash: 'hash2.jpeg'
          })
        ]

        await actions.addMultipleToWorkflow(assets)

        expect(capturedFilenames.values).toContain('hash1.jpeg')
        expect(capturedFilenames.values).toContain('hash2.jpeg')
        expect(capturedFilenames.values).not.toContain('file1.jpeg')
        expect(capturedFilenames.values).not.toContain('file2.jpeg')
      })
    })
  })

  describe('downloadAssets', () => {
    it('downloads the injected media asset when called without explicit assets', () => {
      const mediaAsset = createMockMediaAsset({
        id: 'context-asset',
        name: 'context-name.png',
        display_name: 'Context image.png',
        preview_url: 'https://example.com/context-preview.png'
      })

      const { actions, unmount } = mountMediaActions(mediaAsset)
      actions.downloadAssets()

      expect(mockDownloadFile).toHaveBeenCalledOnce()
      expect(mockDownloadFile).toHaveBeenCalledWith(
        'https://example.com/context-preview.png',
        'Context image.png'
      )
      expect(mockCreateAssetExport).not.toHaveBeenCalled()
      expect(mockTrackExport).not.toHaveBeenCalled()

      unmount()
    })

    it('does nothing when called without explicit assets and no media context asset', () => {
      const { actions, unmount } = mountMediaActions()
      actions.downloadAssets()

      expect(mockDownloadFile).not.toHaveBeenCalled()
      expect(mockCreateAssetExport).not.toHaveBeenCalled()
      expect(mockTrackExport).not.toHaveBeenCalled()

      unmount()
    })

    it('keeps single explicit assets on the direct download path in cloud', () => {
      mockIsCloud.value = true
      mockGetOutputAssetMetadata.mockReturnValue({
        jobId: 'job1',
        outputCount: 1
      })

      const asset = createMockAsset({
        id: 'single-output',
        name: 'single-output.png',
        preview_url: 'https://example.com/single-output.png',
        tags: ['output'],
        user_metadata: { jobId: 'job1', outputCount: 1 }
      })

      const actions = useMediaAssetActions()
      actions.downloadAssets([asset])

      expect(mockDownloadFile).toHaveBeenCalledOnce()
      expect(mockDownloadFile).toHaveBeenCalledWith(
        'https://example.com/single-output.png',
        'single-output.png'
      )
      expect(mockCreateAssetExport).not.toHaveBeenCalled()
      expect(mockTrackExport).not.toHaveBeenCalled()
    })

    it('uses ZIP export for an injected single multi-output asset in cloud', async () => {
      mockIsCloud.value = true
      mockGetAssetType.mockReturnValue('output')
      mockGetOutputAssetMetadata.mockReturnValue({
        jobId: 'job1',
        outputCount: 3
      })

      const mediaAsset = createMockMediaAsset({
        id: 'multi-output',
        name: 'multi-output.png',
        preview_url: 'https://example.com/multi-output.png',
        tags: ['output'],
        user_metadata: { jobId: 'job1', outputCount: 3 }
      })

      const { actions, unmount } = mountMediaActions(mediaAsset)
      actions.downloadAssets()

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      expect(mockDownloadFile).not.toHaveBeenCalled()
      expect(mockCreateAssetExport).toHaveBeenCalledWith({
        job_ids: ['job1'],
        naming_strategy: 'preserve'
      })
      expect(mockTrackExport).toHaveBeenCalledWith('test-task-id')

      unmount()
    })
  })

  describe('downloadAssets - cloud zip filters', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      mockCreateAssetExport.mockClear()
      mockTrackExport.mockClear()
      mockGetAssetType.mockReturnValue('output')
      mockGetOutputAssetMetadata.mockImplementation(
        (meta: Record<string, unknown> | undefined) =>
          meta && 'jobId' in meta ? meta : null
      )
    })

    function createOutputAsset(
      id: string,
      name: string,
      jobId: string,
      outputCount?: number
    ): AssetItem {
      return createMockAsset({
        id,
        name,
        tags: ['output'],
        user_metadata: { jobId, nodeId: '1', subfolder: '', outputCount }
      })
    }

    it('should use preserve strategy when selection spans a single job', async () => {
      const assets = [createOutputAsset('a1', 'img1.png', 'job1', 3)]

      const actions = useMediaAssetActions()
      actions.downloadAssets(assets)

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_ids).toEqual(['job1'])
      expect(payload.job_asset_name_filters).toBeUndefined()
      expect(payload.naming_strategy).toBe('preserve')
    })

    it('should omit name filters for multiple job-level selections', async () => {
      const j1a = createOutputAsset('a1', 'out1a.png', 'job1', 2)
      const j1b = createOutputAsset('a2', 'out1b.png', 'job1', 2)
      const j2 = createOutputAsset('a3', 'out2.png', 'job2', 1)

      const actions = useMediaAssetActions()
      actions.downloadAssets([j1a, j1b, j2])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_ids).toEqual(['job1', 'job2'])
      expect(payload.job_asset_name_filters).toBeUndefined()
      expect(payload.naming_strategy).toBe('group_by_job_time')
    })

    it('should include name filters when outputCount is unknown', async () => {
      const asset1 = createOutputAsset('a1', 'img1.png', 'job1')
      const asset2 = createOutputAsset('a2', 'img2.png', 'job2')

      const actions = useMediaAssetActions()
      actions.downloadAssets([asset1, asset2])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_asset_name_filters).toEqual({
        job1: ['img1.png'],
        job2: ['img2.png']
      })
      expect(payload.naming_strategy).toBe('group_by_job_time')
    })

    it('should mix: omit filters for known outputCount, keep for unknown', async () => {
      const j1a = createOutputAsset('a1', 'img1a.png', 'job1', 2)
      const j1b = createOutputAsset('a2', 'img1b.png', 'job1', 2)
      const j2 = createOutputAsset('a3', 'img2.png', 'job2')

      const actions = useMediaAssetActions()
      actions.downloadAssets([j1a, j1b, j2])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_ids).toEqual(['job1', 'job2'])
      expect(payload.job_asset_name_filters).toEqual({
        job2: ['img2.png']
      })
      expect(payload.naming_strategy).toBe('group_by_job_time')
    })

    it('should preserve multiple selected outputs from one job', async () => {
      const asset1 = createOutputAsset('a1', 'img1.png', 'job1')
      const asset2 = createOutputAsset('a2', 'img2.png', 'job1')

      const actions = useMediaAssetActions()
      actions.downloadAssets([asset1, asset2])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_ids).toEqual(['job1'])
      expect(payload.job_asset_name_filters).toEqual({
        job1: ['img1.png', 'img2.png']
      })
      expect(payload.naming_strategy).toBe('preserve')
    })
  })

  describe('downloadMultipleAssets - export toast file count', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      mockCreateAssetExport.mockClear()
      mockToastAdd.mockClear()
      mockGetAssetType.mockReturnValue('output')
      mockGetOutputAssetMetadata.mockImplementation(
        (meta: Record<string, unknown> | undefined) =>
          meta && 'jobId' in meta ? meta : null
      )
    })

    function createOutputAsset(
      id: string,
      name: string,
      jobId: string,
      outputCount?: number
    ): AssetItem {
      return createMockAsset({
        id,
        name,
        tags: ['output'],
        user_metadata: { jobId, nodeId: '1', subfolder: '', outputCount }
      })
    }

    function getExportToastDetail(): string | undefined {
      const exportToastCall = mockToastAdd.mock.calls.find(
        ([arg]) =>
          typeof arg?.detail === 'string' &&
          arg.detail.startsWith('mediaAsset.selection.exportStarted')
      )
      return exportToastCall?.[0]?.detail
    }

    it('should report total file count, not job count, for multi-output jobs', async () => {
      const j1 = createOutputAsset('a1', 'img1.png', 'job1', 2)
      const j2 = createOutputAsset('a2', 'img2.png', 'job2', 4)

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([j1, j2])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })
      await vi.waitFor(() => {
        expect(getExportToastDetail()).toBeDefined()
      })

      expect(getExportToastDetail()).toBe(
        'mediaAsset.selection.exportStarted:6'
      )
    })

    it('should treat assets without outputCount as a single file', async () => {
      const a1 = createOutputAsset('a1', 'img1.png', 'job1')
      const a2 = createOutputAsset('a2', 'img2.png', 'job2')

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([a1, a2])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })
      await vi.waitFor(() => {
        expect(getExportToastDetail()).toBeDefined()
      })

      expect(getExportToastDetail()).toBe(
        'mediaAsset.selection.exportStarted:2'
      )
    })

    it('should mix multi-output and single-output assets correctly', async () => {
      const j1 = createOutputAsset('a1', 'img1.png', 'job1', 3)
      const a2 = createOutputAsset('a2', 'img2.png', 'job2')

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([j1, a2])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })
      await vi.waitFor(() => {
        expect(getExportToastDetail()).toBeDefined()
      })

      expect(getExportToastDetail()).toBe(
        'mediaAsset.selection.exportStarted:4'
      )
    })
  })

  describe('deleteAssets - model cache invalidation', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      mockGetAssetType.mockReturnValue('input')
      mockDeleteAsset.mockResolvedValue(undefined)
      mockInvalidateModelsForCategory.mockClear()
      mockSetAssetDeleting.mockClear()
      mockUpdateHistory.mockClear()
      mockUpdateInputs.mockClear()
      mockHasCategory.mockClear()
      // By default, hasCategory returns true for model categories
      mockHasCategory.mockImplementation(
        (tag: string) => tag === 'checkpoints' || tag === 'loras'
      )
    })

    it('should invalidate model cache when deleting a model asset', async () => {
      const actions = useMediaAssetActions()

      const modelAsset = createMockAsset({
        id: 'checkpoint-1',
        name: 'model.safetensors',
        tags: ['models', 'checkpoints']
      })

      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: () => Promise<void> } }) => {
          void props.onConfirm()
        }
      )

      await actions.deleteAssets(modelAsset)

      // Only 'checkpoints' exists in cache; 'models' is excluded
      expect(mockInvalidateModelsForCategory).toHaveBeenCalledTimes(1)
      expect(mockInvalidateModelsForCategory).toHaveBeenCalledWith(
        'checkpoints'
      )
    })

    it('should invalidate multiple categories for multiple assets', async () => {
      const actions = useMediaAssetActions()

      const assets = [
        createMockAsset({ id: '1', tags: ['models', 'checkpoints'] }),
        createMockAsset({ id: '2', tags: ['models', 'loras'] })
      ]

      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: () => Promise<void> } }) => {
          void props.onConfirm()
        }
      )

      await actions.deleteAssets(assets)

      expect(mockInvalidateModelsForCategory).toHaveBeenCalledWith(
        'checkpoints'
      )
      expect(mockInvalidateModelsForCategory).toHaveBeenCalledWith('loras')
    })

    it('should not invalidate model cache for non-model assets', async () => {
      const actions = useMediaAssetActions()

      const inputAsset = createMockAsset({
        id: 'input-1',
        name: 'image.png',
        tags: ['input']
      })

      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: () => Promise<void> } }) => {
          void props.onConfirm()
        }
      )

      await actions.deleteAssets(inputAsset)

      // 'input' tag is excluded, so no cache invalidation
      expect(mockInvalidateModelsForCategory).not.toHaveBeenCalled()
    })

    it('should only invalidate categories that exist in cache', async () => {
      const actions = useMediaAssetActions()

      // hasCategory returns false for 'unknown-category'
      mockHasCategory.mockImplementation((tag: string) => tag === 'checkpoints')

      const assets = [
        createMockAsset({ id: '1', tags: ['models', 'checkpoints'] }),
        createMockAsset({ id: '2', tags: ['models', 'unknown-category'] })
      ]

      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: () => Promise<void> } }) => {
          void props.onConfirm()
        }
      )

      await actions.deleteAssets(assets)

      // Only checkpoints should be invalidated (unknown-category not in cache)
      expect(mockInvalidateModelsForCategory).toHaveBeenCalledTimes(1)
      expect(mockInvalidateModelsForCategory).toHaveBeenCalledWith(
        'checkpoints'
      )
    })
  })

  describe('deleteAssets - confirmation dialog item names', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      mockGetAssetType.mockReturnValue('output')
      mockShowDialog.mockReset()
    })

    it('should show user_metadata display names instead of hash filenames', () => {
      const actions = useMediaAssetActions()

      const assets = [
        createMockAsset({
          id: 'asset-1',
          name: 'c885097ab185ced82f017bcbc98948918499f7480315fd5b928b5bb8d4951efc.png',
          user_metadata: { name: 'My Sunset Render' }
        }),
        createMockAsset({
          id: 'asset-2',
          name: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2.png',
          display_name: 'Portrait Variation'
        })
      ]

      void actions.deleteAssets(assets)

      expect(mockShowDialog).toHaveBeenCalledTimes(1)
      const dialogProps = mockShowDialog.mock.calls[0][0].props as {
        itemList: string[]
      }
      expect(dialogProps.itemList).toEqual([
        'My Sunset Render',
        'Portrait Variation'
      ])
    })

    it('should fall back to asset.name when no display name is available', () => {
      const actions = useMediaAssetActions()

      const asset = createMockAsset({
        id: 'asset-3',
        name: 'fallback-image.png'
      })

      void actions.deleteAssets(asset)

      const dialogProps = mockShowDialog.mock.calls[0][0].props as {
        itemList: string[]
      }
      expect(dialogProps.itemList).toEqual(['fallback-image.png'])
    })
  })
})
