import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCoreCommands } from '@/composables/useCoreCommands'
import { useExternalLink } from '@/composables/useExternalLink'
import type { LGraph, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import {
  LGraphEventMode,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useModelStore } from '@/stores/modelStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import {
  useCanvasStore,
  useTitleEditorStore
} from '@/renderer/core/canvas/canvasStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { fromPartial } from '@total-typescript/shoehorn'

const mockRunMintPortsIntentionalClear = vi.hoisted(() =>
  vi.fn(<T>(clear: () => T): T => clear())
)
vi.mock<unknown>(
  import('@/workbench/extensions/agent/crdt/mintPortWiring'),
  () => ({
    runMintPortsIntentionalClear: mockRunMintPortsIntentionalClear
  })
)

vi.mock<unknown>(
  import('@/components/sidebar/tabs/ModelLibrarySidebarTab.vue'),
  () => ({ default: {} })
)

const mockCanvasState = vi.hoisted(() => ({ empty: false }))
vi.mock<unknown>(import('@/scripts/app'), () => {
  const mockGraphClear = vi.fn()
  const mockDs = {
    scale: 1,
    element: { width: 800, height: 600 } as Pick<
      HTMLCanvasElement,
      'width' | 'height'
    >,
    changeScale: vi.fn()
  }
  const mockGraph = {
    nodes: [],
    reroutes: new Map(),
    groups: [] as { graph?: unknown }[],
    add: vi.fn((item: { graph?: unknown }) => {
      item.graph = mockGraph
      mockGraph.groups.push(item)
    }),
    convertToSubgraph: vi.fn()
  }
  const mockCanvas = {
    subgraph: undefined,
    selectedItems: new Set(),
    copyToClipboard: vi.fn(),
    pasteFromClipboard: vi.fn(),
    selectItems: vi.fn(),
    deleteSelected: vi.fn(),
    fitViewToSelectionAnimated: vi.fn(),
    select: vi.fn(),
    selectOnly: false,
    get empty() {
      return mockCanvasState.empty
    },
    state: {
      readOnly: false,
      selectionChanged: false
    },
    graph: mockGraph,
    canvas: {
      width: 800,
      height: 600,
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    },
    read_only: false,
    ds: mockDs,
    setDirty: vi.fn()
  }

  return {
    app: {
      clean: vi.fn(() => {
        mockGraphClear()
      }),
      openClipspace: vi.fn(),
      queuePrompt: vi.fn(async () => true),
      refreshComboInNodes: vi.fn(async () => undefined),
      canvas: mockCanvas,
      ui: { loadFile: vi.fn() },
      rootGraph: {
        clear: mockGraphClear
      }
    }
  }
})

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    dispatchCustomEvent: vi.fn(),
    apiURL: vi.fn(() => 'http://localhost:8188'),
    addEventListener: vi.fn(),
    addCustomEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    removeCustomEventListener: vi.fn(),
    getServerFeature: vi.fn(() => false),
    interrupt: vi.fn(),
    freeMemory: vi.fn(),
    storeSetting: vi.fn(),
    storeSettings: vi.fn()
  }
}))

const mockDistributionState = vi.hoisted(() => ({ isCloud: false }))
vi.mock<unknown>(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockDistributionState.isCloud
  },
  isNightly: false
}))

vi.mock(import('firebase/auth'))

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({
    useWorkflowService: vi.fn(() => ({}))
  })
)

const mockDialogService = vi.hoisted(() => ({
  prompt: vi.fn()
}))
vi.mock<unknown>(import('@/services/dialogService'), () => ({
  useDialogService: vi.fn(() => mockDialogService)
}))

const mockResetView = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/services/litegraphService'), () => ({
  useLitegraphService: vi.fn(() => ({
    resetView: mockResetView
  }))
}))

const mockTrackHelpResourceClicked = vi.hoisted(() => vi.fn())
const mockTrackEnterLinear = vi.hoisted(() => vi.fn())
const mockTrackWorkflowExecution = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: vi.fn(() => ({
    trackHelpResourceClicked: mockTrackHelpResourceClicked,
    trackEnterLinear: mockTrackEnterLinear,
    trackSettingChanged: vi.fn(),
    trackRunButton: vi.fn(),
    trackWorkflowExecution: mockTrackWorkflowExecution
  }))
}))

