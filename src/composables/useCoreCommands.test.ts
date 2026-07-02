import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useCoreCommands } from '@/composables/useCoreCommands'
import {
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

// Mock vue-i18n for useExternalLink
const mockLocale = ref('en')
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual('vue-i18n')
  return {
    ...actual,
    useI18n: vi.fn(() => ({
      locale: mockLocale
    }))
  }
})

vi.mock('@/scripts/app', () => {
  const mockGraphClear = vi.fn()
  const mockDs = {
    scale: 1,
    element: { width: 800, height: 600 } as Pick<
      HTMLCanvasElement,
      'width' | 'height'
    >,
    changeScale: vi.fn()
  }
  const mockCanvas = {
    subgraph: undefined,
    selectedItems: new Set(),
    selected_nodes: null as Record<string, unknown> | null,
    copyToClipboard: vi.fn(),
    pasteFromClipboard: vi.fn(),
    selectItems: vi.fn(),
    ds: mockDs,
    deleteSelected: vi.fn(),
    setDirty: vi.fn(),
    fitViewToSelectionAnimated: vi.fn(),
    empty: false,
    state: {
      readOnly: false,
      selectionChanged: false
    },
    graph: {
      add: vi.fn(),
      convertToSubgraph: vi.fn(),
      rootGraph: {}
    },
    select: vi.fn(),
    canvas: {
      dispatchEvent: vi.fn()
    },
    setGraph: vi.fn()
  }

  return {
    app: {
      clean: vi.fn(() => {
        if (!mockCanvas.subgraph) {
          mockGraphClear()
        }
      }),
      openClipspace: vi.fn(),
      refreshComboInNodes: vi.fn().mockResolvedValue(undefined),
      canvas: mockCanvas,
      rootGraph: {
        clear: mockGraphClear,
        _nodes: []
      },
      queuePrompt: vi.fn(),
      ui: { loadFile: vi.fn() }
    }
  }
})

vi.mock('@/scripts/api', () => ({
  api: {
    dispatchCustomEvent: vi.fn(),
    apiURL: vi.fn(() => 'http://localhost:8188'),
    interrupt: vi.fn(),
    freeMemory: vi.fn()
  }
}))

vi.mock('@/platform/settings/settingStore')

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({}))
}))

vi.mock('@/composables/auth/useFirebaseAuth', () => ({
  useFirebaseAuth: vi.fn(() => null)
}))

vi.mock('firebase/auth', () => ({
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  onAuthStateChanged: vi.fn()
}))

const mockWorkflowService = vi.hoisted(() => ({
  closeWorkflow: vi.fn(),
  duplicateWorkflow: vi.fn(),
  exportWorkflow: vi.fn(),
  loadBlankWorkflow: vi.fn(),
  loadDefaultWorkflow: vi.fn(),
  loadNextOpenedWorkflow: vi.fn(),
  loadPreviousOpenedWorkflow: vi.fn(),
  reloadCurrentWorkflow: vi.fn(),
  renameWorkflow: vi.fn(),
  saveWorkflow: vi.fn(),
  saveWorkflowAs: vi.fn()
}))
vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: vi.fn(() => mockWorkflowService)
}))

const mockDialogService = vi.hoisted(() => ({
  confirm: vi.fn(),
  prompt: vi.fn()
}))
vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => mockDialogService)
}))

const mockResetView = vi.hoisted(() => vi.fn())
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: vi.fn(() => ({
    resetView: mockResetView
  }))
}))

const mockTelemetry = vi.hoisted(() => ({
  trackWorkflowCreated: vi.fn(),
  trackRunButton: vi.fn(),
  trackWorkflowExecution: vi.fn(),
  trackHelpResourceClicked: vi.fn(),
  trackEnterLinear: vi.fn()
}))
vi.mock('@/composables/useRunButtonTelemetry', () => ({
  useRunButtonTelemetry: vi.fn(() => ({
    trackRunButton: mockTelemetry.trackRunButton
  }))
}))
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => mockTelemetry)
}))

const mockModelStoreRefresh = vi.hoisted(() => vi.fn())
vi.mock('@/stores/modelStore', () => ({
  ComfyModelDef: class {},
  useModelStore: vi.fn(() => ({
    refresh: mockModelStoreRefresh
  }))
}))

const mockShowAbout = vi.hoisted(() => vi.fn())
const mockShowSettings = vi.hoisted(() => vi.fn())
vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: vi.fn(() => ({
    show: mockShowSettings,
    showAbout: mockShowAbout
  }))
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn(() => ({}))
}))

const mockToastStore = vi.hoisted(() => ({
  add: vi.fn()
}))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn(() => mockToastStore)
}))

const mockChangeTracker = vi.hoisted(() => ({
  captureCanvasState: vi.fn(),
  checkState: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn()
}))
interface MockActiveWorkflow {
  changeTracker: typeof mockChangeTracker
  directory: string
  filename: string
  isPersisted: boolean
  suffix: string
}
const mockWorkflowStore = vi.hoisted(() => ({
  activeWorkflow: {
    changeTracker: mockChangeTracker,
    directory: '/workflows',
    filename: 'old.json',
    isPersisted: true,
    suffix: 'json'
  } as MockActiveWorkflow | null
}))
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => mockWorkflowStore)
}))

const mockSubgraphStore = vi.hoisted(() => ({
  publishSubgraph: vi.fn()
}))
vi.mock('@/stores/subgraphStore', () => ({
  useSubgraphStore: vi.fn(() => mockSubgraphStore)
}))

const mockCanvasStore = vi.hoisted(() => ({
  getCanvas: vi.fn(),
  canvas: null as unknown,
  linearMode: false,
  updateSelectedItems: vi.fn()
}))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: vi.fn(() => mockCanvasStore),
  useTitleEditorStore: vi.fn(() => ({
    titleEditorTarget: null
  }))
}))

const mockSubgraphNavigationStore = vi.hoisted(() => ({
  navigationStack: [] as unknown[]
}))
vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: vi.fn(() => mockSubgraphNavigationStore)
}))

const mockColorPaletteStore = vi.hoisted(() => ({
  completedActivePalette: { id: 'dark-default', light_theme: false }
}))
vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: vi.fn(() => mockColorPaletteStore)
}))

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: vi.fn(() => ({
    logout: vi.fn()
  }))
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: vi.fn(() => ({
    isActiveSubscription: vi.fn().mockReturnValue(true),
    showSubscriptionDialog: vi.fn()
  }))
}))

const mockIsActiveSubscription = vi.hoisted(() => ({ value: true }))
const mockShowSubscriptionDialog = vi.hoisted(() => vi.fn())
vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: vi.fn(() => ({
    isActiveSubscription: mockIsActiveSubscription,
    showSubscriptionDialog: mockShowSubscriptionDialog
  }))
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    userEmail: ref(''),
    resolvedUserInfo: ref(null)
  }))
}))

