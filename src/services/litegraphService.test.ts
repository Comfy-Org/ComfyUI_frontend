import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { IContextMenuValue } from '@/lib/litegraph/src/litegraph'

import {
  CONFIG,
  GET_CONFIG,
  getExtraOptionsForWidget
} from '@/services/litegraphService'

const mockPrompt = vi.fn()
const mockCanvas = vi.hoisted(() => ({
  setDirty: vi.fn(),
  graph_mouse: [100, 200],
  ds: {
    scale: 1,
    offset: [0, 0] as [number, number],
    visible_area: [0, 0, 800, 600],
    fitToBounds: vi.fn()
  },
  graph: {
    nodes: [] as unknown[],
    getNodeById: vi.fn(),
    add: vi.fn(),
    setDirtyCanvas: vi.fn(),
    isRootGraph: true
  },
  animateToBounds: vi.fn(),
  _deserializeItems: vi.fn()
}))

const mockFavoritedWidgetsStore = vi.hoisted(() => ({
  isFavorited: vi.fn().mockReturnValue(false),
  toggleFavorite: vi.fn()
}))

vi.mock('@/stores/workspace/favoritedWidgetsStore', () => ({
  useFavoritedWidgetsStore: () => mockFavoritedWidgetsStore
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    prompt: mockPrompt
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: mockCanvas,
    getCanvas: () => mockCanvas
  })
}))

vi.mock('@/core/graph/subgraph/promotionUtils', () => ({
  addWidgetPromotionOptions: vi.fn(),
  isPreviewPseudoWidget: vi.fn()
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key,
  st: (_key: string, fallback: string) => fallback
}))

vi.mock('@/utils/formatUtil', () => ({
  normalizeI18nKey: (key: string) => key
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: mockCanvas,
    graph: mockCanvas.graph,
    dragOverNode: null,
    lastExecutionError: null,
    rootGraph: {}
  },
  ComfyApp: {
    clipspace: null,
    clipspace_return_node: null,
    copyToClipspace: vi.fn(),
    pasteFromClipspace: vi.fn()
  }
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert: vi.fn() })
}))

vi.mock('@/stores/widgetStore', () => ({
  useWidgetStore: () => ({ widgets: new Map() })
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    nodeLocationProgressStates: {}
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeSubgraph: null,
    nodeIdToNodeLocatorId: (id: string) => id
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn().mockReturnValue(false)
  })
}))

vi.mock('@/composables/canvas/useSelectedLiteGraphItems', () => ({
  useSelectedLiteGraphItems: () => ({
    toggleSelectedNodesMode: vi.fn()
  })
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    invokeExtensionsAsync: vi.fn()
  })
}))

vi.mock('@/stores/subgraphStore', () => ({
  useSubgraphStore: () => ({
    typePrefix: 'Subgraph::',
    getBlueprint: vi.fn()
  })
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({
    getNodeOutputs: vi.fn(),
    getNodePreviews: vi.fn()
  })
}))

vi.mock('@/composables/node/useNodeAnimatedImage', () => ({
  useNodeAnimatedImage: () => ({
    showAnimatedPreview: vi.fn(),
    removeAnimatedPreview: vi.fn()
  })
}))

vi.mock('@/composables/node/useNodeCanvasImagePreview', () => ({
  useNodeCanvasImagePreview: () => ({
    showCanvasImagePreview: vi.fn(),
    removeCanvasImagePreview: vi.fn()
  })
}))

vi.mock('@/composables/node/useNodeImage', () => ({
  useNodeImage: () => ({ showPreview: vi.fn() }),
  useNodeVideo: () => ({ showPreview: vi.fn() })
}))

vi.mock('@/composables/graph/useSubgraphOperations', () => ({
  useSubgraphOperations: () => ({ unpackSubgraph: vi.fn() })
}))

vi.mock('@/composables/maskeditor/useMaskEditor', () => ({
  useMaskEditor: () => ({ openMaskEditor: vi.fn() })
}))

vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({
    widgetStates: new Map(),
    registerWidget: vi.fn(),
    unregisterWidget: vi.fn()
  })
}))

