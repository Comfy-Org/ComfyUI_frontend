import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  createMockCanvas as createMockCanvasBase,
  createMockLGraphNode
} from '@/utils/__tests__/litegraphTestUtils'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { app as singletonApp, ComfyApp } from './app'
import { createNode, isImageNode } from '@/utils/litegraphUtil'
import {
  pasteAudioNode,
  pasteAudioNodes,
  pasteImageNode,
  pasteImageNodes,
  pasteVideoNode,
  pasteVideoNodes
} from '@/composables/usePaste'
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { importA1111 } from '@/scripts/pnginfo'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { api, PromptExecutionError } from '@/scripts/api'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'
import type { NodeError, PromptResponse, ResultItem } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { deserialiseAndCreate } from '@/utils/vintageClipboard'

const {
  mockApiKeyAuthStore,
  mockAuthStore,
  mockSettingStore,
  mockToastStore,
  mockExtensionService,
  mockNodeOutputStore,
  mockWorkspaceWorkflow,
  mockWorkspaceStore,
  mockRefreshMissingModelPipeline,
  mockDeserialiseAndCreate,
  mockDialogService,
  mockAccountPreconditionDialog,
  mockResolveAccountPrecondition,
  mockRescanAndSurfaceMissingNodes,
  mockExtractFilesFromDragEvent,
  mockWorkflowService,
  mockNodeReplacementStore,
  mockImportA1111,
  mockWorkflowValidation,
  mockSubgraphService,
  mockLitegraphService,
  mockTelemetry,
  mockEnsureCorrectLayoutScale,
  mockSyncLayoutStoreNodeBoundsFromGraph,
  mockRunMissingModelPipeline,
  mockFindLegacyRerouteNodes,
  mockNoNativeReroutes,
  mockSubgraphNavigationStore
} = vi.hoisted(() => ({
  mockApiKeyAuthStore: {
    getApiKey: vi.fn()
  },
  mockAuthStore: {
    getAuthToken: vi.fn()
  },
  mockSettingStore: {
    get: vi.fn()
  },
  mockToastStore: {
    addAlert: vi.fn(),
    add: vi.fn(),
    remove: vi.fn()
  },
  mockExtensionService: {
    invokeExtensions: vi.fn(),
    invokeExtensionsAsync: vi.fn()
  },
  mockNodeOutputStore: {
    refreshNodeOutputs: vi.fn(),
    getNodeOutputs: vi.fn(),
    updateNodeImages: vi.fn(),
    setNodeOutputsByExecutionId: vi.fn(),
    setNodePreviewsByExecutionId: vi.fn(),
    revokePreviewsByExecutionId: vi.fn(),
    resetAllOutputsAndPreviews: vi.fn()
  },
  mockWorkspaceWorkflow: {
    activeWorkflow: null as ComfyWorkflow | null
  },
  mockWorkspaceStore: {
    workflow: null as { activeWorkflow: ComfyWorkflow | null } | null,
    spinner: false
  },
  mockRefreshMissingModelPipeline: vi.fn(),
  mockDeserialiseAndCreate: vi.fn(),
  mockDialogService: {
    showErrorDialog: vi.fn(),
    showExecutionErrorDialog: vi.fn()
  },
  mockAccountPreconditionDialog: {
    open: vi.fn()
  },
  mockResolveAccountPrecondition: vi.fn(),
  mockRescanAndSurfaceMissingNodes: vi.fn(),
  mockExtractFilesFromDragEvent: vi.fn(),
  mockWorkflowService: {
    showPendingWarnings: vi.fn(),
    beforeLoadNewGraph: vi.fn(),
    afterLoadNewGraph: vi.fn()
  },
  mockNodeReplacementStore: {
    load: vi.fn(),
    getReplacementFor: vi.fn()
  },
  mockImportA1111: vi.fn(),
  mockWorkflowValidation: {
    validateWorkflow: vi.fn()
  },
  mockSubgraphService: {
    loadSubgraphs: vi.fn(),
    registerNewSubgraph: vi.fn()
  },
  mockLitegraphService: {
    fitView: vi.fn(),
    resetView: vi.fn(),
    updatePreviews: vi.fn()
  },
  mockTelemetry: {
    trackWorkflowOpened: vi.fn(),
    trackWorkflowImported: vi.fn()
  },
  mockEnsureCorrectLayoutScale: vi.fn(),
  mockSyncLayoutStoreNodeBoundsFromGraph: vi.fn(),
  mockRunMissingModelPipeline: vi.fn(),
  mockFindLegacyRerouteNodes: vi.fn(),
  mockNoNativeReroutes: vi.fn(),
  mockSubgraphNavigationStore: {
    updateHash: vi.fn()
  }
}))

vi.mock('@/utils/litegraphUtil', () => ({
  createNode: vi.fn(),
  isImageNode: vi.fn(),
  isVideoNode: vi.fn(),
  isAudioNode: vi.fn(),
  executeWidgetsCallback: vi.fn(),
  fixLinkInputSlots: vi.fn()
}))

vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: vi.fn(() => mockApiKeyAuthStore)
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => mockAuthStore)
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => mockSettingStore)
}))

vi.mock('@/composables/usePaste', () => ({
  pasteAudioNode: vi.fn(),
  pasteAudioNodes: vi.fn(),
  pasteImageNode: vi.fn(),
  pasteImageNodes: vi.fn(),
  pasteVideoNode: vi.fn(),
  pasteVideoNodes: vi.fn()
}))

vi.mock('@/scripts/metadata/parser', () => ({
  getWorkflowDataFromFile: vi.fn()
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn(() => mockToastStore)
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: vi.fn(() => mockExtensionService)
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: vi.fn(() => mockNodeOutputStore)
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: vi.fn(() => mockWorkspaceStore)
}))

vi.mock('@/platform/missingModel/missingModelPipeline', () => ({
  refreshMissingModelPipeline: mockRefreshMissingModelPipeline,
  runMissingModelPipeline: mockRunMissingModelPipeline
}))

vi.mock('@/utils/vintageClipboard', () => ({
  deserialiseAndCreate: mockDeserialiseAndCreate
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => mockDialogService)
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useAccountPreconditionDialog',
  () => ({
    useAccountPreconditionDialog: vi.fn(() => mockAccountPreconditionDialog)
  })
)

vi.mock('@/platform/errorCatalog/accountPreconditionRouting', () => ({
  resolveAccountPrecondition: mockResolveAccountPrecondition
}))

vi.mock('@/platform/nodeReplacement/missingNodeScan', () => ({
  rescanAndSurfaceMissingNodes: mockRescanAndSurfaceMissingNodes
}))

vi.mock('@/utils/eventUtils', () => ({
  extractFilesFromDragEvent: mockExtractFilesFromDragEvent,
  hasImageType: ({ type }: File) => type.startsWith('image'),
  hasAudioType: ({ type }: File) => type.startsWith('audio'),
  hasVideoType: ({ type }: File) => type.startsWith('video'),
  isMediaFile: ({ type }: File) =>
    type.startsWith('image') ||
    type.startsWith('audio') ||
    type.startsWith('video')
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: vi.fn(() => mockWorkflowService)
}))

vi.mock(
  '@/platform/workflow/validation/composables/useWorkflowValidation',
  () => ({
    useWorkflowValidation: vi.fn(() => mockWorkflowValidation)
  })
)

vi.mock('@/services/subgraphService', () => ({
  useSubgraphService: vi.fn(() => mockSubgraphService)
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: vi.fn(() => mockLitegraphService)
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => mockTelemetry)
}))

vi.mock('@/platform/nodeReplacement/nodeReplacementStore', () => ({
  useNodeReplacementStore: vi.fn(() => mockNodeReplacementStore)
}))

vi.mock('@/scripts/pnginfo', () => ({
  importA1111: mockImportA1111
}))

vi.mock(
  '@/renderer/extensions/vueNodes/layout/ensureCorrectLayoutScale',
  () => ({
    ensureCorrectLayoutScale: mockEnsureCorrectLayoutScale
  })
)

vi.mock('@/renderer/core/layout/sync/syncLayoutStoreFromGraph', () => ({
  syncLayoutStoreNodeBoundsFromGraph: mockSyncLayoutStoreNodeBoundsFromGraph
}))

vi.mock('@/utils/migration/migrateReroute', () => ({
  findLegacyRerouteNodes: mockFindLegacyRerouteNodes,
  noNativeReroutes: mockNoNativeReroutes
}))

vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: vi.fn(() => mockSubgraphNavigationStore)
}))

function createMockNode(
  options: Partial<LGraphNode> | Record<string, unknown> = {}
) {
  return createMockLGraphNode({
    size: [200, 100],
    type: 'LoadImage',
    connect: vi.fn(),
    getBounding: vi.fn(() => new Float64Array([0, 0, 200, 100])),
    ...options
  })
}

function createMockCanvas(
  overrides: Partial<LGraphCanvas> | Record<string, unknown> = {}
): LGraphCanvas {
  return createMockCanvasBase({
    graph: { change: vi.fn() },
    draw: vi.fn(),
    selectItems: vi.fn(),
    setDirty: vi.fn(),
    ...overrides
  })
}

type ComfyAppPrivate = Pick<ComfyApp, 'vueAppReady'> & {
  addApiUpdateHandlers(): void
  addDropHandler(): void
  addProcessKeyHandler(): void
  runMissingMediaPipeline(silent?: boolean): Promise<void>
  showMissingNodesError(types: string[]): void
  updateVueAppNodeDefs(defs: Record<string, ComfyNodeDef>): void
}

function privateApi(instance: ComfyApp): ComfyAppPrivate {
  const appObject: object = instance
  return fromPartial<ComfyAppPrivate>(appObject)
}

function attachLoadGraphCanvas(
  app: ComfyApp,
  options: { width?: number; height?: number } = {}
): LGraphCanvas {
  const canvasEl = document.createElement('canvas')
  canvasEl.width = options.width ?? 100
  canvasEl.height = options.height ?? 100
  app.canvasElRef.value = canvasEl

  const canvas = createMockCanvas({
    setGraph: vi.fn(),
    resize: vi.fn(),
    graph_mouse: [0, 0],
    viewport: [0, 0, 100, 100],
    visible_area: { x: 0, y: 0, width: 100, height: 100 },
    ds: {
      offset: [0, 0],
      scale: 1,
      computeVisibleArea: vi.fn()
    }
  })
  app.canvas = canvas
  return canvas
}

function createTestFile(name: string, type: string): File {
  return new File([''], name, { type })
}

