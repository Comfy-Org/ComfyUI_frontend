import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useCoreCommands } from '@/composables/useCoreCommands'
import { useExternalLink } from '@/composables/useExternalLink'
import {
  LGraphEventMode,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type * as DistributionModule from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type * as ModelStoreModule from '@/stores/modelStore'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { fromPartial } from '@total-typescript/shoehorn'

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
    copyToClipboard: vi.fn(),
    pasteFromClipboard: vi.fn(),
    selectItems: vi.fn(),
    deleteSelected: vi.fn(),
    selectOnly: false,
    canvas: { dispatchEvent: vi.fn() },
    read_only: false,
    ds: mockDs,
    state: { selectionChanged: false },
    graph: undefined,
    setDirty: vi.fn()
  }

  return {
    app: {
      clean: vi.fn(() => {
        // Simulate app.clean() calling graph.clear() only when not in subgraph
        if (!mockCanvas.subgraph) {
          mockGraphClear()
        }
      }),
      openClipspace: vi.fn(),
      queuePrompt: vi.fn().mockResolvedValue(true),
      refreshComboInNodes: vi.fn().mockResolvedValue(undefined),
      canvas: mockCanvas,
      rootGraph: {
        clear: mockGraphClear
      }
    }
  }
})

vi.mock('@/scripts/api', () => ({
  api: {
    dispatchCustomEvent: vi.fn(),
    apiURL: vi.fn(() => 'http://localhost:8188')
  }
}))

const mockModelStoreRefresh = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/modelStore', async (importOriginal) => {
  const actual = await importOriginal<typeof ModelStoreModule>()
  return {
    ...actual,
    useModelStore: () => ({ refresh: mockModelStoreRefresh })
  }
})

const mockDistributionState = vi.hoisted(() => ({ isCloud: false }))
vi.mock('@/platform/distribution/types', async (importOriginal) => ({
  ...(await importOriginal<typeof DistributionModule>()),
  get isCloud() {
    return mockDistributionState.isCloud
  }
}))

const mockMissingModelStoreRefresh = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)
vi.mock('@/platform/missingModel/missingModelStore', () => ({
  useMissingModelStore: () => ({
    refreshMissingModels: mockMissingModelStoreRefresh
  })
}))

vi.mock('@/platform/settings/settingStore')

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({}))
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

const mockResetView = vi.hoisted(() => vi.fn())
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: vi.fn(() => ({
    resetView: mockResetView
  }))
}))

const mockTrackHelpResourceClicked = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackHelpResourceClicked: mockTrackHelpResourceClicked,
    trackRunButton: vi.fn(),
    trackWorkflowExecution: vi.fn()
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

const mockToastAdd = vi.hoisted(() => vi.fn())
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn(() => ({ add: mockToastAdd }))
}))

const mockAssetBrowse = vi.hoisted(() =>
  vi.fn<(options: { onAssetSelected?: (asset: AssetItem) => void }) => void>()
)
vi.mock('@/platform/assets/composables/useAssetBrowserDialog', () => ({
  useAssetBrowserDialog: vi.fn(() => ({ browse: mockAssetBrowse }))
}))

const mockStartModelNodeDrag = vi.hoisted(() => vi.fn())
vi.mock('@/composables/node/startModelNodeDragFromAsset', () => ({
  startModelNodeDragFromAsset: mockStartModelNodeDrag
}))

const mockTryToggleWidgetPromotion = vi.hoisted(() => vi.fn())
vi.mock('@/core/graph/subgraph/promotionUtils', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  tryToggleWidgetPromotion: mockTryToggleWidgetPromotion
}))

const mockToggleSearchBox = vi.hoisted(() => vi.fn())
vi.mock('@/stores/workspace/searchBoxStore', () => ({
  useSearchBoxStore: () => ({ toggleVisible: mockToggleSearchBox })
}))

const mockOpenRightSidePanel = vi.hoisted(() => vi.fn())
vi.mock('@/stores/workspace/rightSidePanelStore', () => ({
  useRightSidePanelStore: () => ({ openPanel: mockOpenRightSidePanel })
}))

const mockUnpackSubgraph = vi.hoisted(() => vi.fn())
vi.mock(
  '@/composables/graph/useSubgraphOperations',
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useSubgraphOperations: () => ({ unpackSubgraph: mockUnpackSubgraph })
  })
)

