import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useMediaAssetActions } from './useMediaAssetActions'

// Use vi.hoisted to create a mutable reference for isCloud
const mockIsCloud = vi.hoisted(() => ({ value: false }))

// Track the filename passed to createAnnotatedPath
const capturedFilenames = vi.hoisted(() => ({ values: [] as string[] }))

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

const mockI18nT = vi.hoisted(() =>
  vi.fn((key: string, count?: number) =>
    typeof count === 'number' ? `${key}:${count}` : key
  )
)
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockI18nT
  }),
  createI18n: () => ({
    global: {
      t: mockI18nT
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

describe('useMediaAssetActions', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    capturedFilenames.values = []
    mockIsCloud.value = false
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

  describe('downloadMultipleAssets - job_asset_name_filters', () => {
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

    it('should omit name filters for job-level selections (outputCount known)', async () => {
      const assets = [
        createOutputAsset('a1', 'img1.png', 'job1', 3),
        createOutputAsset('a2', 'img2.png', 'job1', 3),
        createOutputAsset('a3', 'img3.png', 'job1', 3)
      ]

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets(assets)

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_ids).toEqual(['job1'])
      expect(payload.job_asset_name_filters).toBeUndefined()
    })

    it('should omit name filters for multiple job-level selections', async () => {
      const j1a = createOutputAsset('a1', 'out1a.png', 'job1', 2)
      const j1b = createOutputAsset('a2', 'out1b.png', 'job1', 2)
      const j2 = createOutputAsset('a3', 'out2.png', 'job2', 1)

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([j1a, j1b, j2])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_ids).toEqual(['job1', 'job2'])
      expect(payload.job_asset_name_filters).toBeUndefined()
    })

    it('should include name filters when outputCount is unknown', async () => {
      const asset1 = createOutputAsset('a1', 'img1.png', 'job1')
      const asset2 = createOutputAsset('a2', 'img2.png', 'job2')

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([asset1, asset2])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_asset_name_filters).toEqual({
        job1: ['img1.png'],
        job2: ['img2.png']
      })
    })

    it('should mix: omit filters for known outputCount, keep for unknown', async () => {
      const j1a = createOutputAsset('a1', 'img1a.png', 'job1', 2)
      const j1b = createOutputAsset('a2', 'img1b.png', 'job1', 2)
      const j2 = createOutputAsset('a3', 'img2.png', 'job2')

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([j1a, j1b, j2])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_ids).toEqual(['job1', 'job2'])
      expect(payload.job_asset_name_filters).toEqual({
        job2: ['img2.png']
      })
    })

    it('should omit name filters when job-level and asset-level selections share a jobId', async () => {
      const jobLevelAsset = createOutputAsset('a1', 'img1.png', 'job1', 3)
      const assetLevelSelection = createOutputAsset('a2', 'img2.png', 'job1')

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([jobLevelAsset, assetLevelSelection])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_ids).toEqual(['job1'])
      expect(payload.job_asset_name_filters).toBeUndefined()
    })
  })

  describe('downloadMultipleAssets - export toast file count', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      mockCreateAssetExport.mockClear()
      mockTrackExport.mockClear()
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

    type ToastArg = { severity?: string; detail?: unknown }

    async function getExportToastDetail(): Promise<unknown> {
      await vi.waitFor(() => {
        const hasInfoToast = mockToastAdd.mock.calls.some(
          ([arg]) => (arg as ToastArg).severity === 'info'
        )
        expect(hasInfoToast).toBe(true)
      })
      const exportToastCall = mockToastAdd.mock.calls.find(
        ([arg]) => (arg as ToastArg).severity === 'info'
      )
      if (!exportToastCall) throw new Error('export info toast not found')
      return (exportToastCall[0] as ToastArg).detail
    }

    it('sums outputCount across job-level selections', async () => {
      // 3 jobs each with 2 outputs => 6 files total
      const j1 = createOutputAsset('a1', 'img1.png', 'job1', 2)
      const j2 = createOutputAsset('a2', 'img2.png', 'job2', 2)
      const j3 = createOutputAsset('a3', 'img3.png', 'job3', 2)

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([j1, j2, j3])

      const detail = await getExportToastDetail()
      expect(detail).toBe('mediaAsset.selection.exportStarted:6')
    })

    it('counts assets without outputCount as a single file each', async () => {
      const a1 = createOutputAsset('a1', 'img1.png', 'job1')
      const a2 = createOutputAsset('a2', 'img2.png', 'job2')

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([a1, a2])

      const detail = await getExportToastDetail()
      expect(detail).toBe('mediaAsset.selection.exportStarted:2')
    })

    it('counts outputCount once per job when multiple job-level assets share a jobId', async () => {
      // User selects 2 cards from the same job-level stack (outputCount=3
      // on each). The export is still one job-wide export of 3 files.
      const j1a = createOutputAsset('a1', 'img1.png', 'job1', 3)
      const j1b = createOutputAsset('a2', 'img2.png', 'job1', 3)

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([j1a, j1b])

      const detail = await getExportToastDetail()
      expect(detail).toBe('mediaAsset.selection.exportStarted:3')
    })

    it('mixes job-level and asset-level selections correctly', async () => {
      // job1 = job-level selection with 3 outputs
      // job2 = 2 individually selected outputs (no outputCount)
      const j1 = createOutputAsset('a1', 'img1.png', 'job1', 3)
      const j2a = createOutputAsset('a2', 'out2a.png', 'job2')
      const j2b = createOutputAsset('a3', 'out2b.png', 'job2')

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([j1, j2a, j2b])

      const detail = await getExportToastDetail()
      expect(detail).toBe('mediaAsset.selection.exportStarted:5')
    })

    it('does not double-count when a job-level and asset-level selection share a jobId', async () => {
      // job1 is selected at the job level (outputCount=3) and the user also
      // selects one individual output from the same job. The export is still
      // one job-wide export of 3 files, not 4.
      const j1Job = createOutputAsset('a1', 'img1.png', 'job1', 3)
      const j1Asset = createOutputAsset('a2', 'img2.png', 'job1')

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([j1Job, j1Asset])

      const detail = await getExportToastDetail()
      expect(detail).toBe('mediaAsset.selection.exportStarted:3')
    })

    it('does not overcount when an asset-level selection comes before a job-level selection for the same jobId', async () => {
      const j1Asset = createOutputAsset('a1', 'img1.png', 'job1')
      const j1Job = createOutputAsset('a2', 'img2.png', 'job1', 3)

      const actions = useMediaAssetActions()
      actions.downloadMultipleAssets([j1Asset, j1Job])

      const detail = await getExportToastDetail()
      expect(detail).toBe('mediaAsset.selection.exportStarted:3')
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
})