async function flushDropHandler() {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function createWorkflowGraphData(): ComfyWorkflowJSON {
  return {
    last_node_id: 0,
    last_link_id: 0,
    nodes: [],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  }
}

describe('ComfyApp', () => {
  let app: ComfyApp
  let mockCanvas: LGraphCanvas

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app = new ComfyApp()
    mockCanvas = createMockCanvas()
    app.canvas = mockCanvas
    mockWorkspaceWorkflow.activeWorkflow = null
    mockWorkspaceStore.workflow = mockWorkspaceWorkflow
    mockWorkspaceStore.spinner = false
    mockApiKeyAuthStore.getApiKey.mockReturnValue(undefined)
    mockAuthStore.getAuthToken.mockResolvedValue(undefined)
    mockExtensionService.invokeExtensions.mockReturnValue([])
    mockExtensionService.invokeExtensionsAsync.mockResolvedValue(undefined)
    mockSettingStore.get.mockImplementation((key: string) =>
      key === 'Comfy.RightSidePanel.ShowErrorsTab' ? true : undefined
    )
    mockResolveAccountPrecondition.mockReturnValue(undefined)
    mockNodeOutputStore.getNodeOutputs.mockReturnValue(undefined)
    mockExtractFilesFromDragEvent.mockResolvedValue([])
    mockNodeReplacementStore.load.mockResolvedValue(undefined)
    mockNodeReplacementStore.getReplacementFor.mockReturnValue(null)
    mockWorkflowValidation.validateWorkflow.mockResolvedValue({
      graphData: undefined
    })
    mockEnsureCorrectLayoutScale.mockReturnValue(false)
    mockRunMissingModelPipeline.mockResolvedValue(undefined)
    mockFindLegacyRerouteNodes.mockReturnValue([])
    mockNoNativeReroutes.mockReturnValue(false)
    mockSubgraphNavigationStore.updateHash.mockResolvedValue(undefined)
    localStorage.clear()
    ComfyApp.clipspace = null
    ComfyApp.clipspace_return_node = null
    ComfyApp.clipspace_invalidate_handler = null
    singletonApp.vueAppReady = false
    singletonApp.canvas = mockCanvas
    singletonApp.nodeOutputs = {}
  })

  describe('queuePrompt', () => {
    it('queues the request but does not start a second processor while busy', async () => {
      const dispatchCustomEvent = vi
        .spyOn(api, 'dispatchCustomEvent')
        .mockImplementation(() => true)
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      Reflect.set(app, 'processingQueue', true)

      await expect(app.queuePrompt(2, 3)).resolves.toBe(false)

      expect(dispatchCustomEvent).toHaveBeenCalledWith(
        'promptQueueing',
        expect.objectContaining({
          requestId: expect.any(Number),
          batchCount: 3
        })
      )
      expect(queuePrompt).not.toHaveBeenCalled()
    })

    it('queues partial execution batches with auth headers and widget callbacks', async () => {
      const graph = new LGraph()
      const node = new LGraphNode('PreviewAny', 'PreviewAny')
      node.id = toNodeId(1)
      const beforeQueued = vi.fn()
      node.addWidget('number', 'seed', 1, () => {})
      node.widgets![0].beforeQueued = beforeQueued
      graph.add(node)
      Reflect.set(app, 'rootGraphInternal', graph)
      const workflow = new ComfyWorkflow({
        path: 'workflows/partial.json',
        modified: 0,
        size: 0
      })
      mockWorkspaceWorkflow.activeWorkflow = workflow
      mockAuthStore.getAuthToken.mockResolvedValue('token-1')
      mockApiKeyAuthStore.getApiKey.mockReturnValue('api-key-1')
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.Execution.PreviewMethod') return 'auto'
        return key === 'Comfy.RightSidePanel.ShowErrorsTab' ? true : undefined
      })
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: {
          [node.id]: {
            class_type: 'PreviewAny',
            inputs: {},
            _meta: { title: 'PreviewAny' }
          }
        },
        workflow: createWorkflowGraphData()
      })
      const dispatchCustomEvent = vi
        .spyOn(api, 'dispatchCustomEvent')
        .mockImplementation(() => true)
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-ok',
        node_errors: {},
        error: ''
      })
      vi.spyOn(app.ui.queue, 'update').mockResolvedValue(undefined)
      const targets = ['1'] as NodeExecutionId[]

      await expect(app.queuePrompt(7, 2, targets)).resolves.toBe(true)

      expect(api.queuePrompt).toHaveBeenCalledTimes(2)
      expect(api.queuePrompt).toHaveBeenCalledWith(7, expect.any(Object), {
        partialExecutionTargets: targets,
        previewMethod: 'auto'
      })
      expect(api.authToken).toBeUndefined()
      expect(api.apiKey).toBeUndefined()
      expect(beforeQueued).toHaveBeenCalledWith({ isPartialExecution: true })
      expect(dispatchCustomEvent).toHaveBeenCalledWith(
        'promptQueued',
        expect.objectContaining({
          number: 7,
          batchCount: 2,
          requestId: expect.any(Number)
        })
      )
      expect(useExecutionStore().queuedJobs['job-ok']?.workflow?.path).toBe(
        workflow.path
      )
    })

    it('shows the error overlay for successful prompt responses with node errors', async () => {
      const graph = new LGraph()
      const workflow = new ComfyWorkflow({
        path: 'workflows/review.json',
        modified: 0,
        size: 0
      })
      const promptOutput: ComfyApiWorkflow = {
        '1': {
          class_type: 'PreviewAny',
          inputs: {},
          _meta: { title: 'PreviewAny' }
        }
      }
      const nodeErrors: Record<string, NodeError> = {
        '1': {
          class_type: 'PreviewAny',
          dependent_outputs: ['1'],
          errors: [
            {
              type: 'required_input_missing',
              message: 'Required input is missing: source',
              details: '',
              extra_info: { input_name: 'source' }
            }
          ]
        }
      }
      Reflect.set(app, 'rootGraphInternal', graph)
      mockWorkspaceWorkflow.activeWorkflow = workflow
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: promptOutput,
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1',
        node_errors: nodeErrors,
        error: ''
      })

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      const errorStore = useExecutionErrorStore()
      const executionStore = useExecutionStore()
      expect(errorStore.lastNodeErrors).toEqual(nodeErrors)
      expect(errorStore.isErrorOverlayOpen).toBe(true)
      expect(executionStore.queuedJobs['job-1']?.nodes).toEqual({ '1': false })
      expect(executionStore.jobIdToSessionWorkflowPath.get('job-1')).toBe(
        'workflows/review.json'
      )
      expect(mockCanvas.draw).toHaveBeenCalledWith(true, true)
    })

    it('keeps node errors without opening the overlay when the errors tab is disabled', async () => {
      const nodeErrors: Record<string, NodeError> = {
        '1': {
          class_type: 'PreviewAny',
          dependent_outputs: ['1'],
          errors: []
        }
      }
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      mockSettingStore.get.mockImplementation((key: string) =>
        key === 'Comfy.RightSidePanel.ShowErrorsTab' ? false : undefined
      )
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: {},
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-errors-hidden',
        node_errors: nodeErrors,
        error: ''
      })

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      expect(useExecutionErrorStore().lastNodeErrors).toEqual(nodeErrors)
      expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)
      expect(mockCanvas.draw).toHaveBeenCalledWith(true, true)
    })

    it('routes access restricted failures through the access dialog', async () => {
      const workflow = new ComfyWorkflow({
        path: 'workflows/private.json',
        modified: 0,
        size: 0
      })
      const error = new PromptExecutionError(
        {
          error: {
            type: 'forbidden',
            message: 'Not allowed',
            details: ''
          }
        },
        403
      )
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      mockWorkspaceWorkflow.activeWorkflow = workflow
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: {},
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(error)
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(app.queuePrompt(0)).resolves.toBe(true)

      expect(mockDialogService.showErrorDialog).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ reportType: 'accessRestrictedError' })
      )
      expect(useExecutionErrorStore().lastPromptError).toEqual({
        type: 'forbidden',
        message: 'Not allowed',
        details: ''
      })
      expect(mockCanvas.draw).toHaveBeenCalledWith(true, true)
    })

    it('uses middleware messages for access restricted prompt failures', async () => {
      const middlewareResponse: PromptResponse & { message: string } = {
        message: 'Workspace allowlist required',
        error: ''
      }
      const error = new PromptExecutionError(middlewareResponse, 403)
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: {},
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(error)
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(app.queuePrompt(0)).resolves.toBe(true)

      expect(mockDialogService.showErrorDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Workspace allowlist required'
        }),
        expect.objectContaining({ reportType: 'accessRestrictedError' })
      )
    })

    it('uses string access errors for access restricted prompt failures', async () => {
      const error = new PromptExecutionError(
        {
          error: 'String access denied'
        } as PromptResponse,
        403
      )
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: {},
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(error)
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(app.queuePrompt(0)).resolves.toBe(true)

      expect(mockDialogService.showErrorDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'String access denied'
        }),
        expect.objectContaining({ reportType: 'accessRestrictedError' })
      )
    })

    it('keeps prompt string errors in the execution error store', async () => {
      const error = new PromptExecutionError({
        error: 'No outputs found'
      } as PromptResponse)
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: {},
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(error)
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(app.queuePrompt(0)).resolves.toBe(true)

      expect(useExecutionErrorStore().lastPromptError).toEqual({
        type: 'error',
        message: 'No outputs found',
        details: ''
      })
      expect(mockCanvas.draw).toHaveBeenCalledWith(true, true)
    })

    it('rescans the graph for missing-node prompt failures', async () => {
      const error = new PromptExecutionError({
        error: {
          type: 'missing_node_type',
          message: 'Unknown node',
          details: ''
        }
      })
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: {},
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(error)
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(app.queuePrompt(0)).resolves.toBe(true)

      expect(mockRescanAndSurfaceMissingNodes).toHaveBeenCalledWith(graph)
      expect(useExecutionErrorStore().lastPromptError).toEqual({
        type: 'missing_node_type',
        message: 'Unknown node',
        details: ''
      })
    })

    it('opens account precondition prompts without surfacing prompt errors', async () => {
      const precondition = { code: 'credits_required' }
      const error = new PromptExecutionError({
        error: {
          type: 'credits_required',
          message: 'Credits required',
          details: ''
        }
      })
      mockResolveAccountPrecondition.mockReturnValue(precondition)
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: {},
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(error)
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(app.queuePrompt(0)).resolves.toBe(true)

      expect(mockAccountPreconditionDialog.open).toHaveBeenCalledWith(
        precondition
      )
      expect(useExecutionErrorStore().lastPromptError).toBeNull()
      expect(mockDialogService.showErrorDialog).not.toHaveBeenCalled()
    })
  })

  describe('preview params', () => {
    it('returns the configured preview format query param', () => {
      mockSettingStore.get.mockImplementation((key: string) =>
        key === 'Comfy.PreviewFormat' ? 'webp' : undefined
      )

      expect(app.getPreviewFormatParam()).toBe('&preview=webp')
    })

    it('omits the preview format query param when unset', () => {
      expect(app.getPreviewFormatParam()).toBe('')
    })

    it('adds a random cache-busting query param outside cloud', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.25)

      expect(app.getRandParam()).toBe('&rand=0.25')
    })
  })

  describe('nodeOutputs', () => {
    it('notifies extensions after the Vue app is ready', () => {
      const outputs = {
        '1': { images: [{ filename: 'output.png' }] }
      }

      app.nodeOutputs = outputs
      expect(mockExtensionService.invokeExtensions).not.toHaveBeenCalled()

      app.vueAppReady = true
      app.nodeOutputs = outputs

      expect(mockExtensionService.invokeExtensions).toHaveBeenCalledWith(
        'onNodeOutputsUpdated',
        outputs
      )
    })
  })

  describe('node definitions', () => {
    function createNodeDef(
      overrides: Partial<ComfyNodeDef> = {}
    ): ComfyNodeDef {
      return {
        name: 'TestNode',
        display_name: 'Test Node',
        category: 'testing/tools',
        python_module: 'test.nodes',
        description: 'A test node',
        input: { required: {}, optional: {} },
        output: [],
        output_name: [],
        output_tooltips: [],
        output_node: false,
        deprecated: false,
        experimental: false,
        ...overrides
      }
    }

    it('loads and translates node definition fallbacks from the API', async () => {
      const defs = {
        TestNode: createNodeDef(),
        EmptyDescription: createNodeDef({
          name: 'EmptyDescription',
          display_name: '',
          category: 'empty',
          description: ''
        })
      }
      vi.spyOn(api, 'getNodeDefs').mockResolvedValue(defs)

      const result = await app.getNodeDefs()

      expect(result.TestNode).toMatchObject({
        display_name: 'Test Node',
        description: 'A test node',
        category: 'testing/tools'
      })
      expect(result.EmptyDescription).toMatchObject({
        display_name: 'EmptyDescription',
        description: '',
        category: 'empty'
      })
    })

    it('registers all fetched backend definitions', async () => {
      const defs = {
        First: createNodeDef({ name: 'First' }),
        Second: createNodeDef({ name: 'Second' })
      }
      const registerNodeDef = vi
        .spyOn(app, 'registerNodeDef')
        .mockResolvedValue(undefined)

      await app.registerNodesFromDefs(defs)

      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'addCustomNodeDefs',
        defs
      )
      expect(registerNodeDef).toHaveBeenCalledWith('First', defs.First)
      expect(registerNodeDef).toHaveBeenCalledWith('Second', defs.Second)
    })

    it('updates Vue node definitions only after the Vue app is ready', async () => {
      const defs = {
        TestNode: createNodeDef()
      }
      vi.spyOn(app, 'getNodeDefs').mockResolvedValue(defs)
      vi.spyOn(app, 'registerNodesFromDefs').mockResolvedValue(undefined)
      const updateVueAppNodeDefs = vi
        .spyOn(privateApi(app), 'updateVueAppNodeDefs')
        .mockImplementation(() => undefined)

      app.vueAppReady = false
      await app.registerNodes()
      expect(updateVueAppNodeDefs).not.toHaveBeenCalled()

      app.vueAppReady = true
      await app.registerNodes()
      expect(updateVueAppNodeDefs).toHaveBeenCalledWith(defs)
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'registerCustomNodes'
      )
    })

    it('adds frontend-only node definitions while skipping backend and skip-list nodes', () => {
      class FrontendOnlyNode extends LGraphNode {}
      class BackendKnownNode extends LGraphNode {}
      class SkippedNode extends LGraphNode {}

      LiteGraph.registerNodeType('frontend/Only', FrontendOnlyNode)
      LiteGraph.registerNodeType('backend/Known', BackendKnownNode)
      LiteGraph.registerNodeType('frontend/Skipped', SkippedNode)
      SkippedNode.skip_list = true

      try {
        const defs = {
          'backend/Known': createNodeDef({
            name: 'backend/Known',
            display_name: 'Backend Known',
            category: 'backend'
          })
        }

        privateApi(app).updateVueAppNodeDefs(defs)

        const store = useNodeDefStore()
        expect(store.nodeDefsByName['frontend/Only']).toMatchObject({
          name: 'frontend/Only',
          category: 'frontend',
          description: 'Frontend only node for frontend/Only'
        })
        expect(store.nodeDefsByName['backend/Known']).toMatchObject({
          name: 'backend/Known',
          display_name: 'Backend Known'
        })
        expect(store.nodeDefsByName['frontend/Skipped']).toBeUndefined()
        expect(mockExtensionService.invokeExtensions).toHaveBeenCalledWith(
          'beforeRegisterVueAppNodeDefs',
          expect.arrayContaining([
            expect.objectContaining({ name: 'frontend/Only' }),
            expect.objectContaining({ name: 'backend/Known' })
          ])
        )
      } finally {
        LiteGraph.unregisterNodeType('frontend/Only')
        LiteGraph.unregisterNodeType('backend/Known')
        LiteGraph.unregisterNodeType('frontend/Skipped')
      }
    })
  })

  describe('clipspace', () => {
    it('copies widget values and output-store images into clipspace', () => {
      const image: ResultItem = {
        filename: 'result.png',
        subfolder: 'sub',
        type: 'output'
      }
      const invalidate = vi.fn()
      ComfyApp.clipspace_invalidate_handler = invalidate
      mockNodeOutputStore.getNodeOutputs.mockReturnValue({ images: [image] })

      ComfyApp.copyToClipspace(
        createMockNode({
          imageIndex: 2,
          widgets: [
            { type: 'number', name: 'steps', value: 20 },
            { type: 'text', name: 'prompt', value: 'positive' }
          ]
        })
      )

      expect(ComfyApp.clipspace?.widgets).toEqual([
        { type: 'number', name: 'steps', value: 20 },
        { type: 'text', name: 'prompt', value: 'positive' }
      ])
      expect(ComfyApp.clipspace?.images).toEqual([image])
      expect(ComfyApp.clipspace?.selectedIndex).toBe(2)
      expect(ComfyApp.clipspace_return_node).toBeNull()
      expect(invalidate).toHaveBeenCalledTimes(1)
    })

    it('pastes selected images, widget values, and output metadata', () => {
      const callback = vi.fn()
      const sourceA = new Image()
      const sourceB = new Image()
      const painted = new Image()
      const combined = new Image()
      sourceA.src = 'a.png'
      sourceB.src = 'b.png'
      painted.src = 'painted.png'
      combined.src = 'combined.png'
      const images: ResultItem[] = [
        { filename: 'a.png', subfolder: 'sub', type: 'input' },
        { filename: 'b.png', type: 'output' }
      ]
      ComfyApp.clipspace = {
        widgets: [
          {
            type: 'text',
            name: 'prompt',
            value: { filename: 'mask.png', subfolder: 'masks', type: 'temp' }
          },
          { type: 'button', name: 'skip', value: 'new' },
          { type: 'number', name: 'steps', value: 12 }
        ],
        imgs: [sourceA, sourceB, painted, combined],
        original_imgs: [],
        images,
        selectedIndex: 1,
        img_paste_mode: 'selected',
        paintedIndex: 2,
        combinedIndex: 3
      }
      const node = createMockNode({
        id: 8,
        imgs: [new Image()],
        widgets: [
          { type: 'text', name: 'image', value: '' },
          { type: 'text', name: 'prompt', value: '' },
          { type: 'button', name: 'skip', value: 'old', callback },
          { type: 'number', name: 'steps', value: 0, callback }
        ]
      })
      singletonApp.nodeOutputs = { '8': { images: [] } }

      ComfyApp.pasteFromClipspace(node)

      expect(node.images).toEqual([images[1]])
      expect(node.imgs?.map((img) => img.src)).toEqual([
        expect.stringContaining('/combined.png')
      ])
      expect(node.widgets?.[0].value).toBe('b.png [output]')
      expect(node.widgets?.[1].value).toBe('masks/mask.png [temp]')
      expect(node.widgets?.[2].value).toBe('old')
      expect(node.widgets?.[3].value).toBe(12)
      expect(callback).toHaveBeenCalledWith(12)
      expect(singletonApp.nodeOutputs['8'].images).toEqual([images[1]])
      expect(mockCanvas.setDirty).toHaveBeenCalledWith(true)
      expect(mockNodeOutputStore.updateNodeImages).toHaveBeenCalledWith(node)
    })

    it('pastes all images when clipspace is in all-images mode', () => {
      const sourceA = new Image()
      const sourceB = new Image()
      sourceA.src = 'a.png'
      sourceB.src = 'b.png'
      const images: ResultItem[] = [
        { filename: 'a.png', type: 'input' },
        { filename: 'b.png', type: 'output' }
      ]
      ComfyApp.clipspace = {
        widgets: null,
        imgs: [sourceA, sourceB],
        original_imgs: [],
        images,
        selectedIndex: 0,
        img_paste_mode: 'all',
        paintedIndex: 10,
        combinedIndex: 10
      }
      const node = createMockNode({ id: 9, imgs: [] })

      ComfyApp.pasteFromClipspace(node)

      expect(node.images).toEqual(images)
      expect(node.imgs?.map((img) => img.src)).toEqual([
        expect.stringContaining('/a.png'),
        expect.stringContaining('/b.png')
      ])
      expect(mockNodeOutputStore.updateNodeImages).toHaveBeenCalledWith(node)
    })

    it('pastes image elements without output metadata', () => {
      const selected = new Image()
      const painted = new Image()
      const combined = new Image()
      selected.src = 'selected.png'
      painted.src = 'painted.png'
      combined.src = 'combined.png'
      ComfyApp.clipspace = {
        widgets: null,
        imgs: [selected, painted, combined],
        original_imgs: [],
        images: null,
        selectedIndex: 0,
        img_paste_mode: 'selected',
        paintedIndex: 1,
        combinedIndex: 2
      }
      const node = createMockNode({
        id: 12,
        imgs: [new Image()],
        widgets: [{ type: 'text', name: 'prompt', value: 'old' }]
      })

      ComfyApp.pasteFromClipspace(node)

      expect(node.images).toBeUndefined()
      expect(node.imgs?.map((img) => img.src)).toEqual([
        expect.stringContaining('/combined.png')
      ])
      expect(node.widgets?.[0].value).toBe('old')
      expect(mockCanvas.setDirty).toHaveBeenCalledWith(true)
      expect(mockNodeOutputStore.updateNodeImages).toHaveBeenCalledWith(node)
    })

    it('keeps selected and painted images when no combined image exists', () => {
      const selected = new Image()
      const painted = new Image()
      selected.src = 'selected.png'
      painted.src = 'painted.png'
      ComfyApp.clipspace = {
        widgets: null,
        imgs: [selected, painted],
        original_imgs: [],
        images: null,
        selectedIndex: 0,
        img_paste_mode: 'selected',
        paintedIndex: 1,
        combinedIndex: 10
      }
      const node = createMockNode({
        id: 14,
        imgs: [new Image()]
      })

      ComfyApp.pasteFromClipspace(node)

      expect(node.imgs?.map((img) => img.src)).toEqual([
        expect.stringContaining('/selected.png'),
        expect.stringContaining('/painted.png')
      ])
    })

    it('pastes widget callbacks when there are no image elements', () => {
      const callback = vi.fn()
      ComfyApp.clipspace = {
        widgets: [
          {
            type: 'number',
            name: 'steps',
            value: 30
          }
        ],
        imgs: null,
        original_imgs: null,
        images: null,
        selectedIndex: 0,
        img_paste_mode: 'selected',
        paintedIndex: 1,
        combinedIndex: 2
      }
      const node = createMockNode({
        widgets: [{ type: 'number', name: 'steps', value: 10, callback }]
      })

      ComfyApp.pasteFromClipspace(node)

      expect(node.widgets?.[0].value).toBe(30)
      expect(callback).toHaveBeenCalledWith(30)
      expect(mockNodeOutputStore.updateNodeImages).toHaveBeenCalledWith(node)
    })

    it('pastes back into the return node when the editor saves', () => {
      const node = createMockNode()
      const paste = vi.spyOn(ComfyApp, 'pasteFromClipspace')
      ComfyApp.clipspace_return_node = node

      ComfyApp.onClipspaceEditorSave()
      ComfyApp.onClipspaceEditorClosed()

      expect(paste).toHaveBeenCalledWith(node)
      expect(ComfyApp.clipspace_return_node).toBeNull()
    })

    it('copies image elements without widgets or a selected image index', () => {
      const image = new Image()
      image.src = 'copied.png'

      ComfyApp.copyToClipspace(
        createMockNode({
          imgs: [image]
        })
      )

      expect(ComfyApp.clipspace?.widgets).toBeNull()
      expect(ComfyApp.clipspace?.imgs?.[0].src).toContain('/copied.png')
      expect(ComfyApp.clipspace?.original_imgs?.[0]).toBe(
        ComfyApp.clipspace?.imgs?.[0]
      )
      expect(ComfyApp.clipspace?.selectedIndex).toBe(0)
      expect(ComfyApp.clipspace?.paintedIndex).toBe(2)
      expect(ComfyApp.clipspace?.combinedIndex).toBe(3)
    })

    it('pastes clipspace metadata even when the target has no image slots', () => {
      ComfyApp.clipspace = {
        widgets: null,
        imgs: null,
        original_imgs: null,
        images: null,
        selectedIndex: 0,
        img_paste_mode: 'selected',
        paintedIndex: 1,
        combinedIndex: 2
      }
      const node = createMockNode({ id: 11 })

      ComfyApp.pasteFromClipspace(node)

      expect(mockCanvas.setDirty).toHaveBeenCalledWith(true)
      expect(mockNodeOutputStore.updateNodeImages).toHaveBeenCalledWith(node)
    })

    it('pastes image widget objects when the target widget expects images', () => {
      const image: ResultItem = {
        filename: 'image.png',
        type: 'input'
      }
      ComfyApp.clipspace = {
        widgets: [
          {
            type: 'image',
            name: 'mask',
            value: { filename: 'mask.png', type: 'temp' }
          }
        ],
        imgs: null,
        original_imgs: null,
        images: [image],
        selectedIndex: 0,
        img_paste_mode: 'selected',
        paintedIndex: 1,
        combinedIndex: 2
      }
      const node = createMockNode({
        widgets: [
          { type: 'image', name: 'image', value: null },
          { type: 'image', name: 'mask', value: null }
        ]
      })

      ComfyApp.pasteFromClipspace(node)

      expect(node.widgets?.[0].value).toBe(image)
      expect(node.widgets?.[1].value).toEqual({
        filename: 'mask.png',
        type: 'temp'
      })
    })

    it('formats pasted image widget strings without subfolder or type suffixes', () => {
      ComfyApp.clipspace = {
        widgets: [
          {
            type: 'text',
            name: 'image',
            value: { filename: 'plain.png' }
          }
        ],
        imgs: null,
        original_imgs: null,
        images: [{ filename: 'target.png' }],
        selectedIndex: 0,
        img_paste_mode: 'selected',
        paintedIndex: 1,
        combinedIndex: 2
      }
      const node = createMockNode({
        widgets: [{ type: 'text', name: 'image', value: '' }]
      })

      ComfyApp.pasteFromClipspace(node)

      expect(node.widgets?.[0].value).toBe('plain.png')
    })

    it('does nothing when saving or pasting without clipspace state', () => {
      const paste = vi.spyOn(ComfyApp, 'pasteFromClipspace')
      const node = createMockNode()

      ComfyApp.onClipspaceEditorSave()
      paste.mockRestore()
      ComfyApp.pasteFromClipspace(node)

      expect(mockCanvas.setDirty).not.toHaveBeenCalled()
      expect(mockNodeOutputStore.updateNodeImages).not.toHaveBeenCalled()
    })

    it('copies direct node images without querying output state', () => {
      const image = new Image()
      image.src = 'direct.png'
      const result: ResultItem = { filename: 'direct.png', type: 'output' }

      ComfyApp.copyToClipspace(
        createMockNode({
          imgs: [image],
          images: [result]
        })
      )

      expect(ComfyApp.clipspace?.images).toEqual([result])
      expect(mockNodeOutputStore.getNodeOutputs).not.toHaveBeenCalled()
    })

    it('skips missing image widgets and callback-free widget matches', () => {
      ComfyApp.clipspace = {
        widgets: [{ type: 'number', name: 'steps', value: 8 }],
        imgs: null,
        original_imgs: null,
        images: [{ filename: 'unused.png', type: 'output' }],
        selectedIndex: 0,
        img_paste_mode: 'selected',
        paintedIndex: 1,
        combinedIndex: 2
      }
      const node = createMockNode({
        widgets: [
          { type: 'text', name: 'prompt', value: '' },
          { type: 'number', name: 'steps', value: 0 }
        ]
      })

      ComfyApp.pasteFromClipspace(node)

      expect(node.widgets?.[0].value).toBe('')
      expect(node.widgets?.[1].value).toBe(8)
      expect(mockCanvas.setDirty).toHaveBeenCalledWith(true)
    })
  })

  describe('loadTemplateData', () => {
    it('loads vintage and reroute clipboard templates and restores clipboard state', () => {
      localStorage.setItem('litegrapheditor_clipboard', 'previous')
      const graphMouse: [number, number] = [0, 0]
      const selected_nodes = {
        first: { pos: [10, 20], size: [100, 30] },
        second: { pos: [20, 80], size: [100, 40] }
      }
      const pasteFromClipboard = vi.fn()
      singletonApp.canvas = createMockCanvas({
        ...mockCanvas,
        graph_mouse: graphMouse,
        selected_nodes,
        pasteFromClipboard
      })

      app.loadTemplateData({
        templates: [{}, { data: '{"nodes":[]}' }, { data: '{"reroutes":[1]}' }]
      })

      expect(deserialiseAndCreate).toHaveBeenCalledWith(
        '{"nodes":[]}',
        singletonApp.canvas
      )
      expect(pasteFromClipboard).toHaveBeenCalledTimes(1)
      expect(graphMouse[1]).toBe(170)
      expect(localStorage.getItem('litegrapheditor_clipboard')).toBe('previous')
    })

    it('ignores empty template payloads', () => {
      app.loadTemplateData({})

      expect(deserialiseAndCreate).not.toHaveBeenCalled()
    })
  })

  describe('refreshComboInNodes', () => {
    it('shows success toast and removes the pending toast after node defs reload', async () => {
      app.vueAppReady = true
      vi.spyOn(app, 'reloadNodeDefs').mockResolvedValue()

      await app.refreshComboInNodes()

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'info' })
      )
      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
      expect(mockToastStore.remove).toHaveBeenCalledWith(
        mockToastStore.add.mock.calls[0][0]
      )
    })

    it('shows failure toast, removes the pending toast, and rethrows reload failures', async () => {
      app.vueAppReady = true
      const error = new Error('object_info failed')
      vi.spyOn(app, 'reloadNodeDefs').mockRejectedValue(error)

      await expect(app.refreshComboInNodes()).rejects.toThrow(error)

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(mockToastStore.remove).toHaveBeenCalledWith(
        mockToastStore.add.mock.calls[0][0]
      )
    })
  })

  describe('reloadNodeDefs', () => {
    it('syncs refreshed combo options into promoted combo host state', async () => {
      const initialOptions = ['missing.safetensors']
      const refreshedOptions = ['missing.safetensors', 'present.safetensors']

      const rootGraph = createTestRootGraph()
      const subgraph = createTestSubgraph({
        rootGraph,
        inputs: [{ name: 'ckpt_name', type: '*' }]
      })

      const interiorNode = new LGraphNode(
        'CheckpointLoaderSimple',
        'CheckpointLoaderSimple'
      )
      const interiorInput = interiorNode.addInput('ckpt_name', '*')
      interiorInput.widget = { name: 'ckpt_name' }
      const interiorWidget = interiorNode.addWidget(
        'combo',
        'ckpt_name',
        'missing.safetensors',
        () => {},
        { values: initialOptions }
      )
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

      const host = createTestSubgraphNode(subgraph)
      rootGraph.add(host)

      const hostWidgetId = host.inputs[0].widgetId
      if (!hostWidgetId) throw new Error('Expected a promoted host widgetId')

      const widgetValueStore = useWidgetValueStore()
      expect(widgetValueStore.getWidget(hostWidgetId)?.options).toEqual({
        values: initialOptions
      })

      const defs: Record<string, ComfyNodeDef> = {
        CheckpointLoaderSimple: {
          name: 'CheckpointLoaderSimple',
          display_name: 'CheckpointLoaderSimple',
          category: 'loaders',
          python_module: 'nodes',
          description: '',
          input: {
            required: {
              ckpt_name: [refreshedOptions, {}]
            },
            optional: {}
          },
          output: [],
          output_name: [],
          output_tooltips: [],
          output_node: false,
          deprecated: false,
          experimental: false
        }
      }
      Reflect.set(app, 'rootGraphInternal', rootGraph)
      vi.spyOn(app, 'getNodeDefs').mockResolvedValue(defs)
      vi.spyOn(app, 'registerNodeDef').mockResolvedValue(undefined)

      await app.reloadNodeDefs()

      expect(interiorWidget.options.values).toEqual(refreshedOptions)
      expect(widgetValueStore.getWidget(hostWidgetId)?.options.values).toEqual(
        refreshedOptions
      )
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'refreshComboInNodes',
        defs
      )
    })

    it('skips promoted host option sync when inputs do not resolve to combo state', async () => {
      const rootGraph = createTestRootGraph()
      rootGraph.add(new LGraphNode('PlainNode', 'PlainNode'))

      const unresolvedSubgraph = createTestSubgraph({
        rootGraph,
        inputs: [{ name: 'orphan', type: '*' }]
      })
      const unresolvedHost = createTestSubgraphNode(unresolvedSubgraph)
      unresolvedHost.addInput('manual', '*')
      rootGraph.add(unresolvedHost)

      const textSubgraph = createTestSubgraph({
        rootGraph,
        inputs: [{ name: 'text', type: '*' }]
      })
      const textNode = new LGraphNode('TextNode', 'TextNode')
      const textInput = textNode.addInput('text', '*')
      textInput.widget = { name: 'text' }
      textNode.addWidget('text', 'text', 'old text', () => {})
      textSubgraph.add(textNode)
      textSubgraph.inputNode.slots[0].connect(textNode.inputs[0], textNode)
      const textHost = createTestSubgraphNode(textSubgraph)
      rootGraph.add(textHost)

      const comboSubgraph = createTestSubgraph({
        rootGraph,
        inputs: [{ name: 'mode', type: '*' }]
      })
      const comboNode = new LGraphNode('ComboNode', 'ComboNode')
      const comboInput = comboNode.addInput('mode', '*')
      comboInput.widget = { name: 'mode' }
      comboNode.addWidget('combo', 'mode', 'first', () => {}, {
        values: ['first', 'second']
      })
      comboSubgraph.add(comboNode)
      comboSubgraph.inputNode.slots[0].connect(comboNode.inputs[0], comboNode)
      const comboHost = createTestSubgraphNode(comboSubgraph)
      rootGraph.add(comboHost)

      const widgetValueStore = useWidgetValueStore()
      const textWidgetId = textHost.inputs[0].widgetId
      const comboWidgetId = comboHost.inputs[0].widgetId
      if (!textWidgetId || !comboWidgetId) {
        throw new Error('Expected promoted host widget ids')
      }
      widgetValueStore.deleteWidget(comboWidgetId)

      Reflect.set(app, 'rootGraphInternal', rootGraph)
      vi.spyOn(app, 'getNodeDefs').mockResolvedValue({})
      vi.spyOn(app, 'registerNodeDef').mockResolvedValue(undefined)

      await app.reloadNodeDefs()

      expect(widgetValueStore.getWidget(textWidgetId)?.value).toBe('old text')
      expect(widgetValueStore.getWidget(comboWidgetId)).toBeUndefined()
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'refreshComboInNodes',
        {}
      )
    })

    it('refreshes optional V2 combo specs and media node outputs', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const mediaNode = new LGraphNode('MediaNode', 'MediaNode')
      mediaNode.addWidget('combo', 'mode', 'old', () => {}, {
        values: ['old']
      })
      mediaNode.refreshComboInNode = vi.fn()
      graph.add(mediaNode)
      const defs: Record<string, ComfyNodeDef> = {
        MediaNode: {
          name: 'MediaNode',
          display_name: 'MediaNode',
          category: 'media',
          python_module: 'nodes',
          description: '',
          input: {
            required: {},
            optional: {
              mode: ['COMBO', { options: ['new', 'newer'] }]
            }
          },
          output: [],
          output_name: [],
          output_tooltips: [],
          output_node: false,
          deprecated: false,
          experimental: false
        }
      }
      Reflect.set(mediaNode, 'previewMediaType', 'image')
      vi.mocked(isImageNode).mockReturnValue(true)
      vi.spyOn(app, 'getNodeDefs').mockResolvedValue(defs)
      vi.spyOn(app, 'registerNodeDef').mockResolvedValue(undefined)

      await app.reloadNodeDefs()

      expect(mediaNode.widgets?.[0].options.values).toEqual(['new', 'newer'])
      expect(mediaNode.refreshComboInNode).toHaveBeenCalledWith(defs)
      expect(mockNodeOutputStore.refreshNodeOutputs).toHaveBeenCalledWith(
        mediaNode
      )
    })
  })

  describe('refreshMissingModels', () => {
    it('delegates to the app-independent missing model refresh pipeline', async () => {
      const graph = {
        nodes: [],
        serialize: vi.fn(() => createWorkflowGraphData())
      }
      const result = {
        missingModels: [],
        confirmedCandidates: []
      }
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.spyOn(app, 'reloadNodeDefs').mockResolvedValue()
      mockRefreshMissingModelPipeline.mockResolvedValue(result)

      await expect(app.refreshMissingModels({ silent: false })).resolves.toBe(
        result
      )

      expect(mockRefreshMissingModelPipeline).toHaveBeenCalledWith({
        graph,
        reloadNodeDefs: expect.any(Function),
        missingModelStore: useMissingModelStore(),
        silent: false
      })

      await mockRefreshMissingModelPipeline.mock.calls[0][0].reloadNodeDefs()
      expect(app.reloadNodeDefs).toHaveBeenCalled()
    })
  })

  describe('loadGraphData', () => {
    it('falls back to the default graph and runs asset scans with default options', async () => {
      const rootGraph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', rootGraph)
      const canvas = attachLoadGraphCanvas(app, { width: 0, height: 0 })
      vi.spyOn(rootGraph, 'configure').mockImplementation(() => undefined)
      vi.spyOn(app, 'clean').mockImplementation(() => undefined)
      const runMissingMediaPipeline = vi
        .spyOn(privateApi(app), 'runMissingMediaPipeline')
        .mockResolvedValue(undefined)
      const requestAnimationFrame = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback: FrameRequestCallback) => {
          callback(0)
          return 1
        })

      await app.loadGraphData()

      expect(canvas.setGraph).toHaveBeenCalledWith(rootGraph)
      expect(app.clean).toHaveBeenCalled()
      expect(mockRunMissingModelPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          graph: rootGraph,
          silent: false
        })
      )
      expect(runMissingMediaPipeline).toHaveBeenCalledWith(false)
      expect(mockWorkflowService.showPendingWarnings).toHaveBeenCalledWith(
        undefined,
        { silent: false }
      )
      expect(canvas.resize).toHaveBeenCalled()
      expect(requestAnimationFrame).toHaveBeenCalled()
      expect(mockSubgraphNavigationStore.updateHash).toHaveBeenCalled()
      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalled()
      expect(mockWorkflowService.afterLoadNewGraph).toHaveBeenCalledWith(
        null,
        expect.any(Object),
        undefined
      )
    })

    it('validates, tracks, normalizes, and defers warning-heavy workflow loads', async () => {
      const rootGraph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', rootGraph)
      attachLoadGraphCanvas(app)
      const sampler = new LGraphNode('KSampler', 'KSampler')
      sampler.addWidget('combo', 'sampler_name', 'sample_euler', () => {}, {
        values: ['euler']
      })
      const controlWidget = sampler.addWidget(
        'combo',
        'control_after_generate',
        'fixed',
        () => {},
        {
          values: ['fixed', 'randomize']
        }
      )
      Reflect.set(controlWidget, 'value', true)
      const ckptWidget = sampler.addWidget(
        'combo',
        'ckpt_name',
        'model.safetensors',
        () => {},
        {
          values: ['model.safetensors']
        }
      )
      Reflect.set(ckptWidget, 'value', null)
      rootGraph.add(sampler)
      vi.spyOn(rootGraph, 'configure').mockImplementation(() => undefined)
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.Validation.Workflows') return true
        if (key === 'Comfy.EnableWorkflowViewRestore') return true
        return key === 'Comfy.RightSidePanel.ShowErrorsTab' ? true : undefined
      })
      mockWorkflowValidation.validateWorkflow.mockImplementation(
        async (graphData: ComfyWorkflowJSON) => ({ graphData })
      )
      mockFindLegacyRerouteNodes.mockReturnValue([{}])
      mockNoNativeReroutes.mockReturnValue(true)
      mockNodeReplacementStore.getReplacementFor.mockReturnValue({
        node_type: 'ReplacementNode'
      })
      mockEnsureCorrectLayoutScale.mockReturnValue(true)
      const runMissingMediaPipeline = vi
        .spyOn(privateApi(app), 'runMissingMediaPipeline')
        .mockResolvedValue(undefined)
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
        (callback: FrameRequestCallback) => {
          callback(0)
          return 1
        }
      )
      const workflow = new ComfyWorkflow({
        path: 'workflows/shared.json',
        modified: 0,
        size: 0
      })
      workflow.shareId = 'workflow-share'
      const graphData = fromPartial<ComfyWorkflowJSON>({
        ...createWorkflowGraphData(),
        nodes: [
          {
            id: 1,
            type: 'Missing<&>',
            mode: 0,
            properties: { cnr_id: 'missing-pack' }
          },
          {
            id: 2,
            type: 'MutedMissing',
            mode: LGraphEventMode.NEVER
          }
        ],
        extra: {
          ds: {
            offset: [25, 50],
            scale: 0.5
          }
        }
      })

      await app.loadGraphData(graphData, false, true, workflow, {
        checkForRerouteMigration: true,
        openSource: 'template',
        deferWarnings: true,
        silentAssetErrors: true
      })

      expect(mockWorkflowValidation.validateWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ version: 0.4 })
      )
      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          group: 'reroute-migration',
          severity: 'warn'
        })
      )
      expect(mockSubgraphService.loadSubgraphs).toHaveBeenCalledWith(
        expect.objectContaining({ version: 0.4 })
      )
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'beforeConfigureGraph',
        expect.any(Object),
        expect.any(Array)
      )
      expect(sampler.widgets?.map((widget) => widget.value)).toEqual([
        'euler',
        'randomize',
        'model.safetensors'
      ])
      expect(mockSyncLayoutStoreNodeBoundsFromGraph).toHaveBeenCalledWith(
        rootGraph
      )
      expect(mockTelemetry.trackWorkflowOpened).toHaveBeenCalledWith(
        expect.objectContaining({
          missing_node_count: 1,
          missing_node_types: ['Missing<&>'],
          open_source: 'template',
          share_id: 'workflow-share'
        })
      )
      expect(mockTelemetry.trackWorkflowImported).toHaveBeenCalledWith(
        expect.objectContaining({
          missing_node_count: 1,
          open_source: 'template'
        })
      )
      expect(mockWorkflowService.afterLoadNewGraph).toHaveBeenCalledWith(
        workflow,
        expect.any(Object),
        'workflow-share'
      )
      expect(mockRunMissingModelPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          graph: rootGraph,
          silent: true
        })
      )
      expect(runMissingMediaPipeline).toHaveBeenCalledWith(true)
      expect(mockWorkflowService.showPendingWarnings).not.toHaveBeenCalled()
      expect(mockLitegraphService.fitView).toHaveBeenCalled()
    })

    it('skips asset scans, aborts verification, and resets missing asset candidates', async () => {
      const rootGraph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', rootGraph)
      attachLoadGraphCanvas(app)
      vi.spyOn(rootGraph, 'configure').mockImplementation(() => undefined)
      vi.spyOn(app, 'clean').mockImplementation(() => undefined)
      const modelStore = useMissingModelStore()
      const mediaStore = useMissingMediaStore()
      const modelController = new AbortController()
      const mediaController = new AbortController()
      const abortModel = vi.spyOn(modelController, 'abort')
      const abortMedia = vi.spyOn(mediaController, 'abort')
      vi.spyOn(modelStore, 'createVerificationAbortController').mockReturnValue(
        modelController
      )
      vi.spyOn(mediaStore, 'createVerificationAbortController').mockReturnValue(
        mediaController
      )
      const setMissingModels = vi.spyOn(modelStore, 'setMissingModels')
      const setMissingMedia = vi.spyOn(mediaStore, 'setMissingMedia')
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
        (callback: FrameRequestCallback) => {
          callback(0)
          return 1
        }
      )

      await app.loadGraphData(createWorkflowGraphData(), true, false, null, {
        skipAssetScans: true
      })

      expect(abortModel).toHaveBeenCalled()
      expect(abortMedia).toHaveBeenCalled()
      expect(setMissingModels).toHaveBeenCalledWith([])
      expect(setMissingMedia).toHaveBeenCalledWith([])
      expect(mockRunMissingModelPipeline).not.toHaveBeenCalled()
      expect(mockWorkflowService.showPendingWarnings).toHaveBeenCalled()
    })

    it('shows a load error and clears loading state when graph configuration fails', async () => {
      const rootGraph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', rootGraph)
      attachLoadGraphCanvas(app)
      const error = new Error('bad graph')
      vi.spyOn(rootGraph, 'configure').mockImplementation(() => {
        throw error
      })
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await app.loadGraphData(createWorkflowGraphData())

      expect(mockDialogService.showErrorDialog).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          reportType: 'loadWorkflowError'
        })
      )
      expect(mockRunMissingModelPipeline).not.toHaveBeenCalled()
    })

    it('resets invalid combo values and restores saved canvas view when loading malformed graph input', async () => {
      const rootGraph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', rootGraph)
      attachLoadGraphCanvas(app)
      const node = new LGraphNode('PrimitiveNode', 'PrimitiveNode')
      node.addWidget('combo', 'control_after_generate', 'invalid', () => {}, {
        values: ['fixed', 'randomize']
      })
      rootGraph.add(node)
      vi.spyOn(rootGraph, 'configure').mockImplementation(() => undefined)
      vi.spyOn(app, 'clean').mockImplementation(() => undefined)
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.EnableWorkflowViewRestore') return true
        return key === 'Comfy.RightSidePanel.ShowErrorsTab' ? true : undefined
      })
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
        (callback: FrameRequestCallback) => {
          callback(0)
          return 1
        }
      )

      const malformedGraphData: ComfyWorkflowJSON = JSON.parse('[]')

      await app.loadGraphData(malformedGraphData, true, true)

      expect(node.widgets?.[0].value).toBe('fixed')
      expect(mockLitegraphService.fitView).toHaveBeenCalled()
    })
  })

  describe('handleFileList', () => {
    it('should create image nodes for each file in the list', async () => {
      const mockNode1 = createMockNode({ id: 1 })
      const mockNode2 = createMockNode({ id: 2 })
      const mockBatchNode = createMockNode({ id: 3, type: 'BatchImagesNode' })

      vi.mocked(pasteImageNodes).mockResolvedValue([mockNode1, mockNode2])
      vi.mocked(createNode).mockResolvedValue(mockBatchNode)

      const file1 = createTestFile('test1.png', 'image/png')
      const file2 = createTestFile('test2.jpg', 'image/jpeg')
      const files = [file1, file2]

      await app.handleFileList(files)

      expect(pasteImageNodes).toHaveBeenCalledWith(mockCanvas, files)
      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'BatchImagesNode')
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2,
        mockBatchNode
      ])
      expect(mockNode1.connect).toHaveBeenCalledWith(0, mockBatchNode, 0)
      expect(mockNode2.connect).toHaveBeenCalledWith(0, mockBatchNode, 1)
    })

    it('should select single image node without batch node', async () => {
      const mockNode1 = createMockNode({ id: 1 })
      vi.mocked(pasteImageNodes).mockResolvedValue([mockNode1])

      const file = createTestFile('test.png', 'image/png')

      await app.handleFileList([file])

      expect(createNode).not.toHaveBeenCalled()
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([mockNode1])
      expect(mockNode1.connect).not.toHaveBeenCalled()
    })

    it('should handle empty file list', async () => {
      await app.handleFileList([])

      expect(pasteImageNodes).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })

    it('should not process unsupported file types', async () => {
      const invalidFile = createTestFile('test.pdf', 'application/pdf')

      await app.handleFileList([invalidFile])

      expect(pasteImageNodes).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })

    it('should return when image paste creates no nodes', async () => {
      vi.mocked(pasteImageNodes).mockResolvedValue([])

      await app.handleFileList([createTestFile('empty.png', 'image/png')])

      expect(createNode).not.toHaveBeenCalled()
      expect(mockCanvas.selectItems).not.toHaveBeenCalled()
    })

    it('should return when batch node creation fails', async () => {
      const first = createMockNode({ id: 1 })
      const second = createMockNode({ id: 2 })
      vi.mocked(pasteImageNodes).mockResolvedValue([first, second])
      vi.mocked(createNode).mockResolvedValue(null)

      await app.handleFileList([
        createTestFile('first.png', 'image/png'),
        createTestFile('second.png', 'image/png')
      ])

      expect(mockCanvas.selectItems).not.toHaveBeenCalled()
      expect(first.connect).not.toHaveBeenCalled()
      expect(second.connect).not.toHaveBeenCalled()
    })
  })

  describe('handleAudioFileList', () => {
    it('should create audio nodes and select them', async () => {
      const mockNode1 = createMockNode({ id: 1, type: 'LoadAudio' })
      const mockNode2 = createMockNode({ id: 2, type: 'LoadAudio' })
      vi.mocked(pasteAudioNodes).mockResolvedValue([mockNode1, mockNode2])

      const file1 = createTestFile('test1.mp3', 'audio/mpeg')
      const file2 = createTestFile('test2.wav', 'audio/wav')

      await app.handleAudioFileList([file1, file2])

      expect(pasteAudioNodes).toHaveBeenCalledWith(mockCanvas, [file1, file2])
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2
      ])
    })

    it('should not select when no nodes created', async () => {
      vi.mocked(pasteAudioNodes).mockResolvedValue([])

      await app.handleAudioFileList([createTestFile('test.mp3', 'audio/mpeg')])

      expect(mockCanvas.selectItems).not.toHaveBeenCalled()
    })
  })

  describe('handleVideoFileList', () => {
    it('should create video nodes and select them', async () => {
      const mockNode1 = createMockNode({ id: 1, type: 'LoadVideo' })
      const mockNode2 = createMockNode({ id: 2, type: 'LoadVideo' })
      vi.mocked(pasteVideoNodes).mockResolvedValue([mockNode1, mockNode2])

      const file1 = createTestFile('test1.mp4', 'video/mp4')
      const file2 = createTestFile('test2.webm', 'video/webm')

      await app.handleVideoFileList([file1, file2])

      expect(pasteVideoNodes).toHaveBeenCalledWith(mockCanvas, [file1, file2])
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2
      ])
    })

    it('should not select when no nodes created', async () => {
      vi.mocked(pasteVideoNodes).mockResolvedValue([])

      await app.handleVideoFileList([createTestFile('test.mp4', 'video/mp4')])

      expect(mockCanvas.selectItems).not.toHaveBeenCalled()
    })
  })

  describe('positionBatchNodes', () => {
    it('should position batch node to the right of first node', () => {
      const mockNode1 = createMockNode({
        pos: [100, 200],
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const mockBatchNode = createMockNode({ pos: [0, 0] })

      app.positionBatchNodes([mockNode1], mockBatchNode)

      expect(mockBatchNode.pos).toEqual([500, 230])
    })

    it('should stack multiple image nodes vertically', () => {
      const mockNode1 = createMockNode({
        pos: [100, 200],
        type: 'LoadImage',
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const mockNode2 = createMockNode({ pos: [0, 0], type: 'LoadImage' })
      const mockNode3 = createMockNode({ pos: [0, 0], type: 'LoadImage' })
      const mockBatchNode = createMockNode({ pos: [0, 0] })

      app.positionBatchNodes([mockNode1, mockNode2, mockNode3], mockBatchNode)

      expect(mockNode1.pos).toEqual([100, 200])
      expect(mockNode2.pos).toEqual([100, 594])
      expect(mockNode3.pos).toEqual([100, 963])
    })

    it('should call graph change once for all nodes', () => {
      const mockNode1 = createMockNode({
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const mockBatchNode = createMockNode()

      app.positionBatchNodes([mockNode1], mockBatchNode)

      expect(mockCanvas.graph?.change).toHaveBeenCalledTimes(1)
    })

    it('should not add image spacing for non-image nodes', () => {
      const first = createMockNode({
        type: 'LoadAudio',
        getBounding: vi.fn(() => new Float64Array([10, 20, 30, 40]))
      })
      const second = createMockNode({ type: 'LoadAudio', pos: [0, 0] })
      const batchNode = createMockNode({ pos: [0, 0] })

      app.positionBatchNodes([first, second], batchNode)

      expect(batchNode.pos).toEqual([140, 50])
      expect(second.pos).toEqual([10, 70])
    })
  })

  describe('positionNodes', () => {
    it('should leave single nodes in place', () => {
      const node = createMockNode({ pos: [5, 10] })

      app.positionNodes([node])

      expect(node.pos).toEqual([5, 10])
      expect(mockCanvas.graph?.change).not.toHaveBeenCalled()
    })

    it('should stack later nodes below the first node', () => {
      const first = createMockNode({
        getBounding: vi.fn(() => new Float64Array([10, 20, 30, 40]))
      })
      const second = createMockNode({ pos: [0, 0] })
      const third = createMockNode({ pos: [0, 0] })

      app.positionNodes([first, second, third])

      expect(second.pos).toEqual([10, 220])
      expect(third.pos).toEqual([10, 395])
      expect(mockCanvas.graph?.change).toHaveBeenCalledTimes(1)
    })
  })

  describe('isApiJson', () => {
    it('accepts only non-empty API prompt records', () => {
      expect(app.isApiJson(null)).toBe(false)
      expect(app.isApiJson([])).toBe(false)
      expect(app.isApiJson({})).toBe(false)
      expect(app.isApiJson({ 1: null })).toBe(false)
      expect(app.isApiJson({ 1: { class_type: 123, inputs: {} } })).toBe(false)
      expect(
        app.isApiJson({ 1: { class_type: 'PreviewAny', inputs: [] } })
      ).toBe(false)
      expect(
        app.isApiJson({ 1: { class_type: 'PreviewAny', inputs: {} } })
      ).toBe(true)
    })
  })

  describe('loadApiJson', () => {
    it('builds graph nodes, assigns metadata titles, and wires inputs', () => {
      const widgetCallback = vi.fn()
      class ApiSourceNode extends LGraphNode {
        constructor(title?: string) {
          super('ApiSource', title)
          this.addOutput('out', 'number')
        }
      }
      class ApiTargetNode extends LGraphNode {
        constructor(title?: string) {
          super('ApiTarget', title)
          this.addInput('incoming', 'number')
          this.addWidget('number', 'strength', 0, widgetCallback)
        }
      }
      LiteGraph.registerNodeType('ApiSource', ApiSourceNode)
      LiteGraph.registerNodeType('ApiTarget', ApiTargetNode)
      const graph = new LGraph()
      Reflect.set(singletonApp, 'rootGraphInternal', graph)

      try {
        singletonApp.loadApiJson(
          {
            source: {
              class_type: 'ApiSource',
              inputs: {},
              _meta: { title: 'Source title' }
            },
            2: {
              class_type: 'ApiTarget',
              inputs: {
                incoming: ['source', 0],
                strength: 0.75
              },
              _meta: { title: 'Target title' }
            }
          },
          'api-prompt'
        )

        const source = graph.nodes.find((node) => node.type === 'ApiSource')
        const target = graph.nodes.find((node) => node.type === 'ApiTarget')
        expect(source?.title).toBe('Source title')
        expect(target?.title).toBe('Target title')
        expect(target?.widgets?.[0].value).toBe(0.75)
        expect(widgetCallback).toHaveBeenCalledWith(0.75)
        expect(target?.inputs?.[0].link).not.toBeNull()
        expect(mockWorkflowService.afterLoadNewGraph).toHaveBeenCalledWith(
          'api-prompt',
          expect.any(Object)
        )
      } finally {
        LiteGraph.unregisterNodeType('ApiSource')
        LiteGraph.unregisterNodeType('ApiTarget')
      }
    })

    it('surfaces missing node types and skips nodes that cannot be created', () => {
      const graph = new LGraph()
      Reflect.set(singletonApp, 'rootGraphInternal', graph)
      const showMissingNodesError = vi
        .spyOn(privateApi(singletonApp), 'showMissingNodesError')
        .mockImplementation(() => undefined)

      singletonApp.loadApiJson(
        {
          1: {
            class_type: 'MissingApiNode',
            inputs: {},
            _meta: { title: 'MissingApiNode' }
          }
        },
        'missing'
      )

      expect(showMissingNodesError).toHaveBeenCalledWith(['MissingApiNode'])
      expect(graph.nodes).toHaveLength(0)
    })

    it('skips missing link sources and converts widgets into inputs when needed', () => {
      const widgetCallback = vi.fn()
      class WidgetInputNode extends LGraphNode {
        constructor(title?: string) {
          super('WidgetInputNode', title)
          this.addWidget('number', 'strength', 0, widgetCallback)
        }

        convertWidgetToInput = () => {
          this.addInput('strength', 'number')
          return true
        }
      }
      class SourceNode extends LGraphNode {
        constructor(title?: string) {
          super('SourceNode', title)
          this.addOutput('value', 'number')
        }
      }
      class NoInputNode extends LGraphNode {
        constructor(title?: string) {
          super('NoInputNode', title)
        }
      }
      LiteGraph.registerNodeType('WidgetInputNode', WidgetInputNode)
      LiteGraph.registerNodeType('SourceNode', SourceNode)
      LiteGraph.registerNodeType('NoInputNode', NoInputNode)
      const graph = new LGraph()
      Reflect.set(singletonApp, 'rootGraphInternal', graph)

      try {
        singletonApp.loadApiJson(
          fromPartial<ComfyApiWorkflow>({
            1: {
              class_type: 'WidgetInputNode',
              inputs: {
                strength: [3, 0],
                missing: [404, 0]
              },
              _meta: { title: 'WidgetInputNode' }
            },
            2: {
              class_type: 'NoInputNode',
              _meta: { title: 'NoInputNode' }
            },
            3: {
              class_type: 'SourceNode',
              inputs: {},
              _meta: { title: 'SourceNode' }
            }
          }),
          'converted'
        )

        const converted = graph.nodes.find(
          (node) => node.type === 'WidgetInputNode'
        )
        expect(converted?.inputs?.[0].name).toBe('strength')
        expect(converted?.inputs?.[0].link).not.toBeNull()
        expect(widgetCallback).not.toHaveBeenCalled()
      } finally {
        LiteGraph.unregisterNodeType('WidgetInputNode')
        LiteGraph.unregisterNodeType('SourceNode')
        LiteGraph.unregisterNodeType('NoInputNode')
      }
    })

    it('continues when widget-to-input conversion throws', () => {
      class ThrowingWidgetNode extends LGraphNode {
        constructor(title?: string) {
          super('ThrowingWidgetNode', title)
          this.addWidget('number', 'strength', 0, () => {})
        }

        convertWidgetToInput = () => {
          throw new Error('cannot convert')
        }
      }
      class SourceNode extends LGraphNode {
        constructor(title?: string) {
          super('ThrowingSourceNode', title)
          this.addOutput('value', 'number')
        }
      }
      LiteGraph.registerNodeType('ThrowingWidgetNode', ThrowingWidgetNode)
      LiteGraph.registerNodeType('ThrowingSourceNode', SourceNode)
      const graph = new LGraph()
      Reflect.set(singletonApp, 'rootGraphInternal', graph)

      try {
        singletonApp.loadApiJson(
          {
            1: {
              class_type: 'ThrowingSourceNode',
              inputs: {},
              _meta: { title: 'ThrowingSourceNode' }
            },
            2: {
              class_type: 'ThrowingWidgetNode',
              inputs: {
                strength: [1, 0]
              },
              _meta: { title: 'ThrowingWidgetNode' }
            }
          },
          'conversion-failed'
        )

        const target = graph.nodes.find(
          (node) => node.type === 'ThrowingWidgetNode'
        )
        expect(target?.inputs).toHaveLength(0)
      } finally {
        LiteGraph.unregisterNodeType('ThrowingWidgetNode')
        LiteGraph.unregisterNodeType('ThrowingSourceNode')
      }
    })
  })

  describe('handleFile', () => {
    it('should handle image files by creating LoadImage node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

      const mockNode = createMockNode()
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const imageFile = createTestFile('test.png', 'image/png')

      await app.handleFile(imageFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadImage')
      expect(pasteImageNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })

    it('should handle audio files by creating LoadAudio node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

      const mockNode = createMockNode({ type: 'LoadAudio' })
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const audioFile = createTestFile('test.mp3', 'audio/mpeg')

      await app.handleFile(audioFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadAudio')
      expect(pasteAudioNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })

    it('should handle video files by creating LoadVideo node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

      const mockNode = createMockNode({ type: 'LoadVideo' })
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const videoFile = createTestFile('test.mp4', 'video/mp4')

      await app.handleFile(videoFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadVideo')
      expect(pasteVideoNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })

    it('should handle image files with non-workflow metadata by creating LoadImage node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        Software: 'gnome-screenshot'
      })

      const mockNode = createMockNode()
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const imageFile = createTestFile('screenshot.png', 'image/png')

      await app.handleFile(imageFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadImage')
      expect(pasteImageNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })

    it('loads workflow metadata and preserves the open source options', async () => {
      const workflow = createWorkflowGraphData()
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        workflow: JSON.stringify(workflow)
      })
      const loadGraphData = vi
        .spyOn(app, 'loadGraphData')
        .mockResolvedValue(undefined)

      await app.handleFile(
        createTestFile('review.workflow.png', 'image/png'),
        'file_drop',
        {
          deferWarnings: true
        }
      )

      expect(loadGraphData).toHaveBeenCalledWith(
        workflow,
        true,
        true,
        'review.workflow',
        { openSource: 'file_drop', deferWarnings: true }
      )
    })

    it('falls back to parameters when workflow metadata is invalid', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.spyOn(graph, 'serialize').mockReturnValue(
        fromPartial<ISerialisedGraph>({
          nodes: [],
          links: [],
          groups: [],
          version: 0.4
        })
      )
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        workflow: '[]',
        parameters: 'Steps: 12'
      })
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await app.handleFile(createTestFile('invalid-workflow.png', 'image/png'))

      expect(mockToastStore.addAlert).toHaveBeenCalled()
      expect(importA1111).toHaveBeenCalledWith(graph, 'Steps: 12')
      expect(mockWorkflowService.afterLoadNewGraph).toHaveBeenCalledWith(
        'invalid-workflow',
        expect.any(Object)
      )
    })

    it('loads template metadata and object workflow payloads', async () => {
      const workflow = createWorkflowGraphData()
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        templates: [{ name: 'Starter', data: '{"nodes":[]}' }],
        workflow
      })
      const loadTemplateData = vi.spyOn(app, 'loadTemplateData')
      const loadGraphData = vi
        .spyOn(app, 'loadGraphData')
        .mockResolvedValue(undefined)

      await app.handleFile(createTestFile('template.png', 'image/png'))

      expect(loadTemplateData).toHaveBeenCalledWith({
        templates: [{ name: 'Starter', data: '{"nodes":[]}' }]
      })
      expect(loadGraphData).toHaveBeenCalledWith(
        workflow,
        true,
        true,
        'template',
        { openSource: undefined, deferWarnings: undefined }
      )
    })

    it('loads API prompt metadata before falling back to parameters', async () => {
      const prompt: ComfyApiWorkflow = {
        '1': {
          class_type: 'PreviewAny',
          inputs: {},
          _meta: { title: 'Preview' }
        }
      }
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        prompt: JSON.stringify(prompt),
        parameters: 'ignored fallback'
      })
      const loadApiJson = vi
        .spyOn(app, 'loadApiJson')
        .mockImplementation(() => undefined)

      await app.handleFile(createTestFile('prompt.png', 'image/png'))

      expect(loadApiJson).toHaveBeenCalledWith(prompt, 'prompt')
      expect(importA1111).not.toHaveBeenCalled()
    })

    it('loads object API prompt metadata', async () => {
      const prompt: ComfyApiWorkflow = {
        '1': {
          class_type: 'PreviewAny',
          inputs: {},
          _meta: { title: 'PreviewAny' }
        }
      }
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({ prompt })
      const loadApiJson = vi
        .spyOn(app, 'loadApiJson')
        .mockImplementation(() => undefined)

      await app.handleFile(createTestFile('prompt-object.png', 'image/png'))

      expect(loadApiJson).toHaveBeenCalledWith(prompt, 'prompt-object')
    })

    it('falls back to parameters when prompt metadata cannot be parsed', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.spyOn(graph, 'serialize').mockReturnValue(
        fromPartial<ISerialisedGraph>({
          nodes: [],
          links: [],
          groups: [],
          version: 0.4
        })
      )
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        prompt: '{',
        parameters: 'Steps: 6'
      })
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await app.handleFile(createTestFile('bad-prompt.png', 'image/png'))

      expect(importA1111).toHaveBeenCalledWith(graph, 'Steps: 6')
      expect(mockWorkflowService.afterLoadNewGraph).toHaveBeenCalledWith(
        'bad-prompt',
        expect.any(Object)
      )
    })

    it('imports A1111 parameters as the final metadata fallback', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        parameters: 'Steps: 20'
      })

      await app.handleFile(createTestFile('parameters.png', 'image/png'))

      expect(importA1111).toHaveBeenCalledWith(graph, 'Steps: 20')
      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalled()
      expect(mockWorkflowService.afterLoadNewGraph).toHaveBeenCalledWith(
        'parameters',
        expect.any(Object)
      )
    })

    it('shows a load error for unsupported files without metadata', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

      await app.handleFile(createTestFile('notes.pdf', 'application/pdf'))

      expect(mockToastStore.addAlert).toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })
  })

  describe('drop handler', () => {
    it('syncs graph_mouse and routes mixed file drops by media type', async () => {
      const graphMouse: [number, number] = [-999, -999]
      const adjustMouseEvent = vi.fn((e: DragEvent) => {
        ;(e as DragEvent & { canvasX: number; canvasY: number }).canvasX = 123
        ;(e as DragEvent & { canvasX: number; canvasY: number }).canvasY = 456
      })
      app.canvas = createMockCanvas({
        ...mockCanvas,
        graph_mouse: graphMouse,
        adjustMouseEvent
      })
      const image = createTestFile('image.png', 'image/png')
      const audio = createTestFile('audio.wav', 'audio/wav')
      const video = createTestFile('video.mp4', 'video/mp4')
      const workflow = createTestFile('workflow.json', 'application/json')
      mockExtractFilesFromDragEvent.mockResolvedValue([
        image,
        audio,
        video,
        workflow
      ])
      vi.spyOn(app, 'handleFileList').mockResolvedValue(undefined)
      vi.spyOn(app, 'handleAudioFileList').mockResolvedValue(undefined)
      vi.spyOn(app, 'handleVideoFileList').mockResolvedValue(undefined)
      vi.spyOn(app, 'handleFile').mockResolvedValue(undefined)

      privateApi(app).addDropHandler()

      document.dispatchEvent(new DragEvent('drop'))
      await flushDropHandler()

      expect(adjustMouseEvent).toHaveBeenCalledTimes(1)
      expect(graphMouse).toEqual([123, 456])
      expect(app.handleFileList).toHaveBeenCalledWith([image])
      expect(app.handleAudioFileList).toHaveBeenCalledWith([audio])
      expect(app.handleVideoFileList).toHaveBeenCalledWith([video])
      expect(app.handleFile).toHaveBeenCalledWith(workflow, 'file_drop', {
        deferWarnings: true
      })
      expect(mockWorkspaceStore.spinner).toBe(false)
      expect(mockWorkflowService.showPendingWarnings).toHaveBeenCalled()
    })

    it('routes multi-image drops without requiring every media type', async () => {
      app.canvas = createMockCanvas({
        ...mockCanvas,
        graph_mouse: [0, 0],
        adjustMouseEvent: vi.fn((event: DragEvent) => {
          ;(event as DragEvent & { canvasX: number; canvasY: number }).canvasX =
            3
          ;(event as DragEvent & { canvasY: number }).canvasY = 4
        })
      })
      const first = createTestFile('first.png', 'image/png')
      const second = createTestFile('second.png', 'image/png')
      const workflow = createTestFile('workflow.json', 'application/json')
      mockExtractFilesFromDragEvent.mockResolvedValue([first, second, workflow])
      vi.spyOn(app, 'handleFileList').mockResolvedValue(undefined)
      vi.spyOn(app, 'handleAudioFileList').mockResolvedValue(undefined)
      vi.spyOn(app, 'handleVideoFileList').mockResolvedValue(undefined)
      vi.spyOn(app, 'handleFile').mockResolvedValue(undefined)

      privateApi(app).addDropHandler()
      document.dispatchEvent(new DragEvent('drop'))
      await flushDropHandler()

      expect(app.handleFileList).toHaveBeenCalledWith([first, second])
      expect(app.handleAudioFileList).not.toHaveBeenCalled()
      expect(app.handleVideoFileList).not.toHaveBeenCalled()
      expect(app.handleFile).toHaveBeenCalledWith(workflow, 'file_drop', {
        deferWarnings: true
      })
    })

    it('routes a single dropped file through handleFile', async () => {
      const workflow = createTestFile('workflow.json', 'application/json')
      app.canvas = createMockCanvas({
        ...mockCanvas,
        graph_mouse: [0, 0],
        adjustMouseEvent: vi.fn((event: DragEvent) => {
          ;(event as DragEvent & { canvasX: number; canvasY: number }).canvasX =
            1
          ;(event as DragEvent & { canvasY: number }).canvasY = 2
        })
      })
      mockExtractFilesFromDragEvent.mockResolvedValue([workflow])
      const handleFile = vi.spyOn(app, 'handleFile').mockResolvedValue()

      privateApi(app).addDropHandler()
      document.dispatchEvent(new DragEvent('drop'))
      await flushDropHandler()

      expect(handleFile).toHaveBeenCalledWith(workflow, 'file_drop', {
        deferWarnings: true
      })
      expect(mockWorkspaceStore.spinner).toBe(false)
    })

    it('does not start loading when the drop contains no files', async () => {
      app.canvas = createMockCanvas({
        ...mockCanvas,
        graph_mouse: [0, 0],
        adjustMouseEvent: vi.fn()
      })
      mockExtractFilesFromDragEvent.mockResolvedValue([])
      const handleFile = vi.spyOn(app, 'handleFile').mockResolvedValue()

      privateApi(app).addDropHandler()
      document.dispatchEvent(new DragEvent('drop'))
      await flushDropHandler()

      expect(handleFile).not.toHaveBeenCalled()
      expect(mockWorkspaceStore.spinner).toBe(false)
    })

    it('surfaces drop routing failures', async () => {
      app.canvas = createMockCanvas({
        ...mockCanvas,
        graph_mouse: [0, 0],
        adjustMouseEvent: vi.fn()
      })
      mockExtractFilesFromDragEvent.mockRejectedValue(new Error('drop failed'))

      privateApi(app).addDropHandler()
      document.dispatchEvent(new DragEvent('drop'))
      await flushDropHandler()

      expect(mockToastStore.addAlert).toHaveBeenLastCalledWith(
        expect.stringContaining('drop failed')
      )
    })

    it('ignores drops that were already handled by nested targets', async () => {
      const handleFile = vi.spyOn(app, 'handleFile').mockResolvedValue()
      privateApi(app).addDropHandler()

      const event = new DragEvent('drop', { cancelable: true })
      event.preventDefault()
      document.dispatchEvent(event)
      await flushDropHandler()

      expect(handleFile).not.toHaveBeenCalled()
    })

    it('lets the hovered node consume a file drop before app routing', async () => {
      const dragOverNode = {
        id: toNodeId(1),
        onDragDrop: vi.fn().mockResolvedValue(true)
      }
      app.dragOverNode = dragOverNode
      app.canvas = createMockCanvas({
        ...mockCanvas,
        graph_mouse: [0, 0],
        adjustMouseEvent: vi.fn((event: DragEvent) => {
          ;(event as DragEvent & { canvasX: number; canvasY: number }).canvasX =
            12
          ;(event as DragEvent & { canvasY: number }).canvasY = 34
        })
      })
      const handleFile = vi.spyOn(app, 'handleFile').mockResolvedValue()

      privateApi(app).addDropHandler()
      document.dispatchEvent(new DragEvent('drop'))
      await flushDropHandler()

      expect(dragOverNode.onDragDrop).toHaveBeenCalled()
      expect(app.dragOverNode).toBeNull()
      expect(handleFile).not.toHaveBeenCalled()
    })

    it('clears hover state on drag leave and updates it on drag over', async () => {
      const canvasEl = document.createElement('canvas')
      app.canvasElRef.value = canvasEl
      const hoveredNode = {
        id: 3,
        onDragOver: vi.fn(() => true)
      }
      const graph = {
        getNodeOnPos: vi.fn(() => hoveredNode)
      }
      const setDirty = vi.fn()
      app.canvas = createMockCanvas({
        ...mockCanvas,
        graph,
        setDirty,
        adjustMouseEvent: vi.fn((event: DragEvent) => {
          ;(event as DragEvent & { canvasX: number; canvasY: number }).canvasX =
            7
          ;(event as DragEvent & { canvasY: number }).canvasY = 8
        })
      })
      const requestAnimationFrame = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback: FrameRequestCallback) => {
          callback(0)
          return 1
        })

      privateApi(app).addDropHandler()
      canvasEl.dispatchEvent(new DragEvent('dragover'))
      canvasEl.dispatchEvent(new DragEvent('dragleave'))

      expect(graph.getNodeOnPos).toHaveBeenCalledWith(7, 8)
      expect(app.dragOverNode).toBeNull()
      expect(setDirty).toHaveBeenCalledWith(false, true)
      expect(requestAnimationFrame).toHaveBeenCalled()
    })

    it('clears hover state when the node rejects drag over', () => {
      const canvasEl = document.createElement('canvas')
      app.canvasElRef.value = canvasEl
      app.dragOverNode = {
        id: toNodeId(4)
      }
      app.canvas = createMockCanvas({
        ...mockCanvas,
        graph: {
          getNodeOnPos: vi.fn(() => ({
            id: 5,
            onDragOver: vi.fn(() => false)
          }))
        },
        adjustMouseEvent: vi.fn((event: DragEvent) => {
          ;(event as DragEvent & { canvasX: number; canvasY: number }).canvasX =
            1
          ;(event as DragEvent & { canvasY: number }).canvasY = 2
        })
      })

      privateApi(app).addDropHandler()
      canvasEl.dispatchEvent(new DragEvent('dragover'))

      expect(app.dragOverNode).toBeNull()
    })

    it('ignores drag leave when no node is hovered', () => {
      const canvasEl = document.createElement('canvas')
      app.canvasElRef.value = canvasEl
      app.dragOverNode = null

      privateApi(app).addDropHandler()
      canvasEl.dispatchEvent(new DragEvent('dragleave'))

      expect(mockCanvas.setDirty).not.toHaveBeenCalled()
    })
  })

  describe('process key handler', () => {
    it('ignores events without a graph or from inputs and falls back for unbound keys', () => {
      const originalProcessKey = LGraphCanvas.prototype.processKey
      const fallback = vi.fn()
      LGraphCanvas.prototype.processKey = fallback
      privateApi(app).addProcessKeyHandler()
      const processKey = LGraphCanvas.prototype.processKey
      const graph = { change: vi.fn() }
      const canvas = createMockCanvas({ graph })
      const inputEvent = new KeyboardEvent('keydown', { key: 'a' })
      Object.defineProperty(inputEvent, 'target', {
        configurable: true,
        value: document.createElement('input')
      })
      const unboundEvent = new KeyboardEvent('keyup', { key: 'a' })

      try {
        processKey.call(createMockCanvas({ graph: null }), unboundEvent)
        processKey.call(canvas, inputEvent)
        processKey.call(canvas, unboundEvent)

        expect(fallback).toHaveBeenCalledTimes(1)
        expect(graph.change).not.toHaveBeenCalled()
      } finally {
        LGraphCanvas.prototype.processKey = originalProcessKey
      }
    })

    it('executes graph-canvas keybindings and suppresses litegraph fallback', () => {
      const originalProcessKey = LGraphCanvas.prototype.processKey
      const fallback = vi.fn()
      LGraphCanvas.prototype.processKey = fallback
      const execute = vi
        .spyOn(useCommandStore(), 'execute')
        .mockResolvedValue(undefined)
      vi.spyOn(useKeybindingStore(), 'getKeybinding').mockReturnValue({
        commandId: 'test.command',
        targetElementId: 'graph-canvas-container'
      } as ReturnType<ReturnType<typeof useKeybindingStore>['getKeybinding']>)
      privateApi(app).addProcessKeyHandler()
      const event = new KeyboardEvent('keydown', { key: 'a' })
      const preventDefault = vi.spyOn(event, 'preventDefault')
      const stopImmediatePropagation = vi.spyOn(
        event,
        'stopImmediatePropagation'
      )
      const graph = { change: vi.fn() }

      try {
        LGraphCanvas.prototype.processKey.call(
          createMockCanvas({ graph }),
          event
        )

        expect(execute).toHaveBeenCalledWith('test.command')
        expect(graph.change).toHaveBeenCalled()
        expect(preventDefault).toHaveBeenCalled()
        expect(stopImmediatePropagation).toHaveBeenCalled()
        expect(fallback).not.toHaveBeenCalled()
      } finally {
        LGraphCanvas.prototype.processKey = originalProcessKey
      }
    })
  })

  describe('clean and coordinate conversion', () => {
    it('clears the root graph when the canvas is not inside a subgraph', () => {
      const rootGraph = new LGraph()
      const clear = vi.spyOn(rootGraph, 'clear')
      Reflect.set(app, 'rootGraphInternal', rootGraph)
      app.canvas = createMockCanvas({
        ...mockCanvas,
        subgraph: null
      })

      app.clean()

      expect(mockNodeOutputStore.resetAllOutputsAndPreviews).toHaveBeenCalled()
      expect(useExecutionErrorStore().lastNodeErrors).toBeNull()
      expect(clear).toHaveBeenCalled()
    })

    it('preserves the root graph when the canvas is inside a subgraph', () => {
      const rootGraph = new LGraph()
      const clear = vi.spyOn(rootGraph, 'clear')
      Reflect.set(app, 'rootGraphInternal', rootGraph)
      app.canvas = createMockCanvas({
        ...mockCanvas,
        subgraph: new LGraph()
      })

      app.clean()

      expect(clear).not.toHaveBeenCalled()
    })

    it('throws before coordinate conversion is initialized', () => {
      expect(() => app.clientPosToCanvasPos([1, 2])).toThrow(
        'clientPosToCanvasPos called before setup'
      )
      expect(() => app.canvasPosToClientPos([1, 2])).toThrow(
        'canvasPosToClientPos called before setup'
      )
    })

    it('delegates coordinate conversion after setup initializes it', () => {
      Reflect.set(app, 'positionConversion', {
        clientPosToCanvasPos: vi.fn(() => [3, 4]),
        canvasPosToClientPos: vi.fn(() => [5, 6])
      })

      expect(app.clientPosToCanvasPos([1, 2])).toEqual([3, 4])
      expect(app.canvasPosToClientPos([1, 2])).toEqual([5, 6])
    })
  })

  describe('API update handlers', () => {
    it('routes socket events into app stores, dialogs, and canvas refreshes', () => {
      vi.restoreAllMocks()
      vi.spyOn(api, 'init').mockImplementation(() => undefined)
      const graph = new LGraph()
      const node = new LGraphNode('PreviewAny', 'PreviewAny')
      node.id = toNodeId(7)
      node.onExecuted = vi.fn()
      graph.add(node)
      Reflect.set(app, 'rootGraphInternal', graph)
      const setStatus = vi.spyOn(app.ui, 'setStatus')

      privateApi(app).addApiUpdateHandlers()

      ;(api as EventTarget).dispatchEvent(
        new CustomEvent('status', {
          detail: { exec_info: { queue_remaining: 1 } }
        })
      )
      ;(api as EventTarget).dispatchEvent(new CustomEvent('progress'))
      ;(api as EventTarget).dispatchEvent(new CustomEvent('executing'))
      ;(api as EventTarget).dispatchEvent(
        new CustomEvent('executed', {
          detail: {
            display_node: 7,
            output: { images: [{ filename: 'preview.png' }] },
            merge: true
          }
        })
      )

      expect(setStatus).toHaveBeenCalledWith({
        exec_info: { queue_remaining: 1 }
      })
      expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, false)
      expect(mockNodeOutputStore.setNodeOutputsByExecutionId).toHaveBeenCalled()
      expect(node.onExecuted).toHaveBeenCalledWith({
        images: [{ filename: 'preview.png' }]
      })

      ;(api as EventTarget).dispatchEvent(
        new CustomEvent('executed', {
          detail: {
            node: 7,
            output: { text: ['fallback'] }
          }
        })
      )
      expect(
        mockNodeOutputStore.setNodeOutputsByExecutionId
      ).toHaveBeenCalledWith('7', { text: ['fallback'] }, { merge: undefined })

      ;(api as EventTarget).dispatchEvent(
        new CustomEvent('executed', {
          detail: {
            display_node: '',
            node: '',
            output: { text: ['ignored'] }
          }
        })
      )
      expect(
        mockNodeOutputStore.setNodeOutputsByExecutionId
      ).not.toHaveBeenCalledWith(
        expect.anything(),
        { text: ['ignored'] },
        expect.anything()
      )

      const precondition = { code: 'credits_required' }
      mockResolveAccountPrecondition.mockReturnValueOnce(precondition)
      ;(api as EventTarget).dispatchEvent(
        new CustomEvent('execution_error', {
          detail: {
            exception_type: 'credits_required',
            exception_message: 'Credits required',
            node_type: 'CreditNode'
          }
        })
      )
      expect(mockAccountPreconditionDialog.open).toHaveBeenCalledWith(
        precondition,
        { nodeType: 'CreditNode' }
      )

      ;(api as EventTarget).dispatchEvent(
        new CustomEvent('execution_error', {
          detail: {
            exception_type: 'runtime_error',
            exception_message: 'Failed'
          }
        })
      )
      expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)

      mockSettingStore.get.mockReturnValue(false)
      ;(api as EventTarget).dispatchEvent(
        new CustomEvent('execution_error', {
          detail: {
            exception_type: 'runtime_error',
            exception_message: 'Still failed'
          }
        })
      )
      expect(mockDialogService.showExecutionErrorDialog).toHaveBeenCalledWith({
        exception_type: 'runtime_error',
        exception_message: 'Still failed'
      })

      ;(api as EventTarget).dispatchEvent(
        new CustomEvent('execution_error', {
          detail: {}
        })
      )
      expect(mockDialogService.showExecutionErrorDialog).toHaveBeenCalledWith(
        {}
      )

      ;(api as EventTarget).dispatchEvent(
        new CustomEvent('b_preview_with_metadata', {
          detail: {
            blob: new Blob(),
            displayNodeId: '',
            jobId: 'job-1'
          }
        })
      )
      expect(
        mockNodeOutputStore.revokePreviewsByExecutionId
      ).not.toHaveBeenCalled()

      const objectUrl = 'blob:preview'
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(objectUrl)
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
      ;(api as EventTarget).dispatchEvent(
        new CustomEvent('b_preview_with_metadata', {
          detail: {
            blob: new Blob(),
            displayNodeId: '7',
            jobId: 'job-2'
          }
        })
      )
      expect(mockNodeOutputStore.revokePreviewsByExecutionId).toHaveBeenCalled()
      expect(
        mockNodeOutputStore.setNodePreviewsByExecutionId
      ).toHaveBeenCalled()

      ;(api as EventTarget).dispatchEvent(new CustomEvent('feature_flags'))
      expect(mockNodeReplacementStore.load).toHaveBeenCalled()
      expect(mockCanvas.draw).toHaveBeenCalledWith(true, true)
    })
  })
})
