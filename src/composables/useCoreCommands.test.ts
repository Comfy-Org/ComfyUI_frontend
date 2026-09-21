import { useDialogService } from '@/services/dialogService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@/platform/telemetry'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useCoreCommands } from '@/composables/useCoreCommands'
import { useExternalLink } from '@/composables/useExternalLink'
import {
  LGraph,
  LGraphEventMode,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useModelStore } from '@/stores/modelStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useLitegraphService } from '@/services/litegraphService'
import { useDialogStore } from '@/stores/dialogStore'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { fromPartial } from '@total-typescript/shoehorn'
import { tryToggleWidgetPromotion } from '@/core/graph/subgraph/promotionUtils'

vi.mock(import('@/core/graph/subgraph/promotionUtils'), { spy: true })

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
  const mockCanvas = {
    subgraph: undefined,
    selectedItems: new Set(),
    copyToClipboard: vi.fn(),
    pasteFromClipboard: vi.fn(),
    selectItems: vi.fn(),
    select: vi.fn(),
    deleteSelected: vi.fn(),
    selectOnly: false,
    state: { selectionChanged: false },
    graph: {
      add: vi.fn(),
      convertToSubgraph: vi.fn(() => ({ node: {} }))
    },
    canvas: {
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
      queuePrompt: vi.fn().mockResolvedValue(true),
      refreshComboInNodes: vi.fn().mockResolvedValue(undefined),
      canvas: mockCanvas,
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
    getServerFeature: vi.fn(() => false)
  }
}))

const mockDistributionState = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockDistributionState.isCloud
  }
}))

vi.mock(import('firebase/auth'))

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({
    useWorkflowService: vi.fn(() => ({}))
  })
)

vi.mock(import('@/services/dialogService'))

vi.mock(import('@/services/litegraphService'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

vi.mock(import('@/composables/useFeatureFlags'))
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

const mockUnpackSubgraph = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/composables/graph/useSubgraphOperations'), () => ({
  useSubgraphOperations: () => ({ unpackSubgraph: mockUnpackSubgraph })
}))

let mockWorkflowStore: ReturnType<typeof useWorkflowStore>

vi.mock(import('@/composables/auth/useAuthActions'))

