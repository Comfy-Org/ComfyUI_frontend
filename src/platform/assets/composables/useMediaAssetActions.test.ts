import { useDialogStore } from '@/stores/dialogStore'
import { useAssetsStore } from '@/stores/assetsStore'
import { useAssetExportStore } from '@/stores/assetExportStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { CreateAssetExportData } from '@comfyorg/ingest-types'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { useToast } from '@/components/ui/toast/toastStore'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, defineComponent, h, provide, ref } from 'vue'

import { i18n } from '@/i18n'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { unflattenOutputAssets } from '@/platform/assets/composables/media/assetMappers'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import {
  MediaAssetKey,
  parseAssetInfo
} from '@/platform/assets/schemas/mediaAssetSchema'
import type { AssetId, AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { AssetMeta } from '@/platform/assets/schemas/mediaAssetSchema'
import { seedMediaNodeDefs } from '@/platform/workflowErrors/missingMedia/__fixtures__/promotedMedia'
import { scanNodeMediaCandidates } from '@/platform/workflowErrors/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { api } from '@/scripts/api'
import { useLitegraphService } from '@/services/litegraphService'
import { markGraphLoadFailurePresented } from '@/services/graphLoadFailure'
import { detectNodeTypeFromFilename } from '@/utils/loaderNodeUtil'
import { clearDeletedAssetWidgetValues } from '@/platform/assets/utils/clearDeletedAssetWidgetValues'
import { clearNodePreviewCacheForValues } from '@/platform/assets/utils/clearNodePreviewCacheForValues'
import { markDeletedAssetsAsMissingMedia } from '@/platform/assets/utils/markDeletedAssetsAsMissingMedia'
import { getAssetType } from '@/platform/assets/utils/assetTypeUtil'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'
import { startAssetDrag } from '@/platform/assets/utils/assetDragUtil'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { useMediaAssetActions as createMediaAssetActions } from './useMediaAssetActions'

// Use vi.hoisted to create a mutable reference for isCloud
const mockIsCloud = vi.hoisted(() => ({ value: false }))

const mockDownloadFile = vi.hoisted(() => vi.fn())
const mockDownloadFileAsBlob = vi.hoisted(() => vi.fn())
vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadFile: mockDownloadFile,
  downloadFileAsBlob: mockDownloadFileAsBlob
}))

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const mockShowDialog = vi.hoisted(() => vi.fn())

const mockInvalidateModelsForCategory = vi.hoisted(() => vi.fn())
const mockSetAssetDeleting = vi.hoisted(() =>
  vi.fn<(assetId: AssetId, isDeleting: boolean) => void>()
)
const mockHasCategory = vi.hoisted(() => vi.fn())
const mockInputAssets = vi.hoisted(() => ({ items: [] as AssetItem[] }))

vi.mock(import('@/composables/useCopyToClipboard'), () => ({
  useCopyToClipboard: () => ({
    copyToClipboard: vi.fn()
  })
}))

const mockExportWorkflowAction = vi.hoisted(() => vi.fn())
const mockOpenWorkflowAction = vi.hoisted(() => vi.fn())
vi.mock(
  import('@/platform/workflow/core/services/workflowActionsService'),
  () => ({
    useWorkflowActionsService: () => ({
      openWorkflowAction: mockOpenWorkflowAction,
      exportWorkflowAction: mockExportWorkflowAction
    })
  })
)

const mockExtractWorkflowFromAsset = vi.hoisted(() => vi.fn())
const mockExtractApiPromptFromAsset = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/workflow/utils/workflowExtractionUtil'), () => ({
  extractWorkflowFromAsset: mockExtractWorkflowFromAsset,
  extractApiPromptFromAsset: mockExtractApiPromptFromAsset
}))

vi.mock(import('@/services/litegraphService'))

vi.mock(import('@/utils/loaderNodeUtil'))
const mockDetectNodeTypeFromFilename = vi.mocked(detectNodeTypeFromFilename)

vi.mock(import('@/utils/typeGuardUtil'), { spy: true })

vi.mock(import('@/platform/assets/utils/assetTypeUtil'), { spy: true })
const mockGetAssetType = vi.mocked(getAssetType)

const mockGetOutputAssetMetadata = vi.hoisted(() =>
  vi.fn<
    (
      metadata: Record<string, unknown> | undefined
    ) => Record<string, unknown> | null
  >(() => null)
)
vi.mock<unknown>(
  import('@/platform/assets/schemas/assetMetadataSchema'),
  () => ({
    getOutputAssetMetadata: mockGetOutputAssetMetadata
  })
)

vi.mock(import('@/platform/assets/utils/outputAssetUtil'), { spy: true })
const mockResolveOutputAssetItems = vi.mocked(resolveOutputAssetItems)

const mockDeleteAsset = vi.hoisted(() =>
  vi.fn<(id: AssetId) => Promise<void>>()
)
const mockCreateAssetExport = vi.hoisted(() =>
  vi.fn<
    (
      params: CreateAssetExportData['body']
    ) => Promise<{ task_id: string; status: string; message?: string }>
  >(async () => ({ task_id: 'test-task-id', status: 'pending' }))
)
vi.mock<unknown>(import('@/platform/assets/services/assetService'), () => ({
  assetService: {
    deleteAsset: mockDeleteAsset,
    createAssetExport: mockCreateAssetExport
  }
}))

const mockTrackExport = vi.hoisted(() => vi.fn())

vi.mock(import('@/scripts/api'))

beforeEach(() => {
  vi.mocked(api.fetchApi).mockImplementation(async () => new Response())
  vi.mocked(api.apiURL).mockImplementation(
    (path) => `http://localhost:8188/api${path}`
  )
  vi.mocked(api.internalURL).mockImplementation(
    (path) => `http://localhost:8188${path}`
  )
  api.user = 'test-user'
})

const mockAppGraph = vi.hoisted(() => ({
  value: { nodes: [] as unknown[] }
}))
const mockLoadApiJson = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    nodeOutputs: {},
    nodePreviewImages: {},
    get graph() {
      return mockAppGraph.value
    },
    get rootGraph() {
      return mockAppGraph.value
    },
    isApiJson: (data: unknown) => !!data && typeof data === 'object',
    loadApiJson: mockLoadApiJson
  }
}))

const mockRemoveNodeOutputs = vi.hoisted(() => vi.fn())
const mockRemoveNodeOutputsForNode = vi.hoisted(() => vi.fn())

const mockCaptureCanvasState = vi.hoisted(() => vi.fn())

vi.mock(import('@/platform/assets/utils/clearNodePreviewCacheForValues'), {
  spy: true
})
const mockClearNodePreviewCache = vi.mocked(clearNodePreviewCacheForValues)

vi.mock(import('@/platform/assets/utils/clearDeletedAssetWidgetValues'), {
  spy: true
})
const mockClearWidgetValues = vi.mocked(clearDeletedAssetWidgetValues)

vi.mock(import('@/platform/workflowErrors/missingMedia/missingMediaScan'), {
  spy: true
})
const mockScanNodeMediaCandidates = vi.mocked(scanNodeMediaCandidates)

vi.mock(import('@/platform/assets/utils/markDeletedAssetsAsMissingMedia'), {
  spy: true
})
const mockMarkMissingMedia = vi.mocked(markDeletedAssetsAsMissingMedia)

function createMockAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return fromPartial({
    id: 'test-asset-id',
    name: 'original-name.jpeg',
    size: 1024,
    created_at: '2025-01-01T00:00:00Z',
    tags: ['input'],
    ...overrides
  })
}

function createMockMediaAsset(overrides: Partial<AssetMeta> = {}): AssetMeta {
  return {
    ...createMockAsset(),
    kind: 'image',
    src: 'https://example.com/default-preview.png',
    ...overrides
  }
}

function createLoadImageNode(): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    widgets: [{ name: 'image', value: '', callback: vi.fn() }],
    graph: { setDirtyCanvas: vi.fn() }
  })
}

function captureAddedNodes() {
  const addedNodes: LGraphNode[] = []
  vi.mocked(useLitegraphService()).addNodeOnGraph.mockImplementation(() => {
    const node = createLoadImageNode()
    addedNodes.push(node)
    return node
  })
  return addedNodes
}

function getImageWidgetValues(nodes: LGraphNode[]) {
  return nodes.map(
    (node) => node.widgets?.find((widget) => widget.name === 'image')?.value
  )
}

const apps: App<Element>[] = []

function mountMediaActions(asset?: AssetMeta) {
  let actions: ReturnType<typeof createMediaAssetActions> | undefined

  const ChildComponent = defineComponent({
    setup() {
      actions = createMediaAssetActions()
      return () => null
    }
  })

  const HostComponent = defineComponent({
    setup() {
      provide(MediaAssetKey, {
        asset: ref(asset),
        context: ref({ type: 'input' as const })
      })
      return () => h(ChildComponent)
    }
  })

  const host = document.createElement('div')
  const app = createApp(HostComponent)
  app.use(i18n)
  app.mount(host)
  apps.push(app)

  if (!actions) throw new Error('media asset actions not initialized')

  return {
    actions,
    unmount: () => {
      apps.splice(apps.indexOf(app), 1)
      app.unmount()
    }
  }
}