const mockSelectedLiteGraphItems = vi.hoisted(() => ({
  getSelectedNodes: vi.fn<() => LGraphNode[]>(() => []),
  toggleSelectedNodesMode: vi.fn()
}))
vi.mock<unknown>(
  import('@/composables/canvas/useSelectedLiteGraphItems'),
  () => ({
    useSelectedLiteGraphItems: vi.fn(() => mockSelectedLiteGraphItems)
  })
)

const mockFilterOutputNodes = vi.hoisted(() =>
  vi.fn<(nodes: LGraphNode[]) => LGraphNode[]>(() => [])
)
vi.mock<unknown>(import('@/utils/nodeFilterUtil'), () => ({
  filterOutputNodes: mockFilterOutputNodes
}))

const mockGetExecutionIdsForSelectedNodes = vi.hoisted(() =>
  vi.fn<() => string[]>(() => [])
)
vi.mock<unknown>(
  import('@/utils/graphTraversalUtil'),
  async (importOriginal) => ({
    ...(await importOriginal()),
    getExecutionIdsForSelectedNodes: mockGetExecutionIdsForSelectedNodes
  })
)

const mockShowAbout = vi.hoisted(() => vi.fn())
const mockShowSettings = vi.hoisted(() => vi.fn())
vi.mock<unknown>(
  import('@/platform/settings/composables/useSettingsDialog'),
  () => ({
    useSettingsDialog: vi.fn(() => ({
      show: mockShowSettings,
      showAbout: mockShowAbout
    }))
  })
)

const mockFeatureFlagState = vi.hoisted(() => ({ assetsEnabled: false }))
vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: {
      get assetsEnabled() {
        return mockFeatureFlagState.assetsEnabled
      }
    }
  })
}))

const mockAssetBrowse = vi.hoisted(() =>
  vi.fn<(options: { onAssetSelected?: (asset: AssetItem) => void }) => void>()
)
vi.mock<unknown>(
  import('@/platform/assets/composables/useAssetBrowserDialog'),
  () => ({
    useAssetBrowserDialog: vi.fn(() => ({ browse: mockAssetBrowse }))
  })
)

const mockStartModelNodeDrag = vi.hoisted(() => vi.fn())
vi.mock(import('@/composables/node/startModelNodeDragFromAsset'), () => ({
  startModelNodeDragFromAsset: mockStartModelNodeDrag
}))

const mockChangeTracker = vi.hoisted(() => ({
  captureCanvasState: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn()
}))

let mockWorkflowStore: ReturnType<typeof useWorkflowStore>

vi.mock<unknown>(import('@/composables/auth/useAuthActions'), () => ({
  useAuthActions: vi.fn(() => ({}))
}))

vi.mock<unknown>(
  import('@/platform/cloud/subscription/composables/useSubscription'),
  () => ({
    useSubscription: vi.fn(() => ({
      canAccessSubscriptionFeatures: vi.fn().mockReturnValue(true),
      showSubscriptionDialog: vi.fn()
    }))
  })
)

