import { encodeRgbaAsPng } from '@comfyorg/mask-editor/pngEncodeUtil'

import { downloadBlob } from '@/base/common/downloadUtil'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { getFromPngBuffer } from '@/scripts/metadata/png'
import { useDialogService } from '@/services/dialogService'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore' // oxlint-disable-line comfy/no-restricted-paths
import { useWorkflowDraftStoreV2 } from '@/platform/workflow/persistence/stores/workflowDraftStoreV2'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

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

import { fromAny } from '@total-typescript/shoehorn'

import { useTelemetry } from '@comfyorg/telemetry'

import type {
  LoadedComfyWorkflow,
  PendingWarnings
} from '@/platform/workflow/management/stores/comfyWorkflow'
import {
  ComfyWorkflow as ComfyWorkflowClass,
  resetReportedWorkflowStateAnomaliesForTests,
  UnreadableWorkflowError
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useSettingStore } from '@/platform/settings/settingStore'
import { blankGraph, defaultGraph } from '@/scripts/defaultGraph'
import { getDefaultWorkflow } from '@/platform/workflow/core/services/defaultWorkflowService'
import { useToast } from '@/components/ui/toast/toastStore'
import { useRunOnCloudHandoff } from '@/platform/openOnCloud/useRunOnCloudHandoff'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  isUnreadableWorkflow,
  resetWorkflowLoadQueueForTests,
  useWorkflowService
} from '@/platform/workflow/core/services/workflowService'
import type { OpenWorkflowFailure } from '@/platform/workflow/core/services/workflowService'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { showMissingNodesNotice } from '@/platform/workflowErrors/nodeReplacement/missingNodesNotice'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  graphsAwaitingNodeTypes,
  nodeTypesMayStillArrive
} from '@/platform/customNodes/lateLoading/lateNodeTypes'
import { showPlaceholdersAsWaiting } from '@/platform/customNodes/lateLoading/waitingNodes'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { UserDataExistsError } from '@comfyorg/api-client/ComfyApi'
import { cancelGhostPlacement } from '@/lib/litegraph/src/canvas/ghostPlacement'
import { ChangeTracker } from '@/scripts/changeTracker'
import {
  bindCanvasTracker,
  canCaptureCanvas,
  invalidateCanvasTracker,
  isCanvasOwner
} from '@/platform/workflow/core/canvasTrackerOwnership'
import { useAppMode } from '@/composables/useAppMode'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/canvasTestUtils'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'
import type { AppMode } from '@comfyorg/graph-model/appMode'
import { isValidUuid } from '@/utils/formatUtil'
import { zeroUuid } from '@comfyorg/graph-model/uuid'
import { t } from '@/i18n'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'), { spy: true })

beforeEach(() => {
  stubFirebaseAuthHarness()
  vi.mocked(cancelGhostPlacement).mockImplementation(() => {})
})

function isDefaultWorkflow(data: unknown): boolean {
  return JSON.stringify(data) === JSON.stringify(getDefaultWorkflow())
}

function createModeTestWorkflow(
  options: {
    path?: string
    initialMode?: AppMode | null
    activeMode?: AppMode | null
    loaded?: boolean
  } = {}
): LoadedComfyWorkflow {
  const workflow = new ComfyWorkflowClass({
    path: options.path ?? 'workflows/test.json',
    modified: Date.now(),
    size: 100
  })
  if ('initialMode' in options) workflow.initialMode = options.initialMode
  workflow.activeMode = options.activeMode ?? null
  if (options.loaded !== false) {
    workflow.changeTracker = createMockChangeTracker()
    workflow.content = '{}'
    workflow.originalContent = '{}'
  }
  return workflow as LoadedComfyWorkflow
}

function makeWorkflowData(
  extra: Record<string, unknown> = {}
): ComfyWorkflowJSON {
  return {
    last_node_id: 5,
    last_link_id: 3,
    nodes: [],
    links: [],
    groups: [],
    config: {},
    version: 0.4,
    extra
  }
}

function createEditedWorkflow(path: string): LoadedComfyWorkflow {
  const workflow = createModeTestWorkflow({ path })
  workflow.changeTracker.activeState = makeWorkflowData({ edited: true })
  return workflow
}

function makeWorkflowDataWithId(id: string): ComfyWorkflowJSON {
  return { ...makeWorkflowData(), id }
}

vi.mock(import('@/base/common/downloadUtil'))
vi.mock(import('@/services/dialogService'))

vi.mock(import('@/scripts/app'))
vi.mock(import('@/lib/litegraph/src/canvas/ghostPlacement'), { spy: true })

const mockAssert = vi.hoisted(() => vi.fn())

vi.mock(import('@/base/assert'), () => ({
  assert: mockAssert
}))

vi.mock(import('@/platform/customNodes/lateLoading/lateNodeTypes'), {
  spy: true
})
vi.mock(import('@/platform/customNodes/lateLoading/waitingNodes'))
vi.mock(
  import('@/platform/workflowErrors/nodeReplacement/missingNodesNotice'),
  {
    spy: true
  }
)

const storeThumbnailMock = vi.hoisted(() => vi.fn())

vi.mock<unknown>(
  import('@/renderer/core/thumbnail/useWorkflowThumbnail'), // oxlint-disable-line comfy/no-restricted-paths

  () => ({
    useWorkflowThumbnail: () => ({
      storeThumbnail: storeThumbnailMock,
      getThumbnail: vi.fn(),
      clearThumbnail: vi.fn(),
      moveWorkflowThumbnail: vi.fn()
    })
  })
)

const reportErrorMock = vi.hoisted(() => vi.fn())

vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: reportErrorMock
}))

vi.mock(import('@comfyorg/telemetry'))

function createWorkflow(
  warnings: PendingWarnings | null = null,
  options: { loadable?: boolean; path?: string } = {}
): ComfyWorkflow {
  const wf = {
    pendingWarnings: warnings,
    ...(options.loadable && {
      path: options.path ?? 'workflows/test.json',
      isLoaded: true,
      activeState: { nodes: [], links: [] },
      changeTracker: createMockChangeTracker()
    })
  } as Partial<ComfyWorkflow>
  return wf as ComfyWorkflow
}

function enableWarningSettings() {
  vi.spyOn(useSettingStore(), 'get').mockImplementation(
    (key: string): boolean => {
      if (key === 'Comfy.ErrorSystem.ShowMissingModels') return true
      if (key === 'Comfy.ErrorSystem.ShowMissingNodes') return true
      return false
    }
  )
}

beforeEach(() => {
  Object.assign(useCanvasStore(), { linearMode: false })
  vi.mocked(useWorkflowDraftStoreV2().saveDraft).mockImplementation(() => true)
  vi.mocked(useWorkflowDraftStoreV2().getDraft).mockReturnValue(null)
  vi.mocked(useWorkflowDraftStoreV2().removeDraft).mockImplementation(() => {})
  vi.mocked(useWorkflowDraftStoreV2().markDraftUsed).mockImplementation(
    () => {}
  )
  vi.mocked(useDomWidgetStore().clear).mockImplementation(() => {})
  vi.mocked(
    useSubgraphNavigationStore().saveCurrentViewport
  ).mockImplementation(() => {})
  vi.mocked(
    useSubgraphNavigationStore().endWorkflowNavigation
  ).mockImplementation(() => {})
})

