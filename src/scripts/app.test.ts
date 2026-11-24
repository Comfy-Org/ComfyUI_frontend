import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { attachLegacyUI } from '@/core/legacyUI/attachLegacyUI'
import { ComfyApp, app as singletonApp } from './app'
import { useToast } from '@/components/ui/toast/toastStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useAuthStore } from '@/stores/authStore'
import {
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { effectScope, markRaw, nextTick, ref } from 'vue'
import { useLitegraphService } from '@/services/litegraphService'
import { useSubgraphService } from '@/services/subgraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { transformInputSpecV1ToV2 } from '@comfyorg/object-info-parser/migration'

vi.mock(import('@vueuse/router'), () => ({ useRouteHash: () => ref('') }))

import { addAutogrow } from '@/core/graph/widgets/__fixtures__/dynamicInputHelpers'
import type { CurveData } from '@comfyorg/graph-model/curve'
import type { useExtensionService } from '@/platform/extensions/services/extensionService'
import { isGraphLoadHookOrigin } from '@/platform/extensions/services/extensionService'
import { t } from '@/i18n'
import { onGraphIntent } from '@/lib/litegraph/src/graphIntents'
import type { GraphIntentEvent } from '@/lib/litegraph/src/graphIntents'
import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import * as keybindingServiceModule from '@/platform/keybindings/keybindingService'
import type { SerialisableGraph } from '@comfyorg/graph-model/serialisation'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@comfyorg/graph-model/workflowSchema'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { getDefaultWorkflow } from '@/platform/workflow/core/services/defaultWorkflowService'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { useWorkflowValidation } from '@/platform/workflow/validation/composables/useWorkflowValidation'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'
import { ChangeTracker } from '@/scripts/changeTracker'
import { beginChangeCaptureSuppression } from '@/services/changeCaptureSuppression'
import {
  isCanvasOwner,
  bindCanvasTracker
} from '@/platform/workflow/core/canvasTrackerOwnership'
import { isGraphLoading } from '@/core/graph/graphLoadState'
import {
  createTestCanvas,
  createMockCanvasRenderingContext2D,
  createTestCanvasElement,
  createTestDragAndScale,
  setCanvasVisible
} from '@/utils/__tests__/canvasTestUtils'
import { useDeprecatedNodesStore } from '@/platform/workflowErrors/nodeReplacement/deprecatedNodesStore'
import { useNodeReplacementStore } from '@/platform/workflowErrors/nodeReplacement/nodeReplacementStore'
import { useNodeReplacement } from '@/platform/workflowErrors/nodeReplacement/useNodeReplacement'
import type { NodeReplacement } from '@/platform/workflowErrors/nodeReplacement/types'
import type { NodeExecutionOutput } from '@comfyorg/api-client/executionTypes'
import type { NodeError } from '@comfyorg/api-client/types'
import * as litegraphUtil from '@/utils/litegraphUtil'
import { createNode } from '@/utils/createNode'
import { executeWidgetsCallback } from '@/utils/litegraphUtil'
import { graphToPrompt } from '@/utils/executionUtil'
import { applyTextReplacements } from '@/utils/searchAndReplace'
import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import {
  pasteAudioNode,
  pasteAudioNodes,
  pasteImageNode,
  pasteImageNodes,
  pasteVideoNode,
  pasteVideoNodes
} from '@/renderer/core/clipboard/mediaClipboard'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { useComfyApiStore } from '@/platform/nodeApi/v4/comfyApiStore'
import { bindMountedNodeSize } from '@/renderer/core/layout/store/mountedNodeSizes'
import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import {
  hostNodeDef,
  registerHostType
} from '@/platform/nodeApi/v4/defs/__fixtures__/hostNodeTypes'
import {
  addBackendNode,
  addNodeOfType
} from '@/platform/nodeApi/v4/execution/__fixtures__/promptGraphs'
import type {
  Comfy,
  NodeCreatedEvent,
  NodeHandle,
  WidgetCollection,
  WidgetHandle
} from '@/platform/nodeApi/v4/types'
import { runMissingModelPipeline } from '@/platform/workflowErrors/missingModel/missingModelPipeline'
import * as missingMediaPipeline from '@/platform/workflowErrors/missingMedia/missingMediaPipeline'
import * as missingMediaScan from '@/platform/workflowErrors/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import type { MissingMediaCandidate } from '@/platform/workflowErrors/missingMedia/types'
import { createMissingMediaCandidate } from '@/platform/workflowErrors/missingMedia/__fixtures__/promotedMedia'
import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { installErrorClearingHooks } from '@/composables/graph/useErrorClearingHooks'
import { setTelemetryRegistry } from '@comfyorg/telemetry'
import { TelemetryRegistry } from '@comfyorg/telemetry/TelemetryRegistry'
import * as executionContextUtils from '@/platform/telemetry/utils/getExecutionContext'
import { isCloud } from '@/platform/distribution/types'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'

import { PromptExecutionError } from '@comfyorg/api-client/ComfyApi'
import { api } from '@/scripts/api'
import { useApp as useAppInstance } from '@/scripts/appInstance'
import { useApp } from '@/scripts/appRegistry'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useJobModelDownloadStore } from '@/stores/jobModelDownloadStore'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useDialogStore } from '@/stores/dialogStore'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'
import { createNodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphData,
  createTestSubgraphNode,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { MIME_ASSET_INFO } from '@/platform/assets/constants/assetDrag'
import { extractFilesFromDragEvent } from '@/platform/assets/integration/assetDrop'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useCanvasScheduler } from '@/renderer/core/canvas/useCanvasScheduler'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { zeroUuid } from '@comfyorg/graph-model/uuid'
import { graphsAwaitingNodeTypes } from '@/platform/customNodes/lateLoading/lateNodeTypes'
import type { importA1111 } from './pnginfo'
import {
  registerPublishedTestPack,
  registerTestPack
} from '@/platform/nodeApi/v4/__tests__/testPack'

type WorkflowService = ReturnType<typeof useWorkflowService>
type WorkflowValidation = ReturnType<typeof useWorkflowValidation>

vi.mock(import('firebase/auth'))

const {
  mockExtensionService,
  mockRefreshMissingModelPipeline,
  mockImportA1111,
  mockWorkflowService,
  mockValidateWorkflow
} = vi.hoisted(() => ({
  mockExtensionService: {
    registerExtension: vi.fn(),
    invokeExtensions: vi.fn(),
    invokeExtensionsAsync: vi.fn()
  },
  mockRefreshMissingModelPipeline: vi.fn(),
  mockImportA1111: vi.fn<typeof importA1111>(),
  mockWorkflowService: {
    beforeLoadNewGraph: vi.fn<WorkflowService['beforeLoadNewGraph']>(),
    afterLoadNewGraph: vi.fn<WorkflowService['afterLoadNewGraph']>(),
    showPendingWarnings: vi.fn<WorkflowService['showPendingWarnings']>(),
    restoreRetainedWorkflow: vi.fn<WorkflowService['restoreRetainedWorkflow']>()
  },
  mockValidateWorkflow: vi.fn<WorkflowValidation['validateWorkflow']>()
}))

vi.mock(import('@/platform/billing/composables/useBillingDialogs'))

vi.mock(
  import('@/platform/workflow/validation/composables/useWorkflowValidation'),
  () => ({
    useWorkflowValidation: () =>
      fromPartial<WorkflowValidation>({
        validateWorkflow: mockValidateWorkflow
      })
  })
)

vi.mock(import('@/utils/litegraphUtil'), { spy: true })
vi.mock(import('@/utils/createNode'), { spy: true })

vi.mock(import('@/renderer/core/clipboard/mediaClipboard'), () => ({
  pasteAudioNode: vi.fn(),
  pasteAudioNodes: vi.fn(),
  pasteImageNode: vi.fn(),
  pasteImageNodes: vi.fn(),
  pasteVideoNode: vi.fn(),
  pasteVideoNodes: vi.fn()
}))

vi.mock(import('@/scripts/metadata/parser'), () => ({
  getWorkflowDataFromFile: vi.fn()
}))

vi.mock(import('@/platform/assets/integration/assetDrop'), { spy: true })
vi.mock(import('@/scripts/appInstance'), () => ({ useApp: vi.fn() }))

vi.mock(import('@comfyorg/telemetry/reportError'), { spy: true })

vi.mock(import('./pnginfo'), () => ({
  importA1111: mockImportA1111
}))

vi.mock(import('@/platform/workflow/core/services/defaultWorkflowService'), {
  spy: true
})
vi.mock(import('@/platform/workflow/core/services/workflowService'), {
  spy: true
})

vi.mock(import('@/extensions/core/load3d/Load3dUtils'), () => ({
  default: fromAny({
    uploadFile: vi.fn()
  })
}))

vi.mock(import('@/platform/extensions/services/extensionService'), () => ({
  isGraphLoadHookOrigin: vi.fn(() => false),
  useExtensionService: vi.fn(() =>
    fromPartial<ReturnType<typeof useExtensionService>>(mockExtensionService)
  )
}))

vi.mock(
  import('@/platform/workflowErrors/missingModel/missingModelPipeline'),
  () => ({
    refreshMissingModelPipeline: mockRefreshMissingModelPipeline,
    runMissingModelPipeline: vi.fn()
  })
)

function createMockNode(
  options: Partial<Record<keyof LGraphNode, unknown>> = {}
) {
  return {
    id: 1,
    pos: [0, 0],
    size: [200, 100],
    type: 'LoadImage',
    connect: vi.fn(),
    getBounding: vi.fn(() => new Float64Array([0, 0, 200, 100])),
    ...options
  } as LGraphNode
}

function createMockCanvas(): Partial<LGraphCanvas> {
  const mockGraph: Partial<LGraph> = {
    change: vi.fn()
  }

  return {
    graph: mockGraph as LGraph,
    draw: vi.fn(),
    selectItems: vi.fn(),
    setDirty: vi.fn(),
    setGraph: vi.fn()
  }
}

function createTestFile(name: string, type: string): File {
  return new File([''], name, { type })
}

/**
 * Point the workflowService mock at the real implementation for tests that
 * exercise the load lifecycle itself rather than app.ts's calls into it.
 */
async function useRealWorkflowService(): Promise<WorkflowService> {
  vi.mocked(useWorkflowService).mockRestore()
  const real = useWorkflowService()
  vi.mocked(useWorkflowService).mockReturnValue(
    fromPartial<WorkflowService>(mockWorkflowService)
  )
  mockWorkflowService.beforeLoadNewGraph.mockImplementation(
    real.beforeLoadNewGraph
  )
  mockWorkflowService.afterLoadNewGraph.mockImplementation(
    real.afterLoadNewGraph
  )
  mockWorkflowService.showPendingWarnings.mockImplementation(
    real.showPendingWarnings
  )
  mockWorkflowService.restoreRetainedWorkflow.mockImplementation(
    real.restoreRetainedWorkflow
  )
  return real
}

interface ShowGraph {
  app: ComfyApp
  service: WorkflowService
  retained: ComfyWorkflow
}

