import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { useToast } from 'primevue/usetoast'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, provide, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { MediaAssetKey } from '@/platform/assets/schemas/mediaAssetSchema'
import { api } from '@/scripts/api'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { AssetMeta } from '@/platform/assets/schemas/mediaAssetSchema'
import type * as outputAssetUtilModule from '../utils/outputAssetUtil'
import { useMediaAssetActions } from './useMediaAssetActions'

// Use vi.hoisted to create a mutable reference for isCloud
const mockIsCloud = vi.hoisted(() => ({ value: false }))

// Track the filename passed to createAnnotatedPath
const capturedFilenames = vi.hoisted(() => ({ values: [] as string[] }))
const capturedAnnotatedPaths = vi.hoisted(() => ({
  values: [] as Array<{
    item: { filename: string; subfolder?: string; type?: string }
    options: { rootFolder?: string }
  }>
}))

const mockDownloadFile = vi.hoisted(() => vi.fn())
vi.mock('@/base/common/downloadUtil', () => ({
  downloadFile: mockDownloadFile
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('primevue/usetoast', () => {
  const add = vi.fn()
  return {
    useToast: () => ({ add })
  }
})

const testI18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

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

const mockCopyToClipboard = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copyToClipboard: mockCopyToClipboard
  })
}))

const mockExportWorkflowAction = vi.hoisted(() => vi.fn())
const mockOpenWorkflowAction = vi.hoisted(() => vi.fn())
vi.mock('@/platform/workflow/core/services/workflowActionsService', () => ({
  useWorkflowActionsService: () => ({
    openWorkflowAction: mockOpenWorkflowAction,
    exportWorkflowAction: mockExportWorkflowAction
  })
}))

const mockExtractWorkflowFromAsset = vi.hoisted(() => vi.fn())
vi.mock('@/platform/workflow/utils/workflowExtractionUtil', () => ({
  extractWorkflowFromAsset: mockExtractWorkflowFromAsset
}))

const mockAddNodeOnGraph = vi.hoisted(() => vi.fn())
const mockGetCanvasCenter = vi.hoisted(() => vi.fn())
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({
    addNodeOnGraph: mockAddNodeOnGraph,
    getCanvasCenter: mockGetCanvasCenter
  })
}))

const mockNodeDefsByName = vi.hoisted(() => ({
  value: {
    LoadImage: {
      name: 'LoadImage',
      display_name: 'Load Image'
    }
  } as Record<string, unknown>
}))
vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    nodeDefsByName: mockNodeDefsByName.value
  })
}))

vi.mock('@/utils/createAnnotatedPath', () => ({
  createAnnotatedPath: vi.fn(
    (
      item: { filename: string; subfolder?: string; type?: string },
      options: { rootFolder?: string }
    ) => {
      capturedAnnotatedPaths.values.push({ item, options })
      capturedFilenames.values.push(item.filename)
      return item.filename
    }
  )
}))

const mockDetectNodeTypeFromFilename = vi.hoisted(() => vi.fn())
vi.mock('@/utils/loaderNodeUtil', () => ({
  detectNodeTypeFromFilename: mockDetectNodeTypeFromFilename
}))

const mockIsResultItemType = vi.hoisted(() => vi.fn())
vi.mock('@/utils/typeGuardUtil', () => ({
  isResultItemType: mockIsResultItemType
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

const mockResolveOutputAssetItems = vi.hoisted(() =>
  vi.fn().mockResolvedValue([])
)
vi.mock('../utils/outputAssetUtil', async (importOriginal) => {
  const actual = await importOriginal<typeof outputAssetUtilModule>()
  return {
    ...actual,
    resolveOutputAssetItems: mockResolveOutputAssetItems
  }
})

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

const mockAppGraph = vi.hoisted(() => ({
  value: { _nodes: [] as unknown[] } as { _nodes: unknown[] } | null
}))
vi.mock('@/scripts/app', () => ({
  app: {
    get graph() {
      return mockAppGraph.value
    },
    get rootGraph() {
      return mockAppGraph.value
    }
  }
}))

const mockRemoveNodeOutputs = vi.hoisted(() => vi.fn())
const mockRemoveNodeOutputsForNode = vi.hoisted(() => vi.fn())
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({
    removeNodeOutputs: mockRemoveNodeOutputs,
    removeNodeOutputsForNode: mockRemoveNodeOutputsForNode
  })
}))

const mockCaptureCanvasState = vi.hoisted(() => vi.fn())
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: {
      changeTracker: { captureCanvasState: mockCaptureCanvasState }
    }
  })
}))

const mockClearNodePreviewCache = vi.hoisted(() => vi.fn())
vi.mock('../utils/clearNodePreviewCacheForValues', () => ({
  clearNodePreviewCacheForValues: mockClearNodePreviewCache,
  findNodesReferencingValues: vi.fn(() => [])
}))

const mockClearWidgetValues = vi.hoisted(() => vi.fn())
vi.mock('../utils/clearDeletedAssetWidgetValues', () => ({
  clearDeletedAssetWidgetValues: mockClearWidgetValues
}))