function useMediaAssetActions() {
  return mountMediaActions().actions
}

afterEach(() => apps.splice(0).forEach((app) => app.unmount()))

beforeEach(() => {
  useNodeDefStore().nodeDefsByName = {
    LoadImage: fromPartial({
      name: 'LoadImage',
      display_name: 'Load Image'
    })
  }
  useWorkflowStore().activeWorkflow = fromPartial({
    changeTracker: { captureCanvasState: mockCaptureCanvasState }
  })
})

beforeEach(() => {
  vi.mocked(useDialogStore().showDialog).mockImplementation(mockShowDialog)
  vi.mocked(useAssetsStore().setAssetDeleting).mockImplementation(
    mockSetAssetDeleting
  )
  vi.spyOn(useAssetsStore().inputAssets, 'items', 'get').mockImplementation(
    () => mockInputAssets.items
  )
  vi.spyOn(useAssetsStore().inputAssets, 'invalidate').mockImplementation(
    async (stale?: string[]) => {
      const ids = new Set(stale)
      mockInputAssets.items = mockInputAssets.items.filter(
        (item) => !ids.has(item.id)
      )
    }
  )
  vi.mocked(useAssetsStore().invalidateModelsForCategory).mockImplementation(
    mockInvalidateModelsForCategory
  )
  vi.mocked(useAssetsStore().hasCategory).mockImplementation(mockHasCategory)
  vi.mocked(useAssetExportStore().trackExport).mockImplementation(
    mockTrackExport
  )
  vi.mocked(useNodeOutputStore().removeNodeOutputs).mockImplementation(
    mockRemoveNodeOutputs
  )
  vi.mocked(useNodeOutputStore().removeNodeOutputsForNode).mockImplementation(
    mockRemoveNodeOutputsForNode
  )
})

