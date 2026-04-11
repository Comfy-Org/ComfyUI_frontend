import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useCoreCommands } from '@/composables/useCoreCommands'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
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
  const mockCanvas = {
    subgraph: undefined,
    selectedItems: new Set(),
    selected_nodes: null as Record<string, unknown> | null,
    copyToClipboard: vi.fn(),
    pasteFromClipboard: vi.fn(),
    selectItems: vi.fn(),
    deleteSelected: vi.fn(),
    setDirty: vi.fn(),
    fitViewToSelectionAnimated: vi.fn(),
    empty: false,
    ds: {
      scale: 1,
      element: { width: 800, height: 600 },
      changeScale: vi.fn()
    },
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
      canvas: mockCanvas,
      rootGraph: {
        clear: mockGraphClear,
        _nodes: []
      },
      queuePrompt: vi.fn(),
      refreshComboInNodes: vi.fn(),
      openClipspace: vi.fn(),
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

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: vi.fn(() => ({}))
}))

const mockDialogService = vi.hoisted(() => ({
  prompt: vi.fn()
}))
vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => mockDialogService)
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: vi.fn(() => ({}))
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
  checkState: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn()
}))
const mockWorkflowStore = vi.hoisted(() => ({
  activeWorkflow: {
    changeTracker: mockChangeTracker
  }
}))
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => mockWorkflowStore)
}))

vi.mock('@/stores/subgraphStore', () => ({
  useSubgraphStore: vi.fn(() => ({}))
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

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: vi.fn(() => ({
    completedActivePalette: { id: 'dark-default', light_theme: false }
  }))
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

vi.mock('@/platform/assets/composables/useAssetBrowserDialog', () => ({
  useAssetBrowserDialog: vi.fn(() => ({
    browse: vi.fn()
  }))
}))

vi.mock('@/platform/assets/utils/createModelNodeFromAsset', () => ({
  createModelNodeFromAsset: vi.fn()
}))

vi.mock('@/platform/support/config', () => ({
  buildSupportUrl: vi.fn(() => 'https://support.test.com')
}))

const mockTelemetry = vi.hoisted(() => ({
  trackWorkflowCreated: vi.fn(),
  trackRunButton: vi.fn(),
  trackWorkflowExecution: vi.fn(),
  trackHelpResourceClicked: vi.fn(),
  trackEnterLinear: vi.fn()
}))
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => mockTelemetry)
}))

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: vi.fn(() => ({
    show: vi.fn(),
    showAbout: vi.fn()
  }))
}))

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
    return useCoreCommands().find((cmd) => cmd.id === id)!
  }

  beforeEach(() => {
    vi.clearAllMocks()

    setActivePinia(createPinia())

    app.canvas.subgraph = undefined
    app.canvas.selectedItems = new Set()
    app.canvas.state.readOnly = false
    app.canvas.state.selectionChanged = false
    Object.defineProperty(app.canvas, 'empty', { value: false, writable: true })
    mockCanvasStore.linearMode = false
    mockCanvasStore.getCanvas.mockReturnValue(app.canvas)
    mockIsActiveSubscription.value = true

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
      await findCommand(
        'Comfy.Canvas.PasteFromClipboardWithConnect'
      ).function()

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

  describe('Zoom commands', () => {
    it('ZoomIn should increase scale and mark dirty', async () => {
      await findCommand('Comfy.Canvas.ZoomIn').function()

      expect(app.canvas.ds.changeScale).toHaveBeenCalled()
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('ZoomOut should decrease scale and mark dirty', async () => {
      await findCommand('Comfy.Canvas.ZoomOut').function()

      expect(app.canvas.ds.changeScale).toHaveBeenCalled()
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

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
      app.canvas.selectedItems = new Set([{}]) as typeof app.canvas.selectedItems

      await findCommand('Comfy.Canvas.DeleteSelectedItems').function()

      expect(app.canvas.deleteSelected).toHaveBeenCalled()
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('should dispatch no-items-selected event when nothing selected', async () => {
      app.canvas.selectedItems = new Set()

      await findCommand('Comfy.Canvas.DeleteSelectedItems').function()

      expect(app.canvas.canvas.dispatchEvent).toHaveBeenCalled()
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

      expect(mockStore.set).toHaveBeenCalledWith(
        'Comfy.LinkRenderMode',
        expect.any(Number)
      )
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
  })

  describe('QueueSelectedOutputNodes command', () => {
    it('should show error toast when no output nodes selected', async () => {
      await findCommand('Comfy.QueueSelectedOutputNodes').function()

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
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

      await findCommand(
        'Comfy.Memory.UnloadModelsAndExecutionCache'
      ).function()

      expect(api.freeMemory).toHaveBeenCalledWith({
        freeExecutionCache: true
      })
    })
  })

  describe('FitView command', () => {
    it('should show error toast when canvas is empty', async () => {
      Object.defineProperty(app.canvas, 'empty', { value: true, writable: true })

      await findCommand('Comfy.Canvas.FitView').function()

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(app.canvas.fitViewToSelectionAnimated).not.toHaveBeenCalled()
    })

    it('should fit view when canvas has content', async () => {
      Object.defineProperty(app.canvas, 'empty', { value: false, writable: true })

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

  describe('RefreshNodeDefinitions command', () => {
    it('should call app.refreshComboInNodes', async () => {
      await findCommand('Comfy.RefreshNodeDefinitions').function()

      expect(app.refreshComboInNodes).toHaveBeenCalled()
    })
  })

  describe('OpenClipspace command', () => {
    it('should call app.openClipspace', async () => {
      await findCommand('Comfy.OpenClipspace').function()

      expect(app.openClipspace).toHaveBeenCalled()
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
  })

  describe('ToggleSelectedNodes commands', () => {
    it('Mute should toggle selected nodes mode and mark dirty', async () => {
      await findCommand(
        'Comfy.Canvas.ToggleSelectedNodes.Mute'
      ).function()

      expect(mockSelectedItems.toggleSelectedNodesMode).toHaveBeenCalled()
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Bypass should toggle selected nodes mode and mark dirty', async () => {
      await findCommand(
        'Comfy.Canvas.ToggleSelectedNodes.Bypass'
      ).function()

      expect(mockSelectedItems.toggleSelectedNodesMode).toHaveBeenCalled()
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Pin should toggle pin state on each selected node', async () => {
      const mockNode = createMockLGraphNode({ id: 1 })
      Object.defineProperty(mockNode, 'pinned', { value: false, writable: true })
      mockNode.pin = vi.fn()
      mockSelectedItems.getSelectedNodes.mockReturnValue([mockNode])

      await findCommand(
        'Comfy.Canvas.ToggleSelectedNodes.Pin'
      ).function()

      expect(mockNode.pin).toHaveBeenCalledWith(true)
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Collapse should collapse each selected node', async () => {
      const mockNode = createMockLGraphNode({ id: 1 })
      mockNode.collapse = vi.fn()
      mockSelectedItems.getSelectedNodes.mockReturnValue([mockNode])

      await findCommand(
        'Comfy.Canvas.ToggleSelectedNodes.Collapse'
      ).function()

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
  })

  describe('ConvertToSubgraph command', () => {
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
        expect(mockChangeTracker.checkState).toHaveBeenCalled()
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
        expect(mockChangeTracker.checkState).not.toHaveBeenCalled()
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
        expect(mockChangeTracker.checkState).toHaveBeenCalled()
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
        expect(mockChangeTracker.checkState).not.toHaveBeenCalled()
      })
    })
  })
})