function markLoaded(workflow: ComfyWorkflow): LoadedComfyWorkflow {
  workflow.changeTracker = createMockChangeTracker()
  workflow.content = '{}'
  workflow.originalContent = '{}'
  return workflow as LoadedComfyWorkflow
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
  it('stacks imported templates vertically without browser storage', () => {
    const canvas = createTestCanvas(
      new LGraph(),
      createMockCanvasRenderingContext2D()
    )
    onTestFinished(() => canvas.unbindEvents())
    app.canvas = canvas
    canvas.graph_mouse[0] = 317
    canvas.graph_mouse[1] = 451
    const nodeType = 'test/stacked-template-import'
    LiteGraph.registerNodeType(nodeType, class extends LGraphNode {})
    onTestFinished(() => {
      delete LiteGraph.registered_node_types[nodeType]
    })
    const data = JSON.stringify({
      nodes: [
        {
          id: 7,
          type: nodeType,
          pos: [17, 23],
          size: [140, 80],
          flags: {},
          order: 0,
          mode: 0,
          properties: {}
        }
      ],
      reroutes: []
    })
    const blocked = () => {
      throw new DOMException('Storage is blocked', 'SecurityError')
    }
    const get = vi.spyOn(localStorage, 'getItem').mockImplementation(blocked)
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation(blocked)
    const remove = vi
      .spyOn(localStorage, 'removeItem')
      .mockImplementation(blocked)
    try {
      app.loadTemplateData({ templates: [{ data }, { data }] })
      expect(canvas.graph?.nodes.map((node) => Array.from(node.pos))).toEqual([
        [317, 451],
        [317, 581]
      ])
    } finally {
      get.mockRestore()
      set.mockRestore()
      remove.mockRestore()
    }
  })

  it('imports legacy template links by relative index rather than serialized node ID', () => {
    const graph = new LGraph()
    const sourceGraph = new LGraph()
    const source = createTestNode(sourceGraph, [], ['MODEL'])
    const target = createTestNode(sourceGraph, ['MODEL'], [])
    source.pos = [11, 17]
    target.pos = [211, 47]
    const canvas = createTestCanvas(graph, createMockCanvasRenderingContext2D())
    onTestFinished(() => canvas.unbindEvents())
    app.canvas = canvas
    canvas.graph_mouse[0] = 317
    canvas.graph_mouse[1] = 451
    const data = JSON.stringify({
      nodes: [
        { ...source.serialize(), id: 41 },
        { ...target.serialize(), id: 87 }
      ],
      links: [[0, 0, 1, 0]]
    })

    app.loadTemplateData({ templates: [{ data }] })

    expect(graph.nodes.map((node) => Array.from(node.pos))).toEqual([
      [317, 451],
      [517, 481]
    ])
    expect(graph.nodes[1].getInputNode(0)).toBe(graph.nodes[0])
  })

  it('applies extension paste overrides when the clipspace editor saves', () => {
    const node = new LGraphNode('original')
    const previousReturnNode = ComfyApp.clipspace_return_node
    onTestFinished(() => {
      ComfyApp.clipspace_return_node = previousReturnNode
    })
    ComfyApp.clipspace_return_node = node
    vi.spyOn(ComfyApp, 'pasteFromClipspace').mockImplementation((target) => {
      target.title = 'extension-edited'
    })

    ComfyApp.onClipspaceEditorSave()

    expect(node.title).toBe('extension-edited')
  })

  beforeEach(() => {
    vi.mocked(createNode).mockResolvedValue(null)
    vi.mocked(executeWidgetsCallback).mockImplementation(() => {})
    vi.mocked(useWorkflowService).mockReturnValue(
      fromPartial<WorkflowService>(mockWorkflowService)
    )
    mockWorkflowService.beforeLoadNewGraph.mockReturnValue(vi.fn())
    app = new ComfyApp()
    vi.mocked(useAppInstance).mockReturnValue(app)
    mockCanvas = createMockCanvas() as LGraphCanvas
    app.canvas = mockCanvas
    ChangeTracker.resetCanvasTrackerForTest()
    useWorkflowStore().activeWorkflow = null
    const temporaryWorkflow = new ComfyWorkflow({
      path: 'workflows/temporary.json',
      modified: 0,
      size: 0
    })
    vi.mocked(useWorkflowStore().createNewTemporary).mockReturnValue(
      temporaryWorkflow
    )
    vi.mocked(useWorkflowStore().openWorkflow).mockImplementation(
      async (workflow) => {
        useWorkflowStore().activeWorkflow = markLoaded(workflow)
        return markLoaded(workflow)
      }
    )
    vi.mocked(useApiKeyAuthStore().getApiKey).mockReturnValue(null)
    Object.assign(useApiKeyAuthStore(), { isAuthenticated: false })
    useAuthStore().currentUser = null
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(
      'workspace-token'
    )
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-a',
      workspaceTransitionGeneration: 0
    })
    vi.mocked(
      useTeamWorkspaceStore().waitForWorkspaceSwitch
    ).mockResolvedValue()
    mockExtensionService.invokeExtensions.mockReturnValue([])
    mockExtensionService.invokeExtensionsAsync.mockResolvedValue(undefined)
    vi.mocked(extractFilesFromDragEvent).mockResolvedValue([])
    mockImportA1111.mockResolvedValue('imported')
    mockWorkflowService.afterLoadNewGraph.mockResolvedValue()
    useSettingStore().settingValues['Comfy.RightSidePanel.ShowErrorsTab'] = true
    mockValidateWorkflow.mockReset().mockResolvedValue({ graphData: null })
    vi.mocked(useWorkflowStore().getWorkflowByPath).mockReturnValue(null)
    vi.mocked(useWorkflowStore().isActive).mockReturnValue(false)
    vi.mocked(useSubgraphNavigationStore().updateHash).mockResolvedValue(
      undefined
    )
    vi.mocked(
      useSubgraphNavigationStore().saveCurrentViewport
    ).mockImplementation(() => {})
    vi.mocked(useSubgraphNavigationStore().exportState).mockReturnValue([])
    vi.mocked(useSubgraphNavigationStore().restoreState).mockImplementation(
      () => {}
    )
  })

  it('registers the exported singleton for useApp', () => {
    expect(useApp()).toBe(singletonApp)
  })

  describe('loadGraphData', () => {
    function prepareResourceReload() {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      const store = useExecutionErrorStore()
      const graphId = '11111111-1111-4111-8111-111111111111'
      store.setActiveGraph(graphId)
      useMissingModelStore().setMissingModels([
        {
          nodeId: createNodeExecutionId([1]),
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'model.safetensors',
          isAssetSupported: false,
          isMissing: true
        }
      ])
      mockWorkflowService.afterLoadNewGraph.mockImplementation(async () => {
        store.setActiveGraph(graphId)
      })
      return store
    }

    it.for(['immediate', 'deferred', 'unverified', 'skipped'] as const)(
      'retires reloaded resource errors only after successful verification: %s',
      async (verification) => {
        const store = prepareResourceReload()
        const absorbed = validationError('value_not_in_list', 'ckpt_name', {
          received_value: 'model.safetensors'
        })
        const unrelated = validationError('required_input_missing', 'positive')
        store.recordNodeErrors({ '1': nodeError([absorbed, unrelated]) })

        let finishModels:
          | ((candidates: MissingModelCandidate[]) => void)
          | undefined
        let finishMedia:
          | ((candidates: MissingMediaCandidate[]) => void)
          | undefined
        vi.mocked(runMissingModelPipeline).mockImplementation(
          async ({ onVerified }) => {
            finishModels = onVerified
            if (verification === 'immediate') onVerified?.([])
            return {
              missingModels: [],
              confirmedCandidates: [],
              surfaced: Promise.resolve()
            }
          }
        )
        vi.spyOn(
          missingMediaPipeline,
          'runMissingMediaPipeline'
        ).mockImplementation(async ({ onVerified }) => {
          finishMedia = onVerified
          if (verification === 'immediate') onVerified?.([])
        })

        await app.loadGraphData(createWorkflowGraphData(), false, true, null, {
          skipAssetScans: verification === 'skipped'
        })

        if (verification === 'immediate') {
          expect(store.lastNodeErrors?.['1'].errors).toEqual([unrelated])
          return
        }
        expect(store.lastNodeErrors?.['1'].errors).toEqual([
          absorbed,
          unrelated
        ])
        if (verification !== 'deferred') return
        expect(finishModels).toBeTypeOf('function')
        expect(finishMedia).toBeTypeOf('function')
        finishModels?.([])
        expect(store.lastNodeErrors?.['1'].errors).toEqual([unrelated])
        finishMedia?.([])
        expect(store.lastNodeErrors?.['1'].errors).toEqual([unrelated])
      }
    )

    it('retires verified model errors while preserving errors from failed media verification', async () => {
      const store = prepareResourceReload()
      const media = createMissingMediaCandidate([toNodeId(2)], {
        name: 'portrait.png'
      })
      useMissingMediaStore().setMissingMedia([media])
      const mediaError = validationError('value_not_in_list', 'image', {
        received_value: 'portrait.png'
      })
      const unrelated = validationError('required_input_missing', 'positive')
      store.recordNodeErrors({
        '1': nodeError([
          validationError('value_not_in_list', 'ckpt_name', {
            received_value: 'model.safetensors'
          }),
          unrelated
        ]),
        '2': nodeError([mediaError])
      })

      vi.mocked(runMissingModelPipeline).mockImplementation(
        async ({ onVerified }) => {
          onVerified?.([])
          return {
            missingModels: [],
            confirmedCandidates: [],
            surfaced: Promise.resolve()
          }
        }
      )
      vi.spyOn(missingMediaScan, 'scanAllMediaCandidates').mockReturnValue([
        { ...media, isMissing: undefined }
      ])
      vi.spyOn(
        missingMediaScan,
        'isMissingMediaCandidateScopeActive'
      ).mockReturnValue(true)
      vi.spyOn(missingMediaScan, 'verifyMediaCandidates').mockRejectedValue(
        new Error('asset service unavailable')
      )

      await app.loadGraphData(createWorkflowGraphData(), false, true, null)

      await vi.waitFor(() => {
        expect(useToast().warning).toHaveBeenCalledWith(
          t('toastMessages.missingMediaVerificationFailed'),
          { duration: 5000 }
        )
      })
      expect(store.lastNodeErrors).toEqual({
        '1': nodeError([unrelated]),
        '2': nodeError([mediaError])
      })
    })

    it('offers to migrate legacy reroutes and dismisses the offer once migrated', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      const legacyReroute = {
        ...createWorkflowGraphData(),
        nodes: [
          {
            id: 1,
            type: 'Reroute',
            pos: [0, 0],
            size: [75, 26],
            flags: {},
            order: 0,
            mode: 0,
            properties: {}
          }
        ]
      } satisfies ComfyWorkflowJSON

      await app.loadGraphData(legacyReroute, false, true, null, {
        checkForRerouteMigration: true
      })
      const [offer] = useToast().toasts
      expect(offer).toEqual(
        expect.objectContaining({
          actions: [expect.objectContaining({ label: t('g.migrate') })],
          kind: 'warning',
          title: t('toastMessages.migrateToLitegraphReroute')
        })
      )
      const reload = vi.spyOn(app, 'loadGraphData').mockResolvedValue(true)

      await offer.actions[0]?.onClick()

      const [migrated] = reload.mock.calls[0]
      expect(migrated?.nodes.map((node) => node.type)).not.toContain('Reroute')
      expect(useToast().toasts).toEqual([])
    })

    it('replaces canvas ownership after preparing the outgoing workflow', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      mockWorkflowService.afterLoadNewGraph.mockResolvedValue()
      const replaceCanvas = vi.fn()
      mockWorkflowService.beforeLoadNewGraph.mockReturnValue(replaceCanvas)

      await app.loadGraphData(createWorkflowGraphData())

      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledOnce()
      expect(replaceCanvas).toHaveBeenCalledOnce()
      expect(
        mockWorkflowService.beforeLoadNewGraph.mock.invocationCallOrder[0]
      ).toBeLessThan(replaceCanvas.mock.invocationCallOrder[0])
    })

    it('waits for the beforeLoadGraph hook before replacing canvas ownership', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      mockWorkflowService.afterLoadNewGraph.mockResolvedValue()
      const replaceCanvas = vi.fn()
      mockWorkflowService.beforeLoadNewGraph.mockReturnValue(replaceCanvas)
      let finishHook = () => {}
      const hook = new Promise<void>((resolve) => {
        finishHook = resolve
      })
      mockExtensionService.invokeExtensionsAsync.mockImplementationOnce(
        async () => hook
      )

      const load = app.loadGraphData(createWorkflowGraphData())
      await vi.waitFor(() =>
        expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
          'beforeLoadGraph'
        )
      )

      expect(replaceCanvas).not.toHaveBeenCalled()

      finishHook()
      await load

      expect(replaceCanvas).toHaveBeenCalledOnce()
    })

    it('forwards clean and navigation intent to workflow navigation', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())

      await app.loadGraphData(createWorkflowGraphData(), false, true, null, {
        workflowNavigationId: 42
      })

      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledWith(false)
      expect(useSubgraphNavigationStore().updateHash).toHaveBeenCalledWith(
        'workflow-load',
        42
      )
    })
    it('suppresses the workflow reset for a default clean load', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())

      await app.loadGraphData(createWorkflowGraphData())

      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledWith(true)
      expect(useSubgraphNavigationStore().updateHash).toHaveBeenCalledWith(
        'workflow-load',
        undefined
      )
    })

    it('reports the load outcome explicitly: true on success', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())

      await expect(app.loadGraphData(createWorkflowGraphData())).resolves.toBe(
        true
      )
    })

    it('resolves false, not rejects, when graph configure fails', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.spyOn(graph, 'configure').mockImplementation(() => {
        throw new Error('bad workflow json')
      })
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      await expect(
        app.loadGraphData(createWorkflowGraphData(), false, true, null, {
          workflowNavigationId: 7
        })
      ).resolves.toBe(false)

      expect(showDialog).toHaveBeenCalledOnce()
      // The finally still repairs the URL even on the handled-failure path.
      expect(useSubgraphNavigationStore().updateHash).toHaveBeenCalledWith(
        'workflow-load',
        7
      )
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'onGraphLoadError',
        expect.objectContaining({ message: 'bad workflow json' })
      )
    })

    it('keeps the graph contents and awaiting node types when post-configure node resizing fails', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const workflow = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/reload.json',
          modified: 0,
          size: 0
        })
      )
      const graph = new LGraph()
      graph.add(new LGraphNode('existing'))
      workflow.adoptGraph(graph)
      useWorkflowStore().attachWorkflow(workflow)
      Reflect.set(app, 'rootGraphInternal', graph)
      graphsAwaitingNodeTypes.add(graph)
      onTestFinished(() => {
        graphsAwaitingNodeTypes.delete(graph)
      })
      graph.onConfigure = () => {
        const [node] = graph.nodes
        assert(node)
        node.onResize = () => {
          throw new Error('node resize failed')
        }
      }
      const data = zComfyWorkflow.parse({
        ...createWorkflowGraphData(),
        nodes: [
          {
            id: 2,
            type: 'test/ReloadNode',
            pos: [0, 0],
            size: [100, 100],
            flags: {},
            order: 0,
            mode: 0,
            properties: {}
          }
        ]
      })

      await expect(
        app.loadGraphData(data, true, false, workflow)
      ).rejects.toThrow('node resize failed')

      expect(graph.nodes.map((node) => node.title)).toEqual(['existing'])
      expect(graphsAwaitingNodeTypes.has(graph)).toBe(true)
    })

    it.for([
      {
        failingStep: 'configure',
        workflowState: 'active',
        isActive: true,
        failWith: (error: Error) => {
          vi.spyOn(LGraph.prototype, 'configure').mockImplementationOnce(() => {
            throw error
          })
        }
      },
      {
        failingStep: 'beforeConfigureGraph',
        workflowState: 'inactive',
        isActive: false,
        failWith: (error: Error) => {
          vi.when(mockExtensionService.invokeExtensionsAsync)
            .calledWith(
              'beforeConfigureGraph',
              expect.anything(),
              expect.anything(),
              expect.anything()
            )
            .thenRejectOnce(error)
        }
      }
    ])(
      'keeps the canvas on the owned graph of an $workflowState workflow when a forced reload fails in $failingStep',
      async ({ isActive, failWith }) => {
        app.canvasElRef.value = document.createElement('canvas')
        const workflow = markLoaded(
          new ComfyWorkflow({
            path: 'workflows/owned.json',
            modified: 0,
            size: 0
          })
        )
        const graph = createTestRootGraph()
        graph.add(new LGraphNode('existing'))
        workflow.adoptGraph(graph)
        useWorkflowStore().attachWorkflow(workflow)
        Reflect.set(app, 'rootGraphInternal', graph)
        vi.mocked(useWorkflowStore().isActive).mockReturnValue(isActive)
        const error = new Error('bad workflow json')
        failWith(error)

        await expect(
          app.loadGraphData(createWorkflowGraphData(), true, true, workflow)
        ).resolves.toBe(false)

        expect(workflow.graph).toBe(graph)
        expect(app.rootGraph).toBe(graph)
        expect(graph.nodes.map((node) => node.title)).toEqual(['existing'])
        expect(graphsAwaitingNodeTypes.has(graph)).toBe(true)
        expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
          'onGraphLoadError',
          error
        )
      }
    )

    it('keeps the root graph id across a forced reload of an owned workflow', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const workflow = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/owned.json',
          modified: 0,
          size: 0
        })
      )
      const id = crypto.randomUUID()
      const data = zComfyWorkflow.parse({ ...createWorkflowGraphData(), id })
      const graph = createTestRootGraph(id)
      graph.add(new LGraphNode('existing'))
      workflow.adoptGraph(graph)
      useWorkflowStore().attachWorkflow(workflow)
      Reflect.set(app, 'rootGraphInternal', graph)

      await expect(
        app.loadGraphData(data, true, true, workflow)
      ).resolves.toBeTruthy()

      expect(app.rootGraph.id).toBe(id)
    })

    it('loads subgraph definitions into the inactive workflow on a non-clean load', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const workflow = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/undone.json',
          modified: 0,
          size: 0
        })
      )
      const owned = new LGraph()
      workflow.adoptGraph(owned)
      const active = new LGraph()
      Reflect.set(app, 'rootGraphInternal', active)
      const source = createTestRootGraph()
      const subgraph = createTestSubgraph({ rootGraph: source })
      const data = zComfyWorkflow.parse({
        ...createWorkflowGraphData(),
        extra: { marker: 'undone' },
        definitions: { subgraphs: [subgraph.asSerialisable()] }
      })
      const tracker = new ChangeTracker(workflow, data)
      workflow.changeTracker = tracker
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook) => {
          if (hook === 'afterConfigureGraph') owned.extra.normalized = true
        }
      )

      await app.loadGraphData(data, false, false, workflow)

      expect(owned.extra).toMatchObject({ marker: 'undone' })
      expect(tracker.activeState.extra).toMatchObject({
        marker: 'undone',
        normalized: true
      })
      expect(owned.subgraphs.has(subgraph.id)).toBe(true)
      expect(active.subgraphs.has(subgraph.id)).toBe(false)
      expect(app.rootGraph).toBe(active)
    })

    it('hands both configure hooks the restored workflow and its graph during a background restore', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const workflow = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/background-restore.json',
          modified: 0,
          size: 0
        })
      )
      const owned = new LGraph()
      workflow.adoptGraph(owned)
      Reflect.set(app, 'rootGraphInternal', new LGraph())

      await app.loadGraphData(createWorkflowGraphData(), false, false, workflow)

      const target = { graph: owned, workflow }
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'beforeConfigureGraph',
        expect.anything(),
        [],
        target
      )
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'afterConfigureGraph',
        [],
        target
      )
    })

    it.for([
      {
        failingStep: 'configure',
        failWith: (error: Error) => {
          vi.spyOn(LGraph.prototype, 'configure').mockImplementationOnce(() => {
            throw error
          })
        }
      },
      {
        failingStep: 'beforeConfigureGraph',
        failWith: (error: Error) => {
          vi.when(mockExtensionService.invokeExtensionsAsync)
            .calledWith(
              'beforeConfigureGraph',
              expect.anything(),
              expect.anything(),
              expect.anything()
            )
            .thenRejectOnce(error)
        }
      }
    ])(
      'notifies onGraphLoadError when a background restore fails in $failingStep',
      async ({ failWith }) => {
        app.canvasElRef.value = document.createElement('canvas')
        const workflow = markLoaded(
          new ComfyWorkflow({
            path: 'workflows/background-failure.json',
            modified: 0,
            size: 0
          })
        )
        workflow.adoptGraph(new LGraph())
        Reflect.set(app, 'rootGraphInternal', new LGraph())
        const error = new Error('background restore failed')
        failWith(error)

        await expect(
          app.loadGraphData(createWorkflowGraphData(), false, false, workflow)
        ).resolves.toBe(false)

        expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
          'onGraphLoadError',
          error
        )
      }
    )

    it('keeps a background graph awaiting node types refreshed while afterConfigureGraph runs', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const workflow = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/background-refresh.json',
          modified: 0,
          size: 0
        })
      )
      const graph = new LGraph()
      workflow.adoptGraph(graph)
      useWorkflowStore().attachWorkflow(workflow, 0)
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      onTestFinished(() => {
        graphsAwaitingNodeTypes.delete(graph)
      })
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (method: string) => {
          if (method === 'afterConfigureGraph') await app.reloadNodeDefs({})
          return []
        }
      )

      await app.loadGraphData(createWorkflowGraphData(), false, false, workflow)

      expect(graphsAwaitingNodeTypes.has(graph)).toBe(true)
    })

    it('reuses a successfully reconfigured waiting graph on the next workflow switch', async () => {
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      app.canvas = mockCanvas
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(mockCanvas, 'ds', createTestDragAndScale())
      const workflowService = await useRealWorkflowService()
      const workflow = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/waiting.json',
          modified: 0,
          size: 0
        })
      )
      const graph = new LGraph()
      workflow.adoptGraph(graph)
      const data = createWorkflowGraphData()
      const tracker = markRaw(new ChangeTracker(workflow, data))
      workflow.changeTracker = tracker
      graphsAwaitingNodeTypes.add(graph)

      await expect(
        app.loadGraphData(data, false, false, workflow, {
          skipAssetScans: true
        })
      ).resolves.toBe(true)
      const configure = vi.spyOn(graph, 'configure')
      const reset = vi.spyOn(tracker, 'reset')

      await expect(workflowService.openWorkflow(workflow)).resolves.toBe(true)

      expect(app.rootGraph).toBe(graph)
      expect(configure).not.toHaveBeenCalled()
      expect(reset).not.toHaveBeenCalled()
    })

    it.for([
      {
        outcome: 'success',
        arrange: (_graph: LGraph) => {},
        expectedResult: true
      },
      {
        outcome: 'configure-error',
        arrange: (graph: LGraph) => {
          vi.spyOn(graph, 'configure').mockImplementationOnce(() => {
            throw new Error('configure failed')
          })
        },
        expectedResult: false
      },
      {
        outcome: 'before-configure-error',
        arrange: (_graph: LGraph) => {
          vi.when(mockExtensionService.invokeExtensionsAsync)
            .calledWith(
              'beforeConfigureGraph',
              expect.anything(),
              expect.anything(),
              expect.anything()
            )
            .thenRejectOnce(new Error('before configure failed'))
        },
        expectedResult: false
      }
    ])(
      'keeps visible subgraph constructors after a background load: $outcome',
      async ({ arrange, expectedResult }) => {
        const active = new LGraph()
        Reflect.set(app, 'rootGraphInternal', active)
        const definition = createTestSubgraph({
          id: crypto.randomUUID()
        }).asSerialisable()
        const visibleSubgraph = active.createSubgraph(definition)
        useSubgraphService().registerNewSubgraph(visibleSubgraph, definition)
        const workflow = new ComfyWorkflow({
          path: 'workflows/background.json',
          modified: 0,
          size: 0
        })
        const owned = new LGraph()
        workflow.adoptGraph(owned)
        arrange(owned)

        const result = await app.loadGraphData(
          zComfyWorkflow.parse({
            ...createWorkflowGraphData(),
            definitions: { subgraphs: [definition] }
          }),
          false,
          false,
          workflow
        )

        expect(result).toBe(expectedResult)
        const node = LiteGraph.createNode(definition.id)
        assert(node && 'subgraph' in node)
        expect(node.subgraph).toBe(visibleSubgraph)
      }
    )

    it('preserves redo after a background restore containing an uninstalled node and a group without flags', async () => {
      onTestFinished(attachLegacyUI(app))
      const active = new LGraph()
      active.extra = { marker: 'visible' }
      Reflect.set(app, 'rootGraphInternal', active)
      const workflow = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/missing-node.json',
          modified: 0,
          size: 0
        })
      )
      const owned = new LGraph()
      workflow.adoptGraph(owned)
      const data = zComfyWorkflow.parse({
        ...createWorkflowGraphData(),
        groups: [{ title: 'Restored group', bounding: [0, 0, 200, 200] }],
        nodes: [
          {
            id: 1,
            type: 'test/UninstalledBackgroundNode',
            pos: [10, 20],
            size: [100, 100],
            order: 0,
            mode: 0,
            flags: {},
            properties: {}
          }
        ]
      })
      const missingNode = data.nodes[0]
      assert(missingNode)
      Reflect.deleteProperty(missingNode, 'flags')
      const tracker = markRaw(
        new ChangeTracker(workflow, createWorkflowGraphData())
      )
      workflow.changeTracker = tracker
      tracker.undoQueue.push(createWorkflowGraphData())
      tracker.redoQueue.push(createWorkflowGraphData())

      await expect(
        app.loadGraphData(data, false, false, workflow)
      ).resolves.toBe(true)

      expect.soft(tracker.activeState).toEqual(owned.serialize())
      expect(active.extra).toEqual({ marker: 'visible' })
      expect(app.rootGraph).toBe(active)

      Reflect.set(app, 'rootGraphInternal', owned)
      useWorkflowStore().activeWorkflow = workflow
      tracker.captureCanvasState()

      expect({
        undo: tracker.undoQueue.length,
        redo: tracker.redoQueue.length
      }).toEqual({ undo: 1, redo: 1 })
    })

    it('refuses a non-clean load into a workflow whose graph was released instead of borrowing the active one', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const workflow = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/closed.json',
          modified: 0,
          size: 0
        })
      )
      const active = new LGraph()
      Reflect.set(app, 'rootGraphInternal', active)
      const configureActive = vi.spyOn(active, 'configure')

      await expect(
        app.loadGraphData(createWorkflowGraphData(), false, false, workflow)
      ).resolves.toBe(false)

      expect(configureActive).not.toHaveBeenCalled()
      expect(mockExtensionService.invokeExtensionsAsync).not.toHaveBeenCalled()
    })

    it.for([
      {
        releaseHook: 'beforeLoadGraph',
        ownedGraph: (active: LGraph) => active,
        expectedVisibleExtra: {}
      },
      {
        releaseHook: 'beforeConfigureGraph',
        ownedGraph: (_active: LGraph) => new LGraph(),
        expectedVisibleExtra: { marker: 'visible' }
      }
    ])(
      'refuses an undo when its workflow graph is released during $releaseHook',
      async ({ releaseHook, ownedGraph, expectedVisibleExtra }) => {
        app.canvasElRef.value = document.createElement('canvas')
        const workflow = markLoaded(
          new ComfyWorkflow({
            path: 'workflows/closed.json',
            modified: 0,
            size: 0
          })
        )
        const active = new LGraph()
        workflow.adoptGraph(ownedGraph(active))
        active.extra = { marker: 'visible' }
        Reflect.set(app, 'rootGraphInternal', active)
        mockExtensionService.invokeExtensionsAsync.mockImplementation(
          async (hook) => {
            if (hook === releaseHook) workflow.releaseGraph()
          }
        )

        await expect(
          app.loadGraphData(createWorkflowGraphData(), false, false, workflow)
        ).resolves.toBe(false)

        expect(active.extra).toEqual(expectedVisibleExtra)
        expect(workflow.graph).toBe(null)
        expect(isGraphLoading(active)).toBe(false)
        expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
          'onGraphLoadError',
          expect.any(Error)
        )
      }
    )

    it('resolves false and notifies onGraphLoadError when a pre-configure step fails', async () => {
      // A failure before `rootGraph.configure` even runs (a `beforeConfigureGraph`
      // extension hook throwing, here) previously skipped both
      // `afterConfigureGraph` and `onGraphLoadError` entirely, rejecting the
      // promise instead and leaking any suppression/loading-state a
      // `beforeLoadGraph` listener had opened for this same load.
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')
      const error = new Error('bad extension')
      let releaseErrorHandling!: () => void
      const errorHandling = new Promise<void>((resolve) => {
        releaseErrorHandling = resolve
      })
      vi.when(mockExtensionService.invokeExtensionsAsync)
        .calledWith(
          'beforeConfigureGraph',
          expect.anything(),
          expect.anything(),
          expect.anything()
        )
        .thenRejectOnce(error)
      vi.when(mockExtensionService.invokeExtensionsAsync)
        .calledWith('onGraphLoadError', error)
        .thenReturnOnce(errorHandling)
      const load = app.loadGraphData(
        createWorkflowGraphData(),
        false,
        true,
        null,
        { workflowNavigationId: 9 }
      )
      try {
        await vi.waitFor(() =>
          expect(
            mockExtensionService.invokeExtensionsAsync
          ).toHaveBeenCalledWith('onGraphLoadError', error)
        )
        expect(isGraphLoading(app.rootGraph)).toBe(true)
      } finally {
        releaseErrorHandling()
        await load
      }
      await expect(load).resolves.toBe(false)
      expect(isGraphLoading(app.rootGraph)).toBe(false)

      expect(showDialog).toHaveBeenCalledOnce()
      expect(useSubgraphNavigationStore().updateHash).toHaveBeenCalledWith(
        'workflow-load',
        9
      )
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'onGraphLoadError',
        expect.objectContaining({ message: 'bad extension' })
      )
      expect(
        mockExtensionService.invokeExtensionsAsync
      ).not.toHaveBeenCalledWith(
        'afterConfigureGraph',
        expect.anything(),
        expect.anything()
      )
    })

    it('does not configure or activate a graph whose load stopped being current during beforeConfigureGraph', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      let current = true
      let releaseHook!: () => void
      const hookHeld = new Promise<void>((resolve) => {
        releaseHook = resolve
      })
      vi.when(mockExtensionService.invokeExtensionsAsync)
        .calledWith(
          'beforeConfigureGraph',
          expect.anything(),
          expect.anything(),
          expect.anything()
        )
        .thenReturnOnce(hookHeld)
      const load = app.loadGraphData(
        { ...createWorkflowGraphData(), extra: { loadedFrom: 'superseded' } },
        false,
        true,
        null,
        { isCurrent: () => current, workflowNavigationId: 9 }
      )
      await vi.waitFor(() =>
        expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
          'beforeConfigureGraph',
          expect.anything(),
          expect.anything(),
          expect.anything()
        )
      )
      current = false
      releaseHook()

      await expect(load).resolves.toBe(false)
      expect(app.rootGraph.extra.loadedFrom).toBeUndefined()
      expect(mockWorkflowService.afterLoadNewGraph).not.toHaveBeenCalled()
      expect(isGraphLoading(app.rootGraph)).toBe(false)
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'onGraphLoadError',
        expect.objectContaining({ name: 'AbortError' })
      )
      expect(
        mockExtensionService.invokeExtensionsAsync
      ).not.toHaveBeenCalledWith(
        'afterConfigureGraph',
        expect.anything(),
        expect.anything()
      )
    })

    it('does not activate a graph whose load stopped being current during afterConfigureGraph', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      let current = true
      let releaseHook!: () => void
      const hookHeld = new Promise<void>((resolve) => {
        releaseHook = resolve
      })
      vi.when(mockExtensionService.invokeExtensionsAsync)
        .calledWith('afterConfigureGraph', expect.anything(), expect.anything())
        .thenReturnOnce(hookHeld)
      const load = app.loadGraphData(
        createWorkflowGraphData(),
        false,
        true,
        null,
        {
          isCurrent: () => current,
          workflowNavigationId: 9
        }
      )
      await vi.waitFor(() =>
        expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
          'afterConfigureGraph',
          expect.anything(),
          expect.anything()
        )
      )
      current = false
      releaseHook()

      await expect(load).resolves.toBe(false)
      expect(mockWorkflowService.afterLoadNewGraph).not.toHaveBeenCalled()
      expect(isGraphLoading(app.rootGraph)).toBe(false)
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'onGraphLoadError',
        expect.objectContaining({ name: 'AbortError' })
      )
    })

    describe('a load that resolves its graph when it reaches the front of the queue', () => {
      function holdFirstLoad() {
        let release = () => {}
        const held = new Promise<void>((resolve) => {
          release = resolve
        })
        let calls = 0
        vi.mocked(
          mockExtensionService.invokeExtensionsAsync
        ).mockImplementation(async (hook: string) => {
          if (hook === 'beforeLoadGraph' && calls++ === 0) await held
        })
        const first = app.loadGraphData(
          createWorkflowGraphData(),
          false,
          true,
          null,
          { skipAssetScans: true }
        )
        return { first, release: () => release() }
      }

      beforeEach(() => {
        app.canvasElRef.value = document.createElement('canvas')
        Reflect.set(app, 'rootGraphInternal', new LGraph())
      })

      it('loads the graph produced at its turn, not the one it was queued with', async () => {
        const { first, release } = holdFirstLoad()
        let current = { ...createWorkflowGraphData(), extra: { at: 'queued' } }
        const reload = app.loadGraphData(current, false, true, null, {
          skipAssetScans: true,
          resolveGraphData: () => current
        })
        current = { ...createWorkflowGraphData(), extra: { at: 'its turn' } }

        release()
        await first
        await reload

        expect(app.rootGraph.extra.at).toBe('its turn')
      })

      it('loads an edit made while its own beforeLoadGraph hooks ran', async () => {
        let release = () => {}
        const hookHeld = new Promise<void>((resolve) => {
          release = resolve
        })
        vi.mocked(
          mockExtensionService.invokeExtensionsAsync
        ).mockImplementation(async (hook: string) => {
          if (hook === 'beforeLoadGraph') await hookHeld
        })
        let current = { ...createWorkflowGraphData(), extra: { at: 'queued' } }
        const reload = app.loadGraphData(undefined, false, true, null, {
          skipAssetScans: true,
          isReady: () => true,
          resolveGraphData: () => current
        })
        await vi.waitFor(() =>
          expect(
            mockExtensionService.invokeExtensionsAsync
          ).toHaveBeenCalledWith('beforeLoadGraph')
        )
        current = {
          ...createWorkflowGraphData(),
          extra: { at: 'during hooks' }
        }
        release()
        await reload

        expect(app.rootGraph.extra.at).toBe('during hooks')
      })

      it('resolves its graph after the beforeLoadGraph hooks, and skips if no longer ready', async () => {
        let release = () => {}
        const hookHeld = new Promise<void>((resolve) => {
          release = resolve
        })
        vi.mocked(
          mockExtensionService.invokeExtensionsAsync
        ).mockImplementation(async (hook: string) => {
          if (hook === 'beforeLoadGraph') await hookHeld
        })
        let ready = true
        const resolveGraphData = vi.fn(() => createWorkflowGraphData())
        const reload = app.loadGraphData(undefined, false, true, null, {
          skipAssetScans: true,
          isReady: () => ready,
          resolveGraphData
        })
        await vi.waitFor(() =>
          expect(
            mockExtensionService.invokeExtensionsAsync
          ).toHaveBeenCalledWith('beforeLoadGraph')
        )
        ready = false
        release()

        await expect(reload).resolves.toBe(false)
        expect(resolveGraphData).not.toHaveBeenCalled()
        expect(mockWorkflowService.beforeLoadNewGraph).not.toHaveBeenCalled()
        expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
          'onGraphLoadError',
          expect.objectContaining({ name: 'AbortError' })
        )
      })

      it('skips without touching the canvas when it is not ready at its turn', async () => {
        const { first, release } = holdFirstLoad()
        let ready = true
        const reload = app.loadGraphData(
          createWorkflowGraphData(),
          false,
          true,
          null,
          { skipAssetScans: true, isReady: () => ready }
        )
        ready = false

        release()
        await first

        await expect(reload).resolves.toBe(false)
        expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledOnce()
        expect(
          vi
            .mocked(mockExtensionService.invokeExtensionsAsync)
            .mock.calls.filter(([hook]) => hook === 'beforeLoadGraph')
        ).toHaveLength(1)
      })

      it('skips instead of loading the default workflow when the resolver has nothing to load', async () => {
        const { first, release } = holdFirstLoad()
        const reload = app.loadGraphData(
          createWorkflowGraphData(),
          false,
          true,
          null,
          { skipAssetScans: true, resolveGraphData: () => undefined }
        )

        release()
        await first

        await expect(reload).resolves.toBe(false)
        expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledOnce()
      })
    })

    it('leaves the canvas untouched for a load that stopped being current while it waited its turn', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      app.rootGraph.extra.loadedFrom = 'newer'

      const load = app.loadGraphData(
        createWorkflowGraphData(),
        true,
        true,
        null,
        { isCurrent: () => false }
      )

      await expect(load).resolves.toBe(false)
      expect(app.rootGraph.extra.loadedFrom).toBe('newer')
      expect(mockWorkflowService.beforeLoadNewGraph).not.toHaveBeenCalled()
      expect(
        mockExtensionService.invokeExtensionsAsync
      ).not.toHaveBeenCalledWith('beforeLoadGraph')
    })

    it('resolves false and notifies onGraphLoadError when the outgoing preflight throws', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')
      mockWorkflowService.beforeLoadNewGraph.mockImplementationOnce(() => {
        throw new Error('outgoing serializer blew up')
      })

      await expect(
        app.loadGraphData(createWorkflowGraphData(), false, true, null, {
          workflowNavigationId: 21
        })
      ).resolves.toBe(false)

      expect(showDialog).toHaveBeenCalledOnce()
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'onGraphLoadError',
        expect.objectContaining({ message: 'outgoing serializer blew up' })
      )
      expect(isGraphLoading(app.rootGraph)).toBe(false)
      expect(
        mockExtensionService.invokeExtensionsAsync
      ).not.toHaveBeenCalledWith(
        'afterConfigureGraph',
        expect.anything(),
        expect.anything()
      )
    })

    it('resolves false and notifies onGraphLoadError when resolving the graph throws', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      await expect(
        app.loadGraphData(undefined, false, true, null, {
          workflowNavigationId: 22,
          resolveGraphData: () => {
            throw new Error('snapshot serializer blew up')
          }
        })
      ).resolves.toBe(false)

      expect(showDialog).toHaveBeenCalledOnce()
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'onGraphLoadError',
        expect.objectContaining({ message: 'snapshot serializer blew up' })
      )
      expect(mockWorkflowService.beforeLoadNewGraph).not.toHaveBeenCalled()
      expect(isGraphLoading(app.rootGraph)).toBe(false)
      expect(useSubgraphNavigationStore().updateHash).toHaveBeenCalledWith(
        'workflow-load',
        22
      )
    })

    it('resolves false and notifies onGraphLoadError when workflow validation rejects', async () => {
      // A failure inside `validateWorkflow` - called well before
      // `beforeConfigureGraph`, let alone `rootGraph.configure` - previously
      // sat outside any try/catch in `loadGraphData` entirely, so it would
      // reject the returned promise instead of resolving false, skipping
      // both `afterConfigureGraph` and `onGraphLoadError` and leaking any
      // suppression/loading-state a `beforeLoadGraph` listener had opened
      // for this same load.
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      useSettingStore().settingValues['Comfy.Validation.Workflows'] = true
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')
      mockValidateWorkflow.mockRejectedValueOnce(
        new Error('workflow validation blew up')
      )

      await expect(
        app.loadGraphData(createWorkflowGraphData(), false, true, null, {
          workflowNavigationId: 13
        })
      ).resolves.toBe(false)

      expect(showDialog).toHaveBeenCalledOnce()
      expect(useSubgraphNavigationStore().updateHash).toHaveBeenCalledWith(
        'workflow-load',
        13
      )
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'onGraphLoadError',
        expect.objectContaining({ message: 'workflow validation blew up' })
      )
      expect(
        mockExtensionService.invokeExtensionsAsync
      ).not.toHaveBeenCalledWith(
        'afterConfigureGraph',
        expect.anything(),
        expect.anything()
      )

      // A second, successful load proves the depth counter this rejection
      // could otherwise have leaked open (see agentPanel.ts) is actually
      // closed: a subsequent load starts and completes normally.
      await expect(
        app.loadGraphData(createWorkflowGraphData(), false, true, null, {
          workflowNavigationId: 14
        })
      ).resolves.toBe(true)
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'afterConfigureGraph',
        expect.anything(),
        expect.anything()
      )
    })

    it('applies load-time widget fixups as load provenance, not local edits', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      class KSampler extends LGraphNode {
        constructor(title = 'KSampler') {
          super(title)
          this.addWidget('combo', 'sampler_name', 'euler', () => {}, {
            values: ['euler']
          })
          this.serialize_widgets = true
        }
      }
      LiteGraph.registerNodeType('KSampler', KSampler)
      const intents: GraphIntentEvent[] = []
      const unsubscribe = onGraphIntent((event) => {
        if (event.type === 'set_widget') intents.push(event)
      })

      try {
        await app.loadGraphData(
          {
            ...createWorkflowGraphData(),
            last_node_id: 1,
            nodes: [
              {
                id: 1,
                type: 'KSampler',
                pos: [0, 0],
                size: [200, 100],
                flags: {},
                order: 0,
                mode: 0,
                properties: {},
                widgets_values: ['sample_euler']
              }
            ]
          },
          false
        )
      } finally {
        unsubscribe()
        LiteGraph.unregisterNodeType('KSampler')
      }

      expect(app.rootGraph.getNodeById(toNodeId(1))?.widgets?.[0]?.value).toBe(
        'euler'
      )
      expect(intents.map(({ source }) => source)).not.toContain('local')
      expect(intents).toContainEqual(
        expect.objectContaining({
          source: 'load',
          name: 'sampler_name',
          value: 'euler',
          previous: 'sample_euler'
        })
      )
    })

    it("keeps the default workflow's model selection when the server does not list it", async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      class VAELoader extends LGraphNode {
        constructor(title = 'VAELoader') {
          super(title)
          this.addWidget('combo', 'vae_name', 'taesd', () => {}, {
            values: ['pixel_space', 'taesd']
          })
          this.serialize_widgets = true
        }
      }
      LiteGraph.registerNodeType('VAELoader', VAELoader)
      vi.mocked(getDefaultWorkflow).mockReturnValueOnce({
        ...createWorkflowGraphData(),
        last_node_id: 1,
        nodes: [
          {
            id: 1,
            type: 'VAELoader',
            pos: [0, 0],
            size: [200, 100],
            flags: {},
            order: 0,
            mode: 0,
            properties: {},
            widgets_values: ['ae.safetensors']
          }
        ]
      })

      try {
        await app.loadGraphData()
      } finally {
        LiteGraph.unregisterNodeType('VAELoader')
      }

      expect(app.rootGraph.getNodeById(toNodeId(1))?.widgets?.[0]?.value).toBe(
        'ae.safetensors'
      )
    })

    it('replaces a default workflow option the server does not offer when it is not a model file', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      class KSampler extends LGraphNode {
        constructor(title = 'KSampler') {
          super(title)
          this.addWidget('combo', 'sampler_name', 'dpm_2', () => {}, {
            values: ['euler', 'dpm_2']
          })
          this.serialize_widgets = true
        }
      }
      LiteGraph.registerNodeType('KSampler', KSampler)
      vi.mocked(getDefaultWorkflow).mockReturnValueOnce({
        ...createWorkflowGraphData(),
        last_node_id: 1,
        nodes: [
          {
            id: 1,
            type: 'KSampler',
            pos: [0, 0],
            size: [200, 100],
            flags: {},
            order: 0,
            mode: 0,
            properties: {},
            widgets_values: ['res_multistep']
          }
        ]
      })

      try {
        await app.loadGraphData()
      } finally {
        LiteGraph.unregisterNodeType('KSampler')
      }

      expect(app.rootGraph.getNodeById(toNodeId(1))?.widgets?.[0]?.value).toBe(
        'euler'
      )
    })

    it('applies synchronous afterConfigureGraph widget writes as load provenance', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      class KSampler extends LGraphNode {
        constructor(title = 'KSampler') {
          super(title)
          this.addWidget('number', 'steps', 20, () => {})
          this.serialize_widgets = true
        }
      }
      LiteGraph.registerNodeType('KSampler', KSampler)
      const intents: GraphIntentEvent[] = []
      const unsubscribe = onGraphIntent((event) => {
        if (event.type === 'set_widget') intents.push(event)
      })
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook) => {
          if (hook !== 'afterConfigureGraph') return
          const steps = app.rootGraph
            .findNodesByType('KSampler')[0]
            ?.widgets?.find((widget) => widget.name === 'steps')
          if (steps) steps.value = 47
        }
      )

      try {
        await app.loadGraphData(
          {
            ...createWorkflowGraphData(),
            last_node_id: 1,
            nodes: [
              {
                id: 1,
                type: 'KSampler',
                pos: [0, 0],
                size: [200, 100],
                flags: {},
                order: 0,
                mode: 0,
                properties: {},
                widgets_values: [20]
              }
            ]
          },
          false
        )
      } finally {
        unsubscribe()
        LiteGraph.unregisterNodeType('KSampler')
      }

      expect(app.rootGraph.getNodeById(toNodeId(1))?.widgets?.[0]?.value).toBe(
        47
      )
      expect(intents).toContainEqual(
        expect.objectContaining({
          source: 'load',
          name: 'steps',
          value: 47,
          previous: 20
        })
      )
      expect(intents.map(({ source }) => source)).not.toContain('local')
    })

    it('notifies extensions once on each side of a graph load, in order', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())

      await app.loadGraphData(createWorkflowGraphData(), false)

      const loadHookCalls =
        mockExtensionService.invokeExtensionsAsync.mock.calls
          .map(([hook]) => hook)
          .filter((hook) =>
            [
              'beforeLoadGraph',
              'beforeConfigureGraph',
              'afterConfigureGraph',
              'afterLoadGraph'
            ].includes(hook)
          )
      expect(loadHookCalls).toEqual([
        'beforeLoadGraph',
        'beforeConfigureGraph',
        'afterConfigureGraph',
        'afterLoadGraph'
      ])
    })

    it('forwards an activation throw to onGraphLoadError instead of rethrowing when another root graph replaced the load', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      mockWorkflowService.afterLoadNewGraph.mockImplementation(async () => {
        Reflect.set(app, 'rootGraphInternal', new LGraph())
        throw new DOMException('Workflow load was replaced', 'AbortError')
      })

      await expect(
        app.loadGraphData(createWorkflowGraphData(), false)
      ).resolves.toBeUndefined()

      const terminalHooks =
        mockExtensionService.invokeExtensionsAsync.mock.calls
          .map(([hook]) => hook)
          .filter(
            (hook) => hook === 'afterLoadGraph' || hook === 'onGraphLoadError'
          )
      expect(terminalHooks).toEqual(['onGraphLoadError'])
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'onGraphLoadError',
        expect.objectContaining({ name: 'AbortError' })
      )
    })

    it('does not assign a newer workflow graph to an Undo load waiting after configuration', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const active = new LGraph()
      Reflect.set(app, 'rootGraphInternal', active)
      const firstWorkflow = new ComfyWorkflow({
        path: 'workflows/undo.json',
        modified: 0,
        size: 0
      })
      firstWorkflow.adoptGraph(new LGraph())
      const saved = createWorkflowGraphData()
      saved.extra = { marker: 'saved' }
      const changed = structuredClone(saved)
      changed.extra = { marker: 'changed' }
      const firstTracker = new ChangeTracker(firstWorkflow, saved)
      firstTracker.activeState = changed
      firstTracker._restoringState = true
      firstWorkflow.changeTracker = firstTracker
      const secondWorkflow = new ComfyWorkflow({
        path: 'workflows/other.json',
        modified: 0,
        size: 0
      })
      secondWorkflow.adoptGraph(active)
      const other = createWorkflowGraphData()
      other.extra = { marker: 'other' }
      const secondTracker = new ChangeTracker(secondWorkflow, other)
      secondWorkflow.changeTracker = secondTracker
      mockWorkflowService.afterLoadNewGraph.mockImplementation(
        async (
          workflow: string | ComfyWorkflow | null,
          state: ComfyWorkflowJSON
        ) => {
          assert(workflow instanceof ComfyWorkflow)
          workflow.changeTracker?.reset(state)
        }
      )
      let releasePending!: () => void
      const pending = new Promise<void>((resolve) => {
        releasePending = resolve
      })
      vi.when(mockExtensionService.invokeExtensionsAsync)
        .calledWith('afterConfigureGraph', expect.anything(), expect.anything())
        .thenReturnOnce(pending)

      const undoLoad = app.loadGraphData(saved, false, false, firstWorkflow, {
        skipAssetScans: true
      })
      await vi.waitFor(() =>
        expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
          'afterConfigureGraph',
          expect.anything(),
          expect.anything()
        )
      )
      const newerLoad = app.loadGraphData(other, false, false, secondWorkflow, {
        skipAssetScans: true
      })
      releasePending()
      await expect(undoLoad).resolves.toBeTruthy()
      await expect(newerLoad).resolves.toBeTruthy()

      expect(firstTracker.activeState.extra).toMatchObject({ marker: 'saved' })
      expect(firstTracker.initialState.extra).toMatchObject({ marker: 'saved' })
      expect(secondTracker.activeState.extra).toMatchObject({ marker: 'other' })
      expect(app.rootGraph.extra).toMatchObject({ marker: 'other' })
    })

    it.for(['activation', 'tracker restoration', 'afterLoadGraph'] as const)(
      'finishes an older restore paused during %s before the newer workflow loads',
      async (pauseAt) => {
        app.canvasElRef.value = document.createElement('canvas')
        const graph = new LGraph()
        Reflect.set(app, 'rootGraphInternal', graph)
        Reflect.set(mockCanvas, 'ds', { scale: 1, offset: [0, 0] })
        await useRealWorkflowService()
        const workflowStore = useWorkflowStore()
        vi.mocked(workflowStore.openWorkflow).mockRestore()
        vi.mocked(workflowStore.isActive).mockRestore()

        const saved = createWorkflowGraphData()
        saved.extra = { marker: 'saved' }
        const changed = structuredClone(saved)
        changed.extra = { marker: 'changed' }
        const firstWorkflow = markLoaded(
          new ComfyWorkflow({
            path: 'workflows/undo.json',
            modified: 0,
            size: 0
          })
        )
        firstWorkflow.adoptGraph(graph)
        const firstTracker = markRaw(new ChangeTracker(firstWorkflow, saved))
        firstTracker.activeState = changed
        firstTracker._restoringState = true
        firstWorkflow.changeTracker = firstTracker
        const other = createWorkflowGraphData()
        other.extra = { marker: 'other' }
        const secondWorkflow = markLoaded(
          new ComfyWorkflow({
            path: 'workflows/other.json',
            modified: 0,
            size: 0
          })
        )
        const secondGraph = new LGraph()
        secondWorkflow.adoptGraph(secondGraph)
        const secondTracker = markRaw(new ChangeTracker(secondWorkflow, other))
        secondWorkflow.changeTracker = secondTracker
        let releasePause!: () => void
        const pause = new Promise<void>((resolve) => {
          releasePause = resolve
        })
        let reachedPause = false
        if (pauseAt === 'activation') {
          vi.spyOn(firstWorkflow, 'load').mockImplementationOnce(async () => {
            reachedPause = true
            await pause
            return firstWorkflow
          })
        } else if (pauseAt === 'tracker restoration') {
          const openWorkflow = vi
            .mocked(workflowStore.openWorkflow)
            .getMockImplementation()
          assert(openWorkflow)
          vi.mocked(workflowStore.openWorkflow).mockImplementation(
            async (workflow) => {
              const loaded = await openWorkflow(workflow)
              if (workflow.path === firstWorkflow.path) {
                reachedPause = true
                await pause
              }
              return loaded
            }
          )
        } else {
          mockExtensionService.invokeExtensionsAsync.mockImplementation(
            async (hook) => {
              if (hook === 'afterLoadGraph' && !reachedPause) {
                reachedPause = true
                await pause
              }
            }
          )
        }

        const olderLoad = app.loadGraphData(
          saved,
          false,
          false,
          firstWorkflow,
          {
            skipAssetScans: true
          }
        )
        await vi.waitFor(() => expect(reachedPause).toBe(true))
        const newerLoad = app.loadGraphData(
          other,
          true,
          false,
          secondWorkflow,
          {
            skipAssetScans: true
          }
        )
        releasePause()
        await expect(olderLoad).resolves.toBeTruthy()
        await expect(newerLoad).resolves.toBeTruthy()

        expect(workflowStore.activeWorkflow?.path).toBe(secondWorkflow.path)
        expect(workflowStore.activeWorkflow?.changeTracker).toBe(secondTracker)
        expect(secondTracker.activeState.extra).toMatchObject({
          marker: 'other'
        })
        expect(secondTracker.initialState.extra).toMatchObject({
          marker: 'other'
        })
        expect(firstTracker.initialState).toEqual(saved)
        expect(firstTracker.activeState.extra).toMatchObject({
          marker: 'saved'
        })
        expect(secondGraph.extra).toMatchObject({ marker: 'other' })
        expect(isGraphLoading(app.rootGraph)).toBe(false)
      }
    )

    it.for([
      { first: 'undo', second: 'switch', expectedBeforeLoadCalls: 2 },
      { first: 'switch', second: 'undo', expectedBeforeLoadCalls: 1 }
    ] as const)(
      'keeps the switched-to tab active with $first queued before $second',
      async ({ first, second, expectedBeforeLoadCalls }) => {
        const undoneGraph = new LGraph()
        const switchedGraph = new LGraph()
        Reflect.set(app, 'rootGraphInternal', undoneGraph)
        app.canvas = mockCanvas
        Reflect.set(mockCanvas, 'ds', { scale: 1, offset: [0, 0] })
        const workflowService = await useRealWorkflowService()
        const workflowStore = useWorkflowStore()
        vi.mocked(workflowStore.openWorkflow).mockRestore()
        vi.mocked(workflowStore.isActive).mockRestore()

        const saved = zComfyWorkflow.parse({
          ...createWorkflowGraphData(),
          extra: { marker: 'saved' }
        })
        const changed = structuredClone(saved)
        changed.extra = { marker: 'changed' }
        const undone = markLoaded(
          new ComfyWorkflow({
            path: 'workflows/undone.json',
            modified: 0,
            size: 0
          })
        )
        undone.adoptGraph(undoneGraph)
        const undoneTracker = markRaw(new ChangeTracker(undone, saved))
        undoneTracker.activeState = changed
        undoneTracker._restoringState = true
        undone.changeTracker = undoneTracker
        const switched = markLoaded(
          new ComfyWorkflow({
            path: 'workflows/switched.json',
            modified: 0,
            size: 0
          })
        )
        switched.adoptGraph(switchedGraph)
        switched.changeTracker = markRaw(
          new ChangeTracker(switched, createWorkflowGraphData())
        )
        workflowStore.attachWorkflow(undone, 0)
        workflowStore.attachWorkflow(switched, 1)
        workflowStore.activeWorkflow = undone
        const outputs = useNodeOutputStore()
        outputs.setNodePreviewsByNodeId(toNodeId(7), ['blob:switched-preview'])
        outputs.stashPreviewsForWorkflow(switched.path)
        let releasePause!: () => void
        const pause = new Promise<void>((resolve) => {
          releasePause = resolve
        })
        let reachedPause = false
        mockExtensionService.invokeExtensionsAsync.mockImplementation(
          async (hook) => {
            if (hook === 'beforeLoadGraph' && !reachedPause) {
              reachedPause = true
              await pause
            }
          }
        )

        const operations = {
          undo: () =>
            app.loadGraphData(saved, false, false, undone, {
              skipAssetScans: true
            }),
          switch: () => workflowService.openWorkflow(switched)
        }
        const firstLoad = operations[first]()
        await vi.waitFor(() => expect(reachedPause).toBe(true))
        const secondLoad = operations[second]()
        releasePause()
        await expect(firstLoad).resolves.toBeTruthy()
        await expect(secondLoad).resolves.toBeTruthy()

        expect(
          mockExtensionService.invokeExtensionsAsync.mock.calls.filter(
            ([hook]) => hook === 'beforeLoadGraph'
          )
        ).toHaveLength(expectedBeforeLoadCalls)
        expect(workflowStore.activeWorkflow).toMatchObject({
          path: switched.path
        })
        expect(app.rootGraph).toBe(switchedGraph)
        expect(outputs.nodePreviewImages).toEqual({
          '7': ['blob:switched-preview']
        })
        expect(useExecutionErrorStore().captureRunErrorKey()).toBe(
          `${switched.path}:${switchedGraph.id}`
        )
        expect(undoneGraph.extra).toMatchObject({ marker: 'saved' })
        expect(undoneTracker.activeState.extra).toMatchObject({
          marker: 'saved'
        })
      }
    )

    it('keeps the switched-to tab active when a live tab switch follows an undo paused in beforeLoadGraph', async () => {
      const undoneGraph = new LGraph()
      const switchedGraph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', undoneGraph)
      app.canvas = mockCanvas
      Reflect.set(mockCanvas, 'ds', { scale: 1, offset: [0, 0] })
      const workflowService = await useRealWorkflowService()
      const workflowStore = useWorkflowStore()
      vi.mocked(workflowStore.openWorkflow).mockRestore()
      vi.mocked(workflowStore.isActive).mockRestore()

      const saved = createWorkflowGraphData()
      saved.extra = { marker: 'saved' }
      const changed = structuredClone(saved)
      changed.extra = { marker: 'changed' }
      const undone = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/undone.json',
          modified: 0,
          size: 0
        })
      )
      undone.adoptGraph(undoneGraph)
      const undoneTracker = markRaw(new ChangeTracker(undone, saved))
      undoneTracker.activeState = changed
      undoneTracker._restoringState = true
      undone.changeTracker = undoneTracker
      const switched = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/switched.json',
          modified: 0,
          size: 0
        })
      )
      switched.adoptGraph(switchedGraph)
      switched.changeTracker = markRaw(
        new ChangeTracker(switched, createWorkflowGraphData())
      )
      workflowStore.attachWorkflow(undone, 0)
      workflowStore.attachWorkflow(switched, 1)
      workflowStore.activeWorkflow = undone
      let releasePause!: () => void
      const pause = new Promise<void>((resolve) => {
        releasePause = resolve
      })
      let reachedPause = false
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook) => {
          if (hook === 'beforeLoadGraph' && !reachedPause) {
            reachedPause = true
            await pause
          }
        }
      )

      const undoLoad = app.loadGraphData(saved, false, false, undone, {
        skipAssetScans: true
      })
      await vi.waitFor(() => expect(reachedPause).toBe(true))
      const tabSwitch = workflowService.openWorkflow(switched)
      releasePause()
      await expect(undoLoad).resolves.toBeTruthy()
      await expect(tabSwitch).resolves.toBe(true)

      expect(workflowStore.activeWorkflow).toMatchObject({
        path: switched.path
      })
      expect(app.rootGraph).toBe(switchedGraph)
      expect(undoneGraph.extra).toMatchObject({ marker: 'saved' })
      expect(undoneTracker.activeState.extra).toMatchObject({
        marker: 'saved'
      })
    })

    it('does not assign a cleared canvas to Undo while the newer workflow is still preparing', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const graph = new LGraph()
      graph.add(new LGraphNode('outgoing'))
      Reflect.set(app, 'rootGraphInternal', graph)
      const outgoing = new ComfyWorkflow({
        path: 'workflows/outgoing.json',
        modified: 0,
        size: 0
      })
      const outgoingState = structuredClone(
        graph.serialize()
      ) as ComfyWorkflowJSON
      const tracker = markRaw(new ChangeTracker(outgoing, outgoingState))
      const loadedOutgoing = markLoaded(outgoing)
      loadedOutgoing.changeTracker = tracker
      useWorkflowStore().activeWorkflow = loadedOutgoing
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook) => {
          if (hook === 'beforeConfigureGraph') tracker.captureCanvasState()
        }
      )

      await app.loadGraphData(createWorkflowGraphData(), true)

      expect(tracker.activeState).toEqual(outgoingState)
      expect(tracker.undoQueue).toHaveLength(0)
    })

    it('allows capture while the loaded workflow resource scans are pending', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      let releaseModels!: () => void
      const modelsPending = new Promise<void>((resolve) => {
        releaseModels = resolve
      })
      vi.mocked(runMissingModelPipeline).mockImplementationOnce(async () => {
        await modelsPending
        return {
          missingModels: [],
          confirmedCandidates: [],
          surfaced: Promise.resolve()
        }
      })
      const load = app.loadGraphData(createWorkflowGraphData(), false, false)
      try {
        await vi.waitFor(() =>
          expect(runMissingModelPipeline).toHaveBeenCalledOnce()
        )

        expect(isGraphLoading(app.rootGraph)).toBe(false)
      } finally {
        releaseModels()
        await load
      }
    })

    it('holds a missing model re-check queued by a finished download until the load has scanned its graph', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      const missingModelStore = useMissingModelStore()
      const recheck = vi
        .spyOn(missingModelStore, 'refreshMissingModels')
        .mockResolvedValue(undefined)
      const progressListeners: ((progress: ComfyDownloadProgress) => void)[] =
        []
      window.__comfyDesktop2 = {
        isRemote: () => false,
        downloadModel: async () => true,
        onDownloadProgress: (listener) => {
          progressListeners.push(listener)
          return () => {}
        }
      }
      missingModelStore.setMissingModels([
        fromPartial<MissingModelCandidate>({
          name: 'model.safetensors',
          directory: 'checkpoints',
          isMissing: true
        })
      ])
      const stopTracking = useMissingModelDownloadStore().startTracking()
      missingModelStore.isRefreshingMissingModels = true
      for (const listener of progressListeners) {
        listener({
          id: 'job-1',
          url: 'https://huggingface.co/comfy/test/resolve/main/model.safetensors',
          filename: 'model.safetensors',
          directory: 'checkpoints',
          progress: 1,
          status: 'completed'
        })
      }
      await nextTick()
      let finishScan!: () => void
      let scanStarted!: () => void
      const loadScanning = new Promise<void>((resolve) => {
        scanStarted = resolve
      })
      vi.mocked(runMissingModelPipeline).mockImplementationOnce(async () => {
        scanStarted()
        await new Promise<void>((resolve) => {
          finishScan = resolve
        })
        return {
          missingModels: [],
          confirmedCandidates: [],
          surfaced: Promise.resolve()
        }
      })
      try {
        const load = app.loadGraphData(createWorkflowGraphData(), false, false)
        missingModelStore.isRefreshingMissingModels = false
        await loadScanning
        await nextTick()

        expect(recheck).not.toHaveBeenCalled()

        finishScan()
        await load
        await vi.waitFor(() => expect(recheck).toHaveBeenCalledOnce())
      } finally {
        stopTracking()
        delete window.__comfyDesktop2
      }
    })

    it('lets a queued root graph switch run ahead of pending asset scans and drops their warnings', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      let releaseModels!: () => void
      const modelsPending = new Promise<void>((resolve) => {
        releaseModels = resolve
      })
      vi.mocked(runMissingModelPipeline).mockImplementationOnce(async () => {
        await modelsPending
        return {
          missingModels: [],
          confirmedCandidates: [],
          surfaced: Promise.resolve()
        }
      })
      const load = app.loadGraphData(createWorkflowGraphData(), false, false)
      await vi.waitFor(() =>
        expect(runMissingModelPipeline).toHaveBeenCalledOnce()
      )
      const switched = app.enqueueGraphLoad(async () => {
        app.activateRootGraph(new LGraph())
        return 'switched'
      })
      try {
        await expect(switched).resolves.toBe('switched')
      } finally {
        releaseModels()
        await load
      }

      expect(mockWorkflowService.showPendingWarnings).not.toHaveBeenCalled()
    })

    it('keeps a configured load when the next queued configure fails without clearing it', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      const graph = createWorkflowGraphData()
      graph.extra = { marker: 'configured' }
      let releaseFirst!: () => void
      const firstPending = new Promise<void>((resolve) => {
        releaseFirst = resolve
      })
      vi.when(mockExtensionService.invokeExtensionsAsync)
        .calledWith('afterConfigureGraph', expect.anything(), expect.anything())
        .thenReturnOnce(firstPending)
      const firstLoad = app.loadGraphData(graph, false, false, null, {
        skipAssetScans: true
      })
      await vi.waitFor(() =>
        expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
          'afterConfigureGraph',
          expect.anything(),
          expect.anything()
        )
      )
      vi.spyOn(app.rootGraph, 'configure').mockImplementationOnce(() => {
        throw new Error('Configuration failed before clearing')
      })
      const failedLoad = app.loadGraphData(
        createWorkflowGraphData(),
        false,
        false,
        null,
        { skipAssetScans: true }
      )
      releaseFirst()

      await expect(firstLoad).resolves.toBeTruthy()
      await expect(failedLoad).resolves.toBe(false)
      expect(app.rootGraph.extra).toMatchObject({ marker: 'configured' })
    })

    it('lets an older valid load commit when its queued replacement fails', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      let releaseOlderLoad!: () => void
      const olderLoadBlocked = new Promise<void>((resolve) => {
        releaseOlderLoad = resolve
      })
      vi.when(mockExtensionService.invokeExtensionsAsync)
        .calledWith('beforeLoadGraph')
        .thenReturnOnce(olderLoadBlocked)
      const older = createWorkflowGraphData()
      older.extra = { marker: 'older' }
      const newer = createWorkflowGraphData()
      newer.extra = { marker: 'newer' }
      vi.when(mockExtensionService.invokeExtensionsAsync)
        .calledWith(
          'beforeConfigureGraph',
          expect.objectContaining({ extra: { marker: 'newer' } }),
          expect.anything(),
          expect.anything()
        )
        .thenReject(new Error('newer load failed'))

      const olderLoad = app.loadGraphData(older, false)
      const newerLoad = app.loadGraphData(newer, false)
      releaseOlderLoad()

      await expect(olderLoad).resolves.toBe(true)
      await expect(newerLoad).resolves.toBe(false)
      expect(app.rootGraph.extra).toMatchObject({ marker: 'older' })
    })

    describe('pending camera restore while the canvas is hidden', () => {
      let canvasElement: HTMLCanvasElement

      beforeEach(() => {
        canvasElement = createTestCanvasElement({ visible: false })
        document.body.append(canvasElement)
        app.canvasElRef.value = canvasElement
        Reflect.set(app, 'rootGraphInternal', new LGraph())
        Reflect.set(mockCanvas, 'ds', createTestDragAndScale())
        Reflect.set(mockCanvas, 'bgcanvas', createTestCanvasElement())
        useCanvasScheduler().cancel('graph-load-camera')
      })

      function revealCanvas() {
        setCanvasVisible(canvasElement, true)
        useCanvasScheduler().flush()
      }

      it.for([
        {
          target: 'active',
          arrange: (workflow: ComfyWorkflow) => workflow
        },
        {
          target: 'background',
          arrange: (_workflow: ComfyWorkflow) => {
            const background = new ComfyWorkflow({
              path: 'workflows/background-camera.json',
              modified: 0,
              size: 0
            })
            background.adoptGraph(new LGraph())
            return background
          }
        }
      ])('survives an undo in the $target workflow', async ({ arrange }) => {
        const workflow = new ComfyWorkflow({
          path: 'workflows/camera.json',
          modified: 0,
          size: 0
        })

        await app.loadGraphData(createWorkflowGraphData(), true, true, workflow)
        workflow.adoptGraph(app.rootGraph)
        const undone = arrange(workflow)
        await app.loadGraphData(createWorkflowGraphData(), false, false, undone)
        revealCanvas()

        expect(mockCanvas.draw).toHaveBeenCalledWith(true, true)
      })

      it('is dropped when a different anonymous graph loads', async () => {
        await app.loadGraphData(createWorkflowGraphData(), true, true)
        await app.loadGraphData(createWorkflowGraphData(), true, false)
        revealCanvas()

        expect(mockCanvas.draw).not.toHaveBeenCalled()
      })

      it('is dropped when another root graph is activated before the canvas shows', async () => {
        const workflow = new ComfyWorkflow({
          path: 'workflows/camera.json',
          modified: 0,
          size: 0
        })

        await app.loadGraphData(createWorkflowGraphData(), true, true, workflow)
        app.activateRootGraph(new LGraph())
        revealCanvas()

        expect(mockCanvas.draw).not.toHaveBeenCalled()
      })

      it('runs once its own graph returns to the canvas after a tab round trip', async () => {
        const workflow = new ComfyWorkflow({
          path: 'workflows/camera.json',
          modified: 0,
          size: 0
        })

        await app.loadGraphData(createWorkflowGraphData(), true, true, workflow)
        const graph = app.rootGraph
        workflow.adoptGraph(graph)
        app.activateRootGraph(new LGraph())
        expect(app.hasPendingCamera(graph)).toBe(true)
        app.activateRootGraph(graph)
        revealCanvas()

        expect(mockCanvas.draw).toHaveBeenCalledWith(true, true)
        expect(app.hasPendingCamera(graph)).toBe(false)
      })

      it.for([
        { restoreView: true, pending: true },
        { restoreView: false, pending: false }
      ])(
        'is set by an API JSON import when view restore is $restoreView',
        async ({ restoreView, pending }) => {
          useSettingStore().settingValues['Comfy.EnableWorkflowViewRestore'] =
            restoreView

          await app.loadApiJson({}, 'api-camera')

          expect(app.hasPendingCamera(app.rootGraph)).toBe(pending)
        }
      )
    })

    it('brackets an API JSON import with graph-load hooks', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)

      await app.loadApiJson({}, 'empty.json')

      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledWith(false)
      expect(
        mockExtensionService.invokeExtensionsAsync.mock.calls.map(
          ([hook]) => hook
        )
      ).toEqual(['beforeLoadGraph', 'afterConfigureGraph', 'afterLoadGraph'])
    })

    it('loads API JSON as a new workflow when no file name is given', async () => {
      await useRealWorkflowService()
      const workflowStore = useWorkflowStore()
      workflowStore.provideChangeTracker(ChangeTracker)
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(mockCanvas, 'ds', createTestDragAndScale())
      vi.mocked(workflowStore.createNewTemporary).mockRestore()
      vi.mocked(workflowStore.getWorkflowByPath).mockRestore()
      vi.mocked(workflowStore.isActive).mockRestore()
      vi.mocked(workflowStore.openWorkflow).mockRestore()

      await app.loadApiJson({})

      expect(mockWorkflowService.afterLoadNewGraph).toHaveBeenCalledOnce()
      expect(
        mockWorkflowService.afterLoadNewGraph.mock.calls[0]?.[0]
      ).toBeNull()
      const imported = workflowStore.activeWorkflow
      assert.exists(imported)
      expect(imported.isTemporary).toBe(true)
      expect(imported.graph).toBe(graph)
    })

    it('creates subgraph nodes from the returning root when graphs share a definition ID', () => {
      const first = new LGraph()
      Reflect.set(app, 'rootGraphInternal', first)
      const definition = createTestSubgraph().asSerialisable()
      const firstSubgraph = first.createSubgraph(definition)
      const second = new LGraph()
      const secondSubgraph = second.createSubgraph(definition)
      for (const [index, graph] of [first, second].entries()) {
        const owner = new ComfyWorkflow({
          path: `workflows/subgraph-${index}.json`,
          modified: 0,
          size: 0
        })
        owner.adoptGraph(graph)
        useWorkflowStore().attachWorkflow(owner)
      }
      app.activateRootGraph(first)
      app.activateRootGraph(second)
      app.activateRootGraph(first)
      const node = LiteGraph.createNode(definition.id)
      assert(node && 'subgraph' in node)
      expect(node.subgraph).toBe(firstSubgraph)
      expect(node.subgraph).not.toBe(secondSubgraph)
    })

    it('lets the set-graph hash publish when an API import replaces an owned root', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const owner = new ComfyWorkflow({
        path: 'workflows/owner.json',
        modified: 0,
        size: 0
      })
      const ownedGraph = new LGraph()
      owner.adoptGraph(ownedGraph)
      useWorkflowStore().attachWorkflow(owner)
      Reflect.set(app, 'rootGraphInternal', ownedGraph)

      await app.loadApiJson({}, 'empty.json')

      expect(app.rootGraph).not.toBe(ownedGraph)
      expect(
        useSubgraphNavigationStore().suppressRootGraphHash
      ).not.toHaveBeenCalled()
    })

    it.for([
      {
        format: 'API JSON',
        load: () =>
          app.loadApiJson(
            { '1': { class_type: 'KSampler', inputs: { steps: 20 } } },
            'sampler.json'
          )
      },
      {
        format: 'A1111',
        load: async () => {
          vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
            parameters: 'positive\nNegative prompt: negative\nSteps: 20'
          })
          mockImportA1111.mockImplementation(
            async (incomingGraph, _parameters, beforeGraphClear) => {
              await beforeGraphClear?.()
              incomingGraph.clear()
              const sampler = LiteGraph.createNode('KSampler')
              assert(sampler)
              incomingGraph.add(sampler)
              return 'imported'
            }
          )
          await app.handleFile(createTestFile('a1111.png', 'image/png'))
        }
      }
    ])(
      'applies synchronous afterConfigureGraph widget writes as load provenance for $format imports',
      async ({ load }) => {
        app.canvasElRef.value = document.createElement('canvas')
        const graph = new LGraph()
        Reflect.set(app, 'rootGraphInternal', graph)
        class KSampler extends LGraphNode {
          constructor(title = 'KSampler') {
            super(title)
            this.addWidget('number', 'steps', 20, () => {})
            this.serialize_widgets = true
          }
        }
        LiteGraph.registerNodeType('KSampler', KSampler)
        const intents: GraphIntentEvent[] = []
        const unsubscribe = onGraphIntent((event) => {
          if (event.type === 'set_widget') intents.push(event)
        })
        mockExtensionService.invokeExtensionsAsync.mockImplementation(
          async (hook) => {
            if (hook !== 'afterConfigureGraph') return
            const steps = app.rootGraph
              .findNodesByType('KSampler')[0]
              ?.widgets?.find((widget) => widget.name === 'steps')
            if (steps) steps.value = 47
          }
        )

        try {
          await load()
        } finally {
          unsubscribe()
          LiteGraph.unregisterNodeType('KSampler')
        }

        expect(
          app.rootGraph.findNodesByType('KSampler')[0]?.widgets?.[0]?.value
        ).toBe(47)
        expect(intents).toContainEqual(
          expect.objectContaining({
            source: 'load',
            name: 'steps',
            value: 47,
            previous: 20
          })
        )
        expect(intents.map(({ source }) => source)).not.toContain('local')
      }
    )

    it('closes a failed API JSON lifecycle and resumes undo capture', async () => {
      app.canvasElRef.value = document.createElement('canvas')
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.spyOn(useNodeReplacementStore(), 'load').mockRejectedValueOnce(
        new Error('replacement lookup failed')
      )

      await expect(app.loadApiJson({}, 'broken.json')).rejects.toThrow(
        'replacement lookup failed'
      )

      expect(
        mockExtensionService.invokeExtensionsAsync.mock.calls.map(
          ([hook]) => hook
        )
      ).toEqual(['beforeLoadGraph', 'onGraphLoadError'])
      onTestFinished(attachLegacyUI(app))
      const workflow = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/recovered.json',
          modified: 0,
          size: 0
        })
      )
      const tracker = markRaw(
        new ChangeTracker(
          workflow,
          structuredClone(graph.serialize()) as ComfyWorkflowJSON
        )
      )
      workflow.changeTracker = tracker
      workflow.adoptGraph(graph)
      useWorkflowStore().activeWorkflow = workflow
      graph.add(new LGraphNode('after-failure'))
      tracker.captureCanvasState()
      expect(tracker.activeState.nodes.map((node) => node.title)).toEqual([
        'after-failure'
      ])
    })

    it.for([
      {
        format: 'API JSON',
        load: () => app.loadApiJson({}, 'empty.json')
      },
      {
        format: 'A1111',
        load: async () => {
          vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
            parameters: 'positive\nNegative prompt: negative\nSteps: 20'
          })
          mockImportA1111.mockImplementation(
            async (incomingGraph, _parameters, beforeGraphClear) => {
              await beforeGraphClear?.()
              incomingGraph.clear()
              return 'imported'
            }
          )
          await app.handleFile(createTestFile('a1111.png', 'image/png'))
        }
      }
    ])(
      'does not capture a $format import into the outgoing workflow',
      async ({ load }) => {
        onTestFinished(attachLegacyUI(app))
        app.canvasElRef.value = document.createElement('canvas')
        const graph = new LGraph()
        graph.add(new LGraphNode('outgoing'))
        Reflect.set(app, 'rootGraphInternal', graph)
        const outgoing = markLoaded(
          new ComfyWorkflow({
            path: 'workflows/outgoing-api.json',
            modified: 0,
            size: 0
          })
        )
        const outgoingState = structuredClone(
          graph.serialize()
        ) as ComfyWorkflowJSON
        const tracker = markRaw(new ChangeTracker(outgoing, outgoingState))
        outgoing.changeTracker = tracker
        useWorkflowStore().activeWorkflow = outgoing
        mockExtensionService.invokeExtensionsAsync.mockImplementation(
          async (hook) => {
            if (hook === 'afterConfigureGraph') tracker.captureCanvasState()
          }
        )

        await load()

        expect(tracker.activeState).toEqual(outgoingState)
        expect(tracker.undoQueue).toHaveLength(0)
      }
    )

    it.for([
      {
        path: 'API JSON',
        load: () => app.loadApiJson({}, 'empty.json')
      },
      {
        path: 'A1111',
        load: async () => {
          vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
            parameters: 'positive\nNegative prompt: negative\nSteps: 20'
          })
          mockImportA1111.mockImplementation(
            async (_graph, _parameters, beforeGraphClear) => {
              await beforeGraphClear?.()
              return 'imported'
            }
          )
          await app.handleFile(createTestFile('a1111.png', 'image/png'))
        }
      }
    ])(
      'flushes an outgoing edit made during $path preparation',
      async ({ load }) => {
        app.canvasElRef.value = document.createElement('canvas')
        const graph = new LGraph()
        graph.add(new LGraphNode('outgoing'))
        Reflect.set(app, 'rootGraphInternal', graph)
        Reflect.set(mockCanvas, 'ds', { scale: 1, offset: [0, 0] })
        onTestFinished(attachLegacyUI(app))
        await useRealWorkflowService()
        const outgoing = markLoaded(
          new ComfyWorkflow({
            path: 'workflows/pending-edit.json',
            modified: 0,
            size: 0
          })
        )
        const tracker = markRaw(
          new ChangeTracker(
            outgoing,
            structuredClone(graph.serialize()) as ComfyWorkflowJSON
          )
        )
        outgoing.changeTracker = tracker
        outgoing.adoptGraph(graph)
        useWorkflowStore().activeWorkflow = outgoing
        mockExtensionService.invokeExtensionsAsync.mockImplementation(
          async (hook) => {
            if (hook === 'beforeLoadGraph')
              graph.nodes[0].title = 'edited-during-preparation'
          }
        )

        await load()

        expect(tracker.activeState.nodes.map((node) => node.title)).toEqual([
          'edited-during-preparation'
        ])
      }
    )
  })

  describe('node API handles across loads', () => {
    const DOCUMENT_ID = '11111111-1111-4111-8111-111111111111'

    function installedNodeApi() {
      const { comfy_v4 } = window
      if (!comfy_v4) throw new Error('The node API is not installed.')
      return comfy_v4
    }

    function workflowWithFixedIdAndOneNode(): ComfyWorkflowJSON {
      return {
        ...createWorkflowGraphData(),
        id: DOCUMENT_ID,
        last_node_id: 1,
        nodes: [
          {
            id: 1,
            type: 'HandleProbe',
            pos: [0, 0],
            size: [200, 100],
            flags: {},
            order: 0,
            mode: 0,
            properties: {}
          }
        ]
      }
    }

    function nodeApiWithNodeTypeThatTakesItsHandleWhenAdded() {
      app.canvasElRef.value = document.createElement('canvas')
      const graph = new LGraph()
      onTestFinished(() => {
        delete window.comfy_v4
      })
      Reflect.set(app, 'rootGraphInternal', graph)
      mockCanvas.graph = graph
      useComfyApiStore().publish()
      const comfy = installedNodeApi()
      const packId = registerPublishedTestPack(comfy)

      const takenWhileLoading: NodeHandle[] = []
      class HandleProbe extends LGraphNode {
        override onAdded() {
          const handle = comfy.graph.node(String(this.id))
          if (handle) takenWhileLoading.push(handle)
        }
      }
      LiteGraph.registerNodeType('HandleProbe', HandleProbe)
      return { comfy, packId, takenWhileLoading }
    }

    it('retires a handle when a load replaces the document, even one that reuses its ids', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      const kept = comfy.graph.node('1')
      assert(kept)
      expect(kept.isDeleted).toBe(false)

      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)

      expect(app.rootGraph.id).toBe(DOCUMENT_ID)
      expect(kept.isDeleted).toBe(true)
      expect(comfy.graph.node('1')?.isDeleted).toBe(false)
      expect(comfy.graph.node('1')).not.toBe(kept)
    })

    it.for([{ restoreHistory: false }, { restoreHistory: true }])(
      'keeps the handles of the document on screen, and gives a hook a retired handle, when a restore (restoreHistory $restoreHistory) rebuilds a workflow not on screen',
      async ({ restoreHistory }) => {
        const { comfy, packId } =
          nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        const [[nodeTypeHooks]] = vi.mocked(
          mockExtensionService.registerExtension
        ).mock.calls
        nodeTypeHooks.beforeRegisterNodeDef?.(
          LiteGraph.registered_node_types.HandleProbe,
          hostNodeDef('HandleProbe'),
          app
        )
        const created: NodeHandle[] = []
        onTestFinished(
          comfy.defs.extend(packId, 'HandleProbe', (builder) =>
            builder.onCreated((node) => created.push(node))
          )
        )
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        const onScreen = comfy.graph.node('1')
        assert(onScreen)
        const background = markLoaded(
          new ComfyWorkflow({ path: 'workflows/bg.json', modified: 0, size: 0 })
        )
        const hidden = new LGraph()
        background.adoptGraph(hidden)
        created.length = 0

        await app.loadGraphData(
          { ...workflowWithFixedIdAndOneNode(), id: hidden.id },
          false,
          false,
          background,
          { restoreHistory }
        )

        const [madeOffScreen] = created
        assert(madeOffScreen)
        expect(onScreen.isDeleted).toBe(false)
        expect(madeOffScreen.isDeleted).toBe(true)
        expect(madeOffScreen.setTitle('Edited off screen')).toBe(false)
        expect(hidden.getNodeById(toNodeId(1))?.title).toBe('HandleProbe')
      }
    )

    async function twoLiveTabs() {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      onTestFinished(attachLegacyUI(app))
      vi.mocked(mockCanvas.setGraph).mockImplementation((graph) => {
        mockCanvas.graph = graph
      })
      const workflowService = await useRealWorkflowService()
      const workflowStore = useWorkflowStore()
      workflowStore.provideChangeTracker(ChangeTracker)
      Reflect.set(mockCanvas, 'ds', { scale: 1, offset: [0, 0] })
      vi.mocked(workflowStore.createNewTemporary).mockRestore()
      vi.mocked(workflowStore.getWorkflowByPath).mockRestore()
      vi.mocked(workflowStore.isActive).mockRestore()
      vi.mocked(workflowStore.openWorkflow).mockRestore()
      const probe = { '1': { class_type: 'HandleProbe', inputs: {} } }
      await app.loadApiJson(probe, 'tab-a')
      const tabA = workflowStore.activeWorkflow
      assert(tabA?.graph && tabA.changeTracker)
      await app.loadApiJson(probe, 'tab-b')
      return { comfy, workflowService, tabA, graphA: tabA.graph }
    }

    it('retires the handles of the open workflow when a tab switch shows the live graph of another, and gives working ones there', async () => {
      const { comfy, workflowService, tabA, graphA } = await twoLiveTabs()
      const inB = comfy.graph.node('1')
      assert(inB)

      await expect(workflowService.openWorkflow(tabA)).resolves.toBe(true)

      expect(app.rootGraph).toBe(graphA)
      expect(inB.isDeleted).toBe(true)
      expect(inB.setTitle('Edited in a tab not shown')).toBe(false)
      const inA = comfy.graph.node('1')
      assert(inA)
      expect(inA.isDeleted).toBe(false)
      expect(inA.setTitle('Edited on screen')).toBe(true)
      expect(graphA.getNodeById(toNodeId(1))?.title).toBe('Edited on screen')
    })

    it('records what a legacy afterLoadGraph hook changes on a switch to a live tab as an undo step, and keeps that tab’s saved baseline', async () => {
      const { workflowService, tabA, graphA } = await twoLiveTabs()
      const tracker = tabA.changeTracker
      assert(tracker)
      const baseline = structuredClone(tracker.initialState)
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook) => {
          const node = graphA.getNodeById(toNodeId(1))
          if (hook === 'afterLoadGraph' && node)
            node.title = 'Set on the switch'
        }
      )

      await workflowService.openWorkflow(tabA)
      tracker.captureCanvasState()

      expect(tracker.undoQueue).toHaveLength(1)
      expect(tracker.activeState.nodes[0]?.title).toBe('Set on the switch')
      expect(tracker.initialState).toEqual(baseline)
      expect(tabA.isModified).toBe(true)
    })

    it.for([
      { restoreHistory: true, drawn: [320, 180] },
      { restoreHistory: false, drawn: [200, 100] }
    ])(
      'draws a node at its mounted size after a restore of the open document, and at its saved size after a load (restoreHistory $restoreHistory)',
      async ({ restoreHistory, drawn }) => {
        nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        const vueNodesMode = LiteGraph.vueNodesMode
        LiteGraph.vueNodesMode = true
        onTestFinished(() => {
          LiteGraph.vueNodesMode = vueNodesMode
        })
        bindMountedNodeSize(app.rootGraph, toNodeId(1), () => {}).report(
          { width: 320, height: 180 },
          false
        )

        await app.loadGraphData(
          workflowWithFixedIdAndOneNode(),
          false,
          false,
          null,
          { restoreHistory }
        )

        const node = app.rootGraph.getNodeById(toNodeId(1))
        expect(Array.from(node?.size ?? [])).toEqual([200, 100])
        expect(Array.from(node?.renderingSize ?? [])).toEqual(drawn)
      }
    )

    it('keeps a handle through undo and redo, which rebuild the open document', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      const kept = comfy.graph.node('1')
      assert(kept)

      await app.loadGraphData(
        workflowWithFixedIdAndOneNode(),
        false,
        false,
        null,
        {
          restoreHistory: true
        }
      )

      expect(kept.isDeleted).toBe(false)
      expect(comfy.graph.node('1')).toBe(kept)
    })

    it('keeps the handle to a node an undo removed deleted, even after another node takes its id', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      const beforeAdding = structuredClone(
        app.rootGraph.serialize()
      ) as ComfyWorkflowJSON
      const undone = new LGraphNode('added, then undone')
      app.rootGraph.add(undone)
      const kept = comfy.graph.node(undone.id)
      assert(kept)

      await app.loadGraphData(beforeAdding, false, false, null, {
        restoreHistory: true
      })
      app.rootGraph.add(new LGraphNode('added after undo'))

      expect(kept.isDeleted).toBe(true)
    })

    it('does not bring a handle back when redo restores the node it lost to undo', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      const beforeAdding = structuredClone(
        app.rootGraph.serialize()
      ) as ComfyWorkflowJSON
      const added = new LGraphNode('added, undone, then redone')
      app.rootGraph.add(added)
      const afterAdding = structuredClone(
        app.rootGraph.serialize()
      ) as ComfyWorkflowJSON
      const kept = comfy.graph.node(added.id)
      assert(kept)

      await app.loadGraphData(beforeAdding, false, false, null, {
        restoreHistory: true
      })
      await app.loadGraphData(afterAdding, false, false, null, {
        restoreHistory: true
      })

      expect(kept.isDeleted).toBe(true)
      expect(comfy.graph.node(added.id)).not.toBe(kept)
      expect(comfy.graph.node(added.id)?.isDeleted).toBe(false)
    })

    describe('through the change tracker', () => {
      function historyOfTheOpenWorkflow() {
        onTestFinished(attachLegacyUI(app))
        const workflow = markLoaded(
          new ComfyWorkflow({
            path: 'workflows/history.json',
            modified: 0,
            size: 0
          })
        )
        const tracker = markRaw(
          new ChangeTracker(
            workflow,
            structuredClone(app.rootGraph.serialize()) as ComfyWorkflowJSON
          )
        )
        workflow.changeTracker = tracker
        workflow.adoptGraph(app.rootGraph)
        useWorkflowStore().activeWorkflow = workflow
        vi.mocked(useWorkflowStore().getWorkflowByPath).mockReturnValue(
          workflow
        )
        mockWorkflowService.afterLoadNewGraph.mockImplementation(
          async (_workflow: unknown, state: ComfyWorkflowJSON) => {
            bindCanvasTracker(tracker)
            tracker.reset(state)
          }
        )
        return { tracker, workflow }
      }

      function afterLoadGraphHookThatWaits(change?: () => void) {
        let resume = () => {}
        const resumed = new Promise<void>((resolve) => {
          resume = resolve
        })
        let started = () => {}
        const hasStarted = new Promise<void>((resolve) => {
          started = resolve
        })
        let hookRunsLeft = 1
        mockExtensionService.invokeExtensionsAsync.mockImplementation(
          async (hook) => {
            if (hook !== 'afterLoadGraph' || !hookRunsLeft--) return []
            change?.()
            started()
            await resumed
            return []
          }
        )
        return { started: hasStarted, resume: () => resume() }
      }

      it('keeps the recorded size of a node an undo rebuilds, where a load grows it to its content', async () => {
        nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        class GrowsToContent extends LGraphNode {
          override computeSize(): [number, number] {
            return [400, 300]
          }
        }
        LiteGraph.registerNodeType('GrowsToContent', GrowsToContent)
        const saved = workflowWithFixedIdAndOneNode()
        await app.loadGraphData(
          {
            ...saved,
            nodes: saved.nodes.map((node) => ({
              ...node,
              type: 'GrowsToContent'
            }))
          },
          false
        )
        const { tracker } = historyOfTheOpenWorkflow()
        const sizeNow = () => [
          ...(app.rootGraph.getNodeById(toNodeId(1))?.size ?? [])
        ]
        expect(sizeNow()).toEqual([400, 300])
        app.rootGraph.getNodeById(toNodeId(1))?.setSize([120, 80])
        tracker.captureCanvasState()
        tracker.userActed()
        const node = app.rootGraph.getNodeById(toNodeId(1))
        assert(node)
        node.title = 'Titled'
        tracker.captureCanvasState()

        await tracker.undo()

        expect(sizeNow()).toEqual([120, 80])
        await app.loadGraphData(
          structuredClone(app.rootGraph.serialize()) as ComfyWorkflowJSON,
          false
        )
        expect(sizeNow()).toEqual([400, 300])
      })

      async function addedProbe(comfy: Comfy): Promise<NodeHandle> {
        const added = comfy.graph.add('HandleProbe')
        assert(added)
        return added
      }

      describe('a pack that settles the types of a node’s slots some time after the node is created', () => {
        const later = {
          'a microtask': () =>
            new Promise<void>((done) => queueMicrotask(done)),
          'a frame': () =>
            new Promise<void>((done) => requestAnimationFrame(() => done()))
        }

        function packThatSettlesSlotTypes(when: keyof typeof later) {
          const { comfy, packId } =
            nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
          class AnySwitch extends LGraphNode {
            constructor(title?: string) {
              super(title ?? 'AnySwitch')
              this.addInput('any', '*')
            }
          }
          LiteGraph.registerNodeType('AnySwitch', AnySwitch)
          const [[nodeTypeHooks]] = vi.mocked(
            mockExtensionService.registerExtension
          ).mock.calls
          nodeTypeHooks.beforeRegisterNodeDef?.(
            LiteGraph.registered_node_types.AnySwitch,
            hostNodeDef('AnySwitch'),
            app
          )
          const settled: Promise<void>[] = []
          onTestFinished(
            comfy.defs.extend(packId, 'AnySwitch', (builder) =>
              builder.onCreated((node) => {
                settled.push(
                  later[when]().then(() => {
                    node.inputs.byName('any')?.modify({ type: '*' })
                    node.inputs.byName('any')?.modify({ type: 'STRING' })
                  })
                )
              })
            )
          )
          const settle = () => Promise.all(settled.splice(0))
          return { comfy, settle }
        }

        async function titledAfterSettling(when: keyof typeof later) {
          const { comfy, settle } = packThatSettlesSlotTypes(when)
          await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
          const { tracker } = historyOfTheOpenWorkflow()
          const added = comfy.graph.add('AnySwitch')
          assert(added)
          await settle()
          tracker.userActed()
          added.setTitle('Titled by the user')
          const titled = structuredClone(
            app.rootGraph.serialize()
          ) as ComfyWorkflowJSON
          return {
            tracker,
            settle,
            titled,
            undoSteps: tracker.undoQueue.length
          }
        }

        const queues = (tracker: ChangeTracker) => [
          tracker.undoQueue.length,
          tracker.redoQueue.length
        ]

        it.for(Object.keys(later) as (keyof typeof later)[])(
          'takes what the pack settles after %s following an undo into the restored state, and keeps redo',
          async (when) => {
            const { tracker, settle, titled, undoSteps } =
              await titledAfterSettling(when)

            await tracker.undo()
            await settle()

            expect(queues(tracker)).toEqual([undoSteps - 1, 1])
            await tracker.redo()
            expect(
              ChangeTracker.graphEqual(
                app.rootGraph.serialize() as ComfyWorkflowJSON,
                titled
              )
            ).toBe(true)
          }
        )

        it('records each change the pack makes after the user’s next input as an undo step of its own, which drops redo', async () => {
          const { tracker, settle, undoSteps } =
            await titledAfterSettling('a frame')

          await tracker.undo()
          tracker.userActed()
          await settle()

          expect(queues(tracker)).toEqual([undoSteps + 1, 0])
          await tracker.undo()
          expect(
            app.rootGraph.nodes.find(({ type }) => type === 'AnySwitch')
              ?.inputs[0].type
          ).toBe('*')
        })
      })

      it('gives back the same handle when undo restores a node that redo removed again', async () => {
        const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        const { tracker } = historyOfTheOpenWorkflow()
        const kept = await addedProbe(comfy)
        expect(kept.remove()).toBe(true)
        expect(tracker.undoQueue).toHaveLength(2)

        await tracker.undo()
        expect(comfy.graph.node(kept.id)).toBe(kept)
        await tracker.redo()
        expect(kept.isDeleted).toBe(true)
        await tracker.undo()

        expect(kept.isDeleted).toBe(false)
        expect(comfy.graph.node(kept.id)).toBe(kept)
        expect(kept.type).toBe('HandleProbe')
      })

      describe('a widget change made after the node is, rebuilt from the saved state', () => {
        class ThreeWidgets extends LGraphNode {
          constructor(title?: string) {
            super(title ?? 'ThreeWidgets')
            this.serialize_widgets = true
            this.addWidget('number', 'a', 1, () => {}, {})
            this.addWidget('number', 'b', 2, () => {}, {})
            this.addWidget('number', 'c', 3, () => {}, {})
          }
        }

        function savedThreeWidgets(): ComfyWorkflowJSON {
          const workflow = workflowWithFixedIdAndOneNode()
          return {
            ...workflow,
            nodes: workflow.nodes.map((node) => ({
              ...node,
              type: 'ThreeWidgets',
              widgets_values: [10, 20, 30]
            }))
          }
        }

        function shown(): string {
          const widgets = app.rootGraph.getNodeById(toNodeId(1))?.widgets
          return (widgets ?? [])
            .map(({ name, value }) => `${name}=${String(value)}`)
            .join(' ')
        }

        async function stepsAfter(
          named: boolean,
          change: (widgets: WidgetCollection) => void
        ) {
          const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
          LiteGraph.registerNodeType('ThreeWidgets', ThreeWidgets)
          const before = LiteGraph.namedValuesRestore
          LiteGraph.namedValuesRestore = named
          onTestFinished(() => {
            LiteGraph.namedValuesRestore = before
          })
          await app.loadGraphData(savedThreeWidgets(), false)
          const { tracker } = historyOfTheOpenWorkflow()
          const node = comfy.graph.node('1')
          assert(node)
          change(node.widgets)
          const made = shown()
          await tracker.undo()
          const undone = shown()
          await tracker.redo()
          const redone = shown()
          comfy.graph.node('1')?.setTitle('a later edit')
          await tracker.undo()
          const laterUndone = shown()
          await app.loadGraphData(
            structuredClone(app.rootGraph.serialize()) as ComfyWorkflowJSON,
            false
          )
          return { made, undone, redone, laterUndone, reloaded: shown() }
        }

        const changes: Record<string, (widgets: WidgetCollection) => void> = {
          reorder: (widgets) => widgets.reorder(['c', 'a', 'b']),
          move: (widgets) => widgets.move('c', 0),
          remove: (widgets) => {
            widgets.remove('a')
          },
          add: (widgets) => {
            widgets.add({ type: 'number', name: 'd', value: 40 })
          }
        }

        it.for([
          {
            change: 'reorder',
            named: false,
            made: 'c=30 a=10 b=20',
            rebuilt: 'a=30 b=10 c=20'
          },
          {
            change: 'reorder',
            named: true,
            made: 'c=30 a=10 b=20',
            rebuilt: 'a=10 b=20 c=30'
          },
          {
            change: 'move',
            named: false,
            made: 'c=30 a=10 b=20',
            rebuilt: 'a=30 b=10 c=20'
          },
          {
            change: 'move',
            named: true,
            made: 'c=30 a=10 b=20',
            rebuilt: 'a=10 b=20 c=30'
          },
          {
            change: 'remove',
            named: false,
            made: 'b=20 c=30',
            rebuilt: 'a=20 b=30 c=3'
          },
          {
            change: 'remove',
            named: true,
            made: 'b=20 c=30',
            rebuilt: 'a=1 b=20 c=30'
          },
          {
            change: 'add',
            named: false,
            made: 'a=10 b=20 c=30 d=40',
            rebuilt: 'a=10 b=20 c=30'
          },
          {
            change: 'add',
            named: true,
            made: 'a=10 b=20 c=30 d=40',
            rebuilt: 'a=10 b=20 c=30'
          }
        ])(
          'after $change with named restore $named, undo gives back the state before it, and redo, a later undo and a reload give the type’s widgets with the values the host restores',
          async ({ change, named, made, rebuilt }) => {
            const steps = await stepsAfter(named, changes[change])

            expect(steps).toEqual({
              made,
              undone: 'a=10 b=20 c=30',
              redone: rebuilt,
              laterUndone: rebuilt,
              reloaded: rebuilt
            })
          }
        )
      })

      function showTheRootGraph() {
        useComfyApiStore().provideCanvas({
          visibleGraph: () => app.rootGraph,
          canvas: () => null,
          followMoves: () => () => {},
          followDragEnds: () => () => {}
        })
      }

      it('reports what a pack changes, not what an undo or redo gives back, and a saved mode or color the rebuilt node did not start with', async () => {
        const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        showTheRootGraph()
        const { tracker } = historyOfTheOpenWorkflow()
        const heard: string[] = []
        comfy.onNodeChanged(({ property, to }) =>
          heard.push(`${property} ${String(to)}`)
        )
        const node = comfy.graph.node('1')
        assert(node)
        node.setTitle('Renamed')
        node.setMode('bypass')
        node.setColor('#123456')

        expect(heard.splice(0)).toEqual([
          'title Renamed',
          'mode bypass',
          'color #123456'
        ])

        const heardPerStep: string[][] = []
        for (const step of ['undo', 'undo', 'undo', 'redo', 'redo', 'redo']) {
          await (step === 'undo' ? tracker.undo() : tracker.redo())
          heardPerStep.push(heard.splice(0))
        }

        expect(node.getTitle()).toBe('Renamed')
        expect(heardPerStep).toEqual([
          ['mode bypass'],
          [],
          [],
          [],
          ['mode bypass'],
          ['mode bypass', 'color #123456']
        ])

        await app.loadGraphData(
          structuredClone(app.rootGraph.serialize()) as ComfyWorkflowJSON,
          false
        )

        expect(heard).toEqual(['mode bypass', 'color #123456'])
      })

      it('gives back the same handle to a node in a subgraph when undo restores the subgraph node that redo removed again', async () => {
        const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        onTestFinished(enableSubgraphNodeCreation(app.rootGraph))
        const subgraph = app.rootGraph.createSubgraph(createTestSubgraphData())
        const interior = LiteGraph.createNode('HandleProbe')
        assert(interior)
        subgraph.add(interior)
        const placement = createTestSubgraphNode(subgraph, { id: 100 })
        app.rootGraph.add(placement)
        const { tracker } = historyOfTheOpenWorkflow()
        const kept = comfy.graph.subgraphs()[0]?.node(String(interior.id))
        assert(kept)
        expect(comfy.graph.node(String(placement.id))?.remove()).toBe(true)

        await tracker.undo()
        await tracker.redo()
        expect(app.rootGraph.subgraphs.has(subgraph.id)).toBe(false)
        expect(kept.isDeleted).toBe(true)
        await tracker.undo()

        expect(kept.isDeleted).toBe(false)
        expect(comfy.graph.subgraphs()[0]?.node(String(interior.id))).toBe(kept)
      })

      it.for([
        {
          format: 'a workflow',
          load: () => app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        },
        {
          format: 'API JSON',
          load: () =>
            app.loadApiJson(
              { '1': { class_type: 'HandleProbe', inputs: {} } },
              'probe.json'
            )
        },
        { format: 'an A1111 image', load: () => importA1111ImageWithProbe() }
      ])(
        'makes an edit a pack makes when told $format loaded the first undo step, marking the workflow modified',
        async ({ load }) => {
          const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
          await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
          const { tracker, workflow } = historyOfTheOpenWorkflow()
          const unsubscribe = comfy.onWorkflowLoaded(() =>
            comfy.graph.node('1')?.setTitle('Set when loaded')
          )
          await load()
          unsubscribe()

          expect(tracker.undoQueue).toHaveLength(1)
          expect(workflow.isModified).toBe(true)
          comfy.graph.node('1')?.setTitle('Edited by the user')
          await tracker.undo()

          expect(app.rootGraph.getNodeById(toNodeId(1))?.title).toBe(
            'Set when loaded'
          )
          await tracker.undo()
          expect(app.rootGraph.getNodeById(toNodeId(1))?.title).not.toBe(
            'Set when loaded'
          )
          expect(workflow.isModified).toBe(false)
        }
      )

      const loadFormats = [
        {
          format: 'a workflow',
          load: () => app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        },
        {
          format: 'API JSON',
          load: () =>
            app.loadApiJson(
              { '1': { class_type: 'HandleProbe', inputs: {} } },
              'probe.json'
            )
        },
        { format: 'an A1111 image', load: () => importA1111ImageWithProbe() }
      ]

      it.for(loadFormats)(
        'keeps what an afterLoadGraph hook changes when $format loads as part of the loaded workflow, which the next undo does not take back',
        async ({ load }) => {
          const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
          await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
          const { tracker, workflow } = historyOfTheOpenWorkflow()
          let hookRunsLeft = 1
          mockExtensionService.invokeExtensionsAsync.mockImplementation(
            async (hook) => {
              const node = app.rootGraph.nodes.at(0)
              if (hook !== 'afterLoadGraph' || !node || !hookRunsLeft--)
                return []
              node.title = 'Set by a hook'
              return []
            }
          )
          await load()

          expect(tracker.undoQueue).toHaveLength(0)
          expect(workflow.isModified).toBe(false)
          comfy.graph.nodes()[0]?.setTitle('Edited by the user')
          const restores = vi.spyOn(app, 'loadGraphData')
          await tracker.undo()

          expect(app.rootGraph.nodes[0]?.title).toBe('Set by a hook')
          expect(
            restores.mock.calls.map(
              ([, , , , options]) => options?.restoreHistory
            )
          ).toEqual([true])
        }
      )

      it.for(loadFormats)(
        'makes a user edit while an afterLoadGraph hook of $format waits an undo step that marks the workflow modified, after what the hook changed first',
        async ({ load }) => {
          nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
          await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
          const { tracker, workflow } = historyOfTheOpenWorkflow()
          const hook = afterLoadGraphHookThatWaits(() => {
            const node = app.rootGraph.nodes.at(0)
            if (node) node.title = 'Set by a hook'
          })
          const loading = load()
          await hook.started
          tracker.userActed()
          const node = app.rootGraph.nodes[0]
          assert(node)
          node.color = '#123456'
          hook.resume()
          await loading

          expect(tracker.undoQueue).toHaveLength(1)
          expect(workflow.isModified).toBe(true)
          await tracker.undo()
          expect(app.rootGraph.nodes[0]?.color).toBeUndefined()
          expect(app.rootGraph.nodes[0]?.title).toBe('Set by a hook')
          expect(workflow.isModified).toBe(false)
        }
      )

      it('makes a user edit while an afterLoadGraph hook of an undo waits an undo step of its own, which drops redo', async () => {
        const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        const { tracker } = historyOfTheOpenWorkflow()
        comfy.graph.node('1')?.setTitle('Edited by the user')
        const hook = afterLoadGraphHookThatWaits()
        const undoing = tracker.undo()
        await hook.started
        tracker.userActed()
        const node = app.rootGraph.nodes[0]
        assert(node)
        node.color = '#123456'
        hook.resume()
        await undoing

        expect(tracker.redoQueue).toHaveLength(0)
        expect(tracker.undoQueue).toHaveLength(1)
        await tracker.undo()
        expect(app.rootGraph.nodes[0]?.color).toBeUndefined()
        expect(app.rootGraph.nodes[0]?.title).toBe('HandleProbe')
      })

      it.for([
        {
          kind: 'a load',
          reload: async () => {
            await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
          }
        },
        {
          kind: 'an undo',
          reload: (tracker: ChangeTracker) => tracker.undo()
        }
      ])(
        'keeps an edit an afterLoadGraph hook makes through a handle during $kind in the state it loads, which the next user undo does not take back',
        async ({ reload }) => {
          const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
          await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
          const { tracker } = historyOfTheOpenWorkflow()
          comfy.graph.node('1')?.setColor('#000000')
          const edits: (boolean | undefined)[] = []
          let hookRunsLeft = 1
          mockExtensionService.invokeExtensionsAsync.mockImplementation(
            async (hook) => {
              if (hook !== 'afterLoadGraph' || !hookRunsLeft--) return []
              edits.push(comfy.graph.node('1')?.setTitle('Set by a hook'))
              return []
            }
          )
          await reload(tracker)
          const undoAfterLoad = tracker.undoQueue.length

          tracker.userActed()
          expect(comfy.graph.node('1')?.setMode('bypass')).toBe(true)
          expect(comfy.graph.node('1')?.getMode()).toBe('bypass')
          await tracker.undo()

          expect(edits).toEqual([true])
          expect(comfy.graph.node('1')?.getMode()).toBe('always')
          expect(tracker.undoQueue).toHaveLength(undoAfterLoad)
          expect(app.rootGraph.getNodeById(toNodeId(1))?.title).toBe(
            'Set by a hook'
          )
        }
      )

      it('takes what an afterLoadGraph hook changes in a reload of the open workflow without making the undo before it a load', async () => {
        const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        const { tracker } = historyOfTheOpenWorkflow()
        comfy.graph.node('1')?.setTitle('Edited by the user')
        let hookRunsLeft = 1
        mockExtensionService.invokeExtensionsAsync.mockImplementation(
          async (hook) => {
            const node = app.rootGraph.nodes.at(0)
            if (hook !== 'afterLoadGraph' || !node || !hookRunsLeft--) return []
            node.color = '#123456'
            return []
          }
        )
        await app.loadGraphData(structuredClone(tracker.activeState), false)
        expect(app.rootGraph.nodes[0]?.color).toBe('#123456')
        expect(tracker.activeState.nodes[0]?.color).toBe('#123456')
        const restores = vi.spyOn(app, 'loadGraphData')

        await tracker.undo()

        expect(
          restores.mock.calls.map(
            ([, , , , options]) => options?.restoreHistory
          )
        ).toEqual([true])
      })

      it.for(['a history restore', 'an undo across a load'])(
        'keeps an onWorkflowLoaded edit made during %s in the restored state, so the next undo leaves it and redo is kept',
        async (kind) => {
          const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
          await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
          const { tracker } = historyOfTheOpenWorkflow()
          comfy.graph.node('1')?.setTitle('Edited by the user')
          if (kind === 'an undo across a load') {
            const replacement = workflowWithFixedIdAndOneNode()
            replacement.nodes[0].title = 'Replacement'
            await app.loadGraphData(replacement, false)
          }
          let armed = true
          comfy.onWorkflowLoaded(() => {
            if (!armed) return
            armed = false
            comfy.graph.node('1')?.setColor('#123456')
          })

          await tracker.undo()
          const redoAfterUndo = tracker.redoQueue.length
          tracker.captureCanvasState()
          const redoAfterClick = tracker.redoQueue.length
          comfy.graph.node('1')?.setMode('bypass')
          await tracker.undo()

          expect(redoAfterClick).toBe(redoAfterUndo)
          expect(app.rootGraph.getNodeById(toNodeId(1))?.color).toBe('#123456')
        }
      )


      it('retires the handle to a node of a replacement load when undo goes back across that load', async () => {
        const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        const { tracker } = historyOfTheOpenWorkflow()
        comfy.graph.node('1')?.setTitle('Before the replacement')
        const replacement = workflowWithFixedIdAndOneNode()
        replacement.nodes[0].title = 'Replacement'
        await app.loadGraphData(replacement, false)
        const replacementNode = comfy.graph.node('1')
        assert(replacementNode)

        await tracker.undo()

        expect(app.rootGraph.getNodeById(toNodeId(1))?.title).toBe(
          'HandleProbe'
        )
        expect(replacementNode.isDeleted).toBe(true)
        expect(replacementNode.getTitle()).toBeUndefined()
      })

      it('gives a removal hook the pack’s own handle when redo removes a node undo restored, and undo gives that handle back', async () => {
        const { comfy, packId } =
          nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        const [[nodeTypeHooks]] = vi.mocked(
          mockExtensionService.registerExtension
        ).mock.calls
        nodeTypeHooks.beforeRegisterNodeDef?.(
          LiteGraph.registered_node_types.HandleProbe,
          hostNodeDef('HandleProbe'),
          app
        )
        const removed: NodeHandle[] = []
        onTestFinished(
          comfy.defs.extend(packId, 'HandleProbe', (builder) =>
            builder.onRemoved((node) => removed.push(node))
          )
        )
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        const { tracker } = historyOfTheOpenWorkflow()
        const kept = await addedProbe(comfy)
        expect(kept.remove()).toBe(true)
        await tracker.undo()
        expect(comfy.graph.node(kept.id)).toBe(kept)
        removed.length = 0

        await tracker.redo()
        const removedByRedo = removed.filter(({ id }) => id === kept.id)
        await tracker.undo()

        expect(removedByRedo).toEqual([kept])
        expect(removedByRedo[0]).toBe(kept)
        expect(kept.isDeleted).toBe(false)
        expect(comfy.graph.node(kept.id)).toBe(kept)
      })

      it('gives a removal hook the pack’s own widget handle, still reading its widget, when redo removes a node undo restored', async () => {
        const { comfy, packId } =
          nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        const [[nodeTypeHooks]] = vi.mocked(
          mockExtensionService.registerExtension
        ).mock.calls
        nodeTypeHooks.beforeRegisterNodeDef?.(
          LiteGraph.registered_node_types.HandleProbe,
          hostNodeDef('HandleProbe'),
          app
        )
        const removed: [string, WidgetHandle | undefined, unknown][] = []
        comfy.defs.extend(packId, 'HandleProbe', (builder) => {
          builder.onCreated((node) => {
            node.widgets.add({ type: 'number', name: 'level', value: 3 })
          })
          builder.onRemoved((node) => {
            const widget = node.widgets.get('level')
            removed.push([node.id, widget, widget?.getValue()])
          })
        })
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        const { tracker } = historyOfTheOpenWorkflow()
        const kept = await addedProbe(comfy)
        expect(kept.remove()).toBe(true)
        await tracker.undo()
        const keptWidget = kept.widgets.get('level')
        assert(keptWidget)
        removed.length = 0

        await tracker.redo()
        const [[, widget, value], ...more] = removed.filter(
          ([id]) => id === kept.id
        )

        expect(more).toEqual([])
        expect(widget).toBe(keptWidget)
        expect(value).toBe(3)
      })

      it('retires the handle when undo goes back to before the node was added, so the node that takes its id next gets another', async () => {
        const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        const { tracker } = historyOfTheOpenWorkflow()
        const kept = await addedProbe(comfy)
        expect(kept.remove()).toBe(true)

        await tracker.undo()
        await tracker.undo()
        expect(kept.isDeleted).toBe(true)
        tracker.userActed()
        const next = await addedProbe(comfy)

        expect(next.id).toBe(kept.id)
        expect(next).not.toBe(kept)
        expect(kept.isDeleted).toBe(true)
        expect(tracker.redoQueue).toHaveLength(0)
      })
    })

    it('retires the handle to a node undo removed before the load hands the graph to extensions', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      const beforeAdding = structuredClone(
        app.rootGraph.serialize()
      ) as ComfyWorkflowJSON
      const undone = new LGraphNode('added, then undone')
      app.rootGraph.add(undone)
      const kept = comfy.graph.node(undone.id)
      assert(kept)
      let added = false
      mockExtensionService.invokeExtensions.mockImplementation((hook) => {
        if (hook === 'loadedGraphNode' && !added) {
          added = true
          app.rootGraph.add(new LGraphNode('added by an extension on load'))
        }
        return []
      })

      await app.loadGraphData(beforeAdding, false, false, null, {
        restoreHistory: true
      })

      expect(added).toBe(true)
      expect(app.rootGraph.getNodeById(undone.id)?.title).toBe(
        'added by an extension on load'
      )
      expect(kept.isDeleted).toBe(true)
    })

    it('retires the handle to a node an undo removed before a restored node can give its id to a node it adds', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      const spawned: (NodeHandle | undefined)[] = []
      class AddsANodeOnRestore extends LGraphNode {
        static adding = false
        override onAdded(graph: LGraph) {
          if (!AddsANodeOnRestore.adding) return
          const added = new LGraphNode('added by a restored node')
          added.addWidget('number', 'level', 2, () => {})
          graph.add(added)
          spawned.push(comfy.graph.node(String(added.id)))
        }
      }
      LiteGraph.registerNodeType('AddsANodeOnRestore', AddsANodeOnRestore)
      onTestFinished(() => {
        AddsANodeOnRestore.adding = false
      })
      await app.loadGraphData(
        {
          ...workflowWithFixedIdAndOneNode(),
          nodes: workflowWithFixedIdAndOneNode().nodes.map((node) => ({
            ...node,
            type: 'AddsANodeOnRestore'
          }))
        },
        false
      )
      const beforeAdding = structuredClone(
        app.rootGraph.serialize()
      ) as ComfyWorkflowJSON
      const undone = new LGraphNode('added, then undone')
      undone.addWidget('number', 'level', 1, () => {})
      app.rootGraph.add(undone)
      const kept = comfy.graph.node(String(undone.id))
      assert(kept)
      const keptWidget = kept.widgets.get('level')
      assert(keptWidget)

      AddsANodeOnRestore.adding = true
      await app.loadGraphData(beforeAdding, false, false, null, {
        restoreHistory: true
      })

      const [taken] = spawned
      expect(taken?.id).toBe(kept.id)
      expect(kept.isDeleted).toBe(true)
      expect(taken).not.toBe(kept)
      expect(taken?.isDeleted).toBe(false)
      expect(comfy.graph.node(kept.id)).toBe(taken)
      expect(keptWidget.getValue()).toBeUndefined()
      expect(taken?.widgets.get('level')?.getValue()).toBe(2)
    })

    it.for(['a legacy onRemoved', 'a V4 onRemoved hook'])(
      'retires a handle %s first takes while an undo removes its node, before a restored node gives that id to a node it adds',
      async (removal) => {
        const { comfy, packId } =
          nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        const takenInRemoval: (NodeHandle | undefined)[] = []
        const spawned: (NodeHandle | undefined)[] = []
        class RemovedByUndo extends LGraphNode {
          override onRemoved() {
            if (removal === 'a legacy onRemoved')
              takenInRemoval.push(comfy.graph.node(String(this.id)))
          }
        }
        class AddsANodeOnRestore extends LGraphNode {
          static adding = false
          override onAdded(graph: LGraph) {
            if (!AddsANodeOnRestore.adding) return
            AddsANodeOnRestore.adding = false
            const added = new LGraphNode('added by a restored node')
            graph.add(added)
            spawned.push(comfy.graph.node(String(added.id)))
          }
        }
        LiteGraph.registerNodeType('RemovedByUndo', RemovedByUndo)
        LiteGraph.registerNodeType('AddsANodeOnRestore', AddsANodeOnRestore)
        onTestFinished(() => {
          AddsANodeOnRestore.adding = false
        })
        if (removal === 'a V4 onRemoved hook') {
          const [[nodeTypeHooks]] = vi.mocked(
            mockExtensionService.registerExtension
          ).mock.calls
          nodeTypeHooks.beforeRegisterNodeDef?.(
            LiteGraph.registered_node_types.RemovedByUndo,
            hostNodeDef('RemovedByUndo'),
            app
          )
          onTestFinished(
            comfy.defs.extend(packId, 'RemovedByUndo', (builder) =>
              builder.onRemoved((node) => takenInRemoval.push(node))
            )
          )
        }
        await app.loadGraphData(
          {
            ...workflowWithFixedIdAndOneNode(),
            nodes: workflowWithFixedIdAndOneNode().nodes.map((node) => ({
              ...node,
              type: 'AddsANodeOnRestore'
            }))
          },
          false
        )
        const beforeAdding = structuredClone(
          app.rootGraph.serialize()
        ) as ComfyWorkflowJSON
        const undone = LiteGraph.createNode('RemovedByUndo')
        assert(undone)
        app.rootGraph.add(undone)

        AddsANodeOnRestore.adding = true
        await app.loadGraphData(beforeAdding, false, false, null, {
          restoreHistory: true
        })

        const [removed] = takenInRemoval
        const [taken] = spawned
        expect(taken?.id).toBe(String(undone.id))
        expect(removed?.id).toBe(String(undone.id))
        expect(removed).not.toBe(taken)
        expect(removed?.isDeleted).toBe(true)
        expect(removed?.getTitle()).toBeUndefined()
        expect(comfy.graph.node(String(undone.id))).toBe(taken)
      }
    )

    it('keeps the handle to a node an undo would remove when a listener cancels the configure', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      const beforeAdding = structuredClone(
        app.rootGraph.serialize()
      ) as ComfyWorkflowJSON
      const kept = comfy.graph.add('HandleProbe')
      assert(kept)
      let vetoes = 0
      app.rootGraph.events.addEventListener('configuring', (event) => {
        vetoes++
        event.preventDefault()
      })

      await app.loadGraphData(beforeAdding, false, false, null, {
        restoreHistory: true
      })

      expect(vetoes).toBe(1)
      expect(app.rootGraph.getNodeById(toNodeId(kept.id))).toBeDefined()
      expect(kept.isDeleted).toBe(false)
      expect(kept.getTitle()).toBe('HandleProbe')
      expect(comfy.graph.node(kept.id)).toBe(kept)
    })

    it('retires the handle to a node a failed undo lost, even after another node is added', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      class FailsToConfigure extends LGraphNode {
        static failing = false
        override onConfigure() {
          if (FailsToConfigure.failing) throw new Error('onConfigure failed')
        }
      }
      LiteGraph.registerNodeType('FailsToConfigure', FailsToConfigure)
      onTestFinished(() => {
        FailsToConfigure.failing = false
      })
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      const fragile = LiteGraph.createNode('FailsToConfigure')
      assert(fragile)
      app.rootGraph.add(fragile)
      const beforeAdding = structuredClone(
        app.rootGraph.serialize()
      ) as ComfyWorkflowJSON
      const undone = new LGraphNode('added, then lost by the failed undo')
      app.rootGraph.add(undone)
      const kept = comfy.graph.node(undone.id)
      assert(kept)

      FailsToConfigure.failing = true
      await expect(
        app.loadGraphData(beforeAdding, false, false, null, {
          restoreHistory: true
        })
      ).resolves.toBe(false)
      FailsToConfigure.failing = false
      app.rootGraph.add(new LGraphNode('added after the failed undo'))

      expect(kept.isDeleted).toBe(true)
      expect(kept.getTitle()).toBeUndefined()
    })

    describe('a mounted widget a pack listens to', () => {
      function packThatMountsAndListens() {
        const { comfy, packId } =
          nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        const [[nodeTypeHooks]] = vi.mocked(
          mockExtensionService.registerExtension
        ).mock.calls
        nodeTypeHooks.beforeRegisterNodeDef?.(
          LiteGraph.registered_node_types.HandleProbe,
          hostNodeDef('HandleProbe'),
          app
        )
        const heard: string[] = []
        comfy.defs.extend(packId, 'HandleProbe', (builder) =>
          builder.onCreated((node) => {
            node.setSerializeWidgets(true)
            const mounted = node.widgets.mount({
              name: 'm',
              defaultValue: 'default',
              render: () => {}
            })
            mounted?.on('change', (to, from) =>
              heard.push(`change ${String(from)} ${String(to)}`)
            )
            mounted?.on('activate', (value) =>
              heard.push(`activate ${String(value)}`)
            )
          })
        )
        return { heard }
      }

      function savedWithValue(value: string): ComfyWorkflowJSON {
        const workflow = workflowWithFixedIdAndOneNode()
        return {
          ...workflow,
          nodes: workflow.nodes.map((node) => ({
            ...node,
            widgets_values: [value]
          }))
        }
      }

      function mountedWidget() {
        const widget = app.rootGraph
          .getNodeById(toNodeId(1))
          ?.widgets?.find(({ name }) => name === 'm')
        assert(widget instanceof BaseWidget)
        return widget
      }

      it('hears nothing while a load or an undo restores its value, and hears the next commit', async () => {
        const { heard } = packThatMountsAndListens()

        await app.loadGraphData(savedWithValue('loaded'), false)
        await app.loadGraphData(savedWithValue('undone'), false, false, null, {
          restoreHistory: true
        })

        expect(mountedWidget().value).toBe('undone')
        expect(heard).toEqual([])

        mountedWidget().value = 'typed'

        expect(heard).toEqual(['change undone typed', 'activate typed'])
      })

      it('hears a canvas commit once as a change and twice as an activation, as the DOM widget runs its callback twice', async () => {
        const { heard } = packThatMountsAndListens()
        await app.loadGraphData(savedWithValue('loaded'), false)
        const node = app.rootGraph.getNodeById(toNodeId(1))
        assert(node)

        mountedWidget().setValue('typed', { node })

        expect(heard).toEqual([
          'change loaded typed',
          'activate typed',
          'activate typed'
        ])
      })

      it('hears nothing while the host suppresses change capture for an import, and hears again after', async () => {
        const { heard } = packThatMountsAndListens()
        await app.loadGraphData(savedWithValue('loaded'), false)

        const release = beginChangeCaptureSuppression()
        mountedWidget().value = 'imported'
        release()
        mountedWidget().value = 'typed'

        expect(heard).toEqual(['change imported typed', 'activate typed'])
      })
    })

    it('retires the handles of the open document when a load freezes it, and gives working ones once that load is replaced before it configures the graph', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      const outgoing = comfy.graph.node('1')
      assert(outgoing)
      let checks = 0

      await expect(
        app.loadGraphData(workflowWithFixedIdAndOneNode(), false, true, null, {
          isCurrent: () => ++checks === 1
        })
      ).resolves.toBe(false)

      expect(checks).toBeGreaterThan(1)
      expect(outgoing.isDeleted).toBe(true)
      const fresh = comfy.graph.node('1')
      expect(fresh).not.toBe(outgoing)
      expect(fresh?.setTitle('Still on screen')).toBe(true)
      expect(app.rootGraph.getNodeById(toNodeId(1))?.title).toBe(
        'Still on screen'
      )
    })

    it('gives working handles in the open document once a load that froze it fails before it configures the graph', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook) => {
          if (hook === 'beforeConfigureGraph') throw new Error('Refused')
          return []
        }
      )

      await expect(
        app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      ).resolves.toBe(false)

      expect(comfy.graph.node('1')?.setTitle('Still on screen')).toBe(true)
      expect(app.rootGraph.getNodeById(toNodeId(1))?.title).toBe(
        'Still on screen'
      )
    })

    it('refuses an edit through a handle to the outgoing document once the load freezes it, through a handle taken before or after the freeze', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      const before = comfy.graph.node('1')
      assert(before)
      const edits: (boolean | undefined)[] = []
      let takenDuringLoad: NodeHandle | undefined
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook) => {
          if (hook !== 'beforeConfigureGraph') return []
          takenDuringLoad = comfy.graph.node('1')
          edits.push(
            before.setTitle('Lost'),
            takenDuringLoad?.setTitle('Lost too')
          )
          return []
        }
      )

      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)

      expect(edits).toEqual([false, false])
      expect(takenDuringLoad?.isDeleted).toBe(true)
      expect(comfy.graph.node('1')?.isDeleted).toBe(false)
      expect(comfy.graph.node('1')).not.toBe(takenDuringLoad)
    })

    it.for([{ clean: true }, { clean: false }])(
      'refuses an edit to the graph between the freeze and the configure, which would discard it (clean $clean)',
      async ({ clean }) => {
        const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        const staged: (NodeHandle | undefined)[] = []
        let hookRunsLeft = 1
        mockExtensionService.invokeExtensionsAsync.mockImplementation(
          async (hook) => {
            if (hook !== 'beforeConfigureGraph' || !hookRunsLeft--) return []
            staged.push(comfy.graph.add('HandleProbe'))
            return []
          }
        )

        await app.loadGraphData(workflowWithFixedIdAndOneNode(), clean)

        expect(staged).toEqual([undefined])
        expect(app.rootGraph.nodes.map(({ id }) => String(id))).toEqual(['1'])
      }
    )

    async function importA1111ImageWithProbe() {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        parameters: 'positive\nNegative prompt: negative\nSteps: 20'
      })
      mockImportA1111.mockImplementation(
        async (incomingGraph, _parameters, beforeGraphClear) => {
          await beforeGraphClear?.()
          incomingGraph.clear()
          const probe = LiteGraph.createNode('HandleProbe')
          assert(probe)
          incomingGraph.add(probe)
          return 'imported'
        }
      )
      await app.handleFile(createTestFile('a1111.png', 'image/png'))
    }

    it.for([
      {
        format: 'API JSON',
        load: () =>
          app.loadApiJson(
            { '1': { class_type: 'HandleProbe', inputs: {} } },
            'probe.json'
          )
      },
      { format: 'an A1111 image', load: () => importA1111ImageWithProbe() }
    ])(
      'refuses an edit to the outgoing document once $format freezes it, and keeps the handles of the import',
      async ({ load }) => {
        const { comfy, takenWhileLoading } =
          nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
        const before = comfy.graph.node('1')
        assert(before)
        takenWhileLoading.length = 0
        const edits: (boolean | undefined)[] = []
        app.rootGraph.nodes[0].onRemoved = () => {
          edits.push(
            before.setTitle('Lost'),
            comfy.graph.node('1')?.setTitle('Lost too')
          )
        }

        await load()

        expect(edits).toEqual([false, false])
        expect(before.isDeleted).toBe(true)
        expect(takenWhileLoading.map(({ isDeleted }) => isDeleted)).toEqual([
          false
        ])
      }
    )

    it.for(['a legacy onRemoved', 'a V4 onRemoved hook'])(
      'gives %s the outgoing node retired when a load that does not clean first replaces it with a node of the same id',
      async (removal) => {
        const { comfy, packId } =
          nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        const removed: (NodeHandle | undefined)[] = []
        class RemovedByLoad extends LGraphNode {
          override onRemoved() {
            if (removal === 'a legacy onRemoved')
              removed.push(comfy.graph.node(String(this.id)))
          }
        }
        LiteGraph.registerNodeType('RemovedByLoad', RemovedByLoad)
        if (removal === 'a V4 onRemoved hook') {
          const [[nodeTypeHooks]] = vi.mocked(
            mockExtensionService.registerExtension
          ).mock.calls
          nodeTypeHooks.beforeRegisterNodeDef?.(
            LiteGraph.registered_node_types.RemovedByLoad,
            hostNodeDef('RemovedByLoad'),
            app
          )
          onTestFinished(
            comfy.defs.extend(packId, 'RemovedByLoad', (builder) =>
              builder.onRemoved((node) => removed.push(node))
            )
          )
        }
        const workflow = (): ComfyWorkflowJSON => ({
          ...workflowWithFixedIdAndOneNode(),
          nodes: workflowWithFixedIdAndOneNode().nodes.map((node) => ({
            ...node,
            type: 'RemovedByLoad'
          }))
        })
        await app.loadGraphData(workflow(), false)

        await app.loadGraphData(workflow(), false)

        const [outgoing] = removed
        expect(removed).toHaveLength(1)
        expect(outgoing?.isDeleted).toBe(true)
        expect(outgoing?.setTitle('Lost')).toBe(false)
        expect(comfy.graph.node('1')).not.toBe(outgoing)
        expect(app.rootGraph.getNodeById(toNodeId(1))?.title).toBe(
          'RemovedByLoad'
        )
      }
    )

    it('retires handles on a load after a pack removes the published API', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      const kept = comfy.graph.node('1')
      assert(kept)

      delete window.comfy_v4
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)

      expect(kept.isDeleted).toBe(true)
      expect(comfy.graph.node('1')).not.toBe(kept)
    })

    it('keeps a handle when a load is refused before it starts', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      const kept = comfy.graph.node('1')
      assert(kept)

      await expect(
        app.loadGraphData(workflowWithFixedIdAndOneNode(), false, true, null, {
          isCurrent: () => false
        })
      ).resolves.toBe(false)

      expect(kept.isDeleted).toBe(false)
    })

    it.for([
      {
        format: 'a workflow',
        load: () => app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      },
      {
        format: 'API JSON',
        load: () =>
          app.loadApiJson(
            { '1': { class_type: 'HandleProbe', inputs: {} } },
            'probe.json'
          )
      }
    ])(
      'tells a hook that a node joins while $format loads',
      async ({ load }) => {
        const { comfy, packId } =
          nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        const [[nodeTypeHooks]] = vi.mocked(
          mockExtensionService.registerExtension
        ).mock.calls
        nodeTypeHooks.beforeRegisterNodeDef?.(
          LiteGraph.registered_node_types.HandleProbe,
          hostNodeDef('HandleProbe'),
          app
        )
        const events: NodeCreatedEvent[] = []
        onTestFinished(
          comfy.defs.extend(packId, 'HandleProbe', (builder) =>
            builder.onCreated((_, event) => events.push(event))
          )
        )

        await load()

        expect(events).toEqual([{ restored: true, loading: true }])
      }
    )

    it.for([
      {
        format: 'a workflow',
        load: () => app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      },
      {
        format: 'API JSON',
        load: () =>
          app.loadApiJson(
            { '1': { class_type: 'HandleProbe', inputs: {} } },
            'probe.json'
          )
      },
      {
        format: 'an A1111 image',
        load: async () => {
          vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
            parameters: 'positive\nNegative prompt: negative\nSteps: 20'
          })
          mockImportA1111.mockImplementation(
            async (incomingGraph, _parameters, beforeGraphClear) => {
              await beforeGraphClear?.()
              incomingGraph.clear()
              const probe = LiteGraph.createNode('HandleProbe')
              assert(probe)
              incomingGraph.add(probe)
              return 'imported'
            }
          )
          await app.handleFile(createTestFile('a1111.png', 'image/png'))
        }
      }
    ])(
      'retires earlier handles and keeps the ones taken while $format loads',
      async ({ load }) => {
        const { comfy, takenWhileLoading } =
          nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
        const earlier = new LGraphNode('earlier')
        app.rootGraph.add(earlier)
        const kept = comfy.graph.node(earlier.id)
        assert(kept)

        await load()

        expect(kept.isDeleted).toBe(true)
        expect(takenWhileLoading.map((handle) => handle.isDeleted)).toEqual([
          false
        ])
      }
    )

    async function importA1111ImageWithProbe() {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        parameters: 'positive\nNegative prompt: negative\nSteps: 20'
      })
      mockImportA1111.mockImplementation(
        async (incomingGraph, _parameters, beforeGraphClear) => {
          await beforeGraphClear?.()
          incomingGraph.clear()
          const probe = LiteGraph.createNode('HandleProbe')
          assert(probe)
          incomingGraph.add(probe)
          return 'imported'
        }
      )
      await app.handleFile(createTestFile('a1111.png', 'image/png'))
    }

    it.for([
      {
        format: 'a workflow',
        load: () => app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      },
      {
        format: 'an undo or redo',
        load: () =>
          app.loadGraphData(
            workflowWithFixedIdAndOneNode(),
            false,
            false,
            null,
            {
              restoreHistory: true
            }
          )
      },
      {
        format: 'API JSON',
        load: () =>
          app.loadApiJson(
            { '1': { class_type: 'HandleProbe', inputs: {} } },
            'probe.json'
          )
      },
      { format: 'an A1111 image', load: importA1111ImageWithProbe }
    ])('tells packs once that $format loaded', async ({ load }) => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      const loaded = vi.fn()
      comfy.onWorkflowLoaded(loaded)

      await load()

      expect(loaded).toHaveBeenCalledOnce()
    })

    it('does not tell packs a workflow loaded when the load fails', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      const loaded = vi.fn()
      comfy.onWorkflowLoaded(loaded)
      vi.spyOn(app.rootGraph, 'configure').mockImplementationOnce(() => {
        throw new Error('broken workflow')
      })

      await expect(
        app.loadGraphData(workflowWithFixedIdAndOneNode(), false)
      ).resolves.toBe(false)
      expect(loaded).not.toHaveBeenCalled()

      await app.loadGraphData(workflowWithFixedIdAndOneNode(), false)

      expect(loaded).toHaveBeenCalledOnce()
    })

    it('keeps the document id through undo and redo', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      useWorkflowStore().activeWorkflow = markLoaded(
        new ComfyWorkflow({ path: 'workflows/open.json', modified: 0, size: 0 })
      )
      const before = comfy.workflow.documentId()
      const seen: (string | undefined)[] = []
      comfy.onWorkflowLoaded((document) => seen.push(document?.id))

      await app.loadGraphData(
        workflowWithFixedIdAndOneNode(),
        false,
        false,
        null,
        {
          restoreHistory: true
        }
      )

      expect(before).toBeDefined()
      expect(seen).toEqual([before])
    })

    it('opens a workflow a pack hands it through the real loader', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()

      await expect(
        comfy.workflow.open(workflowWithFixedIdAndOneNode())
      ).resolves.toBe(true)

      expect(app.rootGraph.id).toBe(DOCUMENT_ID)
      expect(comfy.graph.node('1')?.type).toBe('HandleProbe')
    })

    it('loads the workflow a pack importer reads from a file the host cannot read', async () => {
      const { comfy } = nodeApiWithNodeTypeThatTakesItsHandleWhenAdded()
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue(undefined)
      comfy.workflow.registerImporter({
        id: 'test.importer',
        extensions: ['bin'],
        maxBytes: 1024,
        parse: () => ({ workflow: workflowWithFixedIdAndOneNode() })
      })

      await app.handleFile(createTestFile('graph.bin', ''))

      expect(app.rootGraph.id).toBe(DOCUMENT_ID)
    })
  })

  describe('node API in the prompt', () => {
    it('builds the prompt with the resolvers packs defined', async () => {
      onTestFinished(() => {
        delete window.comfy_v4
      })
      useComfyApiStore().publish()
      assert(window.comfy_v4)
      const packId = registerPublishedTestPack(window.comfy_v4)
      window.comfy_v4.defs.define(packId, {
        type: 'Pack/Constant',
        execution: 'frontend',
        outputs: [{ name: 'out', type: 'STRING' }],
        resolve: () => ({ 0: { literal: 'answered' } })
      })
      const graph = new LGraph()
      const constant = addNodeOfType(graph, 'Pack/Constant')
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
      constant.connect(0, consumer, 0)

      const { output } = await app.graphToPrompt(graph)

      expect(output[String(consumer.id)].inputs).toEqual({ x: 'answered' })
    })
  })

  describe('nodeOutputs', () => {
    it('does O(1) work per write instead of rebuilding the whole output record (#16008)', () => {
      // Regression for a per-write full-record rekey: each write used to
      // call `replaceOutputsFromLegacy`, an O(N) `mapKeys` rebuild of every
      // node's entry, making N sequential output writes O(N^2) overall. A
      // reintroduction of that path would fail this by calling
      // `replaceOutputsFromLegacy` and by triggering more than one
      // `setOutputFromLegacy` commit per single-key write.
      app.vueAppReady = true
      const nodeCount = 50
      const storedOutputs = new Map<string, NodeExecutionOutput>()
      vi.mocked(useNodeOutputStore().setOutputFromLegacy).mockImplementation(
        (id, output) => storedOutputs.set(id, output)
      )

      for (let i = 0; i < nodeCount; i++) {
        vi.mocked(useNodeOutputStore().setOutputFromLegacy).mockClear()
        app.nodeOutputs[String(i)] = { images: [{ filename: `${i}.png` }] }
        expect(useNodeOutputStore().setOutputFromLegacy).toHaveBeenCalledOnce()
        expect(useNodeOutputStore().setOutputFromLegacy).toHaveBeenCalledWith(
          String(i),
          {
            images: [{ filename: `${i}.png` }]
          }
        )
      }

      expect(
        useNodeOutputStore().replaceOutputsFromLegacy
      ).not.toHaveBeenCalled()

      expect(storedOutputs.size).toBe(nodeCount)
      for (let i = 0; i < nodeCount; i++) {
        expect(storedOutputs.get(String(i))).toEqual({
          images: [{ filename: `${i}.png` }]
        })
      }
    })

    it('commits legacy property mutations to the output store', () => {
      app.vueAppReady = true
      const output = { images: [{ filename: 'legacy.png' }] }

      app.nodeOutputs['1'] = output
      expect(useNodeOutputStore().setOutputFromLegacy).toHaveBeenCalledWith(
        '1',
        output
      )
      delete app.nodeOutputs['1']
      expect(useNodeOutputStore().removeOutputFromLegacy).toHaveBeenCalledWith(
        '1'
      )
    })

    it('commits nested legacy output mutations to the output store', () => {
      app.vueAppReady = true
      app.nodeOutputs['1'] = { images: [{ filename: 'first.png' }] }
      vi.mocked(useNodeOutputStore().setOutputFromLegacy).mockClear()

      const output = app.nodeOutputs['1']
      output.images = [{ filename: 'second.png' }]
      expect(useNodeOutputStore().setOutputFromLegacy).toHaveBeenCalledWith(
        '1',
        { images: [{ filename: 'second.png' }] }
      )
      vi.mocked(useNodeOutputStore().setOutputFromLegacy).mockClear()
      const images = output.images
      images.push({ filename: 'third.png' })
      expect(useNodeOutputStore().setOutputFromLegacy).toHaveBeenCalledWith(
        '1',
        {
          images: [{ filename: 'second.png' }, { filename: 'third.png' }]
        }
      )
      expect(app.nodeOutputs['1']).toBe(output)
      expect(output.images).toBe(images)

      vi.mocked(useNodeOutputStore().setOutputFromLegacy).mockClear()
      const image = images[0]
      image.filename = 'mutated.png'
      expect(useNodeOutputStore().setOutputFromLegacy).toHaveBeenCalledWith(
        '1',
        {
          images: [{ filename: 'mutated.png' }, { filename: 'third.png' }]
        }
      )
      expect(images[0]).toBe(image)
    })

    it('commits shared output mutations to the accessed entry', () => {
      app.vueAppReady = true
      const shared = { images: [{ filename: 'first.png' }] }
      app.nodeOutputs['1'] = shared
      app.nodeOutputs['2'] = shared
      void app.nodeOutputs['1']
      const second = app.nodeOutputs['2']
      vi.mocked(useNodeOutputStore().setOutputFromLegacy).mockClear()

      second.images = [{ filename: 'second.png' }]

      expect(useNodeOutputStore().setOutputFromLegacy).toHaveBeenCalledOnce()
      expect(useNodeOutputStore().setOutputFromLegacy).toHaveBeenCalledWith(
        '2',
        shared
      )
    })

    it('commits only the changed entry after whole-record assignment', () => {
      app.vueAppReady = true
      app.nodeOutputs = { '1': { images: [{ filename: 'first.png' }] } }
      vi.mocked(useNodeOutputStore().setOutputFromLegacy).mockClear()

      const second = { images: [{ filename: 'second.png' }] }
      app.nodeOutputs['2'] = second

      expect(useNodeOutputStore().setOutputFromLegacy).toHaveBeenCalledOnce()
      expect(useNodeOutputStore().setOutputFromLegacy).toHaveBeenCalledWith(
        '2',
        second
      )
    })
  })

  describe('queuePrompt', () => {
    function prepareEmptyPromptQueue() {
      const workflow = new ComfyWorkflow({
        path: 'workflows/review.json',
        modified: 0,
        size: 0
      })
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      onTestFinished(attachLegacyUI(app))
      workflow.adoptGraph(graph)
      useWorkflowStore().activeWorkflow = markLoaded(workflow)
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: {},
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
      return workflow
    }

    function addSeedNode(graph: LGraph) {
      vi.mocked(executeWidgetsCallback).mockReset()
      const node = new LGraphNode('Seed')
      node.comfyClass = 'Seed'
      const seed = node.addWidget('number', 'seed', 0, () => {})
      seed.afterQueued = () => {
        seed.value = Number(seed.value) + 1
      }
      graph.add(node)
      return { node, seed }
    }

    function queueBatchStoppedToast(queued: number, requested: number) {
      return t('toastMessages.batchStoppedOnWorkflowChange', {
        queued,
        requested
      })
    }

    it('stops a batch when the active workflow changes mid-batch, after submitting each item with its own widget values', async () => {
      prepareEmptyPromptQueue()
      vi.mocked(app.graphToPrompt).mockRestore()
      const { node } = addSeedNode(app.rootGraph)
      const otherWorkflow = new ComfyWorkflow({
        path: 'workflows/other.json',
        modified: 0,
        size: 0
      })
      const seeds: unknown[] = []
      vi.spyOn(api, 'queuePrompt').mockImplementation((_number, data) => {
        seeds.push(data.output[String(node.id)].inputs.seed)
        if (seeds.length === 2) {
          useWorkflowStore().activeWorkflow = markLoaded(otherWorkflow)
        }
        return Promise.resolve({ prompt_id: `job-${seeds.length}` })
      })

      await expect(app.queuePrompt(0, 3)).resolves.toBe(true)

      expect(seeds).toEqual([0, 1])
    })

    it('advances widgets of the submitted workflow when another graph is shown during serialization', async () => {
      prepareEmptyPromptQueue()
      const queued = addSeedNode(app.rootGraph)
      const otherGraph = new LGraph()
      const other = addSeedNode(otherGraph)
      vi.spyOn(app, 'graphToPrompt').mockImplementation(async () => {
        Reflect.set(app, 'rootGraphInternal', otherGraph)
        return { output: {}, workflow: createWorkflowGraphData() }
      })
      const queuePrompt = vi
        .spyOn(api, 'queuePrompt')
        .mockResolvedValue({ prompt_id: 'job-1' })

      await expect(app.queuePrompt(0, 2)).resolves.toBe(true)

      expect(queuePrompt).toHaveBeenCalledOnce()
      expect(queued.seed.value).toBe(1)
      expect(other.seed.value).toBe(0)
    })

    it('pins a queued batch to the workflow active when it was queued, not the one active once authentication resolves', async () => {
      prepareEmptyPromptQueue()
      let serialised = 0
      vi.spyOn(app, 'graphToPrompt').mockImplementation(async () => {
        serialised++
        return { output: {}, workflow: createWorkflowGraphData() }
      })

      const otherWorkflow = new ComfyWorkflow({
        path: 'workflows/other.json',
        modified: 0,
        size: 0
      })
      let resolveToken: (token: string) => void = () => {}
      vi.mocked(useAuthStore().getWorkspaceAuthToken).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveToken = resolve
        })
      )
      const submitted: string[] = []
      vi.spyOn(api, 'queuePrompt').mockImplementation(() => {
        submitted.push(`job-${submitted.length + 1}`)
        return Promise.resolve({ prompt_id: submitted[submitted.length - 1] })
      })

      const submission = app.queuePrompt(0, 2)
      await vi.waitFor(() =>
        expect(useAuthStore().getWorkspaceAuthToken).toHaveBeenCalledOnce()
      )
      useWorkflowStore().activeWorkflow = markLoaded(otherWorkflow)
      resolveToken('workspace-token')

      await expect(submission).resolves.toBe(true)

      expect(submitted).toEqual([])
      expect(serialised).toBe(0)
      expect(useToast().warning).toHaveBeenCalledWith(
        t('toastMessages.batchStoppedOnWorkflowChange', {
          queued: 0,
          requested: 2
        })
      )
    })

    it.for([
      {
        load: 'an in-place reload of the queueing workflow',
        start: (workflow: ComfyWorkflow) =>
          app.loadGraphData(createWorkflowGraphData(), true, true, workflow)
      },
      {
        load: 'an API JSON import',
        start: () => app.loadApiJson({}, 'imported.json')
      }
    ])('stops a batch while $load has not finished', async ({ start }) => {
      const workflow = prepareEmptyPromptQueue()
      useWorkflowStore().attachWorkflow(workflow)
      app.canvasElRef.value = document.createElement('canvas')
      let releaseHook!: () => void
      const hookHeld = new Promise<void>((resolve) => {
        releaseHook = resolve
      })
      let hookReached = false
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook: string) => {
          if (hook !== 'afterConfigureGraph') return
          hookReached = true
          await hookHeld
        }
      )
      let load: Promise<unknown> | undefined
      const queuePrompt = vi
        .spyOn(api, 'queuePrompt')
        .mockImplementation(async () => {
          load ??= start(workflow)
          await vi.waitFor(() => expect(hookReached).toBe(true))
          return { prompt_id: 'job-1' }
        })

      await expect(app.queuePrompt(0, 2)).resolves.toBe(true)

      try {
        expect(queuePrompt).toHaveBeenCalledOnce()
        expect(useToast().warning).toHaveBeenCalledWith(
          queueBatchStoppedToast(1, 2)
        )
      } finally {
        releaseHook()
        await load
      }
    })

    it('stops a batch when its queueing graph is reconfigured in place by a load that finishes before the next iteration runs', async () => {
      const workflow = prepareEmptyPromptQueue()
      useWorkflowStore().attachWorkflow(workflow)
      app.canvasElRef.value = document.createElement('canvas')
      let calls = 0
      const queuePrompt = vi
        .spyOn(api, 'queuePrompt')
        .mockImplementation(async () => {
          calls++
          if (calls === 1) {
            await app.loadGraphData(
              createWorkflowGraphData(),
              false,
              true,
              null
            )
          }
          return { prompt_id: `job-${calls}` }
        })

      await expect(app.queuePrompt(0, 2)).resolves.toBe(true)

      expect(queuePrompt).toHaveBeenCalledOnce()
      expect(isGraphLoading(app.rootGraph)).toBe(false)
      expect(useToast().warning).toHaveBeenCalledWith(
        queueBatchStoppedToast(1, 2)
      )
    })

    it('refuses a prompt whose queueing graph reloads while widget serialization is suspended', async () => {
      const workflow = prepareEmptyPromptQueue()
      useWorkflowStore().attachWorkflow(workflow)
      app.canvasElRef.value = document.createElement('canvas')
      const queued = addSeedNode(app.rootGraph)
      let releaseSerialization!: () => void
      const serializationHeld = new Promise<void>((resolve) => {
        releaseSerialization = resolve
      })
      let serializationStarted = false
      vi.spyOn(app, 'graphToPrompt').mockImplementation(async () => {
        serializationStarted = true
        await serializationHeld
        return { output: {}, workflow: createWorkflowGraphData() }
      })
      const queuePrompt = vi.spyOn(api, 'queuePrompt')

      const submission = app.queuePrompt(0, 2)
      await vi.waitFor(() => expect(serializationStarted).toBe(true))
      await app.loadGraphData(createWorkflowGraphData(), false, false, workflow)
      releaseSerialization()

      await expect(submission).resolves.toBe(true)

      expect(queuePrompt).not.toHaveBeenCalled()
      expect(queued.seed.value).toBe(0)
      expect(useToast().warning).toHaveBeenCalledWith(
        queueBatchStoppedToast(0, 2)
      )
    })

    it('waits for workspace authentication before submitting the prompt', async () => {
      prepareEmptyPromptQueue()
      let resolveToken: (token: string) => void = () => {}
      vi.mocked(useAuthStore().getWorkspaceAuthToken).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveToken = resolve
        })
      )
      const queuePrompt = vi
        .spyOn(api, 'queuePrompt')
        .mockImplementation(() => {
          expect(api.authToken).toBe('workspace-token')
          return Promise.resolve({ prompt_id: 'job-1' })
        })

      const submission = app.queuePrompt(0)
      await vi.waitFor(() =>
        expect(useAuthStore().getWorkspaceAuthToken).toHaveBeenCalledOnce()
      )
      expect(queuePrompt).not.toHaveBeenCalled()

      resolveToken('workspace-token')
      await expect(submission).resolves.toBe(true)
      expect(queuePrompt).toHaveBeenCalledOnce()
    })

    it('sends only the Desktop host credential, never a stored personal key', async () => {
      prepareEmptyPromptQueue()
      await startDesktopHostSession({
        getState: async () => ({ status: 'signed_in', userId: 'host-user' }),
        getWorkspaceToken: async () => 'host-token',
        requestSignIn: async () => ({
          status: 'signed_in',
          userId: 'host-user'
        }),
        signOut: async () => ({ status: 'signed_out' }),
        onChanged: () => () => {}
      })
      vi.mocked(useApiKeyAuthStore().getApiKey).mockReturnValue('stored-key')
      Object.assign(useApiKeyAuthStore(), { isAuthenticated: true })
      vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValueOnce(
        'host-token'
      )
      const queuePrompt = vi
        .spyOn(api, 'queuePrompt')
        .mockImplementation(() => {
          expect(api.authToken).toBe('host-token')
          expect(api.apiKey).toBeUndefined()
          return Promise.resolve({ prompt_id: 'job-1' })
        })

      try {
        await expect(app.queuePrompt(0)).resolves.toBe(true)
        expect(queuePrompt).toHaveBeenCalledOnce()
      } finally {
        stopDesktopHostSession()
      }
    })

    it('waits for a workspace switch before selecting the billing context', async () => {
      prepareEmptyPromptQueue()
      let finishSwitch: () => void = () => {}
      vi.mocked(
        useTeamWorkspaceStore().waitForWorkspaceSwitch
      ).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishSwitch = () => {
              Object.assign(useTeamWorkspaceStore(), {
                activeWorkspaceId: 'workspace-b'
              })
              resolve()
            }
          })
      )
      vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValueOnce(
        'workspace-token-b'
      )
      const queuePrompt = vi
        .spyOn(api, 'queuePrompt')
        .mockImplementation(() => {
          expect(api.authToken).toBe('workspace-token-b')
          return Promise.resolve({ prompt_id: 'job-1' })
        })

      const submission = app.queuePrompt(0)
      await vi.waitFor(() =>
        expect(
          useTeamWorkspaceStore().waitForWorkspaceSwitch
        ).toHaveBeenCalledOnce()
      )

      expect(useAuthStore().getWorkspaceAuthToken).not.toHaveBeenCalled()
      expect(app.graphToPrompt).not.toHaveBeenCalled()
      expect(queuePrompt).not.toHaveBeenCalled()

      finishSwitch()
      await expect(submission).resolves.toBe(true)

      expect(useAuthStore().getWorkspaceAuthToken).toHaveBeenCalledOnce()
      expect(queuePrompt).toHaveBeenCalledOnce()
    })

    it('does not submit when an in-progress workspace switch fails', async () => {
      prepareEmptyPromptQueue()
      vi.mocked(
        useTeamWorkspaceStore().waitForWorkspaceSwitch
      ).mockRejectedValueOnce(new Error('Token exchange failed'))
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      expect(useAuthStore().getWorkspaceAuthToken).not.toHaveBeenCalled()
      expect(app.graphToPrompt).not.toHaveBeenCalled()
      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it.skipIf(isCloud)(
      'uses a workspace initialized while local authentication is pending',
      async () => {
        prepareEmptyPromptQueue()
        Object.assign(useTeamWorkspaceStore(), {
          activeWorkspaceId: null
        })
        vi.mocked(useAuthStore().getWorkspaceAuthToken).mockImplementationOnce(
          async () => {
            Object.assign(useTeamWorkspaceStore(), {
              activeWorkspaceId: 'workspace-a'
            })
            return 'workspace-token'
          }
        )
        const queuePrompt = vi
          .spyOn(api, 'queuePrompt')
          .mockImplementation(() => {
            expect(api.authToken).toBe('workspace-token')
            return Promise.resolve({ prompt_id: 'job-1' })
          })

        await expect(app.queuePrompt(0)).resolves.toBe(true)

        expect(queuePrompt).toHaveBeenCalledOnce()
      }
    )

    it.skipIf(!isCloud)(
      'does not submit when a cloud workspace appears during authentication',
      async () => {
        prepareEmptyPromptQueue()
        Object.assign(useTeamWorkspaceStore(), {
          activeWorkspaceId: null
        })
        vi.mocked(useAuthStore().getWorkspaceAuthToken).mockImplementationOnce(
          async () => {
            Object.assign(useTeamWorkspaceStore(), {
              activeWorkspaceId: 'workspace-a'
            })
            return 'firebase-token'
          }
        )
        const queuePrompt = vi.spyOn(api, 'queuePrompt')
        const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

        await expect(app.queuePrompt(0)).resolves.toBe(false)

        expect(queuePrompt).not.toHaveBeenCalled()
        expect(showDialog).toHaveBeenCalledOnce()
      }
    )

    it('does not submit when the workspace changes during authentication', async () => {
      prepareEmptyPromptQueue()
      vi.mocked(useAuthStore().getWorkspaceAuthToken).mockImplementationOnce(
        async () => {
          Object.assign(useTeamWorkspaceStore(), {
            activeWorkspaceId: 'workspace-b'
          })
          return 'workspace-token-a'
        }
      )
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it('does not submit a prompt after the active workspace changes', async () => {
      prepareEmptyPromptQueue()
      let finishPromptBuild: () => void = () => {}
      vi.spyOn(app, 'graphToPrompt').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishPromptBuild = () =>
              resolve({
                output: {},
                workflow: createWorkflowGraphData()
              })
          })
      )
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      const submission = app.queuePrompt(0)
      await vi.waitFor(() => expect(app.graphToPrompt).toHaveBeenCalledOnce())
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-b'
      })
      finishPromptBuild()

      await expect(submission).resolves.toBe(false)
      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it('does not fall back to an API key when workspace authentication fails', async () => {
      prepareEmptyPromptQueue()
      vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValueOnce(
        undefined
      )
      vi.mocked(useApiKeyAuthStore().getApiKey).mockReturnValueOnce('api-key')
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      await expect(app.queuePrompt(0)).resolves.toBe(false)
      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it('does not accept the API key when a Firebase session lost its workspace token', async () => {
      prepareEmptyPromptQueue()
      useAuthStore().currentUser = fromPartial({
        uid: 'firebase-user'
      })
      Object.assign(useApiKeyAuthStore(), { isAuthenticated: true })
      vi.mocked(useApiKeyAuthStore().getApiKey).mockReturnValue('api-key')
      vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValueOnce(
        undefined
      )
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      await expect(app.queuePrompt(0)).resolves.toBe(false)
      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it('does not accept the API key when a session-only SSO tab lost its workspace token', async () => {
      prepareEmptyPromptQueue()
      Object.assign(useAuthStore(), {
        sessionOnlyUser: { id: 'sso-user', email: 'sso@example.com' }
      })
      Object.assign(useApiKeyAuthStore(), { isAuthenticated: true })
      vi.mocked(useApiKeyAuthStore().getApiKey).mockReturnValue('api-key')
      vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValueOnce(
        undefined
      )
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      await expect(app.queuePrompt(0)).resolves.toBe(false)
      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it('submits with the validated API key when the key session has a workspace', async () => {
      prepareEmptyPromptQueue()
      Object.assign(useApiKeyAuthStore(), { isAuthenticated: true })
      vi.mocked(useApiKeyAuthStore().getApiKey).mockReturnValue(
        'comfyui-valid-key'
      )
      vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValueOnce(
        undefined
      )
      const queuePrompt = vi
        .spyOn(api, 'queuePrompt')
        .mockImplementation(() => {
          expect(api.apiKey).toBe('comfyui-valid-key')
          return Promise.resolve({ prompt_id: 'job-1' })
        })

      await expect(app.queuePrompt(0)).resolves.toBe(true)
      expect(queuePrompt).toHaveBeenCalledOnce()
    })

    it('does not submit after switching away and back to the same workspace', async () => {
      prepareEmptyPromptQueue()
      vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValueOnce(
        'workspace-token'
      )
      let finishPromptBuild: () => void = () => {}
      vi.spyOn(app, 'graphToPrompt').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishPromptBuild = () =>
              resolve({
                output: {},
                workflow: createWorkflowGraphData()
              })
          })
      )
      const queuePrompt = vi.spyOn(api, 'queuePrompt')
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

      const submission = app.queuePrompt(0)
      await vi.waitFor(() => expect(app.graphToPrompt).toHaveBeenCalledOnce())
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-b',
        workspaceTransitionGeneration: 1
      })
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-a',
        workspaceTransitionGeneration: 2
      })
      finishPromptBuild()

      await expect(submission).resolves.toBe(false)
      expect(queuePrompt).not.toHaveBeenCalled()
      expect(showDialog).toHaveBeenCalledOnce()
    })

    it('preserves missing node packs when submitting a prompt', async () => {
      prepareEmptyPromptQueue()
      const missingNodesStore = useMissingNodesErrorStore()
      const executionErrorStore = useExecutionErrorStore()
      missingNodesStore.setMissingNodeTypes(['test/UninstalledLiveNode'])
      executionErrorStore.recordExecutionError({
        prompt_id: 'previous-run',
        timestamp: 0,
        node_id: '1',
        node_type: 'Test',
        executed: [],
        exception_message: 'fail',
        exception_type: 'RuntimeError',
        traceback: []
      })
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1'
      })

      await app.queuePrompt(0)

      expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
        'test/UninstalledLiveNode'
      ])
      expect(executionErrorStore.lastExecutionError).toBeNull()
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
      onTestFinished(attachLegacyUI(app))
      useWorkflowStore().activeWorkflow = markLoaded(workflow)
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: promptOutput,
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1',
        node_errors: nodeErrors
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

    function prepareSkippedOutputsRun() {
      prepareEmptyPromptQueue()
      const workflow = useWorkflowStore().activeWorkflow
      if (!workflow) throw new Error('Expected an active workflow')
      const graphId = '11111111-1111-4111-8111-111111111111'
      workflow.changeTracker.activeState = {
        ...createWorkflowGraphData(),
        id: graphId
      }
      Object.assign(useWorkflowStore(), { openWorkflows: [workflow] })
      const executionStore = useExecutionStore()
      const errorStore = useExecutionErrorStore()
      errorStore.setActiveGraph(graphId, workflow.path)
      executionStore.bindExecutionEvents()
      onTestFinished(() => executionStore.unbindExecutionEvents())
      const skippedErrors = {
        '9': nodeError(
          [validationError('required_input_missing', 'images')],
          'SaveImage'
        )
      }
      const socket: EventTarget = api
      function dispatchSkippedOutputs(jobId: string) {
        executionStore.registerJobWorkflowIdMapping(jobId, graphId)
        socket.dispatchEvent(
          new CustomEvent('prompt_outputs_skipped', {
            detail: { prompt_id: jobId, node_errors: skippedErrors }
          })
        )
      }
      return { errorStore, skippedErrors, dispatchSkippedOutputs }
    }

    it('keeps skipped-output errors that arrive before the submission response', async () => {
      const { errorStore, skippedErrors, dispatchSkippedOutputs } =
        prepareSkippedOutputsRun()
      vi.spyOn(api, 'queuePrompt').mockImplementation(async () => {
        dispatchSkippedOutputs('job-1')
        return { prompt_id: 'job-1', node_errors: {} }
      })

      await app.queuePrompt(0)

      expect(errorStore.lastNodeErrors).toEqual(skippedErrors)
      expect(errorStore.isErrorOverlayOpen).toBe(true)
    })

    it("drops an older job's skipped-output errors when a newer submission comes back clean", async () => {
      const { errorStore, dispatchSkippedOutputs } = prepareSkippedOutputsRun()
      vi.spyOn(api, 'queuePrompt')
        .mockResolvedValueOnce({ prompt_id: 'job-a', node_errors: {} })
        .mockImplementationOnce(async () => {
          dispatchSkippedOutputs('job-a')
          return { prompt_id: 'job-b', node_errors: {} }
        })
      await app.queuePrompt(0)

      await expect(app.queuePrompt(0)).resolves.toBe(true)

      expect(errorStore.lastNodeErrors).toBeNull()
    })

    it('stores workflow telemetry metadata for every accepted batch submission', async () => {
      prepareEmptyPromptQueue()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome: vi.fn() })
      setTelemetryRegistry(registry)
      vi.spyOn(api, 'queuePrompt')
        .mockResolvedValueOnce({
          prompt_id: 'job-1'
        })
        .mockResolvedValueOnce({
          prompt_id: 'job-2'
        })

      try {
        await app.queuePrompt(0, 2, {
          intent: { trigger_source: 'button' }
        })

        expect(useExecutionStore().queuedJobs['job-1']).toMatchObject({
          workflowExecutionIntent: {
            trigger_source: 'button'
          },
          workflowContext: {
            workflow_type: 'custom',
            view_mode: 'graph',
            execution_scope: 'full',
            total_node_count: 0,
            executable_node_count: 0,
            custom_node_count: 0,
            api_node_count: 0,
            subgraph_count: 0
          }
        })
        expect(useExecutionStore().queuedJobs['job-2']).toMatchObject({
          workflowExecutionIntent: {
            trigger_source: 'button'
          }
        })
      } finally {
        setTelemetryRegistry(null)
      }
    })

    it('redraws and refreshes the queue UI once after submitting a batch', async () => {
      prepareEmptyPromptQueue()
      const queuePrompt = vi
        .spyOn(api, 'queuePrompt')
        .mockResolvedValueOnce({ prompt_id: 'job-1' })
        .mockResolvedValueOnce({ prompt_id: 'job-2' })
      let resolveUpdate!: () => void
      const updateQueue = vi.spyOn(app.ui.queue, 'update').mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveUpdate = resolve
          })
      )

      // The queue UI refresh is fire-and-forget: queuePrompt resolves while the
      // update is still pending, having already redrawn the canvas once.
      await app.queuePrompt(0, 2)

      expect(updateQueue).toHaveBeenCalledOnce()
      expect(queuePrompt).toHaveBeenCalledTimes(2)
      expect(mockCanvas.draw).toHaveBeenCalledOnce()

      // Settle the detached update so the test leaves no pending promise.
      resolveUpdate()
    })

    it('attributes a queued job to the mode used when submission started', async () => {
      prepareEmptyPromptQueue()
      const workflow = useWorkflowStore().activeWorkflow
      if (!workflow) throw new Error('Expected an active workflow')
      workflow.activeMode = 'graph'

      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome: vi.fn() })
      setTelemetryRegistry(registry)

      let finishPromptBuild: () => void = () => {}
      vi.spyOn(app, 'graphToPrompt').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishPromptBuild = () =>
              resolve({
                output: {},
                workflow: createWorkflowGraphData()
              })
          })
      )
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1'
      })

      try {
        const submission = app.queuePrompt(0)
        await vi.waitFor(() => expect(app.graphToPrompt).toHaveBeenCalledOnce())

        workflow.activeMode = 'app'
        finishPromptBuild()
        await expect(submission).resolves.toBe(true)

        expect(useExecutionStore().queuedJobs['job-1']).toMatchObject({
          viewMode: 'graph',
          isAppMode: false,
          workflowContext: {
            view_mode: 'graph'
          }
        })
      } finally {
        setTelemetryRegistry(null)
      }
    })

    it('tracks a resolved prompt rejection at the submission stage', async () => {
      prepareEmptyPromptQueue()
      const trackExecutionOutcome = vi.fn()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome })
      setTelemetryRegistry(registry)
      const now = vi.spyOn(performance, 'now').mockReturnValue(42)
      vi.spyOn(api, 'queuePrompt').mockImplementation(async () => {
        now.mockReturnValue(62)
        return {}
      })

      try {
        await app.queuePrompt(0)

        expect(trackExecutionOutcome).toHaveBeenCalledExactlyOnceWith({
          startTime: 42,
          endTime: 62,
          success: false,
          failureReason: 'submission_rejected',
          trigger_source: 'unknown',
          workflowContext: {
            workflow_type: 'custom',
            view_mode: 'graph',
            execution_scope: 'full',
            total_node_count: 0,
            executable_node_count: 0,
            custom_node_count: 0,
            api_node_count: 0,
            subgraph_count: 0
          }
        })
      } finally {
        now.mockRestore()
        setTelemetryRegistry(null)
      }
    })

    it('tracks a rejected queue request at the submission stage', async () => {
      prepareEmptyPromptQueue()
      const trackExecutionOutcome = vi.fn()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome })
      setTelemetryRegistry(registry)
      const now = vi.spyOn(performance, 'now').mockReturnValue(42)
      vi.spyOn(api, 'queuePrompt').mockImplementation(async () => {
        now.mockReturnValue(62)
        throw new PromptExecutionError({
          error: {
            type: 'prompt_no_outputs',
            message: 'Prompt has no outputs',
            details: ''
          }
        })
      })

      try {
        await app.queuePrompt(0)

        expect(trackExecutionOutcome).toHaveBeenCalledExactlyOnceWith({
          startTime: 42,
          endTime: 62,
          success: false,
          failureReason: 'submission_rejected',
          trigger_source: 'unknown',
          workflowContext: {
            workflow_type: 'custom',
            view_mode: 'graph',
            execution_scope: 'full',
            total_node_count: 0,
            executable_node_count: 0,
            custom_node_count: 0,
            api_node_count: 0,
            subgraph_count: 0
          }
        })
      } finally {
        now.mockRestore()
        setTelemetryRegistry(null)
      }
    })

    it('falls back to the error panel when the subscription dialog cannot open', async () => {
      prepareEmptyPromptQueue()
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError({
          error: {
            type: 'CLOUD_SUBSCRIPTION_REQUIRED',
            message: 'A cloud subscription is required',
            details: ''
          }
        })
      )
      vi.mocked(
        useBillingDialogs().showSubscriptionRequiredDialog
      ).mockResolvedValueOnce(false)

      await app.queuePrompt(0)

      expect(
        useBillingDialogs().showSubscriptionRequiredDialog
      ).toHaveBeenCalledExactlyOnceWith({
        reason: 'subscription_required',
        runRefused: true,
        creditsLocked: false,
        refusalType: 'CLOUD_SUBSCRIPTION_REQUIRED'
      })
      expect(useExecutionErrorStore().lastPromptError).toMatchObject({
        type: 'CLOUD_SUBSCRIPTION_REQUIRED'
      })
    })

    it('reports no refusal type when the server sent none', async () => {
      prepareEmptyPromptQueue()
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError({
          error: 'Subscription required to queue workflows',
          node_errors: {}
        })
      )
      vi.mocked(
        useBillingDialogs().showSubscriptionRequiredDialog
      ).mockResolvedValueOnce(true)

      await app.queuePrompt(0)

      expect(
        useBillingDialogs().showSubscriptionRequiredDialog
      ).toHaveBeenCalledExactlyOnceWith({
        reason: 'subscription_required',
        runRefused: true,
        creditsLocked: false
      })
    })

    it('tells the subscription dialog when the refused account holds locked credits', async () => {
      prepareEmptyPromptQueue()
      const refusal = {
        type: 'CLOUD_SUBSCRIPTION_REQUIRED',
        message:
          'A cloud subscription is required to use your credits on cloud.',
        details: '',
        credits_locked: true
      }
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError({ error: refusal, node_errors: {} })
      )
      vi.mocked(
        useBillingDialogs().showSubscriptionRequiredDialog
      ).mockResolvedValueOnce(true)

      await app.queuePrompt(0)

      expect(
        useBillingDialogs().showSubscriptionRequiredDialog
      ).toHaveBeenCalledExactlyOnceWith({
        reason: 'subscription_required',
        runRefused: true,
        creditsLocked: true,
        refusalType: 'CLOUD_SUBSCRIPTION_REQUIRED'
      })
    })

    it('still reports a rejected submission once the dialog takes over', async () => {
      prepareEmptyPromptQueue()
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError({
          error: {
            type: 'CLOUD_SUBSCRIPTION_REQUIRED',
            message: 'You have enough credits for this workflow',
            details: ''
          },
          node_errors: {}
        })
      )
      vi.mocked(
        useBillingDialogs().showSubscriptionRequiredDialog
      ).mockResolvedValueOnce(true)

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      expect(
        useBillingDialogs().showSubscriptionRequiredDialog
      ).toHaveBeenCalledExactlyOnceWith({
        reason: 'subscription_required',
        runRefused: true,
        creditsLocked: false,
        refusalType: 'CLOUD_SUBSCRIPTION_REQUIRED'
      })
      expect(useExecutionErrorStore().lastPromptError).toBeNull()
    })

    it('asks for a reload instead of an error when the deployment moved to another release', async () => {
      prepareEmptyPromptQueue()
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError(
          {
            error: {
              type: 'RELEASE_CHANGED',
              message: 'The deployment moved to another release.',
              release_id: 'r-3'
            }
          },
          409
        )
      )

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      expect(useToast().toasts.map((toast) => toast.title)).toEqual([
        'Runs now go to a different version. Reload to run on it.'
      ])
      expect(useExecutionErrorStore().lastPromptError).toBeNull()
      expect(useExecutionErrorStore().lastNodeErrors).toBeNull()
    })

    it('handles any other 409 as before', async () => {
      prepareEmptyPromptQueue()
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError(
          {
            error: { type: 'conflict', message: 'Busy', details: '' },
            node_errors: {}
          },
          409
        )
      )

      await app.queuePrompt(0)

      expect(useToast().toasts).toEqual([])
      expect(useExecutionErrorStore().lastPromptError).toMatchObject({
        type: 'conflict'
      })
    })

    it('records a rejected submission on the workflow that queued it', async () => {
      prepareEmptyPromptQueue()
      const executionErrorStore = useExecutionErrorStore()
      const queuedRunErrorKey = executionErrorStore.captureRunErrorKey()
      const recordPromptError = vi.spyOn(
        executionErrorStore,
        'recordPromptError'
      )
      let rejectQueue: (error: PromptExecutionError) => void = () => {}
      vi.spyOn(api, 'queuePrompt').mockImplementation(
        () =>
          new Promise((_, reject) => {
            rejectQueue = reject
          })
      )

      const submission = app.queuePrompt(0)
      await vi.waitFor(() => expect(api.queuePrompt).toHaveBeenCalledOnce())
      executionErrorStore.setActiveGraph('22222222-2222-4222-8222-222222222222')
      rejectQueue(
        new PromptExecutionError({
          error: {
            type: 'prompt_no_outputs',
            message: 'Prompt has no outputs',
            details: ''
          }
        })
      )

      await expect(submission).resolves.toBe(true)
      expect(recordPromptError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'prompt_no_outputs' }),
        queuedRunErrorKey
      )
      expect(executionErrorStore.lastPromptError).toBeNull()
    })

    it('tracks prompt construction failures at the submission stage', async () => {
      prepareEmptyPromptQueue()
      const trackExecutionOutcome = vi.fn()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome })
      setTelemetryRegistry(registry)
      const now = vi.spyOn(performance, 'now').mockReturnValue(42)
      vi.spyOn(app, 'graphToPrompt').mockImplementation(async () => {
        now.mockReturnValue(62)
        throw new Error('Prompt construction failed')
      })

      try {
        await expect(app.queuePrompt(0)).rejects.toThrow(
          'Prompt construction failed'
        )
        expect(trackExecutionOutcome).toHaveBeenCalledExactlyOnceWith({
          startTime: 42,
          endTime: 62,
          success: false,
          failureReason: 'prompt_build_failed',
          trigger_source: 'unknown'
        })
      } finally {
        now.mockRestore()
        setTelemetryRegistry(null)
      }
    })

    it('reports prompt construction failures with an id-free fingerprint', async () => {
      prepareEmptyPromptQueue()
      const failure = new Error(
        'No link found in parent graph for id [632] slot [0] images'
      )
      vi.spyOn(app, 'graphToPrompt').mockRejectedValue(failure)

      await expect(app.queuePrompt(0)).rejects.toBe(failure)
      expect(reportError).toHaveBeenCalledWith(failure, {
        surface: 'graph',
        errorType: 'error_building_prompt',
        fingerprint: [
          'error_building_prompt',
          'Error',
          'No link found in parent graph for id [] slot []'
        ],
        logToConsole: false
      })
    })

    it('stores execution intent when workflow context collection fails', async () => {
      prepareEmptyPromptQueue()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome: vi.fn() })
      setTelemetryRegistry(registry)
      vi.spyOn(
        executionContextUtils,
        'getExecutionContext'
      ).mockImplementationOnce(() => {
        throw new Error('Context unavailable')
      })
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1'
      })

      try {
        await app.queuePrompt(0, 1, {
          intent: { trigger_source: 'button' }
        })

        expect(useExecutionStore().queuedJobs['job-1']).toMatchObject({
          workflowExecutionIntent: {
            trigger_source: 'button'
          }
        })
        expect(
          useExecutionStore().queuedJobs['job-1']?.workflowContext
        ).toBeUndefined()
      } finally {
        setTelemetryRegistry(null)
      }
    })

    it('normalizes runtime queue intent from extension callers', async () => {
      prepareEmptyPromptQueue()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome: vi.fn() })
      setTelemetryRegistry(registry)
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1'
      })

      try {
        await Reflect.apply(app.queuePrompt, app, [
          0,
          1,
          {
            intent: {
              trigger_source: 'private-workflow-name'
            }
          }
        ])

        expect(
          useExecutionStore().queuedJobs['job-1']?.workflowExecutionIntent
        ).toEqual({
          trigger_source: 'unknown'
        })
      } finally {
        setTelemetryRegistry(null)
      }
    })

    it('preserves legacy partial execution calls from extensions', async () => {
      prepareEmptyPromptQueue()
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1'
      })
      const queueNodeIds = [createNodeExecutionId([1])]

      await app.queuePrompt(0, 1, queueNodeIds)

      expect(api.queuePrompt).toHaveBeenCalledWith(
        0,
        expect.anything(),
        expect.objectContaining({
          partialExecutionTargets: queueNodeIds
        })
      )
    })

    it('skips workflow context collection without telemetry', async () => {
      prepareEmptyPromptQueue()
      const getExecutionContext = vi.spyOn(
        executionContextUtils,
        'getExecutionContext'
      )
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1'
      })

      await app.queuePrompt(0)

      expect(getExecutionContext).not.toHaveBeenCalled()
    })

    it('retains workflow telemetry metadata when the queue UI refresh fails', async () => {
      prepareEmptyPromptQueue()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackExecutionOutcome: vi.fn() })
      setTelemetryRegistry(registry)
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1'
      })
      const refreshError = new Error('Queue UI refresh failed')
      vi.spyOn(app.ui.queue, 'update').mockRejectedValue(refreshError)

      try {
        await app.queuePrompt(0, 1, {
          intent: { trigger_source: 'button' }
        })
        expect(useExecutionStore().queuedJobs['job-1']).toMatchObject({
          workflowExecutionIntent: {
            trigger_source: 'button'
          }
        })
        expect(reportError).toHaveBeenCalledWith(refreshError, {
          surface: 'graph',
          errorType: 'queue_ui_update_failure'
        })
      } finally {
        setTelemetryRegistry(null)
      }
    })

    it('preserves a failed result when prompt errors include an empty node error record', async () => {
      prepareEmptyPromptQueue()
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError({
          node_errors: {},
          error: {
            type: 'prompt_no_outputs',
            message: 'Prompt has no outputs',
            details: ''
          }
        })
      )

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      const errorStore = useExecutionErrorStore()
      expect(errorStore.lastNodeErrors).toBeNull()
      expect(errorStore.lastPromptError).toMatchObject({
        type: 'prompt_no_outputs'
      })
    })

    it('surfaces governance 403 node errors without an access dialog', async () => {
      prepareEmptyPromptQueue()
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')
      const nodeErrors: Record<string, NodeError> = {
        '1': {
          class_type: 'KlingImage2VideoNode',
          dependent_outputs: [],
          errors: [
            {
              type: 'PARTNER_NODE_DISABLED',
              message: 'This node has been disabled by your workspace policy.',
              details: '',
              extra_info: { provider: 'kling' }
            }
          ]
        }
      }
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError(
          {
            node_errors: nodeErrors,
            error: {
              type: 'PARTNER_NODE_DISABLED',
              message: 'Workspace policy denied one or more partner nodes',
              details: ''
            }
          },
          403
        )
      )

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      expect(useExecutionErrorStore().lastNodeErrors).toEqual(nodeErrors)
      expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
      expect(showDialog).not.toHaveBeenCalled()
    })

    it('keeps the access dialog for unrelated 403 responses', async () => {
      prepareEmptyPromptQueue()
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError(
          {
            error: {
              type: 'access_denied',
              message: 'This workspace cannot run prompts',
              details: ''
            }
          },
          403
        )
      )

      await expect(app.queuePrompt(0)).resolves.toBe(true)

      expect(showDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'global-error' })
      )
      expect(useExecutionErrorStore().lastNodeErrors).toBeNull()
    })

    it('keeps the access dialog for a middleware 403 body with a null error', async () => {
      prepareEmptyPromptQueue()
      const showDialog = vi.spyOn(useDialogStore(), 'showDialog')
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError({ error: null }, 403)
      )

      await expect(app.queuePrompt(0)).resolves.toBe(true)

      expect(showDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'global-error' })
      )
      expect(useExecutionErrorStore().lastNodeErrors).toBeNull()
    })

    it('preserves a successful result when prompt errors omit node errors', async () => {
      prepareEmptyPromptQueue()
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError({
          error: {
            type: 'prompt_no_outputs',
            message: 'Prompt has no outputs',
            details: ''
          }
        })
      )

      await expect(app.queuePrompt(0)).resolves.toBe(true)
    })

    it('uses the last processed queue item result after an earlier failure', async () => {
      prepareEmptyPromptQueue()
      let rejectFirst!: (reason?: unknown) => void
      const firstResponse = new Promise<never>((_, reject) => {
        rejectFirst = reject
      })
      vi.spyOn(api, 'queuePrompt')
        .mockImplementationOnce(() => firstResponse)
        .mockResolvedValueOnce({
          prompt_id: 'job-2'
        })

      const firstQueue = app.queuePrompt(0)
      await vi.waitFor(() => {
        expect(api.queuePrompt).toHaveBeenCalledTimes(1)
      })
      await expect(app.queuePrompt(0)).resolves.toBe(false)

      rejectFirst(
        new PromptExecutionError({
          node_errors: {},
          error: {
            type: 'prompt_no_outputs',
            message: 'Prompt has no outputs',
            details: ''
          }
        })
      )

      await expect(firstQueue).resolves.toBe(true)
      expect(useExecutionErrorStore().lastNodeErrors).toBeNull()
    })
  })

  describe('the node API queue', () => {
    function queueOnTheApp() {
      const workflow = new ComfyWorkflow({
        path: 'workflows/queued.json',
        modified: 0,
        size: 0
      })
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      app.canvas = fromPartial<LGraphCanvas>({ graph, draw: vi.fn() })
      onTestFinished(attachLegacyUI(app))
      useWorkflowStore().activeWorkflow = markLoaded(workflow)
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: { '1': { class_type: 'PreviewAny', inputs: {} } },
        workflow: createWorkflowGraphData()
      })
      useComfyApiStore().publish()
      onTestFinished(() => {
        delete window.comfy_v4
      })
      const { comfy_v4 } = window
      assert(comfy_v4)
      return comfy_v4.queue
    }

    const NODE_ERRORS: Record<string, NodeError> = {
      '1': {
        class_type: 'PreviewAny',
        dependent_outputs: ['1'],
        errors: [
          {
            type: 'required_input_missing',
            message: 'Required input is missing: source',
            details: ''
          }
        ]
      }
    }

    it('runs a pack listener as each run call starts, and its cleanup once the queue settles', async () => {
      const queue = queueOnTheApp()
      const order: string[] = []
      vi.spyOn(api, 'queuePrompt').mockImplementation(async () => {
        order.push('submitted')
        return { prompt_id: 'job-1' }
      })
      queue.onBeforeRun(() => {
        order.push('before run')
        return () => order.push('cleanup')
      })

      await app.queuePrompt(0, 2)

      expect(order).toEqual(['before run', 'submitted', 'submitted', 'cleanup'])
    })

    it.for([
      {
        stop: 'a failed workspace switch',
        arrange: () =>
          vi
            .mocked(useTeamWorkspaceStore().waitForWorkspaceSwitch)
            .mockRejectedValueOnce(new Error('Token exchange failed'))
      },
      {
        stop: 'a missing workspace credential',
        arrange: () =>
          vi
            .mocked(useAuthStore().getWorkspaceAuthToken)
            .mockResolvedValueOnce(undefined)
      },
      {
        stop: 'a prompt that cannot be built',
        arrange: () =>
          vi
            .spyOn(app, 'graphToPrompt')
            .mockRejectedValueOnce(new Error('cannot build'))
      }
    ])(
      'runs the cleanup when the queue stops early on $stop',
      async ({ arrange }) => {
        const queue = queueOnTheApp()
        const cleanup = vi.fn()
        queue.onBeforeRun(() => cleanup)
        arrange()
        const submit = vi.spyOn(api, 'queuePrompt')

        await app.queuePrompt(0).catch(() => false)

        expect(submit).not.toHaveBeenCalled()
        expect(cleanup).toHaveBeenCalledOnce()
      }
    )

    it('tells a pack the ids of the prompts a run call submitted', async () => {
      const queue = queueOnTheApp()
      let next = 0
      vi.spyOn(api, 'queuePrompt').mockImplementation(async () => ({
        prompt_id: `job-${++next}`
      }))
      const submitted = vi.fn()
      queue.onAfterRun(submitted)

      await app.queuePrompt(0, 2)

      expect(submitted).toHaveBeenCalledExactlyOnceWith({
        promptIds: ['job-1', 'job-2'],
        submissions: [
          { promptId: 'job-1', nodeCount: 1 },
          { promptId: 'job-2', nodeCount: 1 }
        ]
      })
    })

    it('tells a pack about a refusal on the ordinary validation failure, and nothing after it', async () => {
      const queue = queueOnTheApp()
      vi.spyOn(api, 'queuePrompt').mockRejectedValue(
        new PromptExecutionError(
          {
            error: {
              type: 'prompt_outputs_failed_validation',
              message: 'Prompt outputs failed validation',
              details: ''
            },
            node_errors: NODE_ERRORS
          },
          400
        )
      )
      const rejected = vi.fn()
      const submitted = vi.fn()
      queue.onRejected(rejected)
      queue.onAfterRun(submitted)

      await app.queuePrompt(0)

      expect(rejected).toHaveBeenCalledOnce()
      expect(submitted).not.toHaveBeenCalled()
    })

    it('tells a pack about a refusal the backend answers without a prompt id', async () => {
      const queue = queueOnTheApp()
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        node_errors: NODE_ERRORS
      })
      const rejected = vi.fn()
      queue.onRejected(rejected)

      await app.queuePrompt(0)

      expect(rejected).toHaveBeenCalledOnce()
    })

    it.for([
      {
        outcome: 'submits its prompt',
        respond: async () => ({ prompt_id: 'job-1' }),
        resolves: true
      },
      {
        outcome: 'is answered with neither a prompt id nor an error',
        respond: async () => ({}),
        resolves: true
      },
      {
        outcome: 'fails before the backend answers',
        respond: async () => {
          throw new TypeError('Failed to fetch')
        },
        resolves: true
      },
      {
        outcome: 'is accepted with node errors',
        respond: async () => ({ prompt_id: 'job-1', node_errors: NODE_ERRORS }),
        resolves: false
      },
      {
        outcome: 'is refused with node errors',
        respond: async () => {
          throw new PromptExecutionError({
            error: { type: 'invalid_prompt', message: 'Invalid', details: '' },
            node_errors: NODE_ERRORS
          })
        },
        resolves: false
      },
      {
        outcome: 'is refused with a prompt error',
        respond: async () => {
          throw new PromptExecutionError({
            error: {
              type: 'prompt_no_outputs',
              message: 'No outputs',
              details: ''
            },
            node_errors: {}
          })
        },
        resolves: false
      }
    ])(
      'resolves $resolves from queue.run() when the run $outcome',
      async ({ respond, resolves }) => {
        const queue = queueOnTheApp()
        const submit = vi.spyOn(api, 'queuePrompt').mockImplementation(respond)

        await expect(queue.run()).resolves.toBe(resolves)
        expect(submit).toHaveBeenCalledOnce()
      }
    )

    it('resolves false from queue.run() when the queue stops before sending', async () => {
      const queue = queueOnTheApp()
      vi.mocked(
        useTeamWorkspaceStore().waitForWorkspaceSwitch
      ).mockRejectedValueOnce(new Error('Token exchange failed'))
      const submit = vi.spyOn(api, 'queuePrompt')

      await expect(queue.run()).resolves.toBe(false)
      expect(submit).not.toHaveBeenCalled()
    })

    it('resolves false from queue.run() when it is folded into a run in progress', async () => {
      const queue = queueOnTheApp()
      let finishFirst: () => void = () => {}
      vi.spyOn(api, 'queuePrompt').mockImplementation(
        () =>
          new Promise((resolve) => {
            finishFirst = () => resolve({ prompt_id: 'job-1' })
          })
      )
      const first = app.queuePrompt(0)
      await vi.waitFor(() => expect(api.queuePrompt).toHaveBeenCalledOnce())

      await expect(queue.run()).resolves.toBe(false)

      finishFirst()
      await vi.waitFor(() => expect(api.queuePrompt).toHaveBeenCalledTimes(2))
      finishFirst()
      await expect(first).resolves.toBe(true)
    })

    it('submits only the nodes a pack names', async () => {
      const queue = queueOnTheApp()
      const root = app.rootGraph
      const outer = new LGraphNode('Outer')
      root.add(outer)
      const submit = vi
        .spyOn(api, 'queuePrompt')
        .mockResolvedValue({ prompt_id: 'job-1' })
      const comfy = window.comfy_v4
      assert(comfy)
      const handle = comfy.graph.node(String(outer.id))
      assert(handle)

      await expect(queue.run({ nodes: [handle] })).resolves.toBe(true)

      expect(submit).toHaveBeenCalledWith(
        0,
        expect.anything(),
        expect.objectContaining({ partialExecutionTargets: [String(outer.id)] })
      )
    })
  })

  describe('workflow lifecycle', () => {
    it.for([
      { indices: ['1', '3'], nested: false },
      { indices: ['99', '1', '3', '5', '7', '9'], nested: false },
      { indices: ['1', '3'], nested: true }
    ])(
      'restores submitted DynamicGroup rows in encounter order: %j',
      async ({ indices, nested }) => {
        const graph = new LGraph()
        Reflect.set(app, 'rootGraphInternal', graph)
        const nodeType = 'test/ApiDynamicGroup'
        const group = {
          min: 0,
          max: 5,
          template: {
            required: {
              strength: ['FLOAT', { default: 1 }],
              '10': ['STRING', { default: '' }]
            }
          }
        } as const
        const input: NonNullable<ComfyNodeDef['input']> = {
          required: { loras: ['COMFY_DYNAMICGROUP_V3', group] }
        }
        const definitionInput: NonNullable<ComfyNodeDef['input']> = nested
          ? {
              required: {
                mode: [
                  'COMFY_DYNAMICCOMBO_V3',
                  {
                    options: [
                      { key: 'off', inputs: {} },
                      { key: 'on', inputs: input }
                    ]
                  }
                ]
              }
            }
          : input
        const prefix = nested ? 'mode.loras' : 'loras'
        class ApiDynamicGroup extends LGraphNode {
          constructor() {
            super('API DynamicGroup')
            this.comfyClass = nodeType
            this.serialize_widgets = true
            for (const [name, spec] of Object.entries(
              definitionInput.required ?? {}
            )) {
              useLitegraphService().addNodeInput(
                this,
                transformInputSpecV1ToV2(spec, { name, isOptional: false })
              )
            }
          }
        }
        LiteGraph.registerNodeType(nodeType, ApiDynamicGroup)
        const sourceType = 'test/ApiDynamicGroupSource'
        class ApiDynamicGroupSource extends LGraphNode {
          constructor() {
            super('Source')
            this.addOutput('strength', 'FLOAT')
          }
        }
        LiteGraph.registerNodeType(sourceType, ApiDynamicGroupSource)
        useNodeDefStore().updateNodeDefs([
          {
            name: nodeType,
            display_name: nodeType,
            category: 'test',
            python_module: 'test',
            description: '',
            output: [],
            output_node: false,
            deprecated: false,
            experimental: false,
            input: definitionInput
          }
        ])
        const inputs = Object.fromEntries(
          indices.map((index, position) => [
            `${prefix}.${index}.strength`,
            position + 0.5
          ])
        )
        try {
          await app.loadApiJson(
            {
              '1': {
                class_type: nodeType,
                inputs: {
                  ...inputs,
                  [`${prefix}.${indices.at(-1)}.strength`]: ['2', 0],
                  [`${prefix}.10`]: 'malformed',
                  [prefix]: 0,
                  [`${prefix}.$add`]: 0,
                  [`${prefix}.$notice`]: 'not an input',
                  [`${prefix}.0`]: 0,
                  ...(nested ? { mode: 'on' } : {})
                },
                _meta: { title: nodeType }
              },
              '2': {
                class_type: sourceType,
                inputs: {},
                _meta: { title: sourceType }
              }
            },
            ''
          )
          const node = graph.getNodeById(toNodeId(1))
          expect(
            node?.widgets?.filter((w) => w.type === 'dynamic_group_row')
          ).toHaveLength(indices.length)
          expect(
            node?.widgets
              ?.filter((w) => w.name.endsWith('.strength'))
              .map((w) => [w.name, w.value])
          ).toEqual(
            indices.map((_, position) => [
              `${prefix}.${position}.strength`,
              position === indices.length - 1 ? 1 : position + 0.5
            ])
          )
          expect(
            node?.widgets
              ?.filter((w) => w.name.endsWith('.10'))
              .map((w) => w.value)
          ).toEqual(indices.map(() => ''))
          const slot = node?.findInputSlot(
            `${prefix}.${indices.length - 1}.strength`
          )
          const link = slot === undefined ? undefined : node?.getInputLink(slot)
          expect(link?.origin_id).toBe(toNodeId(2))
          expect(link?.origin_slot).toBe(0)
        } finally {
          LiteGraph.unregisterNodeType(nodeType)
          LiteGraph.unregisterNodeType(sourceType)
        }
      }
    )

    it('clears missing node packs before loading API JSON without missing nodes', async () => {
      const graph = new LGraph()
      const activeSubgraph = createTestSubgraph({ rootGraph: graph })
      Reflect.set(app, 'rootGraphInternal', graph)
      Reflect.set(mockCanvas, 'graph', activeSubgraph)
      Reflect.set(mockCanvas, 'subgraph', activeSubgraph)
      vi.mocked(mockCanvas.setGraph).mockImplementation((nextGraph) => {
        Reflect.set(mockCanvas, 'graph', nextGraph)
        Reflect.set(mockCanvas, 'subgraph', null)
      })
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes(['MissingGroupNode'])
      const nodeType = 'test/RegisteredApiNode'
      class RegisteredApiNode extends LGraphNode {}
      LiteGraph.registerNodeType(nodeType, RegisteredApiNode)

      await app.loadApiJson(
        {
          '1': {
            class_type: nodeType,
            inputs: {},
            _meta: { title: 'Registered API Node' }
          }
        },
        ''
      )

      expect(missingNodesStore.missingNodesError).toBeNull()
      expect(mockCanvas.setGraph).toHaveBeenCalledWith(graph)
      expect(mockCanvas.graph).toBe(graph)
      expect(mockCanvas.subgraph).toBeNull()
    })

    it.for([
      { cnr_id: 'some-pack', ver: '9.9.9' },
      { aux_id: 'someuser/some-repo', ver: 'abcdef12' },
      { cnr_id: 'some-pack', aux_id: 'someuser/some-repo', ver: '9.9.9' }
    ])(
      'preserves pack identity through API import and workflow reload: %j',
      async (properties) => {
        const sourceGraph = new LGraph()
        const source = new LGraphNode('Uninstalled')
        source.comfyClass = 'UninstalledPackNode'
        Object.assign(source.properties, properties)
        sourceGraph.add(source)
        const { output } = await graphToPrompt(sourceGraph)
        expect(output[String(source.id)]._meta).toEqual({
          title: 'Uninstalled',
          ...properties
        })

        const graph = new LGraph()
        Reflect.set(app, 'rootGraphInternal', graph)
        const nodeReplacementStore = useNodeReplacementStore()
        vi.spyOn(nodeReplacementStore, 'load').mockResolvedValue()

        const cleanup = installErrorClearingHooks(graph)
        try {
          await app.loadApiJson(output, '')
          expect(
            useMissingNodesErrorStore().missingNodesError?.nodeTypes
          ).toEqual([
            expect.objectContaining({
              type: 'UninstalledPackNode',
              cnrId: properties.cnr_id ?? properties.aux_id
            })
          ])

          const saved = graph.serialize()
          expect(saved.nodes[0].properties).toEqual(properties)
          expect(zComfyWorkflow.safeParse(saved).success).toBe(true)
          const reloaded = new LGraph()
          reloaded.configure({ ...saved, id: reloaded.id })
          expect(reloaded.nodes[0].properties).toEqual(properties)
          expect(reloaded.serialize().nodes[0].properties).toEqual(properties)
        } finally {
          cleanup()
        }
      }
    )

    it.for([
      {
        name: 'non-string fields',
        metadata: { cnr_id: {}, aux_id: {}, ver: [] },
        expectedProperties: {},
        expectedCnrId: undefined
      },
      {
        name: 'empty fields',
        metadata: { cnr_id: '', aux_id: '', ver: '' },
        expectedProperties: {},
        expectedCnrId: undefined
      },
      {
        name: 'invalid formats',
        metadata: {
          cnr_id: 'owner/repo',
          aux_id: 'missing-slash',
          ver: 'not a version'
        },
        expectedProperties: {},
        expectedCnrId: undefined
      },
      {
        name: 'invalid cnr_id with valid siblings',
        metadata: { cnr_id: {}, aux_id: 'owner/repo', ver: '1.0.0' },
        expectedProperties: { aux_id: 'owner/repo', ver: '1.0.0' },
        expectedCnrId: 'owner/repo'
      },
      {
        name: 'invalid aux_id with valid siblings',
        metadata: { cnr_id: 'some-pack', aux_id: {}, ver: '1.0.0' },
        expectedProperties: { cnr_id: 'some-pack', ver: '1.0.0' },
        expectedCnrId: 'some-pack'
      },
      {
        name: 'invalid ver with valid siblings',
        metadata: { cnr_id: 'some-pack', aux_id: 'owner/repo', ver: [] },
        expectedProperties: { cnr_id: 'some-pack', aux_id: 'owner/repo' },
        expectedCnrId: 'some-pack'
      },
      {
        name: 'empty cnr_id with valid aux_id fallback',
        metadata: { cnr_id: '', aux_id: 'owner/repo', ver: '1.0.0' },
        expectedProperties: { aux_id: 'owner/repo', ver: '1.0.0' },
        expectedCnrId: 'owner/repo'
      }
    ])(
      'validates API placeholder pack metadata: $name',
      async ({ metadata, expectedProperties, expectedCnrId }) => {
        const graph = new LGraph()
        Reflect.set(app, 'rootGraphInternal', graph)
        const cleanupErrorHooks = installErrorClearingHooks(graph)
        const missingNodesStore = useMissingNodesErrorStore()
        const nodeReplacementStore = useNodeReplacementStore()
        vi.spyOn(nodeReplacementStore, 'load').mockResolvedValue()
        const apiData: unknown = {
          '1': {
            class_type: 'UninstalledPackNode',
            inputs: {},
            _meta: {
              title: 'Uninstalled',
              ...metadata
            }
          }
        }
        assert(app.isApiJson(apiData), 'Expected valid API JSON')

        try {
          await app.loadApiJson(apiData, '')

          const [placeholder] = graph.nodes
          expect(placeholder.properties).toEqual(expectedProperties)
          expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
            expect.objectContaining({
              type: 'UninstalledPackNode',
              cnrId: expectedCnrId
            })
          ])
        } finally {
          cleanupErrorHooks()
        }
      }
    )

    it.for([
      { name: 'without pack metadata', metadata: { title: 'Original text' } },
      {
        name: 'with pack metadata',
        metadata: { title: 'Original text', cnr_id: 'old-pack', ver: '1.0.0' }
      }
    ])(
      'preserves replacement defaults for API text substitutions $name',
      async ({ metadata }) => {
        const graph = new LGraph()
        Reflect.set(app, 'rootGraphInternal', graph)
        const nodeType = 'test/ReplacementText'
        class ReplacementText extends LGraphNode {
          constructor() {
            super('Replacement text')
            this.addProperty('Node name for S&R', nodeType, 'string')
            this.addWidget('text', 'text', 'Default text', () => {})
          }
        }
        LiteGraph.registerNodeType(nodeType, ReplacementText)
        const cleanupErrorHooks = installErrorClearingHooks(graph)
        onTestFinished(() => {
          cleanupErrorHooks()
        })
        useSettingStore().settingValues['Comfy.NodeReplacement.Enabled'] = true
        const replacementStore = useNodeReplacementStore()
        replacementStore.isLoaded = true
        replacementStore.replacements = {
          OldTextNode: [
            {
              old_node_id: 'OldTextNode',
              new_node_id: nodeType,
              old_widget_ids: ['text'],
              input_mapping: [{ old_id: 'text', new_id: 'text' }],
              output_mapping: null
            }
          ]
        }

        await app.loadApiJson(
          {
            '1': {
              class_type: 'OldTextNode',
              inputs: { text: 'Imported prompt text' },
              _meta: metadata
            }
          },
          ''
        )
        const missingTypes =
          useMissingNodesErrorStore().missingNodesError?.nodeTypes ?? []
        expect(useNodeReplacement().replaceNodesInPlace(missingTypes)).toEqual([
          'OldTextNode'
        ])
        expect(
          applyTextReplacements(graph, '%test/ReplacementText.text%')
        ).toBe('Imported prompt text')
      }
    )

    it('restores late autogrow widgets and links without repeating callbacks', async () => {
      const graph = new LGraph()
      const previousAppGraph = Reflect.get(app, 'rootGraphInternal')
      Reflect.set(app, 'rootGraphInternal', graph)
      const sourceType = 'test/ApiSourceNode'
      const targetType = 'test/ApiTargetNode'
      const targetConnectionChanges = vi.fn()
      class ApiSourceNode extends LGraphNode {
        constructor(title = 'ApiSourceNode') {
          super(title)
          this.addOutput('out', 'LATENT')
        }
      }
      class ApiTargetNode extends LGraphNode {
        constructor(title = 'ApiTargetNode') {
          super(title)
          this.widgets = []
          addAutogrow(this, {
            min: 0,
            input: {
              required: {
                image: ['LATENT', {}],
                weight: ['FLOAT', { default: 1 }]
              }
            }
          })
        }
        override onConnectionsChange(...args: unknown[]) {
          targetConnectionChanges(...args)
        }
      }
      LiteGraph.registerNodeType(sourceType, ApiSourceNode)
      LiteGraph.registerNodeType(targetType, ApiTargetNode)

      try {
        await app.loadApiJson(
          {
            '2': {
              class_type: targetType,
              inputs: {
                '0.weight2': 0.5,
                '0.image2': ['1', 0],
                '0.image1': ['1', 0],
                '0.image0': ['1', 0]
              },
              _meta: { title: 'Api Target' }
            },
            '1': {
              class_type: sourceType,
              inputs: {},
              _meta: { title: 'Api Source' }
            }
          },
          ''
        )

        expect(targetConnectionChanges).toHaveBeenCalledTimes(3)
        expect(graph.links.size).toBe(3)
        expect(
          graph
            .getNodeById(toNodeId(2))
            ?.widgets?.find((widget) => widget.name === '0.weight2')?.value
        ).toBe(0.5)
      } finally {
        Reflect.set(app, 'rootGraphInternal', previousAppGraph)
        LiteGraph.unregisterNodeType(sourceType)
        LiteGraph.unregisterNodeType(targetType)
      }
    })

    it('saves links connected on retry in missing-node snapshots', async () => {
      const graph = new LGraph()
      const previousAppGraph = Reflect.get(app, 'rootGraphInternal')
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.spyOn(useNodeReplacementStore(), 'load').mockResolvedValue()
      const sourceType = 'test/ApiSnapshotSource'
      const lateType = 'test/ApiLateOutput'
      class SnapshotSource extends LGraphNode {
        constructor() {
          super('Snapshot source')
          this.addOutput('out', 'LATENT')
        }
      }
      class LateOutput extends LGraphNode {
        constructor() {
          super('Late output')
          this.addInput('input', 'LATENT')
        }
        override onConnectionsChange(...args: unknown[]) {
          if (args[2] && !this.outputs.length) this.addOutput('out', 'LATENT')
        }
      }
      LiteGraph.registerNodeType(sourceType, SnapshotSource)
      LiteGraph.registerNodeType(lateType, LateOutput)
      try {
        await app.loadApiJson(
          {
            '1': {
              class_type: 'MissingRetryTarget',
              inputs: { input: ['2', 0] },
              _meta: { title: 'Missing' }
            },
            '2': {
              class_type: lateType,
              inputs: { input: ['3', 0] },
              _meta: { title: 'Late output' }
            },
            '3': {
              class_type: sourceType,
              inputs: {},
              _meta: { title: 'Source' }
            }
          },
          ''
        )
        const placeholder = graph.getNodeById(toNodeId(1))
        const link = placeholder?.getInputLink(0)?.id
        expect(link).toBeDefined()
        expect(link).not.toBeNull()
        expect(placeholder?.last_serialization?.inputs?.[0].link).toBe(link)
        const saved = graph.serialize()
        const reloaded = new LGraph()
        reloaded.configure({ ...saved, id: reloaded.id })
        expect(reloaded.getNodeById(toNodeId(1))?.getInputLink(0)?.id).toBe(
          link
        )
        expect(reloaded.links.size).toBe(2)
      } finally {
        Reflect.set(app, 'rootGraphInternal', previousAppGraph)
        LiteGraph.unregisterNodeType(sourceType)
        LiteGraph.unregisterNodeType(lateType)
      }
    })

    it('does not retry a connection vetoed by an extension callback', async () => {
      const graph = new LGraph()
      const previousAppGraph = Reflect.get(app, 'rootGraphInternal')
      Reflect.set(app, 'rootGraphInternal', graph)
      const sourceType = 'test/ApiVetoSourceNode'
      const targetType = 'test/ApiVetoTargetNode'
      const connectionAttempts = vi.fn()
      class ApiVetoSourceNode extends LGraphNode {
        constructor(title = 'ApiVetoSourceNode') {
          super(title)
          this.addOutput('out', 'LATENT')
        }
      }
      class ApiVetoTargetNode extends LGraphNode {
        constructor(title = 'ApiVetoTargetNode') {
          super(title)
          this.addInput('input', 'LATENT')
        }
        override onConnectInput() {
          connectionAttempts()
          return false
        }
      }
      LiteGraph.registerNodeType(sourceType, ApiVetoSourceNode)
      LiteGraph.registerNodeType(targetType, ApiVetoTargetNode)

      try {
        await app.loadApiJson(
          {
            '2': {
              class_type: targetType,
              inputs: { input: ['1', 0] },
              _meta: { title: 'API Veto Target' }
            },
            '1': {
              class_type: sourceType,
              inputs: {},
              _meta: { title: 'API Veto Source' }
            }
          },
          ''
        )

        expect(connectionAttempts).toHaveBeenCalledOnce()
        expect(graph.links.size).toBe(0)
      } finally {
        Reflect.set(app, 'rootGraphInternal', previousAppGraph)
        LiteGraph.unregisterNodeType(sourceType)
        LiteGraph.unregisterNodeType(targetType)
      }
    })

    it('remaps flattened subgraph ids to colon-free local ids', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const cleanupErrorHooks = installErrorClearingHooks(graph)
      const missingNodesStore = useMissingNodesErrorStore()
      const nodeReplacementStore = useNodeReplacementStore()
      vi.spyOn(nodeReplacementStore, 'load').mockResolvedValue()
      const sourceType = 'test/FlattenedSourceNode'
      const targetType = 'test/FlattenedTargetNode'
      class FlattenedSourceNode extends LGraphNode {
        constructor(title = 'FlattenedSourceNode') {
          super(title)
          this.addOutput('out', 'LATENT')
        }
      }
      class FlattenedTargetNode extends LGraphNode {
        constructor(title = 'FlattenedTargetNode') {
          super(title)
          this.addInput('samples', 'LATENT')
        }
      }
      LiteGraph.registerNodeType(sourceType, FlattenedSourceNode)
      LiteGraph.registerNodeType(targetType, FlattenedTargetNode)

      try {
        await app.loadApiJson(
          {
            '194:45': {
              class_type: sourceType,
              inputs: {},
              _meta: { title: 'Inner source' }
            },
            '7': {
              class_type: targetType,
              inputs: { samples: ['194:45', 0] },
              _meta: { title: 'Root target' }
            },
            '194:46': {
              class_type: 'UninstalledInnerNode',
              inputs: {},
              _meta: { title: 'Missing inner' }
            },
            '194_45': {
              class_type: targetType,
              inputs: { samples: ['194:45', 0] },
              _meta: { title: 'Occupies the remap target' }
            }
          },
          ''
        )

        expect(graph.nodes.every((n) => !String(n.id).includes(':'))).toBe(true)
        // "194_45" was already taken by a literal id, so the remap suffixes.
        expect(graph.getNodeById(toNodeId('194_45'))?.type).toBe(targetType)
        expect(graph.getNodeById(toNodeId('194_45_'))?.type).toBe(sourceType)
        expect(graph.links.size).toBe(2)
        expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
          expect.objectContaining({
            type: 'UninstalledInnerNode',
            nodeId: '194_46'
          })
        ])
      } finally {
        cleanupErrorHooks()
      }
    })

    it('unwraps exported widget values on API JSON import', async () => {
      const graph = new LGraph()
      const previousAppGraph = app.rootGraph
      const missingNodesStore = useMissingNodesErrorStore()
      const previousMissingNodeTypes =
        missingNodesStore.missingNodesError?.nodeTypes ?? []
      Reflect.set(app, 'rootGraphInternal', graph)
      const widgetNodeType = 'test/ApiCurveNode'
      const curveCallback = vi.fn()
      class ApiCurveNode extends LGraphNode {
        constructor(title = 'ApiCurveNode') {
          super(title)
          this.addWidget(
            'curve',
            'curve',
            { points: [], interpolation: 'linear' },
            curveCallback
          )
          this.addWidget('text', 'points', '', null)
        }
      }
      LiteGraph.registerNodeType(widgetNodeType, ApiCurveNode)
      const curve: CurveData = {
        points: [
          [0, 0],
          [0.5, 1]
        ],
        interpolation: 'linear'
      }
      const points = [
        [0, 0],
        [0.5, 1]
      ]

      try {
        await app.loadApiJson(
          {
            '1': {
              class_type: widgetNodeType,
              inputs: {
                curve: { __type__: 'CURVE', __value__: curve },
                points: { __value__: points }
              },
              _meta: { title: 'Curve' }
            },
            '2': {
              class_type: 'Uninstalled/CurveNode',
              inputs: {
                curve: { __type__: 'CURVE', __value__: curve },
                points: { __value__: points }
              },
              _meta: { title: 'Missing Curve' }
            }
          },
          ''
        )

        const widgetNode = graph.nodes.find((n) => n.type === widgetNodeType)
        expect(widgetNode?.widgets?.[0].value).toEqual(curve)
        expect(widgetNode?.widgets?.[1].value).toEqual(points)
        expect(curveCallback).toHaveBeenCalledWith(curve)

        const placeholder = graph.nodes.find(
          (n) => n.type === 'Uninstalled/CurveNode'
        )
        expect(placeholder?.last_serialization?.widgets_values).toEqual([
          curve,
          points
        ])
        expect(
          placeholder?.last_serialization?.widgets_values_named
        ).toMatchObject({ curve, points })

        const passthrough = { __value__: 'not-the-wrapper', other: 1 }
        await app.loadApiJson(
          {
            '1': {
              class_type: widgetNodeType,
              inputs: { points: passthrough },
              _meta: { title: 'Curve' }
            }
          },
          ''
        )
        const passthroughNode = graph.nodes
          .filter((n) => n.type === widgetNodeType)
          .at(-1)
        expect(passthroughNode?.widgets?.[1].value).toEqual(passthrough)
      } finally {
        missingNodesStore.setMissingNodeTypes(previousMissingNodeTypes)
        Reflect.set(app, 'rootGraphInternal', previousAppGraph)
      }
    })

    it('keeps importing when a widget callback rejects an API value', async () => {
      const graph = new LGraph()
      const previousAppGraph = app.rootGraph
      Reflect.set(app, 'rootGraphInternal', graph)
      const videoCallback = (value: string) => value.lastIndexOf('.')
      class VhsLoadVideoNode extends LGraphNode {
        constructor() {
          super('Load Video')
          this.addWidget('text', 'video', 'default.mp4', videoCallback)
        }
      }
      LiteGraph.registerNodeType('VHS_LoadVideo', VhsLoadVideoNode)

      try {
        await expect(
          app.loadApiJson(
            {
              '1': {
                class_type: 'VHS_LoadVideo',
                inputs: { video: 1 },
                _meta: { title: 'Load Video' }
              },
              '2': {
                class_type: 'VHS_LoadVideo',
                inputs: { video: 'input/later.mp4' },
                _meta: { title: 'Later Video' }
              }
            },
            'invalid-vhs-api-prompt.json'
          )
        ).resolves.toBeUndefined()

        const videoWidget = graph.nodes[0]?.widgets?.find(
          ({ name }) => name === 'video'
        )
        expect(videoWidget?.value).toBe(1)
        expect(
          graph.nodes[1]?.widgets?.find(({ name }) => name === 'video')?.value
        ).toBe('input/later.mp4')
        expect(mockWorkflowService.afterLoadNewGraph).toHaveBeenCalled()
        expect(reportError).toHaveBeenCalledWith(expect.any(TypeError), {
          surface: 'graph',
          errorType: 'failure_invoking_api_workflow_widget_callback',
          tags: {
            node_type: 'VHS_LoadVideo',
            widget_name: 'video'
          },
          context: { fileName: 'invalid-vhs-api-prompt.json' }
        })
      } finally {
        LiteGraph.unregisterNodeType('VHS_LoadVideo')
        Reflect.set(app, 'rootGraphInternal', previousAppGraph)
      }
    })

    it('creates a removable placeholder for an API JSON missing node', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const cleanupErrorHooks = installErrorClearingHooks(graph)
      const missingNodesStore = useMissingNodesErrorStore()
      const missingNodeType = 'Uninstalled<&Node>'
      const replacement: NodeReplacement = {
        new_node_id: 'ReplacementNode',
        old_node_id: missingNodeType,
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      }
      const nodeReplacementStore = useNodeReplacementStore()
      const loadReplacements = vi
        .spyOn(nodeReplacementStore, 'load')
        .mockResolvedValue()
      const getReplacement = vi
        .spyOn(nodeReplacementStore, 'getReplacementFor')
        .mockReturnValue(replacement)
      const apiData: unknown = {
        '-1': {
          class_type: missingNodeType,
          inputs: {}
        }
      }
      if (!app.isApiJson(apiData)) throw new Error('Expected valid API JSON')

      try {
        await app.loadApiJson(apiData, 'api-missing')

        const placeholder = graph.nodes.at(0)
        if (!placeholder) throw new Error('Expected missing-node placeholder')
        expect(placeholder).toMatchObject({
          type: 'UninstalledNode',
          title: missingNodeType,
          has_errors: true
        })
        expect(placeholder.id).not.toBe(toNodeId(-1))
        expect(placeholder.serialize()).toMatchObject({
          id: placeholder.id,
          type: missingNodeType,
          title: missingNodeType
        })
        expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
          {
            type: missingNodeType,
            nodeId: String(placeholder.id),
            isReplaceable: true,
            replacement
          }
        ])
        expect(loadReplacements).toHaveBeenCalledOnce()
        expect(getReplacement).toHaveBeenCalled()
        expect(loadReplacements.mock.invocationCallOrder[0]).toBeLessThan(
          getReplacement.mock.invocationCallOrder[0]
        )

        graph.remove(placeholder)
        expect(missingNodesStore.missingNodesError).toBeNull()
      } finally {
        cleanupErrorHooks()
      }
    })

    it('preserves API JSON inputs on a missing node across reload', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const sourceNodeType = 'test/ApiJsonSourceNode'
      const missingNodeType = 'UninstalledInputNode'
      class ApiJsonSourceNode extends LGraphNode {
        constructor() {
          super('API JSON source')
          this.addOutput('images', 'IMAGE')
        }
      }
      class InstalledInputNode extends LGraphNode {
        constructor() {
          super('Installed input node')
          this.addInput('images', 'IMAGE')
          this.addWidget('number', 'width', 0, null, {})
          this.addWidget('text', 'caption', '', null, {})
        }
      }
      LiteGraph.registerNodeType(sourceNodeType, ApiJsonSourceNode)
      const nodeReplacementStore = useNodeReplacementStore()
      vi.spyOn(nodeReplacementStore, 'load').mockResolvedValue()
      vi.spyOn(nodeReplacementStore, 'getReplacementFor').mockReturnValue(null)

      await app.loadApiJson(
        {
          '3': {
            class_type: missingNodeType,
            inputs: {
              images: ['4', 0],
              width: 512,
              caption: 'preserved caption'
            },
            _meta: { title: 'Missing input node' }
          },
          '4': {
            class_type: sourceNodeType,
            inputs: {},
            _meta: { title: 'API JSON source' }
          }
        },
        'api-inputs'
      )

      const placeholder = graph.getNodeById(toNodeId(3))
      if (!placeholder) throw new Error('Expected missing-node placeholder')
      const imageInput = placeholder.inputs.find(
        (input) => input.name === 'images'
      )
      expect(imageInput).toMatchObject({ name: 'images', type: '*' })
      expect(imageInput?.link).not.toBeNull()
      if (imageInput?.link == null) throw new Error('Expected input link')
      expect(graph.links.get(imageInput.link)).toMatchObject({
        origin_id: toNodeId(4),
        target_id: toNodeId(3)
      })

      const serializedGraph = graph.serialize()
      const serializedPlaceholder = serializedGraph.nodes.find(
        (node) => node.id === placeholder.id
      )
      expect(serializedPlaceholder).toMatchObject({
        widgets_values: [512, 'preserved caption'],
        widgets_values_named: {
          width: 512,
          caption: 'preserved caption'
        }
      })

      const roundTripGraph = new LGraph()
      roundTripGraph.configure({
        ...serializedGraph,
        id: roundTripGraph.id
      })
      const roundTripPlaceholder = roundTripGraph.getNodeById(toNodeId(3))
      expect(roundTripPlaceholder?.inputs[0]).toMatchObject({
        name: 'images',
        type: '*',
        link: imageInput.link
      })
      expect(roundTripPlaceholder?.serialize()).toMatchObject({
        widgets_values: [512, 'preserved caption'],
        widgets_values_named: {
          width: 512,
          caption: 'preserved caption'
        }
      })

      LiteGraph.registerNodeType(missingNodeType, InstalledInputNode)
      const installedGraph = new LGraph()
      installedGraph.configure({
        ...serializedGraph,
        id: installedGraph.id
      })
      expect(
        installedGraph
          .getNodeById(toNodeId(3))
          ?.widgets?.map((widget) => widget.value)
      ).toEqual([512, 'preserved caption'])
    })

    it('defers API JSON missing node warnings until they are flushed', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const nodeReplacementStore = useNodeReplacementStore()
      vi.spyOn(nodeReplacementStore, 'load').mockResolvedValue()
      vi.spyOn(nodeReplacementStore, 'getReplacementFor').mockReturnValue(null)
      const missingNodesStore = useMissingNodesErrorStore()
      const workflowService = await useRealWorkflowService()
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        prompt: {
          '1': {
            class_type: 'UninstalledDeferredNode',
            inputs: {},
            _meta: { title: 'Deferred missing node' }
          }
        }
      })

      await app.handleFile(
        createTestFile('deferred.json', 'application/json'),
        'file_drop',
        { deferWarnings: true }
      )

      const deferredWorkflow = useWorkflowStore().activeWorkflow
      expect(missingNodesStore.missingNodesError).toBeNull()
      expect(deferredWorkflow?.pendingWarnings?.missingNodeTypes).toEqual([
        expect.objectContaining({ type: 'UninstalledDeferredNode' })
      ])

      workflowService.showPendingWarnings(deferredWorkflow)

      expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
        expect.objectContaining({ type: 'UninstalledDeferredNode' })
      ])
    })
  })
  describe('A1111 import', () => {
    it('clears missing node packs, which its graph swap skips clean() for', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes(['OutgoingMissingNode'])
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        parameters: 'positive\nNegative prompt: negative\nSteps: 20'
      })
      mockImportA1111.mockImplementation(
        async (_graph, _parameters, beforeGraphClear) => {
          await beforeGraphClear?.()
          return 'imported'
        }
      )

      await app.handleFile(createTestFile('a1111.png', 'image/png'))

      expect(missingNodesStore.missingNodesError).toBeNull()
    })

    it.for(['not-a1111', 'core-nodes-unavailable'] as const)(
      'keeps missing node packs when the import fails with %s',
      async (outcome) => {
        const graph = new LGraph()
        Reflect.set(app, 'rootGraphInternal', graph)
        const missingNodesStore = useMissingNodesErrorStore()
        missingNodesStore.setMissingNodeTypes(['OutgoingMissingNode'])
        vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
          parameters: 'positive\nNegative prompt: negative\nSteps: 20'
        })
        mockImportA1111.mockResolvedValue(outcome)

        await app.handleFile(createTestFile('a1111.png', 'image/png'))

        expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
          'OutgoingMissingNode'
        ])
      }
    )

    it('closes a failed import lifecycle and restores change tracking', async () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        parameters: 'positive\nNegative prompt: negative\nSteps: 20'
      })
      mockImportA1111.mockImplementation(
        async (_graph, _parameters, beforeGraphClear) => {
          await beforeGraphClear?.()
          throw new Error('A1111 import failed')
        }
      )

      await expect(
        app.handleFile(createTestFile('a1111.png', 'image/png'))
      ).rejects.toThrow('A1111 import failed')

      expect(
        mockExtensionService.invokeExtensionsAsync.mock.calls.map(
          ([hook]) => hook
        )
      ).toEqual(['beforeLoadGraph', 'onGraphLoadError'])
      onTestFinished(attachLegacyUI(app))
      const workflow = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/recovered-a1111.json',
          modified: 0,
          size: 0
        })
      )
      const tracker = markRaw(
        new ChangeTracker(
          workflow,
          structuredClone(graph.serialize()) as ComfyWorkflowJSON
        )
      )
      workflow.changeTracker = tracker
      workflow.adoptGraph(graph)
      useWorkflowStore().activeWorkflow = workflow
      graph.add(new LGraphNode('after-a1111-failure'))
      tracker.captureCanvasState()
      expect(tracker.activeState.nodes.map((node) => node.title)).toEqual([
        'after-a1111-failure'
      ])
    })
  })

  describe('graph-load FIFO across import paths', () => {
    beforeEach(() => {
      app.canvasElRef.value = document.createElement('canvas')
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
    })

    it('runs the next workflow after a load rejects', async () => {
      mockWorkflowService.afterLoadNewGraph.mockRejectedValueOnce(
        new Error('activation failed')
      )

      const first = app.loadGraphData(createWorkflowGraphData(), true)
      const second = app.loadGraphData(createWorkflowGraphData(), true)

      await expect(first).rejects.toThrow('activation failed')
      await expect(second).resolves.toBeTruthy()
    })

    it('queues an API JSON import behind an in-flight workflow load', async () => {
      let releaseWorkflow!: () => void
      const workflowBlocked = new Promise<void>((resolve) => {
        releaseWorkflow = resolve
      })
      vi.when(mockExtensionService.invokeExtensionsAsync)
        .calledWith('beforeLoadGraph')
        .thenReturnOnce(workflowBlocked)

      const workflow = app.loadGraphData(createWorkflowGraphData(), true)
      await vi.waitFor(() =>
        expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
          'beforeLoadGraph'
        )
      )
      const apiImport = app.loadApiJson(
        { '1': { class_type: 'KSampler', inputs: {} } },
        'queued.json'
      )
      releaseWorkflow()
      await workflow
      await apiImport

      expect(app.rootGraph.nodes).toHaveLength(1)
      expect(app.rootGraph.nodes[0].type).toBe('KSampler')
    })

    it('starts an A1111 import only after the in-flight workflow load finishes', async () => {
      let releaseWorkflow!: () => void
      vi.when(mockExtensionService.invokeExtensionsAsync)
        .calledWith('beforeLoadGraph')
        .thenReturnOnce(
          new Promise<void>((resolve) => {
            releaseWorkflow = resolve
          })
        )
      vi.mocked(getWorkflowDataFromFile).mockImplementation(async () => {
        releaseWorkflow()
        return { parameters: 'positive\nNegative prompt: negative\nSteps: 20' }
      })
      let workflowFinishedBeforeImport: boolean | undefined
      mockImportA1111.mockImplementation(async () => {
        workflowFinishedBeforeImport =
          mockExtensionService.invokeExtensionsAsync.mock.calls.some(
            ([hook]) => hook === 'afterLoadGraph'
          )
        return 'imported'
      })

      const workflow = app.loadGraphData(createWorkflowGraphData(), true)
      await vi.waitFor(() =>
        expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
          'beforeLoadGraph'
        )
      )
      await app.handleFile(createTestFile('queued-a1111.png', 'image/png'))
      await workflow

      expect(workflowFinishedBeforeImport).toBe(true)
    })

    it('preserves file call order when a later parse finishes first', async () => {
      let resolveFirst!: (
        value: Awaited<ReturnType<typeof getWorkflowDataFromFile>>
      ) => void
      const firstParsed = new Promise<
        Awaited<ReturnType<typeof getWorkflowDataFromFile>>
      >((resolve) => {
        resolveFirst = resolve
      })
      const firstGraph = createWorkflowGraphData()
      firstGraph.extra = { marker: 'first' }
      const secondGraph = createWorkflowGraphData()
      secondGraph.extra = { marker: 'second' }
      vi.mocked(getWorkflowDataFromFile)
        .mockReturnValueOnce(firstParsed)
        .mockResolvedValueOnce({ workflow: secondGraph })
      const loadedMarkers: unknown[] = []
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook) => {
          if (hook === 'afterLoadGraph')
            loadedMarkers.push(app.rootGraph.extra.marker)
        }
      )

      const first = app.handleFile(
        createTestFile('first.json', 'application/json')
      )
      const second = app.handleFile(
        createTestFile('second.json', 'application/json')
      )
      await Promise.resolve()
      expect(app.rootGraph.extra).not.toMatchObject({ marker: 'second' })

      resolveFirst({ workflow: firstGraph })
      await Promise.all([first, second])

      expect(app.rootGraph.extra).toMatchObject({ marker: 'second' })
      expect(loadedMarkers).toEqual(['first', 'second'])
    })

    it.for([
      [0, 1, 2, 3],
      [0, 1, 3, 2],
      [0, 2, 1, 3],
      [0, 2, 3, 1],
      [0, 3, 1, 2],
      [0, 3, 2, 1],
      [1, 0, 2, 3],
      [1, 0, 3, 2],
      [1, 2, 0, 3],
      [1, 2, 3, 0],
      [1, 3, 0, 2],
      [1, 3, 2, 0],
      [2, 0, 1, 3],
      [2, 0, 3, 1],
      [2, 1, 0, 3],
      [2, 1, 3, 0],
      [2, 3, 0, 1],
      [2, 3, 1, 0],
      [3, 0, 1, 2],
      [3, 0, 2, 1],
      [3, 1, 0, 2],
      [3, 1, 2, 0],
      [3, 2, 0, 1],
      [3, 2, 1, 0]
    ])(
      'applies files in call order for completion order %s, %s, %s, %s',
      async (completionOrder) => {
        const callOrder = [0, 1, 2, 3]
        const resolvers: ((
          value: Awaited<ReturnType<typeof getWorkflowDataFromFile>>
        ) => void)[] = []
        for (const _ of callOrder) {
          vi.mocked(getWorkflowDataFromFile).mockReturnValueOnce(
            new Promise((resolve) => {
              resolvers.push(resolve)
            })
          )
        }
        const loadedMarkers: unknown[] = []
        mockExtensionService.invokeExtensionsAsync.mockImplementation(
          async (hook) => {
            if (hook === 'afterLoadGraph')
              loadedMarkers.push(app.rootGraph.extra.marker)
          }
        )

        const pending = callOrder.map((index) =>
          app.handleFile(
            createTestFile(`file-${index}.json`, 'application/json')
          )
        )
        await Promise.resolve()
        for (const index of completionOrder) {
          const graph = createWorkflowGraphData()
          graph.extra = { marker: index }
          resolvers[index]({ workflow: graph })
        }
        await Promise.all(pending)

        expect(loadedMarkers).toEqual(callOrder)
      }
    )

    it('loads the next file after an earlier metadata parse rejects', async () => {
      const parsed = createWorkflowGraphData()
      parsed.extra = { marker: 'recovered' }
      vi.mocked(getWorkflowDataFromFile)
        .mockRejectedValueOnce(new RangeError('metadata parse failed'))
        .mockResolvedValueOnce({ workflow: parsed })

      const failed = app.handleFile(createTestFile('broken.png', 'image/png'))
      const next = app.handleFile(
        createTestFile('next.json', 'application/json')
      )

      await expect(failed).rejects.toThrow(RangeError)
      await next

      expect(app.rootGraph.extra).toMatchObject({ marker: 'recovered' })
    })

    it('allows a non-graph media file from a graph lifecycle hook', async () => {
      vi.mocked(isGraphLoadHookOrigin).mockReturnValueOnce(true)
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue(undefined)

      await expect(
        app.handleFile(createTestFile('preview.png', 'image/png'))
      ).resolves.toBeUndefined()
      expect(pasteImageNode).toHaveBeenCalled()
    })

    it.for([
      {
        name: 'workflow',
        metadata: { workflow: createWorkflowGraphData() }
      },
      {
        name: 'API prompt',
        metadata: { prompt: { '1': { class_type: 'KSampler', inputs: {} } } }
      },
      {
        name: 'A1111 parameters',
        metadata: {
          parameters: 'positive\nNegative prompt: negative\nSteps: 20'
        }
      }
    ])(
      'refuses $name metadata from a graph lifecycle hook',
      async ({ metadata }) => {
        vi.mocked(isGraphLoadHookOrigin).mockReturnValueOnce(true)
        vi.mocked(getWorkflowDataFromFile).mockResolvedValue(metadata)

        await expect(
          app.handleFile(createTestFile('nested.png', 'image/png'))
        ).resolves.toBe(false)
      }
    )

    it('cleans before extensions prepare the incoming workflow', async () => {
      app.rootGraph.add(new LGraphNode('outgoing'))
      let nodesDuringPreparation: number | undefined
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook) => {
          if (hook === 'beforeConfigureGraph')
            nodesDuringPreparation = app.rootGraph.nodes.length
        }
      )

      await app.loadGraphData(createWorkflowGraphData(), true)

      expect(nodesDuringPreparation).toBe(0)
    })
  })

  describe('clean', () => {
    it('clears missing node packs when the graph is discarded', () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const missingNodesStore = useMissingNodesErrorStore()
      const executionErrorStore = useExecutionErrorStore()
      missingNodesStore.setMissingNodeTypes(['MissingGroupNode'])
      executionErrorStore.recordExecutionError({
        prompt_id: 'previous-run',
        timestamp: 0,
        node_id: '1',
        node_type: 'Test',
        executed: [],
        exception_message: 'fail',
        exception_type: 'RuntimeError',
        traceback: []
      })

      app.clean()

      expect(missingNodesStore.missingNodesError).toBeNull()
      expect(executionErrorStore.lastExecutionError).toBeNull()
    })

    it('records run errors after clearing the current workflow', () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const executionErrorStore = useExecutionErrorStore()

      app.clean()
      executionErrorStore.recordExecutionError({
        prompt_id: 'after-clear',
        timestamp: 0,
        node_id: '1',
        node_type: 'Test',
        executed: [],
        exception_message: 'fail',
        exception_type: 'RuntimeError',
        traceback: []
      })

      expect(executionErrorStore.lastExecutionError?.prompt_id).toBe(
        'after-clear'
      )
    })
  })

  describe('workflow tab switching', () => {
    const workflowAId = '11111111-1111-4111-8111-111111111111'
    const workflowBId = '22222222-2222-4222-8222-222222222222'

    const failedKSamplerErrors: Record<string, NodeError> = {
      '1': {
        errors: [
          {
            type: 'value_bigger_than_max',
            message: 'Value 200 bigger than max of 100',
            details: 'steps',
            extra_info: { input_name: 'steps' }
          }
        ],
        dependent_outputs: [],
        class_type: 'KSampler'
      }
    }

    function workflowGraphData(id: string): ComfyWorkflowJSON {
      return { ...createWorkflowGraphData(), id }
    }

    function serialisedGraph(id: string): SerialisableGraph {
      return {
        id,
        revision: 0,
        version: 1,
        state: {
          lastGroupId: 0,
          lastNodeId: 0,
          lastLinkId: 0,
          lastRerouteId: 0
        },
        nodes: [],
        links: []
      }
    }

    async function switchToWorkflow(
      workflowService: WorkflowService,
      graph: LGraph,
      workflow: ComfyWorkflow,
      workflowId: string
    ) {
      workflowService.beforeLoadNewGraph()
      app.clean()
      graph.configure(serialisedGraph(workflowId))
      await workflowService.afterLoadNewGraph(
        workflow,
        workflowGraphData(workflowId),
        graph
      )
    }

    it('does not open the visible workflow overlay for a background run error', () => {
      const workflowA = markLoaded(
        new ComfyWorkflow({ path: 'workflows/a.json', modified: 0, size: 0 })
      )
      const workflowB = markLoaded(
        new ComfyWorkflow({ path: 'workflows/b.json', modified: 0, size: 0 })
      )
      workflowA.changeTracker.activeState = workflowGraphData(workflowAId)
      workflowB.changeTracker.activeState = workflowGraphData(workflowBId)

      useExecutionStore().storeJob({
        nodes: ['1'],
        id: 'job-b',
        promptOutput: {},
        workflow: workflowB,
        mode: 'graph'
      })
      const executionErrorStore = useExecutionErrorStore()
      executionErrorStore.setActiveGraph(workflowAId, workflowA.path)

      const addEventListener = vi.spyOn(api, 'addEventListener')
      Reflect.apply(Reflect.get(app, 'addApiUpdateHandlers'), app, [])
      const executionErrorHandler = addEventListener.mock.calls.find(
        ([event]) => event === 'execution_error'
      )?.[1] as EventListener | undefined

      executionErrorHandler?.(
        new CustomEvent('execution_error', {
          detail: {
            prompt_id: 'job-b',
            node_id: '1',
            node_type: 'TestNode',
            exception_message: 'boom',
            exception_type: 'RuntimeError',
            traceback: []
          }
        })
      )

      expect(executionErrorHandler).toBeTypeOf('function')
      expect(executionErrorStore.isErrorOverlayOpen).toBe(false)
    })

    it.for([
      {
        event: 'execution_start',
        dispatch: () =>
          api.dispatchCustomEvent('execution_start', {
            prompt_id: 'job-b',
            timestamp: 0
          })
      }
    ])(
      'routes $event callbacks to the background job graph',
      ({ dispatch }) => {
        const visible = new LGraph()
        const background = new LGraph()
        const visibleNode = new LGraphNode('visible')
        const backgroundNode = new LGraphNode('background')
        visibleNode.onExecutionStart = () => {
          visibleNode.title = 'updated'
        }
        visibleNode.onExecuted = () => {
          visibleNode.title = 'updated'
        }
        backgroundNode.onExecutionStart = () => {
          backgroundNode.title = 'updated'
        }
        backgroundNode.onExecuted = () => {
          backgroundNode.title = 'updated'
        }
        visible.add(visibleNode)
        background.add(backgroundNode)
        const workflowA = markLoaded(
          new ComfyWorkflow({ path: 'workflows/a.json', modified: 0, size: 0 })
        )
        const workflowB = markLoaded(
          new ComfyWorkflow({ path: 'workflows/b.json', modified: 0, size: 0 })
        )
        workflowA.adoptGraph(visible)
        workflowB.adoptGraph(background)
        useWorkflowStore().activeWorkflow = workflowA
        Reflect.set(app, 'rootGraphInternal', visible)
        useExecutionStore().registerJobOwner('job-b', workflowB)
        Reflect.apply(Reflect.get(app, 'addApiUpdateHandlers'), app, [])

        dispatch()

        expect([visibleNode.title, backgroundNode.title]).toEqual([
          'visible',
          'updated'
        ])
      }
    )

    it('keeps outputs and previews of a background run off the visible workflow', () => {
      const graph = new LGraph()
      graph.add(new LGraphNode('output'))
      Reflect.set(app, 'rootGraphInternal', graph)
      const workflowA = markLoaded(
        new ComfyWorkflow({ path: 'workflows/a.json', modified: 0, size: 0 })
      )
      const workflowB = markLoaded(
        new ComfyWorkflow({ path: 'workflows/b.json', modified: 0, size: 0 })
      )
      useWorkflowStore().activeWorkflow = workflowA
      useExecutionStore().storeJob({
        nodes: ['1'],
        id: 'job-a',
        promptOutput: {},
        workflow: workflowA,
        mode: 'graph'
      })
      useExecutionStore().storeJob({
        nodes: ['1'],
        id: 'job-b',
        promptOutput: {},
        workflow: workflowB,
        mode: 'graph'
      })

      vi.spyOn(URL, 'createObjectURL').mockImplementation(
        (blob) => `blob:${blob instanceof Blob ? blob.size : 0}`
      )
      const addEventListener = vi.spyOn(api, 'addEventListener')
      Reflect.apply(Reflect.get(app, 'addApiUpdateHandlers'), app, [])
      function handlerFor(event: string) {
        return addEventListener.mock.calls.find(
          ([name]) => name === event
        )?.[1] as EventListener | undefined
      }
      function executedEvent(jobId: string) {
        return new CustomEvent('executed', {
          detail: {
            node: '1',
            display_node: '1',
            prompt_id: jobId,
            output: { text: [jobId] }
          }
        })
      }
      function previewEvent(jobId: string, blobText: string) {
        return new CustomEvent('b_preview_with_metadata', {
          detail: {
            blob: new Blob([blobText]),
            nodeId: '1',
            parentNodeId: '1',
            displayNodeId: '1',
            realNodeId: '1',
            jobId
          }
        })
      }

      useExecutionStore().activeJobId = 'job-a'
      handlerFor('executed')?.(executedEvent('job-a'))
      handlerFor('b_preview_with_metadata')?.(previewEvent('job-a', 'a'))
      handlerFor('executed')?.(executedEvent('job-b'))
      handlerFor('b_preview_with_metadata')?.(previewEvent('job-b', 'bb'))

      const nodeOutputStore = useNodeOutputStore()
      const executionId = createNodeExecutionId([1])
      expect(nodeOutputStore.getNodeOutputByExecutionId(executionId)).toEqual({
        text: ['job-a']
      })
      expect(
        nodeOutputStore.getNodePreviewImagesByExecutionId(executionId)
      ).toEqual(['blob:1'])
    })

    it('routes unmapped outputs and previews by the frame workflow id alone', () => {
      const graph = new LGraph()
      graph.add(new LGraphNode('output'))
      Reflect.set(app, 'rootGraphInternal', graph)
      const workflowA = markLoaded(
        new ComfyWorkflow({ path: 'workflows/a.json', modified: 0, size: 0 })
      )
      workflowA.changeTracker.activeState = workflowGraphData(workflowAId)
      useWorkflowStore().activeWorkflow = workflowA

      vi.spyOn(URL, 'createObjectURL').mockImplementation(
        (blob) => `blob:${blob instanceof Blob ? blob.size : 0}`
      )
      const addEventListener = vi
        .spyOn(api, 'addEventListener')
        .mockImplementation(() => {})
      vi.spyOn(api, 'init').mockResolvedValue()
      Reflect.apply(Reflect.get(app, 'addApiUpdateHandlers'), app, [])
      function handlerFor(event: Parameters<typeof api.addEventListener>[0]) {
        const handler = addEventListener.mock.calls.find(
          ([name]) => name === event
        )?.[1]
        if (typeof handler !== 'function')
          throw new Error('Expected registered function handler')
        return handler
      }
      function executedEvent(jobId: string, workflowId: string) {
        return new CustomEvent('executed', {
          detail: {
            node: '1',
            display_node: '1',
            prompt_id: jobId,
            workflow_id: workflowId,
            output: { text: [jobId] }
          }
        })
      }
      function previewEvent(
        jobId: string,
        blobText: string,
        workflowId: string
      ) {
        return new CustomEvent('b_preview_with_metadata', {
          detail: {
            blob: new Blob([blobText]),
            nodeId: '1',
            parentNodeId: '1',
            displayNodeId: '1',
            realNodeId: '1',
            jobId,
            workflowId
          }
        })
      }

      const executionStore = useExecutionStore()
      executionStore.activeJobId = 'job-own-output'
      handlerFor('executed')(executedEvent('job-own-output', workflowAId))
      executionStore.activeJobId = 'job-own-preview'
      handlerFor('b_preview_with_metadata')(
        previewEvent('job-own-preview', 'a', workflowAId)
      )
      executionStore.activeJobId = 'job-foreign-output'
      handlerFor('executed')(executedEvent('job-foreign-output', workflowBId))
      executionStore.activeJobId = 'job-foreign-preview'
      handlerFor('b_preview_with_metadata')(
        previewEvent('job-foreign-preview', 'bb', workflowBId)
      )

      const nodeOutputStore = useNodeOutputStore()
      const executionId = createNodeExecutionId([1])
      expect(
        nodeOutputStore.getNodeOutputByExecutionId(executionId),
        "the later foreign output must not overwrite the visible tab's"
      ).toEqual({ text: ['job-own-output'] })
      expect(
        nodeOutputStore.getNodePreviewImagesByExecutionId(executionId)
      ).toEqual(['blob:1'])
    })

    it('calls the onExecuted of the node an executed event names', () => {
      const graph = new LGraph()
      const node = new LGraphNode('Executed')
      node.onExecuted = vi.fn()
      graph.add(node)
      Reflect.set(app, 'rootGraphInternal', graph)
      const workflow = markLoaded(
        new ComfyWorkflow({ path: 'workflows/a.json', modified: 0, size: 0 })
      )
      workflow.changeTracker.activeState = workflowGraphData(workflowAId)
      useWorkflowStore().activeWorkflow = workflow
      const addEventListener = vi
        .spyOn(api, 'addEventListener')
        .mockImplementation(() => {})
      vi.spyOn(api, 'init').mockResolvedValue()
      Reflect.apply(Reflect.get(app, 'addApiUpdateHandlers'), app, [])
      const handler = addEventListener.mock.calls.find(
        ([name]) => name === 'executed'
      )?.[1]
      assert(typeof handler === 'function')
      useExecutionStore().activeJobId = 'job'

      handler(
        new CustomEvent('executed', {
          detail: {
            node: String(node.id),
            display_node: String(node.id),
            prompt_id: 'job',
            workflow_id: workflowAId,
            output: { text: ['done'] }
          }
        })
      )

      expect(node.onExecuted).toHaveBeenCalledExactlyOnceWith({
        text: ['done']
      })
    })

    it("gives a preview of the open workflow's run to the onPreview hooks of a node in a subgraph, and not another workflow's", () => {
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const workflowA = markLoaded(
        new ComfyWorkflow({ path: 'workflows/a.json', modified: 0, size: 0 })
      )
      workflowA.changeTracker.activeState = workflowGraphData(workflowAId)
      useWorkflowStore().activeWorkflow = workflowA
      onTestFinished(() => {
        delete window.comfy_v4
      })
      useComfyApiStore().publish()
      assert(window.comfy_v4)
      const { defs } = window.comfy_v4
      const packId = registerPublishedTestPack(window.comfy_v4)
      defs.define(packId, { type: 'Pack/Preview' })
      const previews: [string | undefined, Blob][] = []
      defs.extend(packId, 'Pack/Preview', (builder) =>
        builder.onPreview((node, frame) =>
          previews.push([node.graphId, frame.blob])
        )
      )
      const subgraph = createTestSubgraph({ rootGraph: graph })
      graph.subgraphs.set(subgraph.id, subgraph)
      const inner = addNodeOfType(subgraph, 'Pack/Preview')
      const placement = createTestSubgraphNode(subgraph)
      graph.add(placement)
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
      const addEventListener = vi
        .spyOn(api, 'addEventListener')
        .mockImplementation(() => {})
      vi.spyOn(api, 'init').mockResolvedValue()
      Reflect.apply(Reflect.get(app, 'addApiUpdateHandlers'), app, [])
      const previewHandler = addEventListener.mock.calls.find(
        ([name]) => name === 'b_preview_with_metadata'
      )?.[1]
      assert(typeof previewHandler === 'function')
      const preview = (blob: Blob, workflowId: string) =>
        previewHandler(
          new CustomEvent('b_preview_with_metadata', {
            detail: {
              blob,
              nodeId: String(inner.id),
              parentNodeId: String(placement.id),
              displayNodeId: `${placement.id}:${inner.id}`,
              realNodeId: String(inner.id),
              jobId: `job-${workflowId}`,
              workflowId
            }
          })
        )
      const own = new Blob(['own'])
      useExecutionStore().activeJobId = `job-${workflowAId}`

      preview(own, workflowAId)
      preview(new Blob(['foreign']), workflowBId)

      expect(previews).toEqual([[subgraph.id, own]])
    })

    it('restores the failed run state when returning to a workflow tab', async () => {
      const workflowService = await useRealWorkflowService()
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)

      const workflowA = markLoaded(
        new ComfyWorkflow({ path: 'workflows/a.json', modified: 0, size: 0 })
      )
      const workflowB = markLoaded(
        new ComfyWorkflow({ path: 'workflows/b.json', modified: 0, size: 0 })
      )
      await switchToWorkflow(workflowService, graph, workflowA, workflowAId)

      const executionErrorStore = useExecutionErrorStore()
      executionErrorStore.recordNodeErrors(failedKSamplerErrors)

      await switchToWorkflow(workflowService, graph, workflowB, workflowBId)

      expect(executionErrorStore.lastNodeErrors).toBeNull()

      await switchToWorkflow(workflowService, graph, workflowA, workflowAId)

      expect(executionErrorStore.lastNodeErrors).toEqual(failedKSamplerErrors)
    })

    it('gives each imported workflow its own restorable run errors', async () => {
      const workflowService = await useRealWorkflowService()
      const workflowStore = useWorkflowStore()
      workflowStore.provideChangeTracker(ChangeTracker)
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      Reflect.set(mockCanvas, 'ds', { scale: 1, offset: [0, 0] })
      vi.mocked(workflowStore.createNewTemporary).mockRestore()
      vi.mocked(workflowStore.getWorkflowByPath).mockRestore()
      vi.mocked(workflowStore.isActive).mockRestore()
      vi.mocked(workflowStore.openWorkflow).mockRestore()

      await app.loadApiJson({}, 'api-a')
      const importedA = useWorkflowStore().activeWorkflow
      const importedAId = importedA?.activeState.id
      if (!importedA || !importedAId) {
        throw new Error('Expected the first imported workflow to have an id')
      }
      expect(importedAId).not.toBe(zeroUuid)
      expect(importedAId).toBe(graph.id)

      const executionErrorStore = useExecutionErrorStore()
      executionErrorStore.recordNodeErrors(failedKSamplerErrors)

      await app.loadApiJson({}, 'api-b')
      const importedBId = useWorkflowStore().activeWorkflow?.activeState.id
      expect(importedBId).not.toBe(zeroUuid)
      expect(importedBId).not.toBe(importedAId)
      expect(executionErrorStore.lastNodeErrors).toBeNull()

      await expect(workflowService.openWorkflow(importedA)).resolves.toBe(true)

      expect(app.rootGraph).toBe(importedA.graph)
      expect(executionErrorStore.lastNodeErrors).toEqual(failedKSamplerErrors)
    })

    it.for([
      {
        source: 'a pasted workflow that fails validation',
        load: (app: ComfyApp) => {
          useSettingStore().settingValues['Comfy.Validation.Workflows'] = true
          mockValidateWorkflow.mockRejectedValueOnce(
            new Error('workflow validation blew up')
          )
          return expect(
            app.loadGraphData(createWorkflowGraphData())
          ).resolves.toBe(false)
        }
      },
      {
        source: 'an API JSON import that fails',
        load: (app: ComfyApp) => {
          vi.spyOn(useNodeReplacementStore(), 'load').mockRejectedValueOnce(
            new Error('replacement lookup failed')
          )
          return expect(app.loadApiJson({}, 'broken.json')).rejects.toThrow(
            'replacement lookup failed'
          )
        }
      }
    ])('shows the open workflow again after $source', async ({ load }) => {
      await useRealWorkflowService()
      const workflowStore = useWorkflowStore()
      workflowStore.provideChangeTracker(ChangeTracker)
      Reflect.set(app, 'rootGraphInternal', new LGraph())
      app.canvasElRef.value = document.createElement('canvas')
      Reflect.set(mockCanvas, 'ds', createTestDragAndScale())
      vi.mocked(workflowStore.createNewTemporary).mockRestore()
      vi.mocked(workflowStore.getWorkflowByPath).mockRestore()
      vi.mocked(workflowStore.isActive).mockRestore()
      vi.mocked(workflowStore.openWorkflow).mockRestore()
      await app.loadApiJson({}, 'api-open')
      const open = workflowStore.activeWorkflow
      assert.exists(open?.graph)
      assert.exists(open.changeTracker)

      await load(app)

      expect(workflowStore.activeWorkflow).toBe(open)
      expect(app.rootGraph).toBe(open.graph)
      expect(isCanvasOwner(open.changeTracker)).toBe(true)
    })

    it.for([
      {
        path: 'a clean load',
        show: ({ app }: ShowGraph) =>
          app.loadGraphData(createWorkflowGraphData(), true, true, null)
      },
      {
        path: 'a switch to a retained tab',
        show: ({ service, retained }: ShowGraph) =>
          service.openWorkflow(retained)
      }
    ])(
      'drops the previous tab warnings and run error overlay on $path',
      async ({ show }) => {
        const service = await useRealWorkflowService()
        const workflowStore = useWorkflowStore()
        workflowStore.provideChangeTracker(ChangeTracker)
        Reflect.set(app, 'rootGraphInternal', new LGraph())
        app.canvasElRef.value = document.createElement('canvas')
        Reflect.set(mockCanvas, 'ds', createTestDragAndScale())
        vi.mocked(workflowStore.createNewTemporary).mockRestore()
        vi.mocked(workflowStore.getWorkflowByPath).mockRestore()
        vi.mocked(workflowStore.isActive).mockRestore()
        vi.mocked(workflowStore.openWorkflow).mockRestore()
        await app.loadApiJson({}, 'api-retained')
        const retained = workflowStore.activeWorkflow
        assert.exists(retained)
        await app.loadApiJson({}, 'api-visible')
        const shownBefore = app.rootGraph
        const missingModelStore = useMissingModelStore()
        missingModelStore.setMissingModels([
          {
            nodeId: createNodeExecutionId([1]),
            nodeType: 'CheckpointLoaderSimple',
            widgetName: 'ckpt_name',
            name: 'model.safetensors',
            isAssetSupported: false,
            isMissing: true
          }
        ])
        const verification =
          missingModelStore.createVerificationAbortController()
        useExecutionErrorStore().showErrorOverlay()

        await show({ app, service, retained })

        expect(app.rootGraph).not.toBe(shownBefore)
        expect(app.rootGraph).toBe(workflowStore.activeWorkflow?.graph)
        expect(missingModelStore.missingModelCandidates).toBeNull()
        expect(verification.signal.aborted).toBe(true)
        expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)
      }
    )

    it('reuses the active workflow when importing the same file again', async () => {
      await useRealWorkflowService()
      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const importedWorkflow = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/repeat.json',
          modified: 0,
          size: -1
        })
      )
      vi.mocked(useWorkflowStore().createNewTemporary).mockImplementation(
        (_path, workflowData) => {
          if (workflowData) {
            importedWorkflow.changeTracker.activeState = workflowData
          }
          return importedWorkflow
        }
      )
      vi.mocked(useWorkflowStore().getWorkflowByPath).mockImplementation(
        () => useWorkflowStore().activeWorkflow
      )
      vi.mocked(useWorkflowStore().isActive).mockImplementation(
        (workflow) => useWorkflowStore().activeWorkflow === workflow
      )

      await app.loadApiJson({}, 'repeat')
      const activeWorkflow = useWorkflowStore().activeWorkflow
      await app.loadApiJson({}, 'repeat')

      expect(useWorkflowStore().activeWorkflow).toBe(activeWorkflow)
    })

    describe('an import onto a visible canvas', () => {
      const importPaths = [
        {
          path: 'API JSON',
          importFile: (app: ComfyApp) =>
            app.loadApiJson(
              { '1': { class_type: 'test/ImportCameraNode', inputs: {} } },
              'import-camera'
            )
        },
        {
          path: 'A1111',
          importFile: async (app: ComfyApp) => {
            vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
              parameters: 'positive\nNegative prompt: negative\nSteps: 20'
            })
            mockImportA1111.mockImplementation(
              async (_graph, _parameters, beforeGraphClear) => {
                const graph = await beforeGraphClear?.()
                assert(graph)
                graph.add(new LGraphNode('imported'))
                return 'imported'
              }
            )
            await app.handleFile(
              createTestFile('import-camera.png', 'image/png')
            )
          }
        }
      ]

      beforeEach(async () => {
        await useRealWorkflowService()
        const workflowStore = useWorkflowStore()
        workflowStore.provideChangeTracker(ChangeTracker)
        vi.mocked(workflowStore.createNewTemporary).mockRestore()
        vi.mocked(workflowStore.getWorkflowByPath).mockRestore()
        vi.mocked(workflowStore.isActive).mockRestore()
        vi.mocked(workflowStore.openWorkflow).mockRestore()
        useSettingStore().settingValues['Comfy.EnableWorkflowViewRestore'] =
          true
        LiteGraph.registerNodeType(
          'test/ImportCameraNode',
          class extends LGraphNode {}
        )
        onTestFinished(() => {
          delete LiteGraph.registered_node_types['test/ImportCameraNode']
        })
        const canvasElement = createTestCanvasElement({
          cssSize: [800, 600],
          visible: true
        })
        document.body.append(canvasElement)
        onTestFinished(() => canvasElement.remove())
        app.canvasElRef.value = canvasElement
        Reflect.set(app, 'rootGraphInternal', new LGraph())
        const ds = createTestDragAndScale()
        Reflect.set(mockCanvas, 'ds', ds)
        Reflect.set(mockCanvas, 'visible_area', ds.visible_area)
        Reflect.set(mockCanvas, 'bgcanvas', createTestCanvasElement())
        vi.mocked(mockCanvas.setGraph).mockImplementation((graph) => {
          Reflect.set(mockCanvas, 'graph', graph)
        })
        useCanvasStore().canvas = mockCanvas
      })

      it.for(importPaths)(
        'shows the nodes of a repeated $path import into its active tab instead of the camera saved when leaving it',
        async ({ importFile }) => {
          await importFile(app)
          const importedTab = useWorkflowStore().activeWorkflow
          mockCanvas.ds.offset = [-5000, -5000]

          await importFile(app)

          expect(useWorkflowStore().activeWorkflow).toBe(importedTab)
          const [importedNode] = app.rootGraph.nodes
          mockCanvas.ds.computeVisibleArea(undefined)
          expect(
            mockCanvas.ds.visible_area.containsRect(importedNode.boundingRect)
          ).toBe(true)
        }
      )

      it.for(importPaths)(
        'keeps the camera when an import through $path lands its nodes in the current view',
        async ({ importFile }) => {
          mockCanvas.ds.offset = [0, 0]
          mockCanvas.ds.scale = 1

          await importFile(app)

          expect({
            offset: [...mockCanvas.ds.offset],
            scale: mockCanvas.ds.scale
          }).toEqual({ offset: [0, 0], scale: 1 })
        }
      )

      it.for(importPaths)(
        'fits an import through $path whose nodes land only under the agent panel into the uncovered canvas',
        async ({ importFile }) => {
          const panel = useAgentPanelStore()
          panel.enabled = true
          panel.consentAccepted = true
          panel.isOpen = true
          panel.setWidth(420)
          onTestFinished(() => {
            panel.isOpen = false
          })
          mockCanvas.ds.offset = [400, 0]
          mockCanvas.ds.scale = 1

          await importFile(app)

          const [importedNode] = app.rootGraph.nodes
          mockCanvas.ds.computeVisibleArea([0, 0, 380, 600])
          expect(
            mockCanvas.ds.visible_area.containsRect(importedNode.boundingRect)
          ).toBe(true)
        }
      )
    })
  })

  describe('socket handlers', () => {
    it('keeps a model download that arrives as the socket starts', async () => {
      vi.spyOn(api, 'init').mockImplementation(async () => {
        api.dispatchCustomEvent('model_download', {
          status: 'downloading',
          name: 'my_style_v2.safetensors',
          dir: 'loras',
          index: 1,
          count: 1,
          bytes_downloaded: 1,
          bytes_total: 2,
          progress: 0.5,
          prompt_id: 'job-1'
        })
      })

      Reflect.apply(Reflect.get(app, 'addApiUpdateHandlers'), app, [])

      expect(api.init).toHaveBeenCalledOnce()
      expect(useJobModelDownloadStore().downloadFor('job-1')?.progress).toBe(
        0.5
      )
    })

    it('offers replacements that arrive after the workflow loaded', async () => {
      useSettingStore().settingValues['Comfy.NodeReplacement.Enabled'] = true
      LiteGraph.registerNodeType(
        'BatchImagesNode',
        class BatchImagesNode extends LGraphNode {}
      )
      class ImageBatch extends LGraphNode {
        static override nodeData = { name: 'ImageBatch', deprecated: true }
      }
      const graph = new LGraph()
      graph.add(new ImageBatch('ImageBatch', 'ImageBatch'))
      Reflect.set(app, 'rootGraphInternal', graph)
      useMissingNodesErrorStore().setMissingNodeTypes([
        { type: 'LegacyResize', nodeId: '4', isReplaceable: false }
      ])
      const backgroundWorkflow =
        useWorkflowStore().createTemporary('background.json')
      backgroundWorkflow.pendingWarnings = {
        missingNodeTypes: [
          { type: 'LegacyResize', nodeId: '7', isReplaceable: false }
        ]
      }
      useWorkflowStore().openWorkflowsInBackground({
        right: [backgroundWorkflow.path]
      })
      const replacementStore = useNodeReplacementStore()
      let finishLoading = () => {}
      vi.spyOn(replacementStore, 'load').mockReturnValue(
        new Promise<void>((resolve) => {
          finishLoading = resolve
        })
      )
      vi.spyOn(api, 'init').mockResolvedValue()
      const addEventListener = vi.spyOn(api, 'addEventListener')
      Reflect.apply(Reflect.get(app, 'addApiUpdateHandlers'), app, [])
      const listeners = [...addEventListener.mock.calls]
      onTestFinished(() => {
        for (const [event, listener] of listeners)
          api.removeEventListener(event, listener)
      })
      const featureFlagsHandler = listeners.find(
        ([event]) => event === 'feature_flags'
      )?.[1] as EventListener | undefined

      const handled = featureFlagsHandler?.(new CustomEvent('feature_flags'))
      const resizeReplacement = {
        new_node_id: 'ImageScale',
        old_node_id: 'LegacyResize',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      }
      replacementStore.replacements = {
        ImageBatch: [
          {
            new_node_id: 'BatchImagesNode',
            old_node_id: 'ImageBatch',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        ],
        LegacyResize: [resizeReplacement]
      }
      finishLoading()
      await handled

      expect(
        useDeprecatedNodesStore().nodeTypes.map((nodeType) =>
          typeof nodeType === 'string' ? nodeType : nodeType.type
        )
      ).toEqual(['ImageBatch'])
      expect(useMissingNodesErrorStore().missingNodesError?.nodeTypes).toEqual([
        {
          type: 'LegacyResize',
          nodeId: '4',
          isReplaceable: true,
          replacement: resizeReplacement
        }
      ])
      expect(backgroundWorkflow.pendingWarnings.missingNodeTypes).toEqual([
        {
          type: 'LegacyResize',
          nodeId: '7',
          isReplaceable: true,
          replacement: resizeReplacement
        }
      ])
    })
  })

  describe('refreshComboInNodes', () => {
    it('shows success toast and removes the pending toast after node defs reload', async () => {
      app.vueAppReady = true
      vi.spyOn(app, 'reloadNodeDefs').mockResolvedValue(true)

      await app.refreshComboInNodes()

      expect(useToast().info).toHaveBeenCalledWith(t('g.update'), {
        description: t('toastMessages.updateRequested')
      })
      expect(useToast().toasts).toEqual([
        expect.objectContaining({ kind: 'success' })
      ])
    })

    it('shows failure toast, removes the pending toast, and rethrows reload failures', async () => {
      app.vueAppReady = true
      const error = new Error('object_info failed')
      vi.spyOn(app, 'reloadNodeDefs').mockRejectedValue(error)

      await expect(app.refreshComboInNodes()).rejects.toThrow(error)

      expect(useToast().toasts).toEqual([
        expect.objectContaining({ kind: 'error' })
      ])
    })

    it('shows the failure toast, not the success one, and answers false when the reload refuses the definitions', async () => {
      app.vueAppReady = true
      vi.spyOn(app, 'reloadNodeDefs').mockResolvedValue(false)

      await expect(app.refreshComboInNodes()).resolves.toBe(false)

      expect(useToast().toasts).toEqual([
        expect.objectContaining({ kind: 'error' })
      ])
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
      vi.spyOn(app, 'fetchNodeDefs').mockResolvedValue({ ok: true, defs })
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

    it('marks every open graph off the canvas, including the active workflow mid-switch, as awaiting the refreshed types', async () => {
      const workflowStore = useWorkflowStore()
      const onCanvas = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/on-canvas.json',
          modified: 0,
          size: 0
        })
      )
      const switching = markLoaded(
        new ComfyWorkflow({
          path: 'workflows/switching.json',
          modified: 0,
          size: 0
        })
      )
      const onCanvasGraph = createTestRootGraph()
      const switchingGraph = new LGraph()
      onCanvas.adoptGraph(onCanvasGraph)
      switching.adoptGraph(switchingGraph)
      workflowStore.attachWorkflow(onCanvas, 0)
      workflowStore.attachWorkflow(switching, 1)
      workflowStore.activeWorkflow = switching
      Reflect.set(app, 'rootGraphInternal', onCanvasGraph)
      onTestFinished(() => {
        graphsAwaitingNodeTypes.delete(switchingGraph)
        graphsAwaitingNodeTypes.delete(onCanvasGraph)
      })
      vi.spyOn(app, 'fetchNodeDefs').mockResolvedValue({ ok: true, defs: {} })

      await expect(app.reloadNodeDefs()).resolves.toBe(true)

      expect({
        switching: graphsAwaitingNodeTypes.has(switchingGraph),
        onCanvas: graphsAwaitingNodeTypes.has(onCanvasGraph)
      }).toEqual({ switching: true, onCanvas: false })
    })

    it('fetches the definitions, or the status of an HTTP error answer that getNodeDefs reads as none', async () => {
      const refusal = () =>
        Response.json(
          { code: 'unauthorized', message: 'invalid auth token' },
          { status: 401 }
        )
      vi.spyOn(api, 'fetchApi')
        .mockResolvedValueOnce(Response.json({ Server: { name: 'Server' } }))
        .mockResolvedValueOnce(refusal())
        .mockResolvedValueOnce(refusal())

      await expect(app.fetchNodeDefs()).resolves.toEqual({
        ok: true,
        defs: { Server: expect.objectContaining({ name: 'Server' }) }
      })
      await expect(app.fetchNodeDefs()).resolves.toEqual({
        ok: false,
        status: 401
      })
      await expect(app.getNodeDefs()).resolves.toEqual({})
    })

    it('refuses a refused /object_info read when no definitions are owed, instead of reading the refusal as none', async () => {
      Reflect.set(app, 'rootGraphInternal', createTestRootGraph())
      const registerNodeDef = vi
        .spyOn(app, 'registerNodeDef')
        .mockResolvedValue(undefined)
      vi.spyOn(api, 'fetchApi').mockResolvedValue(
        Response.json({ code: 'unavailable' }, { status: 502 })
      )

      await expect(app.reloadNodeDefs()).resolves.toBe(false)

      expect(registerNodeDef).not.toHaveBeenCalled()
      expect(useExtensionStore().takeOwedNodeDefHooks()).toBe(false)
    })

    it('registers the definitions it is given without fetching them', async () => {
      const defs: Record<string, ComfyNodeDef> = {
        Custom: fromPartial<ComfyNodeDef>({ name: 'Custom' })
      }
      Reflect.set(app, 'rootGraphInternal', createTestRootGraph())
      const fetchNodeDefs = vi.spyOn(app, 'fetchNodeDefs')
      const registerNodeDef = vi
        .spyOn(app, 'registerNodeDef')
        .mockResolvedValue(undefined)

      await app.reloadNodeDefs(defs)

      expect(fetchNodeDefs).not.toHaveBeenCalled()
      expect(registerNodeDef).toHaveBeenCalledWith('Custom', defs.Custom)
    })

    it('gives the next fetched definitions to addCustomNodeDefs once when late extensions are owed them, and registers what they add', async () => {
      const custom = fromPartial<ComfyNodeDef>({ name: 'Custom' })
      Reflect.set(app, 'rootGraphInternal', createTestRootGraph())
      vi.spyOn(api, 'fetchApi').mockImplementation(async () =>
        Response.json({ Server: { name: 'Server' } })
      )
      const registerNodeDef = vi
        .spyOn(app, 'registerNodeDef')
        .mockResolvedValue(undefined)
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (method: string, defs: Record<string, ComfyNodeDef>) => {
          if (method === 'addCustomNodeDefs') defs.Custom = custom
        }
      )
      useExtensionStore().oweNodeDefHooks()

      await app.reloadNodeDefs()
      await app.reloadNodeDefs()

      expect(registerNodeDef).toHaveBeenCalledWith('Custom', custom)
      expect(
        mockExtensionService.invokeExtensionsAsync.mock.calls.filter(
          ([method]) => method === 'addCustomNodeDefs'
        )
      ).toHaveLength(1)
    })

    it('keeps the definitions owed to addCustomNodeDefs through a refused refresh and gives them the next successful ones', async () => {
      Reflect.set(app, 'rootGraphInternal', createTestRootGraph())
      vi.spyOn(app, 'registerNodeDef').mockResolvedValue(undefined)
      vi.spyOn(api, 'fetchApi')
        .mockResolvedValueOnce(
          Response.json({ code: 'unavailable' }, { status: 502 })
        )
        .mockResolvedValueOnce(Response.json({ Server: { name: 'Server' } }))
      useExtensionStore().oweNodeDefHooks()

      await app.reloadNodeDefs()
      await app.reloadNodeDefs()

      expect(
        mockExtensionService.invokeExtensionsAsync.mock.calls.filter(
          ([method]) => method === 'addCustomNodeDefs'
        )
      ).toEqual([
        [
          'addCustomNodeDefs',
          { Server: expect.objectContaining({ name: 'Server' }) }
        ]
      ])
      expect(useExtensionStore().takeOwedNodeDefHooks()).toBe(false)
    })

    it('refuses each refused refresh while definitions are owed, reports it, keeps them owed, and registers nothing', async () => {
      Reflect.set(app, 'rootGraphInternal', createTestRootGraph())
      const registerNodeDef = vi
        .spyOn(app, 'registerNodeDef')
        .mockResolvedValue(undefined)
      vi.spyOn(api, 'fetchApi')
        .mockResolvedValueOnce(
          Response.json({ code: 'unavailable' }, { status: 502 })
        )
        .mockResolvedValueOnce(
          Response.json({ code: 'unauthorized' }, { status: 401 })
        )
        .mockResolvedValueOnce(Response.json({ Server: { name: 'Server' } }))
      useExtensionStore().oweNodeDefHooks()

      await expect(app.reloadNodeDefs()).resolves.toBe(false)
      await expect(app.reloadNodeDefs()).resolves.toBe(false)
      expect(registerNodeDef).not.toHaveBeenCalled()
      expect(
        vi
          .mocked(reportError)
          .mock.calls.map(([error, options]) => [
            String(error),
            options.errorType
          ])
      ).toEqual([
        ['Error: GET /object_info answered 502', 'late_extension_failed'],
        ['Error: GET /object_info answered 401', 'late_extension_failed']
      ])
      await expect(app.reloadNodeDefs()).resolves.toBe(true)

      expect(
        mockExtensionService.invokeExtensionsAsync.mock.calls.filter(
          ([method]) => method === 'addCustomNodeDefs'
        )
      ).toEqual([
        [
          'addCustomNodeDefs',
          { Server: expect.objectContaining({ name: 'Server' }) }
        ]
      ])
    })

    it('refuses a refused refresh when no definitions are owed, reports it, and keeps the definitions it has', async () => {
      Reflect.set(app, 'rootGraphInternal', createTestRootGraph())
      const registerNodeDef = vi
        .spyOn(app, 'registerNodeDef')
        .mockResolvedValue(undefined)
      vi.spyOn(api, 'fetchApi').mockResolvedValueOnce(
        Response.json({ code: 'unavailable' }, { status: 503 })
      )

      await expect(app.reloadNodeDefs()).resolves.toBe(false)

      expect(registerNodeDef).not.toHaveBeenCalled()
      expect(mockExtensionService.invokeExtensionsAsync).not.toHaveBeenCalled()
      expect(
        vi
          .mocked(reportError)
          .mock.calls.map(([error, options]) => [
            String(error),
            options.errorType
          ])
      ).toEqual([
        ['Error: GET /object_info answered 503', 'node_defs_reload_failed']
      ])
    })
  })

  describe('refreshMissingModels', () => {
    it('delegates to the app-independent missing model refresh pipeline', async () => {
      const result = {
        missingModels: [],
        confirmedCandidates: []
      }
      vi.spyOn(app, 'reloadNodeDefs').mockResolvedValue(true)
      mockRefreshMissingModelPipeline.mockResolvedValue(result)

      await expect(app.refreshMissingModels({ silent: false })).resolves.toBe(
        result
      )

      expect(mockRefreshMissingModelPipeline).toHaveBeenCalledWith({
        reloadNodeDefs: expect.any(Function),
        missingModelStore: useMissingModelStore(),
        silent: false
      })

      await mockRefreshMissingModelPipeline.mock.calls[0][0].reloadNodeDefs()
      expect(app.reloadNodeDefs).toHaveBeenCalled()
    })

    it('omits the node definition reload when reloadDefs is false', async () => {
      vi.spyOn(app, 'reloadNodeDefs').mockResolvedValue(true)
      mockRefreshMissingModelPipeline.mockResolvedValue({
        missingModels: [],
        confirmedCandidates: []
      })

      await app.refreshMissingModels({ reloadDefs: false })

      expect(mockRefreshMissingModelPipeline).toHaveBeenCalledWith({
        reloadNodeDefs: undefined,
        missingModelStore: useMissingModelStore(),
        silent: true
      })
      expect(app.reloadNodeDefs).not.toHaveBeenCalled()
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

    it('should handle mesh model files by uploading and creating Load3DAdvanced node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue(undefined)
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('3d/model.glb')

      const modelWidget = {
        name: 'model_file',
        value: 'existing.glb',
        options: { values: ['existing.glb'] }
      }
      const mockNode = createMockNode({
        type: 'Load3DAdvanced',
        widgets: [modelWidget]
      })
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const meshFile = createTestFile('model.glb', '')

      await app.handleFile(meshFile)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(meshFile, '3d')
      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'Load3DAdvanced')
      expect(modelWidget.value).toBe('3d/model.glb')
      expect(modelWidget.options.values).toContain('3d/model.glb')
    })

    it('should load embedded workflow from mesh files instead of creating Load3DAdvanced node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        workflow: createWorkflowGraphData()
      })
      const loadGraphData = vi
        .spyOn(app, 'loadGraphData')
        .mockResolvedValue(true)

      const meshFile = createTestFile('model.glb', 'model/gltf-binary')

      await app.handleFile(meshFile)

      expect(loadGraphData).toHaveBeenCalled()
      expect(Load3dUtils.uploadFile).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })

    it('should alert the user when loading an embedded API prompt fails', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        prompt: { '1': { class_type: 'KSampler', inputs: {} } },
        parameters: 'a photo of a cat\nSteps: 20'
      })
      const loadApiJson = vi
        .spyOn(app, 'loadApiJson')
        .mockRejectedValue(new Error('build failed'))

      const imageFile = createTestFile('api.png', 'image/png')

      await expect(app.handleFile(imageFile)).resolves.toBeUndefined()

      expect(loadApiJson).toHaveBeenCalled()
      expect(useToast().warning).toHaveBeenCalledTimes(1)
      expect(mockImportA1111).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })

    it('should not create Load3DAdvanced node when mesh upload fails', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue(undefined)
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue(undefined)

      const meshFile = createTestFile('model.obj', '')

      await app.handleFile(meshFile)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(meshFile, '3d')
      expect(createNode).not.toHaveBeenCalled()
    })

    it('should report each created Load3DAdvanced node via onNodeCreated', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue(undefined)
      vi.mocked(Load3dUtils.uploadFile)
        .mockResolvedValueOnce('3d/a.glb')
        .mockResolvedValueOnce('3d/b.glb')

      const modelWidgetA = { name: 'model_file', value: '', options: {} }
      const modelWidgetB = { name: 'model_file', value: '', options: {} }
      const nodeA = createMockNode({
        id: 1,
        type: 'Load3DAdvanced',
        widgets: [modelWidgetA]
      })
      const nodeB = createMockNode({
        id: 2,
        type: 'Load3DAdvanced',
        widgets: [modelWidgetB]
      })
      vi.mocked(createNode)
        .mockResolvedValueOnce(nodeA)
        .mockResolvedValueOnce(nodeB)

      const onNodeCreated = vi.fn()
      await app.handleFile(createTestFile('a.glb', ''), 'file_drop', {
        onNodeCreated
      })
      await app.handleFile(createTestFile('b.glb', ''), 'file_drop', {
        onNodeCreated
      })

      expect(onNodeCreated).toHaveBeenNthCalledWith(1, nodeA)
      expect(onNodeCreated).toHaveBeenNthCalledWith(2, nodeB)
    })

    it('should not report a node via onNodeCreated when mesh upload fails', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue(undefined)
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue(undefined)

      const onNodeCreated = vi.fn()
      await app.handleFile(createTestFile('a.glb', ''), 'file_drop', {
        onNodeCreated
      })

      expect(onNodeCreated).not.toHaveBeenCalled()
    })

    it('positionNodes spreads stacked nodes so multi-mesh drops do not overlap', () => {
      const nodes = [
        createMockNode({
          id: 1,
          pos: [100, 200],
          getBounding: vi.fn(() => new Float64Array([100, 200, 200, 100]))
        }),
        createMockNode({ id: 2, pos: [100, 200] }),
        createMockNode({ id: 3, pos: [100, 200] })
      ]

      app.positionNodes(nodes)

      expect(nodes[0].pos).toEqual([100, 200])
      expect(nodes[1].pos).toEqual([100, 400])
      expect(nodes[2].pos).toEqual([100, 575])
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

    it.for([
      ['an invalid structure', '[]'],
      ['invalid JSON', '{invalid']
    ])('shows one error for %s', async ([, workflow]) => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({ workflow })

      await app.handleFile(createTestFile('broken.json', 'application/json'))

      expect(useToast().toasts).toEqual([
        expect.objectContaining({
          kind: 'warning',
          title: 'Unable to find workflow in broken.json'
        })
      ])
    })

    it.for([
      {
        description: undefined,
        fileName: 'a1111.png',
        loadsGraph: false,
        outcome: 'core-nodes-unavailable' as const,
        title: t('toastMessages.a1111CoreNodesUnavailable')
      },
      {
        description: undefined,
        fileName: 'parameters.png',
        loadsGraph: false,
        outcome: 'not-a1111' as const,
        title: t('toastMessages.fileLoadError', { fileName: 'parameters.png' })
      },
      {
        description: t('toastMessages.a1111EmbeddingsUnavailable'),
        fileName: 'a1111.png',
        loadsGraph: true,
        outcome: 'imported-without-embeddings' as const,
        title: t('g.warning')
      }
    ])('maps $outcome to its message', async (testCase) => {
      const graph = new LGraph()
      const parameters = 'positive\nNegative prompt: negative\nSteps: 20'
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({ parameters })
      mockImportA1111.mockResolvedValue(testCase.outcome)

      await app.handleFile(createTestFile(testCase.fileName, 'image/png'))

      expect(mockImportA1111).toHaveBeenCalledWith(
        graph,
        parameters,
        expect.any(Function)
      )
      expect(useToast().toasts).toEqual([
        expect.objectContaining({
          description: testCase.description,
          kind: 'warning',
          title: testCase.title
        })
      ])
      expect(mockWorkflowService.afterLoadNewGraph).toHaveBeenCalledTimes(
        testCase.loadsGraph ? 1 : 0
      )
    })

    it('awaits persistence and orders its clear callback before setGraph', async () => {
      const graph = new LGraph()
      const parameters = 'positive\nNegative prompt: negative\nSteps: 20'
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({ parameters })
      mockImportA1111.mockImplementation(
        async (_graph, _parameters, beforeGraphClear) => {
          await beforeGraphClear?.()
          return 'imported'
        }
      )
      let resolveAfterLoad: (() => void) | undefined
      const afterLoad = new Promise<void>((resolve) => {
        resolveAfterLoad = resolve
      })
      mockWorkflowService.afterLoadNewGraph.mockReturnValue(afterLoad)

      let settled = false
      const handleFile = app
        .handleFile(createTestFile('a1111.png', 'image/png'))
        .then(() => {
          settled = true
        })
      await vi.waitFor(() =>
        expect(mockWorkflowService.afterLoadNewGraph).toHaveBeenCalled()
      )

      expect(mockCanvas.setGraph).toHaveBeenCalledWith(graph)
      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledOnce()
      expect(mockWorkflowService.beforeLoadNewGraph).toHaveBeenCalledWith(false)
      expect(
        mockWorkflowService.beforeLoadNewGraph.mock.invocationCallOrder[0]
      ).toBeLessThan(vi.mocked(mockCanvas.setGraph).mock.invocationCallOrder[0])
      expect(
        mockExtensionService.invokeExtensionsAsync.mock.calls.map(
          ([hook]) => hook
        )
      ).toEqual(['beforeLoadGraph', 'afterConfigureGraph'])
      expect(settled).toBe(false)

      resolveAfterLoad?.()
      await handleFile
      expect(
        mockExtensionService.invokeExtensionsAsync.mock.calls.map(
          ([hook]) => hook
        )
      ).toEqual(['beforeLoadGraph', 'afterConfigureGraph', 'afterLoadGraph'])
      expect(settled).toBe(true)
    })
  })

  describe('drop handler', () => {
    function addScopedDropHandler() {
      const scope = effectScope()
      scope.run(() => app['addDropHandler']())
      onTestFinished(() => scope.stop())
    }

    it('syncs the drop position and waits for the replacement workflow before restoring warnings', async () => {
      const graphMouse: [number, number] = [-999, -999]
      const adjustMouseEvent = vi.fn((e: DragEvent) => {
        ;(e as DragEvent & { canvasX: number; canvasY: number }).canvasX = 123
        ;(e as DragEvent & { canvasX: number; canvasY: number }).canvasY = 456
      })
      app.canvas = fromPartial<LGraphCanvas>({
        ...createMockCanvas(),
        graph_mouse: graphMouse,
        adjustMouseEvent
      })

      const graph = new LGraph()
      Reflect.set(app, 'rootGraphInternal', graph)
      const outgoingWorkflow = new ComfyWorkflow({
        path: 'workflows/outgoing.json',
        modified: 0,
        size: 0
      })
      outgoingWorkflow.pendingWarnings = {
        missingNodeTypes: ['OutgoingMissingNode']
      }
      useWorkflowStore().activeWorkflow = markLoaded(outgoingWorkflow)
      const realWorkflowStore = useWorkflowStore()
      realWorkflowStore.activeWorkflow = markLoaded(outgoingWorkflow)
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes(['OutgoingMissingNode'])
      await useRealWorkflowService()

      const nodeType = 'test/UninstalledDroppedApiNode'
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        prompt: {
          '1': {
            class_type: nodeType,
            inputs: {}
          }
        }
      })
      vi.mocked(extractFilesFromDragEvent).mockResolvedValue([
        createTestFile('workflow.json', 'application/json')
      ])

      let releaseOpenWorkflow: () => void = () => {}
      const openWorkflowGate = new Promise<void>((resolve) => {
        releaseOpenWorkflow = resolve
      })
      vi.mocked(useWorkflowStore().openWorkflow).mockImplementation(
        async (workflow: ComfyWorkflow) => {
          await openWorkflowGate
          useWorkflowStore().activeWorkflow = markLoaded(workflow)
          realWorkflowStore.activeWorkflow = markLoaded(workflow)
          return markLoaded(workflow)
        }
      )

      try {
        addScopedDropHandler()

        document.dispatchEvent(new DragEvent('drop'))
        await vi.waitFor(() => {
          expect(useWorkflowStore().openWorkflow).toHaveBeenCalledOnce()
        })

        expect(adjustMouseEvent).toHaveBeenCalledTimes(1)
        expect(graphMouse).toEqual([123, 456])
        expect(missingNodesStore.missingNodesError).toBeNull()

        releaseOpenWorkflow()
        await vi.waitFor(() => {
          expect(useWorkflowStore().activeWorkflow).not.toBe(outgoingWorkflow)
        })
        await vi.waitFor(() => {
          expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
            expect.objectContaining({ type: nodeType, nodeId: '1' })
          ])
        })
      } finally {
        releaseOpenWorkflow()
      }
    })

    it('marks a node as the drag target when an onDragOver hook of the node API accepts the drag', () => {
      const graph = new LGraph()
      const { comfy, host } = createComfyApi({ getGraph: () => graph })
      const packId = registerTestPack({ comfy, host })
      registerHostType(host.nodeTypeHooks, hostNodeDef('DragTargetProbe'))
      let accepts = true
      onTestFinished(
        comfy.defs.extend(packId, 'DragTargetProbe', (builder) =>
          builder.onDragOver(() => accepts)
        )
      )
      const node = LiteGraph.createNode('DragTargetProbe')
      assert(node)
      graph.add(node)
      const canvasElement = document.createElement('canvas')
      app.canvasElRef.value = canvasElement
      app.canvas = fromPartial<LGraphCanvas>({
        adjustMouseEvent: vi.fn(),
        setDirty: vi.fn(),
        graph: fromPartial<LGraph>({ getNodeOnPos: () => node })
      })
      addScopedDropHandler()

      canvasElement.dispatchEvent(new DragEvent('dragover'))
      expect(app.dragOverNode).toBe(node)

      accepts = false
      canvasElement.dispatchEvent(new DragEvent('dragover'))
      expect(app.dragOverNode).toBeNull()
    })

    it.for([
      { hook: 'claims it', claims: true, editorReadsFiles: 0 },
      { hook: 'leaves it', claims: false, editorReadsFiles: 1 }
    ])(
      'gives a drop on the drag target to an onDrop hook of the node API, and the editor handles it only when the hook $hook',
      async ({ claims, editorReadsFiles }) => {
        const graph = new LGraph()
        const { comfy, host } = createComfyApi({ getGraph: () => graph })
        const packId = registerTestPack({ comfy, host })
        registerHostType(host.nodeTypeHooks, hostNodeDef('DropTargetProbe'))
        const dropped: [string, DragEvent][] = []
        onTestFinished(
          comfy.defs.extend(packId, 'DropTargetProbe', (builder) => {
            builder.onDragOver(() => true)
            builder.onDrop(async (handle, event) => {
              dropped.push([handle.id, event])
              return claims
            })
          })
        )
        const node = LiteGraph.createNode('DropTargetProbe')
        assert(node)
        graph.add(node)
        const canvasElement = document.createElement('canvas')
        app.canvasElRef.value = canvasElement
        app.canvas = fromPartial<LGraphCanvas>({
          ...createMockCanvas(),
          graph_mouse: [0, 0],
          adjustMouseEvent: vi.fn(),
          graph: fromPartial<LGraph>({ getNodeOnPos: () => node })
        })
        const delivered = vi.spyOn(node, 'onDragDrop')
        addScopedDropHandler()
        canvasElement.dispatchEvent(new DragEvent('dragover'))

        const drop = new DragEvent('drop')
        document.dispatchEvent(drop)

        await vi.waitFor(() => expect(delivered).toHaveBeenCalledOnce())
        await delivered.mock.results[0].value
        expect(dropped).toEqual([[String(node.id), drop]])
        expect(extractFilesFromDragEvent).toHaveBeenCalledTimes(
          editorReadsFiles
        )
      }
    )

    it('claims but ignores a drop while the canvas is select-only', async () => {
      app.canvas = fromPartial<LGraphCanvas>({
        ...createMockCanvas(),
        graph_mouse: [0, 0],
        adjustMouseEvent: vi.fn()
      })
      vi.spyOn(litegraphUtil, 'isSelectOnly').mockReturnValue(true)
      const onDragDrop = vi.fn()
      app.dragOverNode = fromPartial({ onDragDrop })
      addScopedDropHandler()

      const event = new DragEvent('drop')
      const preventDefault = vi.spyOn(event, 'preventDefault')
      document.dispatchEvent(event)
      await Promise.resolve()

      expect(preventDefault).toHaveBeenCalled()
      expect(app.dragOverNode).toBeNull()
      expect(onDragDrop).not.toHaveBeenCalled()
    })

    it.for([
      {
        drop: 'an asset card',
        mime: MIME_ASSET_INFO,
        alerts: [t('toastMessages.assetDropFailed')],
        errorTypes: ['asset_drop_load_failure']
      },
      {
        drop: 'a plain link',
        mime: 'text/uri-list',
        alerts: [],
        errorTypes: []
      }
    ])(
      'surfaces a drop that yields no file only for $drop',
      async ({ mime, alerts, errorTypes }) => {
        app.canvas = fromPartial<LGraphCanvas>({
          ...createMockCanvas(),
          graph_mouse: [0, 0],
          adjustMouseEvent: vi.fn()
        })
        vi.mocked(reportError).mockImplementation(() => {})
        const noFiles = Promise.resolve<File[]>([])
        vi.mocked(extractFilesFromDragEvent).mockReturnValue(noFiles)
        addScopedDropHandler()

        const dataTransfer = new DataTransfer()
        dataTransfer.setData(mime, 'https://example.com/content')
        const event = new DragEvent('drop', { cancelable: true })
        Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
        document.dispatchEvent(event)

        await vi.waitFor(() => {
          expect(extractFilesFromDragEvent).toHaveBeenCalledWith(event)
        })
        await noFiles

        expect(
          vi.mocked(useToast().warning).mock.calls.map(([title]) => title)
        ).toEqual(alerts)
        expect(
          vi.mocked(reportError).mock.calls.map(([, opts]) => opts.errorType)
        ).toEqual(errorTypes)
      }
    )

    it.for([
      {
        when: 'the failed import already reported itself',
        reachLifecycle: true,
        failure: new Error('A1111 import failed'),
        expectedWarnings: 0
      },
      {
        when: 'the reported import threw a primitive',
        reachLifecycle: true,
        failure: 'A1111 import failed',
        expectedWarnings: 0
      },
      {
        when: 'the import failed before it reported anything',
        reachLifecycle: false,
        failure: new Error('A1111 import failed'),
        expectedWarnings: 1
      }
    ])(
      'warns about a dropped file only when $when',
      async ({ reachLifecycle, failure, expectedWarnings }) => {
        app.canvas = fromPartial<LGraphCanvas>({
          ...createMockCanvas(),
          graph_mouse: [0, 0],
          adjustMouseEvent: vi.fn()
        })
        const graph = new LGraph()
        Reflect.set(app, 'rootGraphInternal', graph)
        vi.mocked(extractFilesFromDragEvent).mockResolvedValue([
          createTestFile('a1111.png', 'image/png')
        ])
        vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
          parameters: 'positive\nNegative prompt: negative\nSteps: 20'
        })
        mockImportA1111.mockImplementation(
          async (_graph, _parameters, beforeGraphClear) => {
            if (reachLifecycle) await beforeGraphClear?.()
            throw failure
          }
        )
        const handleFile = app.handleFile.bind(app)
        let dropFinished = false
        vi.spyOn(app, 'handleFile').mockImplementation(async (...args) => {
          try {
            return await handleFile(...args)
          } finally {
            dropFinished = true
          }
        })
        addScopedDropHandler()

        document.dispatchEvent(new DragEvent('drop'))

        await vi.waitFor(() => {
          expect(mockImportA1111).toHaveBeenCalled()
        })
        const droppedFileWarnings = () =>
          vi
            .mocked(useToast().warning)
            .mock.calls.filter(([title]) =>
              title.includes('A1111 import failed')
            )
        await vi.waitFor(() => expect(dropFinished).toBe(true))
        expect(droppedFileWarnings()).toHaveLength(expectedWarnings)
      }
    )
  })

  describe('canvas keybindings', () => {
    const origProcessKey = LGraphCanvas.prototype.processKey

    afterEach(() => {
      LGraphCanvas.prototype.processKey = origProcessKey
    })

    it('routes canvas keydown through the keybinding service before litegraph', () => {
      const executeCanvasKeybinding = vi.fn(() => true)
      vi.spyOn(keybindingServiceModule, 'useKeybindingService').mockReturnValue(
        fromPartial<
          ReturnType<typeof keybindingServiceModule.useKeybindingService>
        >({ executeCanvasKeybinding })
      )
      ;(
        app as unknown as { addProcessKeyHandler(): void }
      ).addProcessKeyHandler()

      const graph = new LGraph()
      const change = vi.spyOn(graph, 'change')
      const canvas = fromPartial<LGraphCanvas>({
        graph,
        selectedItems: new Set()
      })
      const event = new KeyboardEvent('keydown', {
        key: 'F9',
        cancelable: true
      })

      LGraphCanvas.prototype.processKey.call(canvas, event)

      expect(executeCanvasKeybinding).toHaveBeenCalledWith(event)
      expect(change).toHaveBeenCalledOnce()
    })

    it('falls through to litegraph when the keybinding service declines the event', () => {
      const executeCanvasKeybinding = vi.fn(() => false)
      vi.spyOn(keybindingServiceModule, 'useKeybindingService').mockReturnValue(
        fromPartial<
          ReturnType<typeof keybindingServiceModule.useKeybindingService>
        >({ executeCanvasKeybinding })
      )
      const processKey = vi.fn(function (this: LGraphCanvas) {
        this.graph?.change()
      })
      LGraphCanvas.prototype.processKey = processKey
      ;(
        app as unknown as { addProcessKeyHandler(): void }
      ).addProcessKeyHandler()

      const graph = new LGraph()
      const change = vi.spyOn(graph, 'change')
      const canvas = fromPartial<LGraphCanvas>({
        graph,
        selectedItems: new Set()
      })
      const event = new KeyboardEvent('keydown', {
        key: 'F9',
        cancelable: true
      })

      LGraphCanvas.prototype.processKey.call(canvas, event)

      expect(executeCanvasKeybinding).toHaveBeenCalledWith(event)
      expect(processKey).toHaveBeenCalledWith(event)
      expect(change).toHaveBeenCalledOnce()
      expect(event.defaultPrevented).toBe(false)
    })
  })
})