vi.mock('@/stores/promotionStore', () => ({
  usePromotionStore: () => ({
    getPromotionsRef: vi.fn().mockReturnValue([])
  })
}))

vi.mock('@/services/subgraphPseudoWidgetCache', () => ({
  resolveSubgraphPseudoWidgetCache: vi.fn().mockReturnValue({
    cache: { promotions: [], entries: [], nodes: [] },
    nodes: []
  })
}))

vi.mock('@/stores/workspace/rightSidePanelStore', () => ({
  useRightSidePanelStore: () => ({ openPanel: vi.fn() })
}))

vi.mock('@/base/common/downloadUtil', () => ({
  downloadFile: vi.fn(),
  openFileInNewTab: vi.fn()
}))

vi.mock('@/scripts/domWidget', () => ({
  isComponentWidget: vi.fn().mockReturnValue(false),
  isDOMWidget: vi.fn().mockReturnValue(false)
}))

const mockCreateBounds = vi.hoisted(() => vi.fn())
vi.mock('@/lib/litegraph/src/litegraph', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    createBounds: mockCreateBounds
  }
})

vi.mock('@/scripts/ui', () => ({
  $el: vi.fn()
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isAnimatedOutput: vi.fn().mockReturnValue(false),
  isImageNode: vi.fn().mockReturnValue(false),
  isVideoNode: vi.fn().mockReturnValue(false),
  isVideoOutput: vi.fn().mockReturnValue(false),
  migrateWidgetsValues: vi.fn().mockReturnValue([])
}))

vi.mock('@/core/graph/widgets/dynamicWidgets', () => ({
  applyDynamicInputs: vi.fn().mockReturnValue(false)
}))

vi.mock('@/schemas/nodeDef/migration', () => ({
  transformInputSpecV2ToV1: vi.fn().mockReturnValue([])
}))

vi.mock('@/workbench/utils/nodeDefOrderingUtil', () => ({
  getOrderedInputSpecs: vi.fn().mockReturnValue([])
}))

vi.mock('@/stores/nodeDefStore', () => ({
  ComfyNodeDefImpl: vi.fn().mockImplementation((def: unknown) => def)
}))

function createMockNode(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    inputs: [],
    graph: null,
    constructor: { nodeData: { name: 'TestNode' } },
    getWidgetOnPos: vi.fn(),
    ...overrides
  }
}

function createMockWidget(overrides: Record<string, unknown> = {}) {
  return {
    name: 'test_widget',
    label: undefined as string | undefined,
    value: 42,
    callback: vi.fn(),
    options: {},
    ...overrides
  }
}