const mockSelectedItems = vi.hoisted(() => ({
  getSelectedNodes: vi.fn((): unknown[] => []),
  toggleSelectedNodesMode: vi.fn()
}))
vi.mock('@/composables/canvas/useSelectedLiteGraphItems', () => ({
  useSelectedLiteGraphItems: vi.fn(() => mockSelectedItems)
}))

vi.mock('@/composables/graph/useSubgraphOperations', () => ({
  useSubgraphOperations: vi.fn(() => ({
    unpackSubgraph: vi.fn()
  }))
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: vi.fn(() => ({
    staticUrls: {
      githubIssues: 'https://github.com/issues',
      discord: 'https://discord.gg/test',
      forum: 'https://forum.test.com'
    },
    buildDocsUrl: vi.fn(() => 'https://docs.test.com')
  }))
}))

vi.mock('@/composables/useModelSelectorDialog', () => ({
  useModelSelectorDialog: vi.fn(() => ({
    show: vi.fn()
  }))
}))

vi.mock('@/composables/useWorkflowTemplateSelectorDialog', () => ({
  useWorkflowTemplateSelectorDialog: vi.fn(() => ({
    show: vi.fn()
  }))
}))

const mockAssetBrowserBrowse = vi.hoisted(() => vi.fn())
vi.mock('@/platform/assets/composables/useAssetBrowserDialog', () => ({
  useAssetBrowserDialog: vi.fn(() => ({
    browse: mockAssetBrowserBrowse
  }))
}))

vi.mock('@/platform/assets/utils/createModelNodeFromAsset', () => ({
  createModelNodeFromAsset: vi.fn()
}))

const mockStartModelNodeDragFromAsset = vi.hoisted(() => vi.fn())
vi.mock('@/composables/node/startModelNodeDragFromAsset', () => ({
  startModelNodeDragFromAsset: mockStartModelNodeDragFromAsset
}))

const mockManagerState = vi.hoisted(() => ({
  managerUIState: { value: 'enabled' },
  openManager: vi.fn()
}))
vi.mock('@/workbench/extensions/manager/composables/useManagerState', () => ({
  ManagerUIState: { DISABLED: 'disabled' },
  useManagerState: vi.fn(() => mockManagerState)
}))

vi.mock('@/platform/support/config', () => ({
  buildSupportUrl: vi.fn(() => 'https://support.test.com')
}))

const mockFilterOutputNodes = vi.hoisted(() => vi.fn((): LGraphNode[] => []))
vi.mock('@/utils/nodeFilterUtil', () => ({
  filterOutputNodes: mockFilterOutputNodes
}))

const mockGetExecutionIdsForSelectedNodes = vi.hoisted(() =>
  vi.fn((): number[] => [])
)
const mockGetAllNonIoNodesInSubgraph = vi.hoisted(() =>
  vi.fn((): LGraphNode[] => [])
)
vi.mock('@/utils/graphTraversalUtil', () => ({
  getAllNonIoNodesInSubgraph: mockGetAllNonIoNodesInSubgraph,
  getExecutionIdsForSelectedNodes: mockGetExecutionIdsForSelectedNodes,
  reduceAllNodes: vi.fn(() => [])
}))

vi.mock('@/stores/queueStore', () => ({
  useQueueSettingsStore: vi.fn(() => ({ batchCount: 1 })),
  useQueueStore: vi.fn(() => ({})),
  useQueueUIStore: vi.fn(() => ({}))
}))

const mockLGraphGroupInstance = vi.hoisted(() => ({
  resizeTo: vi.fn(),
  recomputeInsideNodes: vi.fn()
}))
const MockLGraphGroup = vi.hoisted(
  () =>
    function (this: typeof mockLGraphGroupInstance) {
      Object.assign(this, mockLGraphGroupInstance)
    }
)
vi.mock('@/lib/litegraph/src/litegraph', async () => {
  const actual = await vi.importActual('@/lib/litegraph/src/litegraph')
  return {
    ...actual,
    LGraphGroup: MockLGraphGroup
  }
})