describe('useMediaAssetActions', () => {
  beforeEach(() => {
    mockIsCloud.value = false
    vi.mocked(api.getServerFeature).mockImplementation(
      (_path: string, defaultValue?: unknown) => defaultValue
    )
    vi.mocked(useLitegraphService()).addNodeOnGraph.mockImplementation(
      createLoadImageNode
    )
    vi.mocked(useLitegraphService()).getCanvasCenter.mockReturnValue([100, 100])
    mockDetectNodeTypeFromFilename.mockReturnValue({
      nodeType: 'LoadImage',
      widgetName: 'image'
    })
    mockGetOutputAssetMetadata.mockReturnValue(null)
    mockGetAssetType.mockReturnValue('input')
    mockResolveOutputAssetItems.mockResolvedValue([])
    mockInputAssets.items = []
  })

  describe('addWorkflow', () => {
    describe('OSS mode (isCloud = false)', () => {
      beforeEach(() => {
        mockIsCloud.value = false
      })

      it('should use asset.name as filename', async () => {
        const addedNodes = captureAddedNodes()
        const actions = useMediaAssetActions()

        const asset = createMockAsset({
          name: 'my-image.jpeg',
          hash: 'hash123.jpeg'
        })

        await actions.addWorkflow(asset)

        expect(getImageWidgetValues(addedNodes)).toEqual(['my-image.jpeg'])
      })
    })

    describe('Cloud mode (isCloud = true)', () => {
      beforeEach(() => {
        mockIsCloud.value = true
      })

      it('should use hash as filename when available', async () => {
        const addedNodes = captureAddedNodes()
        const actions = useMediaAssetActions()

        const asset = createMockAsset({
          name: 'original.jpeg',
          hash: 'abc123hash.jpeg'
        })

        await actions.addWorkflow(asset)

        expect(getImageWidgetValues(addedNodes)).toEqual(['abc123hash.jpeg'])
      })

      it('annotates a single output asset with its metadata subfolder', async () => {
        const addedNodes = captureAddedNodes()
        mockGetAssetType.mockReturnValue('output')
        const actions = useMediaAssetActions()

        await actions.addWorkflow(
          createMockAsset({
            name: 'generated.png',
            user_metadata: { subfolder: 'runs/2026' }
          })
        )

        expect(getImageWidgetValues(addedNodes)).toEqual([
          'runs/2026/generated.png [output]'
        ])
      })

      it('should fall back to asset.name when hash is not available', async () => {
        const addedNodes = captureAddedNodes()
        const actions = useMediaAssetActions()

        const asset = createMockAsset({
          name: 'fallback-name.jpeg',
          hash: undefined
        })

        await actions.addWorkflow(asset)

        expect(getImageWidgetValues(addedNodes)).toEqual(['fallback-name.jpeg'])
      })
    })

    it('adds supported assets and reports an exact partial result', async () => {
      const addedNodes = captureAddedNodes()
      mockDetectNodeTypeFromFilename.mockImplementation((filename: string) =>
        filename.endsWith('.txt')
          ? { nodeType: null, widgetName: null }
          : { nodeType: 'LoadImage', widgetName: 'image' }
      )
      const { actions, unmount } = mountMediaActions()
      const assets = [
        createMockAsset({ id: '1', name: 'first.png' }),
        createMockAsset({ id: '2', name: 'unsupported.txt' }),
        createMockAsset({ id: '3', name: 'third.png' })
      ]

      await actions.addMultipleToWorkflow(assets)

      expect(useLitegraphService().addNodeOnGraph).toHaveBeenCalledTimes(2)
      expect(getImageWidgetValues(addedNodes)).toEqual([
        'first.png',
        'third.png'
      ])
      expect(
        vi
          .mocked(useLitegraphService())
          .addNodeOnGraph.mock.calls.map(([, options]) => options)
      ).toEqual([{ pos: [100, 100] }, { pos: [150, 150] }])
      expect(useToast().warning).toHaveBeenCalledWith(
        i18n.global.t('g.warning'),
        {
          description: i18n.global.t(
            'mediaAsset.selection.partialAddNodesSuccess',
            {
              succeeded: 2,
              failed: 1
            }
          ),
          duration: 3000
        }
      )
      unmount()
    })
  })

  describe('addMultipleToWorkflow', () => {
    describe('Cloud mode (isCloud = true)', () => {
      beforeEach(() => {
        mockIsCloud.value = true
      })

      it('assigns hashes with annotations derived from each asset type', async () => {
        const addedNodes = captureAddedNodes()
        const typeByAssetId = new Map([
          ['1', 'input'],
          ['2', 'temp'],
          ['3', 'output']
        ])
        mockGetAssetType.mockImplementation(
          (asset: AssetItem) => typeByAssetId.get(asset.id) ?? 'input'
        )
        const { actions, unmount } = mountMediaActions()

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
          }),
          createMockAsset({
            id: '3',
            name: 'file3.jpeg',
            hash: 'hash3.jpeg'
          })
        ]

        await actions.addMultipleToWorkflow(assets)
        const widgetValues = getImageWidgetValues(addedNodes)
        unmount()

        expect(widgetValues).toEqual([
          'hash1.jpeg',
          'hash2.jpeg [temp]',
          'hash3.jpeg [output]'
        ])
      })
    })
  })

  describe('openWorkflow', () => {
    const apiPrompt = {
      '1': { class_type: 'KSampler', inputs: { seed: 1 } }
    }

    beforeEach(() => {
      mockOpenWorkflowAction.mockResolvedValue({ success: true })
      mockExtractApiPromptFromAsset.mockResolvedValue(undefined)
    })

    it('opens an embedded workflow without touching the stored API graph', async () => {
      mockExtractWorkflowFromAsset.mockResolvedValue({
        workflow: { version: 0.4 },
        filename: 'open.json'
      })
      const actions = useMediaAssetActions()

      await actions.openWorkflow(createMockAsset())

      expect(mockOpenWorkflowAction).toHaveBeenCalledWith(
        { version: 0.4 },
        'open.json'
      )
      expect(mockLoadApiJson).not.toHaveBeenCalled()
    })

    it('opens the stored API graph when no workflow is embedded', async () => {
      mockExtractWorkflowFromAsset.mockResolvedValue({
        workflow: null,
        filename: 'open.json'
      })
      mockExtractApiPromptFromAsset.mockResolvedValue(apiPrompt)
      const actions = useMediaAssetActions()

      await actions.openWorkflow(createMockAsset())

      expect(mockLoadApiJson).toHaveBeenCalledWith(apiPrompt, 'open.json')
      expect(mockOpenWorkflowAction).not.toHaveBeenCalled()
      expect(useToast().success).toHaveBeenCalled()
    })

    it('warns when loading the stored API graph fails', async () => {
      mockExtractWorkflowFromAsset.mockResolvedValue({
        workflow: null,
        filename: 'open.json'
      })
      mockExtractApiPromptFromAsset.mockResolvedValue(apiPrompt)
      mockLoadApiJson.mockRejectedValueOnce(new Error('boom'))
      const actions = useMediaAssetActions()

      await actions.openWorkflow(createMockAsset())

      expect(useToast().warning).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ description: 'boom' })
      )
    })

    it.for([
      {
        name: 'single',
        open: (
          actions: ReturnType<typeof useMediaAssetActions>,
          asset: AssetItem
        ) => actions.openWorkflow(asset)
      },
      {
        name: 'bulk',
        open: (
          actions: ReturnType<typeof useMediaAssetActions>,
          asset: AssetItem
        ) => actions.openMultipleWorkflows([asset])
      }
    ])(
      'does not show another toast for a handled $name API-prompt failure',
      async ({ open }) => {
        mockExtractWorkflowFromAsset.mockResolvedValue({
          workflow: null,
          filename: 'open.json'
        })
        mockExtractApiPromptFromAsset.mockResolvedValue(apiPrompt)
        mockLoadApiJson.mockRejectedValueOnce(
          markGraphLoadFailurePresented(new Error('boom'))
        )
        const actions = useMediaAssetActions()

        await open(actions, createMockAsset())

        expect(useToast().warning).not.toHaveBeenCalled()
        expect(useToast().success).not.toHaveBeenCalled()
        expect(mockReportError).toHaveBeenCalledOnce()
      }
    )

    it.for([
      {
        name: 'single',
        open: (
          actions: ReturnType<typeof useMediaAssetActions>,
          asset: AssetItem
        ) => actions.openWorkflow(asset)
      },
      {
        name: 'bulk',
        open: (
          actions: ReturnType<typeof useMediaAssetActions>,
          asset: AssetItem
        ) => actions.openMultipleWorkflows([asset])
      }
    ])(
      'does not show another toast for a handled $name full-workflow failure',
      async ({ open }) => {
        mockExtractWorkflowFromAsset.mockResolvedValue({
          workflow: { version: 0.4 },
          filename: 'open.json'
        })
        mockOpenWorkflowAction.mockResolvedValue({
          success: false,
          errorPresentation: 'handled'
        })
        const actions = useMediaAssetActions()

        await open(actions, createMockAsset())

        expect(useToast().warning).not.toHaveBeenCalled()
        expect(useToast().success).not.toHaveBeenCalled()
      }
    )

    it('warns when fetching the stored API graph fails', async () => {
      mockExtractWorkflowFromAsset.mockResolvedValue({
        workflow: null,
        filename: 'open.json'
      })
      mockExtractApiPromptFromAsset.mockRejectedValueOnce(
        new Error('network down')
      )
      const actions = useMediaAssetActions()

      await actions.openWorkflow(createMockAsset())

      expect(useToast().warning).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ description: 'network down' })
      )
    })

    it('warns when neither a workflow nor a stored API graph exists', async () => {
      mockExtractWorkflowFromAsset.mockResolvedValue({
        workflow: null,
        filename: 'open.json'
      })
      const actions = useMediaAssetActions()

      await actions.openWorkflow(createMockAsset())

      expect(mockLoadApiJson).not.toHaveBeenCalled()
      expect(useToast().warning).toHaveBeenCalled()
    })
  })

  describe('openMultipleWorkflows', () => {
    it('falls back to the stored API graph for assets with no workflow', async () => {
      const apiPrompt = { '1': { class_type: 'KSampler', inputs: {} } }
      mockOpenWorkflowAction.mockResolvedValue({ success: true })
      mockExtractWorkflowFromAsset.mockResolvedValue({
        workflow: null,
        filename: 'bulk.json'
      })
      mockExtractApiPromptFromAsset.mockResolvedValue(apiPrompt)
      const actions = useMediaAssetActions()

      await actions.openMultipleWorkflows([createMockAsset()])

      expect(mockLoadApiJson).toHaveBeenCalledWith(apiPrompt, 'bulk.json')
      expect(useToast().success).toHaveBeenCalled()
    })
  })

  describe('exportWorkflow', () => {
    const successResult = { success: true } as const
    const cancelledResult = { success: false, cancelled: true } as const
    const failureResult = { success: false, error: 'boom' } as const
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
      const actions = useMediaAssetActions()

      await actions.exportWorkflow(createMockAsset())

      expect(useToast().toasts).toEqual([])
    })

    it('shows a success toast on successful export', async () => {
      mockExportWorkflowAction.mockResolvedValue(successResult)
      const actions = useMediaAssetActions()

      await actions.exportWorkflow(createMockAsset())

      expect(useToast().success).toHaveBeenCalled()
    })

    it('shows an error toast on actual failure', async () => {
      mockExportWorkflowAction.mockResolvedValue(failureResult)
      const actions = useMediaAssetActions()

      await actions.exportWorkflow(createMockAsset())

      expect(useToast().error).toHaveBeenCalled()
    })

    it('shows a warning toast when the workflow is missing', async () => {
      mockExportWorkflowAction.mockResolvedValue(noWorkflowResult)
      const actions = useMediaAssetActions()

      await actions.exportWorkflow(createMockAsset())

      expect(useToast().warning).toHaveBeenCalled()
    })

    it('shows no toast when every asset in a bulk export is cancelled', async () => {
      mockExportWorkflowAction.mockResolvedValue(cancelledResult)
      const actions = useMediaAssetActions()

      await actions.exportMultipleWorkflows([
        createMockAsset({ id: 'a' }),
        createMockAsset({ id: 'b' })
      ])

      expect(useToast().toasts).toEqual([])
    })

    it('shows a success toast for the succeeded subset when some bulk exports are cancelled', async () => {
      mockExportWorkflowAction
        .mockResolvedValueOnce(successResult)
        .mockResolvedValueOnce(cancelledResult)
      const actions = useMediaAssetActions()

      await actions.exportMultipleWorkflows([
        createMockAsset({ id: 'a' }),
        createMockAsset({ id: 'b' })
      ])

      expect(useToast().success).toHaveBeenCalled()
    })

    it('shows a partial-success warning toast when some bulk exports fail outright', async () => {
      mockExportWorkflowAction
        .mockResolvedValueOnce(successResult)
        .mockResolvedValueOnce(failureResult)
      const actions = useMediaAssetActions()

      await actions.exportMultipleWorkflows([
        createMockAsset({ id: 'a' }),
        createMockAsset({ id: 'b' })
      ])

      expect(useToast().warning).toHaveBeenCalled()
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

    it('downloads a single explicit asset by asset id in cloud', () => {
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

      expect(mockDownloadFileAsBlob).toHaveBeenCalledOnce()
      expect(mockDownloadFileAsBlob).toHaveBeenCalledWith(
        'http://localhost:8188/api/assets/single-output/content',
        expect.objectContaining({ filename: 'single-output.png' })
      )
      expect(mockCreateAssetExport).not.toHaveBeenCalled()
      expect(mockTrackExport).not.toHaveBeenCalled()
    })

    it('fetches a cloud download through the workspace-authenticated client', async () => {
      mockIsCloud.value = true
      mockGetOutputAssetMetadata.mockReturnValue({
        jobId: 'job1',
        outputCount: 1
      })

      const actions = useMediaAssetActions()
      actions.downloadAssets([
        createMockAsset({
          id: 'team-owned',
          name: 'team-owned.glb',
          tags: ['output'],
          user_metadata: { jobId: 'job1', outputCount: 1 }
        })
      ])

      const contentUrl = 'http://localhost:8188/api/assets/team-owned/content'
      expect(mockDownloadFileAsBlob).toHaveBeenCalledWith(
        contentUrl,
        expect.objectContaining({ fetch: expect.any(Function) })
      )

      const { fetch: authedFetch } = mockDownloadFileAsBlob.mock.calls[0][1]
      await authedFetch(contentUrl)
      expect(api.fetchApi).toHaveBeenCalledWith(contentUrl)
    })

    it('preserves successful OSS downloads when another file fails', async () => {
      const failure = new Error('download failed')
      mockDownloadFile
        .mockImplementationOnce(() => {
          throw failure
        })
        .mockImplementationOnce(() => {})
      const actions = useMediaAssetActions()

      actions.downloadAssets([
        createMockAsset({ id: 'a', name: 'a.png' }),
        createMockAsset({ id: 'b', name: 'b.png' })
      ])

      expect(mockDownloadFile).toHaveBeenCalledTimes(2)
      await vi.waitFor(() => {
        expect(useToast().success).toHaveBeenCalledWith(
          'Success',
          expect.objectContaining({
            description: 'Started downloading 1 file'
          })
        )
        expect(useToast().error).toHaveBeenCalledWith(
          'Error',
          expect.objectContaining({ description: '1 download failed' })
        )
      })
      expect(mockReportError).toHaveBeenCalledWith(failure, {
        surface: 'assets',
        errorType: 'error_downloading_asset',
        context: { filename: 'a.png' }
      })
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

      const actions = useMediaAssetActions()
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

      const actions = useMediaAssetActions()
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

      const actions = useMediaAssetActions()
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

      const actions = useMediaAssetActions()
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

      const actions = useMediaAssetActions()
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

      const actions = useMediaAssetActions()
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

      const actions = useMediaAssetActions()
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

    it('should export temp history outputs through their job IDs', async () => {
      mockGetAssetType.mockImplementation((asset: AssetItem) =>
        asset.id === 'temp-job' ? 'temp' : 'output'
      )
      const tempOutput = createOutputAsset(
        'temp-job',
        'ComfyUI_temp_audio.flac',
        'temp-job',
        1
      )
      const savedOutput = createOutputAsset(
        'output-job',
        'ComfyUI_output.png',
        'output-job',
        1
      )

      const actions = useMediaAssetActions()
      actions.downloadAssets([tempOutput, savedOutput])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      expect(mockCreateAssetExport).toHaveBeenCalledWith({
        job_ids: ['temp-job', 'output-job'],
        naming_strategy: 'group_by_job_time',
        include_previews: true
      })
    })

    it('should export inputs with output-shaped metadata through their asset IDs', async () => {
      mockGetAssetType.mockImplementation((asset: AssetItem) =>
        asset.id === 'input-asset' ? 'input' : 'output'
      )
      const inputWithJobMetadata = createMockAsset({
        id: 'input-asset',
        name: 'reference.png',
        tags: ['input'],
        user_metadata: { jobId: 'unrelated-job', nodeId: '1' }
      })
      const savedOutput = createOutputAsset('output-job', 'out.png', 'job1', 1)

      const actions = useMediaAssetActions()
      actions.downloadAssets([inputWithJobMetadata, savedOutput])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      expect(mockCreateAssetExport).toHaveBeenCalledWith({
        job_ids: ['job1'],
        asset_ids: ['input-asset'],
        naming_strategy: 'preserve',
        include_previews: true
      })
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

    it('should omit name filters when a job-level selection overlaps a child', async () => {
      const parent = createOutputAsset('parent', 'cover.png', 'job1', 3)
      const child = createOutputAsset('child', 'img1.png', 'job1')

      const actions = useMediaAssetActions()
      actions.downloadAssets([parent, child])

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledTimes(1)
      })

      expect(mockCreateAssetExport).toHaveBeenCalledWith({
        job_ids: ['job1'],
        naming_strategy: 'preserve',
        include_previews: true
      })
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

  describe('downloadAssets - local zip export', () => {
    beforeEach(() => {
      mockIsCloud.value = false
      vi.mocked(api.getServerFeature).mockImplementation(
        (path: string, defaultValue?: unknown) =>
          path === 'assets' ? true : defaultValue
      )
      mockGetAssetType.mockImplementation((asset: AssetItem) =>
        asset.tags.includes('input') ? 'input' : 'output'
      )
      mockGetOutputAssetMetadata.mockImplementation(
        (meta: Record<string, unknown> | undefined) =>
          meta && 'jobId' in meta ? meta : null
      )
    })

    const groupedJob = createMockAsset({
      id: 'job1',
      name: 'cover.png',
      tags: ['output'],
      user_metadata: { jobId: 'job1', outputCount: 3 }
    })
    const flatJobOutput = createMockAsset({
      id: 'flat-asset',
      name: 'flat.png',
      tags: ['output'],
      job_id: 'job2'
    })
    const jobLessOutput = createMockAsset({
      id: 'scanned-asset',
      name: 'scanned.png',
      tags: ['output'],
      job_id: null
    })
    const input = createMockAsset({ id: 'input-asset', tags: ['input'] })

    it.for([
      {
        name: 'a grouped job',
        assets: [groupedJob],
        expected: {
          job_ids: ['job1'],
          naming_strategy: 'preserve',
          include_previews: true
        }
      },
      {
        name: 'an output without job metadata, by asset id',
        assets: [groupedJob, flatJobOutput],
        expected: {
          job_ids: ['job1'],
          asset_ids: ['flat-asset'],
          naming_strategy: 'preserve',
          include_previews: true
        }
      },
      {
        name: 'outputs with no job, by asset id',
        assets: [groupedJob, jobLessOutput, input],
        expected: {
          job_ids: ['job1'],
          asset_ids: ['scanned-asset', 'input-asset'],
          naming_strategy: 'preserve',
          include_previews: true
        }
      }
    ])('zips $name', async ({ assets, expected }) => {
      const actions = useMediaAssetActions()
      actions.downloadAssets(assets)

      await vi.waitFor(() => {
        expect(mockCreateAssetExport).toHaveBeenCalledWith(expected)
      })
      expect(mockTrackExport).toHaveBeenCalledWith('test-task-id')
      expect(mockDownloadFile).not.toHaveBeenCalled()
    })

    it('downloads files one by one when the assets system is disabled', async () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path: string, defaultValue?: unknown) => defaultValue
      )

      const actions = useMediaAssetActions()
      actions.downloadAssets([jobLessOutput, input])

      await vi.waitFor(() => {
        expect(mockDownloadFile).toHaveBeenCalledTimes(2)
      })
      expect(mockCreateAssetExport).not.toHaveBeenCalled()
    })
  })

  describe('downloadAssets - export toast file count', () => {
    beforeEach(() => {
      mockIsCloud.value = true
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

      const { info } = useToast()
      await vi.waitFor(() => {
        expect(info).toHaveBeenCalledWith(
          'Preparing ZIP download...',
          expect.objectContaining({
            description: i18n.global.t(
              'mediaAsset.selection.exportStarted',
              { count },
              count
            )
          })
        )
      })
    }

    it('should report total file count, not job count, for multi-output jobs', async () => {
      const j1 = createOutputAsset('a1', 'img1.png', 'job1', 2)
      const j2 = createOutputAsset('a2', 'img2.png', 'job2', 4)

      const actions = useMediaAssetActions()
      actions.downloadAssets([j1, j2])

      await expectExportToastFileCount(6)
    })

    it('should treat assets without outputCount as a single file', async () => {
      const a1 = createOutputAsset('a1', 'img1.png', 'job1')
      const a2 = createOutputAsset('a2', 'img2.png', 'job2')

      const actions = useMediaAssetActions()
      actions.downloadAssets([a1, a2])

      await expectExportToastFileCount(2)
    })

    it('should mix multi-output and single-output assets correctly', async () => {
      const j1 = createOutputAsset('a1', 'img1.png', 'job1', 3)
      const a2 = createOutputAsset('a2', 'img2.png', 'job2')

      const actions = useMediaAssetActions()
      actions.downloadAssets([j1, a2])

      await expectExportToastFileCount(4)
    })

    it('should only count duplicate job-level output selections once', async () => {
      const j1 = createOutputAsset('a1', 'img1.png', 'job1', 3)
      const j1Duplicate = createOutputAsset('a2', 'img2.png', 'job1', 3)

      const actions = useMediaAssetActions()
      actions.downloadAssets([j1, j1Duplicate])

      await expectExportToastFileCount(3)
    })

    it('should count an overlapping job-level selection and child once', async () => {
      const parent = createOutputAsset('parent', 'cover.png', 'job1', 3)
      const child = createOutputAsset('child', 'img1.png', 'job1')

      const actions = useMediaAssetActions()
      actions.downloadAssets([parent, child])

      await expectExportToastFileCount(3)
    })
  })

  describe('deleteAssets - model cache invalidation', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      mockGetAssetType.mockReturnValue('input')
      mockDeleteAsset.mockResolvedValue(undefined)
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
        ({ props }: { props: { onConfirm: (confirmed: boolean) => void } }) => {
          props.onConfirm(true)
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
        ({ props }: { props: { onConfirm: (confirmed: boolean) => void } }) => {
          props.onConfirm(true)
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
        ({ props }: { props: { onConfirm: (confirmed: boolean) => void } }) => {
          props.onConfirm(true)
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
        ({ props }: { props: { onConfirm: (confirmed: boolean) => void } }) => {
          props.onConfirm(true)
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

  describe('deleteAssets - deletion disabled', () => {
    it('does not offer or perform deletion', async () => {
      mockIsCloud.value = true
      vi.mocked(api.getServerFeature).mockImplementation(
        (path: string, defaultValue?: unknown) =>
          path === 'asset_deletion_enabled' ? false : defaultValue
      )
      mockDeleteAsset.mockResolvedValue(undefined)
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: (confirmed: boolean) => void } }) => {
          props.onConfirm(true)
        }
      )
      const actions = useMediaAssetActions()
      const asset = createMockAsset({ id: 'disabled-asset' })

      await expect(actions.deleteAssets(asset)).resolves.toBe(false)

      expect(mockShowDialog).not.toHaveBeenCalled()
      expect(mockDeleteAsset).not.toHaveBeenCalled()
      expect(mockSetAssetDeleting).not.toHaveBeenCalled()
      expect(mockInputAssets.items).toEqual([])
      expect(useToast().add).toHaveBeenCalledWith({
        detail: 'mediaAsset.deletionUnsupported',
        life: 5000,
        severity: 'error',
        summary: 'g.error'
      })
    })
  })

  describe('deleteAssets - success', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      mockGetAssetType.mockReturnValue('input')
      mockDeleteAsset.mockResolvedValue(undefined)
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: (confirmed: boolean) => void } }) => {
          props.onConfirm(true)
        }
      )
      mockAppGraph.value = { nodes: [] }
    })

    it('completes the lifecycle for one confirmed asset record', async () => {
      const { actions, unmount } = mountMediaActions()
      const asset = createMockAsset({
        id: '1cbe0b07-8aef-4f28-8188-dfba48c8fbda',
        name: 'confirmed.png'
      })
      mockInputAssets.items = [asset]

      await expect(actions.deleteAssets(asset)).resolves.toBe(true)

      expect(mockDeleteAsset).toHaveBeenCalledOnce()
      expect(mockDeleteAsset.mock.calls.map(([id]) => id)).toEqual([asset.id])
      expect(api.deleteItem).not.toHaveBeenCalled()
      expect(mockSetAssetDeleting.mock.calls).toEqual([
        [asset.id, true],
        [asset.id, false]
      ])
      expect(mockInputAssets.items).toEqual([])
      expect(mockSetAssetDeleting.mock.invocationCallOrder[0]).toBeLessThan(
        mockDeleteAsset.mock.invocationCallOrder[0]
      )
      expect(mockDeleteAsset.mock.invocationCallOrder[0]).toBeLessThan(
        mockSetAssetDeleting.mock.invocationCallOrder[1]
      )
      expect(useToast().success).toHaveBeenCalledWith('Deletion successful', {
        description: i18n.global.t('mediaAsset.assetsDeleted', { total: 1 }, 1),
        duration: 2000
      })

      unmount()
    })

    it('deletes OSS output history without calling the asset endpoint', async () => {
      mockIsCloud.value = false
      vi.mocked(api.getServerFeature).mockReturnValue(false)
      mockGetAssetType.mockReturnValue('output')
      mockGetOutputAssetMetadata.mockReturnValue({ jobId: 'job-1' })
      vi.mocked(api.deleteItem).mockResolvedValue(undefined)
      const actions = useMediaAssetActions()
      const asset = createMockAsset({
        id: 'asset-1',
        name: 'output.png',
        tags: ['output'],
        user_metadata: { jobId: 'job-1' }
      })

      await expect(actions.deleteAssets(asset)).resolves.toBe(true)

      expect(api.deleteItem).toHaveBeenCalledWith('history', 'job-1')
      expect(mockDeleteAsset).not.toHaveBeenCalled()
      expect(useToast().success).toHaveBeenCalled()
    })
  })

  describe('deleteAssets - cancellation', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: (confirmed: boolean) => void } }) => {
          props.onConfirm(false)
        }
      )
    })

    it('deletes nothing when the confirmation is declined', async () => {
      const { actions, unmount } = mountMediaActions()

      await expect(
        actions.deleteAssets(createMockAsset({ id: 'asset-1' }))
      ).resolves.toBe(false)

      expect(mockShowDialog).toHaveBeenCalledTimes(1)
      expect(mockDeleteAsset).not.toHaveBeenCalled()

      unmount()
    })

    it('deletes nothing when the dialog is dismissed without an answer', async () => {
      mockShowDialog.mockImplementation(
        ({
          dialogComponentProps
        }: {
          dialogComponentProps: { onRemoved: () => void }
        }) => {
          dialogComponentProps.onRemoved()
        }
      )
      const { actions, unmount } = mountMediaActions()

      await expect(
        actions.deleteAssets(createMockAsset({ id: 'asset-1' }))
      ).resolves.toBe(false)

      expect(mockShowDialog).toHaveBeenCalledTimes(1)
      expect(mockDeleteAsset).not.toHaveBeenCalled()

      unmount()
    })

    it('names every grouped output in the dialog it then cancels', async () => {
      mockGetOutputAssetMetadata.mockReturnValue({
        allOutputs: [
          {
            assetId: 'output-1',
            display_name: 'First output',
            filename: 'first.png'
          },
          { assetId: 'output-2', filename: 'second.png' }
        ]
      })
      const { actions, unmount } = mountMediaActions()

      await expect(
        actions.deleteAssets(createMockAsset({ id: 'job-cover' }))
      ).resolves.toBe(false)

      expect(mockShowDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            itemList: ['First output', 'second.png']
          })
        })
      )
      expect(mockDeleteAsset).not.toHaveBeenCalled()

      unmount()
    })
  })

  describe('deleteAssets - confirmation dialog item names', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      mockGetAssetType.mockReturnValue('output')
      mockShowDialog.mockImplementation(
        ({
          dialogComponentProps
        }: {
          dialogComponentProps: { onRemoved: () => void }
        }) => {
          dialogComponentProps.onRemoved()
        }
      )
    })

    it('should show user_metadata display names instead of hash filenames', async () => {
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

      await actions.deleteAssets(assets)

      expect(mockShowDialog).toHaveBeenCalledTimes(1)
      const dialogProps = mockShowDialog.mock.calls[0][0].props as {
        itemList: string[]
      }
      expect(dialogProps.itemList).toEqual([
        'My Sunset Render',
        'Portrait Variation'
      ])
    })

    it('should fall back to asset.name when no display name is available', async () => {
      const actions = useMediaAssetActions()

      const asset = createMockAsset({
        id: 'asset-3',
        name: 'fallback-image.png'
      })

      await actions.deleteAssets(asset)

      const dialogProps = mockShowDialog.mock.calls[0][0].props as {
        itemList: string[]
      }
      expect(dialogProps.itemList).toEqual(['fallback-image.png'])
    })
  })

  describe('deleteAssets — FE-230 preview cache clearing', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      mockGetAssetType.mockReturnValue('input')
      mockShowDialog.mockImplementation(
        (opts: {
          props: {
            onConfirm: (confirmed: boolean) => void
          }
        }) => {
          opts.props.onConfirm(true)
        }
      )
      mockAppGraph.value = { nodes: [] }
    })

    it('cleans every shared reference only for successful assets after a partial deletion', async () => {
      mockDeleteAsset.mockImplementation(async (id: string) => {
        if (id === 'asset-failed') throw new Error('503 Service Unavailable')
      })
      const successfulCallbacks = [vi.fn(), vi.fn()]
      const failedCallback = vi.fn()
      const successfulNodes = successfulCallbacks.map((callback, index) =>
        fromAny<LGraphNode, unknown>({
          id: index + 10,
          widgets: [
            { name: 'image', value: 'shared.png', callback },
            ...(index === 0
              ? [
                  {
                    name: 'mask',
                    value: 'failed.png',
                    callback: failedCallback
                  }
                ]
              : [])
          ],
          imgs: [{ src: `blob:shared-preview-${index}` }],
          graph: { setDirtyCanvas: vi.fn() }
        })
      )
      mockAppGraph.value = {
        nodes: successfulNodes
      }
      mockScanNodeMediaCandidates.mockImplementation((_graph, node) => [
        {
          nodeId: String(node.id),
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: String(node.widgets?.[0].value),
          isMissing: undefined
        }
      ])
      const actions = useMediaAssetActions()

      await actions.deleteAssets([
        createMockAsset({ id: 'asset-success', name: 'shared.png' }),
        createMockAsset({ id: 'asset-failed', name: 'failed.png' })
      ])

      expect(mockMarkMissingMedia).toHaveBeenCalledWith(
        mockAppGraph.value,
        new Set(['shared.png'])
      )
      expect(useMissingMediaStore().missingMediaCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'shared.png',
            isMissing: true
          })
        ])
      )
      expect(useMissingMediaStore().missingMediaCandidates).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'failed.png' })
        ])
      )
      for (const [index, node] of successfulNodes.entries()) {
        expect(mockRemoveNodeOutputsForNode).toHaveBeenCalledWith(node)
        expect(node.imgs).toBeUndefined()
        expect(node.widgets?.[0].value).toBe('')
        expect(successfulCallbacks[index]).toHaveBeenCalledWith('')
        expect(node.graph?.setDirtyCanvas).toHaveBeenCalledWith(true)
      }
      expect(successfulNodes[0].widgets?.[1].value).toBe('failed.png')
      expect(failedCallback).not.toHaveBeenCalled()
      expect(mockCaptureCanvasState).toHaveBeenCalledTimes(1)
      expect(mockCaptureCanvasState).toHaveBeenCalledAfter(
        mockClearWidgetValues
      )
    })

    it('invokes clearNodePreviewCacheForValues with canonical widget-value variants', async () => {
      mockDeleteAsset.mockResolvedValue(undefined)
      const actions = useMediaAssetActions()
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
      expect(valuesArg).toEqual(new Set(['foo.png', 'abc123.png']))
      expect(typeof removeArg).toBe('function')

      const sampleNode = fromAny<LGraphNode, unknown>({ id: 42 })
      removeArg(sampleNode)
      expect(mockRemoveNodeOutputsForNode).toHaveBeenCalledWith(sampleNode)
      expect(mockRemoveNodeOutputs).not.toHaveBeenCalled()

      expect(mockClearWidgetValues).toHaveBeenCalledWith(
        mockAppGraph.value,
        new Set(['foo.png', 'abc123.png'])
      )

      expect(mockMarkMissingMedia).toHaveBeenCalledWith(
        mockAppGraph.value,
        new Set(['foo.png', 'abc123.png'])
      )

      const markOrder = mockMarkMissingMedia.mock.invocationCallOrder[0]
      const cacheOrder = mockClearNodePreviewCache.mock.invocationCallOrder[0]
      const clearOrder = mockClearWidgetValues.mock.invocationCallOrder[0]
      expect(markOrder).toBeLessThan(clearOrder)
      expect(cacheOrder).toBeLessThan(clearOrder)

      expect(mockCaptureCanvasState).toHaveBeenCalled()
    })

    it('emits the [output]-annotated variant for output assets, including subfolder', async () => {
      mockDeleteAsset.mockResolvedValue(undefined)
      mockGetAssetType.mockReturnValue('output')
      const actions = useMediaAssetActions()
      const asset = createMockAsset({
        id: 'asset-output',
        name: 'gen.png',
        tags: ['output'],
        user_metadata: { subfolder: 'outputs/2025' }
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
      const actions = useMediaAssetActions()
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

  describe('deleteAssets — references added from the deleted asset', () => {
    const job = { job_id: 'job-1', created_at: '2026-01-01T00:00:00Z' }
    const tempAsset = createMockAsset({
      ...job,
      id: 'temp-asset',
      name: 'ComfyUI_temp_00001_.png',
      hash: 'aa7ecf08.png',
      tags: ['temp'],
      user_metadata: { jobId: 'job-1', subfolder: 'previews' }
    })
    const outputAsset = createMockAsset({
      ...job,
      id: 'output-asset',
      name: 'ComfyUI_00001_.png',
      hash: 'bb12cd34.png',
      tags: ['output'],
      user_metadata: { jobId: 'job-1', subfolder: 'runs/2026' }
    })
    const urlTempAsset = createMockAsset({
      ...job,
      id: 'url-temp-asset',
      name: 'ComfyUI_temp_00002_.png',
      hash: 'cc56ef78.png',
      tags: ['output'],
      preview_url: '/api/view?filename=ComfyUI_temp_00002_.png&type=temp',
      user_metadata: { jobId: 'job-1', subfolder: '' }
    })
    const deletedAssets = [tempAsset, outputAsset, urlTempAsset]

    let graph: LGraph

    beforeEach(() => {
      mockIsCloud.value = true
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      mockDeleteAsset.mockResolvedValue(undefined)
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: (confirmed: boolean) => void } }) =>
          props.onConfirm(true)
      )
      mockGetAssetType.mockRestore()
      mockGetOutputAssetMetadata.mockImplementation(
        (metadata) => metadata ?? null
      )
      seedMediaNodeDefs()
      graph = new LGraph()
      mockAppGraph.value = graph
      vi.mocked(useLitegraphService()).addNodeOnGraph.mockImplementation(() =>
        addLoadImageNode('')
      )
    })

    function addLoadImageNode(value: string): LGraphNode {
      const node = new LGraphNode('LoadImage', 'LoadImage')
      node.serialize_widgets = true
      node.addWidget('combo', 'image', value, () => undefined, { values: [] })
      graph.add(node)
      node.imgs = [new Image()]
      return node
    }

    async function addReferencesTo(assets: AssetItem[]) {
      const { actions } = mountMediaActions()
      await actions.addMultipleToWorkflow(assets)
      return { actions, nodes: [...graph.nodes] }
    }

    function serializedImageValue(node: LGraphNode) {
      return node.serialize().widgets_values?.[0]
    }

    function referenceState(node: LGraphNode) {
      return {
        value: serializedImageValue(node),
        hasPreview: node.imgs !== undefined,
        outputsRemoved: mockRemoveNodeOutputsForNode.mock.calls.some(
          ([removed]) => removed === node
        ),
        missingNames: (useMissingMediaStore().missingMediaCandidates ?? [])
          .filter(
            (candidate) =>
              candidate.nodeId === String(node.id) && candidate.isMissing
          )
          .map((candidate) => candidate.name)
      }
    }

    const cleared = (deletedValue: string) => ({
      value: '',
      hasPreview: false,
      outputsRemoved: true,
      missingNames: [deletedValue]
    })

    const kept = (value: string) => ({
      value,
      hasPreview: true,
      outputsRemoved: false,
      missingNames: []
    })

    it.for([
      ['flat', () => deletedAssets],
      ['grouped', () => unflattenOutputAssets(deletedAssets)]
    ] as const)(
      'clears hash-backed temp and output references after deleting the %s assets',
      async ([, deletionTargets]) => {
        const { actions, nodes } = await addReferencesTo(deletedAssets)
        expect(nodes.map(serializedImageValue)).toEqual([
          'previews/aa7ecf08.png [temp]',
          'runs/2026/bb12cd34.png [output]',
          'cc56ef78.png [temp]'
        ])
        const readableReferences = [
          addLoadImageNode('previews/ComfyUI_temp_00001_.png [temp]'),
          addLoadImageNode('runs/2026/ComfyUI_00001_.png [output]'),
          addLoadImageNode('ComfyUI_temp_00002_.png [temp]')
        ]
        const survivors = [
          addLoadImageNode('aa7ecf08.png [output]'),
          addLoadImageNode('other/aa7ecf08.png [temp]'),
          addLoadImageNode('ComfyUI_temp_00001_.png [temp]'),
          addLoadImageNode('bb12cd34.png [output]'),
          addLoadImageNode('aa7ecf08.png'),
          addLoadImageNode('bb12cd34.png [input]'),
          addLoadImageNode('previews/aa7ecf08.png [output]'),
          addLoadImageNode('previews/aa7ecf08.png [input]'),
          addLoadImageNode('previews/ComfyUI_temp_00001_.png [output]')
        ]

        await expect(actions.deleteAssets(deletionTargets())).resolves.toBe(
          true
        )

        const deletedIds = mockDeleteAsset.mock.calls.map(([id]) => id)
        expect(deletedIds).toHaveLength(3)
        expect(deletedIds).toEqual(
          expect.arrayContaining([
            'output-asset',
            'temp-asset',
            'url-temp-asset'
          ])
        )
        expect(nodes.map(referenceState)).toEqual([
          cleared('previews/aa7ecf08.png [temp]'),
          cleared('runs/2026/bb12cd34.png [output]'),
          cleared('cc56ef78.png [temp]')
        ])
        expect(readableReferences.map(referenceState)).toEqual([
          cleared('previews/ComfyUI_temp_00001_.png [temp]'),
          cleared('runs/2026/ComfyUI_00001_.png [output]'),
          cleared('ComfyUI_temp_00002_.png [temp]')
        ])
        expect(survivors.map(referenceState)).toEqual([
          kept('aa7ecf08.png [output]'),
          kept('other/aa7ecf08.png [temp]'),
          kept('ComfyUI_temp_00001_.png [temp]'),
          kept('bb12cd34.png [output]'),
          kept('aa7ecf08.png'),
          kept('bb12cd34.png [input]'),
          kept('previews/aa7ecf08.png [output]'),
          kept('previews/aa7ecf08.png [input]'),
          kept('previews/ComfyUI_temp_00001_.png [output]')
        ])
      }
    )

    it('writes and clears the temp root for an asset tagged output and temp without a preview URL', async () => {
      const outputTaggedTempAsset = createMockAsset({
        ...job,
        id: 'output-tagged-temp-asset',
        name: 'ComfyUI_temp_00003_.png',
        hash: 'ee12ab34.png',
        tags: ['output', 'temp'],
        user_metadata: { jobId: 'job-1', subfolder: '' }
      })
      const { actions, nodes } = await addReferencesTo([outputTaggedTempAsset])
      const sameHashOutput = addLoadImageNode('ee12ab34.png [output]')

      await actions.deleteAssets(unflattenOutputAssets([outputTaggedTempAsset]))

      expect(nodes.map(referenceState)).toEqual([
        cleared('ee12ab34.png [temp]')
      ])
      expect(referenceState(sameHashOutput)).toEqual(
        kept('ee12ab34.png [output]')
      )
    })

    it.for([
      'aa7ecf08.png[temp]',
      'aa7ecf08.png [TEMP]',
      'aa7ecf08.png [temp] '
    ])('clears a hash-backed temp reference written as %j', async (value) => {
      const node = addLoadImageNode(value)
      const { actions } = mountMediaActions()

      await actions.deleteAssets(
        createMockAsset({ ...tempAsset, user_metadata: undefined })
      )

      expect(referenceState(node)).toEqual(cleared(value))
    })

    it('clears every compatible input form and keeps other roots and folders', async () => {
      const inputAsset = createMockAsset({
        id: 'input-asset',
        name: 'photo.png',
        hash: 'dd90ab12.png',
        tags: ['input']
      })
      const deletedNodes = [
        addLoadImageNode('photo.png'),
        addLoadImageNode('photo.png [input]'),
        addLoadImageNode('dd90ab12.png'),
        addLoadImageNode('dd90ab12.png [input]')
      ]
      const survivors = [
        addLoadImageNode('photo.png [output]'),
        addLoadImageNode('photo.png [temp]'),
        addLoadImageNode('clipspace/photo.png [input]')
      ]
      const { actions } = mountMediaActions()

      await actions.deleteAssets(inputAsset)

      expect(deletedNodes.map(referenceState)).toEqual([
        cleared('photo.png'),
        cleared('photo.png [input]'),
        cleared('dd90ab12.png'),
        cleared('dd90ab12.png [input]')
      ])
      expect(survivors.map(referenceState)).toEqual([
        kept('photo.png [output]'),
        kept('photo.png [temp]'),
        kept('clipspace/photo.png [input]')
      ])
    })

    it.for([
      [
        'output',
        () => outputAsset,
        'runs/2026/bb12cd34.png [output]',
        'runs/2026/ComfyUI_00001_.png [output]',
        'runs/2026/ComfyUI_00001_.png [temp]'
      ],
      [
        'temp',
        () => tempAsset,
        'previews/aa7ecf08.png [temp]',
        'previews/ComfyUI_temp_00001_.png [temp]',
        'previews/ComfyUI_temp_00001_.png [output]'
      ],
      [
        'hashless temp',
        () => createMockAsset({ ...tempAsset, hash: undefined }),
        'previews/ComfyUI_temp_00001_.png [temp]',
        'previews/ComfyUI_temp_00001_.png [temp]',
        'previews/ComfyUI_temp_00001_.png [output]'
      ]
    ] as const)(
      'clears collapsed-card %s references when the output is deleted from the expanded stack',
      async ([
        ,
        deletedAsset,
        addedReference,
        draggedReference,
        otherRootReference
      ]) => {
        mockResolveOutputAssetItems.mockRestore()
        vi.mocked(api.getJobAssets).mockResolvedValue({
          assets: [
            fromPartial({
              id: 'output-asset',
              name: 'ComfyUI_00001_.png',
              hash: 'blake3:bb12cd34',
              preview_url: '/api/assets/output-asset/content'
            }),
            fromPartial({
              id: 'temp-asset',
              name: 'ComfyUI_temp_00001_.png',
              hash: 'blake3:aa7ecf08',
              preview_url: '/api/assets/temp-asset/content'
            })
          ],
          complete: true
        })
        const [group] = unflattenOutputAssets([deletedAsset()])
        const { actions, nodes } = await addReferencesTo([group])
        const dragged = addLoadImageNode(draggedReference)
        const otherRoot = addLoadImageNode(otherRootReference)
        const groupMetadata = getOutputAssetMetadata(group.user_metadata)
        assert.exists(groupMetadata)
        const expanded = await resolveOutputAssetItems(groupMetadata)
        const stackChildren = ref(expanded)
        const [listedChild] = stackChildren.value
        assert.exists(listedChild)

        await actions.deleteAssets({ ...listedChild })

        expect(mockDeleteAsset.mock.calls).toEqual([[deletedAsset().id]])
        expect([...nodes, dragged].map(referenceState)).toEqual([
          cleared(addedReference),
          cleared(draggedReference)
        ])
        expect(referenceState(otherRoot)).toEqual(kept(otherRootReference))
      }
    )

    it('clears a temp reference to an asset with no job and keeps same-hash references in other roots', async () => {
      const flatTempAsset = createMockAsset({
        id: 'flat-temp-asset',
        name: 'flat_temp.png',
        hash: 'ff34ab12.png',
        tags: ['output', 'temp']
      })
      const { actions, nodes } = await addReferencesTo([flatTempAsset])
      const survivors = [
        addLoadImageNode('ff34ab12.png [output]'),
        addLoadImageNode('ff34ab12.png'),
        addLoadImageNode('flat_temp.png [input]')
      ]

      await actions.deleteAssets(flatTempAsset)

      expect(nodes.map(referenceState)).toEqual([
        cleared('ff34ab12.png [temp]')
      ])
      expect(survivors.map(referenceState)).toEqual([
        kept('ff34ab12.png [output]'),
        kept('ff34ab12.png'),
        kept('flat_temp.png [input]')
      ])
    })

    describe('temp tags only mark a generated output as temp', () => {
      const inputRootSurvivors = [
        'ab12cd34.png [temp]',
        'ab12cd34.png [output]'
      ]
      const tempRootSurvivors = [
        'ab12cd34.png [output]',
        'ab12cd34.png [input]',
        'ab12cd34.png'
      ]

      it.for([
        [
          'an input asset tagged temp',
          { tags: ['input', 'temp'] },
          'ab12cd34.png',
          ['ab12cd34.png [input]'],
          inputRootSurvivors
        ],
        [
          'an input asset tagged temp whose preview URL says input',
          {
            tags: ['input', 'temp'],
            preview_url: '/api/view?filename=probe.png&type=input'
          },
          'ab12cd34.png',
          ['ab12cd34.png [input]'],
          inputRootSurvivors
        ],
        [
          'an output tagged temp whose preview URL says input',
          {
            tags: ['output', 'temp'],
            preview_url: '/api/view?filename=probe.png&type=input'
          },
          'ab12cd34.png',
          ['ab12cd34.png [input]'],
          inputRootSurvivors
        ],
        [
          'a model asset tagged temp',
          { tags: ['models', 'temp'] },
          'ab12cd34.png',
          ['ab12cd34.png [input]'],
          inputRootSurvivors
        ],
        [
          'an input asset with a metadata subfolder',
          { tags: ['input'], user_metadata: { subfolder: 'clipspace' } },
          'clipspace/ab12cd34.png',
          ['clipspace/ab12cd34.png [input]'],
          [
            'clipspace/ab12cd34.png [temp]',
            'clipspace/ab12cd34.png [output]',
            'ab12cd34.png',
            'ab12cd34.png [input]'
          ]
        ],
        [
          'a generated output tagged temp with a type-less preview URL',
          {
            tags: ['output', 'temp'],
            preview_url: '/api/assets/probe-asset/content'
          },
          'ab12cd34.png [temp]',
          [],
          tempRootSurvivors
        ],
        [
          'a generated output whose preview URL says temp',
          {
            tags: ['output'],
            preview_url: '/api/view?filename=probe.png&type=temp'
          },
          'ab12cd34.png [temp]',
          [],
          tempRootSurvivors
        ]
      ] as const)(
        'writes %s at its own root and deleting it clears only that root',
        async ([, shape, written, sameRoot, otherRoots]) => {
          const asset = createMockAsset({
            id: 'probe-asset',
            name: 'probe.png',
            hash: 'ab12cd34.png',
            ...shape,
            tags: [...shape.tags]
          })
          const { actions } = mountMediaActions()
          await actions.addWorkflow(asset)
          const inserted = graph.nodes.at(-1)!
          await actions.addMultipleToWorkflow([asset])
          const bulk = graph.nodes.at(-1)!
          const sameRootNodes = sameRoot.map(addLoadImageNode)
          const survivors = otherRoots.map(addLoadImageNode)

          expect([inserted, bulk].map(serializedImageValue)).toEqual([
            written,
            written
          ])

          await actions.deleteAssets(asset)

          expect([inserted, bulk].map(referenceState)).toEqual([
            cleared(written),
            cleared(written)
          ])
          expect(sameRootNodes.map(serializedImageValue)).toEqual(
            sameRoot.map(() => '')
          )
          expect(survivors.map(serializedImageValue)).toEqual([...otherRoots])
        }
      )
    })

    describe('a temp asset with no job whose metadata names only its subfolder', () => {
      const folderTempAsset = createMockAsset({
        id: 'folder-temp-asset',
        name: 'flat_temp.png',
        hash: 'ff34ab12.png',
        tags: ['output', 'temp'],
        user_metadata: { subfolder: 'previews' }
      })

      beforeEach(() => {
        mockGetOutputAssetMetadata.mockReturnValue(null)
      })

      it.for([
        [
          'inserted as a node',
          async (asset: AssetItem) => {
            const { actions } = mountMediaActions()
            await actions.addWorkflow(asset)
            return { actions, nodes: [...graph.nodes] }
          }
        ],
        ['inserted in bulk', (asset: AssetItem) => addReferencesTo([asset])]
      ] as const)(
        'is %s at its folder and temp root, and deleting it clears only that reference',
        async ([, insert]) => {
          const { actions, nodes } = await insert(folderTempAsset)
          const survivors = [
            addLoadImageNode('previews/ff34ab12.png [output]'),
            addLoadImageNode('previews/ff34ab12.png [input]'),
            addLoadImageNode('previews/flat_temp.png [output]'),
            addLoadImageNode('previews/flat_temp.png [input]')
          ]

          expect(nodes.map(serializedImageValue)).toEqual([
            'previews/ff34ab12.png [temp]'
          ])

          await actions.deleteAssets(folderTempAsset)

          expect(nodes.map(referenceState)).toEqual([
            cleared('previews/ff34ab12.png [temp]')
          ])
          expect(survivors.map(referenceState)).toEqual([
            kept('previews/ff34ab12.png [output]'),
            kept('previews/ff34ab12.png [input]'),
            kept('previews/flat_temp.png [output]'),
            kept('previews/flat_temp.png [input]')
          ])
        }
      )

      it('deleting it clears a reference written at its folder by drag or dropdown', async () => {
        const dropped = addLoadImageNode('previews/flat_temp.png [temp]')
        const selected = addLoadImageNode('previews/ff34ab12.png [temp]')
        const { actions } = mountMediaActions()

        await actions.deleteAssets(folderTempAsset)

        expect([dropped, selected].map(referenceState)).toEqual([
          cleared('previews/flat_temp.png [temp]'),
          cleared('previews/ff34ab12.png [temp]')
        ])
      })
    })

    describe('references written from an expanded-stack child', () => {
      const outputTaggedTempAsset = createMockAsset({
        ...job,
        id: 'output-tagged-temp-asset',
        name: 'ComfyUI_temp_00003_.png',
        tags: ['output', 'temp'],
        user_metadata: { jobId: 'job-1', subfolder: 'previews' }
      })

      async function expandedChildOf(asset: AssetItem) {
        mockResolveOutputAssetItems.mockRestore()
        vi.mocked(api.getJobAssets).mockResolvedValue({
          assets: [
            fromPartial({
              id: asset.id,
              name: asset.name,
              preview_url: `/api/assets/${asset.id}/content`
            })
          ],
          complete: true
        })
        const [group] = unflattenOutputAssets([asset])
        const groupMetadata = getOutputAssetMetadata(group.user_metadata)
        assert.exists(groupMetadata)
        const [child] = await resolveOutputAssetItems(groupMetadata)
        assert.exists(child)
        return child
      }

      async function insertAsNode(child: AssetItem) {
        const { actions } = mountMediaActions()
        await actions.addWorkflow(child)
        return { actions, node: graph.nodes.at(-1)! }
      }

      async function dropOnLoadImage(child: AssetItem) {
        const dataTransfer = new DataTransfer()
        const event = new DragEvent('dragstart')
        Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
        startAssetDrag(event, child)
        const dropped = parseAssetInfo(dataTransfer)
        assert.exists(dropped)
        const { actions } = mountMediaActions()
        return {
          actions,
          node: addLoadImageNode(createAnnotatedPath(dropped))
        }
      }

      const atRoot = (asset: AssetItem) =>
        createMockAsset({
          ...asset,
          user_metadata: { jobId: 'job-1', subfolder: '' }
        })

      it.for([
        [
          'inserted as a node',
          'tag temp',
          insertAsNode,
          () => tempAsset,
          'previews/ComfyUI_temp_00001_.png [temp]'
        ],
        [
          'inserted as a node',
          'tags output and temp',
          insertAsNode,
          () => outputTaggedTempAsset,
          'previews/ComfyUI_temp_00003_.png [temp]'
        ],
        [
          'dropped on Load Image',
          'tag temp',
          dropOnLoadImage,
          () => atRoot(tempAsset),
          'ComfyUI_temp_00001_.png [temp]'
        ],
        [
          'dropped on Load Image',
          'tags output and temp',
          dropOnLoadImage,
          () => atRoot(outputTaggedTempAsset),
          'ComfyUI_temp_00003_.png [temp]'
        ],
        [
          'dropped on Load Image',
          'tag temp in a subfolder',
          dropOnLoadImage,
          () => tempAsset,
          'previews/ComfyUI_temp_00001_.png [temp]'
        ],
        [
          'dropped on Load Image',
          'tags output and temp in a subfolder',
          dropOnLoadImage,
          () => outputTaggedTempAsset,
          'previews/ComfyUI_temp_00003_.png [temp]'
        ]
      ] as const)(
        'writes the temp root for a child %s from an asset with %s, so deleting the child clears it',
        async ([, , writeReference, source, written]) => {
          const child = await expandedChildOf(source())
          const { actions, node } = await writeReference(child)

          expect(serializedImageValue(node)).toBe(written)

          await actions.deleteAssets({ ...child })

          expect(referenceState(node)).toEqual(cleared(written))
        }
      )
    })

    it('ignores stored identity fields supplied in server metadata', async () => {
      const unrelated = addLoadImageNode('unrelated.png')
      const unrelatedOutput = addLoadImageNode('unrelated.png [output]')
      const { actions } = mountMediaActions()

      await actions.deleteAssets(
        createMockAsset({
          id: 'server-asset',
          name: 'server.png',
          tags: ['output'],
          user_metadata: {
            jobId: 'job-2',
            subfolder: '',
            storedHash: 'unrelated.png',
            storedType: 'input'
          }
        })
      )

      expect([unrelated, unrelatedOutput].map(referenceState)).toEqual([
        kept('unrelated.png'),
        kept('unrelated.png [output]')
      ])
    })

    it('keeps every reference when the deletion fails', async () => {
      mockDeleteAsset.mockRejectedValue(new Error('503 Service Unavailable'))
      const { actions, nodes } = await addReferencesTo([tempAsset])

      await actions.deleteAssets(unflattenOutputAssets([tempAsset]))

      expect(nodes.map(referenceState)).toEqual([
        kept('previews/aa7ecf08.png [temp]')
      ])
    })
  })

  describe('deleteAssets — input list end state', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      mockGetAssetType.mockReturnValue('input')
      mockDeleteAsset.mockResolvedValue(undefined)
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: (confirmed: boolean) => void } }) =>
          props.onConfirm(true)
      )
    })

    it('removes the deleted asset from inputAssets, leaving the rest', async () => {
      const keep = createMockAsset({ id: 'keep', name: 'keep.png' })
      const target = createMockAsset({ id: 'target', name: 'target.png' })
      mockInputAssets.items = [keep, target]

      await useMediaAssetActions().deleteAssets(target)

      expect(mockDeleteAsset).toHaveBeenCalledWith('target')
      expect(mockInputAssets.items.map((item) => item.id)).toEqual(['keep'])
    })
  })

  describe('deleteAssets — failures', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      mockGetAssetType.mockReturnValue('input')
      mockShowDialog.mockImplementation(
        ({ props }: { props: { onConfirm: (confirmed: boolean) => void } }) =>
          props.onConfirm(true)
      )
      mockAppGraph.value = { nodes: [] }
    })

    it('keeps a failed asset listed and removes it once a retry succeeds', async () => {
      mockDeleteAsset
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockResolvedValueOnce(undefined)
      const actions = useMediaAssetActions()
      const asset = createMockAsset({ id: 'asset-503', name: 'retry.png' })
      mockInputAssets.items = [asset]

      await expect(actions.deleteAssets(asset)).resolves.toBe(true)

      expect(mockInputAssets.items.map((item) => item.id)).toEqual([
        'asset-503'
      ])
      expect(useToast().error).toHaveBeenCalledWith('Items failed to delete', {
        description: i18n.global.t('mediaAsset.assetsDeleted', { total: 1 }, 0),
        duration: 5000
      })
      expect(mockMarkMissingMedia).not.toHaveBeenCalled()
      expect(mockClearWidgetValues).not.toHaveBeenCalled()

      await expect(actions.deleteAssets(asset)).resolves.toBe(true)

      expect(mockDeleteAsset).toHaveBeenCalledTimes(2)
      expect(mockInputAssets.items).toEqual([])
      expect(useToast().success).toHaveBeenLastCalledWith(
        'Deletion successful',
        {
          description: i18n.global.t(
            'mediaAsset.assetsDeleted',
            { total: 1 },
            1
          ),
          duration: 2000
        }
      )
    })

    it('cleans up only the succeeded assets and clears every overlay when part of a batch fails', async () => {
      mockDeleteAsset.mockImplementation(async (id) => {
        if (id === 'asset-failed') throw new Error('503 Service Unavailable')
      })
      const assets = [
        createMockAsset({ id: 'asset-first', name: 'first.png' }),
        createMockAsset({ id: 'asset-failed', name: 'failed.png' }),
        createMockAsset({ id: 'asset-third', name: 'third.png' })
      ]
      mockInputAssets.items = [...assets]
      const succeededVariants = new Set(['first.png', 'third.png'])

      await useMediaAssetActions().deleteAssets(assets)

      const deletedIds = mockDeleteAsset.mock.calls.map(([id]) => id)
      expect(deletedIds).toHaveLength(3)
      expect(new Set(deletedIds)).toEqual(
        new Set(['asset-first', 'asset-failed', 'asset-third'])
      )
      expect(mockInputAssets.items.map((item) => item.id)).toEqual([
        'asset-failed'
      ])
      expect(mockMarkMissingMedia).toHaveBeenCalledWith(
        mockAppGraph.value,
        succeededVariants
      )
      expect(mockClearNodePreviewCache).toHaveBeenCalledWith(
        mockAppGraph.value,
        succeededVariants,
        expect.any(Function)
      )
      expect(mockClearWidgetValues).toHaveBeenCalledWith(
        mockAppGraph.value,
        succeededVariants
      )
      expect(mockCaptureCanvasState).toHaveBeenCalledTimes(1)
      expect(useToast().warning).toHaveBeenCalledWith(
        'Some items failed to delete',
        {
          description: i18n.global.t(
            'mediaAsset.assetsDeleted',
            { total: 3 },
            2
          ),
          duration: 5000
        }
      )

      const flagsById: Record<string, boolean[]> = {}
      for (const [id, flag] of mockSetAssetDeleting.mock.calls) {
        flagsById[id] = [...(flagsById[id] ?? []), flag]
      }
      expect(flagsById).toEqual({
        'asset-first': [true, false],
        'asset-failed': [true, false],
        'asset-third': [true, false]
      })
    })
  })
})