vi.mock(import('@/platform/cloud/subscription/composables/useSubscription'))

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

  beforeEach(() => {
    mockWorkflowStore = useWorkflowStore()
    mockWorkflowStore.activeWorkflow = fromPartial<
      NonNullable<typeof mockWorkflowStore.activeWorkflow>
    >({ changeTracker: mockChangeTracker })
    useCanvasStore().canvas = app.canvas
    mockDistributionState.isCloud = false
    mockBillingState.canAccessSubscriptionFeatures = true
    mockBillingState.subscriptionTier = null
    vi.mocked(app.refreshComboInNodes).mockResolvedValue(undefined)
    vi.mocked(useModelStore().refresh).mockResolvedValue(true)
    vi.mocked(useMissingModelStore().refreshMissingModels).mockResolvedValue(
      undefined
    )

    app.canvas.subgraph = undefined

    useSettingStore().settingValues['Comfy.ConfirmClear'] = false

    global.confirm = vi.fn().mockReturnValue(true)
    mockRunMintPortsIntentionalClear.mockClear()
  })

  describe('ClearWorkflow command', () => {
    it('should clear main graph when not in subgraph', async () => {
      const commands = useCoreCommands()
      const clearCommand = commands.find(
        (cmd) => cmd.id === 'Comfy.ClearWorkflow'
      )!

      await clearCommand.function()

      expect(app.clean).toHaveBeenCalled()
      expect(app.rootGraph.clear).toHaveBeenCalled()
      expect(mockRunMintPortsIntentionalClear).toHaveBeenCalledOnce()
      expect(api.dispatchCustomEvent).toHaveBeenCalledWith('graphCleared')
    })

    it('should preserve input/output nodes when clearing subgraph', async () => {
      app.canvas.subgraph = mockSubgraph

      const commands = useCoreCommands()
      const clearCommand = commands.find(
        (cmd) => cmd.id === 'Comfy.ClearWorkflow'
      )!

      await clearCommand.function()

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

      const commands = useCoreCommands()
      const clearCommand = commands.find(
        (cmd) => cmd.id === 'Comfy.ClearWorkflow'
      )!

      await clearCommand.function()

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
  })

  describe('graph mutation commands while picking nodes', () => {
    function findCommand(id: string) {
      return useCoreCommands().find((cmd) => cmd.id === id)!
    }

    const readNode = {
      mode: (node: LGraphNode) => node.mode,
      pinned: (node: LGraphNode) => node.pinned,
      collapsed: (node: LGraphNode) => Boolean(node.flags.collapsed),
      pos: (node: LGraphNode) => [...node.pos]
    }

    function pickedNode(): LGraphNode {
      const node = new LGraphNode('picked')
      new LGraph().add(node)
      node.pos = [0, 0]
      return node
    }

    beforeEach(() => {
      app.canvas.selectedItems = new Set()
      app.canvas.selectOnly = false
      app.canvas.read_only = false
      useSettingStore().settingValues['Comfy.SnapToGrid.GridSize'] = 10
    })

    it.for([
      {
        id: 'Comfy.Canvas.ToggleSelectedNodes.Mute',
        selectOnly: false,
        readOnly: false,
        reads: 'mode',
        expected: LGraphEventMode.NEVER
      },
      {
        id: 'Comfy.Canvas.ToggleSelectedNodes.Mute',
        selectOnly: true,
        readOnly: false,
        reads: 'mode',
        expected: LGraphEventMode.ALWAYS
      },
      {
        id: 'Comfy.Canvas.ToggleSelectedNodes.Bypass',
        selectOnly: false,
        readOnly: false,
        reads: 'mode',
        expected: LGraphEventMode.BYPASS
      },
      {
        id: 'Comfy.Canvas.ToggleSelectedNodes.Bypass',
        selectOnly: true,
        readOnly: false,
        reads: 'mode',
        expected: LGraphEventMode.ALWAYS
      },
      {
        id: 'Comfy.Canvas.ToggleSelectedNodes.Bypass',
        selectOnly: true,
        readOnly: true,
        reads: 'mode',
        expected: LGraphEventMode.ALWAYS
      },
      {
        id: 'Comfy.Canvas.ToggleSelectedNodes.Pin',
        selectOnly: false,
        readOnly: false,
        reads: 'pinned',
        expected: true
      },
      {
        id: 'Comfy.Canvas.ToggleSelectedNodes.Pin',
        selectOnly: true,
        readOnly: false,
        reads: 'pinned',
        expected: false
      },
      {
        id: 'Comfy.Canvas.ToggleSelected.Pin',
        selectOnly: true,
        readOnly: false,
        reads: 'pinned',
        expected: false
      },
      {
        id: 'Comfy.Canvas.ToggleSelectedNodes.Collapse',
        selectOnly: false,
        readOnly: false,
        reads: 'collapsed',
        expected: true
      },
      {
        id: 'Comfy.Canvas.ToggleSelectedNodes.Collapse',
        selectOnly: true,
        readOnly: false,
        reads: 'collapsed',
        expected: false
      },
      {
        id: 'Comfy.Canvas.MoveSelectedNodes.Up',
        selectOnly: true,
        readOnly: false,
        reads: 'pos',
        expected: [0, 0]
      },
      {
        id: 'Comfy.Canvas.MoveSelectedNodes.Down',
        selectOnly: true,
        readOnly: false,
        reads: 'pos',
        expected: [0, 0]
      },
      {
        id: 'Comfy.Canvas.MoveSelectedNodes.Left',
        selectOnly: true,
        readOnly: false,
        reads: 'pos',
        expected: [0, 0]
      },
      {
        id: 'Comfy.Canvas.MoveSelectedNodes.Right',
        selectOnly: true,
        readOnly: false,
        reads: 'pos',
        expected: [0, 0]
      },
      {
        id: 'Comfy.Canvas.MoveSelectedNodes.Right',
        selectOnly: false,
        readOnly: false,
        reads: 'pos',
        expected: [10, 0]
      }
    ] as const)(
      '$id with selectOnly=$selectOnly readOnly=$readOnly leaves node $reads at $expected',
      async ({ id, selectOnly, readOnly, reads, expected }) => {
        const node = pickedNode()
        app.canvas.selectedItems = new Set([node])
        app.canvas.selectOnly = selectOnly
        app.canvas.read_only = readOnly

        await findCommand(id).function()

        expect(readNode[reads](node)).toEqual(expected)
      }
    )

    it.for([
      { selectOnly: false, resizes: 1 },
      { selectOnly: true, resizes: 0 }
    ])(
      'Comfy.Canvas.Resize with selectOnly=$selectOnly resizes the node $resizes times',
      async ({ selectOnly, resizes }) => {
        const node = pickedNode()
        const setSize = vi.spyOn(node, 'setSize')
        app.canvas.selectedItems = new Set([node])
        app.canvas.selectOnly = selectOnly

        await findCommand('Comfy.Canvas.Resize').function()

        expect(setSize).toHaveBeenCalledTimes(resizes)
      }
    )

    it.for([
      {
        id: 'Comfy.Canvas.PasteFromClipboard',
        selectOnly: true,
        pastes: 0
      },
      {
        id: 'Comfy.Canvas.PasteFromClipboardWithConnect',
        selectOnly: true,
        pastes: 0
      },
      {
        id: 'Comfy.Canvas.PasteFromClipboardWithConnect',
        selectOnly: false,
        pastes: 1
      }
    ])(
      '$id with selectOnly=$selectOnly pastes $pastes times',
      async ({ id, selectOnly, pastes }) => {
        app.canvas.selectOnly = selectOnly

        await findCommand(id).function()

        expect(app.canvas.pasteFromClipboard).toHaveBeenCalledTimes(pastes)
      }
    )

    it.for([
      { id: 'Comfy.Undo', selectOnly: true, spy: 'undo', calls: 0 },
      { id: 'Comfy.Undo', selectOnly: false, spy: 'undo', calls: 1 },
      { id: 'Comfy.Redo', selectOnly: true, spy: 'redo', calls: 0 },
      { id: 'Comfy.Redo', selectOnly: false, spy: 'redo', calls: 1 },
      { id: 'Comfy.ClearWorkflow', selectOnly: true, spy: 'clean', calls: 0 },
      {
        id: 'Comfy.Graph.ToggleWidgetPromotion',
        selectOnly: true,
        spy: 'togglePromotion',
        calls: 0
      },
      {
        id: 'Comfy.Graph.ToggleWidgetPromotion',
        selectOnly: false,
        spy: 'togglePromotion',
        calls: 1
      }
    ] as const)(
      '$id with selectOnly=$selectOnly calls $spy $calls times',
      async ({ id, selectOnly, spy, calls }) => {
        vi.mocked(tryToggleWidgetPromotion).mockImplementation(() => {})
        const spies = {
          undo: mockChangeTracker.undo,
          redo: mockChangeTracker.redo,
          clean: app.clean,
          togglePromotion: tryToggleWidgetPromotion
        }
        app.canvas.selectOnly = selectOnly

        await findCommand(id).function()

        expect(spies[spy]).toHaveBeenCalledTimes(calls)
      }
    )

    it.for([
      { id: 'Comfy.Undo', history: 'undo' },
      { id: 'Comfy.Redo', history: 'redo' }
    ] as const)(
      '$id while select-only still runs the open mask editor history $history',
      async ({ id, history }) => {
        vi.mocked(useDialogStore().isDialogOpen).mockImplementation(
          (key) => key === 'global-mask-editor'
        )
        const historySpy = vi
          .spyOn(useMaskEditorStore().canvasHistory, history)
          .mockImplementation(() => {})
        app.canvas.selectOnly = true

        await findCommand(id).function()

        expect(historySpy).toHaveBeenCalledOnce()
        expect(mockChangeTracker[history]).not.toHaveBeenCalled()
      }
    )

    it.for([
      { selectOnly: false, groupsAdded: 1 },
      { selectOnly: true, groupsAdded: 0 }
    ])(
      'Comfy.Graph.GroupSelectedNodes with selectOnly=$selectOnly adds $groupsAdded groups',
      async ({ selectOnly, groupsAdded }) => {
        vi.spyOn(
          LGraphGroup.prototype,
          'recomputeInsideNodes'
        ).mockReturnValue()
        app.canvas.selectedItems = new Set([pickedNode()])
        app.canvas.selectOnly = selectOnly

        await findCommand('Comfy.Graph.GroupSelectedNodes').function()

        expect(app.canvas.graph?.add).toHaveBeenCalledTimes(groupsAdded)
      }
    )

    it.for([
      { selectOnly: false, conversions: 1 },
      { selectOnly: true, conversions: 0 }
    ])(
      'Comfy.Graph.ConvertToSubgraph with selectOnly=$selectOnly converts $conversions times',
      async ({ selectOnly, conversions }) => {
        app.canvas.selectedItems = new Set([pickedNode()])
        app.canvas.selectOnly = selectOnly

        await findCommand('Comfy.Graph.ConvertToSubgraph').function()

        expect(app.canvas.graph?.convertToSubgraph).toHaveBeenCalledTimes(
          conversions
        )
      }
    )

    it.for([
      { selectOnly: false, unpacks: 1 },
      { selectOnly: true, unpacks: 0 }
    ])(
      'Comfy.Graph.UnpackSubgraph with selectOnly=$selectOnly unpacks $unpacks times',
      async ({ selectOnly, unpacks }) => {
        app.canvas.selectOnly = selectOnly

        await findCommand('Comfy.Graph.UnpackSubgraph').function()

        expect(mockUnpackSubgraph).toHaveBeenCalledTimes(unpacks)
      }
    )

    it.for([
      { selectOnly: false, resizes: 1 },
      { selectOnly: true, resizes: 0 }
    ])(
      'Comfy.Graph.FitGroupToContents with selectOnly=$selectOnly resizes the group $resizes times',
      async ({ selectOnly, resizes }) => {
        const group = new LGraphGroup('picked')
        new LGraph().add(group)
        const resizeTo = vi.spyOn(group, 'resizeTo')
        app.canvas.selectedItems = new Set([group])
        app.canvas.selectOnly = selectOnly

        await findCommand('Comfy.Graph.FitGroupToContents').function()

        expect(resizeTo).toHaveBeenCalledTimes(resizes)
      }
    )
  })

  describe('Subgraph metadata commands', () => {
    beforeEach(() => {
      mockSubgraph.extra = {}
    })

    describe('SetDescription command', () => {
      it('should do nothing when not in subgraph', async () => {
        app.canvas.subgraph = undefined

        const commands = useCoreCommands()
        const setDescCommand = commands.find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetDescription'
        )!

        await setDescCommand.function()

        expect(useDialogService().prompt).not.toHaveBeenCalled()
      })

      it('should set description on subgraph.extra', async () => {
        app.canvas.subgraph = mockSubgraph
        vi.mocked(useDialogService().prompt).mockResolvedValue(
          'Test description'
        )

        const commands = useCoreCommands()
        const setDescCommand = commands.find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetDescription'
        )!

        await setDescCommand.function()

        expect(useDialogService().prompt).toHaveBeenCalled()
        expect(mockSubgraph.extra.BlueprintDescription).toBe('Test description')
        expect(mockChangeTracker.captureCanvasState).toHaveBeenCalled()
      })

      it('should not set description when user cancels', async () => {
        app.canvas.subgraph = mockSubgraph
        vi.mocked(useDialogService().prompt).mockResolvedValue(null)

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

        expect(useDialogService().prompt).not.toHaveBeenCalled()
      })

      it('should set search aliases on subgraph.extra', async () => {
        app.canvas.subgraph = mockSubgraph
        vi.mocked(useDialogService().prompt).mockResolvedValue(
          'alias1, alias2, alias3'
        )

        const commands = useCoreCommands()
        const setAliasesCommand = commands.find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetSearchAliases'
        )!

        await setAliasesCommand.function()

        expect(useDialogService().prompt).toHaveBeenCalled()
        expect(mockSubgraph.extra.BlueprintSearchAliases).toEqual([
          'alias1',
          'alias2',
          'alias3'
        ])
        expect(mockChangeTracker.captureCanvasState).toHaveBeenCalled()
      })

      it('should trim whitespace and filter empty strings', async () => {
        app.canvas.subgraph = mockSubgraph
        vi.mocked(useDialogService().prompt).mockResolvedValue(
          '  alias1  ,  , alias2 ,  '
        )

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
        vi.mocked(useDialogService().prompt).mockResolvedValue('')

        const commands = useCoreCommands()
        const setAliasesCommand = commands.find(
          (cmd) => cmd.id === 'Comfy.Subgraph.SetSearchAliases'
        )!

        await setAliasesCommand.function()

        expect(mockSubgraph.extra.BlueprintSearchAliases).toBeUndefined()
      })

      it('should not set aliases when user cancels', async () => {
        app.canvas.subgraph = mockSubgraph
        vi.mocked(useDialogService().prompt).mockResolvedValue(null)

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

      expect(useLitegraphService().resetView).toHaveBeenCalled()
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
      vi.mocked(useModelStore().refresh).mockImplementation(async () => {
        order.push('models')
        return true
      })
      vi.mocked(useMissingModelStore().refreshMissingModels).mockImplementation(
        async () => {
          order.push('missing')
        }
      )

      const commandPromise = findCmd('Comfy.RefreshNodeDefinitions').function()

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
        findCmd('Comfy.RefreshNodeDefinitions').function()
      ).rejects.toThrow('boom')
      expect(
        vi.mocked(useMissingModelStore().refreshMissingModels)
      ).not.toHaveBeenCalled()
    })

    it('Comfy.RefreshNodeDefinitions skips missing model refresh on cloud', async () => {
      mockDistributionState.isCloud = true

      await findCmd('Comfy.RefreshNodeDefinitions').function()

      expect(app.refreshComboInNodes).toHaveBeenCalled()
      expect(vi.mocked(useModelStore().refresh)).toHaveBeenCalled()
      expect(
        vi.mocked(useMissingModelStore().refreshMissingModels)
      ).not.toHaveBeenCalled()
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
        expect(useToastStore().add).toHaveBeenCalledWith(
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
      openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    })

    it('Comfy.Help.OpenComfyUIIssues opens the GitHub issues URL and tracks telemetry', async () => {
      await findCmd('Comfy.Help.OpenComfyUIIssues').function()

      expect(useTelemetry()?.trackHelpResourceClicked).toHaveBeenCalledWith(
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

      expect(useTelemetry()?.trackHelpResourceClicked).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_type: 'discord'
        })
      )
      expect(openSpy).toHaveBeenCalledWith(staticUrls.discord, '_blank')
    })

    it('Comfy.Help.AboutComfyUI opens the About dialog', async () => {
      await findCmd('Comfy.Help.AboutComfyUI').function()

      expect(useSettingsDialog().showAbout).toHaveBeenCalled()
    })
  })

  describe('BrowseModelAssets command', () => {
    const asset = fromPartial<AssetItem>({ id: 'asset-1' })

    const browseModelAssets = () =>
      useCoreCommands().find((cmd) => cmd.id === 'Comfy.BrowseModelAssets')!

    async function selectAssetFromBrowser() {
      vi.mocked(useFeatureFlags().flags).assetsEnabled = true

      await browseModelAssets().function()

      const { onAssetSelected } = mockAssetBrowse.mock.calls[0][0]
      onAssetSelected?.(asset)
    }

    it('does not open the browser when the assets capability is missing', async () => {
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
})