describe('useCoreCommands', () => {
  const createMockNode = (id: number, comfyClass: string): LGraphNode => {
    const baseNode = createMockLGraphNode({ id })
    return Object.assign(baseNode, {
      constructor: {
        ...baseNode.constructor,
        comfyClass
      }
    })
  }

  const createMockSubgraph = () => {
    const mockNodes = [
      createMockNode(1, 'SubgraphInputNode'),
      createMockNode(2, 'SubgraphOutputNode'),
      createMockNode(3, 'SomeUserNode'),
      createMockNode(4, 'AnotherUserNode')
    ]

    return {
      nodes: mockNodes,
      remove: vi.fn(),
      events: {
        dispatch: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      },
      name: 'test-subgraph',
      inputNode: undefined,
      outputNode: undefined,
      add: vi.fn(),
      clear: vi.fn(),
      serialize: vi.fn(),
      configure: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      runStep: vi.fn(),
      findNodeByTitle: vi.fn(),
      findNodesByTitle: vi.fn(),
      findNodesByType: vi.fn(),
      findNodeById: vi.fn(),
      getNodeById: vi.fn(),
      setDirtyCanvas: vi.fn(),
      sendActionToCanvas: vi.fn(),
      extra: {} as Record<string, unknown>
    } as Partial<typeof app.canvas.subgraph> as typeof app.canvas.subgraph
  }

  const mockSubgraph = createMockSubgraph()!

  function createMockSettingStore(
    getReturnValue: boolean
  ): ReturnType<typeof useSettingStore> {
    return {
      get: vi.fn().mockReturnValue(getReturnValue),
      addSetting: vi.fn(),
      load: vi.fn(),
      set: vi.fn(),
      setMany: vi.fn(),
      exists: vi.fn(),
      getDefaultValue: vi.fn(),
      isReady: true,
      isLoading: false,
      error: undefined,
      settingValues: {},
      settingsById: {},
      $id: 'setting',
      $state: {
        settingValues: {},
        settingsById: {},
        isReady: true,
        isLoading: false,
        error: undefined
      },
      $patch: vi.fn(),
      $reset: vi.fn(),
      $subscribe: vi.fn(),
      $onAction: vi.fn(),
      $dispose: vi.fn(),
      _customProperties: new Set()
    } satisfies ReturnType<typeof useSettingStore>
  }

  function findCommand(id: string) {
    const cmd = useCoreCommands().find((c) => c.id === id)
    if (!cmd) throw new Error(`Command '${id}' not found`)
    return cmd
  }

  beforeEach(() => {
    vi.resetAllMocks()

    setActivePinia(createPinia())

    app.canvas.subgraph = undefined
    app.canvas.selectedItems = new Set()
    app.canvas.state.readOnly = false
    app.canvas.state.selectionChanged = false
    Object.defineProperty(app.canvas, 'empty', { value: false, writable: true })
    mockCanvasStore.linearMode = false
    mockCanvasStore.getCanvas.mockReturnValue(app.canvas)
    mockIsActiveSubscription.value = true
    mockWorkflowStore.activeWorkflow = {
      changeTracker: mockChangeTracker,
      directory: '/workflows',
      filename: 'old.json',
      isPersisted: true,
      suffix: 'json'
    }
    mockColorPaletteStore.completedActivePalette = {
      id: 'dark-default',
      light_theme: false
    }
    mockManagerState.managerUIState.value = 'enabled'
    mockSubgraphNavigationStore.navigationStack = []

    vi.mocked(useSettingStore).mockReturnValue(createMockSettingStore(false))

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    vi.stubGlobal(
      'open',
      vi.fn().mockReturnValue({ focus: vi.fn(), closed: false })
    )
  })

  describe('ClearWorkflow command', () => {
    it('should clear main graph when not in subgraph', async () => {
      await findCommand('Comfy.ClearWorkflow').function()

      expect(app.clean).toHaveBeenCalled()
      expect(app.rootGraph.clear).toHaveBeenCalled()
      expect(api.dispatchCustomEvent).toHaveBeenCalledWith('graphCleared')
    })

    it('should preserve input/output nodes when clearing subgraph', async () => {
      app.canvas.subgraph = mockSubgraph
      mockGetAllNonIoNodesInSubgraph.mockReturnValue([
        mockSubgraph.nodes[2],
        mockSubgraph.nodes[3]
      ])

      await findCommand('Comfy.ClearWorkflow').function()

      expect(app.clean).toHaveBeenCalled()
      expect(app.rootGraph.clear).not.toHaveBeenCalled()

      const subgraph = app.canvas.subgraph!
      expect(subgraph.remove).toHaveBeenCalledTimes(2)
      expect(subgraph.remove).toHaveBeenCalledWith(subgraph.nodes[2])
      expect(subgraph.remove).toHaveBeenCalledWith(subgraph.nodes[3])
      expect(subgraph.remove).not.toHaveBeenCalledWith(subgraph.nodes[0])
      expect(subgraph.remove).not.toHaveBeenCalledWith(subgraph.nodes[1])

      expect(api.dispatchCustomEvent).toHaveBeenCalledWith('graphCleared')
    })

    it('should respect confirmation setting', async () => {
      vi.mocked(useSettingStore).mockReturnValue(createMockSettingStore(true))
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))

      await findCommand('Comfy.ClearWorkflow').function()

      expect(app.clean).not.toHaveBeenCalled()
      expect(app.rootGraph.clear).not.toHaveBeenCalled()
      expect(api.dispatchCustomEvent).not.toHaveBeenCalled()
    })
  })

  describe('Canvas clipboard commands', () => {
    it('should copy selected items when selection exists', async () => {
      app.canvas.selectedItems = new Set([
        {}
      ]) as typeof app.canvas.selectedItems

      await findCommand('Comfy.Canvas.CopySelected').function()

      expect(app.canvas.copyToClipboard).toHaveBeenCalledWith()
    })

    it('should not copy when no items are selected', async () => {
      await findCommand('Comfy.Canvas.CopySelected').function()

      expect(app.canvas.copyToClipboard).not.toHaveBeenCalled()
    })

    it('should paste from clipboard', async () => {
      await findCommand('Comfy.Canvas.PasteFromClipboard').function()

      expect(app.canvas.pasteFromClipboard).toHaveBeenCalledWith()
    })

    it('should paste with connect option', async () => {
      await findCommand('Comfy.Canvas.PasteFromClipboardWithConnect').function()

      expect(app.canvas.pasteFromClipboard).toHaveBeenCalledWith({
        connectInputs: true
      })
    })

    it('should select all items', async () => {
      await findCommand('Comfy.Canvas.SelectAll').function()

      expect(app.canvas.selectItems).toHaveBeenCalledWith()
    })
  })

  describe('Undo/Redo commands', () => {
    it('Undo should call changeTracker.undo', async () => {
      await findCommand('Comfy.Undo').function()

      expect(mockChangeTracker.undo).toHaveBeenCalled()
    })

    it('Redo should call changeTracker.redo', async () => {
      await findCommand('Comfy.Redo').function()

      expect(mockChangeTracker.redo).toHaveBeenCalled()
    })
  })

  describe('Canvas lock commands', () => {
    it('ToggleLock should toggle readOnly state', async () => {
      app.canvas.state.readOnly = false

      await findCommand('Comfy.Canvas.ToggleLock').function()
      expect(app.canvas.state.readOnly).toBe(true)

      await findCommand('Comfy.Canvas.ToggleLock').function()
      expect(app.canvas.state.readOnly).toBe(false)
    })

    it('Lock should set readOnly to true', async () => {
      await findCommand('Comfy.Canvas.Lock').function()
      expect(app.canvas.state.readOnly).toBe(true)
    })

    it('Unlock should set readOnly to false', async () => {
      app.canvas.state.readOnly = true
      await findCommand('Comfy.Canvas.Unlock').function()
      expect(app.canvas.state.readOnly).toBe(false)
    })
  })

  describe('Canvas delete command', () => {
    it('should delete selected items when selection exists', async () => {
      app.canvas.selectedItems = new Set([
        {}
      ]) as typeof app.canvas.selectedItems

      await findCommand('Comfy.Canvas.DeleteSelectedItems').function()

      expect(app.canvas.deleteSelected).toHaveBeenCalled()
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('should dispatch no-items-selected event when nothing selected', async () => {
      app.canvas.selectedItems = new Set()

      await findCommand('Comfy.Canvas.DeleteSelectedItems').function()

      expect(app.canvas.canvas.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'litegraph:no-items-selected' })
      )
      expect(app.canvas.deleteSelected).not.toHaveBeenCalled()
    })
  })

  describe('ToggleLinkVisibility command', () => {
    it('should hide links when currently visible', async () => {
      const mockStore = createMockSettingStore(false)
      mockStore.get = vi.fn().mockReturnValue(LiteGraph.SPLINE_LINK)
      vi.mocked(useSettingStore).mockReturnValue(mockStore)

      await findCommand('Comfy.Canvas.ToggleLinkVisibility').function()

      expect(mockStore.set).toHaveBeenCalledWith(
        'Comfy.LinkRenderMode',
        LiteGraph.HIDDEN_LINK
      )
    })

    it('should restore links when currently hidden', async () => {
      const mockStore = createMockSettingStore(false)
      mockStore.get = vi.fn().mockReturnValue(LiteGraph.HIDDEN_LINK)
      vi.mocked(useSettingStore).mockReturnValue(mockStore)

      await findCommand('Comfy.Canvas.ToggleLinkVisibility').function()

      const lastSetCall = vi.mocked(mockStore.set).mock.calls.at(-1)
      expect(lastSetCall?.[0]).toBe('Comfy.LinkRenderMode')
      expect(lastSetCall?.[1]).not.toBe(LiteGraph.HIDDEN_LINK)
    })
  })

  describe('ToggleMinimap command', () => {
    it('should toggle minimap visibility setting', async () => {
      const mockStore = createMockSettingStore(false)
      mockStore.get = vi.fn().mockReturnValue(false)
      vi.mocked(useSettingStore).mockReturnValue(mockStore)

      await findCommand('Comfy.Canvas.ToggleMinimap').function()

      expect(mockStore.set).toHaveBeenCalledWith('Comfy.Minimap.Visible', true)
    })
  })

  describe('QueuePrompt commands', () => {
    it('should show subscription dialog when not subscribed', async () => {
      mockIsActiveSubscription.value = false

      await findCommand('Comfy.QueuePrompt').function()

      expect(mockShowSubscriptionDialog).toHaveBeenCalled()
      expect(app.queuePrompt).not.toHaveBeenCalled()

      mockIsActiveSubscription.value = true
    })

    it('should queue prompt when subscribed', async () => {
      await findCommand('Comfy.QueuePrompt').function()

      expect(app.queuePrompt).toHaveBeenCalledWith(0, 1)
      expect(mockTelemetry.trackRunButton).toHaveBeenCalled()
      expect(mockTelemetry.trackWorkflowExecution).toHaveBeenCalled()
    })

    it('should queue prompt at front', async () => {
      await findCommand('Comfy.QueuePromptFront').function()

      expect(app.queuePrompt).toHaveBeenCalledWith(-1, 1)
    })

    it('should show subscription dialog instead of queuing at front when not subscribed', async () => {
      mockIsActiveSubscription.value = false

      await findCommand('Comfy.QueuePromptFront').function()

      expect(mockShowSubscriptionDialog).toHaveBeenCalled()
      expect(app.queuePrompt).not.toHaveBeenCalled()
    })
  })

  describe('QueueSelectedOutputNodes command', () => {
    it('should show subscription dialog before checking selected output nodes', async () => {
      mockIsActiveSubscription.value = false

      await findCommand('Comfy.QueueSelectedOutputNodes').function()

      expect(mockShowSubscriptionDialog).toHaveBeenCalled()
      expect(mockFilterOutputNodes).not.toHaveBeenCalled()
    })

    it('should show error toast when no output nodes selected', async () => {
      await findCommand('Comfy.QueueSelectedOutputNodes').function()

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(app.queuePrompt).not.toHaveBeenCalled()
    })

    it('should queue selected output nodes when valid selection exists', async () => {
      const mockNode = createMockLGraphNode({ id: 1 })
      mockSelectedItems.getSelectedNodes.mockReturnValue([mockNode])
      mockFilterOutputNodes.mockReturnValue([mockNode])
      mockGetExecutionIdsForSelectedNodes.mockReturnValue([1])

      await findCommand('Comfy.QueueSelectedOutputNodes').function()

      expect(app.queuePrompt).toHaveBeenCalledWith(0, 1, [1])
      expect(mockTelemetry.trackWorkflowExecution).toHaveBeenCalled()
    })

    it('should show error toast when selected output nodes cannot resolve execution ids', async () => {
      const mockNode = createMockLGraphNode({ id: 1 })
      mockSelectedItems.getSelectedNodes.mockReturnValue([mockNode])
      mockFilterOutputNodes.mockReturnValue([mockNode])
      mockGetExecutionIdsForSelectedNodes.mockReturnValue([])

      await findCommand('Comfy.QueueSelectedOutputNodes').function()

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error'
        })
      )
      expect(app.queuePrompt).not.toHaveBeenCalled()
    })
  })

  describe('MoveSelectedNodes commands', () => {
    function setupMoveTest() {
      const mockNode = createMockLGraphNode({ id: 1 })
      mockNode.pos = [100, 200] as [number, number]
      mockSelectedItems.getSelectedNodes.mockReturnValue([mockNode])

      const mockStore = createMockSettingStore(false)
      mockStore.get = vi.fn().mockReturnValue(10)
      vi.mocked(useSettingStore).mockReturnValue(mockStore)

      return mockNode
    }

    it('should move nodes up by grid size', async () => {
      const mockNode = setupMoveTest()

      await findCommand('Comfy.Canvas.MoveSelectedNodes.Up').function()

      expect(mockNode.pos).toEqual([100, 190])
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('should move nodes down by grid size', async () => {
      const mockNode = setupMoveTest()

      await findCommand('Comfy.Canvas.MoveSelectedNodes.Down').function()

      expect(mockNode.pos).toEqual([100, 210])
    })

    it('should move nodes left by grid size', async () => {
      const mockNode = setupMoveTest()

      await findCommand('Comfy.Canvas.MoveSelectedNodes.Left').function()

      expect(mockNode.pos).toEqual([90, 200])
    })

    it('should move nodes right by grid size', async () => {
      const mockNode = setupMoveTest()

      await findCommand('Comfy.Canvas.MoveSelectedNodes.Right').function()

      expect(mockNode.pos).toEqual([110, 200])
    })

    it('should not move when no nodes selected', async () => {
      mockSelectedItems.getSelectedNodes.mockReturnValue([])

      await findCommand('Comfy.Canvas.MoveSelectedNodes.Up').function()

      expect(app.canvas.setDirty).not.toHaveBeenCalled()
    })
  })

  describe('ToggleLinear command', () => {
    it('should toggle linear mode and track telemetry when entering', async () => {
      mockCanvasStore.linearMode = false

      await findCommand('Comfy.ToggleLinear').function()

      expect(mockCanvasStore.linearMode).toBe(true)
      expect(mockTelemetry.trackEnterLinear).toHaveBeenCalledWith({
        source: 'keybind'
      })
    })

    it('should use provided source metadata', async () => {
      mockCanvasStore.linearMode = false

      await findCommand('Comfy.ToggleLinear').function({
        source: 'menu'
      })

      expect(mockTelemetry.trackEnterLinear).toHaveBeenCalledWith({
        source: 'menu'
      })
    })

    it('does not track when leaving linear mode', async () => {
      mockCanvasStore.linearMode = true

      await findCommand('Comfy.ToggleLinear').function()

      expect(mockCanvasStore.linearMode).toBe(false)
      expect(mockTelemetry.trackEnterLinear).not.toHaveBeenCalled()
    })
  })

  describe('ExitSubgraph command', () => {
    it('does nothing when the canvas has no graph', async () => {
      const setGraph = vi.fn()
      mockCanvasStore.getCanvas.mockReturnValue({
        graph: null,
        setGraph
      })

      await findCommand('Comfy.Graph.ExitSubgraph').function()

      expect(setGraph).not.toHaveBeenCalled()
    })

    it('falls back to the root graph without navigation history', async () => {
      const rootGraph = {}
      const setGraph = vi.fn()
      mockCanvasStore.getCanvas.mockReturnValue({
        graph: { rootGraph },
        setGraph
      })

      await findCommand('Comfy.Graph.ExitSubgraph').function()

      expect(setGraph).toHaveBeenCalledWith(rootGraph)
    })
  })

  describe('ToggleQPOV2 command', () => {
    it('should toggle queue panel v2 setting', async () => {
      const mockStore = createMockSettingStore(false)
      mockStore.get = vi.fn().mockReturnValue(false)
      vi.mocked(useSettingStore).mockReturnValue(mockStore)

      await findCommand('Comfy.ToggleQPOV2').function()

      expect(mockStore.set).toHaveBeenCalledWith('Comfy.Queue.QPOV2', true)
    })
  })

  describe('Memory commands', () => {
    it('UnloadModels should show error when setting is disabled', async () => {
      const mockStore = createMockSettingStore(false)
      mockStore.get = vi.fn().mockReturnValue(false)
      vi.mocked(useSettingStore).mockReturnValue(mockStore)

      await findCommand('Comfy.Memory.UnloadModels').function()

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(api.freeMemory).not.toHaveBeenCalled()
    })

    it('UnloadModels should call api.freeMemory when setting is enabled', async () => {
      const mockStore = createMockSettingStore(false)
      mockStore.get = vi.fn().mockReturnValue(true)
      vi.mocked(useSettingStore).mockReturnValue(mockStore)

      await findCommand('Comfy.Memory.UnloadModels').function()

      expect(api.freeMemory).toHaveBeenCalledWith({
        freeExecutionCache: false
      })
    })

    it('UnloadModelsAndExecutionCache should call api.freeMemory with cache flag', async () => {
      const mockStore = createMockSettingStore(false)
      mockStore.get = vi.fn().mockReturnValue(true)
      vi.mocked(useSettingStore).mockReturnValue(mockStore)

      await findCommand('Comfy.Memory.UnloadModelsAndExecutionCache').function()

      expect(api.freeMemory).toHaveBeenCalledWith({
        freeExecutionCache: true
      })
    })
  })

  describe('Asset browser commands', () => {
    it('does not enable the asset API when confirmation is declined', async () => {
      const mockStore = createMockSettingStore(false)
      mockStore.get = vi.fn().mockReturnValue(false)
      mockDialogService.confirm.mockResolvedValue(false)
      vi.mocked(useSettingStore).mockReturnValue(mockStore)

      await findCommand('Comfy.BrowseModelAssets').function()

      expect(mockStore.set).not.toHaveBeenCalled()
      expect(mockAssetBrowserBrowse).not.toHaveBeenCalled()
    })

    it('enables asset API before browsing and reports node creation failures', async () => {
      const mockStore = createMockSettingStore(false)
      mockStore.get = vi.fn().mockReturnValue(false)
      mockDialogService.confirm.mockResolvedValue(true)
      mockStartModelNodeDragFromAsset.mockReturnValue(new Error('bad asset'))
      vi.mocked(useSettingStore).mockReturnValue(mockStore)
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await findCommand('Comfy.BrowseModelAssets').function()
      const browseOptions = mockAssetBrowserBrowse.mock.calls[0][0]
      browseOptions.onAssetSelected({})

      expect(mockStore.set).toHaveBeenCalledWith(
        'Comfy.Assets.UseAssetAPI',
        true
      )
      expect(mockWorkflowService.reloadCurrentWorkflow).toHaveBeenCalled()
      expect(mockStartModelNodeDragFromAsset).toHaveBeenCalledWith(
        {},
        'asset_browser'
      )
      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('toggles the asset API setting and reloads the workflow', async () => {
      const mockStore = createMockSettingStore(false)
      mockStore.get = vi.fn().mockReturnValue(true)
      vi.mocked(useSettingStore).mockReturnValue(mockStore)
      const label = findCommand('Comfy.ToggleAssetAPI').label

      if (typeof label !== 'function')
        throw new Error('Expected label function')
      expect(label()).toContain('Disable')
      await findCommand('Comfy.ToggleAssetAPI').function()

      expect(mockStore.set).toHaveBeenCalledWith(
        'Comfy.Assets.UseAssetAPI',
        false
      )
      expect(mockWorkflowService.reloadCurrentWorkflow).toHaveBeenCalled()
    })
  })

  describe('FitView command', () => {
    it('should show error toast when canvas is empty', async () => {
      Object.defineProperty(app.canvas, 'empty', {
        value: true,
        writable: true
      })

      await findCommand('Comfy.Canvas.FitView').function()

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(app.canvas.fitViewToSelectionAnimated).not.toHaveBeenCalled()
    })

    it('should fit view when canvas has content', async () => {
      Object.defineProperty(app.canvas, 'empty', {
        value: false,
        writable: true
      })

      await findCommand('Comfy.Canvas.FitView').function()

      expect(app.canvas.fitViewToSelectionAnimated).toHaveBeenCalled()
    })
  })

  describe('Interrupt command', () => {
    it('should call api.interrupt and show toast', async () => {
      await findCommand('Comfy.Interrupt').function()

      expect(api.interrupt).toHaveBeenCalled()
      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'info' })
      )
    })
  })

  describe('OpenWorkflow command', () => {
    it('should call app.ui.loadFile', async () => {
      await findCommand('Comfy.OpenWorkflow').function()

      expect(app.ui.loadFile).toHaveBeenCalled()
    })
  })

  describe('ToggleTheme command', () => {
    it('should switch from dark to light theme', async () => {
      const mockStore = createMockSettingStore(false)
      vi.mocked(useSettingStore).mockReturnValue(mockStore)

      await findCommand('Comfy.ToggleTheme').function()

      expect(mockStore.set).toHaveBeenCalledWith(
        'Comfy.ColorPalette',
        expect.any(String)
      )
    })

    it('should switch from light to the previous dark theme', async () => {
      const mockStore = createMockSettingStore(false)
      vi.mocked(useSettingStore).mockReturnValue(mockStore)
      mockColorPaletteStore.completedActivePalette = {
        id: 'light-default',
        light_theme: true
      }

      await findCommand('Comfy.ToggleTheme').function()

      expect(mockStore.set).toHaveBeenCalledWith(
        'Comfy.ColorPalette',
        expect.any(String)
      )
    })
  })

  describe('ToggleSelectedNodes commands', () => {
    it('Mute should toggle selected nodes mode and mark dirty', async () => {
      await findCommand('Comfy.Canvas.ToggleSelectedNodes.Mute').function()

      expect(mockSelectedItems.toggleSelectedNodesMode).toHaveBeenCalled()
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Bypass should toggle selected nodes mode and mark dirty', async () => {
      await findCommand('Comfy.Canvas.ToggleSelectedNodes.Bypass').function()

      expect(mockSelectedItems.toggleSelectedNodesMode).toHaveBeenCalled()
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Pin should toggle pin state on each selected node', async () => {
      const mockNode = createMockLGraphNode({ id: 1 })
      Object.defineProperty(mockNode, 'pinned', {
        value: false,
        writable: true
      })
      mockNode.pin = vi.fn()
      mockSelectedItems.getSelectedNodes.mockReturnValue([mockNode])

      await findCommand('Comfy.Canvas.ToggleSelectedNodes.Pin').function()

      expect(mockNode.pin).toHaveBeenCalledWith(true)
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('ToggleSelected.Pin pins selected nodes and groups only', async () => {
      const mockNode = new LGraphNode('MockNode')
      const mockGroup = new LGraphGroup()
      Object.defineProperty(mockNode, 'pinned', {
        value: false
      })
      mockNode.pin = vi.fn()
      Object.assign(mockGroup, {
        pinned: true,
        pin: vi.fn()
      })
      app.canvas.selectedItems = new Set([
        mockNode,
        mockGroup,
        {}
      ]) as typeof app.canvas.selectedItems

      await findCommand('Comfy.Canvas.ToggleSelected.Pin').function()

      expect(mockNode.pin).toHaveBeenCalledWith(true)
      expect(mockGroup.pin).toHaveBeenCalledWith(false)
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Collapse should collapse each selected node', async () => {
      const mockNode = createMockLGraphNode({ id: 1 })
      mockNode.collapse = vi.fn()
      mockSelectedItems.getSelectedNodes.mockReturnValue([mockNode])

      await findCommand('Comfy.Canvas.ToggleSelectedNodes.Collapse').function()

      expect(mockNode.collapse).toHaveBeenCalled()
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Resize should compute and set optimal size', async () => {
      const mockNode = createMockLGraphNode({ id: 1 })
      mockNode.computeSize = vi.fn().mockReturnValue([200, 100])
      mockNode.setSize = vi.fn()
      mockSelectedItems.getSelectedNodes.mockReturnValue([mockNode])

      await findCommand('Comfy.Canvas.Resize').function()

      expect(mockNode.computeSize).toHaveBeenCalled()
      expect(mockNode.setSize).toHaveBeenCalledWith([200, 100])
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })
  })

  describe('Help commands', () => {
    it('OpenComfyUIIssues should open GitHub issues and track telemetry', async () => {
      await findCommand('Comfy.Help.OpenComfyUIIssues').function()

      expect(mockTelemetry.trackHelpResourceClicked).toHaveBeenCalledWith({
        resource_type: 'github',
        is_external: true,
        source: 'menu'
      })
      expect(window.open).toHaveBeenCalledWith(
        'https://github.com/issues',
        '_blank'
      )
    })

    it('OpenComfyUIDocs should open docs and track telemetry', async () => {
      await findCommand('Comfy.Help.OpenComfyUIDocs').function()

      expect(mockTelemetry.trackHelpResourceClicked).toHaveBeenCalledWith({
        resource_type: 'docs',
        is_external: true,
        source: 'menu'
      })
      expect(window.open).toHaveBeenCalledWith(
        'https://docs.test.com',
        '_blank'
      )
    })

    it('OpenComfyOrgDiscord should open Discord and track telemetry', async () => {
      await findCommand('Comfy.Help.OpenComfyOrgDiscord').function()

      expect(mockTelemetry.trackHelpResourceClicked).toHaveBeenCalledWith({
        resource_type: 'discord',
        is_external: true,
        source: 'menu'
      })
      expect(window.open).toHaveBeenCalledWith(
        'https://discord.gg/test',
        '_blank'
      )
    })

    it('OpenComfyUIForum should open forum and track telemetry', async () => {
      await findCommand('Comfy.Help.OpenComfyUIForum').function()

      expect(mockTelemetry.trackHelpResourceClicked).toHaveBeenCalledWith({
        resource_type: 'help_feedback',
        is_external: true,
        source: 'menu'
      })
      expect(window.open).toHaveBeenCalledWith(
        'https://forum.test.com',
        '_blank'
      )
    })
  })

  describe('GroupSelectedNodes command', () => {
    it('should show error toast when nothing selected', async () => {
      app.canvas.selectedItems = new Set()

      await findCommand('Comfy.Graph.GroupSelectedNodes').function()

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('should create group when items are selected', async () => {
      const mockNode = createMockLGraphNode({ id: 1 })
      app.canvas.selectedItems = new Set([
        mockNode
      ]) as typeof app.canvas.selectedItems

      await findCommand('Comfy.Graph.GroupSelectedNodes').function()

      expect(mockLGraphGroupInstance.resizeTo).toHaveBeenCalled()
      expect(app.canvas.graph!.add).toHaveBeenCalled()
    })
  })

  describe('FitGroupToContents command', () => {
    it('resizes selected groups and ignores non-groups', async () => {
      const group = new LGraphGroup()
      Object.assign(group, {
        children: new Set([createMockLGraphNode({ id: 1 })])
      })
      app.canvas.selectedItems = new Set([
        createMockLGraphNode({ id: 2 }),
        group
      ]) as typeof app.canvas.selectedItems

      await findCommand('Comfy.Graph.FitGroupToContents').function()

      expect(mockLGraphGroupInstance.recomputeInsideNodes).toHaveBeenCalled()
      expect(mockLGraphGroupInstance.resizeTo).toHaveBeenCalled()
      expect(app.canvas.setDirty).toHaveBeenCalledWith(false, true)
    })
  })

  describe('ConvertToSubgraph command', () => {
    it('throws when the active canvas has no graph', async () => {
      mockCanvasStore.getCanvas.mockReturnValue({
        selectedItems: new Set(),
        graph: null,
        subgraph: null
      })

      await expect(async () => {
        await findCommand('Comfy.Graph.ConvertToSubgraph').function()
      }).rejects.toThrow('Canvas has no graph or subgraph set.')
    })

    it('should show error toast when conversion fails', async () => {
      app.canvas.graph!.convertToSubgraph = vi.fn().mockReturnValue(null)

      await findCommand('Comfy.Graph.ConvertToSubgraph').function()

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('should select the new subgraph node on success', async () => {
      const mockNode = createMockLGraphNode({ id: 1 })
      app.canvas.graph!.convertToSubgraph = vi
        .fn()
        .mockReturnValue({ node: mockNode })

      await findCommand('Comfy.Graph.ConvertToSubgraph').function()

      expect(app.canvas.select).toHaveBeenCalledWith(mockNode)
      expect(mockCanvasStore.updateSelectedItems).toHaveBeenCalled()
    })
  })

  describe('ContactSupport command', () => {
    it('should open support URL in new window', async () => {
      await findCommand('Comfy.ContactSupport').function()

      expect(window.open).toHaveBeenCalledWith(
        'https://support.test.com',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  describe('Subgraph metadata commands', () => {
    beforeEach(() => {
      mockSubgraph.extra = {}
      vi.clearAllMocks()
    })

    describe('SetDescription command', () => {
      it('should do nothing when not in subgraph', async () => {
        app.canvas.subgraph = undefined

        const commands = useCoreCommands()
        const setDescCommand = commands.find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetDescription'
        )!

        await setDescCommand.function()

        expect(mockDialogService.prompt).not.toHaveBeenCalled()
      })

      it('should set description on subgraph.extra', async () => {
        app.canvas.subgraph = mockSubgraph
        mockDialogService.prompt.mockResolvedValue('Test description')

        const commands = useCoreCommands()
        const setDescCommand = commands.find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetDescription'
        )!

        await setDescCommand.function()

        expect(mockDialogService.prompt).toHaveBeenCalled()
        expect(mockSubgraph.extra.BlueprintDescription).toBe('Test description')
        expect(mockChangeTracker.captureCanvasState).toHaveBeenCalled()
      })

      it('should not set description when user cancels', async () => {
        app.canvas.subgraph = mockSubgraph
        mockDialogService.prompt.mockResolvedValue(null)

        const commands = useCoreCommands()
        const setDescCommand = commands.find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetDescription'
        )!

        await setDescCommand.function()

        expect(mockSubgraph.extra.BlueprintDescription).toBeUndefined()
        expect(mockChangeTracker.captureCanvasState).not.toHaveBeenCalled()
      })

      it('coerces metadata descriptions and removes blank descriptions', async () => {
        app.canvas.subgraph = mockSubgraph
        const setDescCommand = findCommand('Comfy.Subgraph.SetDescription')

        await setDescCommand.function({ description: 123 })
        expect(mockSubgraph.extra.BlueprintDescription).toBe('123')

        await setDescCommand.function({ description: '   ' })
        expect(mockSubgraph.extra.BlueprintDescription).toBeUndefined()
        expect(mockDialogService.prompt).not.toHaveBeenCalled()
      })
    })

    describe('SetSearchAliases command', () => {
      it('should do nothing when not in subgraph', async () => {
        app.canvas.subgraph = undefined

        const commands = useCoreCommands()
        const setAliasesCommand = commands.find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetSearchAliases'
        )!

        await setAliasesCommand.function()

        expect(mockDialogService.prompt).not.toHaveBeenCalled()
      })

      it('should set search aliases on subgraph.extra', async () => {
        app.canvas.subgraph = mockSubgraph
        mockDialogService.prompt.mockResolvedValue('alias1, alias2, alias3')

        const commands = useCoreCommands()
        const setAliasesCommand = commands.find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetSearchAliases'
        )!

        await setAliasesCommand.function()

        expect(mockDialogService.prompt).toHaveBeenCalled()
        expect(mockSubgraph.extra.BlueprintSearchAliases).toEqual([
          'alias1',
          'alias2',
          'alias3'
        ])
        expect(mockChangeTracker.captureCanvasState).toHaveBeenCalled()
      })

      it('should trim whitespace and filter empty strings', async () => {
        app.canvas.subgraph = mockSubgraph
        mockDialogService.prompt.mockResolvedValue('  alias1  ,  , alias2 ,  ')

        const commands = useCoreCommands()
        const setAliasesCommand = commands.find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetSearchAliases'
        )!

        await setAliasesCommand.function()

        expect(mockSubgraph.extra.BlueprintSearchAliases).toEqual([
          'alias1',
          'alias2'
        ])
      })

      it('should set undefined when empty input', async () => {
        app.canvas.subgraph = mockSubgraph
        mockDialogService.prompt.mockResolvedValue('')

        const commands = useCoreCommands()
        const setAliasesCommand = commands.find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetSearchAliases'
        )!

        await setAliasesCommand.function()

        expect(mockSubgraph.extra.BlueprintSearchAliases).toBeUndefined()
      })

      it('should not set aliases when user cancels', async () => {
        app.canvas.subgraph = mockSubgraph
        mockDialogService.prompt.mockResolvedValue(null)

        const commands = useCoreCommands()
        const setAliasesCommand = commands.find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetSearchAliases'
        )!

        await setAliasesCommand.function()

        expect(mockSubgraph.extra.BlueprintSearchAliases).toBeUndefined()
        expect(mockChangeTracker.captureCanvasState).not.toHaveBeenCalled()
      })

      it('accepts alias metadata arrays without prompting', async () => {
        app.canvas.subgraph = mockSubgraph

        await findCommand('Comfy.Subgraph.SetSearchAliases').function({
          aliases: [' portrait ', 7, '', 'landscape']
        })

        expect(mockDialogService.prompt).not.toHaveBeenCalled()
        expect(mockSubgraph.extra.BlueprintSearchAliases).toEqual([
          'portrait',
          '7',
          'landscape'
        ])
      })
    })
  })

  describe('Manager commands', () => {
    it('shows an error when manager update checks are disabled', async () => {
      mockManagerState.managerUIState.value = 'disabled'

      await findCommand('Comfy.Manager.ShowUpdateAvailablePacks').function()

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(mockManagerState.openManager).not.toHaveBeenCalled()
    })

    it('opens the update-available manager tab when enabled', async () => {
      await findCommand('Comfy.Manager.ShowUpdateAvailablePacks').function()

      expect(mockManagerState.openManager).toHaveBeenCalledWith(
        expect.objectContaining({
          initialTab: expect.any(String),
          showToastOnLegacyError: false
        })
      )
    })
  })

  describe('Canvas view commands', () => {
    it('Comfy.Canvas.ResetView delegates to litegraphService.resetView', async () => {
      await findCommand('Comfy.Canvas.ResetView').function()

      expect(mockResetView).toHaveBeenCalled()
    })

    it('Comfy.Canvas.ZoomIn scales the canvas up by 1.1× and marks it dirty', async () => {
      app.canvas.ds.scale = 1
      await findCommand('Comfy.Canvas.ZoomIn').function()

      expect(app.canvas.ds.changeScale).toHaveBeenCalledWith(
        1.1,
        expect.any(Array)
      )
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Comfy.Canvas.ZoomOut scales the canvas down by 1/1.1× and marks it dirty', async () => {
      app.canvas.ds.scale = 1
      await findCommand('Comfy.Canvas.ZoomOut').function()

      expect(app.canvas.ds.changeScale).toHaveBeenCalledWith(
        1 / 1.1,
        expect.any(Array)
      )
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Zoom commands handle a missing backing canvas element', async () => {
      const ds = app.canvas.ds as { element?: HTMLCanvasElement }
      ds.element = undefined

      await findCommand('Comfy.Canvas.ZoomIn').function()
      await findCommand('Comfy.Canvas.ZoomOut').function()

      expect(app.canvas.ds.changeScale).toHaveBeenNthCalledWith(
        1,
        1.1,
        undefined
      )
      expect(app.canvas.ds.changeScale).toHaveBeenNthCalledWith(
        2,
        1 / 1.1,
        undefined
      )
    })
  })

  describe('Workflow lifecycle commands', () => {
    it('Comfy.OpenClipspace delegates to app.openClipspace', async () => {
      await findCommand('Comfy.OpenClipspace').function()

      expect(app.openClipspace).toHaveBeenCalled()
    })

    it('Comfy.RefreshNodeDefinitions awaits app.refreshComboInNodes', async () => {
      await findCommand('Comfy.RefreshNodeDefinitions').function()

      expect(app.refreshComboInNodes).toHaveBeenCalled()
    })

    it('creates blank and default workflows with telemetry', async () => {
      app.rootGraph._nodes = [createMockLGraphNode({ id: 1 })]

      await findCommand('Comfy.NewBlankWorkflow').function()
      await findCommand('Comfy.LoadDefaultWorkflow').function()

      expect(mockWorkflowService.loadBlankWorkflow).toHaveBeenCalled()
      expect(mockWorkflowService.loadDefaultWorkflow).toHaveBeenCalled()
      expect(mockTelemetry.trackWorkflowCreated).toHaveBeenCalledWith({
        workflow_type: 'blank',
        previous_workflow_had_nodes: true
      })
      expect(mockTelemetry.trackWorkflowCreated).toHaveBeenCalledWith({
        workflow_type: 'default',
        previous_workflow_had_nodes: true
      })
    })

    it('saves the active workflow through save and save-as commands', async () => {
      await findCommand('Comfy.SaveWorkflow').function()
      await findCommand('Comfy.SaveWorkflowAs').function()

      expect(mockWorkflowService.saveWorkflow).toHaveBeenCalledWith(
        mockWorkflowStore.activeWorkflow
      )
      expect(mockWorkflowService.saveWorkflowAs).toHaveBeenCalledWith(
        mockWorkflowStore.activeWorkflow
      )
    })

    it('does nothing when save commands have no active workflow', async () => {
      mockWorkflowStore.activeWorkflow = null

      await findCommand('Comfy.SaveWorkflow').function()
      await findCommand('Comfy.SaveWorkflowAs').function()

      expect(mockWorkflowService.saveWorkflow).not.toHaveBeenCalled()
      expect(mockWorkflowService.saveWorkflowAs).not.toHaveBeenCalled()
    })

    it('renames persisted workflows when the user provides a new name', async () => {
      mockDialogService.prompt.mockResolvedValue('renamed')

      await findCommand('Comfy.RenameWorkflow').function()

      expect(mockWorkflowService.renameWorkflow).toHaveBeenCalledWith(
        mockWorkflowStore.activeWorkflow,
        '/workflows/renamed.json'
      )
    })

    it('does not rename missing, unpersisted, canceled, or unchanged workflows', async () => {
      mockWorkflowStore.activeWorkflow = null
      await findCommand('Comfy.RenameWorkflow').function()
      mockWorkflowStore.activeWorkflow = {
        changeTracker: mockChangeTracker,
        directory: '/workflows',
        filename: 'old.json',
        isPersisted: false,
        suffix: 'json'
      }
      await findCommand('Comfy.RenameWorkflow').function()
      mockWorkflowStore.activeWorkflow!.isPersisted = true
      mockDialogService.prompt.mockResolvedValueOnce(null)
      await findCommand('Comfy.RenameWorkflow').function()
      mockDialogService.prompt.mockResolvedValueOnce('old.json')
      await findCommand('Comfy.RenameWorkflow').function()

      expect(mockWorkflowService.renameWorkflow).not.toHaveBeenCalled()
    })

    it('publishes subgraphs and passes metadata name when supplied', async () => {
      await findCommand('Comfy.PublishSubgraph').function({ name: 'Reusable' })
      await findCommand('Comfy.PublishSubgraph').function()

      expect(mockSubgraphStore.publishSubgraph).toHaveBeenCalledWith('Reusable')
      expect(mockSubgraphStore.publishSubgraph).toHaveBeenCalledWith(undefined)
    })

    it('exports workflow formats and navigates open workflows', async () => {
      await findCommand('Comfy.ExportWorkflow').function()
      await findCommand('Comfy.ExportWorkflowAPI').function()
      await findCommand('Workspace.NextOpenedWorkflow').function()
      await findCommand('Workspace.PreviousOpenedWorkflow').function()

      expect(mockWorkflowService.exportWorkflow).toHaveBeenCalledWith(
        'workflow',
        'workflow'
      )
      expect(mockWorkflowService.exportWorkflow).toHaveBeenCalledWith(
        'workflow_api',
        'output'
      )
      expect(mockWorkflowService.loadNextOpenedWorkflow).toHaveBeenCalled()
      expect(mockWorkflowService.loadPreviousOpenedWorkflow).toHaveBeenCalled()
    })

    it('duplicates and closes active workflows', async () => {
      await findCommand('Comfy.DuplicateWorkflow').function()
      await findCommand('Workspace.CloseWorkflow').function()

      expect(mockWorkflowService.duplicateWorkflow).toHaveBeenCalledWith(
        mockWorkflowStore.activeWorkflow
      )
      expect(mockWorkflowService.closeWorkflow).toHaveBeenCalledWith(
        mockWorkflowStore.activeWorkflow
      )
    })

    it('does not close when there is no active workflow', async () => {
      mockWorkflowStore.activeWorkflow = null

      await findCommand('Workspace.CloseWorkflow').function()

      expect(mockWorkflowService.closeWorkflow).not.toHaveBeenCalled()
    })
  })

  describe('AboutComfyUI command', () => {
    it('should open the About dialog', async () => {
      await findCommand('Comfy.Help.AboutComfyUI').function()

      expect(mockShowAbout).toHaveBeenCalled()
    })
  })
})