const mockMarkMissingMedia = vi.hoisted(() => vi.fn())
vi.mock('../utils/markDeletedAssetsAsMissingMedia', () => ({
  markDeletedAssetsAsMissingMedia: mockMarkMissingMedia
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
  app.use(testI18n)
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
    capturedAnnotatedPaths.values = []
    mockIsCloud.value = false
    mockAppGraph.value = { _nodes: [] }
    mockDownloadFile.mockReset()
    mockCopyToClipboard.mockReset()
    mockShowDialog.mockReset()
    mockAddNodeOnGraph.mockReset()
    const defaultMockNode: unknown = {
      widgets: [{ name: 'image', value: '', callback: vi.fn() }],
      graph: { setDirtyCanvas: vi.fn() }
    }
    mockAddNodeOnGraph.mockReturnValue(defaultMockNode as LGraphNode)
    mockGetCanvasCenter.mockReset()
    mockGetCanvasCenter.mockReturnValue([100, 100])
    mockNodeDefsByName.value = {
      LoadImage: {
        name: 'LoadImage',
        display_name: 'Load Image'
      }
    }
    mockDetectNodeTypeFromFilename.mockReset()
    mockDetectNodeTypeFromFilename.mockReturnValue({
      nodeType: 'LoadImage',
      widgetName: 'image'
    })
    mockIsResultItemType.mockReset()
    mockIsResultItemType.mockReturnValue(true)
    mockExtractWorkflowFromAsset.mockReset()
    mockOpenWorkflowAction.mockReset()
    mockExportWorkflowAction.mockReset()
    mockCreateAssetExport.mockReset()
    mockCreateAssetExport.mockResolvedValue({
      task_id: 'test-task-id',
      status: 'pending'
    })
    mockDeleteAsset.mockReset()
    mockGetOutputAssetMetadata.mockReset()
    mockGetOutputAssetMetadata.mockReturnValue(null)
    mockGetAssetType.mockReset()
    mockResolveOutputAssetItems.mockReset()
    mockResolveOutputAssetItems.mockResolvedValue([])
  })

  describe('copyJobId', () => {
    it('does nothing when no asset is available', async () => {
      const { actions, unmount } = mountMediaActions()

      await actions.copyJobId()

      expect(mockCopyToClipboard).not.toHaveBeenCalled()
      expect(useToast().add).not.toHaveBeenCalled()

      unmount()
    })

    it('warns when the asset has no job id', async () => {
      mockGetAssetType.mockReturnValue('input')
      const { actions } = mountMediaActions()

      await actions.copyJobId(createMockAsset())

      expect(mockCopyToClipboard).not.toHaveBeenCalled()
      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' })
      )
    })

    it('copies the metadata job id when present', async () => {
      mockGetOutputAssetMetadata.mockReturnValue({ jobId: 'job-from-meta' })
      const { actions } = mountMediaActions()

      await actions.copyJobId(createMockAsset())

      expect(mockCopyToClipboard).toHaveBeenCalledWith('job-from-meta')
    })

    it('copies the output asset id when metadata omits the job id', async () => {
      mockGetAssetType.mockReturnValue('output')
      const { actions } = mountMediaActions()

      await actions.copyJobId(createMockAsset({ id: 'history-id' }))

      expect(mockCopyToClipboard).toHaveBeenCalledWith('history-id')
    })
  })

  describe('addWorkflow', () => {
    it('does nothing when no asset is available', async () => {
      const { actions, unmount } = mountMediaActions()

      await actions.addWorkflow()

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
      expect(useToast().add).not.toHaveBeenCalled()

      unmount()
    })

    it('uses the injected media asset when no explicit asset is provided', async () => {
      const mediaAsset = createMockMediaAsset({ name: 'context-image.png' })
      const { actions, unmount } = mountMediaActions(mediaAsset)

      await actions.addWorkflow()

      expect(capturedFilenames.values).toContain('context-image.png')

      unmount()
    })

    it('warns when the filename has no compatible loader node', async () => {
      mockDetectNodeTypeFromFilename.mockReturnValue({
        nodeType: undefined,
        widgetName: undefined
      })
      const { actions } = mountMediaActions()

      await actions.addWorkflow(createMockAsset({ name: 'notes.txt' }))

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' })
      )
    })

    it('reports missing node definitions', async () => {
      mockNodeDefsByName.value = {}
      const { actions } = mountMediaActions()

      await actions.addWorkflow(createMockAsset())

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('reports loader-node creation failure', async () => {
      mockAddNodeOnGraph.mockReturnValue(undefined)
      const { actions } = mountMediaActions()

      await actions.addWorkflow(createMockAsset())

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('still adds the node when the expected widget is absent', async () => {
      const setDirtyCanvas = vi.fn()
      const mockNode: unknown = {
        widgets: [{ name: 'other', value: '' }],
        graph: { setDirtyCanvas }
      }
      mockAddNodeOnGraph.mockReturnValue(mockNode as LGraphNode)
      mockGetOutputAssetMetadata.mockReturnValue({ subfolder: 'nested' })
      mockGetAssetType.mockReturnValue('custom')
      mockIsResultItemType.mockReturnValue(false)
      const { actions } = mountMediaActions()

      await actions.addWorkflow(createMockAsset({ name: 'asset.png' }))

      expect(capturedAnnotatedPaths.values.at(-1)).toEqual({
        item: {
          filename: 'asset.png',
          subfolder: 'nested',
          type: undefined
        },
        options: { rootFolder: 'input' }
      })
      expect(setDirtyCanvas).toHaveBeenCalledWith(true, true)
      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })

    describe('OSS mode (isCloud = false)', () => {
      beforeEach(() => {
        mockIsCloud.value = false
      })

      it('should use asset.name as filename', async () => {
        const { actions } = mountMediaActions()

        const asset = createMockAsset({
          name: 'my-image.jpeg',
          hash: 'hash123.jpeg'
        })

        await actions.addWorkflow(asset)

        expect(capturedFilenames.values).toContain('my-image.jpeg')
      })
    })

    describe('Cloud mode (isCloud = true)', () => {
      beforeEach(() => {
        mockIsCloud.value = true
      })

      it('should use hash as filename when available', async () => {
        const { actions } = mountMediaActions()

        const asset = createMockAsset({
          name: 'original.jpeg',
          hash: 'abc123hash.jpeg'
        })

        await actions.addWorkflow(asset)

        expect(capturedFilenames.values).toContain('abc123hash.jpeg')
      })

      it('should fall back to asset.name when hash is not available', async () => {
        const { actions } = mountMediaActions()

        const asset = createMockAsset({
          name: 'fallback-name.jpeg',
          hash: undefined
        })

        await actions.addWorkflow(asset)

        expect(capturedFilenames.values).toContain('fallback-name.jpeg')
      })

      it('should fall back to asset.name when hash is null', async () => {
        const { actions } = mountMediaActions()

        const asset = createMockAsset({
          name: 'fallback-null.jpeg',
          hash: null
        })

        await actions.addWorkflow(asset)

        expect(capturedFilenames.values).toContain('fallback-null.jpeg')
      })
    })
  })

  describe('addMultipleToWorkflow', () => {
    it('does nothing for an empty selection', async () => {
      const { actions } = mountMediaActions()

      await actions.addMultipleToWorkflow([])

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
      expect(useToast().add).not.toHaveBeenCalled()
    })

    it('shows a failure toast when none of the selected assets can be added', async () => {
      mockDetectNodeTypeFromFilename
        .mockReturnValueOnce({ nodeType: undefined, widgetName: undefined })
        .mockReturnValueOnce({ nodeType: 'MissingNode', widgetName: 'image' })
      const { actions } = mountMediaActions()

      await actions.addMultipleToWorkflow([
        createMockAsset({ id: 'a', name: 'unsupported.txt' }),
        createMockAsset({ id: 'b', name: 'missing.png' })
      ])

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('shows a partial warning when only some nodes are added', async () => {
      const firstMockNode: unknown = {
        widgets: [{ name: 'image', value: '', callback: vi.fn() }],
        graph: { setDirtyCanvas: vi.fn() }
      }
      mockAddNodeOnGraph
        .mockReturnValueOnce(firstMockNode as LGraphNode)
        .mockReturnValueOnce(undefined)
      const { actions } = mountMediaActions()

      await actions.addMultipleToWorkflow([
        createMockAsset({ id: 'a', name: 'a.png' }),
        createMockAsset({ id: 'b', name: 'b.png' })
      ])

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' })
      )
    })

    it('adds assets without a matching widget using untyped paths', async () => {
      const setDirtyCanvas = vi.fn()
      const mockNode2: unknown = {
        widgets: [{ name: 'other', value: '' }],
        graph: { setDirtyCanvas }
      }
      mockAddNodeOnGraph.mockReturnValue(mockNode2 as LGraphNode)
      mockGetAssetType.mockReturnValue('custom')
      mockIsResultItemType.mockReturnValue(false)
      const { actions } = mountMediaActions()

      await actions.addMultipleToWorkflow([
        createMockAsset({ id: 'asset-1', name: 'asset-1.png' })
      ])

      expect(capturedAnnotatedPaths.values.at(-1)).toEqual({
        item: {
          filename: 'asset-1.png',
          subfolder: '',
          type: undefined
        },
        options: { rootFolder: undefined }
      })
      expect(setDirtyCanvas).toHaveBeenCalledWith(true, true)
      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })

    describe('Cloud mode (isCloud = true)', () => {
      beforeEach(() => {
        mockIsCloud.value = true
      })

      it('should use hash for each asset', async () => {
        const { actions } = mountMediaActions()

        const assets = [
          createMockAsset({
            id: '1',
            name: 'file1.jpeg',
            hash: 'hash1.jpeg'
          }),
          createMockAsset({
            id: '2',
            name: 'file2.jpeg',
            hash: 'hash2.jpeg'
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

  describe('openWorkflow', () => {
    beforeEach(() => {
      mockExtractWorkflowFromAsset.mockResolvedValue({
        workflow: { version: 0.4 },
        filename: 'workflow.json'
      })
    })

    it('does nothing when no asset is available', async () => {
      const { actions, unmount } = mountMediaActions()

      await actions.openWorkflow()

      expect(mockExtractWorkflowFromAsset).not.toHaveBeenCalled()
      expect(mockOpenWorkflowAction).not.toHaveBeenCalled()

      unmount()
    })

    it('shows a success toast after opening the workflow', async () => {
      mockOpenWorkflowAction.mockResolvedValue({ success: true })
      const { actions } = mountMediaActions()

      await actions.openWorkflow(createMockAsset())

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })

    it('uses the fallback warning when opening returns no error message', async () => {
      mockOpenWorkflowAction.mockResolvedValue({ success: false })
      const { actions } = mountMediaActions()

      await actions.openWorkflow(createMockAsset())

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warn',
          detail: 'No workflow data found in this asset'
        })
      )
    })
  })

  describe('exportWorkflow', () => {
    const successResult = { success: true } as const
    const cancelledResult = { success: false, cancelled: true } as const
    const failureResult = { success: false, error: 'boom' } as const
    const failureWithoutError = { success: false } as const
    const noWorkflowResult = {
      success: false,
      error: 'No workflow data available'
    } as const

    beforeEach(() => {
      mockExtractWorkflowFromAsset.mockResolvedValue({
        workflow: { version: 0.4 },
        filename: 'export.json'
      })
    })

    it('does not show a toast when the user cancels the filename prompt', async () => {
      mockExportWorkflowAction.mockResolvedValue(cancelledResult)
      const { actions } = mountMediaActions()

      await actions.exportWorkflow(createMockAsset())

      expect(useToast().add).not.toHaveBeenCalled()
    })

    it('shows a success toast on successful export', async () => {
      mockExportWorkflowAction.mockResolvedValue(successResult)
      const { actions } = mountMediaActions()

      await actions.exportWorkflow(createMockAsset())

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })

    it('shows an error toast on actual failure', async () => {
      mockExportWorkflowAction.mockResolvedValue(failureResult)
      const { actions } = mountMediaActions()

      await actions.exportWorkflow(createMockAsset())

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('shows a warning toast when the workflow is missing', async () => {
      mockExportWorkflowAction.mockResolvedValue(noWorkflowResult)
      const { actions } = mountMediaActions()

      await actions.exportWorkflow(createMockAsset())

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' })
      )
    })

    it('does nothing when no asset is available', async () => {
      const { actions, unmount } = mountMediaActions()

      await actions.exportWorkflow()

      expect(mockExtractWorkflowFromAsset).not.toHaveBeenCalled()
      expect(mockExportWorkflowAction).not.toHaveBeenCalled()

      unmount()
    })

    it('uses the fallback error when export fails without a message', async () => {
      mockExportWorkflowAction.mockResolvedValue(failureWithoutError)
      const { actions } = mountMediaActions()

      await actions.exportWorkflow(createMockAsset())

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Failed to export workflow'
        })
      )
    })

    it('shows no toast when every asset in a bulk export is cancelled', async () => {
      mockExportWorkflowAction.mockResolvedValue(cancelledResult)
      const { actions } = mountMediaActions()

      await actions.exportMultipleWorkflows([
        createMockAsset({ id: 'a' }),
        createMockAsset({ id: 'b' })
      ])

      expect(useToast().add).not.toHaveBeenCalled()
    })

    it('shows a success toast for the succeeded subset when some bulk exports are cancelled', async () => {
      mockExportWorkflowAction
        .mockResolvedValueOnce(successResult)
        .mockResolvedValueOnce(cancelledResult)
      const { actions } = mountMediaActions()

      await actions.exportMultipleWorkflows([
        createMockAsset({ id: 'a' }),
        createMockAsset({ id: 'b' })
      ])

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })

    it('shows a partial-success warning toast when some bulk exports fail outright', async () => {
      mockExportWorkflowAction
        .mockResolvedValueOnce(successResult)
        .mockResolvedValueOnce(failureResult)
      const { actions } = mountMediaActions()

      await actions.exportMultipleWorkflows([
        createMockAsset({ id: 'a' }),
        createMockAsset({ id: 'b' })
      ])

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' })
      )
    })
  })

  describe('openMultipleWorkflows', () => {
    beforeEach(() => {
      mockExtractWorkflowFromAsset.mockResolvedValue({
        workflow: { version: 0.4 },
        filename: 'workflow.json'
      })
    })

    it('does nothing for an empty selection', async () => {
      const { actions } = mountMediaActions()

      await actions.openMultipleWorkflows([])

      expect(mockOpenWorkflowAction).not.toHaveBeenCalled()
      expect(useToast().add).not.toHaveBeenCalled()
    })

    it('shows success when every workflow opens', async () => {
      mockOpenWorkflowAction.mockResolvedValue({ success: true })
      const { actions } = mountMediaActions()

      await actions.openMultipleWorkflows([
        createMockAsset({ id: 'a' }),
        createMockAsset({ id: 'b' })
      ])

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })

    it('shows a missing-workflow warning when none open', async () => {
      mockOpenWorkflowAction.mockResolvedValue({ success: false })
      const { actions } = mountMediaActions()

      await actions.openMultipleWorkflows([
        createMockAsset({ id: 'a' }),
        createMockAsset({ id: 'b' })
      ])

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' })
      )
    })

    it('shows a partial warning when extraction throws for one asset', async () => {
      mockExtractWorkflowFromAsset
        .mockResolvedValueOnce({
          workflow: { version: 0.4 },
          filename: 'ok.json'
        })
        .mockRejectedValueOnce(new Error('missing workflow'))
      mockOpenWorkflowAction.mockResolvedValue({ success: true })
      const { actions } = mountMediaActions()

      await actions.openMultipleWorkflows([
        createMockAsset({ id: 'a' }),
        createMockAsset({ id: 'b' })
      ])

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' })
      )
    })
  })

  describe('exportMultipleWorkflows', () => {
    beforeEach(() => {
      mockExtractWorkflowFromAsset.mockResolvedValue({
        workflow: { version: 0.4 },
        filename: 'workflow.json'
      })
    })

    it('does nothing for an empty selection', async () => {
      const { actions } = mountMediaActions()

      await actions.exportMultipleWorkflows([])

      expect(mockExportWorkflowAction).not.toHaveBeenCalled()
      expect(useToast().add).not.toHaveBeenCalled()
    })

    it('shows no-workflows warning when every export fails', async () => {
      mockExportWorkflowAction.mockResolvedValue({
        success: false,
        error: 'boom'
      })
      const { actions } = mountMediaActions()

      await actions.exportMultipleWorkflows([
        createMockAsset({ id: 'a' }),
        createMockAsset({ id: 'b' })
      ])

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' })
      )
    })

    it('counts extraction failures as failed exports', async () => {
      mockExtractWorkflowFromAsset.mockRejectedValue(new Error('missing'))
      const { actions } = mountMediaActions()

      await actions.exportMultipleWorkflows([createMockAsset()])

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' })
      )
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

    it('uses the asset URL when no preview URL is available', () => {
      mockGetAssetType.mockReturnValue('input')
      const asset = createMockAsset({
        name: 'raw image.png',
        preview_url: undefined,
        user_metadata: { subfolder: 'uploads' }
      })
      const { actions } = mountMediaActions()

      actions.downloadAssets([asset])

      expect(mockDownloadFile).toHaveBeenCalledWith(
        'http://localhost:8188/api/view?filename=raw+image.png&type=input&subfolder=uploads',
        'raw image.png'
      )
    })

    it('shows an error toast when a direct download throws', () => {
      mockDownloadFile.mockImplementation(() => {
        throw new Error('download failed')
      })
      const { actions } = mountMediaActions()

      actions.downloadAssets([createMockAsset()])

      expect(useToast().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
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

      const { actions } = mountMediaActions()
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
        naming_strategy: 'preserve',
        include_previews: true
      })
      expect(mockTrackExport).toHaveBeenCalledWith('test-task-id')

      unmount()
    })
  })

  describe('downloadAssets - OSS multi-output expansion', () => {
    beforeEach(() => {
      mockIsCloud.value = false
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
      outputCount?: number,
      previewUrl?: string
    ): AssetItem {
      return createMockAsset({
        id,
        name,
        tags: ['output'],
        preview_url: previewUrl ?? `https://example.com/${name}`,
        user_metadata: { jobId, nodeId: '1', subfolder: '', outputCount }
      })
    }

    it('expands a grouped asset into individual downloads', async () => {
      const grouped = createOutputAsset(
        'g1',
        'cover.png',
        'job1',
        3,
        'https://example.com/cover.png'
      )
      mockResolveOutputAssetItems.mockResolvedValueOnce([
        createOutputAsset('g1-out1', 'out1.png', 'job1'),
        createOutputAsset('g1-out2', 'out2.png', 'job1'),
        createOutputAsset('g1-out3', 'out3.png', 'job1')
      ])

      const { actions } = mountMediaActions()
      actions.downloadAssets([grouped])

      await vi.waitFor(() => {
        expect(mockDownloadFile).toHaveBeenCalledTimes(3)
      })

      expect(mockResolveOutputAssetItems).toHaveBeenCalledTimes(1)
      expect(mockResolveOutputAssetItems).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'job1', outputCount: 3 }),
        expect.objectContaining({ createdAt: expect.any(String) })
      )
      expect(mockDownloadFile).toHaveBeenNthCalledWith(
        1,
        'https://example.com/out1.png',
        'out1.png'
      )
      expect(mockDownloadFile).toHaveBeenNthCalledWith(
        2,
        'https://example.com/out2.png',
        'out2.png'
      )
      expect(mockDownloadFile).toHaveBeenNthCalledWith(
        3,
        'https://example.com/out3.png',
        'out3.png'
      )
      expect(mockCreateAssetExport).not.toHaveBeenCalled()
    })

    it('mixes grouped and single-output assets in one selection', async () => {
      const grouped = createOutputAsset('g1', 'cover.png', 'job1', 2)
      const single = createOutputAsset('s1', 'solo.png', 'job2')

      mockResolveOutputAssetItems.mockResolvedValueOnce([
        createOutputAsset('g1-a', 'a.png', 'job1'),
        createOutputAsset('g1-b', 'b.png', 'job1')
      ])

      const { actions } = mountMediaActions()
      actions.downloadAssets([grouped, single])

      await vi.waitFor(() => {
        expect(mockDownloadFile).toHaveBeenCalledTimes(3)
      })

      expect(mockResolveOutputAssetItems).toHaveBeenCalledTimes(1)
      const filenames = mockDownloadFile.mock.calls.map((call) => call[1])
      expect(filenames).toEqual(['a.png', 'b.png', 'solo.png'])
    })

    it('falls back to the original asset when resolveOutputAssetItems returns empty', async () => {
      const grouped = createOutputAsset(
        'g1',
        'cover.png',
        'job1',
        3,
        'https://example.com/cover.png'
      )
      mockResolveOutputAssetItems.mockResolvedValueOnce([])

      const { actions } = mountMediaActions()
      actions.downloadAssets([grouped])

      await vi.waitFor(() => {
        expect(mockDownloadFile).toHaveBeenCalledTimes(1)
      })
      expect(mockDownloadFile).toHaveBeenCalledWith(
        'https://example.com/cover.png',
        'cover.png'
      )
    })

    it('does not call resolveOutputAssetItems when no grouped assets are selected', () => {
      const single1 = createOutputAsset(
        's1',
        'a.png',
        'job1',
        undefined,
        'https://example.com/a.png'
      )
      const single2 = createOutputAsset(
        's2',
        'b.png',
        'job2',
        1,
        'https://example.com/b.png'
      )

      const { actions } = mountMediaActions()
      actions.downloadAssets([single1, single2])

      expect(mockResolveOutputAssetItems).not.toHaveBeenCalled()
      expect(mockDownloadFile).toHaveBeenCalledTimes(2)
    })

    it('deduplicates downloads when an expanded child is also selected alongside its parent', async () => {
      const grouped = createOutputAsset('job1-cover', 'cover.png', 'job1', 3)
      const child = createMockAsset({
        id: 'job1-child-a',
        name: 'out1.png',
        tags: ['output'],
        preview_url: 'https://example.com/out1.png',
        user_metadata: { jobId: 'job1', nodeId: '1', subfolder: '' }
      })

      mockResolveOutputAssetItems.mockResolvedValueOnce([
        createMockAsset({
          id: 'job1-child-a',
          name: 'out1.png',
          tags: ['output'],
          preview_url: 'https://example.com/out1.png',
          user_metadata: { jobId: 'job1', nodeId: '1', subfolder: '' }
        }),
        createMockAsset({
          id: 'job1-child-b',
          name: 'out2.png',
          tags: ['output'],
          preview_url: 'https://example.com/out2.png',
          user_metadata: { jobId: 'job1', nodeId: '1', subfolder: '' }
        })
      ])

      const { actions } = mountMediaActions()
      actions.downloadAssets([grouped, child])

      await vi.waitFor(() => {
        expect(mockDownloadFile).toHaveBeenCalledTimes(2)
      })

      const filenames = mockDownloadFile.mock.calls.map((call) => call[1])
      expect(filenames).toEqual(['out1.png', 'out2.png'])
    })

    it('falls back to the preview download when resolveOutputAssetItems rejects', async () => {
      const grouped = createOutputAsset(
        'g1',
        'cover.png',
        'job1',
        3,
        'https://example.com/cover.png'
      )
      mockResolveOutputAssetItems.mockRejectedValueOnce(new Error('boom'))

      const { actions } = mountMediaActions()
      actions.downloadAssets([grouped])

      await vi.waitFor(() => {
        expect(mockDownloadFile).toHaveBeenCalledTimes(1)
      })
      expect(mockDownloadFile).toHaveBeenCalledWith(
        'https://example.com/cover.png',
        'cover.png'
      )
    })

    it('still downloads resolvable assets when one grouped asset fails to expand', async () => {
      const failingGrouped = createOutputAsset(
        'g1',
        'cover1.png',
        'job1',
        3,
        'https://example.com/cover1.png'
      )
      const okGrouped = createOutputAsset('g2', 'cover2.png', 'job2', 2)

      mockResolveOutputAssetItems.mockImplementation(
        (metadata: { jobId: string }) => {
          if (metadata.jobId === 'job1') {
            return Promise.reject(new Error('job1 lookup failed'))
          }
          return Promise.resolve([
            createOutputAsset('g2-a', 'out2a.png', 'job2'),
            createOutputAsset('g2-b', 'out2b.png', 'job2')
          ])
        }
      )

      const { actions } = mountMediaActions()
      actions.downloadAssets([failingGrouped, okGrouped])

      await vi.waitFor(() => {
        expect(mockDownloadFile).toHaveBeenCalledTimes(3)
      })

      const filenames = mockDownloadFile.mock.calls.map((call) => call[1])
      expect(filenames).toEqual(['cover1.png', 'out2a.png', 'out2b.png'])
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

      const { actions } = mountMediaActions()
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

      const { actions } = mountMediaActions()
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

      const { actions } = mountMediaActions()
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

      const { actions } = mountMediaActions()
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

      const { actions } = mountMediaActions()
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

    it('should include asset ids for imported assets', async () => {
      mockGetAssetType.mockImplementation((asset: AssetItem) =>
        asset.tags?.includes('output') ? 'output' : 'input'
      )
      const asset1 = createMockAsset({ id: 'input-1', tags: ['input'] })
      const asset2 = createMockAsset({ id: 'input-2', tags: ['input'] })

      const { actions } = mountMediaActions()
      actions.downloadAssets([asset1, asset2])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_ids).toBeUndefined()
      expect(payload.asset_ids).toEqual(['input-1', 'input-2'])
      expect(payload.naming_strategy).toBe('preserve')
    })

    it('should mix output job ids and imported asset ids', async () => {
      mockGetAssetType.mockImplementation((asset: AssetItem) =>
        asset.tags?.includes('output') ? 'output' : 'input'
      )
      const output = createMockAsset({
        id: 'history-id',
        name: 'output.png',
        tags: ['output']
      })
      const imported = createMockAsset({ id: 'input-id', tags: ['input'] })

      const { actions } = mountMediaActions()
      actions.downloadAssets([output, imported])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_ids).toEqual(['history-id'])
      expect(payload.asset_ids).toEqual(['input-id'])
    })

    it('should only include a filtered output name once', async () => {
      const asset1 = createOutputAsset('a1', 'same.png', 'job1')
      const asset2 = createOutputAsset('a2', 'same.png', 'job1')

      const { actions } = mountMediaActions()
      actions.downloadAssets([asset1, asset2])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const payload = mockCreateAssetExport.mock.calls[0][0]
      expect(payload.job_asset_name_filters).toEqual({
        job1: ['same.png']
      })
    })

    it('should show an error toast when ZIP export creation fails', async () => {
      mockCreateAssetExport.mockRejectedValueOnce(new Error('export failed'))
      const asset1 = createOutputAsset('a1', 'img1.png', 'job1')
      const asset2 = createOutputAsset('a2', 'img2.png', 'job2')

      const { actions } = mountMediaActions()
      actions.downloadAssets([asset1, asset2])

      await vi.waitFor(() => {
        expect(useToast().add).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'error' })
        )
      })
      expect(mockTrackExport).not.toHaveBeenCalled()
    })
  })

  describe('downloadAssets - export toast file count', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      mockCreateAssetExport.mockClear()
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

    async function expectExportToastFileCount(count: number) {
      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      const { add } = useToast()
      await vi.waitFor(() => {
        expect(add).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: expect.stringContaining(String(count))
          })
        )
      })
    }

    it('should report total file count, not job count, for multi-output jobs', async () => {
      const j1 = createOutputAsset('a1', 'img1.png', 'job1', 2)
      const j2 = createOutputAsset('a2', 'img2.png', 'job2', 4)

      const { actions } = mountMediaActions()
      actions.downloadAssets([j1, j2])

      await expectExportToastFileCount(6)
    })

    it('should treat assets without outputCount as a single file', async () => {
      const a1 = createOutputAsset('a1', 'img1.png', 'job1')
      const a2 = createOutputAsset('a2', 'img2.png', 'job2')

      const { actions } = mountMediaActions()
      actions.downloadAssets([a1, a2])

      await expectExportToastFileCount(2)
    })

    it('should mix multi-output and single-output assets correctly', async () => {
      const j1 = createOutputAsset('a1', 'img1.png', 'job1', 3)
      const a2 = createOutputAsset('a2', 'img2.png', 'job2')

      const { actions } = mountMediaActions()
      actions.downloadAssets([j1, a2])

      await expectExportToastFileCount(4)
    })

    it('should only count duplicate job-level output selections once', async () => {
      const j1 = createOutputAsset('a1', 'img1.png', 'job1', 3)
      const j1Duplicate = createOutputAsset('a2', 'img2.png', 'job1', 3)

      const { actions } = mountMediaActions()
      actions.downloadAssets([j1, j1Duplicate])

      await expectExportToastFileCount(3)
    })
  })

  describe('deleteAssets', () => {
    it('returns false for an empty selection', async () => {
      const { actions } = mountMediaActions()

      const result = await actions.deleteAssets([])

      expect(result).toBe(false)
      expect(mockShowDialog).not.toHaveBeenCalled()
    })

    it('returns false when the user cancels', async () => {
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onCancel: () => void } }) => {
          props.onCancel()
        }
      )
      const { actions } = mountMediaActions()

      const result = await actions.deleteAssets(createMockAsset())

      expect(result).toBe(false)
      expect(mockDeleteAsset).not.toHaveBeenCalled()
    })

    it('rejects imported asset deletion outside cloud mode', async () => {
      mockIsCloud.value = false
      mockGetAssetType.mockReturnValue('input')
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: () => Promise<void> } }) => {
          void props.onConfirm()
        }
      )
      const { actions } = mountMediaActions()

      await actions.deleteAssets(createMockAsset({ tags: ['input'] }))

      await vi.waitFor(() => {
        expect(useToast().add).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'error' })
        )
      })
      expect(mockDeleteAsset).not.toHaveBeenCalled()
    })

    it('rejects output deletion when no job id can be resolved', async () => {
      mockIsCloud.value = true
      mockGetAssetType.mockReturnValue('output')
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: () => Promise<void> } }) => {
          void props.onConfirm()
        }
      )
      const { actions } = mountMediaActions()

      await actions.deleteAssets(
        createMockAsset({ id: '', name: 'orphan.png', tags: ['output'] })
      )

      await vi.waitFor(() => {
        expect(useToast().add).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'error' })
        )
      })
      expect(api.deleteItem).not.toHaveBeenCalled()
    })

    it('updates output history and input listings for mixed successful deletion', async () => {
      mockIsCloud.value = true
      mockGetAssetType.mockImplementation((asset: AssetItem) =>
        asset.tags?.includes('output') ? 'output' : 'input'
      )
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: () => Promise<void> } }) => {
          void props.onConfirm()
        }
      )
      const { actions } = mountMediaActions()

      await actions.deleteAssets([
        createMockAsset({ id: 'history-1', tags: ['output'] }),
        createMockAsset({ id: 'input-1', tags: ['input'] })
      ])

      await vi.waitFor(() => {
        expect(mockUpdateHistory).toHaveBeenCalled()
      })
      expect(mockUpdateInputs).toHaveBeenCalled()
      expect(api.deleteItem).toHaveBeenCalledWith('history', 'history-1')
      expect(mockDeleteAsset).toHaveBeenCalledWith('input-1')
    })

    it('skips graph cleanup when there is no root graph', async () => {
      mockIsCloud.value = true
      mockGetAssetType.mockReturnValue('input')
      mockAppGraph.value = null
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: () => Promise<void> } }) => {
          void props.onConfirm()
        }
      )
      const { actions } = mountMediaActions()

      await actions.deleteAssets(createMockAsset({ tags: ['input'] }))

      await vi.waitFor(() => {
        expect(mockDeleteAsset).toHaveBeenCalled()
      })
      expect(mockClearNodePreviewCache).not.toHaveBeenCalled()
      expect(mockClearWidgetValues).not.toHaveBeenCalled()
      expect(mockCaptureCanvasState).not.toHaveBeenCalled()
    })

    it('uses temp widget-value variants when deleting temp assets', async () => {
      mockIsCloud.value = true
      mockGetAssetType.mockReturnValue('temp')
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: () => Promise<void> } }) => {
          void props.onConfirm()
        }
      )
      const { actions } = mountMediaActions()

      await actions.deleteAssets(
        createMockAsset({
          id: 'temp-1',
          name: 'preview.png',
          hash: 'preview-hash.png',
          tags: ['temp']
        })
      )

      await vi.waitFor(() => {
        expect(mockClearNodePreviewCache).toHaveBeenCalled()
      })
      const [, valuesArg] = mockClearNodePreviewCache.mock.calls[0]
      expect(valuesArg).toEqual(
        new Set(['preview.png [temp]', 'preview-hash.png'])
      )
    })

    it('uses hash-only cleanup values when the asset name is empty', async () => {
      mockIsCloud.value = true
      mockGetAssetType.mockReturnValue('input')
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: () => Promise<void> } }) => {
          void props.onConfirm()
        }
      )
      const { actions } = mountMediaActions()

      await actions.deleteAssets(
        createMockAsset({
          id: 'hash-only',
          name: '',
          hash: 'only-hash.png',
          tags: ['input']
        })
      )

      await vi.waitFor(() => {
        expect(mockClearNodePreviewCache).toHaveBeenCalled()
      })
      const [, valuesArg] = mockClearNodePreviewCache.mock.calls[0]
      expect(valuesArg).toEqual(new Set(['only-hash.png']))
    })

    it('shows a partial warning and cleans up only successfully deleted assets', async () => {
      mockIsCloud.value = true
      mockGetAssetType.mockReturnValue('input')
      mockDeleteAsset
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('delete failed'))
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: () => Promise<void> } }) => {
          void props.onConfirm()
        }
      )
      const { actions } = mountMediaActions()

      await actions.deleteAssets([
        createMockAsset({ id: 'ok', name: 'ok.png', tags: ['input'] }),
        createMockAsset({ id: 'bad', name: 'bad.png', tags: ['input'] })
      ])

      await vi.waitFor(() => {
        expect(useToast().add).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'warn' })
        )
      })
      const [, valuesArg] = mockClearNodePreviewCache.mock.calls[0]
      expect(valuesArg).toEqual(new Set(['ok.png', 'ok.png [input]']))
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
      const { actions } = mountMediaActions()

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
      const { actions } = mountMediaActions()

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
      const { actions } = mountMediaActions()

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
      const { actions } = mountMediaActions()

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
      const { actions } = mountMediaActions()

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
      const { actions } = mountMediaActions()

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

  describe('deleteAssets — FE-230 preview cache clearing', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      mockGetAssetType.mockReturnValue('input')
      mockDeleteAsset.mockReset()
      mockShowDialog.mockImplementation(
        (opts: {
          props: {
            onConfirm: () => Promise<void> | void
          }
        }) => {
          void opts.props.onConfirm()
        }
      )
      mockAppGraph.value = { _nodes: [] }
    })

    it('invokes clearNodePreviewCacheForValues with canonical widget-value variants', async () => {
      mockDeleteAsset.mockResolvedValue(undefined)
      const { actions } = mountMediaActions()
      const asset = createMockAsset({
        id: 'asset-match',
        name: 'foo.png',
        hash: 'abc123.png',
        tags: ['input']
      })

      await actions.deleteAssets(asset)

      await vi.waitFor(() => {
        expect(mockClearNodePreviewCache).toHaveBeenCalledTimes(1)
      })
      const [graphArg, valuesArg, removeArg] =
        mockClearNodePreviewCache.mock.calls[0]
      expect(graphArg).toBe(mockAppGraph.value)
      expect(valuesArg).toEqual(
        new Set(['foo.png', 'foo.png [input]', 'abc123.png'])
      )
      expect(typeof removeArg).toBe('function')

      const sampleNode = { id: 42 }
      removeArg(sampleNode)
      expect(mockRemoveNodeOutputsForNode).toHaveBeenCalledWith(sampleNode)
      // Locator is resolved from the node's own graph, not from the raw id —
      // covers Load Image / Load Video nodes nested inside subgraphs.
      expect(mockRemoveNodeOutputs).not.toHaveBeenCalled()

      expect(mockClearWidgetValues).toHaveBeenCalledWith(
        mockAppGraph.value,
        new Set(['foo.png', 'foo.png [input]', 'abc123.png'])
      )

      expect(mockMarkMissingMedia).toHaveBeenCalledWith(
        mockAppGraph.value,
        new Set(['foo.png', 'foo.png [input]', 'abc123.png'])
      )

      // markMissing + previewCache must run before widget-value clearing,
      // otherwise findNodesReferencingValues sees blanked widgets and matches
      // nothing.
      const markOrder = mockMarkMissingMedia.mock.invocationCallOrder[0]
      const cacheOrder = mockClearNodePreviewCache.mock.invocationCallOrder[0]
      const clearOrder = mockClearWidgetValues.mock.invocationCallOrder[0]
      expect(markOrder).toBeLessThan(clearOrder)
      expect(cacheOrder).toBeLessThan(clearOrder)

      // Programmatic widget mutation doesn't go through DOM events, so the
      // workflow won't be flagged as modified unless we capture explicitly.
      expect(mockCaptureCanvasState).toHaveBeenCalled()
    })

    it('emits the [output]-annotated variant for output assets, including subfolder', async () => {
      mockDeleteAsset.mockResolvedValue(undefined)
      mockGetAssetType.mockReturnValue('output')
      mockGetOutputAssetMetadata.mockReturnValue({
        subfolder: 'outputs/2025'
      })
      const { actions } = mountMediaActions()
      const asset = createMockAsset({
        id: 'asset-output',
        name: 'gen.png',
        tags: ['output']
      })

      await actions.deleteAssets(asset)

      await vi.waitFor(() => {
        expect(mockClearNodePreviewCache).toHaveBeenCalledTimes(1)
      })
      const [, valuesArg] = mockClearNodePreviewCache.mock.calls[0]
      expect(valuesArg).toEqual(new Set(['outputs/2025/gen.png [output]']))
      expect(valuesArg.has('gen.png')).toBe(false)
      expect(valuesArg.has('gen.png [input]')).toBe(false)
    })

    it('omits filenames of failed deletions and skips the helper when nothing was deleted', async () => {
      mockDeleteAsset.mockRejectedValue(new Error('boom'))
      const { actions } = mountMediaActions()
      const asset = createMockAsset({
        id: 'asset-failed',
        name: 'failed.png',
        hash: 'failhash.png'
      })

      await actions.deleteAssets(asset)

      await vi.waitFor(() => {
        expect(mockDeleteAsset).toHaveBeenCalled()
      })
      expect(mockClearNodePreviewCache).not.toHaveBeenCalled()
      expect(mockClearWidgetValues).not.toHaveBeenCalled()
      expect(mockMarkMissingMedia).not.toHaveBeenCalled()
      expect(mockCaptureCanvasState).not.toHaveBeenCalled()
    })
  })
})