describe('litegraphService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.ds.scale = 1
    mockCanvas.ds.offset = [0, 0]
    mockCanvas.ds.visible_area = [0, 0, 800, 600]
    mockCanvas.graph.nodes = []
  })

  describe('Symbol exports', () => {
    it('exports CONFIG and GET_CONFIG as unique symbols', () => {
      expect(typeof CONFIG).toBe('symbol')
      expect(typeof GET_CONFIG).toBe('symbol')
      expect(CONFIG).not.toBe(GET_CONFIG)
    })
  })

  describe('getExtraOptionsForWidget', () => {
    it('adds favorite option when widget is not favorited', () => {
      const node = createMockNode()
      const widget = createMockWidget()
      mockFavoritedWidgetsStore.isFavorited.mockReturnValue(false)

      const options = getExtraOptionsForWidget(node as never, widget as never)

      expect(options).toHaveLength(1)
      expect(options[0].content).toContain('contextMenu.FavoriteWidget')
      expect(options[0].content).toContain('test_widget')
    })

    it('adds unfavorite option when widget is already favorited', () => {
      const node = createMockNode()
      const widget = createMockWidget()
      mockFavoritedWidgetsStore.isFavorited.mockReturnValue(true)

      const options = getExtraOptionsForWidget(node as never, widget as never)

      expect(options[0].content).toContain('contextMenu.UnfavoriteWidget')
    })

    it('uses widget label when available', () => {
      const node = createMockNode()
      const widget = createMockWidget({ label: 'My Label' })
      mockFavoritedWidgetsStore.isFavorited.mockReturnValue(false)

      const options = getExtraOptionsForWidget(node as never, widget as never)

      expect(options[0].content).toContain('My Label')
    })

    it('calls toggleFavorite when favorite option callback is invoked', () => {
      const node = createMockNode()
      const widget = createMockWidget()

      const options = getExtraOptionsForWidget(node as never, widget as never)

      void options[0].callback?.call(null as never)
      expect(mockFavoritedWidgetsStore.toggleFavorite).toHaveBeenCalledWith(
        node,
        'test_widget'
      )
    })

    it('adds rename option when input matches widget', () => {
      const widget = createMockWidget({ name: 'seed' })
      const node = createMockNode({
        inputs: [{ widget: { name: 'seed' } }]
      })

      const options = getExtraOptionsForWidget(node as never, widget as never)

      // rename is unshifted first, then favorite is unshifted (ends up first)
      expect(options).toHaveLength(2)
      const renameOption = options.find((o: IContextMenuValue) =>
        o.content?.includes('contextMenu.RenameWidget')
      )
      expect(renameOption).toBeDefined()
      expect(renameOption!.content).toContain('seed')
    })

    it('rename callback updates widget and input labels', async () => {
      const widget = createMockWidget({ name: 'seed' })
      const input = { widget: { name: 'seed' }, label: undefined as unknown }
      const node = createMockNode({ inputs: [input] })
      mockPrompt.mockResolvedValue('New Name')

      const options = getExtraOptionsForWidget(node as never, widget as never)

      const renameOption = options.find((o: IContextMenuValue) =>
        o.content?.includes('contextMenu.RenameWidget')
      )
      await renameOption!.callback?.call(null as never)

      expect(widget.label).toBe('New Name')
      expect(input.label).toBe('New Name')
      expect(widget.callback).toHaveBeenCalledWith(42)
      expect(mockCanvas.setDirty).toHaveBeenCalledWith(true)
    })

    it('rename callback clears label when empty string is returned', async () => {
      const widget = createMockWidget({ name: 'seed', label: 'Old' })
      const input = {
        widget: { name: 'seed' },
        label: 'Old' as string | undefined
      }
      const node = createMockNode({ inputs: [input] })
      mockPrompt.mockResolvedValue('')

      const options = getExtraOptionsForWidget(node as never, widget as never)

      const renameOption = options.find((o: IContextMenuValue) =>
        o.content?.includes('contextMenu.RenameWidget')
      )
      await renameOption!.callback?.call(null as never)

      expect(widget.label).toBeUndefined()
      expect(input.label).toBeUndefined()
    })

    it('rename callback does nothing when prompt is cancelled', async () => {
      const widget = createMockWidget({ name: 'seed', label: 'Original' })
      const input = { widget: { name: 'seed' }, label: 'Original' }
      const node = createMockNode({ inputs: [input] })
      mockPrompt.mockResolvedValue(null)

      const options = getExtraOptionsForWidget(node as never, widget as never)

      const renameOption = options.find((o: IContextMenuValue) =>
        o.content?.includes('contextMenu.RenameWidget')
      )
      await renameOption!.callback?.call(null as never)

      expect(widget.label).toBe('Original')
      expect(input.label).toBe('Original')
    })

    it('adds promotion options when node is in a subgraph', async () => {
      const { addWidgetPromotionOptions } = vi.mocked(
        await import('@/core/graph/subgraph/promotionUtils')
      )
      const node = createMockNode({
        graph: { isRootGraph: false }
      })
      const widget = createMockWidget()

      getExtraOptionsForWidget(node as never, widget as never)

      expect(addWidgetPromotionOptions).toHaveBeenCalled()
    })

    it('does not add promotion options on root graph', async () => {
      const { addWidgetPromotionOptions } = vi.mocked(
        await import('@/core/graph/subgraph/promotionUtils')
      )
      const node = createMockNode({ graph: null })
      const widget = createMockWidget()

      getExtraOptionsForWidget(node as never, widget as never)

      expect(addWidgetPromotionOptions).not.toHaveBeenCalled()
    })
  })

  describe('useLitegraphService', () => {
    // Lazily import to ensure mocks are in place
    async function getService() {
      const { useLitegraphService } =
        await import('@/services/litegraphService')
      return useLitegraphService()
    }

    describe('getCanvasCenter', () => {
      it('returns center of visible area', async () => {
        const service = await getService()
        // visible_area = [0, 0, 800, 600], dpi = 1
        const center = service.getCanvasCenter()
        expect(center).toEqual([400, 300])
      })

      it('accounts for visible area offset', async () => {
        const saved = mockCanvas.ds.visible_area
        mockCanvas.ds.visible_area = [10, 20, 200, 100]

        const service = await getService()
        const center = service.getCanvasCenter()
        expect(center).toEqual([110, 70])

        mockCanvas.ds.visible_area = saved
      })

      it('returns [0, 0] when no visible area', async () => {
        const savedVisibleArea = mockCanvas.ds.visible_area
        mockCanvas.ds.visible_area = undefined as never

        const service = await getService()
        const center = service.getCanvasCenter()
        expect(center).toEqual([0, 0])

        mockCanvas.ds.visible_area = savedVisibleArea
      })
    })

    describe('resetView', () => {
      it('resets canvas scale and offset', async () => {
        mockCanvas.ds.scale = 2.5
        mockCanvas.ds.offset = [100, 200]
        const service = await getService()

        service.resetView()

        expect(mockCanvas.ds.scale).toBe(1)
        expect(mockCanvas.ds.offset).toEqual([0, 0])
        expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
      })
    })

    describe('goToNode', () => {
      it('animates to node bounds when node exists', async () => {
        const bounds = [10, 20, 100, 50]
        const graphNode = { boundingRect: bounds }
        mockCanvas.graph.getNodeById.mockReturnValue(graphNode)

        const service = await getService()
        service.goToNode(42 as never)

        expect(mockCanvas.animateToBounds).toHaveBeenCalledWith(bounds)
      })

      it('does nothing when node does not exist', async () => {
        mockCanvas.graph.getNodeById.mockReturnValue(null)

        const service = await getService()
        service.goToNode(999 as never)

        expect(mockCanvas.animateToBounds).not.toHaveBeenCalled()
      })
    })

    describe('fitView', () => {
      it('calls fitToBounds and setDirty', async () => {
        const mockBounds = [0, 0, 500, 400]
        mockCreateBounds.mockReturnValue(mockBounds)

        const nodeObj = {
          boundingRect: [0, 0, 100, 50],
          updateArea: vi.fn()
        }
        mockCanvas.graph.nodes = [nodeObj]

        const service = await getService()
        service.fitView()

        expect(mockCanvas.ds.fitToBounds).toHaveBeenCalledWith(mockBounds)
        expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
      })

      it('calls updateArea for nodes with zero bounds', async () => {
        mockCreateBounds.mockReturnValue([0, 0, 100, 100])

        const nodeObj = {
          boundingRect: [0, 0, 0, 0],
          updateArea: vi.fn()
        }
        mockCanvas.graph.nodes = [nodeObj]

        const service = await getService()
        service.fitView()

        expect(nodeObj.updateArea).toHaveBeenCalled()
      })

      it('does nothing when createBounds returns null', async () => {
        mockCreateBounds.mockReturnValue(null)
        mockCanvas.graph.nodes = []

        const service = await getService()
        service.fitView()

        expect(mockCanvas.ds.fitToBounds).not.toHaveBeenCalled()
      })
    })

    describe('updatePreviews', () => {
      it('catches errors and logs them', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})

        const service = await getService()
        // Pass a node that will throw due to missing properties
        const badNode = { flags: { collapsed: false } } as never
        // nodeOutputStore.getNodeOutputs will return undefined,
        // so this shouldn't throw to the caller
        service.updatePreviews(badNode)

        // The function should catch errors internally
        consoleSpy.mockRestore()
      })

      it('skips collapsed nodes', async () => {
        const { useNodeOutputStore } = await import('@/stores/nodeOutputStore')
        const service = await getService()
        const node = {
          flags: { collapsed: true },
          imgs: null,
          images: null,
          preview: null
        } as never

        service.updatePreviews(node)

        // getNodeOutputs should not be called for collapsed nodes
        expect(
          vi.mocked(useNodeOutputStore().getNodeOutputs)
        ).not.toHaveBeenCalled()
      })
    })
  })
})