const mockBillingState = vi.hoisted(() => ({
  canAccessSubscriptionFeatures: true,
  subscriptionTier: null as string | null,
  showSubscriptionDialog: vi.fn()
}))
vi.mock<unknown>(import('@/composables/billing/useBillingContext'), () => ({
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
      extra: {}
    } as Partial<typeof app.canvas.subgraph> as typeof app.canvas.subgraph
  }

  const mockSubgraph = createMockSubgraph()!

  function canvasGraph() {
    const { graph } = app.canvas
    if (!graph) expect.fail('Canvas has no graph set.')
    return graph
  }

  function findCommand(id: string) {
    const command = useCoreCommands().find((cmd) => cmd.id === id)
    if (!command) expect.fail(`Command '${id}' not found`)
    return command
  }

  beforeEach(() => {
    mockWorkflowStore = useWorkflowStore()
    mockWorkflowStore.activeWorkflow = fromPartial<
      NonNullable<typeof mockWorkflowStore.activeWorkflow>
    >({ changeTracker: mockChangeTracker })
    useCanvasStore().canvas = app.canvas
    mockDistributionState.isCloud = false
    mockFeatureFlagState.assetsEnabled = false
    mockBillingState.canAccessSubscriptionFeatures = true
    mockBillingState.subscriptionTier = null
    vi.mocked(app.refreshComboInNodes).mockResolvedValue(undefined)
    vi.mocked(useModelStore().refresh).mockResolvedValue(true)
    vi.mocked(useMissingModelStore().refreshMissingModels).mockResolvedValue(
      undefined
    )

    app.canvas.subgraph = undefined
    app.canvas.selectedItems = new Set()
    app.canvas.selectOnly = false
    app.canvas.read_only = false
    mockCanvasState.empty = false
    app.canvas.state.selectionChanged = false

    useSettingStore().settingValues['Comfy.ConfirmClear'] = false

    global.confirm = vi.fn(() => true)
    mockRunMintPortsIntentionalClear.mockClear()
  })

  describe('ClearWorkflow command', () => {
    it('should clear main graph when not in subgraph', async () => {
      await findCommand('Comfy.ClearWorkflow').function()

      expect(app.clean).toHaveBeenCalled()
      expect(app.rootGraph.clear).toHaveBeenCalled()
      expect(mockRunMintPortsIntentionalClear).toHaveBeenCalledOnce()
      expect(api.dispatchCustomEvent).toHaveBeenCalledWith('graphCleared')
    })

    it('should preserve input/output nodes when clearing subgraph', async () => {
      app.canvas.subgraph = mockSubgraph

      await findCommand('Comfy.ClearWorkflow').function()

      expect(app.clean).not.toHaveBeenCalled()
      expect(app.rootGraph.clear).not.toHaveBeenCalled()
      expect(mockRunMintPortsIntentionalClear).not.toHaveBeenCalled()

      const subgraph = app.canvas.subgraph
      expect(subgraph.remove).toHaveBeenCalledTimes(2)
      expect(subgraph.remove).toHaveBeenCalledWith(subgraph.nodes[2])
      expect(subgraph.remove).toHaveBeenCalledWith(subgraph.nodes[3])
      expect(subgraph.remove).not.toHaveBeenCalledWith(subgraph.nodes[0])
      expect(subgraph.remove).not.toHaveBeenCalledWith(subgraph.nodes[1])

      expect(api.dispatchCustomEvent).toHaveBeenCalledWith('graphCleared')
    })

    it('should respect confirmation setting', async () => {
      useSettingStore().settingValues['Comfy.ConfirmClear'] = true

      global.confirm = vi.fn().mockReturnValue(false)

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

    it('should paste with inputs connected', async () => {
      await findCommand('Comfy.Canvas.PasteFromClipboardWithConnect').function()

      expect(app.canvas.pasteFromClipboard).toHaveBeenCalledWith({
        connectInputs: true
      })
    })

    it('should select all items', async () => {
      await findCommand('Comfy.Canvas.SelectAll').function()

      expect(app.canvas.selectItems).toHaveBeenCalledWith()
    })

    it('should announce an empty selection instead of deleting', async () => {
      await findCommand('Comfy.Canvas.DeleteSelectedItems').function()

      expect(app.canvas.canvas.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'litegraph:no-items-selected' })
      )
      expect(app.canvas.deleteSelected).not.toHaveBeenCalled()
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
  })

  describe('Subgraph metadata commands', () => {
    beforeEach(() => {
      mockSubgraph.extra = {}
    })

    describe('SetDescription command', () => {
      it('should do nothing when not in subgraph', async () => {
        app.canvas.subgraph = undefined

        await findCommand('Comfy.Subgraph.SetDescription').function()

        expect(mockDialogService.prompt).not.toHaveBeenCalled()
      })

      it('should set description on subgraph.extra', async () => {
        app.canvas.subgraph = mockSubgraph
        mockDialogService.prompt.mockResolvedValue('Test description')

        await findCommand('Comfy.Subgraph.SetDescription').function()

        expect(mockDialogService.prompt).toHaveBeenCalled()
        expect(mockSubgraph.extra.BlueprintDescription).toBe('Test description')
        expect(mockChangeTracker.captureCanvasState).toHaveBeenCalled()
      })

      it('should not set description when user cancels', async () => {
        app.canvas.subgraph = mockSubgraph
        mockDialogService.prompt.mockResolvedValue(null)

        await findCommand('Comfy.Subgraph.SetDescription').function()

        expect(mockSubgraph.extra.BlueprintDescription).toBeUndefined()
        expect(mockChangeTracker.captureCanvasState).not.toHaveBeenCalled()
      })
    })

    describe('SetSearchAliases command', () => {
      it('should do nothing when not in subgraph', async () => {
        app.canvas.subgraph = undefined

        await findCommand('Comfy.Subgraph.SetSearchAliases').function()

        expect(mockDialogService.prompt).not.toHaveBeenCalled()
      })

      it('should set search aliases on subgraph.extra', async () => {
        app.canvas.subgraph = mockSubgraph
        mockDialogService.prompt.mockResolvedValue('alias1, alias2, alias3')

        await findCommand('Comfy.Subgraph.SetSearchAliases').function()

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

        await findCommand('Comfy.Subgraph.SetSearchAliases').function()

        expect(mockSubgraph.extra.BlueprintSearchAliases).toEqual([
          'alias1',
          'alias2'
        ])
      })

      it('should set undefined when empty input', async () => {
        app.canvas.subgraph = mockSubgraph
        mockDialogService.prompt.mockResolvedValue('')

        await findCommand('Comfy.Subgraph.SetSearchAliases').function()

        expect(mockSubgraph.extra.BlueprintSearchAliases).toBeUndefined()
      })

      it('should not set aliases when user cancels', async () => {
        app.canvas.subgraph = mockSubgraph
        mockDialogService.prompt.mockResolvedValue(null)

        await findCommand('Comfy.Subgraph.SetSearchAliases').function()

        expect(mockSubgraph.extra.BlueprintSearchAliases).toBeUndefined()
        expect(mockChangeTracker.captureCanvasState).not.toHaveBeenCalled()
      })
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

    it.for([
      { id: 'Comfy.Canvas.Lock', from: false, to: true },
      { id: 'Comfy.Canvas.Unlock', from: true, to: false },
      { id: 'Comfy.Canvas.ToggleLock', from: false, to: true },
      { id: 'Comfy.Canvas.ToggleLock', from: true, to: false }
    ] as const)(
      '$id changes read-only state from $from to $to',
      async ({ id, from, to }) => {
        app.canvas.read_only = from

        await findCommand(id).function()

        expect(app.canvas.read_only).toBe(to)
      }
    )
  })

  describe('Workflow lifecycle commands', () => {
    it('Comfy.OpenClipspace delegates to app.openClipspace', async () => {
      await findCommand('Comfy.OpenClipspace').function()

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
      vi.mocked(useModelStore().refresh).mockImplementation(async () => {
        order.push('models')
        return true
      })
      vi.mocked(useMissingModelStore().refreshMissingModels).mockImplementation(
        async () => {
          order.push('missing')
        }
      )

      const commandPromise = findCommand(
        'Comfy.RefreshNodeDefinitions'
      ).function()

      expect(
        vi.mocked(useMissingModelStore().refreshMissingModels)
      ).not.toHaveBeenCalled()
      resolveComboRefresh()
      await commandPromise

      expect(app.refreshComboInNodes).toHaveBeenCalled()
      expect(vi.mocked(useModelStore().refresh)).toHaveBeenCalled()
      expect(
        vi.mocked(useMissingModelStore().refreshMissingModels)
      ).toHaveBeenCalledWith({
        reloadDefs: false
      })
      expect(order.indexOf('missing')).toBeGreaterThan(
        order.indexOf('combo:end')
      )
    })

    it('Comfy.RefreshNodeDefinitions skips the rescan when combo refresh fails', async () => {
      vi.mocked(app.refreshComboInNodes).mockRejectedValue(new Error('boom'))

      await expect(
        findCommand('Comfy.RefreshNodeDefinitions').function()
      ).rejects.toThrow('boom')
      expect(
        vi.mocked(useMissingModelStore().refreshMissingModels)
      ).not.toHaveBeenCalled()
    })

    it('Comfy.RefreshNodeDefinitions skips missing model refresh on cloud', async () => {
      mockDistributionState.isCloud = true

      await findCommand('Comfy.RefreshNodeDefinitions').function()

      expect(app.refreshComboInNodes).toHaveBeenCalled()
      expect(vi.mocked(useModelStore().refresh)).toHaveBeenCalled()
      expect(
        vi.mocked(useMissingModelStore().refreshMissingModels)
      ).not.toHaveBeenCalled()
    })
  })

  describe('Queue commands subscription gate', () => {
    it.for([
      ['Comfy.QueuePrompt', 0],
      ['Comfy.QueuePromptFront', -1]
    ] as const)(
      '%s queues on Local without subscription features',
      async ([id, num]) => {
        mockBillingState.canAccessSubscriptionFeatures = false

        await findCommand(id).function()

        expect(app.queuePrompt).toHaveBeenCalledWith(num, 1, expect.anything())
        expect(mockBillingState.showSubscriptionDialog).not.toHaveBeenCalled()
      }
    )

    it('Comfy.QueueSelectedOutputNodes passes the gate on Local without subscription features', async () => {
      mockBillingState.canAccessSubscriptionFeatures = false

      await findCommand('Comfy.QueueSelectedOutputNodes').function()

      expect(mockBillingState.showSubscriptionDialog).not.toHaveBeenCalled()
      expect(useToastStore().add).toHaveBeenCalledWith(
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

        await findCommand(id).function()

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

        await findCommand('Comfy.QueuePrompt').function()

        expect(app.queuePrompt).not.toHaveBeenCalled()
        expect(mockBillingState.showSubscriptionDialog).not.toHaveBeenCalled()
        expect(useToastStore().add).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'warn' })
        )
      }
    )

    it('Comfy.QueuePrompt queues on Cloud with an active subscription', async () => {
      mockDistributionState.isCloud = true

      await findCommand('Comfy.QueuePrompt').function()

      expect(app.queuePrompt).toHaveBeenCalledWith(0, 1, expect.anything())
    })
  })

  describe('Help commands', () => {
    const { staticUrls, buildDocsUrl } = useExternalLink()
    let openSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    })

    it('Comfy.Help.OpenComfyUIIssues opens the GitHub issues URL and tracks telemetry', async () => {
      await findCommand('Comfy.Help.OpenComfyUIIssues').function()

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
      await findCommand('Comfy.Help.OpenComfyOrgDiscord').function()

      expect(mockTrackHelpResourceClicked).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_type: 'discord'
        })
      )
      expect(openSpy).toHaveBeenCalledWith(staticUrls.discord, '_blank')
    })

    it('Comfy.Help.OpenComfyUIDocs opens the localised docs URL and tracks telemetry', async () => {
      await findCommand('Comfy.Help.OpenComfyUIDocs').function()

      expect(mockTrackHelpResourceClicked).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_type: 'docs'
        })
      )
      expect(openSpy).toHaveBeenCalledWith(
        buildDocsUrl('/', { includeLocale: true }),
        '_blank'
      )
    })

    it('Comfy.Help.OpenComfyUIForum opens the forum URL and tracks telemetry', async () => {
      await findCommand('Comfy.Help.OpenComfyUIForum').function()

      expect(mockTrackHelpResourceClicked).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_type: 'help_feedback'
        })
      )
      expect(openSpy).toHaveBeenCalledWith(staticUrls.forum, '_blank')
    })

    it('Comfy.Help.AboutComfyUI opens the About dialog', async () => {
      await findCommand('Comfy.Help.AboutComfyUI').function()

      expect(mockShowAbout).toHaveBeenCalled()
    })
  })

  describe('BrowseModelAssets command', () => {
    const asset = fromPartial<AssetItem>({ id: 'asset-1' })

    const browseModelAssets = () => findCommand('Comfy.BrowseModelAssets')

    async function selectAssetFromBrowser() {
      mockFeatureFlagState.assetsEnabled = true

      await browseModelAssets().function()

      const { onAssetSelected } = mockAssetBrowse.mock.calls[0][0]
      onAssetSelected?.(asset)
    }

    it('does not open the browser when the assets capability is missing', async () => {
      mockFeatureFlagState.assetsEnabled = false

      await expect(browseModelAssets().function()).resolves.toBeUndefined()

      expect(mockAssetBrowse).not.toHaveBeenCalled()
    })

    it('starts a model node drag for the selected asset', async () => {
      mockStartModelNodeDrag.mockReturnValue(undefined)

      await selectAssetFromBrowser()

      expect(mockStartModelNodeDrag).toHaveBeenCalledWith(
        asset,
        'asset_browser'
      )
      expect(useToastStore().add).not.toHaveBeenCalled()
    })

    it('shows an error toast when the asset cannot start a drag', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      mockStartModelNodeDrag.mockReturnValue({
        code: 'NO_PROVIDER',
        message: 'No node provider registered',
        assetId: 'asset-1'
      })

      await selectAssetFromBrowser()

      expect(useToastStore().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  describe('Undo/Redo commands', () => {
    it('Comfy.Undo delegates to the active workflow change tracker', async () => {
      await findCommand('Comfy.Undo').function()

      expect(mockChangeTracker.undo).toHaveBeenCalled()
    })

    it('Comfy.Redo delegates to the active workflow change tracker', async () => {
      await findCommand('Comfy.Redo').function()

      expect(mockChangeTracker.redo).toHaveBeenCalled()
    })
  })

  describe('Comfy.Canvas.ToggleLinkVisibility command', () => {
    it('hides links and remembers the render mode that was visible', async () => {
      const settings = useSettingStore()
      settings.settingValues['Comfy.LinkRenderMode'] = LiteGraph.LINEAR_LINK

      await findCommand('Comfy.Canvas.ToggleLinkVisibility').function()

      expect(settings.settingValues['Comfy.LinkRenderMode']).toBe(
        LiteGraph.HIDDEN_LINK
      )
    })

    it('restores the remembered render mode when links are hidden', async () => {
      const settings = useSettingStore()
      settings.settingValues['Comfy.LinkRenderMode'] = LiteGraph.LINEAR_LINK

      const toggle = findCommand('Comfy.Canvas.ToggleLinkVisibility')
      await toggle.function()
      await toggle.function()

      expect(settings.settingValues['Comfy.LinkRenderMode']).toBe(
        LiteGraph.LINEAR_LINK
      )
    })
  })

  describe('Comfy.Canvas.ToggleMinimap command', () => {
    it('flips the minimap visibility setting', async () => {
      const settings = useSettingStore()
      settings.settingValues['Comfy.Minimap.Visible'] = false

      await findCommand('Comfy.Canvas.ToggleMinimap').function()

      expect(settings.settingValues['Comfy.Minimap.Visible']).toBe(true)
    })
  })

  describe('Comfy.ToggleQPOV2 command', () => {
    it('flips the queue panel v2 setting', async () => {
      const settings = useSettingStore()
      settings.settingValues['Comfy.Queue.QPOV2'] = false

      await findCommand('Comfy.ToggleQPOV2').function()

      expect(settings.settingValues['Comfy.Queue.QPOV2']).toBe(true)
    })
  })

  describe('Comfy.QueueSelectedOutputNodes command', () => {
    const outputNode = createMockLGraphNode({ id: 1 })

    beforeEach(() => {
      mockSelectedLiteGraphItems.getSelectedNodes.mockReturnValue([outputNode])
      mockFilterOutputNodes.mockReturnValue([outputNode])
    })

    it('queues only the execution ids resolved for the selection', async () => {
      mockGetExecutionIdsForSelectedNodes.mockReturnValue(['1'])

      await findCommand('Comfy.QueueSelectedOutputNodes').function()

      expect(app.queuePrompt).toHaveBeenCalledWith(0, 1, {
        queueNodeIds: ['1'],
        intent: undefined
      })
      expect(mockTrackWorkflowExecution).toHaveBeenCalled()
    })

    it('reports failure instead of queueing when no execution path resolves', async () => {
      mockGetExecutionIdsForSelectedNodes.mockReturnValue([])

      await findCommand('Comfy.QueueSelectedOutputNodes').function()

      expect(app.queuePrompt).not.toHaveBeenCalled()
      expect(useToastStore().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  describe('Comfy.Canvas.MoveSelectedNodes commands', () => {
    let node: LGraphNode

    beforeEach(() => {
      node = createMockLGraphNode({ id: 1, pos: [100, 200] })
      mockSelectedLiteGraphItems.getSelectedNodes.mockReturnValue([node])
      useSettingStore().settingValues['Comfy.SnapToGrid.GridSize'] = 10
    })

    it.for([
      { id: 'Comfy.Canvas.MoveSelectedNodes.Up', pos: [100, 190] },
      { id: 'Comfy.Canvas.MoveSelectedNodes.Down', pos: [100, 210] },
      { id: 'Comfy.Canvas.MoveSelectedNodes.Left', pos: [90, 200] },
      { id: 'Comfy.Canvas.MoveSelectedNodes.Right', pos: [110, 200] }
    ] as const)('$id moves the selection to $pos', async ({ id, pos }) => {
      await findCommand(id).function()

      expect(node.pos).toEqual(pos)
      expect(app.canvas.state.selectionChanged).toBe(true)
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('leaves the canvas untouched when nothing is selected', async () => {
      mockSelectedLiteGraphItems.getSelectedNodes.mockReturnValue([])

      await findCommand('Comfy.Canvas.MoveSelectedNodes.Up').function()

      expect(app.canvas.state.selectionChanged).toBe(false)
      expect(app.canvas.setDirty).not.toHaveBeenCalled()
    })
  })

  describe('Comfy.ToggleLinear command', () => {
    it('tracks entering linear mode with the default keybind source', async () => {
      useCanvasStore().linearMode = false

      await findCommand('Comfy.ToggleLinear').function()

      expect(useCanvasStore().linearMode).toBe(true)
      expect(mockTrackEnterLinear).toHaveBeenCalledWith({ source: 'keybind' })
    })

    it('tracks the caller-supplied source', async () => {
      useCanvasStore().linearMode = false

      await findCommand('Comfy.ToggleLinear').function({ source: 'menu' })

      expect(mockTrackEnterLinear).toHaveBeenCalledWith({ source: 'menu' })
    })

    it('leaves linear mode without tracking a second entry', async () => {
      useCanvasStore().linearMode = true

      await findCommand('Comfy.ToggleLinear').function()

      expect(useCanvasStore().linearMode).toBe(false)
      expect(mockTrackEnterLinear).not.toHaveBeenCalled()
    })
  })

  describe('Memory commands', () => {
    it.for([
      ['Comfy.Memory.UnloadModels', false],
      ['Comfy.Memory.UnloadModelsAndExecutionCache', true]
    ] as const)(
      '%s frees memory with freeExecutionCache=%s when manual unload is allowed',
      async ([id, freeExecutionCache]) => {
        useSettingStore().settingValues['Comfy.Memory.AllowManualUnload'] = true

        await findCommand(id).function()

        expect(api.freeMemory).toHaveBeenCalledWith({ freeExecutionCache })
      }
    )

    it('refuses to free memory when manual unload is disabled', async () => {
      useSettingStore().settingValues['Comfy.Memory.AllowManualUnload'] = false

      await findCommand('Comfy.Memory.UnloadModels').function()

      expect(api.freeMemory).not.toHaveBeenCalled()
      expect(useToastStore().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  describe('Comfy.Canvas.FitView command', () => {
    it('reports an empty canvas instead of fitting the view', async () => {
      mockCanvasState.empty = true

      await findCommand('Comfy.Canvas.FitView').function()

      expect(app.canvas.fitViewToSelectionAnimated).not.toHaveBeenCalled()
      expect(useToastStore().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('fits the view to the visible viewport when the canvas has content', async () => {
      await findCommand('Comfy.Canvas.FitView').function()

      expect(app.canvas.fitViewToSelectionAnimated).toHaveBeenCalledWith({
        viewport: [0, 0, 800, 600]
      })
    })
  })

  describe('Comfy.Interrupt command', () => {
    it('interrupts the active job and notifies the user', async () => {
      await findCommand('Comfy.Interrupt').function()

      expect(api.interrupt).toHaveBeenCalled()
      expect(useToastStore().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'info' })
      )
    })
  })

  describe('Comfy.OpenWorkflow command', () => {
    it('delegates to the file picker', async () => {
      await findCommand('Comfy.OpenWorkflow').function()

      expect(app.ui.loadFile).toHaveBeenCalled()
    })
  })

  describe('Comfy.ToggleTheme command', () => {
    it('alternates between the last used dark and light palettes', async () => {
      const settings = useSettingStore()
      const colorPalette = useColorPaletteStore()
      colorPalette.activePaletteId = 'dark'

      const toggleTheme = findCommand('Comfy.ToggleTheme')
      await toggleTheme.function()

      expect(settings.settingValues['Comfy.ColorPalette']).toBe('light')

      colorPalette.activePaletteId = 'light'
      await toggleTheme.function()

      expect(settings.settingValues['Comfy.ColorPalette']).toBe('dark')
    })
  })

  describe('ToggleSelectedNodes commands', () => {
    it.for([
      ['Comfy.Canvas.ToggleSelectedNodes.Mute', LGraphEventMode.NEVER],
      ['Comfy.Canvas.ToggleSelectedNodes.Bypass', LGraphEventMode.BYPASS]
    ] as const)('%s toggles the selection into mode %s', async ([id, mode]) => {
      await findCommand(id).function()

      expect(
        mockSelectedLiteGraphItems.toggleSelectedNodesMode
      ).toHaveBeenCalledWith(mode)
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Pin flips the pinned state of every selected node', async () => {
      const node = createMockLGraphNode({ id: 1, pinned: false, pin: vi.fn() })
      mockSelectedLiteGraphItems.getSelectedNodes.mockReturnValue([node])

      await findCommand('Comfy.Canvas.ToggleSelectedNodes.Pin').function()

      expect(node.pin).toHaveBeenCalledWith(true)
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Collapse collapses every selected node', async () => {
      const node = createMockLGraphNode({ id: 1, collapse: vi.fn() })
      mockSelectedLiteGraphItems.getSelectedNodes.mockReturnValue([node])

      await findCommand('Comfy.Canvas.ToggleSelectedNodes.Collapse').function()

      expect(node.collapse).toHaveBeenCalled()
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })

    it('Resize sizes every selected node to its computed optimum', async () => {
      const node = createMockLGraphNode({
        id: 1,
        computeSize: vi.fn(() => [200, 100]),
        setSize: vi.fn()
      })
      mockSelectedLiteGraphItems.getSelectedNodes.mockReturnValue([node])

      await findCommand('Comfy.Canvas.Resize').function()

      expect(node.setSize).toHaveBeenCalledWith([200, 100])
      expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
    })
  })

  describe('Comfy.Graph.GroupSelectedNodes command', () => {
    it('reports an empty selection instead of creating a group', async () => {
      await findCommand('Comfy.Graph.GroupSelectedNodes').function()

      expect(useToastStore().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(canvasGraph().add).not.toHaveBeenCalled()
    })

    it('adds a group fitted to the selection and opens its title editor', async () => {
      const node = new LGraphNode('Test Node')
      node.pos = [100, 100]
      node.size = [200, 100]
      app.canvas.selectedItems = new Set([node])
      useSettingStore().settingValues['Comfy.GroupSelectedNodes.Padding'] = 10

      await findCommand('Comfy.Graph.GroupSelectedNodes').function()

      const [group] = vi.mocked(canvasGraph().add).mock.calls[0]
      expect(group).toBeInstanceOf(LGraphGroup)
      expect(useTitleEditorStore().titleEditorTarget).toBe(group)
    })
  })

  describe('Comfy.Graph.ConvertToSubgraph command', () => {
    it('selects the node produced by the conversion', async () => {
      const subgraphNode = fromPartial<SubgraphNode>({})
      vi.mocked(canvasGraph().convertToSubgraph).mockReturnValue(
        fromPartial<ReturnType<LGraph['convertToSubgraph']>>({
          node: subgraphNode
        })
      )

      await findCommand('Comfy.Graph.ConvertToSubgraph').function()

      expect(canvasGraph().convertToSubgraph).toHaveBeenCalledWith(
        app.canvas.selectedItems
      )
      expect(app.canvas.select).toHaveBeenCalledWith(subgraphNode)
      expect(useCanvasStore().updateSelectedItems).toHaveBeenCalled()
    })
  })

  describe('Comfy.ContactSupport command', () => {
    it('opens the support request form in a disowned tab', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      await findCommand('Comfy.ContactSupport').function()

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('support.comfy.org'),
        '_blank',
        'noopener,noreferrer'
      )
    })
  })
})