const mockChangeTracker = vi.hoisted(() => ({
  captureCanvasState: vi.fn()
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

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: vi.fn(() => ({
    getCanvas: () => app.canvas,
    canvas: app.canvas
  })),
  useTitleEditorStore: vi.fn(() => ({
    titleEditorTarget: null
  }))
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: vi.fn(() => ({}))
}))

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: vi.fn(() => ({}))
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: vi.fn(() => ({
    canAccessSubscriptionFeatures: vi.fn().mockReturnValue(true),
    showSubscriptionDialog: vi.fn()
  }))
}))

const mockBillingState = vi.hoisted(() => ({
  canAccessSubscriptionFeatures: true,
  subscriptionTier: null as string | null,
  showSubscriptionDialog: vi.fn()
}))
vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: vi.fn(() => ({
    canAccessSubscriptionFeatures: {
      get value() {
        return mockBillingState.canAccessSubscriptionFeatures
      }
    },
    subscription: {
      get value() {
        return mockBillingState.subscriptionTier
          ? { tier: mockBillingState.subscriptionTier }
          : null
      }
    },
    showSubscriptionDialog: mockBillingState.showSubscriptionDialog
  }))
}))

vi.mock('@/stores/queueSettingsStore', () => ({
  useQueueSettingsStore: vi.fn(() => ({ batchCount: 1 }))
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
      // Mock input node
      createMockNode(1, 'SubgraphInputNode'),
      // Mock output node
      createMockNode(2, 'SubgraphOutputNode'),
      // Mock user node
      createMockNode(3, 'SomeUserNode'),
      // Another mock user node
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
    return fromPartial<ReturnType<typeof useSettingStore>>({
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
    })
  }

  beforeEach(() => {
    mockDistributionState.isCloud = false
    mockBillingState.canAccessSubscriptionFeatures = true
    mockBillingState.subscriptionTier = null
    vi.mocked(app.refreshComboInNodes).mockResolvedValue(undefined)
    mockModelStoreRefresh.mockResolvedValue(undefined)
    mockMissingModelStoreRefresh.mockResolvedValue(undefined)

    // Reset app state
    app.canvas.subgraph = undefined

    // Mock settings store
    vi.mocked(useSettingStore).mockReturnValue(createMockSettingStore(false))

    // Mock global confirm
    global.confirm = vi.fn().mockReturnValue(true)
  })

  describe('ClearWorkflow command', () => {
    beforeEach(() => {
      app.canvas.selectOnly = false
    })

    it('does not clear in selection-only mode', async () => {
      app.canvas.selectOnly = true

      const commands = useCoreCommands()
      const clearCommand = commands.find(
        (cmd) => cmd.id === 'Comfy.ClearWorkflow'
      )!
      await clearCommand.function()

      expect(app.clean).not.toHaveBeenCalled()
      expect(app.rootGraph.clear).not.toHaveBeenCalled()
      expect(api.dispatchCustomEvent).not.toHaveBeenCalled()
    })

    it('should clear main graph when not in subgraph', async () => {
      const commands = useCoreCommands()
      const clearCommand = commands.find(
        (cmd) => cmd.id === 'Comfy.ClearWorkflow'
      )!

      // Execute the command
      await clearCommand.function()

      expect(app.clean).toHaveBeenCalled()
      expect(app.rootGraph.clear).toHaveBeenCalled()
      expect(api.dispatchCustomEvent).toHaveBeenCalledWith('graphCleared')
    })

    it('should preserve input/output nodes when clearing subgraph', async () => {
      // Set up subgraph context
      app.canvas.subgraph = mockSubgraph

      const commands = useCoreCommands()
      const clearCommand = commands.find(
        (cmd) => cmd.id === 'Comfy.ClearWorkflow'
      )!

      // Execute the command
      await clearCommand.function()

      expect(app.clean).toHaveBeenCalled()
      expect(app.rootGraph.clear).not.toHaveBeenCalled()

      // Should only remove user nodes, not input/output nodes
      const subgraph = app.canvas.subgraph!
      expect(subgraph.remove).toHaveBeenCalledTimes(2)
      expect(subgraph.remove).toHaveBeenCalledWith(subgraph.nodes[2]) // user1
      expect(subgraph.remove).toHaveBeenCalledWith(subgraph.nodes[3]) // user2
      expect(subgraph.remove).not.toHaveBeenCalledWith(subgraph.nodes[0]) // input1
      expect(subgraph.remove).not.toHaveBeenCalledWith(subgraph.nodes[1]) // output1

      expect(api.dispatchCustomEvent).toHaveBeenCalledWith('graphCleared')
    })

    it('should respect confirmation setting', async () => {
      // Mock confirmation required
      vi.mocked(useSettingStore).mockReturnValue(createMockSettingStore(true))

      global.confirm = vi.fn().mockReturnValue(false) // User cancels

      const commands = useCoreCommands()
      const clearCommand = commands.find(
        (cmd) => cmd.id === 'Comfy.ClearWorkflow'
      )!

      // Execute the command
      await clearCommand.function()

      // Should not clear anything when user cancels
      expect(app.clean).not.toHaveBeenCalled()
      expect(app.rootGraph.clear).not.toHaveBeenCalled()
      expect(api.dispatchCustomEvent).not.toHaveBeenCalled()
    })
  })

  describe('Canvas clipboard commands', () => {
    function findCommand(id: string) {
      return useCoreCommands().find((cmd) => cmd.id === id)!
    }

    beforeEach(() => {
      app.canvas.selectedItems = new Set()
      app.canvas.selectOnly = false
      Reflect.set(app.canvas, 'graph', undefined)
    })

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

    it.for([
      'Comfy.Canvas.PasteFromClipboard',
      'Comfy.Canvas.PasteFromClipboardWithConnect'
    ])('should not run %s in selection-only mode', async (commandId) => {
      app.canvas.selectOnly = true

      await findCommand(commandId).function()

      expect(app.canvas.pasteFromClipboard).not.toHaveBeenCalled()
    })

    it('should select all items', async () => {
      await findCommand('Comfy.Canvas.SelectAll').function()

      // No arguments means "select all items on canvas"
      expect(app.canvas.selectItems).toHaveBeenCalledWith()
    })

    it('should delete selected items outside selection-only mode', async () => {
      app.canvas.selectedItems = new Set([
        {}
      ]) as typeof app.canvas.selectedItems

      await findCommand('Comfy.Canvas.DeleteSelectedItems').function()

      expect(app.canvas.deleteSelected).toHaveBeenCalledOnce()
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('should preserve selected items in selection-only mode', async () => {
      const selectedItem = {}
      app.canvas.selectedItems = new Set([
        selectedItem
      ]) as typeof app.canvas.selectedItems
      app.canvas.selectOnly = true

      await findCommand('Comfy.Canvas.DeleteSelectedItems').function()

      expect(app.canvas.deleteSelected).not.toHaveBeenCalled()
      expect(app.canvas.setDirty).not.toHaveBeenCalled()
      expect([...app.canvas.selectedItems]).toEqual([selectedItem])
    })

    it.for([
      'Comfy.Canvas.ToggleSelectedNodes.Pin',
      'Comfy.Canvas.ToggleSelected.Pin',
      'Comfy.Canvas.ToggleSelectedNodes.Mute',
      'Comfy.Canvas.ToggleSelectedNodes.Bypass',
      'Comfy.Canvas.Resize',
      'Comfy.Canvas.ToggleSelectedNodes.Collapse'
    ])('should not run %s in selection-only mode', async (commandId) => {
      app.canvas.selectOnly = true

      await findCommand(commandId).function()

      expect(app.canvas.setDirty).not.toHaveBeenCalled()
    })

    it.for([
      'Comfy.Canvas.ToggleSelectedNodes.Pin',
      'Comfy.Canvas.ToggleSelected.Pin',
      'Comfy.Canvas.Resize',
      'Comfy.Canvas.ToggleSelectedNodes.Collapse'
    ])('runs %s outside selection-only mode', async (commandId) => {
      await findCommand(commandId).function()

      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it.for([
      ['Comfy.Canvas.ToggleSelectedNodes.Mute', LGraphEventMode.NEVER],
      ['Comfy.Canvas.ToggleSelectedNodes.Bypass', LGraphEventMode.BYPASS]
    ] as const)(
      'flips the node mode via %s outside selection-only mode',
      async ([commandId, mode]) => {
        const node = new LGraphNode('node')
        node.mode = LGraphEventMode.ALWAYS
        app.canvas.selectedItems = new Set([
          node
        ]) as typeof app.canvas.selectedItems

        await findCommand(commandId).function()

        expect(node.mode).toBe(mode)
      }
    )

    it.for([
      'Comfy.Canvas.ToggleSelectedNodes.Mute',
      'Comfy.Canvas.ToggleSelectedNodes.Bypass'
    ])(
      'preserves the node mode under %s in selection-only mode',
      async (commandId) => {
        const node = new LGraphNode('node')
        node.mode = LGraphEventMode.ALWAYS
        app.canvas.selectedItems = new Set([
          node
        ]) as typeof app.canvas.selectedItems
        app.canvas.selectOnly = true

        await findCommand(commandId).function()

        expect(node.mode).toBe(LGraphEventMode.ALWAYS)
      }
    )

    it('does not group selected nodes in selection-only mode', async () => {
      app.canvas.selectOnly = true

      await findCommand('Comfy.Graph.GroupSelectedNodes').function()

      // The guard returns before the body; even the empty-selection toast
      // (the body's first observable) never fires.
      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('runs the group command body outside selection-only mode', async () => {
      await findCommand('Comfy.Graph.GroupSelectedNodes').function()

      expect(mockToastAdd).toHaveBeenCalled()
    })

    it('does not convert to subgraph in selection-only mode', async () => {
      const convertToSubgraph = vi.fn(() => null)
      Reflect.set(app.canvas, 'graph', { convertToSubgraph })
      app.canvas.selectOnly = true

      await findCommand('Comfy.Graph.ConvertToSubgraph').function()

      expect(convertToSubgraph).not.toHaveBeenCalled()
    })

    it('converts to subgraph outside selection-only mode', async () => {
      const convertToSubgraph = vi.fn(() => null)
      Reflect.set(app.canvas, 'graph', { convertToSubgraph })

      await findCommand('Comfy.Graph.ConvertToSubgraph').function()

      expect(convertToSubgraph).toHaveBeenCalledOnce()
    })

    it('does not unpack a subgraph in selection-only mode', async () => {
      app.canvas.selectOnly = true

      await findCommand('Comfy.Graph.UnpackSubgraph').function()

      expect(mockUnpackSubgraph).not.toHaveBeenCalled()
    })

    it('unpacks a subgraph outside selection-only mode', async () => {
      await findCommand('Comfy.Graph.UnpackSubgraph').function()

      expect(mockUnpackSubgraph).toHaveBeenCalledOnce()
    })

    it('does not open the search box in selection-only mode', async () => {
      app.canvas.selectOnly = true

      await findCommand('Workspace.SearchBox.Toggle').function()

      expect(mockToggleSearchBox).not.toHaveBeenCalled()
    })

    it('toggles the search box outside selection-only mode', async () => {
      await findCommand('Workspace.SearchBox.Toggle').function()

      expect(mockToggleSearchBox).toHaveBeenCalledOnce()
    })

    it('does not toggle widget promotion in selection-only mode', async () => {
      app.canvas.selectOnly = true

      await findCommand('Comfy.Graph.ToggleWidgetPromotion').function()

      expect(mockTryToggleWidgetPromotion).not.toHaveBeenCalled()
    })

    it('toggles widget promotion outside selection-only mode', async () => {
      await findCommand('Comfy.Graph.ToggleWidgetPromotion').function()

      expect(mockTryToggleWidgetPromotion).toHaveBeenCalledOnce()
    })

    it('does not open subgraph widget editing in selection-only mode', async () => {
      app.canvas.selectOnly = true

      await findCommand('Comfy.Graph.EditSubgraphWidgets').function()

      expect(mockOpenRightSidePanel).not.toHaveBeenCalled()
    })

    it('does not fit groups to contents in selection-only mode', async () => {
      const group = new LGraphGroup('Group')
      app.canvas.selectedItems = new Set([
        group
      ]) as typeof app.canvas.selectedItems
      app.canvas.selectOnly = true

      await findCommand('Comfy.Graph.FitGroupToContents').function()

      expect(app.canvas.setDirty).not.toHaveBeenCalled()
    })

    it('fits groups to contents outside selection-only mode', async () => {
      const group = new LGraphGroup('Group')
      vi.spyOn(group, 'recomputeInsideNodes').mockImplementation(() => {})
      vi.spyOn(group, 'resizeTo').mockImplementation(() => {})
      app.canvas.selectedItems = new Set([
        group
      ]) as typeof app.canvas.selectedItems

      await findCommand('Comfy.Graph.FitGroupToContents').function()

      expect(app.canvas.setDirty).toHaveBeenCalledWith(false, true)
    })

    it('does not move selected nodes in selection-only mode', async () => {
      vi.mocked(useSettingStore).mockReturnValue(
        fromPartial<ReturnType<typeof useSettingStore>>({
          get: vi.fn().mockReturnValue(10)
        })
      )
      const node = new LGraphNode('node')
      node.pos = [100, 200]
      app.canvas.selectedItems = new Set([
        node
      ]) as typeof app.canvas.selectedItems
      app.canvas.selectOnly = true

      await findCommand('Comfy.Canvas.MoveSelectedNodes.Up').function()

      expect([...node.pos]).toEqual([100, 200])
    })

    it('moves selected nodes outside selection-only mode', async () => {
      vi.mocked(useSettingStore).mockReturnValue(
        fromPartial<ReturnType<typeof useSettingStore>>({
          get: vi.fn().mockReturnValue(10)
        })
      )
      const node = new LGraphNode('node')
      node.pos = [100, 200]
      app.canvas.selectedItems = new Set([
        node
      ]) as typeof app.canvas.selectedItems

      await findCommand('Comfy.Canvas.MoveSelectedNodes.Up').function()

      expect([...node.pos]).toEqual([100, 190])
    })
  })

  describe('Subgraph metadata commands', () => {
    beforeEach(() => {
      mockSubgraph.extra = {}
      app.canvas.selectOnly = false
    })

    it.for([
      'Comfy.Subgraph.SetDescription',
      'Comfy.Subgraph.SetSearchAliases'
    ])(
      'does not edit subgraph metadata via %s in selection-only mode',
      async (commandId) => {
        app.canvas.subgraph = mockSubgraph
        app.canvas.selectOnly = true
        const command = useCoreCommands().find((cmd) => cmd.id === commandId)!

        await command.function()

        expect(mockDialogService.prompt).not.toHaveBeenCalled()
        expect(mockChangeTracker.captureCanvasState).not.toHaveBeenCalled()
        expect(mockSubgraph.extra).toEqual({})
      }
    )

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

      it('does not set a description when picking starts during the prompt', async () => {
        app.canvas.subgraph = mockSubgraph
        let finishPrompt: (value: string) => void = () => {}
        mockDialogService.prompt.mockReturnValue(
          new Promise((resolve) => {
            finishPrompt = resolve
          })
        )
        const command = useCoreCommands().find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetDescription'
        )!

        const pending = command.function()
        app.canvas.selectOnly = true
        finishPrompt('Test description')
        await pending

        expect(mockSubgraph.extra.BlueprintDescription).toBeUndefined()
        expect(mockChangeTracker.captureCanvasState).not.toHaveBeenCalled()
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

      it('does not set aliases when picking starts during the prompt', async () => {
        app.canvas.subgraph = mockSubgraph
        let finishPrompt: (value: string) => void = () => {}
        mockDialogService.prompt.mockReturnValue(
          new Promise((resolve) => {
            finishPrompt = resolve
          })
        )
        const command = useCoreCommands().find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetSearchAliases'
        )!

        const pending = command.function()
        app.canvas.selectOnly = true
        finishPrompt('alias')
        await pending

        expect(mockSubgraph.extra.BlueprintSearchAliases).toBeUndefined()
        expect(mockChangeTracker.captureCanvasState).not.toHaveBeenCalled()
      })
    })
  })

  describe('Canvas view commands', () => {
    const findCmd = (id: string) =>
      useCoreCommands().find((cmd) => cmd.id === id)!

    it('Comfy.Canvas.ResetView delegates to litegraphService.resetView', async () => {
      await findCmd('Comfy.Canvas.ResetView').function()

      expect(mockResetView).toHaveBeenCalled()
    })

    it('Comfy.Canvas.ZoomIn scales the canvas up by 1.1× and marks it dirty', async () => {
      app.canvas.ds.scale = 1
      await findCmd('Comfy.Canvas.ZoomIn').function()

      expect(app.canvas.ds.changeScale).toHaveBeenCalledWith(
        1.1,
        expect.any(Array)
      )
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Comfy.Canvas.ZoomOut scales the canvas down by 1/1.1× and marks it dirty', async () => {
      app.canvas.ds.scale = 1
      await findCmd('Comfy.Canvas.ZoomOut').function()

      expect(app.canvas.ds.changeScale).toHaveBeenCalledWith(
        1 / 1.1,
        expect.any(Array)
      )
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it.for([
      { id: 'Comfy.Canvas.Lock', from: false, to: true },
      { id: 'Comfy.Canvas.Unlock', from: true, to: false },
      { id: 'Comfy.Canvas.ToggleLock', from: false, to: true },
      { id: 'Comfy.Canvas.ToggleLock', from: true, to: false }
    ] as const)(
      '$id changes read-only state from $from to $to',
      async ({ id, from, to }) => {
        app.canvas.read_only = from

        await findCmd(id).function()

        expect(app.canvas.read_only).toBe(to)
      }
    )
  })

  describe('Workflow lifecycle commands', () => {
    const findCmd = (id: string) =>
      useCoreCommands().find((cmd) => cmd.id === id)!

    it('Comfy.OpenClipspace delegates to app.openClipspace', async () => {
      await findCmd('Comfy.OpenClipspace').function()

      expect(app.openClipspace).toHaveBeenCalled()
    })

    it('Comfy.RefreshNodeDefinitions rescans missing models after refreshing combos', async () => {
      const order: string[] = []
      let resolveComboRefresh: () => void = () => {}
      vi.mocked(app.refreshComboInNodes).mockImplementation(async () => {
        order.push('combo:start')
        await new Promise<void>((resolve) => {
          resolveComboRefresh = resolve
        })
        order.push('combo:end')
      })
      mockModelStoreRefresh.mockImplementation(async () => {
        order.push('models')
      })
      mockMissingModelStoreRefresh.mockImplementation(async () => {
        order.push('missing')
      })

      const commandPromise = findCmd('Comfy.RefreshNodeDefinitions').function()

      expect(mockMissingModelStoreRefresh).not.toHaveBeenCalled()
      resolveComboRefresh()
      await commandPromise

      expect(app.refreshComboInNodes).toHaveBeenCalled()
      expect(mockModelStoreRefresh).toHaveBeenCalled()
      expect(mockMissingModelStoreRefresh).toHaveBeenCalledWith({
        reloadDefs: false
      })
      expect(order.indexOf('missing')).toBeGreaterThan(
        order.indexOf('combo:end')
      )
    })

    it('Comfy.RefreshNodeDefinitions skips the rescan when combo refresh fails', async () => {
      vi.mocked(app.refreshComboInNodes).mockRejectedValue(new Error('boom'))

      await expect(
        findCmd('Comfy.RefreshNodeDefinitions').function()
      ).rejects.toThrow('boom')
      expect(mockMissingModelStoreRefresh).not.toHaveBeenCalled()
    })

    it('Comfy.RefreshNodeDefinitions skips missing model refresh on cloud', async () => {
      mockDistributionState.isCloud = true

      await findCmd('Comfy.RefreshNodeDefinitions').function()

      expect(app.refreshComboInNodes).toHaveBeenCalled()
      expect(mockModelStoreRefresh).toHaveBeenCalled()
      expect(mockMissingModelStoreRefresh).not.toHaveBeenCalled()
    })
  })

  describe('Queue commands subscription gate', () => {
    const findCmd = (id: string) =>
      useCoreCommands().find((cmd) => cmd.id === id)!

    it.for([
      ['Comfy.QueuePrompt', 0],
      ['Comfy.QueuePromptFront', -1]
    ] as const)(
      '%s queues on Local without subscription features',
      async ([id, num]) => {
        mockBillingState.canAccessSubscriptionFeatures = false

        await findCmd(id).function()

        expect(app.queuePrompt).toHaveBeenCalledWith(num, 1, expect.anything())
        expect(mockBillingState.showSubscriptionDialog).not.toHaveBeenCalled()
      }
    )

    it('Comfy.QueueSelectedOutputNodes passes the gate on Local without subscription features', async () => {
      mockBillingState.canAccessSubscriptionFeatures = false

      await findCmd('Comfy.QueueSelectedOutputNodes').function()

      expect(mockBillingState.showSubscriptionDialog).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it.for([
      'Comfy.QueuePrompt',
      'Comfy.QueuePromptFront',
      'Comfy.QueueSelectedOutputNodes'
    ] as const)(
      '%s shows the subscription dialog on Cloud without an active subscription',
      async (id) => {
        mockDistributionState.isCloud = true
        mockBillingState.canAccessSubscriptionFeatures = false

        await findCmd(id).function()

        expect(app.queuePrompt).not.toHaveBeenCalled()
        expect(mockBillingState.showSubscriptionDialog).toHaveBeenCalledWith({
          reason: 'subscribe_to_run'
        })
      }
    )

    it.for(['ENTERPRISE', 'GALACTIC'] as const)(
      'explains the block instead of a subscribe dialog on a sales-managed %s plan',
      async (tier) => {
        mockDistributionState.isCloud = true
        mockBillingState.canAccessSubscriptionFeatures = false
        mockBillingState.subscriptionTier = tier

        await findCmd('Comfy.QueuePrompt').function()

        expect(app.queuePrompt).not.toHaveBeenCalled()
        expect(mockBillingState.showSubscriptionDialog).not.toHaveBeenCalled()
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'warn' })
        )
      }
    )

    it('Comfy.QueuePrompt queues on Cloud with an active subscription', async () => {
      mockDistributionState.isCloud = true

      await findCmd('Comfy.QueuePrompt').function()

      expect(app.queuePrompt).toHaveBeenCalledWith(0, 1, expect.anything())
    })
  })

  describe('Help commands', () => {
    const findCmd = (id: string) =>
      useCoreCommands().find((cmd) => cmd.id === id)!
    const { staticUrls } = useExternalLink()
    let openSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      openSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null as unknown as Window)
    })

    it('Comfy.Help.OpenComfyUIIssues opens the GitHub issues URL and tracks telemetry', async () => {
      await findCmd('Comfy.Help.OpenComfyUIIssues').function()

      expect(mockTrackHelpResourceClicked).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_type: 'github',
          is_external: true,
          source: 'menu'
        })
      )
      expect(openSpy).toHaveBeenCalledWith(staticUrls.githubIssues, '_blank')
    })

    it('Comfy.Help.OpenComfyOrgDiscord opens the Discord URL and tracks telemetry', async () => {
      await findCmd('Comfy.Help.OpenComfyOrgDiscord').function()

      expect(mockTrackHelpResourceClicked).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_type: 'discord'
        })
      )
      expect(openSpy).toHaveBeenCalledWith(staticUrls.discord, '_blank')
    })

    it('Comfy.Help.AboutComfyUI opens the About dialog', async () => {
      await findCmd('Comfy.Help.AboutComfyUI').function()

      expect(mockShowAbout).toHaveBeenCalled()
    })
  })

  describe('BrowseModelAssets command', () => {
    const asset = fromPartial<AssetItem>({ id: 'asset-1' })

    async function selectAssetFromBrowser() {
      vi.mocked(useSettingStore).mockReturnValue(createMockSettingStore(true))

      const command = useCoreCommands().find(
        (cmd) => cmd.id === 'Comfy.BrowseModelAssets'
      )!
      await command.function()

      const { onAssetSelected } = mockAssetBrowse.mock.calls[0][0]
      onAssetSelected?.(asset)
    }

    it('starts a model node drag for the selected asset', async () => {
      mockStartModelNodeDrag.mockReturnValue(undefined)

      await selectAssetFromBrowser()

      expect(mockStartModelNodeDrag).toHaveBeenCalledWith(
        asset,
        'asset_browser'
      )
      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('shows an error toast when the asset cannot start a drag', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      mockStartModelNodeDrag.mockReturnValue({
        code: 'NO_PROVIDER',
        message: 'No node provider registered',
        assetId: 'asset-1'
      })

      await selectAssetFromBrowser()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })
})
