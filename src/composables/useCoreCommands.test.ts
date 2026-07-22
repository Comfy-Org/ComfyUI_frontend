import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useCoreCommands } from '@/composables/useCoreCommands'
import { useExternalLink } from '@/composables/useExternalLink'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type * as DistributionModule from '@/platform/distribution/types'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { toNodeId } from '@/types/nodeId'
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
    ds: mockDs,
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

const mockResetView = vi.hoisted(() => vi.fn())
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: vi.fn(() => ({
    resetView: mockResetView
  }))
}))

const mockTrackHelpResourceClicked = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackHelpResourceClicked: mockTrackHelpResourceClicked
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

vi.mock('@/stores/toastStore', () => ({
  useToastStore: vi.fn(() => ({}))
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
    isActiveSubscription: vi.fn().mockReturnValue(true),
    showSubscriptionDialog: vi.fn()
  }))
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: vi.fn(() => ({
    isActiveSubscription: { value: true },
    showSubscriptionDialog: vi.fn()
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

  beforeEach(() => {
    vi.clearAllMocks()
    mockDistributionState.isCloud = false
    vi.mocked(app.refreshComboInNodes).mockResolvedValue(undefined)
    mockModelStoreRefresh.mockResolvedValue(undefined)
    mockMissingModelStoreRefresh.mockResolvedValue(undefined)

    // Set up Pinia
    setActivePinia(createPinia())

    // Reset app state
    app.canvas.subgraph = undefined

    // Mock settings store
    vi.mocked(useSettingStore).mockReturnValue(createMockSettingStore(false))

    // Mock global confirm
    global.confirm = vi.fn().mockReturnValue(true)
  })

  describe('ClearWorkflow command', () => {
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
      vi.mocked(app.canvas.copyToClipboard).mockClear()
      vi.mocked(app.canvas.pasteFromClipboard).mockClear()
      vi.mocked(app.canvas.selectItems).mockClear()
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

    it('should select all items', async () => {
      await findCommand('Comfy.Canvas.SelectAll').function()

      // No arguments means "select all items on canvas"
      expect(app.canvas.selectItems).toHaveBeenCalledWith()
    })
  })

  describe('Comfy.Node.Resize command', () => {
    function findCommand(id: string) {
      return useCoreCommands().find((cmd) => cmd.id === id)!
    }

    const NODE = toNodeId('7')

    beforeEach(() => {
      layoutStore.initializeFromLiteGraph([
        { id: NODE, pos: [0, 0], size: [100, 50] }
      ])
    })

    it('is registered', () => {
      expect(findCommand('Comfy.Node.Resize')).toBeDefined()
    })

    it('resizes the node in layoutStore with the External source', () => {
      findCommand('Comfy.Node.Resize').function({
        nodeId: '7',
        width: 250,
        height: 180
      })

      expect(layoutStore.getNodeLayoutRef(NODE).value?.size).toEqual({
        width: 250,
        height: 180
      })
      expect(layoutStore.getCurrentSource()).toBe(LayoutSource.External)
    })

    it('is a no-op when required metadata is missing', () => {
      const before = { ...layoutStore.getNodeLayoutRef(NODE).value?.size }

      findCommand('Comfy.Node.Resize').function({ nodeId: '7' })

      expect(layoutStore.getNodeLayoutRef(NODE).value?.size).toEqual(before)
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