describe('useWorkflowService', () => {
  beforeEach(() => {
    useWorkflowStore().provideChangeTracker(ChangeTracker)
    vi.mocked(app.loadGraphData).mockResolvedValue(true)
    resetWorkflowLoadQueueForTests()
    ChangeTracker.resetCanvasTrackerForTest()
    vi.mocked(useWorkflowDraftStoreV2().saveDraft).mockReturnValue(true)
  })

  afterEach(() => {
    // A leak here means a test left a load pending or a close unbalanced -
    // fail at the origin instead of as a timeout three tests later.
    const drained = resetWorkflowLoadQueueForTests()
    expect(drained).toEqual({
      pendingLoads: 0,
      closingCount: 0,
      pendingPaths: 0
    })
  })

  describe('workflow image export', () => {
    it('embeds the workflow captured after the filename prompt', async () => {
      const node = new LGraphNode('Prompt')
      node.properties.text = 'before'
      app.rootGraph.add(node)
      vi.mocked(app.graphToPrompt).mockImplementation(async () => ({
        workflow: zComfyWorkflow.parse(app.rootGraph.serialize()),
        output: {}
      }))
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key) => key === 'Comfy.PromptFilename'
      )
      let submitFilename: ((value: string) => void) | undefined
      const filename = new Promise<string | null>((resolve) => {
        submitFilename = resolve
      })
      vi.mocked(useDialogService().prompt).mockReturnValue(filename)
      const image = await encodeRgbaAsPng({
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([17, 39, 81, 255])
      })
      const downloads: Blob[] = []
      vi.mocked(downloadBlob).mockImplementation((_filename, blob) => {
        downloads.push(blob)
      })
      const exporting = useWorkflowService().exportWorkflowImage(
        'workflow',
        async () => ({ ok: true, image })
      )
      node.properties.text = 'after: 日本語 🖼️'
      assert.isDefined(submitFilename)
      submitFilename('snapshot')
      await exporting

      expect(downloads).toHaveLength(1)
      const metadata = await getFromPngBuffer(await downloads[0].arrayBuffer())
      const restored: unknown = JSON.parse(metadata.workflow)
      expect(restored).toMatchObject({
        nodes: [{ properties: { text: 'after: 日本語 🖼️' } }]
      })
    })

    it('reports a refused image without downloading a partial workflow', async () => {
      vi.spyOn(useSettingStore(), 'get').mockReturnValue(false)
      vi.mocked(app.graphToPrompt).mockResolvedValue({
        workflow: zComfyWorkflow.parse(app.rootGraph.serialize()),
        output: {}
      })
      const cause = new DOMException('Image decoding failed', 'EncodingError')

      await useWorkflowService().exportWorkflowImage('workflow', async () => ({
        ok: false,
        cause
      }))

      expect(downloadBlob).not.toHaveBeenCalled()
      expect(useToast().error).toHaveBeenCalledWith(t('g.error'), {
        description: t('toastMessages.failedToExportWorkflowImage')
      })
      expect(reportErrorMock).toHaveBeenCalledWith(cause, {
        surface: 'graph',
        errorType: 'error_rendering_workflow_image'
      })
    })
  })

  describe('showPendingWarnings', () => {
    beforeEach(() => {
      enableWarningSettings()
    })

    it('should clear missing nodes when workflow has no pending warnings', () => {
      const workflow = createWorkflow(null)
      useWorkflowService().showPendingWarnings(workflow)

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith([])
    })

    it('shows nodes as waiting, not missing, while late custom node packs may still add the types', () => {
      vi.mocked(nodeTypesMayStillArrive).mockReturnValue(true)
      const workflow = createWorkflow({ missingNodeTypes: ['LatePackNode'] })

      useWorkflowService().showPendingWarnings(workflow)

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).not.toHaveBeenCalled()
      expect(showPlaceholdersAsWaiting).toHaveBeenCalledWith(app.rootGraph)
    })

    it('should surface missing nodes and cache warnings', () => {
      const missingNodeTypes = ['CustomNode1', 'CustomNode2']
      const workflow = createWorkflow({ missingNodeTypes })

      useWorkflowService().showPendingWarnings(workflow)

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith(missingNodeTypes)
      expect(workflow.pendingWarnings).toEqual({
        missingNodeTypes,
        missingModelCandidates: undefined,
        missingMediaCandidates: undefined
      })
    })

    it('should always surface missing nodes regardless of settings', () => {
      vi.spyOn(useSettingStore(), 'get').mockReturnValue(false)

      const workflow = createWorkflow({
        missingNodeTypes: ['CustomNode1']
      })

      useWorkflowService().showPendingWarnings(workflow)

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith(['CustomNode1'])
      expect(workflow.pendingWarnings).not.toBeNull()
    })

    it('should restore cached warnings on repeated calls', () => {
      const workflow = createWorkflow({
        missingNodeTypes: ['CustomNode1']
      })

      const service = useWorkflowService()
      service.showPendingWarnings(workflow)
      service.showPendingWarnings(workflow)

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledTimes(2)
    })

    it('should NOT call showErrorOverlay when silent is true even with missing nodes', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string): boolean => {
          if (key === 'Comfy.ErrorSystem.ShowMissingModels') return true
          if (key === 'Comfy.ErrorSystem.ShowMissingNodes') return true
          if (key === 'Comfy.RightSidePanel.ShowErrorsTab') return true
          return false
        }
      )
      const workflow = createWorkflow({
        missingNodeTypes: ['CustomNode1']
      })

      useWorkflowService().showPendingWarnings(workflow, { silent: true })

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith(['CustomNode1'])
      expect(useExecutionErrorStore().showErrorOverlay).not.toHaveBeenCalled()
    })

    it('should call showErrorOverlay when silent is false and missing nodes exist', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string): boolean => {
          if (key === 'Comfy.ErrorSystem.ShowMissingModels') return true
          if (key === 'Comfy.ErrorSystem.ShowMissingNodes') return true
          if (key === 'Comfy.RightSidePanel.ShowErrorsTab') return true
          return false
        }
      )
      const workflow = createWorkflow({
        missingNodeTypes: ['CustomNode1']
      })

      useWorkflowService().showPendingWarnings(workflow)

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith(['CustomNode1'])
      expect(useExecutionErrorStore().showErrorOverlay).toHaveBeenCalled()
    })
  })

  describe('beforeLoadNewGraph', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>

    beforeEach(() => {
      enableWarningSettings()
      workflowStore = useWorkflowStore()
    })

    it('forwards the clean flag to saveCurrentViewport', () => {
      workflowStore.activeWorkflow = createModeTestWorkflow()

      useWorkflowService().beforeLoadNewGraph(false)

      expect(
        useSubgraphNavigationStore().saveCurrentViewport
      ).toHaveBeenCalledWith(false)
    })

    it('excludes an unplaced node from the outgoing graph and captured workflow', () => {
      vi.mocked(cancelGhostPlacement).mockRestore()
      const activeWorkflow = createModeTestWorkflow()
      const tracker = new ChangeTracker(activeWorkflow, makeWorkflowData())
      activeWorkflow.changeTracker = tracker
      workflowStore.activeWorkflow = activeWorkflow

      const graph = app.rootGraph
      activeWorkflow.adoptGraph(graph)
      createTestNode(graph, [], [], 'Kept')
      const node = createTestNode(graph, [], [], 'Unplaced')
      const canvas = createTestCanvas(
        graph,
        createMockCanvasRenderingContext2D()
      )
      app.canvas = canvas
      document.body.appendChild(canvas.canvas)
      try {
        canvas.startGhostPlacement(node)

        useWorkflowService().beforeLoadNewGraph()

        expect(graph.nodes.map((node) => node.title)).toEqual(['Kept'])
        expect(tracker.activeState.nodes.map((node) => node.title)).toEqual([
          'Kept'
        ])
      } finally {
        canvas.finalizeGhostPlacement(true)
        canvas.unbindEvents()
        canvas.canvas.remove()
      }
    })

    it('arms suppression by default for a clean workflow load', () => {
      workflowStore.activeWorkflow = createModeTestWorkflow()

      useWorkflowService().beforeLoadNewGraph()

      expect(
        useSubgraphNavigationStore().saveCurrentViewport
      ).toHaveBeenCalledWith(true)
    })

    it('returns the canvas replacement transition', () => {
      const tracker = createMockChangeTracker()
      bindCanvasTracker(tracker)

      const replaceCanvas = useWorkflowService().beforeLoadNewGraph()

      expect(canCaptureCanvas(tracker)).toBe(true)
      replaceCanvas()
      expect(canCaptureCanvas(tracker)).toBe(false)
    })

    it('stores a thumbnail of the active subgraph', () => {
      const activeWorkflow = createModeTestWorkflow()
      const subgraph = createTestSubgraph()
      workflowStore.activeWorkflow = activeWorkflow
      workflowStore.activeSubgraph = subgraph

      useWorkflowService().beforeLoadNewGraph()

      expect(storeThumbnailMock).toHaveBeenCalledExactlyOnceWith(
        activeWorkflow,
        subgraph
      )
    })

    it('stores a thumbnail of the canvas graph when no subgraph is active', () => {
      const activeWorkflow = createModeTestWorkflow()
      workflowStore.activeWorkflow = activeWorkflow
      workflowStore.activeSubgraph = undefined

      useWorkflowService().beforeLoadNewGraph()

      expect(storeThumbnailMock).toHaveBeenCalledExactlyOnceWith(
        activeWorkflow,
        app.canvas.graph
      )
    })

    it('should cache missingModelCandidates and missingMediaCandidates to activeWorkflow.pendingWarnings', () => {
      const activeWorkflow = createModeTestWorkflow({
        path: 'workflows/test.json'
      })
      workflowStore.activeWorkflow = activeWorkflow

      const modelCandidates = [
        {
          nodeId: '1',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          isAssetSupported: false,
          name: 'missing.safetensors',
          isMissing: true
        }
      ]
      const mediaCandidates = [
        {
          nodeId: '2',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image' as const,
          name: 'photo.png',
          isMissing: true
        }
      ]

      Object.assign(useMissingModelStore(), {
        missingModelCandidates: modelCandidates
      })
      Object.assign(useMissingMediaStore(), {
        missingMediaCandidates: mediaCandidates
      })

      useWorkflowService().beforeLoadNewGraph()

      expect(activeWorkflow.pendingWarnings).toEqual(
        expect.objectContaining({
          missingModelCandidates: modelCandidates,
          missingMediaCandidates: mediaCandidates
        })
      )
    })

    it('should stash node previews before app.clean() can revoke them', () => {
      const activeWorkflow = createModeTestWorkflow({
        path: 'workflows/test.json'
      })
      workflowStore.activeWorkflow = activeWorkflow
      const stashPreviews = vi.spyOn(
        useNodeOutputStore(),
        'stashPreviewsForWorkflow'
      )

      useWorkflowService().beforeLoadNewGraph()

      expect(stashPreviews).toHaveBeenCalledWith(activeWorkflow.path)
    })

    it('should save active workflow state through the V2 draft store', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation((key: string) => {
        return key === 'Comfy.Workflow.Persist'
      })
      const activeWorkflow = createEditedWorkflow('workflows/test.json')
      workflowStore.activeWorkflow = activeWorkflow

      useWorkflowService().beforeLoadNewGraph()

      expect(useWorkflowDraftStoreV2().saveDraft).toHaveBeenCalledWith(
        activeWorkflow.path,
        JSON.stringify(activeWorkflow.activeState),
        {
          name: activeWorkflow.key,
          isTemporary: activeWorkflow.isTemporary
        },
        { minUpdatedAt: activeWorkflow.lastModified }
      )
    })

    it('removes the draft of a saved workflow that matches its saved file', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string) => key === 'Comfy.Workflow.Persist'
      )
      const activeWorkflow = createModeTestWorkflow({
        path: 'workflows/test.json'
      })
      workflowStore.activeWorkflow = activeWorkflow

      useWorkflowService().beforeLoadNewGraph()

      expect(useWorkflowDraftStoreV2().saveDraft).not.toHaveBeenCalled()
      expect(useWorkflowDraftStoreV2().removeDraft).toHaveBeenCalledWith(
        activeWorkflow.path
      )
    })

    it('saves each tab viewport when leaving it', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string) => key === 'Comfy.Workflow.Persist'
      )
      const leave = (
        path: string,
        scale: number,
        offset: [number, number]
      ) => {
        const workflow = createModeTestWorkflow({ path })
        const tracker = new ChangeTracker(workflow, makeWorkflowData())
        tracker.reset(makeWorkflowData())
        workflow.changeTracker = tracker
        workflowStore.activeWorkflow = workflow
        app.canvas = fromAny({
          ds: { scale, offset: [...offset] }
        })
        useWorkflowService().beforeLoadNewGraph()
        expect(workflow.isModified).toBe(false)
      }

      leave('workflows/a.json', 0.15, [1, 2])
      leave('workflows/b.json', 1.55, [3, 4])

      expect(
        vi.mocked(useWorkflowDraftStoreV2().saveDraft).mock.calls.map(
          ([path, data]) => ({
            path,
            ds: JSON.parse(data).extra?.ds
          })
        )
      ).toEqual([
        { path: 'workflows/a.json', ds: { scale: 0.15, offset: [1, 2] } },
        { path: 'workflows/b.json', ds: { scale: 1.55, offset: [3, 4] } }
      ])
      expect(useWorkflowDraftStoreV2().removeDraft).not.toHaveBeenCalled()
    })

    it('keeps the tab viewport that was saved before a subgraph was opened', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string) => key === 'Comfy.Workflow.Persist'
      )
      const workflow = createModeTestWorkflow({
        path: 'workflows/nested.json'
      })
      const saved = makeWorkflowData({
        ds: { scale: 0.15, offset: [1, 2] }
      })
      const tracker = new ChangeTracker(workflow, saved)
      tracker.reset(saved)
      workflow.adoptGraph(app.rootGraph)
      vi.spyOn(app.rootGraph, 'serialize').mockReturnValue(saved as never)
      workflow.changeTracker = tracker
      workflowStore.activeWorkflow = workflow
      app.canvas = fromAny({
        ds: { scale: 4, offset: [9, 9] },
        graph: {}
      })

      useWorkflowService().beforeLoadNewGraph()

      expect(workflow.activeState.extra?.ds).toEqual({
        scale: 0.15,
        offset: [1, 2]
      })
      expect(workflow.isModified).toBe(false)
      expect(useWorkflowDraftStoreV2().saveDraft).not.toHaveBeenCalled()
      expect(useWorkflowDraftStoreV2().removeDraft).toHaveBeenCalledWith(
        workflow.path
      )
    })

    it('keeps the draft of a modified saved workflow whose baseline is its draft', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string) => key === 'Comfy.Workflow.Persist'
      )
      const activeWorkflow = createModeTestWorkflow({
        path: 'workflows/test.json'
      })
      activeWorkflow.isModified = true
      workflowStore.activeWorkflow = activeWorkflow

      useWorkflowService().beforeLoadNewGraph()

      expect(useWorkflowDraftStoreV2().saveDraft).toHaveBeenCalledWith(
        activeWorkflow.path,
        JSON.stringify(activeWorkflow.activeState),
        { name: activeWorkflow.key, isTemporary: false },
        { minUpdatedAt: activeWorkflow.lastModified }
      )
      expect(useWorkflowDraftStoreV2().removeDraft).not.toHaveBeenCalled()
    })

    it('saves a draft of a temporary workflow even when unedited', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string) => key === 'Comfy.Workflow.Persist'
      )
      const activeWorkflow = createModeTestWorkflow({
        path: 'workflows/Unsaved Workflow.json'
      })
      activeWorkflow.size = -1
      workflowStore.activeWorkflow = activeWorkflow

      useWorkflowService().beforeLoadNewGraph()

      expect(useWorkflowDraftStoreV2().saveDraft).toHaveBeenCalledWith(
        activeWorkflow.path,
        JSON.stringify(activeWorkflow.activeState),
        { name: activeWorkflow.key, isTemporary: true },
        { minUpdatedAt: activeWorkflow.lastModified }
      )
      expect(useWorkflowDraftStoreV2().removeDraft).not.toHaveBeenCalled()
    })

    it('persists the displayed state when Undo fails before graph configuration', async () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string) => key === 'Comfy.Workflow.Persist'
      )
      const activeWorkflow = createModeTestWorkflow()
      const saved = makeWorkflowData()
      const current = makeWorkflowData({ note: 'latest edit' })
      const tracker = new ChangeTracker(activeWorkflow, saved)
      activeWorkflow.changeTracker = tracker
      tracker.activeState = current
      tracker.undoQueue.push(saved)
      workflowStore.activeWorkflow = activeWorkflow
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        useWorkflowService().beforeLoadNewGraph(false)
        return false
      })

      await tracker.undo()

      expect(useWorkflowDraftStoreV2().saveDraft).toHaveBeenCalledWith(
        activeWorkflow.path,
        JSON.stringify(current),
        { name: activeWorkflow.key, isTemporary: activeWorkflow.isTemporary },
        { minUpdatedAt: activeWorkflow.lastModified }
      )
      expect(activeWorkflow.activeState).toEqual(current)
      expect(tracker.undoQueue).toEqual([saved])
      expect(tracker.redoQueue).toEqual([])
    })

    it('should show an error toast when the V2 draft store cannot save', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation((key: string) => {
        return key === 'Comfy.Workflow.Persist'
      })
      vi.mocked(useWorkflowDraftStoreV2().saveDraft).mockReturnValue(false)
      const activeWorkflow = createEditedWorkflow('workflows/test.json')
      workflowStore.activeWorkflow = activeWorkflow

      useWorkflowService().beforeLoadNewGraph()

      expect(useToast().error).toHaveBeenCalledWith(
        t('g.error'),
        expect.objectContaining({
          description: t('toastMessages.failedToSaveDraft')
        })
      )
    })

    it('should log and show an error toast when the V2 draft store throws', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation((key: string) => {
        return key === 'Comfy.Workflow.Persist'
      })
      const error = new Error('storage unavailable')
      vi.mocked(useWorkflowDraftStoreV2().saveDraft).mockImplementation(() => {
        throw error
      })
      const activeWorkflow = createEditedWorkflow('workflows/test.json')
      workflowStore.activeWorkflow = activeWorkflow

      try {
        useWorkflowService().beforeLoadNewGraph()

        expect(console.error).toHaveBeenCalledWith(
          'Failed to persist active workflow draft',
          error
        )
        expect(useToast().error).toHaveBeenCalledWith(
          t('g.error'),
          expect.objectContaining({
            description: t('toastMessages.failedToSaveDraft')
          })
        )
      } finally {
        vi.mocked(console.error).mockRestore()
      }
    })
    it('should log and show an error toast when removing an unedited draft throws', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string) => key === 'Comfy.Workflow.Persist'
      )
      const error = new Error('storage unavailable')
      vi.mocked(useWorkflowDraftStoreV2().removeDraft).mockImplementation(
        () => {
          throw error
        }
      )
      const activeWorkflow = createModeTestWorkflow({
        path: 'workflows/test.json'
      })
      workflowStore.activeWorkflow = activeWorkflow

      try {
        expect(() => useWorkflowService().beforeLoadNewGraph()).not.toThrow()

        expect(console.error).toHaveBeenCalledWith(
          'Failed to persist active workflow draft',
          error
        )
        expect(useToast().error).toHaveBeenCalledWith(
          t('g.error'),
          expect.objectContaining({
            description: t('toastMessages.failedToSaveDraft')
          })
        )
      } finally {
        vi.mocked(console.error).mockRestore()
      }
    })
  })

  describe('openWorkflow with a live graph', () => {
    let previous: LoadedComfyWorkflow
    let next: LoadedComfyWorkflow

    beforeEach(() => {
      previous = createModeTestWorkflow({ path: 'workflows/previous.json' })
      next = createModeTestWorkflow({ path: 'workflows/next.json' })
      next.adoptGraph(app.createRootGraph())
      useWorkflowStore().activeWorkflow = previous
      vi.mocked(app.activateRootGraph).mockClear()
    })

    it('shows the owned graph instead of reconfiguring from serialized state', async () => {
      await useWorkflowService().openWorkflow(next)

      expect(app.loadGraphData).not.toHaveBeenCalled()
      expect(app.activateRootGraph).toHaveBeenCalledWith(next.graph)
      expect(next.changeTracker.restore).toHaveBeenCalled()
      expect(useWorkflowStore().activeWorkflow?.path).toBe(next.path)
    })

    it('tells extensions the visible graph changed without reconfiguring', async () => {
      const calls: string[] = []
      useExtensionStore().registerExtension({
        name: 'Test.GraphSwitch',
        beforeLoadGraph: () => {
          calls.push(`beforeLoadGraph:${app.rootGraph === next.graph}`)
        },
        afterConfigureGraph: () => {
          calls.push('afterConfigureGraph')
        },
        afterLoadGraph: () => {
          calls.push(`afterLoadGraph:${app.rootGraph === next.graph}`)
        }
      })

      await useWorkflowService().openWorkflow(next)

      expect(calls).toEqual(['beforeLoadGraph:false', 'afterLoadGraph:true'])
    })

    it('lets extensions see the outgoing workflow before its tracker is deactivated', async () => {
      const deactivate = vi.mocked(previous.changeTracker.deactivate)
      let deactivationsBeforeHook: number | undefined
      useExtensionStore().registerExtension({
        name: 'Test.HookOrder',
        beforeLoadGraph: () => {
          deactivationsBeforeHook = deactivate.mock.calls.length
        }
      })

      await useWorkflowService().openWorkflow(next)

      expect(deactivationsBeforeHook).toBe(0)
      expect(deactivate).toHaveBeenCalledOnce()
    })

    it('still reconfigures when the open is forced', async () => {
      await useWorkflowService().openWorkflow(next, { force: true })

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        next,
        expect.anything()
      )
    })

    it.for([
      {
        phase: 'waiting in the graph queue',
        arrange: () => {
          vi.mocked(app.enqueueGraphLoad).mockImplementation(
            async (operation) => {
              next.unload()
              return operation()
            }
          )
        }
      },
      {
        phase: 'running beforeLoadGraph',
        arrange: () => {
          useExtensionStore().registerExtension({
            name: 'Test.UnloadDuringSwitch',
            beforeLoadGraph: () => next.unload()
          })
        }
      }
    ])(
      'refetches a tab unloaded while $phase instead of configuring defaults',
      async ({ arrange }) => {
        const fetched = makeWorkflowData({ note: 'updated remote content' })
        vi.spyOn(api, 'getUserData').mockResolvedValue(
          new Response(JSON.stringify(fetched))
        )
        arrange()

        await expect(useWorkflowService().openWorkflow(next)).resolves.toBe(
          true
        )

        expect(app.activateRootGraph).not.toHaveBeenCalled()
        expect(app.loadGraphData).toHaveBeenCalledWith(
          fetched,
          true,
          true,
          next,
          expect.objectContaining({
            deferWarnings: true,
            skipAssetScans: false
          })
        )
      }
    )

    it.for([
      {
        exit: 'the refetch fails',
        status: 404,
        currentAfterFetch: true,
        expected: 'Error: Failed to load file: 404 Not Found'
      },
      {
        exit: 'the refetch is superseded',
        status: 200,
        currentAfterFetch: false,
        expected: false
      }
    ])(
      'keeps the visible previews when $exit after a refused switch',
      async ({ status, currentAfterFetch, expected }) => {
        const outputs = useNodeOutputStore()
        Object.assign(useWorkflowStore(), { openWorkflows: [previous, next] })
        const locator = createNodeLocatorId(null, 7)
        outputs.setNodePreviewsByLocatorId(locator, ['blob:visible-preview'])
        const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL')
        let current = true
        useExtensionStore().registerExtension({
          name: 'Test.ReleaseDuringSwitch',
          beforeLoadGraph: async () => {
            await Promise.resolve()
            next.unload()
          }
        })
        vi.spyOn(api, 'getUserData').mockImplementation(async () => {
          current = currentAfterFetch
          return new Response(JSON.stringify(makeWorkflowData()), {
            status,
            statusText: 'Not Found'
          })
        })

        const result = await useWorkflowService()
          .openWorkflow(next, { isCurrent: () => current })
          .catch(String)

        expect(result).toBe(expected)
        expect(useWorkflowStore().activeWorkflow?.path).toBe(previous.path)
        expect(app.loadGraphData).not.toHaveBeenCalled()
        expect(outputs.nodePreviewImages[locator]).toEqual([
          'blob:visible-preview'
        ])
        expect(app.nodePreviewImages[locator]).toEqual(['blob:visible-preview'])
        expect(revokeObjectURL).not.toHaveBeenCalled()
        outputs.resetAllOutputsAndPreviews()
      }
    )

    it('reconfigures when late types invalidate a live switch already queued', async () => {
      const graph = next.graph
      assert(graph)
      let beginQueue = () => {}
      const queued = new Promise<void>((resolve) => {
        beginQueue = resolve
      })
      let finishQueue = () => {}
      const proceed = new Promise<void>((resolve) => {
        finishQueue = resolve
      })
      vi.mocked(app.enqueueGraphLoad).mockImplementation(async (operation) => {
        beginQueue()
        await proceed
        return operation()
      })
      const opening = useWorkflowService().openWorkflow(next)
      await queued

      graphsAwaitingNodeTypes.add(graph)
      finishQueue()
      await opening

      expect(app.activateRootGraph).not.toHaveBeenCalled()
      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        next,
        expect.anything()
      )
    })

    it('reconfigures when late types invalidate a live switch during beforeLoadGraph', async () => {
      const graph = next.graph
      assert(graph)
      onTestFinished(() => {
        graphsAwaitingNodeTypes.delete(graph)
      })
      const calls: string[] = []
      useExtensionStore().registerExtension({
        name: 'Test.LateTypesDuringSwitch',
        beforeLoadGraph: () => {
          calls.push('beforeLoadGraph')
          graphsAwaitingNodeTypes.add(graph)
        },
        onGraphLoadError: (error) => {
          calls.push(`onGraphLoadError:${(error as Error).name}`)
        }
      })
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        calls.push('loadGraphData')
        return true
      })

      await useWorkflowService().openWorkflow(next)

      expect(calls).toEqual([
        'beforeLoadGraph',
        'onGraphLoadError:AbortError',
        'loadGraphData'
      ])
      expect(app.activateRootGraph).not.toHaveBeenCalled()
      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        next,
        expect.anything()
      )
    })
  })

  describe('openWorkflow ordering', () => {
    it('reloads canvas edits made after the reload was requested', async () => {
      const workflow = createModeTestWorkflow()
      workflow.changeTracker = new ChangeTracker(workflow, makeWorkflowData())
      workflow.adoptGraph(app.rootGraph)
      useWorkflowStore().activeWorkflow = workflow
      const reloading = useWorkflowService().reloadCurrentWorkflow()
      app.rootGraph.extra.agentEdit = true

      await reloading

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.objectContaining({
          extra: expect.objectContaining({ agentEdit: true })
        }),
        true,
        true,
        workflow,
        expect.anything()
      )
    })

    describe('reload queued behind another graph load', () => {
      function queueBehindAnotherLoad(
        onLoad: (data: ComfyWorkflowJSON) => void = () => {}
      ) {
        let release = () => {}
        const front = new Promise<void>((resolve) => {
          release = resolve
        })
        const loaded: Array<ComfyWorkflowJSON | undefined | 'skipped'> = []
        vi.mocked(app.loadGraphData).mockImplementation(
          async (data, _clean, _restoreView, _workflow, options = {}) => {
            await front
            if (options.isReady?.() === false) {
              loaded.push('skipped')
              return false
            }
            const graph = options.resolveGraphData
              ? options.resolveGraphData()
              : data
            loaded.push(graph)
            assert.exists(graph)
            onLoad(graph)
            return true
          }
        )
        return { release: () => release(), loaded }
      }

      function activeWorkflow() {
        const workflow = createModeTestWorkflow()
        workflow.adoptGraph(app.rootGraph)
        workflow.changeTracker = new ChangeTracker(workflow, makeWorkflowData())
        useWorkflowStore().activeWorkflow = workflow
        return workflow
      }

      it('reloads canvas edits made while another load held the queue', async () => {
        activeWorkflow()
        const queue = queueBehindAnotherLoad()

        const reloading = useWorkflowService().reloadCurrentWorkflow()
        await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalled())
        app.rootGraph.extra.editWhileQueued = true
        queue.release()
        await reloading

        expect(queue.loaded).toEqual([
          expect.objectContaining({
            extra: expect.objectContaining({ editWhileQueued: true })
          })
        ])
      })

      it('skips the reload when it stopped being current while it waited', async () => {
        const workflow = activeWorkflow()
        const queue = queueBehindAnotherLoad()
        let idle = true
        const failure: { reason?: OpenWorkflowFailure } = {}

        const reloading = useWorkflowService().openWorkflow(workflow, {
          force: true,
          isCurrent: () => idle,
          keepSavedBaseline: true,
          failure
        })
        await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalled())
        idle = false
        queue.release()

        await expect(reloading).resolves.toBe(false)
        expect(failure.reason).toBe('superseded')
        expect(queue.loaded).toEqual(['skipped'])
      })

      it('skips the reload when another workflow took the canvas while it waited', async () => {
        const workflow = activeWorkflow()
        const queue = queueBehindAnotherLoad()
        const failure: { reason?: OpenWorkflowFailure } = {}

        const reloading = useWorkflowService().openWorkflow(workflow, {
          force: true,
          failure
        })
        await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalled())
        useWorkflowStore().activeWorkflow = createModeTestWorkflow({
          path: 'workflows/template.json'
        })
        queue.release()

        await expect(reloading).resolves.toBe(false)
        expect(failure.reason).toBe('load_skipped')
        expect(queue.loaded).toEqual(['skipped'])
        expect(app.loadGraphData).toHaveBeenCalledOnce()
      })

      function reloadedInto(workflow: LoadedComfyWorkflow) {
        return (data: ComfyWorkflowJSON) => {
          workflow.changeTracker.reset(data)
          workflow.isModified = false
        }
      }

      it('keeps an edit made while it waited as unsaved', async () => {
        const workflow = activeWorkflow()
        useWorkflowStore().attachWorkflow(workflow, 0)
        const saved = workflow.changeTracker.initialState
        expect(workflow.isModified).toBe(false)
        const queue = queueBehindAnotherLoad(reloadedInto(workflow))

        const reloading = useWorkflowService().reloadCurrentWorkflow()
        await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalled())
        app.rootGraph.extra.editWhileQueued = true
        queue.release()
        await reloading

        expect(workflow.changeTracker.initialState).toBe(saved)
        expect(workflow.isModified).toBe(true)
      })

      it('keeps the saved baseline current at its turn, not the one from before it waited', async () => {
        const workflow = activeWorkflow()
        useWorkflowStore().attachWorkflow(workflow, 0)
        app.rootGraph.extra.edited = true
        const queue = queueBehindAnotherLoad(reloadedInto(workflow))

        const reloading = useWorkflowService().reloadCurrentWorkflow()
        await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalled())
        const savedWhileWaiting = makeWorkflowData({ savedWhileWaiting: true })
        workflow.changeTracker.initialState = savedWhileWaiting
        queue.release()
        await reloading

        expect(workflow.changeTracker.initialState).toBe(savedWhileWaiting)
      })

      it('opens a background tab with its stored state, not a deferred snapshot', async () => {
        activeWorkflow()
        const other = createModeTestWorkflow({ path: 'workflows/other.json' })

        await useWorkflowService().openWorkflow(other)

        const options = vi.mocked(app.loadGraphData).mock.calls[0][4]
        expect(options?.resolveGraphData).toBeUndefined()
        expect(options?.isReady).toBeUndefined()
      })
    })

    describe('keepSavedBaseline', () => {
      function openEditedWorkflow() {
        const saved = makeWorkflowData({ saved: true })
        const workflow = createModeTestWorkflow()
        workflow.changeTracker = new ChangeTracker(workflow, saved)
        workflow.changeTracker.activeState = makeWorkflowData({
          saved: true,
          unsavedEdit: true
        })
        workflow.isModified = true
        useWorkflowStore().activeWorkflow = workflow
        app.rootGraph.extra.unsavedEdit = true
        vi.mocked(app.loadGraphData).mockImplementation(async (data) => {
          workflow.changeTracker.reset(data)
          workflow.isModified = false
          return true
        })
        return { workflow, saved }
      }

      it('keeps unsaved edits and history after a reload', async () => {
        const { workflow, saved } = openEditedWorkflow()
        const undo = makeWorkflowData({ previousEdit: true })
        workflow.changeTracker.undoQueue = [undo]
        vi.mocked(app.loadGraphData).mockImplementation(async (data) => {
          assert.exists(data)
          await useWorkflowService().afterLoadNewGraph(
            workflow,
            data,
            app.rootGraph
          )
          return true
        })

        await useWorkflowService().reloadCurrentWorkflow()

        expect(workflow.changeTracker.initialState).toBe(saved)
        expect(workflow.changeTracker.activeState.extra).toMatchObject({
          unsavedEdit: true
        })
        expect(workflow.changeTracker.undoQueue).toContainEqual(undo)
        expect(workflow.isModified).toBe(true)
      })

      it('keeps the saved baseline when the reload throws after resetting the tracker', async () => {
        const { workflow, saved } = openEditedWorkflow()
        vi.mocked(app.loadGraphData).mockImplementation(async (data) => {
          workflow.changeTracker.reset(data)
          throw new Error('afterLoadNewGraph failed')
        })

        await expect(
          useWorkflowService().openWorkflow(workflow, {
            force: true,
            keepSavedBaseline: true
          })
        ).rejects.toThrow('afterLoadNewGraph failed')

        expect(workflow.changeTracker.initialState).toBe(saved)
        expect(workflow.isModified).toBe(true)
      })

      it('keeps a save made while the reload waited behind another load', async () => {
        const { workflow } = openEditedWorkflow()
        const other = createModeTestWorkflow({ path: 'workflows/other.json' })
        let releaseOther = () => {}
        vi.mocked(app.loadGraphData).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              releaseOther = () => resolve(true)
            })
        )
        const otherLoad = useWorkflowService().openWorkflow(other)
        const reload = useWorkflowService().openWorkflow(workflow, {
          force: true,
          keepSavedBaseline: true
        })
        await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalled())

        workflow.changeTracker.prepareForSave()
        const savedNow = workflow.changeTracker.activeState
        workflow.changeTracker.reset()
        workflow.isModified = false
        releaseOther()
        await Promise.all([otherLoad, reload])

        expect(workflow.changeTracker.initialState).toEqual(savedNow)
        expect(workflow.isModified).toBe(false)
      })

      it('keeps a clean workflow clean when the reloaded graph serializes differently', async () => {
        const { workflow } = openEditedWorkflow()
        workflow.isModified = false

        await useWorkflowService().reloadCurrentWorkflow()

        expect(workflow.changeTracker.initialState).toEqual(
          workflow.changeTracker.activeState
        )
        expect(workflow.isModified).toBe(false)
      })

      it('keeps a save made while the reload was loading', async () => {
        const { workflow } = openEditedWorkflow()
        vi.mocked(app.loadGraphData).mockImplementation(async (data) => {
          workflow.changeTracker.reset(data)
          workflow.originalContent = workflow.content = JSON.stringify(data)
          workflow.isModified = false
          return true
        })

        await useWorkflowService().reloadCurrentWorkflow()

        expect(workflow.changeTracker.initialState).toEqual(
          workflow.changeTracker.activeState
        )
        expect(workflow.isModified).toBe(false)
      })

      it('keeps the saved baseline when a save during the reload fails to write', async () => {
        const { workflow, saved } = openEditedWorkflow()
        vi.mocked(app.loadGraphData).mockImplementation(async (data) => {
          workflow.changeTracker.reset(data)
          workflow.content = JSON.stringify(data)
          workflow.isModified = false
          return true
        })

        await useWorkflowService().reloadCurrentWorkflow()

        expect(workflow.changeTracker.initialState).toBe(saved)
        expect(workflow.isModified).toBe(true)
      })

      it('resets the baseline to the reloaded state without the option', async () => {
        const { workflow } = openEditedWorkflow()

        await useWorkflowService().openWorkflow(workflow, { force: true })

        expect(workflow.changeTracker.initialState).toEqual(
          workflow.changeTracker.activeState
        )
        expect(workflow.isModified).toBe(false)
      })
    })

    describe('reloadCurrentWorkflow during a tab switch', () => {
      let previous: LoadedComfyWorkflow
      let next: LoadedComfyWorkflow

      beforeEach(() => {
        const workflows = useWorkflowStore()
        previous = createModeTestWorkflow({ path: 'workflows/previous.json' })
        next = createModeTestWorkflow({ path: 'workflows/next.json' })
        next.changeTracker = new ChangeTracker(next, makeWorkflowData())
        workflows.activeWorkflow = previous
        vi.mocked(app.loadGraphData).mockImplementation(
          async (_data, _clean, _restoreView, workflow) => {
            workflows.activeWorkflow = workflow === next ? next : previous
            return true
          }
        )
      })

      it('reloads the workflow the queued switch opens', async () => {
        await Promise.all([
          useWorkflowService().openWorkflow(next),
          useWorkflowService().reloadCurrentWorkflow()
        ])

        expect(
          vi.mocked(app.loadGraphData).mock.calls.map((call) => call[3])
        ).toEqual([next, next])
      })

      it('preserves the reloaded tab saved baseline and unsaved mark after a pending switch', async () => {
        const saved = makeWorkflowData({ note: 'saved next tab' })
        const edited = makeWorkflowData({ note: 'unsaved next tab' })
        const tracker = new ChangeTracker(next, saved)
        tracker.activeState = edited
        next.changeTracker = tracker
        next.isModified = true
        const previousBaseline = previous.changeTracker.initialState
        let beginLoading = () => {}
        const loading = new Promise<void>((resolve) => {
          beginLoading = resolve
        })
        let finishLoading = () => {}
        const proceed = new Promise<void>((resolve) => {
          finishLoading = resolve
        })
        vi.mocked(app.loadGraphData)
          .mockImplementationOnce(async () => {
            beginLoading()
            await proceed
            useWorkflowStore().activeWorkflow = next
            return true
          })
          .mockImplementation(async () => {
            next.changeTracker = new ChangeTracker(next, edited)
            next.isModified = false
            return true
          })
        const opening = useWorkflowService().openWorkflow(next)
        await loading

        const reloading = useWorkflowService().reloadCurrentWorkflow()
        finishLoading()
        await Promise.all([opening, reloading])

        expect(
          vi.mocked(app.loadGraphData).mock.calls.map((call) => call[3])
        ).toEqual([next, next])
        expect(next.changeTracker.initialState).toEqual(saved)
        expect(next.isModified).toBe(true)
        expect(previous.changeTracker.initialState).toBe(previousBaseline)
      })

      it('does not reopen the previous workflow when a switch lands after the reload read it', async () => {
        await Promise.all([
          useWorkflowService().reloadCurrentWorkflow(),
          useWorkflowService().openWorkflow(next)
        ])

        expect(useWorkflowStore().activeWorkflow?.path).toBe(next.path)
      })

      it('keeps edits captured by a switch that supersedes a reload', async () => {
        const saved = makeWorkflowData({ note: 'saved previous tab' })
        previous.changeTracker = new ChangeTracker(previous, saved)
        previous.adoptGraph(app.rootGraph)
        previous.isModified = false
        next.adoptGraph(app.createRootGraph())
        useWorkflowStore().attachWorkflow(previous, 0)
        useWorkflowStore().attachWorkflow(next, 1)
        app.rootGraph.extra.note = 'new edit before switch'

        await Promise.all([
          useWorkflowService().reloadCurrentWorkflow(),
          useWorkflowService().openWorkflow(next)
        ])

        expect(useWorkflowStore().activeWorkflow?.path).toBe(next.path)
        expect(previous.isModified).toBe(true)
        expect(previous.changeTracker.activeState.extra).toEqual(
          expect.objectContaining({ note: 'new edit before switch' })
        )
      })
    })

    it('keeps the current workflow when a remote load is superseded', async () => {
      const workflows = useWorkflowStore()
      const current = createModeTestWorkflow({ path: 'workflows/current.json' })
      const loading = createModeTestWorkflow({
        path: 'workflows/closed.json',
        loaded: false
      })
      workflows.activeWorkflow = current
      let finishLoad = () => {}
      const loaded = new Promise<void>((resolve) => {
        finishLoad = resolve
      })
      const load = vi.spyOn(loading, 'load').mockImplementation(async () => {
        await loaded
        loading.originalContent = '{}'
        loading.content = '{}'
        loading.changeTracker = createMockChangeTracker()
        return loading
      })
      vi.mocked(app.loadGraphData).mockImplementation(async () => {
        workflows.activeWorkflow = loading
        return true
      })
      let currentRequest = true
      const failure: { reason?: OpenWorkflowFailure } = {}
      const opening = useWorkflowService().openWorkflow(loading, {
        isCurrent: () => currentRequest,
        failure
      })
      await vi.waitFor(() => expect(load).toHaveBeenCalled())

      currentRequest = false
      finishLoad()

      expect(await opening).toBe(false)
      expect(failure.reason).toBe('superseded')
      expect(workflows.activeWorkflow.path).toBe(current.path)
      expect(loading.isLoaded).toBe(false)
    })

    it('keeps the current workflow when the open is superseded while its graph loads', async () => {
      const workflows = useWorkflowStore()
      const current = createModeTestWorkflow({ path: 'workflows/current.json' })
      const loading = createModeTestWorkflow({
        path: 'workflows/linked.json',
        loaded: false
      })
      workflows.activeWorkflow = current
      vi.spyOn(loading, 'load').mockImplementation(async () => {
        loading.originalContent = '{}'
        loading.content = '{}'
        loading.changeTracker = createMockChangeTracker()
        return loading
      })
      let currentRequest = true
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow, options) => {
          currentRequest = false
          if (options?.isCurrent?.() === false) return false
          workflows.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const failure: { reason?: OpenWorkflowFailure } = {}
      const opened = await useWorkflowService().openWorkflow(loading, {
        isCurrent: () => currentRequest,
        failure
      })

      expect(opened).toBe(false)
      expect(failure.reason).toBe('superseded')
      expect(workflows.activeWorkflow.path).toBe(current.path)
      expect(loading.isLoaded).toBe(false)
    })

    it('keeps the saved baseline of a modified workflow kept by a superseded open', async () => {
      const workflows = useWorkflowStore()
      const saved = makeWorkflowData({ saved: true })
      const current = createModeTestWorkflow({ path: 'workflows/current.json' })
      current.changeTracker = new ChangeTracker(current, saved)
      current.changeTracker.activeState = makeWorkflowData({
        saved: true,
        unsavedEdit: true
      })
      current.isModified = true
      workflows.activeWorkflow = current
      const loading = createModeTestWorkflow({ path: 'workflows/linked.json' })
      let currentRequest = true
      vi.mocked(app.loadGraphData).mockImplementation(
        async (data, _clean, _restore, workflow, options) => {
          if (options?.isCurrent?.() === false) return false
          invalidateCanvasTracker()
          if (workflow === loading) currentRequest = false
          if (options?.isCurrent?.() === false) return false
          assert.exists(data)
          await useWorkflowService().afterLoadNewGraph(
            workflow as ComfyWorkflow,
            data,
            app.rootGraph
          )
          return true
        }
      )

      await useWorkflowService().openWorkflow(loading, {
        isCurrent: () => currentRequest
      })

      expect(workflows.activeWorkflow.path).toBe(current.path)
      expect(current.changeTracker.initialState).toBe(saved)
      expect(current.isModified).toBe(true)
    })

    it('keeps an uncaptured edit modified when a superseded open skips restoring its workflow', async () => {
      const workflows = useWorkflowStore()
      const current = createModeTestWorkflow({ path: 'workflows/current.json' })
      current.changeTracker = new ChangeTracker(current, makeWorkflowData())
      current.isModified = true
      workflows.activeWorkflow = current
      bindCanvasTracker(current.changeTracker)
      const loading = createModeTestWorkflow({ path: 'workflows/linked.json' })
      let currentRequest = true
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, _workflow, options) => {
          currentRequest = false
          if (options?.isCurrent?.() === false) return false
          return true
        }
      )

      await useWorkflowService().openWorkflow(loading, {
        isCurrent: () => currentRequest
      })

      expect(workflows.activeWorkflow.path).toBe(current.path)
      expect(current.isModified).toBe(true)
    })

    it('keeps a workflow pasted while a superseded open was loading', async () => {
      const workflows = useWorkflowStore()
      const current = createModeTestWorkflow({ path: 'workflows/current.json' })
      const pasted = createModeTestWorkflow({ path: 'workflows/pasted.json' })
      const loading = createModeTestWorkflow({ path: 'workflows/linked.json' })
      workflows.activeWorkflow = current
      bindCanvasTracker(current.changeTracker)
      let currentRequest = true
      vi.mocked(app.loadGraphData)
        .mockImplementationOnce(async () => {
          invalidateCanvasTracker()
          currentRequest = false
          return false
        })
        .mockImplementationOnce(
          async (_data, _clean, _restore, workflow, options) => {
            workflows.activeWorkflow = pasted
            bindCanvasTracker(pasted.changeTracker)
            if (options?.isCurrent?.() === false) return false
            workflows.activeWorkflow = workflow as LoadedComfyWorkflow
            return true
          }
        )

      await useWorkflowService().openWorkflow(loading, {
        isCurrent: () => currentRequest
      })

      expect(workflows.activeWorkflow.path).toBe(pasted.path)
      expect(isCanvasOwner(pasted.changeTracker)).toBe(true)
    })

    it('keeps the outputs and previews of a workflow kept by a superseded open', async () => {
      const workflows = useWorkflowStore()
      const nodeOutputs = useNodeOutputStore()
      const current = createModeTestWorkflow({ path: 'workflows/current.json' })
      current.changeTracker = new ChangeTracker(current, makeWorkflowData())
      workflows.activeWorkflow = current
      bindCanvasTracker(current.changeTracker)
      const output = {
        images: [{ filename: 'out.png', type: 'output' as const }]
      }
      nodeOutputs.nodeOutputs = { '1': output }
      nodeOutputs.nodePreviewImages = { '1': ['/api/view?filename=live.png'] }
      const loading = createModeTestWorkflow({ path: 'workflows/linked.json' })
      let currentRequest = true
      vi.mocked(app.loadGraphData).mockImplementation(
        async (data, _clean, _restore, workflow, options) => {
          if (options?.isCurrent?.() === false) return false
          useWorkflowService().beforeLoadNewGraph()()
          nodeOutputs.resetAllOutputsAndPreviews()
          if (workflow === loading) currentRequest = false
          if (options?.isCurrent?.() === false) return false
          assert.exists(data)
          await useWorkflowService().afterLoadNewGraph(
            workflow as ComfyWorkflow,
            data,
            app.rootGraph
          )
          return true
        }
      )

      await useWorkflowService().openWorkflow(loading, {
        isCurrent: () => currentRequest
      })

      expect(workflows.activeWorkflow.path).toBe(current.path)
      expect(nodeOutputs.nodeOutputs).toEqual({ '1': output })
      expect(nodeOutputs.nodePreviewImages).toEqual({
        '1': ['/api/view?filename=live.png']
      })
    })

    it('keeps a preview that arrived while a superseded open was loading', async () => {
      const workflows = useWorkflowStore()
      const nodeOutputs = useNodeOutputStore()
      const current = createModeTestWorkflow({ path: 'workflows/current.json' })
      current.changeTracker = new ChangeTracker(current, makeWorkflowData())
      workflows.activeWorkflow = current
      bindCanvasTracker(current.changeTracker)
      nodeOutputs.nodePreviewImages = {
        '1': ['/api/view?filename=older.png'],
        '2': ['/api/view?filename=other.png']
      }
      const loading = createModeTestWorkflow({ path: 'workflows/linked.json' })
      let currentRequest = true
      vi.mocked(app.loadGraphData).mockImplementation(
        async (data, _clean, _restore, workflow, options) => {
          if (options?.isCurrent?.() === false) return false
          useWorkflowService().beforeLoadNewGraph()()
          nodeOutputs.resetAllOutputsAndPreviews()
          if (workflow === loading) {
            nodeOutputs.nodePreviewImages = {
              '1': ['/api/view?filename=newer.png']
            }
            currentRequest = false
          }
          if (options?.isCurrent?.() === false) return false
          assert.exists(data)
          await useWorkflowService().afterLoadNewGraph(
            workflow as ComfyWorkflow,
            data,
            app.rootGraph
          )
          return true
        }
      )

      await useWorkflowService().openWorkflow(loading, {
        isCurrent: () => currentRequest
      })

      expect(workflows.activeWorkflow.path).toBe(current.path)
      expect(nodeOutputs.nodePreviewImages).toEqual({
        '1': ['/api/view?filename=newer.png'],
        '2': ['/api/view?filename=other.png']
      })
    })

    it('leaves a saved workflow clean after a superseded load applied its draft', async () => {
      const workflows = useWorkflowStore()
      const current = createModeTestWorkflow({ path: 'workflows/current.json' })
      const saved = createModeTestWorkflow({
        path: 'workflows/saved.json',
        loaded: false
      })
      workflows.activeWorkflow = current
      let finishLoad = () => {}
      const loaded = new Promise<void>((resolve) => {
        finishLoad = resolve
      })
      const load = vi.spyOn(saved, 'load').mockImplementation(async () => {
        await loaded
        saved.originalContent = '{}'
        saved.content = '{"draft":true}'
        saved.changeTracker = createMockChangeTracker()
        saved.isModified = true
        return saved
      })
      let currentRequest = true
      const opening = useWorkflowService().openWorkflow(saved, {
        isCurrent: () => currentRequest
      })
      await vi.waitFor(() => expect(load).toHaveBeenCalled())

      currentRequest = false
      finishLoad()

      expect(await opening).toBe(false)
      expect(saved.isLoaded).toBe(false)
      expect(saved.isModified).toBe(false)
      expect(workflows.modifiedWorkflows).not.toContain(saved)
    })

    it('keeps a temporary workflow openable after a superseded load', async () => {
      const workflows = useWorkflowStore()
      const current = createModeTestWorkflow({ path: 'workflows/current.json' })
      const draft = new ComfyWorkflowClass({
        path: 'workflows/draft.json',
        modified: Date.now(),
        size: -1
      })
      draft.content = '{"minted":true}'
      draft.originalContent = '{"minted":true}'
      workflows.activeWorkflow = current
      let finishLoad = () => {}
      const loaded = new Promise<void>((resolve) => {
        finishLoad = resolve
      })
      const load = vi.spyOn(draft, 'load').mockImplementation(async () => {
        await loaded
        draft.changeTracker = createMockChangeTracker()
        return draft as LoadedComfyWorkflow
      })
      let currentRequest = true
      const opening = useWorkflowService().openWorkflow(draft, {
        isCurrent: () => currentRequest
      })
      await vi.waitFor(() => expect(load).toHaveBeenCalled())

      currentRequest = false
      finishLoad()

      expect(await opening).toBe(false)
      expect(draft.content).toBe('{"minted":true}')
      expect(draft.originalContent).toBe('{"minted":true}')
    })

    it('settles an already superseded opening without waiting for queued loads', async () => {
      const workflows = useWorkflowStore()
      const blocker = createModeTestWorkflow({ path: 'workflows/blocker.json' })
      const stale = createModeTestWorkflow({
        path: 'workflows/stale.json',
        loaded: false
      })
      let finishBlocker = () => {}
      const blocking = new Promise<void>((resolve) => {
        finishBlocker = resolve
      })
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        await blocking
        workflows.activeWorkflow = blocker
        return true
      })
      const load = vi.spyOn(stale, 'load').mockResolvedValue(stale)
      const service = useWorkflowService()
      const first = service.openWorkflow(blocker)
      const settled = vi.fn()

      void service.openWorkflow(stale, { isCurrent: () => false }).then(settled)

      await vi.waitFor(() => expect(settled).toHaveBeenCalledWith(false))
      finishBlocker()
      await expect(first).resolves.toBe(true)
      expect(load).not.toHaveBeenCalled()
      expect(app.loadGraphData).toHaveBeenCalledOnce()
    })

    it('skips an opening superseded while it waits behind another load', async () => {
      const workflows = useWorkflowStore()
      const blocker = createModeTestWorkflow({ path: 'workflows/blocker.json' })
      const stale = createModeTestWorkflow({
        path: 'workflows/stale.json',
        loaded: false
      })
      let finishBlocker = () => {}
      const blocking = new Promise<void>((resolve) => {
        finishBlocker = resolve
      })
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        await blocking
        workflows.activeWorkflow = blocker
        return true
      })
      const load = vi.spyOn(stale, 'load').mockResolvedValue(stale)
      const service = useWorkflowService()
      const first = service.openWorkflow(blocker)
      let currentRequest = true
      const second = service.openWorkflow(stale, {
        isCurrent: () => currentRequest
      })

      currentRequest = false
      finishBlocker()

      await expect(first).resolves.toBe(true)
      await expect(second).resolves.toBe(false)
      expect(load).not.toHaveBeenCalled()
      expect(app.loadGraphData).toHaveBeenCalledOnce()
      expect(workflows.activeWorkflow?.path).toBe(blocker.path)
    })

    it('re-selecting the active workflow with no loads pending is a no-op', async () => {
      const workflowStore = useWorkflowStore()
      const active = createWorkflow(null, {
        loadable: true,
        path: 'workflows/active-noop.json'
      })
      const activeTracker = active.changeTracker
      if (!activeTracker) throw new Error('Expected loaded workflow')
      workflowStore.activeWorkflow = active as LoadedComfyWorkflow
      bindCanvasTracker(activeTracker)
      const service = useWorkflowService()

      await service.openWorkflow(active)
      expect(app.loadGraphData).not.toHaveBeenCalled()

      await service.openWorkflow(active, { force: true })
      expect(app.loadGraphData).toHaveBeenCalledTimes(1)
    })

    it('force-reloads the active instance itself after its lookup entry was replaced', async () => {
      const workflowStore = useWorkflowStore()
      const active = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replaced-entry.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replaced-entry.json'
      })
      workflowStore.activeWorkflow = active as LoadedComfyWorkflow
      workflowStore.attachWorkflow(replacement)

      await useWorkflowService().openWorkflow(active, { force: true })

      expect(vi.mocked(app.loadGraphData).mock.calls[0]?.[3]).toBe(active)
    })

    it('loads an active workflow that does not own the canvas', async () => {
      const workflowStore = useWorkflowStore()
      const active = createModeTestWorkflow({
        path: 'workflows/store-selected.json'
      })
      const activeTracker = active.changeTracker
      workflowStore.activeWorkflow = active
      const service = useWorkflowService()
      vi.mocked(app.loadGraphData).mockImplementationOnce(
        async (_workflowData, _clean, _restoreView, workflow) => {
          await service.afterLoadNewGraph(
            workflow ?? null,
            makeWorkflowData(),
            app.rootGraph
          )
          return true
        }
      )

      await service.openWorkflow(active)

      expect(app.loadGraphData).toHaveBeenCalledOnce()
      expect(isCanvasOwner(activeTracker)).toBe(true)
    })

    it('re-opens a workflow normally once its close has settled', async () => {
      const workflowStore = useWorkflowStore()
      const cycled = createWorkflow(null, {
        loadable: true,
        path: 'workflows/close-then-reopen.json'
      })
      Object.defineProperty(cycled, 'unload', { value: vi.fn() })
      const service = useWorkflowService()

      await expect(
        service.closeWorkflow(cycled, { warnIfUnsaved: false })
      ).resolves.toBe(true)

      workflowStore.activeWorkflow = null
      await service.openWorkflow(cycled)

      expect(app.loadGraphData).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ path: 'workflows/close-then-reopen.json' }),
        expect.anything()
      )
    })

    it('falls back to the default workflow when closing the last, inactive workflow', async () => {
      const workflowStore = useWorkflowStore()
      const lastOpen = createWorkflow(null, {
        loadable: true,
        path: 'workflows/last-inactive.json'
      })
      Object.defineProperty(lastOpen, 'unload', { value: vi.fn() })
      workflowStore.attachWorkflow(lastOpen, 0)
      workflowStore.activeWorkflow = null
      const service = useWorkflowService()

      await expect(
        service.closeWorkflow(lastOpen, { warnIfUnsaved: false })
      ).resolves.toBe(true)

      expect(app.loadGraphData).toHaveBeenCalledExactlyOnceWith(
        defaultGraph,
        true,
        true,
        null,
        {}
      )
    })

    it('keeps the tab open and its draft intact when the replacement load fails', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replacement.json'
      })
      workflowStore.attachWorkflow(closing, 0)
      workflowStore.attachWorkflow(replacement, 1)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(
        replacement
      )
      const storeClose = vi.spyOn(workflowStore, 'closeWorkflow')
      const error = new Error('replacement load failed')
      vi.mocked(app.loadGraphData).mockRejectedValueOnce(error)

      await expect(
        useWorkflowService().closeWorkflow(closing, { warnIfUnsaved: false })
      ).rejects.toBe(error)

      // The Aug-12 review's baked-in gap, un-baked: a tab that failed to
      // close must keep its draft.
      expect(storeClose).not.toHaveBeenCalled()
      expect(useWorkflowDraftStoreV2().removeDraft).not.toHaveBeenCalled()
    })

    it('keeps the tab and draft when the replacement load reports failure', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replacement.json'
      })
      workflowStore.attachWorkflow(closing, 0)
      workflowStore.attachWorkflow(replacement, 1)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(
        replacement
      )
      const storeClose = vi.spyOn(workflowStore, 'closeWorkflow')
      // The REAL configure-failure shape (christian-byrne's 16075 review):
      // loadGraphData shows the dialog itself and RESOLVES false - it never
      // rejects - so the guard must read the outcome, not rely on a throw.
      vi.mocked(app.loadGraphData).mockResolvedValueOnce(false)

      await expect(
        useWorkflowService().closeWorkflow(closing, { warnIfUnsaved: false })
      ).resolves.toBe(false)

      expect(storeClose).not.toHaveBeenCalled()
      expect(useWorkflowDraftStoreV2().removeDraft).not.toHaveBeenCalled()
      expect(workflowStore.openWorkflows.map((open) => open.path)).toContain(
        'workflows/closing.json'
      )
      // The failed load's intent is released (guarded no-op when the hash
      // publish already superseded it) - pins the sibling of the catch path.
      expect(
        useSubgraphNavigationStore().endWorkflowNavigation
      ).toHaveBeenCalledWith(1)
    })

    it('keeps the last tab and its draft when the default load reports failure', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      workflowStore.attachWorkflow(closing, 0)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(null)
      const storeClose = vi.spyOn(workflowStore, 'closeWorkflow')
      // Traverses loadDefaultWorkflow's boolean, not openWorkflow's: the
      // last-tab close is the branch where a dead guard deletes the only
      // draft the editor could not repaint.
      vi.mocked(app.loadGraphData).mockResolvedValueOnce(false)

      await expect(
        useWorkflowService().closeWorkflow(closing, { warnIfUnsaved: false })
      ).resolves.toBe(false)

      expect(storeClose).not.toHaveBeenCalled()
      expect(useWorkflowDraftStoreV2().removeDraft).not.toHaveBeenCalled()
      expect(workflowStore.openWorkflows.map((open) => open.path)).toContain(
        'workflows/closing.json'
      )
    })

    it('shows the retained workflow graph again when a replacement load reports failure', async () => {
      const workflowStore = useWorkflowStore()
      const retained = createModeTestWorkflow({
        path: 'workflows/retained.json'
      })
      retained.adoptGraph(app.createRootGraph())
      const failing = createModeTestWorkflow({ path: 'workflows/failing.json' })
      workflowStore.attachWorkflow(retained, 0)
      workflowStore.attachWorkflow(failing, 1)
      workflowStore.activeWorkflow = retained
      vi.mocked(app.loadGraphData).mockClear()
      vi.mocked(app.activateRootGraph).mockClear()
      vi.mocked(app.loadGraphData).mockResolvedValueOnce(false)

      await expect(useWorkflowService().openWorkflow(failing)).resolves.toBe(
        false
      )

      expect(app.loadGraphData).toHaveBeenCalledOnce()
      expect(app.activateRootGraph).toHaveBeenCalledWith(retained.graph)
      expect(retained.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.activeWorkflow.path).toBe('workflows/retained.json')
    })

    it('preserves saved baseline and unsaved edits when a failed load restores a retained graph awaiting late types', async () => {
      const workflowStore = useWorkflowStore()
      const retained = createModeTestWorkflow({
        path: 'workflows/retained.json'
      })
      const saved = makeWorkflowData({ note: 'saved retained tab' })
      const edited = makeWorkflowData({ note: 'unsaved retained tab' })
      const tracker = new ChangeTracker(retained, saved)
      tracker.activeState = edited
      retained.changeTracker = tracker
      retained.isModified = true
      const graph = app.createRootGraph()
      retained.adoptGraph(graph)
      graphsAwaitingNodeTypes.add(graph)
      const failing = createModeTestWorkflow({ path: 'workflows/failing.json' })
      workflowStore.attachWorkflow(retained, 0)
      workflowStore.attachWorkflow(failing, 1)
      workflowStore.activeWorkflow = retained
      vi.mocked(app.loadGraphData)
        .mockResolvedValueOnce(false)
        .mockImplementationOnce(async () => {
          retained.changeTracker = new ChangeTracker(retained, edited)
          retained.isModified = false
          return true
        })

      await expect(useWorkflowService().openWorkflow(failing)).resolves.toBe(
        false
      )

      expect(app.loadGraphData).toHaveBeenLastCalledWith(
        edited,
        true,
        true,
        retained,
        expect.objectContaining({ deferWarnings: true, skipAssetScans: true })
      )
      expect(app.activateRootGraph).not.toHaveBeenCalled()
      expect(workflowStore.activeWorkflow.path).toBe(retained.path)
      expect(retained.changeTracker.initialState).toEqual(saved)
      expect(retained.changeTracker.activeState).toEqual(edited)
      expect(retained.isModified).toBe(true)
    })

    it('leaves the retained workflow alone for a superseded load', async () => {
      const workflowStore = useWorkflowStore()
      const retained = createModeTestWorkflow({
        path: 'workflows/retained.json'
      })
      retained.adoptGraph(app.createRootGraph())
      const superseded = createModeTestWorkflow({
        path: 'workflows/superseded.json'
      })
      workflowStore.attachWorkflow(retained, 0)
      workflowStore.attachWorkflow(superseded, 1)
      workflowStore.activeWorkflow = retained
      vi.mocked(app.activateRootGraph).mockClear()
      vi.mocked(app.loadGraphData).mockResolvedValueOnce(undefined)

      await expect(useWorkflowService().openWorkflow(superseded)).resolves.toBe(
        true
      )

      expect(app.loadGraphData).toHaveBeenCalledOnce()
      expect(app.activateRootGraph).not.toHaveBeenCalled()
    })

    it('invalidates ownership when the replacement and retained loads fail', async () => {
      const workflowStore = useWorkflowStore()
      const retained = createModeTestWorkflow({
        path: 'workflows/retained.json'
      })
      const graph = app.createRootGraph()
      retained.adoptGraph(graph)
      graphsAwaitingNodeTypes.add(graph)
      const failing = createModeTestWorkflow({ path: 'workflows/failing.json' })
      const retainedTracker = retained.changeTracker
      workflowStore.attachWorkflow(retained, 0)
      workflowStore.attachWorkflow(failing, 1)
      workflowStore.activeWorkflow = retained
      bindCanvasTracker(retainedTracker)
      vi.mocked(app.loadGraphData).mockImplementation(async () => {
        invalidateCanvasTracker()
        return false
      })

      await expect(useWorkflowService().openWorkflow(failing)).resolves.toBe(
        false
      )

      expect(app.loadGraphData).toHaveBeenCalledTimes(2)
      expect(canCaptureCanvas(retainedTracker)).toBe(false)
    })

    it('serializes rapid workflow opens so the final selection stays active', async () => {
      const workflowStore = useWorkflowStore()
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const second = createWorkflow(null, {
        loadable: true,
        path: 'workflows/second.json'
      })
      workflowStore.activeWorkflow = second as LoadedComfyWorkflow
      let resolveFirst: (() => void) | undefined
      let concurrentLoads = 0
      let maxConcurrentLoads = 0

      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          concurrentLoads++
          maxConcurrentLoads = Math.max(maxConcurrentLoads, concurrentLoads)
          if (workflow === first) {
            await new Promise<void>((resolve) => {
              resolveFirst = resolve
            })
          }
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          concurrentLoads--
          return true
        }
      )

      const firstOpen = useWorkflowService().openWorkflow(first)
      await vi.waitFor(() => {
        expect(app.loadGraphData).toHaveBeenCalledTimes(1)
      })
      const secondOpen = useWorkflowService().openWorkflow(second)
      await Promise.resolve()

      expect(app.loadGraphData).toHaveBeenCalledTimes(1)
      resolveFirst?.()
      await Promise.all([firstOpen, secondOpen])

      expect(maxConcurrentLoads).toBe(1)
      expect(app.loadGraphData).toHaveBeenCalledTimes(2)
      expect(app.loadGraphData).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        true,
        true,
        first,
        expect.objectContaining({ workflowNavigationId: 1 })
      )
      expect(app.loadGraphData).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        true,
        true,
        second,
        expect.objectContaining({ workflowNavigationId: 2 })
      )
      expect(workflowStore.activeWorkflow.path).toBe(second.path)
    })

    it('continues with the next workflow when the previous load fails', async () => {
      const workflowStore = useWorkflowStore()
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const second = createWorkflow(null, {
        loadable: true,
        path: 'workflows/second.json'
      })
      const error = new Error('load failed')
      workflowStore.activeWorkflow = second as LoadedComfyWorkflow

      vi.mocked(app.loadGraphData)
        .mockRejectedValueOnce(error)
        .mockImplementationOnce(async (_data, _clean, _restore, workflow) => {
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        })

      const firstOpen = useWorkflowService().openWorkflow(first)
      const secondOpen = useWorkflowService().openWorkflow(second)

      await expect(firstOpen).rejects.toBe(error)
      await expect(secondOpen).resolves.toBe(true)
      expect(reportErrorMock).toHaveBeenCalledWith(error, {
        surface: 'graph',
        errorType: 'workflow_load_failure'
      })
      expect(
        useSubgraphNavigationStore().endWorkflowNavigation
      ).toHaveBeenCalledWith(1)
      expect(app.loadGraphData).toHaveBeenCalledTimes(2)
      expect(app.loadGraphData).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        true,
        true,
        first,
        expect.anything()
      )
      expect(app.loadGraphData).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        true,
        true,
        second,
        expect.anything()
      )
      expect(workflowStore.activeWorkflow.path).toBe(second.path)
    })

    it('closes an inactive workflow without waiting for an unrelated load', async () => {
      const workflowStore = useWorkflowStore()
      const current = createWorkflow(null, {
        loadable: true,
        path: 'workflows/current.json'
      })
      const loading = createWorkflow(null, {
        loadable: true,
        path: 'workflows/loading.json'
      })
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      let resolveLoad: (() => void) | undefined

      workflowStore.attachWorkflow(current, 0)
      workflowStore.attachWorkflow(loading, 1)
      workflowStore.attachWorkflow(closing, 2)
      workflowStore.activeWorkflow = current as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow === loading) {
            await new Promise<void>((resolve) => {
              resolveLoad = resolve
            })
          }
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      const loadingOpen = service.openWorkflow(loading)
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())

      await expect(
        service.closeWorkflow(closing, { warnIfUnsaved: false })
      ).resolves.toBe(true)
      expect(workflowStore.openWorkflows).not.toContain(closing)

      resolveLoad?.()
      await loadingOpen
    })

    it('waits for a workflow in flight before closing it', async () => {
      const workflowStore = useWorkflowStore()
      const current = createWorkflow(null, {
        loadable: true,
        path: 'workflows/current.json'
      })
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      let resolveLoad: (() => void) | undefined

      workflowStore.attachWorkflow(current, 0)
      workflowStore.attachWorkflow(closing, 1)
      workflowStore.activeWorkflow = current as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow === closing) {
            await new Promise<void>((resolve) => {
              resolveLoad = resolve
            })
          }
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      const opening = service.openWorkflow(closing)
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
      let closeSettled = false
      const close = service
        .closeWorkflow(closing, { warnIfUnsaved: false })
        .finally(() => {
          closeSettled = true
        })
      await Promise.resolve()
      expect(closeSettled).toBe(false)

      resolveLoad?.()
      await Promise.all([opening, close])
      expect(workflowStore.openWorkflows).not.toContain(closing)
    })

    it('does not extend an inactive close with a later unrelated load', async () => {
      const workflowStore = useWorkflowStore()
      const current = createWorkflow(null, {
        loadable: true,
        path: 'workflows/current.json'
      })
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const unrelated = createWorkflow(null, {
        loadable: true,
        path: 'workflows/unrelated.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      const closingError = new Error('closing load failed')
      let rejectClosing: ((error: Error) => void) | undefined
      let resolveUnrelated: (() => void) | undefined
      let unrelatedStarted = false

      workflowStore.attachWorkflow(current, 0)
      workflowStore.attachWorkflow(closing, 1)
      workflowStore.attachWorkflow(unrelated, 2)
      workflowStore.activeWorkflow = current as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow === closing) {
            await new Promise<void>((_resolve, reject) => {
              rejectClosing = reject
            })
          }
          if (workflow === unrelated) {
            unrelatedStarted = true
            await new Promise<void>((resolve) => {
              resolveUnrelated = resolve
            })
          }
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      const opening = service.openWorkflow(closing)
      const openingResult = opening.catch((error: unknown) => error)
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())

      let closeSettled = false
      const close = service
        .closeWorkflow(closing, { warnIfUnsaved: false })
        .finally(() => {
          closeSettled = true
        })
      const unrelatedOpen = service.openWorkflow(unrelated)

      rejectClosing?.(closingError)
      expect(await openingResult).toBe(closingError)
      await vi.waitFor(() => expect(unrelatedStarted).toBe(true))
      await vi.waitFor(() => expect(closeSettled).toBe(true))
      expect(workflowStore.openWorkflows).not.toContain(closing)

      resolveUnrelated?.()
      await Promise.all([close, unrelatedOpen])
    })

    it('falls back to the next tab when activation history is empty', async () => {
      const workflowStore = useWorkflowStore()
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const next = createWorkflow(null, {
        loadable: true,
        path: 'workflows/next.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })

      workflowStore.attachWorkflow(first, 0)
      workflowStore.attachWorkflow(closing, 1)
      workflowStore.attachWorkflow(next, 2)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(null)
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      await useWorkflowService().closeWorkflow(closing, {
        warnIfUnsaved: false
      })

      expect(workflowStore.activeWorkflow.path).toBe(next.path)
      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        next,
        expect.anything()
      )
    })

    it('keeps a workflow closed when its queued open settles later', async () => {
      const workflowStore = useWorkflowStore()
      const current = createWorkflow(null, {
        loadable: true,
        path: 'workflows/current.json'
      })
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const second = createWorkflow(null, {
        loadable: true,
        path: 'workflows/second.json'
      })
      Object.defineProperty(second, 'unload', { value: vi.fn() })
      let resolveFirst: (() => void) | undefined

      workflowStore.attachWorkflow(current, 0)
      workflowStore.attachWorkflow(first, 1)
      workflowStore.attachWorkflow(second, 2)
      workflowStore.activeWorkflow = current as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(current)
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow === first) {
            await new Promise<void>((resolve) => {
              resolveFirst = resolve
            })
          }
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      const firstOpen = service.openWorkflow(first)
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
      const secondOpen = service.openWorkflow(second)
      const close = service.closeWorkflow(second, { warnIfUnsaved: false })
      resolveFirst?.()

      await Promise.all([firstOpen, secondOpen, close])

      expect(workflowStore.openWorkflows).not.toContain(second)
      expect(workflowStore.activeWorkflow.path).toBe(current.path)
    })

    it('does not let an older close override a newer workflow selection', async () => {
      const workflowStore = useWorkflowStore()
      const current = createWorkflow(null, {
        loadable: true,
        path: 'workflows/current.json'
      })
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const second = createWorkflow(null, {
        loadable: true,
        path: 'workflows/second.json'
      })
      const final = createWorkflow(null, {
        loadable: true,
        path: 'workflows/final.json'
      })
      Object.defineProperty(second, 'unload', { value: vi.fn() })
      let resolveFirst: (() => void) | undefined

      workflowStore.attachWorkflow(current, 0)
      workflowStore.attachWorkflow(first, 1)
      workflowStore.attachWorkflow(second, 2)
      workflowStore.attachWorkflow(final, 3)
      workflowStore.activeWorkflow = current as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(current)
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow === first) {
            await new Promise<void>((resolve) => {
              resolveFirst = resolve
            })
          }
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      const firstOpen = service.openWorkflow(first)
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
      const secondOpen = service.openWorkflow(second)
      const close = service.closeWorkflow(second, { warnIfUnsaved: false })
      const finalOpen = service.openWorkflow(final)
      resolveFirst?.()

      await Promise.all([firstOpen, secondOpen, close, finalOpen])

      expect(workflowStore.openWorkflows).not.toContain(second)
      expect(workflowStore.activeWorkflow.path).toBe(final.path)
      expect(app.loadGraphData).toHaveBeenCalledTimes(3)
      expect(app.loadGraphData).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        true,
        true,
        first,
        expect.anything()
      )
      expect(app.loadGraphData).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        true,
        true,
        second,
        expect.anything()
      )
      expect(app.loadGraphData).toHaveBeenNthCalledWith(
        3,
        expect.anything(),
        true,
        true,
        final,
        expect.anything()
      )
    })

    it('falls back after a newer workflow selection fails', async () => {
      const workflowStore = useWorkflowStore()
      const current = createWorkflow(null, {
        loadable: true,
        path: 'workflows/current.json'
      })
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const failing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/failing.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      let resolveFirst: (() => void) | undefined

      workflowStore.attachWorkflow(current, 0)
      workflowStore.attachWorkflow(first, 1)
      workflowStore.attachWorkflow(closing, 2)
      workflowStore.attachWorkflow(failing, 3)
      workflowStore.activeWorkflow = current as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(current)
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow === first) {
            await new Promise<void>((resolve) => {
              resolveFirst = resolve
            })
          }
          if (workflow === failing) throw new Error('load failed')
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      const firstOpen = service.openWorkflow(first)
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
      const closingOpen = service.openWorkflow(closing)
      const close = service.closeWorkflow(closing, { warnIfUnsaved: false })
      const failingOpen = service.openWorkflow(failing)
      resolveFirst?.()

      await Promise.all([
        firstOpen,
        closingOpen,
        close,
        expect(failingOpen).rejects.toThrow('load failed')
      ])

      expect(workflowStore.openWorkflows).not.toContain(closing)
      expect(workflowStore.activeWorkflow.path).toBe(current.path)
    })

    it('serializes a newer selection after the last-tab replacement', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replacement.json'
      })
      const final = createWorkflow(null, {
        loadable: true,
        path: 'workflows/final.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      let resolveDefault: (() => void) | undefined
      let concurrentLoads = 0
      let maxConcurrentLoads = 0

      workflowStore.attachWorkflow(closing, 0)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          concurrentLoads++
          maxConcurrentLoads = Math.max(maxConcurrentLoads, concurrentLoads)
          if (!workflow) {
            await new Promise<void>((resolve) => {
              resolveDefault = () => {
                workflowStore.attachWorkflow(replacement, 1)
                workflowStore.activeWorkflow =
                  replacement as LoadedComfyWorkflow
                resolve()
              }
            })
          } else {
            workflowStore.attachWorkflow(final, 2)
            workflowStore.activeWorkflow = final as LoadedComfyWorkflow
          }
          concurrentLoads--
          return true
        }
      )

      const service = useWorkflowService()
      const close = service.closeWorkflow(closing, { warnIfUnsaved: false })
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
      const finalOpen = service.openWorkflow(final)
      await Promise.resolve()

      expect(app.loadGraphData).toHaveBeenCalledOnce()
      resolveDefault?.()
      await Promise.all([close, finalOpen])

      expect(maxConcurrentLoads).toBe(1)
      expect(workflowStore.openWorkflows).not.toContain(closing)
      expect(workflowStore.activeWorkflow.path).toBe(final.path)
      expect(app.loadGraphData).toHaveBeenCalledTimes(2)
      expect(app.loadGraphData).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        true,
        true,
        null,
        {}
      )
      expect(app.loadGraphData).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        true,
        true,
        final,
        expect.anything()
      )
    })

    it('does not reopen the workflow being closed', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replacement.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      let resolveDefault: (() => void) | undefined

      workflowStore.attachWorkflow(closing, 0)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow) {
            workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
            return true
          }
          await new Promise<void>((resolve) => {
            resolveDefault = () => {
              workflowStore.attachWorkflow(replacement, 1)
              workflowStore.activeWorkflow = replacement as LoadedComfyWorkflow
              resolve()
            }
          })
          return true
        }
      )

      const service = useWorkflowService()
      const close = service.closeWorkflow(closing, { warnIfUnsaved: false })
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
      const failure: { reason?: OpenWorkflowFailure } = {}
      const staleOpen = service.openWorkflow(closing, { failure })
      resolveDefault?.()

      await Promise.all([close, staleOpen])

      expect(failure.reason).toBe('closing')
      expect(app.loadGraphData).toHaveBeenCalledOnce()
      expect(workflowStore.openWorkflows).not.toContain(closing)
      expect(workflowStore.activeWorkflow.path).toBe(replacement.path)
    })

    it('keeps a valid active workflow when closing tabs concurrently', async () => {
      const workflowStore = useWorkflowStore()
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const second = createWorkflow(null, {
        loadable: true,
        path: 'workflows/second.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replacement.json'
      })
      Object.defineProperty(first, 'unload', { value: vi.fn() })
      Object.defineProperty(second, 'unload', { value: vi.fn() })

      workflowStore.attachWorkflow(first, 0)
      workflowStore.attachWorkflow(second, 1)
      workflowStore.activeWorkflow = first as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow) return true
          workflowStore.attachWorkflow(replacement, 2)
          workflowStore.activeWorkflow = replacement as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      await Promise.all([
        service.closeWorkflow(first, { warnIfUnsaved: false }),
        service.closeWorkflow(second, { warnIfUnsaved: false })
      ])

      expect(app.loadGraphData).toHaveBeenCalledOnce()
      expect(workflowStore.openWorkflows).not.toContain(first)
      expect(workflowStore.openWorkflows).not.toContain(second)
      expect(workflowStore.activeWorkflow.path).toBe(replacement.path)
    })

    it('never selects a workflow that is itself closing as the replacement', async () => {
      const workflowStore = useWorkflowStore()
      const active = createWorkflow(null, {
        loadable: true,
        path: 'workflows/active.json'
      })
      const alsoClosing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/also-closing.json'
      })
      const survivor = createWorkflow(null, {
        loadable: true,
        path: 'workflows/survivor.json'
      })
      for (const wf of [active, alsoClosing, survivor]) {
        Object.defineProperty(wf, 'unload', { value: vi.fn() })
      }
      workflowStore.attachWorkflow(active, 0)
      workflowStore.attachWorkflow(alsoClosing, 1)
      workflowStore.attachWorkflow(survivor, 2)
      workflowStore.activeWorkflow = active as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(
        alsoClosing
      )

      // Hold alsoClosing's pending open so its close stays registered as
      // closing while the active close chooses its replacement.
      let releaseHeldLoad = (): void => {}
      vi.mocked(app.loadGraphData).mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            releaseHeldLoad = () => resolve(true)
          })
      )
      const heldOpen = useWorkflowService().openWorkflow(alsoClosing)
      const closingOther = useWorkflowService().closeWorkflow(alsoClosing, {
        warnIfUnsaved: false
      })

      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow) {
            workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          }
          return true
        }
      )
      const closingActive = useWorkflowService().closeWorkflow(active, {
        warnIfUnsaved: false
      })
      await Promise.resolve()
      releaseHeldLoad()
      await Promise.all([heldOpen, closingOther, closingActive])

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        survivor,
        expect.anything()
      )
      expect(workflowStore.activeWorkflow.path).toBe(survivor.path)
    })

    it('skips a closing candidate in the index-shift fallback', async () => {
      const workflowStore = useWorkflowStore()
      const active = createWorkflow(null, {
        loadable: true,
        path: 'workflows/active.json'
      })
      const closingNeighbor = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing-neighbor.json'
      })
      const survivor = createWorkflow(null, {
        loadable: true,
        path: 'workflows/survivor.json'
      })
      for (const wf of [active, closingNeighbor, survivor]) {
        Object.defineProperty(wf, 'unload', { value: vi.fn() })
      }
      workflowStore.attachWorkflow(active, 0)
      workflowStore.attachWorkflow(closingNeighbor, 1)
      workflowStore.attachWorkflow(survivor, 2)
      workflowStore.activeWorkflow = active as LoadedComfyWorkflow
      // No most-recent candidate: the decision goes straight to the
      // index-shift fallback, whose first candidate is the closing neighbor.
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(null)

      // Hold the neighbor's close INSIDE the store call: this is the window
      // where it is still in openWorkflows (the store removal has not run)
      // while the closing registry already holds it - the exact state the
      // fallback guard exists for.
      const storeCloseReleases: (() => void)[] = []
      const storeClose = vi
        .spyOn(workflowStore, 'closeWorkflow')
        .mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              storeCloseReleases.push(resolve)
            })
        )
      const closingNeighborPromise = useWorkflowService().closeWorkflow(
        closingNeighbor,
        { warnIfUnsaved: false }
      )
      await Promise.resolve()

      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow) {
            workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          }
          return true
        }
      )
      const closingActive = useWorkflowService().closeWorkflow(active, {
        warnIfUnsaved: false
      })
      // The replacement decision is a synchronous walk a few microtasks in;
      // it must run while the neighbor's held store-close keeps the closing
      // window open, so drain the microtask queue before releasing.
      for (let tick = 0; tick < 8; tick++) await Promise.resolve()
      storeClose.mockImplementation(async () => {})
      while (storeCloseReleases.length) storeCloseReleases.shift()?.()
      await Promise.all([closingNeighborPromise, closingActive])

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        expect.objectContaining({ path: survivor.path }),
        expect.anything()
      )
      expect(app.loadGraphData).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ path: closingNeighbor.path }),
        expect.anything()
      )
    })

    it('reopens a renamed path after a close that renamed the workflow mid-flight', async () => {
      const workflowStore = useWorkflowStore()
      const renamed = createWorkflow(null, {
        loadable: true,
        path: 'workflows/original.json'
      })
      Object.defineProperty(renamed, 'unload', { value: vi.fn() })
      Object.defineProperty(renamed, 'path', {
        value: 'workflows/original.json',
        writable: true
      })
      workflowStore.attachWorkflow(renamed, 0)

      // Hold the workflow's pending open so its close parks on the await,
      // giving the rename a real mid-close window.
      let releaseHeldLoad = (): void => {}
      vi.mocked(app.loadGraphData).mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            releaseHeldLoad = () => resolve(true)
          })
      )
      const heldOpen = useWorkflowService().openWorkflow(renamed)
      const closing = useWorkflowService().closeWorkflow(renamed, {
        warnIfUnsaved: false
      })
      await Promise.resolve()
      // A rename mid-close mutates the live path; the closing registry must
      // not key on it, or the ORIGINAL path stays suppressed forever.
      ;(renamed as { path: string }).path = 'workflows/renamed.json'
      releaseHeldLoad()
      vi.mocked(app.loadGraphData).mockImplementation(async () => true)
      await Promise.all([heldOpen, closing])

      const reopened = createWorkflow(null, {
        loadable: true,
        path: 'workflows/original.json'
      })
      workflowStore.attachWorkflow(reopened, 0)
      vi.mocked(app.loadGraphData).mockClear()
      await useWorkflowService().openWorkflow(reopened)

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        reopened,
        expect.anything()
      )
    })

    it('skips the last-close default load when a workflow opened during the close', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const openedMidClose = createWorkflow(null, {
        loadable: true,
        path: 'workflows/opened-mid-close.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      workflowStore.attachWorkflow(closing, 0)

      // Hold the closing workflow's own pending open so the close awaits it.
      let releaseHeldLoad = (): void => {}
      vi.mocked(app.loadGraphData).mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            releaseHeldLoad = () => resolve(true)
          })
      )
      const heldOpen = useWorkflowService().openWorkflow(closing)
      const closePromise = useWorkflowService().closeWorkflow(closing, {
        warnIfUnsaved: false
      })
      await Promise.resolve()

      // Another workflow arrives while the close is awaiting - the stale
      // "was last open" answer must not fire a default-workflow load.
      workflowStore.attachWorkflow(openedMidClose, 1)
      vi.mocked(app.loadGraphData).mockImplementation(async () => true)
      releaseHeldLoad()
      await Promise.all([heldOpen, closePromise])

      expect(app.loadGraphData).not.toHaveBeenCalledWith(defaultGraph)
      expect(workflowStore.openWorkflows.map((wf) => wf.path)).toContain(
        openedMidClose.path
      )
    })

    it('does not reopen a workflow while a duplicate close remains active', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replacement.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      let resolveReplacement: (() => void) | undefined
      let defaultLoadCount = 0

      workflowStore.attachWorkflow(closing, 0)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow && typeof workflow !== 'string') {
            workflowStore.attachWorkflow(workflow, 0)
            workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
            return true
          }

          defaultLoadCount++
          if (defaultLoadCount === 1) throw new Error('replacement failed')
          await new Promise<void>((resolve) => {
            resolveReplacement = () => {
              workflowStore.attachWorkflow(replacement, 1)
              workflowStore.activeWorkflow = replacement as LoadedComfyWorkflow
              resolve()
            }
          })
          return true
        }
      )

      const service = useWorkflowService()
      const firstClose = service.closeWorkflow(closing, {
        warnIfUnsaved: false
      })
      const secondClose = service.closeWorkflow(closing, {
        warnIfUnsaved: false
      })

      await expect(firstClose).rejects.toThrow('replacement failed')
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledTimes(2))
      const staleOpen = service.openWorkflow(closing)
      resolveReplacement?.()
      await expect(staleOpen).resolves.toBe(false)
      await secondClose

      expect(app.loadGraphData).toHaveBeenCalledTimes(2)
      expect(workflowStore.openWorkflows).not.toContain(closing)
      expect(workflowStore.activeWorkflow.path).toBe(replacement.path)
    })
  })

  describe('user activations', () => {
    function activateOnLoad(): void {
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          useWorkflowStore().activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )
    }

    it.for([
      { path: 'configure', arrange: (_workflow: ComfyWorkflow) => {} },
      {
        path: 'live',
        arrange: (workflow: ComfyWorkflow) => {
          workflow.adoptGraph(app.createRootGraph())
        }
      }
    ])(
      'reports a tab only when a user action activates it through $path',
      async ({ arrange }) => {
        const workflowStore = useWorkflowStore()
        const restored = createModeTestWorkflow({
          path: 'workflows/restored.json'
        })
        const clicked = createModeTestWorkflow({
          path: 'workflows/clicked.json'
        })
        arrange(restored)
        arrange(clicked)
        activateOnLoad()
        const activated = vi.fn()
        workflowStore.onUserActivation(activated)
        const service = useWorkflowService()

        await service.openWorkflow(restored)
        await service.openWorkflow(clicked, { initiator: 'user' })

        expect(workflowStore.activeWorkflow?.path).toBe(clicked.path)
        expect(activated.mock.calls).toEqual([[clicked]])
      }
    )

    it('reports a user activation when clicking an already-active tab', async () => {
      const workflowStore = useWorkflowStore()
      const active = createWorkflow(null, {
        loadable: true,
        path: 'workflows/active.json'
      })
      const activeTracker = active.changeTracker
      assert.exists(activeTracker)
      workflowStore.activeWorkflow = active as LoadedComfyWorkflow
      bindCanvasTracker(activeTracker)
      const service = useWorkflowService()

      const activated = vi.fn()
      workflowStore.onUserActivation(activated)

      await service.openWorkflow(active, { initiator: 'user' })

      expect(app.loadGraphData).not.toHaveBeenCalled()
      expect(activated.mock.calls).toEqual([[active]])
    })

    it('does not report a user activation whose load fails', async () => {
      const workflowStore = useWorkflowStore()
      const clicked = createWorkflow(null, {
        loadable: true,
        path: 'workflows/clicked.json'
      })
      vi.mocked(app.loadGraphData).mockResolvedValueOnce(false)
      const activated = vi.fn()
      workflowStore.onUserActivation(activated)

      const failure: { reason?: OpenWorkflowFailure } = {}
      await expect(
        useWorkflowService().openWorkflow(clicked, {
          initiator: 'user',
          failure
        })
      ).resolves.toBe(false)

      expect(failure.reason).toBe('load_failed')
      expect(activated).not.toHaveBeenCalled()
    })

    function openThreeTabs(): {
      byName: (name: string) => ComfyWorkflow
      activated: ReturnType<typeof vi.fn>
    } {
      const workflowStore = useWorkflowStore()
      const names = ['first', 'second', 'third']
      const tabs = names.map((name, index) => {
        const tab = createWorkflow(null, {
          loadable: true,
          path: `workflows/${name}.json`
        })
        Object.defineProperty(tab, 'unload', { value: vi.fn() })
        workflowStore.attachWorkflow(tab, index)
        return tab
      })
      workflowStore.activeWorkflow = tabs[0] as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockImplementation(
        () =>
          workflowStore.openWorkflows.find(
            (tab) => !workflowStore.isActive(tab)
          ) ?? null
      )
      activateOnLoad()
      const activated = vi.fn()
      workflowStore.onUserActivation(activated)
      return { byName: (name) => tabs[names.indexOf(name)], activated }
    }

    it.for([
      { closed: 'the active tab', closing: ['first'], left: 'second' },
      {
        closed: 'several tabs',
        closing: ['first', 'second'],
        left: 'third'
      }
    ])(
      'reports once, for the tab left active, when a user closes $closed',
      async ({ closing, left }) => {
        const { byName, activated } = openThreeTabs()

        await useWorkflowService().closeWorkflows(closing.map(byName), {
          warnIfUnsaved: false,
          initiator: 'user'
        })

        expect(useWorkflowStore().activeWorkflow?.path).toBe(byName(left).path)
        expect(activated.mock.calls).toEqual([[byName(left)]])
      }
    )

    it('does not report a tab something else activated while a close waited', async () => {
      const { byName, activated } = openThreeTabs()
      const dirty = byName('second')
      Object.assign(dirty, { isModified: true })
      let answer!: (choice: boolean | null) => void
      vi.mocked(useDialogService().confirm).mockReturnValueOnce(
        new Promise((resolve) => (answer = resolve))
      )
      const closing = useWorkflowService().closeWorkflows([dirty], {
        warnIfUnsaved: true,
        initiator: 'user'
      })
      await vi.waitFor(() =>
        expect(useDialogService().confirm).toHaveBeenCalled()
      )

      await useWorkflowService().openWorkflow(byName('third'))
      answer(false)
      await closing

      expect(useWorkflowStore().activeWorkflow?.path).toBe(byName('third').path)
      expect(activated).not.toHaveBeenCalled()
    })

    it('does not report a replacement superseded while a later close waits', async () => {
      const { byName, activated } = openThreeTabs()
      const workflowStore = useWorkflowStore()
      const third = byName('third')
      Object.assign(third, { isModified: true })
      let answer!: (choice: boolean | null) => void
      vi.mocked(useDialogService().confirm).mockReturnValueOnce(
        new Promise((resolve) => (answer = resolve))
      )
      const service = useWorkflowService()
      const closing = service.closeWorkflows([byName('first'), third], {
        warnIfUnsaved: true,
        initiator: 'user'
      })
      await vi.waitFor(() =>
        expect(useDialogService().confirm).toHaveBeenCalled()
      )
      expect(workflowStore.activeWorkflow?.path).toBe(byName('second').path)
      expect(workflowStore.openWorkflows.map((tab) => tab.path)).toEqual([
        byName('second').path,
        third.path
      ])

      await service.openWorkflow(third)
      answer(null)
      await closing

      expect(workflowStore.activeWorkflow?.path).toBe(third.path)
      expect(activated).not.toHaveBeenCalled()
    })

    it('reports the tab an earlier close activated when a later close throws', async () => {
      const { byName, activated } = openThreeTabs()
      const failure = new Error('load failed')
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          const loading = workflow as ComfyWorkflow
          if (loading.path === byName('third').path) throw failure
          useWorkflowStore().activeWorkflow = loading as LoadedComfyWorkflow
          return true
        }
      )

      await expect(
        useWorkflowService().closeWorkflows(
          [byName('first'), byName('second')],
          { warnIfUnsaved: false, initiator: 'user' }
        )
      ).rejects.toBe(failure)

      expect(activated.mock.calls).toEqual([[byName('second')]])
    })

    it.for([
      {
        name: 'reports the default workflow left active after a user close',
        options: { warnIfUnsaved: false, initiator: 'user' as const },
        expectedPaths: ['Unsaved Workflow.json']
      },
      {
        name: 'does not report the default workflow for a non-user close',
        options: { warnIfUnsaved: false },
        expectedPaths: []
      }
    ])('$name', async ({ options, expectedPaths }) => {
      const workflowStore = useWorkflowStore()
      const only = createWorkflow(null, {
        loadable: true,
        path: 'workflows/only.json'
      })
      Object.defineProperty(only, 'unload', { value: vi.fn() })
      workflowStore.attachWorkflow(only, 0)
      workflowStore.activeWorkflow = only as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(null)
      const fallback = createWorkflow(null, {
        loadable: true,
        path: 'Unsaved Workflow.json'
      })
      vi.mocked(app.loadGraphData).mockImplementation(async (data) => {
        if (isDefaultWorkflow(data))
          useWorkflowStore().activeWorkflow = fallback as LoadedComfyWorkflow
        return true
      })
      const activated = vi.fn()
      workflowStore.onUserActivation(activated)

      await useWorkflowService().closeWorkflows([only], options)

      expect(app.loadGraphData).toHaveBeenCalledWith(
        defaultGraph,
        true,
        true,
        null,
        {}
      )
      expect(activated.mock.calls.map(([workflow]) => workflow.path)).toEqual(
        expectedPaths
      )
    })

    it.for([
      {
        name: 'reports the tab a user lands on after a direct deletion',
        silent: false,
        expectedPaths: ['workflows/second.json']
      },
      {
        name: 'does not report a tab activation for an internal deletion',
        silent: true,
        expectedPaths: []
      }
    ])('$name', async ({ silent, expectedPaths }) => {
      const { byName, activated } = openThreeTabs()
      Object.defineProperty(byName('first'), 'delete', {
        value: vi.fn(async () => {})
      })

      await expect(
        useWorkflowService().deleteWorkflow(byName('first'), silent)
      ).resolves.toBe(true)

      expect(activated.mock.calls.map(([workflow]) => workflow.path)).toEqual(
        expectedPaths
      )
    })

    it('keeps a throwing listener from failing the tab switch', async () => {
      const workflowStore = useWorkflowStore()
      const clicked = createWorkflow(null, {
        loadable: true,
        path: 'workflows/clicked.json'
      })
      activateOnLoad()
      workflowStore.onUserActivation(() => {
        throw new Error('subscriber blew up')
      })
      const settled = vi.fn()
      workflowStore.onUserActivation(settled)

      await expect(
        useWorkflowService().openWorkflow(clicked, { initiator: 'user' })
      ).resolves.toBe(true)

      expect(workflowStore.activeWorkflow?.path).toBe(clicked.path)
      expect(settled).toHaveBeenCalledWith(clicked)
    })

    describe('a blank workflow', () => {
      function newBlankTab(): LoadedComfyWorkflow {
        return createWorkflow(null, {
          loadable: true,
          path: 'Unsaved Workflow.json'
        }) as LoadedComfyWorkflow
      }

      it.for([
        {
          name: 'reports the new tab when a user creates it',
          options: { initiator: 'user' as const },
          expectedPaths: ['Unsaved Workflow.json']
        },
        {
          name: 'does not report a blank tab loaded programmatically',
          options: {},
          expectedPaths: [] as string[]
        }
      ])('$name', async ({ options, expectedPaths }) => {
        const workflowStore = useWorkflowStore()
        const blank = newBlankTab()
        vi.mocked(app.loadGraphData).mockImplementation(async () => {
          workflowStore.activeWorkflow = blank
          return blank
        })
        const activated = vi.fn()
        workflowStore.onUserActivation(activated)

        await useWorkflowService().loadBlankWorkflow(options)

        expect(app.loadGraphData).toHaveBeenCalledWith(blankGraph)
        expect(activated.mock.calls.map(([workflow]) => workflow.path)).toEqual(
          expectedPaths
        )
      })

      it.for([
        { name: 'fails', loaded: false },
        { name: 'is superseded by a later load', loaded: undefined }
      ])(
        'does not report a user-created tab whose load $name',
        async ({ loaded }) => {
          const workflowStore = useWorkflowStore()
          vi.mocked(app.loadGraphData).mockResolvedValue(loaded)
          const activated = vi.fn()
          workflowStore.onUserActivation(activated)

          await useWorkflowService().loadBlankWorkflow({ initiator: 'user' })

          expect(activated).not.toHaveBeenCalled()
        }
      )

      it('does not report a new tab the user has already left', async () => {
        const workflowStore = useWorkflowStore()
        const blank = newBlankTab()
        const other = createWorkflow(null, {
          loadable: true,
          path: 'workflows/other.json'
        }) as LoadedComfyWorkflow
        vi.mocked(app.loadGraphData).mockImplementation(async () => {
          workflowStore.activeWorkflow = blank
          workflowStore.activeWorkflow = other
          return blank
        })
        const activated = vi.fn()
        workflowStore.onUserActivation(activated)

        await useWorkflowService().loadBlankWorkflow({ initiator: 'user' })

        expect(activated).not.toHaveBeenCalled()
      })
    })

    describe('loadDefaultWorkflow', () => {
      it.for([
        {
          name: 'forwards initiator user to loadGraphData',
          options: { initiator: 'user' as const }
        },
        {
          name: 'omits initiator when loaded programmatically',
          options: {}
        }
      ])('$name', async ({ options }) => {
        await useWorkflowService().loadDefaultWorkflow(options)

        expect(app.loadGraphData).toHaveBeenCalledWith(
          defaultGraph,
          true,
          true,
          null,
          options
        )
      })
    })
  })

  describe('openWorkflow deferred warnings', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>

    beforeEach(() => {
      enableWarningSettings()
      workflowStore = useWorkflowStore()
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, wf) => {
          workflowStore.activeWorkflow = wf as LoadedComfyWorkflow
          return true
        }
      )
    })

    it('should defer warnings during load and show on focus', async () => {
      const workflow = createWorkflow(
        { missingNodeTypes: ['CustomNode1'] },
        { loadable: true }
      )

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).not.toHaveBeenCalled()

      await useWorkflowService().openWorkflow(workflow)

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        workflow,
        expect.objectContaining({ deferWarnings: true })
      )
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith(['CustomNode1'])
      expect(workflow.pendingWarnings).not.toBeNull()
    })

    it('tells the missing nodes notice that an opened workflow was reopened', async () => {
      const workflow = createWorkflow(
        { missingNodeTypes: ['CustomNode1'] },
        { loadable: true }
      )

      vi.mocked(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).mockReturnValue(true)

      await useWorkflowService().openWorkflow(workflow, { force: true })

      expect(showMissingNodesNotice).toHaveBeenCalledWith(
        ['CustomNode1'],
        'reopened'
      )
    })

    it('tells the missing nodes notice a workflow was brought in when the caller says so', async () => {
      const workflow = createWorkflow(
        { missingNodeTypes: ['CustomNode1'] },
        { loadable: true }
      )

      vi.mocked(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).mockReturnValue(true)

      await useWorkflowService().openWorkflow(workflow, {
        force: true,
        opening: 'brought_in'
      })

      expect(showMissingNodesNotice).toHaveBeenCalledWith(
        ['CustomNode1'],
        'brought_in'
      )
    })

    it('keeps a brought in workflow brought in when it is opened again without saying how', async () => {
      const workflow = createWorkflow(
        { missingNodeTypes: ['CustomNode1'] },
        { loadable: true }
      )
      vi.mocked(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).mockReturnValue(true)
      const service = useWorkflowService()

      await service.openWorkflow(workflow, {
        force: true,
        opening: 'brought_in'
      })
      await service.openWorkflow(workflow, { force: true })

      expect(showMissingNodesNotice).toHaveBeenLastCalledWith(
        ['CustomNode1'],
        'brought_in'
      )
    })

    it('remembers the opening of a silent activation for a later notice', () => {
      const workflow = createWorkflow({ missingNodeTypes: ['CustomNode1'] })
      vi.mocked(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).mockReturnValue(true)
      const service = useWorkflowService()

      service.showPendingWarnings(workflow, {
        silent: true,
        defaultOpening: 'reopened'
      })
      service.showPendingWarnings(workflow)

      expect(showMissingNodesNotice).toHaveBeenCalledExactlyOnceWith(
        ['CustomNode1'],
        'reopened'
      )
    })

    it('does not remember the fallback when no caller says how it was opened', () => {
      const workflow = createWorkflow({ missingNodeTypes: ['CustomNode1'] })
      vi.mocked(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).mockReturnValue(true)
      const service = useWorkflowService()

      service.showPendingWarnings(workflow, { silent: true })
      service.showPendingWarnings(workflow, { defaultOpening: 'reopened' })

      expect(showMissingNodesNotice).toHaveBeenCalledExactlyOnceWith(
        ['CustomNode1'],
        'reopened'
      )
    })

    it('keeps a dropped workflow brought in when late node packs reload it', async () => {
      const workflow = createWorkflow(
        { missingNodeTypes: ['CustomNode1'] },
        { loadable: true }
      )
      workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
      vi.mocked(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).mockReturnValue(true)
      const service = useWorkflowService()

      vi.mocked(nodeTypesMayStillArrive).mockReturnValue(true)
      service.showPendingWarnings(undefined, { opening: 'brought_in' })
      vi.mocked(nodeTypesMayStillArrive).mockReturnValue(false)
      await service.openWorkflow(workflow, { force: true })

      expect(showMissingNodesNotice).toHaveBeenCalledExactlyOnceWith(
        ['CustomNode1'],
        'brought_in'
      )
    })

    it('keeps a reopened workflow reopened when its warnings surface again', async () => {
      const workflow = createWorkflow(
        { missingNodeTypes: ['CustomNode1'] },
        { loadable: true }
      )
      vi.mocked(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).mockReturnValue(true)
      const service = useWorkflowService()

      await service.openWorkflow(workflow, { force: true })
      service.showPendingWarnings(workflow)

      expect(showMissingNodesNotice).toHaveBeenLastCalledWith(
        ['CustomNode1'],
        'reopened'
      )
    })

    it('should show each workflow warnings only when that tab is focused', async () => {
      const workflow1 = createWorkflow(
        { missingNodeTypes: ['MissingNodeA'] },
        { loadable: true, path: 'workflows/first.json' }
      )
      const workflow2 = createWorkflow(
        { missingNodeTypes: ['MissingNodeB'] },
        { loadable: true, path: 'workflows/second.json' }
      )

      const service = useWorkflowService()

      await service.openWorkflow(workflow1)
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledTimes(1)
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith(['MissingNodeA'])
      expect(workflow1.pendingWarnings).not.toBeNull()
      expect(workflow2.pendingWarnings).not.toBeNull()

      await service.openWorkflow(workflow2)
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledTimes(2)
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenLastCalledWith(['MissingNodeB'])
      expect(workflow2.pendingWarnings).not.toBeNull()
    })

    it('should restore cached warnings silently when refocusing a tab', async () => {
      const workflow = createWorkflow(
        { missingNodeTypes: ['CustomNode1'] },
        { loadable: true }
      )

      const service = useWorkflowService()

      await service.openWorkflow(workflow, { force: true })
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledTimes(1)

      await service.openWorkflow(workflow, { force: true })
      // Cached warnings are restored on refocus
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledTimes(2)
    })
  })

  describe('openWorkflow when the stored file cannot be fetched', () => {
    it('reports the failed read without the file name', async () => {
      const workflow = new ComfyWorkflowClass({
        path: 'workflows/Customer Jane Doe.json',
        modified: Date.now(),
        size: 4
      })
      vi.spyOn(api, 'getUserData').mockResolvedValue(
        new Response(null, {
          status: 500,
          statusText: 'Internal Server Error'
        })
      )

      await expect(useWorkflowService().openWorkflow(workflow)).rejects.toThrow(
        '500 Internal Server Error'
      )

      expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), {
        surface: 'graph',
        errorType: 'workflow_load_failure'
      })
      const delivered = reportErrorMock.mock.calls.flatMap(([error]) => [
        String(error?.message),
        String(error?.cause),
        JSON.stringify(error?.cause ?? null),
        JSON.stringify(error)
      ])
      expect(delivered).not.toContainEqual(
        expect.stringContaining('Customer Jane Doe')
      )
      expect(app.loadGraphData).not.toHaveBeenCalled()
    })
  })

  describe('openWorkflow with unreadable stored content', () => {
    function unreadableWorkflow(
      path = 'workflows/video_REDO.json',
      reason: UnreadableWorkflowError['reason'] = 'not-object'
    ) {
      const workflow = new ComfyWorkflowClass({
        path,
        modified: Date.now(),
        size: 4
      })
      vi.spyOn(workflow, 'load').mockRejectedValue(
        new UnreadableWorkflowError(reason, workflow.path)
      )
      return workflow
    }

    const shownToast = () => {
      const call = vi.mocked(useToast().error).mock.calls.at(-1)
      expect(call).toBeDefined()
      return { title: call![0], options: call![1] ?? {} }
    }

    it('tells the user instead of rejecting, and leaves the canvas alone', async () => {
      const workflow = unreadableWorkflow()

      const failure: { reason?: OpenWorkflowFailure } = {}
      const opened = await useWorkflowService().openWorkflow(workflow, {
        initiator: 'user',
        failure
      })

      expect(opened).toBe(false)
      expect(failure.reason).toBe('unreadable')
      expect(app.loadGraphData).not.toHaveBeenCalled()
      expect(
        useSubgraphNavigationStore().endWorkflowNavigation
      ).toHaveBeenCalled()
      const { title, options } = shownToast()
      expect(title).toBe(t('workflowService.unreadableWorkflowTitle'))
      expect(options.description).toBe(
        t('workflowService.unreadableWorkflowMessage', {
          name: 'video_REDO.json'
        })
      )
    })

    it.for(['empty', 'unparseable', 'not-object'] as const)(
      'tells the user when the stored file is %s',
      async (reason) => {
        const workflow = unreadableWorkflow('workflows/video_REDO.json', reason)

        const opened = await useWorkflowService().openWorkflow(workflow)

        expect(opened).toBe(false)
        expect(app.loadGraphData).not.toHaveBeenCalled()
        expect(shownToast().title).toBe(
          t('workflowService.unreadableWorkflowTitle')
        )
      }
    )

    it('offers to delete the unreadable file', async () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string) => key !== 'Comfy.Workflow.ConfirmDelete'
      )
      const workflowStore = useWorkflowStore()
      const deleteSpy = vi
        .spyOn(workflowStore, 'deleteWorkflow')
        .mockResolvedValue(true)
      const workflow = unreadableWorkflow()
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(workflow)

      await useWorkflowService().openWorkflow(workflow)
      const { options } = shownToast()
      const action = options.action
      expect(action?.label).toBe(t('g.delete'))
      await action!.onClick()

      expect(deleteSpy).toHaveBeenCalledWith(workflow)
      expect(useToast().dismiss).toHaveBeenCalledWith(options.id)
    })

    it('does not delete a different file that now has the same path', async () => {
      const workflowStore = useWorkflowStore()
      const deleteSpy = vi
        .spyOn(workflowStore, 'deleteWorkflow')
        .mockResolvedValue(true)
      const workflow = unreadableWorkflow('workflows/reused.json')
      await useWorkflowService().openWorkflow(workflow)
      const { options } = shownToast()
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(
        new ComfyWorkflowClass({
          path: 'workflows/reused.json',
          modified: Date.now(),
          size: 100
        })
      )

      await options.action!.onClick()

      expect(deleteSpy).not.toHaveBeenCalled()
      expect(useToast().dismiss).toHaveBeenCalledWith(options.id)
    })

    it('does not delete a file that replaced it while the confirmation was open', async () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string) => key === 'Comfy.Workflow.ConfirmDelete'
      )
      const workflowStore = useWorkflowStore()
      const deleteSpy = vi
        .spyOn(workflowStore, 'deleteWorkflow')
        .mockResolvedValue(true)
      const workflow = unreadableWorkflow('workflows/raced.json')
      const lookup = vi
        .spyOn(workflowStore, 'getWorkflowByPath')
        .mockReturnValue(workflow)
      let confirm!: (value: boolean) => void
      vi.mocked(useDialogService().confirm).mockReturnValue(
        new Promise<boolean | null>((resolve) => (confirm = resolve))
      )
      await useWorkflowService().openWorkflow(workflow)
      const { options } = shownToast()

      const clicked = options.action!.onClick()
      await vi.waitFor(() =>
        expect(useDialogService().confirm).toHaveBeenCalled()
      )
      lookup.mockReturnValue(
        new ComfyWorkflowClass({
          path: 'workflows/raced.json',
          modified: Date.now(),
          size: 100
        })
      )
      confirm(true)
      await clicked

      expect(deleteSpy).not.toHaveBeenCalled()
      expect(useToast().dismiss).toHaveBeenCalledWith(options.id)
    })

    it('dismisses the toast and disarms Delete once the same file opens', async () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string) => key !== 'Comfy.Workflow.ConfirmDelete'
      )
      const workflowStore = useWorkflowStore()
      const deleteSpy = vi
        .spyOn(workflowStore, 'deleteWorkflow')
        .mockResolvedValue(true)
      const workflow = unreadableWorkflow('workflows/repaired.json')
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(workflow)
      const service = useWorkflowService()
      await service.openWorkflow(workflow)
      const { options } = shownToast()
      vi.mocked(workflow.load).mockResolvedValue(
        workflow as ComfyWorkflow & LoadedComfyWorkflow
      )

      expect(await service.openWorkflow(workflow, { force: true })).toBe(true)
      expect(useToast().dismiss).toHaveBeenCalledWith(options.id)

      await options.action!.onClick()
      expect(deleteSpy).not.toHaveBeenCalled()
    })

    it('forgets the unreadable mark once the file opens', async () => {
      const workflow = unreadableWorkflow('workflows/fixed.json')
      const service = useWorkflowService()
      await service.openWorkflow(workflow)
      expect(isUnreadableWorkflow(workflow)).toBe(true)
      vi.mocked(workflow.load).mockRejectedValue(new Error('offline'))

      await expect(service.openWorkflow(workflow)).rejects.toThrow('offline')

      expect(isUnreadableWorkflow(workflow)).toBe(false)
    })

    it('dismisses the toast when a retry fails for another reason', async () => {
      const workflowStore = useWorkflowStore()
      const deleteSpy = vi
        .spyOn(workflowStore, 'deleteWorkflow')
        .mockResolvedValue(true)
      const workflow = unreadableWorkflow('workflows/flaky.json')
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(workflow)
      const service = useWorkflowService()
      await service.openWorkflow(workflow)
      const { options } = shownToast()
      vi.mocked(workflow.load).mockRejectedValue(new Error('offline'))

      await expect(service.openWorkflow(workflow)).rejects.toThrow('offline')

      expect(useToast().dismiss).toHaveBeenCalledWith(options.id)
      await options.action!.onClick()
      expect(deleteSpy).not.toHaveBeenCalled()
    })

    it('shows one toast per file however often it is clicked', async () => {
      const workflow = unreadableWorkflow('workflows/twice.json')
      const service = useWorkflowService()

      await service.openWorkflow(workflow)
      const first = shownToast().options.id
      await service.openWorkflow(workflow)

      expect(first).toBeDefined()
      expect(shownToast().options.id).toBe(first)
      expect(
        useToast().toasts.filter((toast) => toast.id === first)
      ).toHaveLength(1)
    })

    it('does not toast for an open the caller already moved away from', async () => {
      const workflow = unreadableWorkflow()

      const opened = await useWorkflowService().openWorkflow(workflow, {
        isCurrent: vi
          .fn()
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(true)
          .mockReturnValue(false)
      })

      expect(opened).toBe(false)
      expect(useToast().error).not.toHaveBeenCalled()
    })

    it('loads a same-name graph as a new workflow instead of rejecting', async () => {
      const workflowStore = useWorkflowStore()
      const stored = new ComfyWorkflowClass({
        path: 'workflows/video_REDO.json',
        modified: Date.now(),
        size: 4
      })
      const temporary = createModeTestWorkflow({
        path: 'workflows/video_REDO (2).json'
      })
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(stored)
      vi.spyOn(workflowStore, 'createNewTemporary').mockReturnValue(temporary)
      vi.spyOn(workflowStore, 'openWorkflow').mockImplementation(async (wf) => {
        if (wf === stored)
          throw new UnreadableWorkflowError('not-object', stored.path)
        return wf as LoadedComfyWorkflow
      })

      await useWorkflowService().afterLoadNewGraph(
        'video_REDO',
        makeWorkflowData(),
        app.rootGraph
      )

      expect(workflowStore.createNewTemporary).toHaveBeenCalledWith(
        'video_REDO.json',
        expect.anything()
      )
      expect(workflowStore.openWorkflow).toHaveBeenLastCalledWith(temporary)
      expect(isUnreadableWorkflow(stored)).toBe(true)
      expect(shownToast().title).toBe(
        t('workflowService.unreadableWorkflowTitle')
      )
    })

    it('closes the active tab with the default graph when the next tab is unreadable', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createModeTestWorkflow({ path: 'workflows/open.json' })
      const replacement = unreadableWorkflow()
      vi.spyOn(workflowStore, 'isActive').mockImplementation(
        (wf) => wf === closing
      )
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(
        replacement
      )
      const closeSpy = vi
        .spyOn(workflowStore, 'closeWorkflow')
        .mockResolvedValue()

      const closed = await useWorkflowService().closeWorkflow(closing, {
        warnIfUnsaved: false
      })

      expect(closed).toBe(true)
      expect(app.loadGraphData).toHaveBeenCalled()
      expect(closeSpy).toHaveBeenCalledWith(closing)
    })

    it('still rejects for other load failures', async () => {
      const workflow = new ComfyWorkflowClass({
        path: 'workflows/a.json',
        modified: Date.now(),
        size: 4
      })
      vi.spyOn(workflow, 'load').mockRejectedValue(new Error('offline'))

      await expect(useWorkflowService().openWorkflow(workflow)).rejects.toThrow(
        'offline'
      )
      expect(useToast().error).not.toHaveBeenCalled()
    })
  })

  describe('insertWorkflow', () => {
    function useInsertionCanvas(graph: LGraph) {
      const canvas = createTestCanvas(
        graph,
        createMockCanvasRenderingContext2D()
      )
      onTestFinished(() => canvas.unbindEvents())
      return canvas
    }

    function insertionWorkflow(): LoadedComfyWorkflow {
      const source = new LGraph()
      const node = createTestNode(source, [], [], 'Inserted')
      node.pos = [30, 50]
      const workflow = createModeTestWorkflow()
      workflow.changeTracker = createMockChangeTracker({
        initialState: zComfyWorkflow.parse({
          ...makeWorkflowData(),
          nodes: [node.serialize()]
        })
      })
      return workflow
    }

    it('inserts into the canvas with its requested position when nothing changes while loading', async () => {
      const graph = new LGraph()
      const existing = createTestNode(graph, [], [], 'Existing')
      existing.pos = [400, 500]
      app.canvas = useInsertionCanvas(graph)

      await useWorkflowService().insertWorkflow(insertionWorkflow(), {
        position: [120, 240]
      })

      expect(
        graph.nodes.map((node) => ({ title: node.title, pos: [...node.pos] }))
      ).toEqual([
        { title: 'Existing', pos: [400, 500] },
        { title: 'Inserted', pos: [120, 240] }
      ])
    })

    it('refuses workflow data outside clipboard limits without changing the graph', async () => {
      const graph = new LGraph()
      const existing = createTestNode(graph, [], [], 'Existing')
      const canvas = useInsertionCanvas(graph)
      app.canvas = canvas
      canvas.selectItems([existing])
      const workflow = insertionWorkflow()
      workflow.changeTracker = createMockChangeTracker({
        initialState: zComfyWorkflow.parse({
          ...workflow.initialState,
          nodes: workflow.initialState.nodes.map((node) => ({
            ...node,
            widgets_values: { '0': 0, length: 10_001 }
          }))
        })
      })
      const before = graph.serialize()
      const beforeChange = vi.spyOn(graph, 'beforeChange')
      reportErrorMock.mockClear()

      await expect(useWorkflowService().insertWorkflow(workflow)).resolves.toBe(
        false
      )

      expect(graph.serialize()).toEqual(before)
      expect([...canvas.selectedItems]).toEqual([existing])
      expect(beforeChange).not.toHaveBeenCalled()
      expect(reportErrorMock).toHaveBeenCalledExactlyOnceWith(
        expect.any(Error),
        {
          surface: 'graph',
          errorType: 'workflow_insert_invalid_clipboard_data'
        }
      )
    })

    it.for([
      {
        kind: 'canvas',
        replace: (
          _canvas: LGraphCanvas,
          original: LGraph,
          _replacement: LGraph
        ) => {
          app.canvas = useInsertionCanvas(original)
        }
      },
      {
        kind: 'graph',
        replace: (
          canvas: LGraphCanvas,
          _original: LGraph,
          replacement: LGraph
        ) => {
          canvas.setGraph(replacement)
        }
      }
    ])(
      'does not change either graph after $kind replacement while loading',
      async ({ kind, replace }) => {
        const original = new LGraph()
        createTestNode(original, [], [], 'Original')
        const replacement = new LGraph()
        createTestNode(replacement, [], [], 'Replacement')
        const canvas = useInsertionCanvas(original)
        app.canvas = canvas
        const workflow = insertionWorkflow()
        let finishLoad: (value: LoadedComfyWorkflow) => void = () => {}
        vi.spyOn(workflow, 'load').mockImplementation(
          () =>
            new Promise((resolve) => {
              finishLoad = resolve
            })
        )

        reportErrorMock.mockClear()
        const pending = useWorkflowService().insertWorkflow(workflow)
        replace(canvas, original, replacement)
        const beforeOriginal = original.serialize()
        const beforeReplacement = replacement.serialize()
        finishLoad(workflow)
        await pending

        expect(original.serialize()).toEqual(beforeOriginal)
        expect(replacement.serialize()).toEqual(beforeReplacement)
        expect(reportErrorMock).toHaveBeenCalledTimes(1)
        expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), {
          surface: 'graph',
          errorType: 'workflow_insert_aborted_canvas_changed',
          level: 'warning',
          tags: {
            failure_kind: 'degraded',
            feature_area: 'workflow',
            operation: 'insert',
            outcome: 'degraded',
            assert_mode: 'soft'
          },
          context: { replacement_kind: kind }
        })
      }
    )
  })

  it('keeps edits made during a deployment save unsaved and stops the handoff', async () => {
    const workflow = createModeTestWorkflow()
    workflow.changeTracker = new ChangeTracker(workflow, makeWorkflowData())
    const store = useWorkflowStore()
    store.attachWorkflow(workflow)
    store.activeWorkflow = workflow
    app.rootGraph.extra.prompt = 'being saved'
    workflow.changeTracker.activeState = zComfyWorkflow.parse(
      app.rootGraph.serialize()
    )
    workflow.isModified = true
    let finishSave = () => {}
    const write = vi.spyOn(api, 'storeUserData').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSave = () => resolve(Response.json(workflow.path))
        })
    )

    const handoff = useRunOnCloudHandoff('localhost').prepareBrief()
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce())
    app.rootGraph.extra.prompt = 'edited during save'
    workflow.changeTracker.activeState = zComfyWorkflow.parse(
      app.rootGraph.serialize()
    )
    finishSave()

    expect(await handoff).toBeNull()
    expect(workflow.originalContent).toContain('"prompt":"being saved"')
    expect(workflow.activeState.extra?.prompt).toBe('edited during save')
    expect(workflow.isModified).toBe(true)
  })

  describe('saveWorkflow', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>

    beforeEach(() => {
      workflowStore = useWorkflowStore()
    })

    it('should delegate to workflowStore.saveWorkflow for persisted workflows', async () => {
      const workflow = createModeTestWorkflow({
        path: 'workflows/persisted.json'
      })
      vi.mocked(workflowStore.saveWorkflow).mockResolvedValue()

      const result = await useWorkflowService().saveWorkflow(workflow)

      expect(result).toBe(true)
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('should return false when temporary workflow save is cancelled', async () => {
      const workflow = createModeTestWorkflow({
        path: 'workflows/Unsaved Workflow.json'
      })
      Object.defineProperty(workflow, 'isTemporary', { get: () => true })
      vi.mocked(useDialogService().prompt).mockResolvedValue(null)

      const result = await useWorkflowService().saveWorkflow(workflow)

      expect(result).toBe(false)
      expect(workflowStore.saveWorkflow).not.toHaveBeenCalled()
    })
  })

  describe('closeWorkflow', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>
    let service: ReturnType<typeof useWorkflowService>

    beforeEach(() => {
      workflowStore = useWorkflowStore()
      service = useWorkflowService()
    })

    it('keeps a temporary workflow open when Save As is cancelled', async () => {
      const workflow = createModeTestWorkflow({
        path: 'workflows/Unsaved Workflow.json'
      })
      workflow.isModified = true
      Object.defineProperty(workflow, 'isTemporary', { get: () => true })
      vi.mocked(useDialogService().prompt).mockResolvedValue(null)
      vi.mocked(useDialogService().confirm).mockResolvedValue(true)

      const closed = await service.closeWorkflow(workflow)

      expect(closed).toBe(false)
      expect(workflowStore.closeWorkflow).not.toHaveBeenCalled()
    })

    it('should release the closed workflow node previews', async () => {
      const workflow = createModeTestWorkflow({
        path: 'workflows/closing.json'
      })
      const discardPreviews = vi.spyOn(
        useNodeOutputStore(),
        'discardPreviewsForWorkflow'
      )

      await service.closeWorkflow(workflow, { warnIfUnsaved: false })

      expect(discardPreviews).toHaveBeenCalledWith(workflow.path)
    })
  })

  describe('duplicateWorkflow', () => {
    it('opens a distinct temporary workflow when duplicating repeatedly', async () => {
      const workflowStore = useWorkflowStore()
      const source = createModeTestWorkflow({
        path: 'workflows/source.json'
      })
      source.changeTracker.activeState = makeWorkflowData()
      workflowStore.createNewTemporary('source (Copy).json', makeWorkflowData())

      await useWorkflowService().duplicateWorkflow(source)

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.any(String) }),
        true,
        true,
        expect.objectContaining({ path: 'workflows/source (Copy) (2).json' }),
        {}
      )
    })

    it.for([
      {
        name: 'forwards initiator user to loadGraphData',
        options: { initiator: 'user' as const }
      },
      {
        name: 'omits initiator when duplicated programmatically',
        options: {}
      }
    ])('$name', async ({ options }) => {
      const source = createModeTestWorkflow({
        path: 'workflows/source.json'
      })
      source.changeTracker.activeState = makeWorkflowData()

      await useWorkflowService().duplicateWorkflow(source, options)

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.any(String) }),
        true,
        true,
        expect.objectContaining({ path: 'workflows/source (Copy).json' }),
        options
      )
    })
  })

  describe('null-state hardening', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>

    const reportedContexts = () =>
      mockAssert.mock.calls
        .filter(([condition]) => !condition)
        .map(([, message, context]) => ({ message, context }))

    beforeEach(() => {
      resetReportedWorkflowStateAnomaliesForTests()
      workflowStore = useWorkflowStore()
    })

    describe('beforeLoadNewGraph', () => {
      it('tolerates an active workflow with no change tracker and reports it', () => {
        enableWarningSettings()
        const activeWorkflow = createModeTestWorkflow({ loaded: false })
        workflowStore.activeWorkflow = activeWorkflow

        expect(() => useWorkflowService().beforeLoadNewGraph()).not.toThrow()

        expect(reportedContexts()).toEqual([
          {
            message:
              'Active workflow has no change tracker before loading a new graph',
            context: expect.objectContaining({
              method: 'beforeLoadNewGraph',
              isActive: true,
              isLoaded: false,
              hasChangeTracker: false
            })
          }
        ])
        expect(
          useSubgraphNavigationStore().saveCurrentViewport
        ).toHaveBeenCalled()
      })

      it('deactivates the tracker of a loaded workflow without reporting', () => {
        enableWarningSettings()
        const activeWorkflow = createModeTestWorkflow()
        workflowStore.activeWorkflow = activeWorkflow

        useWorkflowService().beforeLoadNewGraph()

        expect(activeWorkflow.changeTracker.deactivate).toHaveBeenCalledOnce()
        expect(reportedContexts()).toEqual([])
      })
    })

    describe('afterLoadNewGraph', () => {
      beforeEach(() => {
        vi.mocked(workflowStore.getWorkflowByPath).mockImplementation((path) =>
          path === 'workflows/repeat.json' ? current : null
        )
        vi.mocked(workflowStore.isActive).mockReturnValue(true)
        vi.mocked(workflowStore.openWorkflow).mockImplementation(
          async () => current
        )
      })

      let current: LoadedComfyWorkflow

      it('falls back to the fresh load mode when the initial state is missing', async () => {
        current = createModeTestWorkflow({ path: 'workflows/repeat.json' })
        current.changeTracker.initialState = fromAny<ComfyWorkflowJSON, null>(
          null
        )

        await expect(
          useWorkflowService().afterLoadNewGraph(
            'repeat',
            makeWorkflowData({ linearMode: true }),
            app.rootGraph
          )
        ).resolves.toBeUndefined()

        expect(current.initialMode).toBe('app')
        expect(current.changeTracker.reset).toHaveBeenCalled()
        expect(reportedContexts()).toEqual([
          {
            message: 'Activated workflow has no initial state',
            context: expect.objectContaining({
              method: 'activateLoadedWorkflow.initialMode',
              isActive: true,
              hasChangeTracker: true,
              hasInitialState: false
            })
          }
        ])
      })

      it('reads the saved linearMode when the initial state is present', async () => {
        current = createModeTestWorkflow({ path: 'workflows/repeat.json' })
        current.changeTracker.initialState.extra = { linearMode: false }

        await useWorkflowService().afterLoadNewGraph(
          'repeat',
          makeWorkflowData({ linearMode: true }),
          app.rootGraph
        )

        expect(current.initialMode).toBe('graph')
        expect(reportedContexts()).toEqual([])
      })

      it('skips the tracker reset instead of throwing when the workflow has no tracker', async () => {
        current = createModeTestWorkflow({
          path: 'workflows/repeat.json',
          loaded: false
        })

        await expect(
          useWorkflowService().afterLoadNewGraph(
            'repeat',
            makeWorkflowData(),
            app.rootGraph
          )
        ).resolves.toBeUndefined()

        expect(reportedContexts().map(({ context }) => context)).toEqual([
          expect.objectContaining({
            method: 'activateLoadedWorkflow.initialMode'
          }),
          expect.objectContaining({
            method: 'activateLoadedWorkflow.resetTracker',
            isActive: true,
            hasChangeTracker: false
          })
        ])
      })

      it('skips the tracker reset when opening a workflow by reference without a tracker', async () => {
        const unloaded = createModeTestWorkflow({ loaded: false })
        vi.mocked(workflowStore.openWorkflow).mockResolvedValue(unloaded)

        await expect(
          useWorkflowService().afterLoadNewGraph(
            unloaded,
            makeWorkflowData(),
            app.rootGraph
          )
        ).resolves.toBeUndefined()

        expect(reportedContexts().map(({ context }) => context)).toEqual([
          expect.objectContaining({
            method: 'activateLoadedWorkflow.resetTracker'
          })
        ])
      })
    })
  })

  describe('afterLoadNewGraph', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>
    let existingWorkflow: LoadedComfyWorkflow

    beforeEach(() => {
      workflowStore = useWorkflowStore()
      existingWorkflow = createModeTestWorkflow({
        path: 'workflows/repeat.json'
      })
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(
        existingWorkflow
      )
      vi.mocked(workflowStore.isActive).mockReturnValue(true)
      vi.mocked(workflowStore.openWorkflow).mockResolvedValue(existingWorkflow)
      vi.mocked(workflowStore.createNewTemporary).mockReturnValue(
        createModeTestWorkflow({ path: 'workflows/repeat (2).json' })
      )
    })

    it('should restore the stashed previews of the newly active workflow', async () => {
      workflowStore.activeWorkflow = existingWorkflow

      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowData(),
        app.rootGraph
      )

      expect(isCanvasOwner(existingWorkflow.changeTracker)).toBe(true)
      expect(
        useNodeOutputStore().restorePreviewsForWorkflow
      ).toHaveBeenCalledWith(existingWorkflow.path)
    })

    it('should hand the configured root graph to the activated workflow', async () => {
      workflowStore.activeWorkflow = existingWorkflow

      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowData(),
        app.rootGraph
      )

      expect(existingWorkflow.graph).toBe(app.rootGraph)
    })

    it('should reuse equivalent UUIDs regardless of casing', async () => {
      const workflowId = '9cea40bb-b0cf-4b40-a758-8935cfe8d52f'
      existingWorkflow.changeTracker.activeState.id = workflowId

      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowDataWithId(workflowId.toUpperCase()),
        app.rootGraph
      )

      expect(workflowStore.getWorkflowByPath).toHaveBeenCalledWith(
        'workflows/repeat.json'
      )
      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalled()
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it('should reuse active workflow for repeated same-path loads without ids', async () => {
      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowData(),
        app.rootGraph
      )

      expect(workflowStore.getWorkflowByPath).toHaveBeenCalledWith(
        'workflows/repeat.json'
      )
      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalled()
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it('should reuse active workflow when only one side has an id', async () => {
      existingWorkflow.changeTracker.activeState.id =
        '9cea40bb-b0cf-4b40-a758-8935cfe8d52f'

      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowData(),
        app.rootGraph
      )

      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalled()
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it('should reuse active workflow when only workflowData has an id', async () => {
      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowDataWithId('9cea40bb-b0cf-4b40-a758-8935cfe8d52f'),
        app.rootGraph
      )

      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalled()
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it('should create new temporary when ids differ', async () => {
      existingWorkflow.changeTracker.activeState.id =
        '9cea40bb-b0cf-4b40-a758-8935cfe8d52f'

      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowDataWithId('11111111-2222-3333-4444-555555555555'),
        app.rootGraph
      )

      expect(workflowStore.createNewTemporary).toHaveBeenCalled()
    })

    it('stores share attribution on shared temporary workflows', async () => {
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(null)
      const tempWorkflow = createModeTestWorkflow({
        path: 'workflows/shared.json'
      })
      vi.mocked(workflowStore.createNewTemporary).mockReturnValue(tempWorkflow)
      vi.mocked(workflowStore.openWorkflow).mockResolvedValue(tempWorkflow)

      await useWorkflowService().afterLoadNewGraph(
        'shared',
        makeWorkflowData(),
        app.rootGraph,
        'share-1'
      )

      expect(tempWorkflow.shareId).toBe('share-1')
    })

    describe('a saved workflow opened with an unsaved draft', () => {
      function restoreDraft() {
        const saved = makeWorkflowData({ saved: true })
        const draft = makeWorkflowData({ saved: true, draftEdit: true })
        existingWorkflow.changeTracker = new ChangeTracker(
          existingWorkflow,
          saved
        )
        existingWorkflow.changeTracker.activeState = draft
        existingWorkflow.isModified = true
        return { saved, draft }
      }

      it('keeps the saved file as the baseline when opened as a tab', async () => {
        const { saved, draft } = restoreDraft()

        await useWorkflowService().afterLoadNewGraph(
          existingWorkflow,
          draft,
          app.rootGraph
        )

        expect(existingWorkflow.changeTracker.initialState).toBe(saved)
        expect(existingWorkflow.isModified).toBe(true)
      })

      it('keeps the saved file as the baseline when restored by path', async () => {
        const { saved, draft } = restoreDraft()

        await useWorkflowService().afterLoadNewGraph(
          'repeat',
          draft,
          app.rootGraph
        )

        expect(existingWorkflow.changeTracker.initialState).toBe(saved)
        expect(existingWorkflow.isModified).toBe(true)
      })

      it('marks a draft that matches the saved file as saved', async () => {
        const { saved } = restoreDraft()

        await useWorkflowService().afterLoadNewGraph(
          existingWorkflow,
          structuredClone(saved),
          app.rootGraph
        )

        expect(existingWorkflow.changeTracker.initialState).toBe(saved)
        expect(existingWorkflow.isModified).toBe(false)
      })

      it('uses the loaded graph as the baseline when the saved file has no node list', async () => {
        const { draft } = restoreDraft()
        const apiFormat = { '1': { class_type: 'KSampler', inputs: {} } }
        existingWorkflow.changeTracker.initialState =
          apiFormat as unknown as ComfyWorkflowJSON

        await expect(
          useWorkflowService().afterLoadNewGraph(
            existingWorkflow,
            draft,
            app.rootGraph
          )
        ).resolves.not.toThrow()

        expect(existingWorkflow.changeTracker.initialState).toEqual({
          ...draft,
          id: expect.any(String)
        })
      })

      it('keeps the saved file as the baseline when restoring the canvas throws', async () => {
        const { saved, draft } = restoreDraft()
        vi.spyOn(existingWorkflow.changeTracker, 'restore').mockImplementation(
          () => {
            throw new Error('setGraph failed')
          }
        )

        await expect(
          useWorkflowService().afterLoadNewGraph(
            existingWorkflow,
            draft,
            app.rootGraph
          )
        ).rejects.toThrow('setGraph failed')

        expect(existingWorkflow.changeTracker.initialState).toBe(saved)
      })
    })

    /**
     * SEN-5 / CLOUD-FRONTEND-PROD-1MB: `LoadedComfyWorkflow` declares
     * `activeState: ComfyWorkflowJSON`, but it is produced by an unchecked
     * `this as this & LoadedComfyWorkflow` cast over a getter that still
     * returns `this.changeTracker?.activeState ?? null`. When the tracker has
     * no active state the cast is a lie and activation threw
     * `TypeError: Cannot read properties of null (reading 'id')`.
     * The tracker itself is present in these cases — a missing tracker would
     * throw reading `reset`, not `id`.
     *
     * Both call sites are covered: the workflow-object branch and the
     * same-path reuse branch, which make the identical read. A null active
     * state does NOT route the same-path load away from reuse —
     * `areWorkflowIdsEquivalent(undefined, ...)` falls through to
     * `!existingId || !incomingId`, which is true whenever `existingId` is
     * undefined, so reuse is chosen and the read is reached.
     */
    describe('when the change tracker has no active state (SEN-5)', () => {
      beforeEach(() => {
        // Runtime fixture, not a compiler-error assertion: reproduce the state
        // the LoadedComfyWorkflow cast claims is impossible.
        const tracker = existingWorkflow.changeTracker as unknown as {
          activeState: ComfyWorkflowJSON | null
        }
        tracker.activeState = null
      })

      it('activates a same-path reload instead of throwing on a null active state', async () => {
        // Drives the reuse branch's read, which the object-branch cases below
        // do not reach. Both sites must be fixed for this to pass.
        await useWorkflowService().afterLoadNewGraph(
          'repeat',
          makeWorkflowData(),
          app.rootGraph
        )

        expect(existingWorkflow.changeTracker.reset).toHaveBeenCalledWith(
          expect.objectContaining({ id: expect.any(String) })
        )
      })

      it('activates a workflow object reload instead of throwing on a null active state', async () => {
        // A plain await is the assertion: before the fix this rejected with
        // `TypeError: Cannot read properties of null (reading 'id')`.
        await useWorkflowService().afterLoadNewGraph(
          existingWorkflow,
          makeWorkflowData(),
          app.rootGraph
        )

        expect(existingWorkflow.changeTracker.reset).toHaveBeenCalledWith(
          expect.objectContaining({ id: expect.any(String) })
        )
      })

      it('still prefers the incoming workflow id over the missing fallback', async () => {
        // The object branch reaches the same read without depending on the
        // reuse heuristics above.
        const incomingId = '9cea40bb-b0cf-4b40-a758-8935cfe8d52f'

        await useWorkflowService().afterLoadNewGraph(
          existingWorkflow,
          makeWorkflowDataWithId(incomingId),
          app.rootGraph
        )

        expect(existingWorkflow.changeTracker.reset).toHaveBeenCalledWith(
          expect.objectContaining({ id: incomingId })
        )
      })
    })

    it('preserves share attribution on repeated same-path loads', async () => {
      existingWorkflow.shareId = 'share-1'

      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowData(),
        app.rootGraph
      )

      expect(existingWorkflow.shareId).toBe('share-1')
    })

    it('preserves share attribution on workflow object reloads', async () => {
      existingWorkflow.shareId = 'share-1'

      await useWorkflowService().afterLoadNewGraph(
        existingWorkflow,
        makeWorkflowData(),
        app.rootGraph
      )

      expect(existingWorkflow.shareId).toBe('share-1')
    })

    it('overwrites share attribution on repeated same-path loads with a new share id', async () => {
      existingWorkflow.shareId = 'share-1'

      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowData(),
        app.rootGraph,
        'share-2'
      )

      expect(existingWorkflow.shareId).toBe('share-2')
    })

    it('overwrites share attribution on workflow object reloads with a new share id', async () => {
      existingWorkflow.shareId = 'share-1'

      await useWorkflowService().afterLoadNewGraph(
        existingWorkflow,
        makeWorkflowData(),
        app.rootGraph,
        'share-2'
      )

      expect(existingWorkflow.shareId).toBe('share-2')
    })

    it('reuses a migrated workflow only for its original legacy id', async () => {
      const existingUuid = '9cea40bb-b0cf-4b40-a758-8935cfe8d52f'
      existingWorkflow.changeTracker.activeState.id = existingUuid
      existingWorkflow.legacyId = 'video-point-prompt-example'

      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowDataWithId('video-point-prompt-example'),
        app.rootGraph
      )

      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalledWith(
        expect.objectContaining({ id: existingUuid })
      )
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it.for([
      {
        label: 'a different legacy id',
        existingId: 'legacy-workflow-name',
        incomingId: 'different-legacy-name'
      },
      {
        label: 'an unrelated legacy id after migration',
        existingId: '9cea40bb-b0cf-4b40-a758-8935cfe8d52f',
        incomingId: 'different-legacy-name',
        legacyId: 'legacy-workflow-name'
      }
    ])(
      'opens a new tab for $label',
      async ({ existingId, incomingId, legacyId }) => {
        existingWorkflow.changeTracker.activeState.id = existingId
        existingWorkflow.legacyId = legacyId

        await useWorkflowService().afterLoadNewGraph(
          'repeat',
          makeWorkflowDataWithId(incomingId),
          app.rootGraph
        )

        expect(workflowStore.createNewTemporary).toHaveBeenCalled()
        expect(existingWorkflow.changeTracker.reset).not.toHaveBeenCalled()
      }
    )

    it('migrates a workflow-object reload and records its legacy id', async () => {
      const existingUuid = '9cea40bb-b0cf-4b40-a758-8935cfe8d52f'
      existingWorkflow.changeTracker.activeState.id = existingUuid

      await useWorkflowService().afterLoadNewGraph(
        existingWorkflow,
        makeWorkflowDataWithId('video-point-prompt-example'),
        app.rootGraph
      )

      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalledWith(
        expect.objectContaining({ id: existingUuid })
      )
      expect(existingWorkflow.legacyId).toBe('video-point-prompt-example')
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
    })

    it('generates a fresh UUID when a workflow-object reload has no valid id', async () => {
      existingWorkflow.changeTracker = new ChangeTracker(
        existingWorkflow,
        makeWorkflowDataWithId('legacy-workflow-name')
      )

      await useWorkflowService().afterLoadNewGraph(
        existingWorkflow,
        makeWorkflowDataWithId('different-legacy-name'),
        app.rootGraph
      )

      expect(isValidUuid(existingWorkflow.activeState.id)).toBe(true)
      expect(existingWorkflow.legacyId).toBe('different-legacy-name')
    })

    describe('root graph id adoption', () => {
      const rootGraphId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      const incomingId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

      afterEach(() => {
        Reflect.deleteProperty(app.rootGraph, 'id')
      })

      it('mints a root graph id for a zero-id graph and writes it into the workflow data', async () => {
        app.rootGraph.id = zeroUuid
        const workflowData = makeWorkflowDataWithId(zeroUuid)

        await useWorkflowService().afterLoadNewGraph(
          'repeat',
          workflowData,
          app.rootGraph
        )

        expect(app.rootGraph.id).not.toBe(zeroUuid)
        expect(isValidUuid(app.rootGraph.id)).toBe(true)
        expect(workflowData.id).toBe(app.rootGraph.id)
        expect(useExecutionErrorStore().setActiveGraph).toHaveBeenCalledWith(
          app.rootGraph.id,
          existingWorkflow.path
        )
      })

      it('leaves the incoming workflow id alone when the root graph already has one', async () => {
        app.rootGraph.id = rootGraphId
        const workflowData = makeWorkflowDataWithId(incomingId)

        await useWorkflowService().afterLoadNewGraph(
          'repeat',
          workflowData,
          app.rootGraph
        )

        expect(workflowData.id).toBe(incomingId)
        expect(app.rootGraph.id).toBe(rootGraphId)
        expect(useExecutionErrorStore().setActiveGraph).toHaveBeenCalledWith(
          rootGraphId,
          existingWorkflow.path
        )
      })
    })
  })

  describe('per-workflow mode switching', () => {
    let appMode: ReturnType<typeof useAppMode>
    let workflowStore: ReturnType<typeof useWorkflowStore>
    let service: ReturnType<typeof useWorkflowService>

    function mockOpenWorkflow() {
      vi.spyOn(workflowStore, 'openWorkflow').mockImplementation(async (wf) => {
        // Simulate load() setting changeTracker on first open
        if (!wf.changeTracker) {
          wf.changeTracker = createMockChangeTracker()
          wf.content = '{}'
          wf.originalContent = '{}'
        }
        const loaded = wf as LoadedComfyWorkflow
        workflowStore.activeWorkflow = loaded
        return loaded
      })
    }

    beforeEach(() => {
      appMode = useAppMode()
      workflowStore = useWorkflowStore()
      service = useWorkflowService()
    })

    describe('mode derivation from active workflow', () => {
      it('reflects initialMode of the active workflow', () => {
        const workflow = createModeTestWorkflow({ initialMode: 'app' })
        workflowStore.activeWorkflow = workflow

        expect(appMode.mode.value).toBe('app')
      })

      it('activeMode takes precedence over initialMode', () => {
        const workflow = createModeTestWorkflow({
          initialMode: 'app',
          activeMode: 'graph'
        })
        workflowStore.activeWorkflow = workflow

        expect(appMode.mode.value).toBe('graph')
      })

      it('defaults to graph when no active workflow', () => {
        expect(appMode.mode.value).toBe('graph')
      })

      it('updates when activeWorkflow changes', () => {
        const workflow1 = createModeTestWorkflow({
          path: 'workflows/one.json',
          initialMode: 'app'
        })
        const workflow2 = createModeTestWorkflow({
          path: 'workflows/two.json',
          activeMode: 'builder:inputs'
        })

        workflowStore.activeWorkflow = workflow1
        expect(appMode.mode.value).toBe('app')

        workflowStore.activeWorkflow = workflow2
        expect(appMode.mode.value).toBe('builder:inputs')
      })
    })

    describe('setMode writes to active workflow', () => {
      it('writes activeMode without changing initialMode', () => {
        const workflow = createModeTestWorkflow({ initialMode: 'graph' })
        workflowStore.activeWorkflow = workflow

        appMode.setMode('builder:arrange')

        expect(workflow.activeMode).toBe('builder:arrange')
        expect(workflow.initialMode).toBe('graph')
        expect(appMode.mode.value).toBe('builder:arrange')
      })

      it('sets activeMode even when initialMode already matches', () => {
        const workflow = createModeTestWorkflow({
          initialMode: 'app',
          activeMode: null
        })
        workflowStore.activeWorkflow = workflow

        // mode.value is 'app' via initialMode fallback, but activeMode
        // must still be set so the UI transitions to app view
        appMode.setMode('app')

        expect(workflow.activeMode).toBe('app')
      })
    })

    describe('afterLoadNewGraph initializes initialMode', () => {
      beforeEach(() => {
        mockOpenWorkflow()
      })

      it('sets initialMode from extra.linearMode on first load', async () => {
        const workflow = createModeTestWorkflow({ loaded: false })

        await service.afterLoadNewGraph(
          workflow,
          makeWorkflowData({ linearMode: true }),
          app.rootGraph
        )

        expect(workflow.initialMode).toBe('app')
      })

      it('leaves initialMode null when extra.linearMode is absent', async () => {
        const workflow = createModeTestWorkflow({ loaded: false })

        await service.afterLoadNewGraph(
          workflow,
          makeWorkflowData(),
          app.rootGraph
        )

        expect(workflow.initialMode).toBeNull()
      })

      it('sets initialMode to graph when extra.linearMode is false', async () => {
        const workflow = createModeTestWorkflow({ loaded: false })

        await service.afterLoadNewGraph(
          workflow,
          makeWorkflowData({ linearMode: false }),
          app.rootGraph
        )

        expect(workflow.initialMode).toBe('graph')
      })

      it('does not set initialMode on tab switch even if data has linearMode', async () => {
        const workflow = createModeTestWorkflow({ loaded: false })

        // First load — no linearMode in data
        await service.afterLoadNewGraph(
          workflow,
          makeWorkflowData(),
          app.rootGraph
        )
        expect(workflow.initialMode).toBeNull()

        // User switches to app mode at runtime
        workflow.activeMode = 'app'

        // Tab switch / reload — data now has linearMode (leaked from graph)
        await service.afterLoadNewGraph(
          workflow,
          makeWorkflowData({ linearMode: true }),
          app.rootGraph
        )

        // initialMode should NOT have been updated — only builder save sets it
        expect(workflow.initialMode).toBeNull()
      })

      it('preserves existing initialMode on tab switch', async () => {
        const workflow = createModeTestWorkflow({
          initialMode: 'app'
        })

        await service.afterLoadNewGraph(
          workflow,
          makeWorkflowData(),
          app.rootGraph
        )

        expect(workflow.initialMode).toBe('app')
      })

      it('sets initialMode to app for fresh string-based loads with linearMode', async () => {
        vi.spyOn(workflowStore, 'createNewTemporary').mockReturnValue(
          createModeTestWorkflow()
        )

        await service.afterLoadNewGraph(
          'test.json',
          makeWorkflowData({ linearMode: true }),
          app.rootGraph
        )

        expect(appMode.mode.value).toBe('app')
      })

      it('reads initialMode from file when draft lacks linearMode (restoration)', async () => {
        const filePath = 'workflows/saved-app.json'
        const fileInitialState = makeWorkflowData({ linearMode: true })
        const mockTracker = createMockChangeTracker()
        mockTracker.initialState = fileInitialState

        // Persisted, not-loaded workflow in the store
        const persistedWorkflow = new ComfyWorkflowClass({
          path: filePath,
          modified: Date.now(),
          size: 100
        })

        vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(
          persistedWorkflow
        )
        vi.spyOn(workflowStore, 'openWorkflow').mockImplementation(
          async (wf) => {
            wf.changeTracker = mockTracker
            wf.content = JSON.stringify(fileInitialState)
            wf.originalContent = wf.content
            workflowStore.activeWorkflow = wf as LoadedComfyWorkflow
            return wf as LoadedComfyWorkflow
          }
        )

        // Draft data has NO linearMode (simulates rootGraph serialization)
        const draftData = makeWorkflowData()

        await service.afterLoadNewGraph(
          'saved-app.json',
          draftData,
          app.rootGraph
        )

        // initialMode should come from the file, not the draft
        expect(persistedWorkflow.initialMode).toBe('app')
      })
    })

    describe('round-trip mode preservation', () => {
      it('each workflow retains its own mode across tab switches', () => {
        const workflow1 = createModeTestWorkflow({
          path: 'workflows/one.json',
          activeMode: 'builder:inputs'
        })
        const workflow2 = createModeTestWorkflow({
          path: 'workflows/two.json',
          initialMode: 'app'
        })

        workflowStore.activeWorkflow = workflow1
        expect(appMode.mode.value).toBe('builder:inputs')

        workflowStore.activeWorkflow = workflow2
        expect(appMode.mode.value).toBe('app')

        workflowStore.activeWorkflow = workflow1
        expect(appMode.mode.value).toBe('builder:inputs')
      })
    })
  })

  describe('loadWorkflowInBackground', () => {
    it.for([
      { linearMode: true, mode: 'app' },
      { linearMode: false, mode: 'graph' }
    ])(
      'loads an unopened tab with linearMode $linearMode as $mode without showing it',
      async ({ linearMode, mode }) => {
        const workflowStore = useWorkflowStore()
        const service = useWorkflowService()
        const tab = workflowStore.createTemporary('Background.json', {
          ...blankGraph,
          id: '2d4f6a8b-1c3e-4a5b-9c7d-8e9f0a1b2c3d',
          extra: { linearMode }
        })
        expect(tab.isLoaded).toBe(false)

        await service.loadWorkflowInBackground(tab)

        expect(tab.isLoaded).toBe(true)
        expect(tab.initialMode).toBe(mode)
        expect(app.loadGraphData).not.toHaveBeenCalled()
        expect(workflowStore.activeWorkflow).not.toBe(tab)
      }
    )
  })

  describe('renameWorkflow', () => {
    it('reports a refused rename and leaves the workflow in place', async () => {
      const workflowStore = useWorkflowStore()
      const service = useWorkflowService()
      const workflow = createModeTestWorkflow({ path: 'workflows/a.json' })
      vi.spyOn(workflowStore, 'renameWorkflow').mockResolvedValue(false)

      const renamed = await service.renameWorkflow(workflow, 'workflows/b.json')

      expect(renamed).toBe(false)
      expect(workflow.path).toBe('workflows/a.json')
      expect(useToast().error).toHaveBeenCalled()
    })

    it('keeps run errors attached to a renamed workflow', async () => {
      const workflowStore = useWorkflowStore()
      const service = useWorkflowService()
      const executionErrorStore = useExecutionErrorStore()
      const graphId = '11111111-1111-4111-8111-111111111111'
      const oldPath = 'workflows/original.json'
      const newPath = 'workflows/renamed.json'
      const promptError = {
        type: 'execution',
        message: 'prompt failed',
        details: ''
      }
      const workflow = createModeTestWorkflow({ path: oldPath })
      workflow.changeTracker.activeState.id = graphId

      vi.spyOn(workflowStore, 'renameWorkflow').mockImplementation(
        async (renamedWorkflow, path) => {
          renamedWorkflow.updatePath(path)
          return true
        }
      )
      executionErrorStore.setActiveGraph(graphId, oldPath)
      executionErrorStore.recordPromptError(promptError)

      await service.renameWorkflow(workflow, newPath)

      expect(executionErrorStore.captureRunErrorKey()).toBe(
        executionErrorStore.runErrorKey(graphId, newPath)
      )
      executionErrorStore.setActiveGraph(graphId, newPath)
      expect(executionErrorStore.lastPromptError).toEqual(promptError)
      executionErrorStore.setActiveGraph(graphId, oldPath)
      expect(executionErrorStore.lastPromptError).toBeNull()
    })
  })

  describe('bookmarks of a renamed or deleted workflow', () => {
    function serveBookmarkIndexRefusingWrites(favorites: string[]) {
      vi.spyOn(api, 'getUserData').mockImplementation(
        async () => new Response(JSON.stringify({ favorites }), { status: 200 })
      )
      vi.spyOn(api, 'storeUserData').mockImplementation(
        async () => new Response(null, { status: 500 })
      )
    }

    it.for([
      {
        name: 'renamed',
        operation: 'renameWorkflow',
        act: (workflow: ComfyWorkflow) =>
          useWorkflowService().renameWorkflow(
            workflow,
            'workflows/renamed.json'
          ),
        pathsAfter: ['workflows/renamed.json'],
        warning: 'sideToolbar.workflowTab.renamedButBookmarksNotUpdated'
      },
      {
        name: 'deleted',
        operation: 'deleteWorkflow',
        act: (workflow: ComfyWorkflow) =>
          useWorkflowService().deleteWorkflow(workflow),
        pathsAfter: [],
        warning: 'sideToolbar.workflowTab.deletedButBookmarksNotUpdated'
      }
    ] as const)(
      'completes a $name workflow and warns once, with no action, that its bookmark was not updated',
      async ({ operation, act, pathsAfter, warning }) => {
        serveBookmarkIndexRefusingWrites(['workflows/draft.json'])
        vi.mocked(useDialogService().confirm).mockResolvedValue(true)
        const workflowStore = useWorkflowStore()
        const workflow = workflowStore.createTemporary('draft.json')

        expect(await act(workflow)).toBe(true)

        expect(workflowStore.workflows.map(({ path }) => path)).toEqual(
          pathsAfter
        )
        expect(useToast().toasts).toEqual([
          expect.objectContaining({
            kind: 'warning',
            title: t(warning),
            actions: []
          })
        ])
        expect(workflowStore[operation]).toHaveBeenCalledTimes(1)
      }
    )
  })

  describe('saveWorkflowAs', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>
    let service: ReturnType<typeof useWorkflowService>

    beforeEach(() => {
      workflowStore = useWorkflowStore()
      service = useWorkflowService()
      vi.spyOn(workflowStore, 'saveWorkflow').mockResolvedValue()
      vi.spyOn(workflowStore, 'renameWorkflow').mockResolvedValue(true)
      app.rootGraph.extra = {}
    })

    function createTemporaryWorkflow(
      directory: string = 'workflows'
    ): LoadedComfyWorkflow {
      const workflow = new ComfyWorkflowClass({
        path: directory + '/temp.json',
        modified: Date.now(),
        size: 100
      })
      workflow.changeTracker = createMockChangeTracker()
      workflow.content = '{}'
      workflow.originalContent = '{}'
      Object.defineProperty(workflow, 'isTemporary', { get: () => true })
      return workflow as LoadedComfyWorkflow
    }

    it('should rename then save when workflow is temporary', async () => {
      const workflow = createTemporaryWorkflow()
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(null)

      const result = await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow'
      })

      expect(result).toBe(true)
      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/my-workflow.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('asks before replacing a server file the store did not know, then overwrites', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.path = 'workflows/image_z_image_turbo.json'
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(workflow)
      vi.mocked(workflowStore.saveWorkflow)
        .mockRejectedValueOnce(
          new UserDataExistsError(
            "Error storing user data file 'workflows/image_z_image_turbo.json': 409 "
          )
        )
        .mockResolvedValueOnce()
      vi.mocked(useDialogService().confirm).mockResolvedValue(true)

      const result = await service.saveWorkflowAs(workflow, {
        filename: 'image_z_image_turbo'
      })

      expect(result).toBe(true)
      expect(useDialogService().confirm).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          type: 'overwrite',
          itemList: ['workflows/image_z_image_turbo.json']
        })
      )
      expect(workflowStore.saveWorkflow).toHaveBeenNthCalledWith(1, workflow)
      expect(workflowStore.saveWorkflow).toHaveBeenNthCalledWith(2, workflow, {
        overwrite: true
      })
    })

    it('keeps the server file and reports no save when the overwrite is declined', async () => {
      const workflow = createTemporaryWorkflow()
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(null)
      vi.mocked(workflowStore.saveWorkflow).mockRejectedValueOnce(
        new UserDataExistsError(
          "Error storing user data file 'workflows/my-workflow.json': 409 "
        )
      )
      vi.mocked(useDialogService().confirm).mockResolvedValue(false)

      const result = await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow'
      })

      expect(result).toBe(false)
      expect(workflowStore.saveWorkflow).toHaveBeenCalledOnce()
      expect(useTelemetry()?.trackWorkflowSaved).not.toHaveBeenCalled()
    })

    it('still throws a save failure that is not an existing file', async () => {
      const workflow = createTemporaryWorkflow()
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(null)
      vi.mocked(workflowStore.saveWorkflow).mockRejectedValueOnce(
        new Error("Error storing user data file 'workflows/x.json': 500 ")
      )

      await expect(
        service.saveWorkflowAs(workflow, { filename: 'x' })
      ).rejects.toThrow('500')
      expect(useDialogService().confirm).not.toHaveBeenCalled()
    })

    it('refuses to save as a path another unsaved tab holds', async () => {
      const workflow = createTemporaryWorkflow()
      const occupant = createTemporaryWorkflow()
      occupant.path = 'workflows/my-workflow.json'
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(occupant)
      vi.spyOn(workflowStore, 'deleteWorkflow').mockResolvedValue(true)

      const result = await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow'
      })

      expect(result).toBe(false)
      expect(useToast().error).toHaveBeenCalled()
      expect(useDialogService().confirm).not.toHaveBeenCalled()
      expect(workflowStore.deleteWorkflow).not.toHaveBeenCalled()
      expect(workflowStore.renameWorkflow).not.toHaveBeenCalled()
      expect(workflowStore.saveWorkflow).not.toHaveBeenCalled()
    })

    it('does not delete a saved workflow that moved away while the overwrite prompt was open', async () => {
      const workflow = createTemporaryWorkflow()
      const occupant = createModeTestWorkflow({
        path: 'workflows/my-workflow.json'
      })
      vi.mocked(workflowStore.getWorkflowByPath)
        .mockReturnValueOnce(occupant)
        .mockReturnValue(null)
      vi.spyOn(workflowStore, 'deleteWorkflow').mockResolvedValue(true)
      vi.mocked(useDialogService().confirm).mockResolvedValue(true)

      const result = await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow'
      })

      expect(result).toBe(false)
      expect(workflowStore.deleteWorkflow).not.toHaveBeenCalled()
      expect(workflowStore.renameWorkflow).not.toHaveBeenCalled()
      expect(workflowStore.saveWorkflow).not.toHaveBeenCalled()
    })

    it('does not delete a saved workflow that moves away before it is deleted', async () => {
      const workflow = createTemporaryWorkflow()
      const occupant = createModeTestWorkflow({
        path: 'workflows/my-workflow.json'
      })
      vi.mocked(workflowStore.getWorkflowByPath)
        .mockReturnValueOnce(occupant)
        .mockReturnValueOnce(occupant)
        .mockReturnValue(null)
      vi.spyOn(workflowStore, 'isOpen').mockReturnValue(false)
      vi.spyOn(workflowStore, 'deleteWorkflow').mockResolvedValue(true)
      vi.mocked(useDialogService().confirm).mockResolvedValue(true)

      const result = await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow'
      })

      expect(result).toBe(false)
      expect(workflowStore.deleteWorkflow).not.toHaveBeenCalled()
      expect(workflowStore.renameWorkflow).not.toHaveBeenCalled()
      expect(workflowStore.saveWorkflow).not.toHaveBeenCalled()
    })

    it('does not overwrite in place when the workflow moved while the overwrite prompt was open', async () => {
      const workflow = createModeTestWorkflow({
        path: 'workflows/my-workflow.json'
      })
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(workflow)
      vi.mocked(useDialogService().confirm).mockImplementation(async () => {
        workflow.path = 'workflows/moved.json'
        return true
      })

      const result = await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow'
      })

      expect(result).toBe(false)
      expect(workflowStore.saveWorkflow).not.toHaveBeenCalled()
    })

    it('should return false when no filename is provided', async () => {
      const workflow = createModeTestWorkflow({
        path: 'workflows/test.json'
      })
      vi.mocked(useDialogService().prompt).mockResolvedValue(null)

      const result = await service.saveWorkflowAs(workflow)

      expect(result).toBe(false)
      expect(workflowStore.saveWorkflow).not.toHaveBeenCalled()
    })

    it('prompts for a name using the workflow save-name copy', async () => {
      const workflow = createTemporaryWorkflow()
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(null)
      vi.mocked(useDialogService().prompt).mockResolvedValue('named')

      const result = await service.saveWorkflowAs(workflow)

      expect(result).toBe(true)
      expect(useDialogService().prompt).toHaveBeenCalledWith({
        title: t('workflowService.saveWorkflow'),
        message: t('workflowService.enterFilenamePrompt'),
        defaultValue: 'temp'
      })
      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/named.json'
      )
    })

    it('uses the filename chosen by an extension promptSave override', async () => {
      const workflow = createTemporaryWorkflow()
      Object.assign(workflow, {
        promptSave: async () => 'extension-folder/picked'
      })
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(null)

      const result = await service.saveWorkflowAs(workflow)

      expect(result).toBe(true)
      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/extension-folder/picked.json'
      )
      expect(useDialogService().prompt).not.toHaveBeenCalled()
    })

    it('appends .app.json extension when initialMode is app', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.initialMode = 'app'

      await service.saveWorkflowAs(workflow, { filename: 'my-workflow' })

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/my-workflow.app.json'
      )
    })

    it('appends .json extension when initialMode is graph', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.initialMode = 'graph'

      await service.saveWorkflowAs(workflow, { filename: 'my-workflow' })

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/my-workflow.json'
      )
    })

    it('appends .json extension when initialMode is not set', async () => {
      const workflow = createTemporaryWorkflow()

      await service.saveWorkflowAs(workflow, { filename: 'my-workflow' })

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/my-workflow.json'
      )
    })

    it('uses isApp option over initialMode when provided (graph -> app)', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.initialMode = 'graph'

      await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow',
        isApp: true
      })

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/my-workflow.app.json'
      )
    })

    it('uses isApp option over initialMode when provided (app -> graph)', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.initialMode = 'app'

      await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow',
        isApp: false
      })

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/my-workflow.json'
      )
    })

    it('creates a copy when saving same name with different mode (not self-overwrite)', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/test.json',
        initialMode: 'graph'
      })

      const copy = createModeTestWorkflow({
        path: 'workflows/test.app.json'
      })
      vi.spyOn(workflowStore, 'saveAs').mockReturnValue(copy)
      vi.spyOn(workflowStore, 'openWorkflow').mockResolvedValue(copy)

      await service.saveWorkflowAs(source, {
        filename: 'test',
        isApp: true
      })

      // Different extension means different path, so it's not a self-overwrite
      // — a new copy is created instead of modifying the source in place
      expect(source.initialMode).toBe('graph')
      expect(workflowStore.saveAs).toHaveBeenCalledWith(
        source,
        'workflows/test.app.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(copy)
      expect(useTelemetry()?.trackWorkflowSaved).toHaveBeenCalledTimes(1)
      expect(useTelemetry()?.trackWorkflowSaved).toHaveBeenCalledWith({
        is_app: true,
        is_new: true
      })
    })

    it('self-overwrites when saving same name with same mode', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/test.app.json',
        initialMode: 'app'
      })
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(source)
      vi.mocked(useDialogService().confirm).mockResolvedValue(true)

      await service.saveWorkflowAs(source, {
        filename: 'test',
        isApp: true
      })

      // Same path → self-overwrite: saves in place via saveWorkflow, no copy
      expect(workflowStore.saveAs).not.toHaveBeenCalled()
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(source)
    })

    it('emits a single is_new:true telemetry event on self-overwrite', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/test.app.json',
        initialMode: 'app'
      })
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(source)
      vi.mocked(useDialogService().confirm).mockResolvedValue(true)

      await service.saveWorkflowAs(source, {
        filename: 'test',
        isApp: true
      })

      expect(useTelemetry()?.trackWorkflowSaved).toHaveBeenCalledTimes(1)
      expect(useTelemetry()?.trackWorkflowSaved).toHaveBeenCalledWith({
        is_app: true,
        is_new: true
      })
    })

    it('calls prepareForSave once on self-overwrite', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/test.app.json',
        initialMode: 'app'
      })
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(source)
      vi.mocked(useDialogService().confirm).mockResolvedValue(true)

      await service.saveWorkflowAs(source, {
        filename: 'test',
        isApp: true
      })

      expect(source.changeTracker.prepareForSave).toHaveBeenCalledTimes(1)
    })

    it('does not modify source workflow mode when saving persisted workflow as different mode', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/original.json',
        initialMode: 'graph'
      })

      const copy = createModeTestWorkflow({
        path: 'workflows/copy.app.json'
      })
      vi.spyOn(workflowStore, 'saveAs').mockReturnValue(copy)
      vi.spyOn(workflowStore, 'openWorkflow').mockResolvedValue(copy)

      await service.saveWorkflowAs(source, {
        filename: 'copy',
        isApp: true
      })

      expect(source.initialMode).toBe('graph')
      expect(copy.initialMode).toBe('app')
      expect(workflowStore.saveAs).toHaveBeenCalledWith(
        source,
        'workflows/copy.app.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(copy)
    })

    it('does not modify source workflow mode when saving app as graph', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/original.app.json',
        initialMode: 'app'
      })

      const copy = createModeTestWorkflow({
        path: 'workflows/copy.json'
      })
      vi.spyOn(workflowStore, 'saveAs').mockReturnValue(copy)
      vi.spyOn(workflowStore, 'openWorkflow').mockResolvedValue(copy)

      await service.saveWorkflowAs(source, {
        filename: 'copy',
        isApp: false
      })

      expect(source.initialMode).toBe('app')
      expect(copy.initialMode).toBe('graph')
      expect(workflowStore.saveAs).toHaveBeenCalledWith(
        source,
        'workflows/copy.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(copy)
    })

    function captureLinearModeAtSaveTime() {
      let value: boolean | undefined
      vi.mocked(workflowStore.saveWorkflow).mockImplementation(async () => {
        value = app.rootGraph.extra.linearMode as boolean | undefined
      })
      return () => value
    }

    it('sets linearMode in graph data before saving (graph -> app)', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.initialMode = 'graph'
      app.rootGraph.extra = { linearMode: false }
      const getLinearMode = captureLinearModeAtSaveTime()

      await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow',
        isApp: true
      })

      expect(getLinearMode()).toBe(true)
    })

    it('sets linearMode in graph data before saving (app -> graph)', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.initialMode = 'app'
      app.rootGraph.extra = { linearMode: true }
      const getLinearMode = captureLinearModeAtSaveTime()

      await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow',
        isApp: false
      })

      expect(getLinearMode()).toBe(false)
    })

    it('sets linearMode before saving persisted workflow copy', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/original.json',
        initialMode: 'graph'
      })
      app.rootGraph.extra = { linearMode: false }

      const copy = createModeTestWorkflow({
        path: 'workflows/original.app.json'
      })
      vi.spyOn(workflowStore, 'saveAs').mockReturnValue(copy)
      vi.spyOn(workflowStore, 'openWorkflow').mockResolvedValue(copy)
      const getLinearMode = captureLinearModeAtSaveTime()

      await service.saveWorkflowAs(source, {
        filename: 'original',
        isApp: true
      })

      expect(getLinearMode()).toBe(true)
    })

    it('does not change initialMode when isApp is omitted (persisted copy)', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/original.app.json',
        initialMode: 'app'
      })

      // Real saveAs copies initialMode from source; replicate that here
      const copy = createModeTestWorkflow({
        path: 'workflows/copy.app.json',
        initialMode: 'app'
      })
      vi.spyOn(workflowStore, 'saveAs').mockReturnValue(copy)
      vi.spyOn(workflowStore, 'openWorkflow').mockResolvedValue(copy)

      await service.saveWorkflowAs(source, { filename: 'copy' })

      // saveWorkflowAs should not change initialMode when isApp is omitted
      expect(copy.initialMode).toBe('app')
    })
  })

  describe('saveWorkflow', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>
    let service: ReturnType<typeof useWorkflowService>

    beforeEach(() => {
      workflowStore = useWorkflowStore()
      service = useWorkflowService()
      vi.spyOn(workflowStore, 'saveWorkflow').mockResolvedValue()
      vi.spyOn(workflowStore, 'renameWorkflow').mockResolvedValue(true)
    })

    function createSaveableWorkflow(path: string): LoadedComfyWorkflow {
      const workflow = new ComfyWorkflowClass({
        path,
        modified: Date.now(),
        size: 100
      })
      workflow.changeTracker = createMockChangeTracker()
      workflow.content = '{}'
      workflow.originalContent = '{}'
      return workflow as LoadedComfyWorkflow
    }

    it('renames .json to .app.json when initialMode is app', async () => {
      const workflow = createSaveableWorkflow('workflows/test.json')
      workflow.initialMode = 'app'

      await service.saveWorkflow(workflow)

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/test.app.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('renames .app.json to .json when initialMode is graph', async () => {
      const workflow = createSaveableWorkflow('workflows/test.app.json')
      workflow.initialMode = 'graph'

      await service.saveWorkflow(workflow)

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/test.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('does not rename when extension already matches', async () => {
      const workflow = createSaveableWorkflow('workflows/test.app.json')
      workflow.initialMode = 'app'

      await service.saveWorkflow(workflow)

      expect(workflowStore.renameWorkflow).not.toHaveBeenCalled()
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('shows toast only when rename occurs', async () => {
      const workflow = createSaveableWorkflow('workflows/test.json')
      workflow.initialMode = 'app'

      await service.saveWorkflow(workflow)

      expect(useToast().info).toHaveBeenCalledWith(
        'Converted to app workflow',
        {
          duration: 3000
        }
      )
    })

    it('does not show toast when no rename occurs', async () => {
      const workflow = createSaveableWorkflow('workflows/test.app.json')
      workflow.initialMode = 'app'

      await service.saveWorkflow(workflow)

      expect(useToast().toasts).toEqual([])
    })

    it('does not rename when initialMode is not set', async () => {
      const workflow = createSaveableWorkflow('workflows/test.json')

      await service.saveWorkflow(workflow)

      expect(workflowStore.renameWorkflow).not.toHaveBeenCalled()
    })

    it('prompts for overwrite when target path already exists', async () => {
      const workflow = createSaveableWorkflow('workflows/test.json')
      workflow.initialMode = 'app'

      const existing = createSaveableWorkflow('workflows/test.app.json')
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(existing)
      vi.spyOn(workflowStore, 'deleteWorkflow').mockResolvedValue(true)
      vi.mocked(useDialogService().confirm).mockResolvedValue(true)

      await service.saveWorkflow(workflow)

      expect(useDialogService().confirm).toHaveBeenCalled()
      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/test.app.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('saves without renaming when user declines overwrite', async () => {
      const workflow = createSaveableWorkflow('workflows/test.json')
      workflow.initialMode = 'app'

      const existing = createSaveableWorkflow('workflows/test.app.json')
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(existing)
      vi.mocked(useDialogService().confirm).mockResolvedValue(false)

      await service.saveWorkflow(workflow)

      expect(useDialogService().confirm).toHaveBeenCalled()
      expect(workflowStore.renameWorkflow).not.toHaveBeenCalled()
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })
  })

  describe('saving a tab that is not loaded', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>
    let service: ReturnType<typeof useWorkflowService>

    beforeEach(() => {
      workflowStore = useWorkflowStore()
      service = useWorkflowService()
      vi.spyOn(api, 'getUserData').mockImplementation(
        async () => new Response(JSON.stringify(defaultGraph))
      )
      vi.spyOn(api, 'storeUserData').mockImplementation(
        async (path) =>
          new Response(JSON.stringify({ path, modified: 300, size: 2 }))
      )
      vi.mocked(useDialogService().confirm).mockResolvedValue(true)
      resetReportedWorkflowStateAnomaliesForTests()
      mockAssert.mockClear()
    })

    function unloadedModifiedTab(path: string): ComfyWorkflow {
      const tab = new ComfyWorkflowClass({ path, modified: 100, size: 1 })
      workflowStore.attachWorkflow(tab)
      workflowStore.openWorkflowsInBackground({ right: [tab.path] })
      tab.isModified = true
      return tab
    }

    function storedContent(path: string): ComfyWorkflowJSON {
      const call = vi
        .mocked(api.storeUserData)
        .mock.calls.find(([stored]) => stored === path)
      assert(call, `nothing was stored at ${path}`)
      return JSON.parse(call[1] as string) as ComfyWorkflowJSON
    }

    function enableDrafts() {
      useSettingStore().settingsById['Comfy.Workflow.Persist'] = {
        id: 'Comfy.Workflow.Persist',
        name: 'Persist workflow state',
        type: 'boolean',
        defaultValue: true
      }
    }

    function draftOf(extra: Record<string, unknown>, updatedAt: number) {
      vi.mocked(useWorkflowDraftStoreV2().getDraft).mockImplementation((path) =>
        path === 'workflows/background.json'
          ? {
              data: JSON.stringify({ ...defaultGraph, extra }),
              name: 'background.json',
              isTemporary: false,
              updatedAt
            }
          : null
      )
    }

    it('loads its draft and saves it when Save is chosen in the close dialog', async () => {
      enableDrafts()
      draftOf({ editedInDraft: true }, 200)
      const tab = unloadedModifiedTab('workflows/background.json')

      expect(await service.closeWorkflow(tab)).toBe(true)

      expect(storedContent('workflows/background.json').extra).toEqual({
        editedInDraft: true
      })
      expect(workflowStore.openWorkflows).not.toContain(tab)
      expect(mockAssert).not.toHaveBeenCalledWith(
        false,
        'Modified saved workflow lost its edits before saving',
        expect.anything()
      )
    })

    it('writes nothing and says so when the edits are no longer available', async () => {
      enableDrafts()
      draftOf({ editedInDraft: true }, 50)
      const tab = unloadedModifiedTab('workflows/background.json')

      expect(await service.closeWorkflow(tab)).toBe(true)

      expect(api.storeUserData).not.toHaveBeenCalled()
      expect(tab.isModified).toBe(false)
      expect(useToast().toasts).toEqual([
        expect.objectContaining({
          kind: 'warning',
          title: 'Unsaved changes were not saved'
        })
      ])
      expect(mockAssert).toHaveBeenCalledWith(
        false,
        'Modified saved workflow lost its edits before saving',
        expect.objectContaining({
          method: 'workflowService.loadForSave',
          isPersisted: true
        })
      )
    })

    it('keeps refusing to save an active tab that has no loaded content', async () => {
      const tab = unloadedModifiedTab('workflows/active.json')
      workflowStore.activeWorkflow = fromAny(tab)
      const load = vi.spyOn(tab, 'load')

      await expect(service.saveWorkflow(tab)).rejects.toThrow(
        'Cannot save a workflow before it is loaded'
      )

      expect(load).not.toHaveBeenCalled()
      expect(api.storeUserData).not.toHaveBeenCalled()
    })

    it('saves the draft the user edited when saved directly', async () => {
      enableDrafts()
      draftOf({ editedInDraft: true }, 200)
      const tab = unloadedModifiedTab('workflows/background.json')

      expect(await service.saveWorkflow(tab)).toBe(true)

      expect(storedContent('workflows/background.json').extra).toEqual({
        editedInDraft: true
      })
      expect(tab.isModified).toBe(false)
    })

    it('saves the draft of an unloaded saved tab under a new name', async () => {
      enableDrafts()
      draftOf({ editedInDraft: true }, 200)
      const tab = unloadedModifiedTab('workflows/background.json')

      expect(
        await service.saveWorkflowAs(tab, { filename: 'background copy' })
      ).toBe(true)

      expect(storedContent('workflows/background copy.json').extra).toEqual({
        editedInDraft: true
      })
      expect(
        vi
          .mocked(api.storeUserData)
          .mock.calls.some(([path]) => path === 'workflows/background.json')
      ).toBe(false)
    })

    it('saves an unsaved tab that a reload restored without opening it', async () => {
      const restored = workflowStore.createTemporary('Restored.json', {
        ...blankGraph,
        id: '7b1e2c3d-4f5a-4b6c-8d7e-9f0a1b2c3d4e'
      })
      workflowStore.openWorkflowsInBackground({ right: [restored.path] })
      restored.isModified = true
      expect(restored.isLoaded).toBe(false)
      vi.mocked(useDialogService().prompt).mockResolvedValue('Restored')

      expect(await service.closeWorkflow(restored)).toBe(true)

      expect(storedContent('workflows/Restored.json').id).toBe(
        '7b1e2c3d-4f5a-4b6c-8d7e-9f0a1b2c3d4e'
      )
      expect(mockAssert).not.toHaveBeenCalledWith(
        false,
        'Modified saved workflow lost its edits before saving',
        expect.anything()
      )
    })
  })
})

vi.mock(import('@vueuse/router'), async () => {
  const { ref } = await import('vue')
  return { useRouteHash: () => ref('') }
})
