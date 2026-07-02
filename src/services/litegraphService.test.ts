import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { IContextMenuValue } from '@/lib/litegraph/src/litegraph'
import {
  LGraphCanvas,
  LGraphNode,
  LiteGraph,
  RenderShape
} from '@/lib/litegraph/src/litegraph'
import type { ContextMenuDivElement } from '@/lib/litegraph/src/interfaces'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type {
  ComfyNodeDef as ComfyNodeDefV2,
  InputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'

import {
  GET_CONFIG,
  getExtraOptionsForWidget
} from '@/services/litegraphService'
import type { HasInitialMinSize } from '@/services/litegraphService'

type WidgetFactory = (
  node: LGraphNode,
  inputName: string,
  inputSpec: unknown,
  app: unknown
) =>
  | {
      widget?: IBaseWidget
      minWidth?: number
      minHeight?: number
    }
  | undefined

async function invokeMenuCallback(option: IContextMenuValue): Promise<void> {
  // Production callbacks under test do not reference `this`; ContextMenuDivElement
  // is a DOM element decorated with extra fields, not realistic to construct in tests.
  await option.callback?.call({} as ContextMenuDivElement)
}

const mockPrompt = vi.fn()
const mockCanvas = vi.hoisted(() => ({
  setDirty: vi.fn(),
  graph_mouse: [100, 200],
  ds: {
    scale: 1,
    offset: [0, 0] as [number, number],
    visible_area: [0, 0, 800, 600] as
      | [number, number, number, number]
      | undefined,
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

const mockApp = vi.hoisted(() => ({
  canvas: undefined as unknown,
  graph: undefined as unknown,
  dragOverNode: null,
  lastExecutionError: null,
  rootGraph: {}
}))

const mockWidgetStore = vi.hoisted(() => ({
  widgets: new Map<string, WidgetFactory>()
}))

const mockExecutionStore = vi.hoisted(() => ({
  nodeLocationProgressStates: {} as Record<string, { state?: string }>
}))

const mockWorkflowStore = vi.hoisted(() => ({
  activeSubgraph: null as { add: ReturnType<typeof vi.fn> } | null,
  nodeIdToNodeLocatorId: vi.fn((id: string | number) => String(id))
}))

const mockSubgraphOperations = vi.hoisted(() => ({
  unpackSubgraph: vi.fn()
}))

const mockExtensionService = vi.hoisted(() => ({
  invokeExtensionsAsync: vi.fn()
}))

const mockSettingStore = vi.hoisted(() => ({
  get: vi.fn().mockReturnValue(false)
}))

const mockFavoritedWidgetsStore = vi.hoisted(() => ({
  isFavorited: vi.fn().mockReturnValue(false),
  toggleFavorite: vi.fn()
}))

const mockToastStore = vi.hoisted(() => ({
  addAlert: vi.fn()
}))

const mockSubgraphStore = vi.hoisted(() => ({
  typePrefix: 'Subgraph::',
  getBlueprint: vi.fn()
}))

const mockRightSidePanelStore = vi.hoisted(() => ({
  openPanel: vi.fn()
}))

const mockPreviewExposureStore = vi.hoisted(() => ({
  getExposures: vi.fn().mockReturnValue([]),
  getExposuresAsPromotionShape: vi.fn().mockReturnValue([]),
  setExposures: vi.fn()
}))

const mockAnimatedPreview = vi.hoisted(() => ({
  showAnimatedPreview: vi.fn(),
  removeAnimatedPreview: vi.fn()
}))

const mockCanvasImagePreview = vi.hoisted(() => ({
  showCanvasImagePreview: vi.fn(),
  removeCanvasImagePreview: vi.fn()
}))

const mockNodeImagePreview = vi.hoisted(() => ({
  showPreview: vi.fn()
}))

const mockNodeVideoPreview = vi.hoisted(() => ({
  showPreview: vi.fn()
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
  app: mockApp,
  ComfyApp: {
    clipspace: null,
    clipspace_return_node: null,
    copyToClipspace: vi.fn(),
    pasteFromClipspace: vi.fn()
  }
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => mockToastStore
}))

vi.mock('@/stores/widgetStore', () => ({
  useWidgetStore: () => mockWidgetStore
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => mockExecutionStore
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => mockWorkflowStore
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => mockSettingStore
}))

vi.mock('@/composables/canvas/useSelectedLiteGraphItems', () => ({
  useSelectedLiteGraphItems: () => ({
    toggleSelectedNodesMode: vi.fn()
  })
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => mockExtensionService
}))

vi.mock('@/stores/subgraphStore', () => ({
  useSubgraphStore: () => mockSubgraphStore
}))

vi.mock('@/stores/previewExposureStore', () => ({
  usePreviewExposureStore: () => mockPreviewExposureStore
}))

const mockNodeOutputStore = vi.hoisted(() => ({
  getNodeOutputs: vi.fn(),
  getNodePreviews: vi.fn()
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => mockNodeOutputStore
}))

vi.mock('@/composables/node/useNodeAnimatedImage', () => ({
  useNodeAnimatedImage: () => mockAnimatedPreview
}))

vi.mock('@/composables/node/useNodeCanvasImagePreview', () => ({
  useNodeCanvasImagePreview: () => mockCanvasImagePreview
}))

vi.mock('@/composables/node/useNodeImage', () => ({
  useNodeImage: () => mockNodeImagePreview,
  useNodeVideo: () => mockNodeVideoPreview
}))

vi.mock('@/composables/graph/useSubgraphOperations', () => ({
  useSubgraphOperations: () => mockSubgraphOperations
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
  useRightSidePanelStore: () => mockRightSidePanelStore
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
  ComfyNodeDefImpl: class {
    constructor(def: object) {
      Object.assign(this, def)
    }
  }
}))

function createMockNode(overrides: Record<string, unknown> = {}): LGraphNode {
  const node = new LGraphNode('TestNode')
  Object.assign(node, {
    id: 1,
    inputs: [],
    graph: null,
    getWidgetOnPos: vi.fn()
  })
  Object.assign(node, overrides)
  // Set static nodeData for tests that check constructor.nodeData
  ;(node.constructor as { nodeData?: { name: string } }).nodeData = {
    name: 'TestNode'
  }
  return node
}

function createNodeWithInitialSize(): LGraphNode & HasInitialMinSize {
  const node = createMockNode() as LGraphNode & HasInitialMinSize
  node._initialMinSize = { width: 1, height: 1 }
  return node
}

function createMockWidget(
  overrides: Record<string, unknown> = {}
): IBaseWidget {
  return {
    name: 'test_widget',
    label: undefined,
    value: 42,
    callback: vi.fn(),
    options: {},
    ...overrides
  } as unknown as IBaseWidget
}

function installClipboard(write: Clipboard['write']) {
  class TestClipboardItem {
    constructor(readonly data: Record<string, Blob>) {}
  }

  vi.stubGlobal('ClipboardItem', TestClipboardItem)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { write }
  })
  return TestClipboardItem
}

function createInputSpec(overrides: Partial<InputSpec> = {}): InputSpec {
  return {
    name: 'prompt',
    type: 'STRING',
    display_name: 'Prompt',
    ...overrides
  } as InputSpec
}

function createNodeDef(
  overrides: Partial<ComfyNodeDefV2> = {}
): ComfyNodeDefV2 {
  return {
    inputs: {},
    outputs: [],
    hidden: {},
    name: 'TestNode',
    display_name: 'Test Node',
    description: 'A node used by tests',
    category: 'test',
    output_node: false,
    python_module: 'test.nodes',
    ...overrides
  }
}

async function registerTestNode() {
  const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
  const registerSpy = vi
    .spyOn(LiteGraph, 'registerNodeType')
    .mockImplementation(function () {})
  const { useLitegraphService } = await import('@/services/litegraphService')
  const service = useLitegraphService()

  await service.registerNodeDef('TestNode', createNodeDef())
  const NodeCtor = registerSpy.mock.calls[0][1] as unknown as typeof LGraphNode
  registerSpy.mockRestore()
  return new NodeCtor('Test Node')
}

describe('litegraphService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFavoritedWidgetsStore.isFavorited.mockReturnValue(false)
    mockPrompt.mockReset()
    mockCreateBounds.mockReset()
    mockWidgetStore.widgets.clear()
    mockExecutionStore.nodeLocationProgressStates = {}
    mockWorkflowStore.activeSubgraph = null
    mockWorkflowStore.nodeIdToNodeLocatorId.mockClear()
    mockExtensionService.invokeExtensionsAsync.mockClear()
    mockCanvas.graph.getNodeById.mockReset()
    mockCanvas.graph.add.mockReset()
    mockCanvas.graph.trigger = vi.fn()
    mockCanvas.startGhostPlacement = vi.fn()
    mockSubgraphOperations.unpackSubgraph.mockReset()
    mockRightSidePanelStore.openPanel.mockReset()
    mockPreviewExposureStore.getExposures.mockReturnValue([])
    mockPreviewExposureStore.getExposuresAsPromotionShape.mockReturnValue([])
    mockPreviewExposureStore.setExposures.mockReset()
    mockCanvas.ds.scale = 1
    mockCanvas.ds.offset = [0, 0]
    mockCanvas.ds.visible_area = [0, 0, 800, 600]
    mockCanvas.graph.nodes = []
    mockApp.canvas = mockCanvas
    mockApp.graph = mockCanvas.graph
    mockSettingStore.get.mockReturnValue(false)
    mockSubgraphStore.getBlueprint.mockReset()
    mockAnimatedPreview.showAnimatedPreview.mockReset()
    mockAnimatedPreview.removeAnimatedPreview.mockReset()
    mockCanvasImagePreview.showCanvasImagePreview.mockReset()
    mockCanvasImagePreview.removeCanvasImagePreview.mockReset()
    mockNodeImagePreview.showPreview.mockReset()
    mockNodeVideoPreview.showPreview.mockReset()
    mockToastStore.addAlert.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getExtraOptionsForWidget', () => {
    it('adds favorite option when widget is not favorited', () => {
      const node = createMockNode()
      const widget = createMockWidget()
      mockFavoritedWidgetsStore.isFavorited.mockReturnValue(false)

      const options = getExtraOptionsForWidget(node, widget)

      expect(options).toHaveLength(1)
      expect(options[0].content).toContain('contextMenu.FavoriteWidget')
      expect(options[0].content).toContain('test_widget')
    })

    it('adds unfavorite option when widget is already favorited', () => {
      const node = createMockNode()
      const widget = createMockWidget()
      mockFavoritedWidgetsStore.isFavorited.mockReturnValue(true)

      const options = getExtraOptionsForWidget(node, widget)

      expect(options[0].content).toContain('contextMenu.UnfavoriteWidget')
    })

    it('uses widget label when available', () => {
      const node = createMockNode()
      const widget = createMockWidget({ label: 'My Label' })
      mockFavoritedWidgetsStore.isFavorited.mockReturnValue(false)

      const options = getExtraOptionsForWidget(node, widget)

      expect(options[0].content).toContain('My Label')
    })

    it('calls toggleFavorite when favorite option callback is invoked', () => {
      const node = createMockNode()
      const widget = createMockWidget()

      const options = getExtraOptionsForWidget(node, widget)

      void invokeMenuCallback(options[0])
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

      const options = getExtraOptionsForWidget(node, widget)

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

      const options = getExtraOptionsForWidget(node, widget)

      const renameOption = options.find((o: IContextMenuValue) =>
        o.content?.includes('contextMenu.RenameWidget')
      )
      await invokeMenuCallback(renameOption!)

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

      const options = getExtraOptionsForWidget(node, widget)

      const renameOption = options.find((o: IContextMenuValue) =>
        o.content?.includes('contextMenu.RenameWidget')
      )
      await invokeMenuCallback(renameOption!)

      expect(widget.label).toBeUndefined()
      expect(input.label).toBeUndefined()
    })

    it('rename callback does nothing when prompt is cancelled', async () => {
      const widget = createMockWidget({ name: 'seed', label: 'Original' })
      const input = { widget: { name: 'seed' }, label: 'Original' }
      const node = createMockNode({ inputs: [input] })
      mockPrompt.mockResolvedValue(null)

      const options = getExtraOptionsForWidget(node, widget)

      const renameOption = options.find((o: IContextMenuValue) =>
        o.content?.includes('contextMenu.RenameWidget')
      )
      await invokeMenuCallback(renameOption!)

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

      getExtraOptionsForWidget(node, widget)

      expect(addWidgetPromotionOptions).toHaveBeenCalled()
    })

    it('does not add promotion options on root graph', async () => {
      const { addWidgetPromotionOptions } = vi.mocked(
        await import('@/core/graph/subgraph/promotionUtils')
      )
      const node = createMockNode({ graph: null })
      const widget = createMockWidget()

      getExtraOptionsForWidget(node, widget)

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

    describe('addNodeInput', () => {
      it('adds optional socket inputs when no widget constructor is registered', async () => {
        const service = await getService()
        const node = createNodeWithInitialSize()
        const addInputSpy = vi.spyOn(node, 'addInput')

        service.addNodeInput(
          node,
          createInputSpec({ type: 'LATENT', isOptional: true })
        )

        expect(addInputSpy).toHaveBeenCalledWith(
          'prompt',
          'LATENT',
          expect.objectContaining({
            shape: RenderShape.HollowCircle,
            localized_name: 'prompt'
          })
        )
      })

      it('uses dynamic inputs instead of adding a socket when applicable', async () => {
        const { applyDynamicInputs } = vi.mocked(
          await import('@/core/graph/widgets/dynamicWidgets')
        )
        applyDynamicInputs.mockReturnValueOnce(true)
        const service = await getService()
        const node = createNodeWithInitialSize()

        service.addNodeInput(node, createInputSpec({ type: 'CUSTOM' }))

        expect(node.inputs).toHaveLength(0)
      })

      it('creates widgets, config-backed sockets, and initial node sizing', async () => {
        const widget = createMockWidget()
        const widgetFactory = vi.fn<WidgetFactory>().mockReturnValue({
          widget,
          minWidth: 320,
          minHeight: 48
        })
        mockWidgetStore.widgets.set('STRING', widgetFactory)
        const service = await getService()
        const node = createNodeWithInitialSize()

        service.addNodeInput(
          node,
          createInputSpec({
            advanced: true,
            hidden: true,
            tooltip: 'Prompt text'
          })
        )

        expect(widgetFactory).toHaveBeenCalledWith(node, 'prompt', [], mockApp)
        expect(widget.label).toBe('Prompt')
        expect(widget.options).toMatchObject({
          advanced: true,
          hidden: true
        })
        expect(widget.hidden).toBe(true)
        expect(widget.tooltip).toBe('Prompt text')
        expect(node.inputs[0].widget).toMatchObject({ name: 'prompt' })
        const widgetConfig = node.inputs[0].widget as Record<symbol, unknown>
        expect(typeof widgetConfig[GET_CONFIG]).toBe('function')
        expect(node._initialMinSize).toEqual({ width: 320, height: 48 })
      })

      it('uses widgetType to choose the widget constructor while preserving socket type', async () => {
        const widget = createMockWidget()
        const widgetFactory = vi.fn<WidgetFactory>().mockReturnValue({
          widget
        })
        mockWidgetStore.widgets.set('CUSTOM_WIDGET', widgetFactory)
        const service = await getService()
        const node = createNodeWithInitialSize()

        service.addNodeInput(
          node,
          createInputSpec({
            type: 'STRING',
            widgetType: 'CUSTOM_WIDGET'
          })
        )

        expect(widgetFactory).toHaveBeenCalled()
        expect(node.inputs[0]).toMatchObject({
          name: 'prompt',
          type: 'STRING'
        })
      })

      it('does not add sockets for socketless widgets', async () => {
        const widget = createMockWidget({ options: { socketless: true } })
        mockWidgetStore.widgets.set(
          'STRING',
          vi.fn<WidgetFactory>().mockReturnValue({ widget })
        )
        const service = await getService()
        const node = createNodeWithInitialSize()

        service.addNodeInput(node, createInputSpec())

        expect(node.inputs).toHaveLength(0)
      })

      it('keeps forced widget inputs as plain sockets', async () => {
        const widgetFactory = vi.fn<WidgetFactory>()
        mockWidgetStore.widgets.set('STRING', widgetFactory)
        const service = await getService()
        const node = createNodeWithInitialSize()

        service.addNodeInput(node, createInputSpec({ forceInput: true }))

        expect(widgetFactory).not.toHaveBeenCalled()
        expect(node.inputs).toHaveLength(1)
        expect(node.inputs[0].widget).toBeUndefined()
      })

      it('uses default widget sizing when constructors return no sizing hints', async () => {
        mockWidgetStore.widgets.set(
          'STRING',
          vi.fn<WidgetFactory>().mockReturnValue({
            widget: undefined
          })
        )
        const service = await getService()
        const node = createNodeWithInitialSize()

        service.addNodeInput(node, createInputSpec())

        expect(node._initialMinSize).toEqual({ width: 1, height: 1 })
        expect(node.inputs[0].widget).toMatchObject({ name: 'prompt' })
      })
    })

    describe('registerNodeDef', () => {
      it('registers node classes that preserve node definition sockets and outputs', async () => {
        const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
        const registerSpy = vi
          .spyOn(LiteGraph, 'registerNodeType')
          .mockImplementation(function () {})
        const { getOrderedInputSpecs } = vi.mocked(
          await import('@/workbench/utils/nodeDefOrderingUtil')
        )
        const inputSpec = createInputSpec({ type: 'LATENT' })
        getOrderedInputSpecs.mockReturnValueOnce([inputSpec])
        const service = await getService()

        await service.registerNodeDef(
          'TestNode',
          createNodeDef({
            inputs: { prompt: inputSpec },
            outputs: [
              {
                index: 0,
                name: 'result',
                type: 'COMFY_MATCHTYPE_V3',
                is_list: true
              }
            ],
            api_node: true
          })
        )

        expect(registerSpy).toHaveBeenCalledWith(
          'TestNode',
          expect.any(Function)
        )
        expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
          'beforeRegisterNodeDef',
          expect.any(Function),
          expect.objectContaining({ name: 'TestNode' })
        )

        const NodeCtor = registerSpy.mock
          .calls[0][1] as unknown as typeof LGraphNode
        const node = new NodeCtor('Test Node')

        expect(node.inputs.map((input) => input.name)).toEqual(['prompt'])
        expect(node.outputs).toHaveLength(1)
        expect(node.outputs[0]).toMatchObject({
          name: 'result',
          type: '*',
          shape: LiteGraph.GRID_SHAPE
        })
        expect(node.serialize_widgets).toBe(true)
        expect(node.color).toBe(LGraphCanvas.node_colors.yellow.color)
        expect(node.bgcolor).toBe(LGraphCanvas.node_colors.yellow.bgcolor)
        registerSpy.mockRestore()
      })

      it('installs execution, drag-over, and error stroke styles', async () => {
        const node = await registerTestNode()
        mockExecutionStore.nodeLocationProgressStates[String(node.id)] = {
          state: 'running'
        }
        mockApp.dragOverNode = { id: node.id }
        mockApp.lastExecutionError = { node_id: node.id }

        expect(node.strokeStyles.running.call(node)).toEqual({
          color: '#0f0',
          lineWidth: 3
        })
        expect(node.strokeStyles.dragOver.call(node)).toEqual({
          color: 'dodgerblue'
        })
        expect(node.strokeStyles.executionError.call(node)).toEqual({
          color: LiteGraph.NODE_ERROR_COLOUR,
          lineWidth: 3
        })
      })

      it('returns no stroke styles when execution, drag-over, and error states do not match', async () => {
        const node = await registerTestNode()
        mockExecutionStore.nodeLocationProgressStates[String(node.id)] = {
          state: 'pending'
        }
        mockApp.dragOverNode = { id: 'other' }
        mockApp.lastExecutionError = { node_id: 'other' }

        expect(node.strokeStyles.running.call(node)).toBeUndefined()
        expect(node.strokeStyles.dragOver.call(node)).toBeUndefined()
        expect(node.strokeStyles.executionError.call(node)).toBeUndefined()
      })

      it('registers normal outputs without list shape or match-type rewriting', async () => {
        const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
        const registerSpy = vi
          .spyOn(LiteGraph, 'registerNodeType')
          .mockImplementation(function () {})
        const service = await getService()

        await service.registerNodeDef(
          'OutputNode',
          createNodeDef({
            name: 'OutputNode',
            outputs: [
              {
                index: 0,
                name: 'FLOAT',
                type: 'FLOAT',
                is_list: false
              }
            ]
          })
        )

        const NodeCtor = registerSpy.mock
          .calls[0][1] as unknown as typeof LGraphNode
        const node = new NodeCtor('Output Node')
        expect(node.outputs[0]).toMatchObject({
          name: 'FLOAT',
          type: 'FLOAT'
        })
        expect(node.outputs[0].shape).toBeUndefined()
        registerSpy.mockRestore()
      })

      it('hides dev-only nodes when dev mode is disabled', async () => {
        const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
        const registerSpy = vi
          .spyOn(LiteGraph, 'registerNodeType')
          .mockImplementation(function () {})
        const service = await getService()

        await service.registerNodeDef(
          'DevNode',
          createNodeDef({ name: 'DevNode', dev_only: true })
        )

        const NodeCtor = registerSpy.mock
          .calls[0][1] as unknown as typeof LGraphNode & { skip_list: boolean }
        expect(NodeCtor.skip_list).toBe(true)
        registerSpy.mockRestore()
      })

      it('keeps dev-only nodes visible when dev mode is enabled', async () => {
        const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
        const registerSpy = vi
          .spyOn(LiteGraph, 'registerNodeType')
          .mockImplementation(function () {})
        mockSettingStore.get.mockImplementation((key: string) =>
          key === 'Comfy.DevMode' ? true : false
        )
        const service = await getService()

        await service.registerNodeDef(
          'DevNode',
          createNodeDef({ name: 'DevNode', dev_only: true })
        )

        const NodeCtor = registerSpy.mock
          .calls[0][1] as unknown as typeof LGraphNode & { skip_list: boolean }
        expect(NodeCtor.skip_list).toBe(false)
        registerSpy.mockRestore()
      })

      it('uses the node name as title when display name is empty', async () => {
        const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
        const registerSpy = vi
          .spyOn(LiteGraph, 'registerNodeType')
          .mockImplementation(function () {})
        const service = await getService()

        await service.registerNodeDef(
          'FallbackTitleNode',
          createNodeDef({
            name: 'FallbackTitleNode',
            display_name: ''
          })
        )

        const NodeCtor = registerSpy.mock
          .calls[0][1] as unknown as typeof LGraphNode
        expect(NodeCtor.title).toBe('FallbackTitleNode')
        registerSpy.mockRestore()
      })

      it('preserves defined socket metadata while keeping dynamic serialized inputs and outputs', async () => {
        const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
        const { getOrderedInputSpecs } = vi.mocked(
          await import('@/workbench/utils/nodeDefOrderingUtil')
        )
        const registerSpy = vi
          .spyOn(LiteGraph, 'registerNodeType')
          .mockImplementation(function () {})
        const inputSpec = createInputSpec({ type: 'LATENT' })
        getOrderedInputSpecs.mockReturnValueOnce([inputSpec])
        const service = await getService()

        await service.registerNodeDef(
          'ConfigurableNode',
          createNodeDef({
            name: 'ConfigurableNode',
            inputs: { prompt: inputSpec },
            outputs: [
              {
                index: 0,
                name: 'IMAGE',
                type: 'IMAGE',
                is_list: false
              }
            ]
          })
        )

        const NodeCtor = registerSpy.mock
          .calls[0][1] as unknown as typeof LGraphNode
        const node = new NodeCtor('Configurable Node')
        const data = {
          inputs: [
            {
              name: 'prompt',
              type: 'OLD',
              label: 'Saved prompt'
            },
            {
              name: 'dynamic',
              type: 'FLOAT'
            }
          ],
          outputs: [
            {
              name: 'Saved output',
              type: 'OLD'
            },
            {
              name: 'Dynamic output',
              type: 'FLOAT'
            }
          ],
          widgets_values: ['saved']
        } as ISerialisedNode

        node.configure(data)

        expect(data.inputs?.map((input) => input.name)).toEqual([
          'prompt',
          'dynamic'
        ])
        expect(data.inputs?.[0]).toMatchObject({
          name: 'prompt',
          type: 'LATENT',
          label: 'Saved prompt'
        })
        expect(data.outputs?.[0]).toMatchObject({
          name: 'IMAGE',
          type: 'IMAGE'
        })
        expect(data.outputs?.[1]).toMatchObject({
          name: 'Dynamic output',
          type: 'FLOAT'
        })
        registerSpy.mockRestore()
      })

      it('restores node-defined sockets when serialized metadata is omitted', async () => {
        const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
        const { getOrderedInputSpecs } = vi.mocked(
          await import('@/workbench/utils/nodeDefOrderingUtil')
        )
        const registerSpy = vi
          .spyOn(LiteGraph, 'registerNodeType')
          .mockImplementation(function () {})
        const inputSpec = createInputSpec({ type: 'LATENT' })
        getOrderedInputSpecs.mockReturnValueOnce([inputSpec])
        const service = await getService()

        await service.registerNodeDef(
          'SparseConfigNode',
          createNodeDef({
            name: 'SparseConfigNode',
            inputs: { prompt: inputSpec },
            outputs: [
              {
                index: 0,
                name: 'IMAGE',
                type: 'IMAGE',
                is_list: false
              }
            ]
          })
        )

        const NodeCtor = registerSpy.mock
          .calls[0][1] as unknown as typeof LGraphNode
        const node = new NodeCtor('Sparse Config Node')
        const data = {} as ISerialisedNode

        node.configure(data)

        expect(data.inputs?.[0]).toMatchObject({
          name: 'prompt',
          type: 'LATENT'
        })
        expect(data.outputs?.[0]).toMatchObject({
          name: 'IMAGE',
          type: 'IMAGE'
        })
        expect(data.widgets_values).toEqual([])
        registerSpy.mockRestore()
      })
    })

    describe('registered node handlers', () => {
      it('adds image, clipspace, bypass, and widget context menu options', async () => {
        const { ComfyApp } = await import('@/scripts/app')
        const { downloadFile, openFileInNewTab } = vi.mocked(
          await import('@/base/common/downloadUtil')
        )
        const node = await registerTestNode()
        const image = document.createElement('img')
        image.src = 'https://example.test/view?filename=image.png&preview=1'
        Object.assign(node, {
          imgs: [image],
          imageIndex: 0,
          overIndex: null,
          getWidgetOnPos: vi.fn().mockReturnValue(createMockWidget())
        })
        ComfyApp.clipspace = { widgets: [] }
        ComfyApp.clipspace_return_node = null
        const options: IContextMenuValue[] = []

        node.getExtraMenuOptions?.(mockCanvas, options)

        expect(options.map((option) => option.content)).toEqual(
          expect.arrayContaining([
            'Open Image',
            'Save Image',
            'Bypass',
            'Copy (Clipspace)',
            'Paste (Clipspace)'
          ])
        )

        await invokeMenuCallback(
          options.find((option) => option.content === 'Open Image')!
        )
        expect(openFileInNewTab).toHaveBeenCalledWith(
          'https://example.test/view?filename=image.png'
        )

        await invokeMenuCallback(
          options.find((option) => option.content === 'Save Image')!
        )
        expect(downloadFile).toHaveBeenCalledWith(
          'https://example.test/view?filename=image.png',
          'image.png'
        )

        await invokeMenuCallback(
          options.find((option) => option.content === 'Bypass')!
        )
        expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
      })

      it('copies non-png images by re-encoding them before retrying clipboard write', async () => {
        const { $el } = vi.mocked(await import('@/scripts/ui'))
        const sourceBlob = new Blob(['jpeg'], { type: 'image/jpeg' })
        const pngBlob = new Blob(['png'], { type: 'image/png' })
        const write = vi
          .fn<Clipboard['write']>()
          .mockRejectedValueOnce(new Error('png only'))
          .mockResolvedValueOnce(undefined)
        const drawImage = vi.fn()
        const bitmap = { close: vi.fn() } as unknown as ImageBitmap
        const canvas = document.createElement('canvas')
        vi.spyOn(canvas, 'getContext').mockReturnValue({
          drawImage
        } as unknown as CanvasRenderingContext2D)
        vi.spyOn(canvas, 'toBlob').mockImplementation((callback, type) => {
          expect(type).toBe('image/png')
          callback(pngBlob)
        })
        const TestClipboardItem = installClipboard(write)
        vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => {
            return new Response(sourceBlob, {
              headers: { 'Content-Type': sourceBlob.type }
            })
          })
        )
        $el.mockReturnValue(canvas)
        const node = await registerTestNode()
        const image = document.createElement('img')
        image.src = 'https://example.test/view?filename=image.jpg&preview=1'
        Object.defineProperty(image, 'naturalWidth', { value: 8 })
        Object.defineProperty(image, 'naturalHeight', { value: 4 })
        Object.assign(node, {
          imgs: [image],
          imageIndex: 0,
          overIndex: null,
          getWidgetOnPos: vi.fn().mockReturnValue(undefined)
        })
        const options: IContextMenuValue[] = []

        node.getExtraMenuOptions?.(mockCanvas, options)
        await invokeMenuCallback(
          options.find((option) => option.content === 'Copy Image')!
        )

        const fetchMock = vi.mocked(fetch)
        expect(String(fetchMock.mock.calls[0][0])).toBe(
          'https://example.test/view?filename=image.jpg'
        )
        expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0)
        expect(bitmap.close).toHaveBeenCalled()
        expect(write).toHaveBeenCalledTimes(2)
        expect(write.mock.calls[0][0][0]).toBeInstanceOf(TestClipboardItem)
        expect(write.mock.calls[1][0][0]).toMatchObject({
          data: { 'image/png': pngBlob }
        })
      })

      it('copies png images without re-encoding them', async () => {
        const sourceBlob = new Blob(['png'], { type: 'image/png' })
        const write = vi.fn<Clipboard['write']>().mockResolvedValue(undefined)
        const TestClipboardItem = installClipboard(write)
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => {
            return new Response(sourceBlob, {
              headers: { 'Content-Type': sourceBlob.type }
            })
          })
        )
        const node = await registerTestNode()
        const image = document.createElement('img')
        image.src = 'https://example.test/view?filename=image.png&preview=1'
        Object.assign(node, {
          imgs: [image],
          imageIndex: 0,
          overIndex: null,
          getWidgetOnPos: vi.fn().mockReturnValue(undefined)
        })
        const options: IContextMenuValue[] = []

        node.getExtraMenuOptions?.(mockCanvas, options)
        await invokeMenuCallback(
          options.find((option) => option.content === 'Copy Image')!
        )

        expect(write).toHaveBeenCalledTimes(1)
        expect(write.mock.calls[0][0][0]).toBeInstanceOf(TestClipboardItem)
        expect(write.mock.calls[0][0][0]).toMatchObject({
          data: { 'image/png': sourceBlob }
        })
      })

      it('reports png clipboard write failures without re-encoding', async () => {
        const sourceBlob = new Blob(['png'], { type: 'image/png' })
        const write = vi
          .fn<Clipboard['write']>()
          .mockRejectedValue(new Error('clipboard denied'))
        installClipboard(write)
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => {
            return new Response(sourceBlob, {
              headers: { 'Content-Type': sourceBlob.type }
            })
          })
        )
        const node = await registerTestNode()
        const image = document.createElement('img')
        image.src = 'https://example.test/view?filename=image.png&preview=1'
        Object.assign(node, {
          imgs: [image],
          imageIndex: 0,
          overIndex: null,
          getWidgetOnPos: vi.fn().mockReturnValue(undefined)
        })
        const options: IContextMenuValue[] = []

        node.getExtraMenuOptions?.(mockCanvas, options)
        await invokeMenuCallback(
          options.find((option) => option.content === 'Copy Image')!
        )

        expect(write).toHaveBeenCalledTimes(1)
        expect(mockToastStore.addAlert).toHaveBeenCalledWith(
          'toastMessages.errorCopyImage'
        )
      })

      it('reports image copy failures when PNG re-encoding cannot get a canvas context', async () => {
        const { $el } = vi.mocked(await import('@/scripts/ui'))
        const sourceBlob = new Blob(['jpeg'], { type: 'image/jpeg' })
        const write = vi
          .fn<Clipboard['write']>()
          .mockRejectedValue(new Error('png only'))
        const canvas = document.createElement('canvas')
        vi.spyOn(canvas, 'getContext').mockReturnValue(null)
        installClipboard(write)
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => {
            return new Response(sourceBlob, {
              headers: { 'Content-Type': sourceBlob.type }
            })
          })
        )
        $el.mockReturnValue(canvas)
        const node = await registerTestNode()
        const image = document.createElement('img')
        image.src = 'https://example.test/view?filename=image.jpg&preview=1'
        Object.defineProperty(image, 'naturalWidth', { value: 8 })
        Object.defineProperty(image, 'naturalHeight', { value: 4 })
        Object.assign(node, {
          imgs: [image],
          imageIndex: 0,
          overIndex: null,
          getWidgetOnPos: vi.fn().mockReturnValue(undefined)
        })
        const options: IContextMenuValue[] = []

        node.getExtraMenuOptions?.(mockCanvas, options)
        await invokeMenuCallback(
          options.find((option) => option.content === 'Copy Image')!
        )

        expect(write).toHaveBeenCalledTimes(1)
        expect(mockToastStore.addAlert).toHaveBeenCalledWith(
          'toastMessages.errorCopyImage'
        )
      })

      it('reports image copy failures when PNG re-encoding produces no blob', async () => {
        const { $el } = vi.mocked(await import('@/scripts/ui'))
        const sourceBlob = new Blob(['jpeg'], { type: 'image/jpeg' })
        const write = vi
          .fn<Clipboard['write']>()
          .mockRejectedValue(new Error('png only'))
        const canvas = document.createElement('canvas')
        vi.spyOn(canvas, 'getContext').mockReturnValue({
          drawImage: vi.fn()
        } as unknown as CanvasRenderingContext2D)
        vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
          callback(null)
        })
        installClipboard(write)
        vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({}))
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => {
            return new Response(sourceBlob, {
              headers: { 'Content-Type': sourceBlob.type }
            })
          })
        )
        $el.mockReturnValue(canvas)
        const node = await registerTestNode()
        const image = document.createElement('img')
        image.src = 'https://example.test/view?filename=image.jpg&preview=1'
        Object.defineProperty(image, 'naturalWidth', { value: 8 })
        Object.defineProperty(image, 'naturalHeight', { value: 4 })
        Object.assign(node, {
          imgs: [image],
          imageIndex: 0,
          overIndex: null,
          getWidgetOnPos: vi.fn().mockReturnValue(undefined)
        })
        const options: IContextMenuValue[] = []

        node.getExtraMenuOptions?.(mockCanvas, options)
        await invokeMenuCallback(
          options.find((option) => option.content === 'Copy Image')!
        )

        expect(write).toHaveBeenCalledTimes(1)
        expect(mockToastStore.addAlert).toHaveBeenCalledWith(
          'toastMessages.errorCopyImage'
        )
      })

      it('uses hovered images and omits clipspace options while editing clipspace', async () => {
        const { ComfyApp } = await import('@/scripts/app')
        const { openFileInNewTab } = vi.mocked(
          await import('@/base/common/downloadUtil')
        )
        vi.stubGlobal('ClipboardItem', undefined)
        const node = await registerTestNode()
        const image = document.createElement('img')
        image.src = 'https://example.test/view?filename=hover.png&preview=1'
        Object.assign(node, {
          imgs: [image],
          imageIndex: null,
          overIndex: 0,
          getWidgetOnPos: vi.fn().mockReturnValue(undefined)
        })
        ComfyApp.clipspace_return_node = node
        const options: IContextMenuValue[] = []

        node.getExtraMenuOptions?.(mockCanvas, options)

        expect(options.map((option) => option.content)).not.toContain(
          'Copy Image'
        )
        expect(options.map((option) => option.content)).not.toContain(
          'Copy (Clipspace)'
        )
        await invokeMenuCallback(
          options.find((option) => option.content === 'Open Image')!
        )
        expect(openFileInNewTab).toHaveBeenCalledWith(
          'https://example.test/view?filename=hover.png'
        )
      })

      it('omits image actions when neither selected nor hovered image resolves', async () => {
        const node = await registerTestNode()
        const image = document.createElement('img')
        image.src = 'https://example.test/view?filename=missing.png'
        Object.assign(node, {
          imgs: [image],
          imageIndex: null,
          overIndex: 4,
          getWidgetOnPos: vi.fn().mockReturnValue(undefined)
        })
        const options: IContextMenuValue[] = []

        node.getExtraMenuOptions?.(mockCanvas, options)

        expect(options.map((option) => option.content)).not.toContain(
          'Open Image'
        )
        expect(options.map((option) => option.content)).not.toContain(
          'Save Image'
        )
      })

      it('adds mask editor option for image nodes', async () => {
        const { ComfyApp } = await import('@/scripts/app')
        const { isImageNode } = vi.mocked(await import('@/utils/litegraphUtil'))
        isImageNode.mockReturnValueOnce(true)
        ComfyApp.clipspace_return_node = null
        ComfyApp.clipspace = null
        const node = await registerTestNode()
        Object.assign(node, {
          imgs: undefined,
          getWidgetOnPos: vi.fn().mockReturnValue(undefined)
        })
        const options: IContextMenuValue[] = []

        node.getExtraMenuOptions?.(mockCanvas, options)

        expect(options.map((option) => option.content)).toContain(
          'Open in MaskEditor | Image Canvas'
        )
      })

      it('saves images without a filename query as an unnamed download', async () => {
        const { downloadFile } = vi.mocked(
          await import('@/base/common/downloadUtil')
        )
        const node = await registerTestNode()
        const image = document.createElement('img')
        image.src = 'https://example.test/view?preview=1'
        Object.assign(node, {
          imgs: [image],
          imageIndex: 0,
          overIndex: null,
          getWidgetOnPos: vi.fn().mockReturnValue(undefined)
        })
        const options: IContextMenuValue[] = []

        node.getExtraMenuOptions?.(mockCanvas, options)
        await invokeMenuCallback(
          options.find((option) => option.content === 'Save Image')!
        )

        expect(downloadFile).toHaveBeenCalledWith(
          'https://example.test/view',
          undefined
        )
      })

      it('adds subgraph menu actions for subgraph nodes', async () => {
        const { LiteGraph, SubgraphNode } =
          await import('@/lib/litegraph/src/litegraph')
        const { createTestSubgraph } =
          await import('@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers')
        const { useSubgraphOperations } =
          await import('@/composables/graph/useSubgraphOperations')
        const { useRightSidePanelStore } =
          await import('@/stores/workspace/rightSidePanelStore')
        const openPanel = useRightSidePanelStore().openPanel
        const unpackSubgraph = useSubgraphOperations().unpackSubgraph
        const service = await getService()
        const subgraph = createTestSubgraph({
          id: '00000000-0000-4000-8000-000000000099',
          name: 'Subgraph Test'
        })
        mockApp.rootGraph = subgraph.rootGraph
        const registerSpy = vi
          .spyOn(LiteGraph, 'registerNodeType')
          .mockImplementation(function () {})
        service.registerSubgraphNodeDef(
          createNodeDef({
            name: subgraph.id,
            display_name: 'Subgraph Test'
          }),
          subgraph,
          {
            id: 1,
            type: subgraph.id,
            pos: [100, 100],
            size: [200, 100],
            inputs: [],
            outputs: [],
            properties: {},
            flags: {},
            mode: 0,
            order: 0
          }
        )
        const NodeCtor = registerSpy.mock
          .calls[0][1] as unknown as new () => SubgraphNode
        const node = new NodeCtor()
        const options: IContextMenuValue[] = []

        node.getExtraMenuOptions?.(mockCanvas, options)

        await invokeMenuCallback(
          options.find((option) => option.content === 'Edit Subgraph Widgets')!
        )
        await invokeMenuCallback(
          options.find((option) => option.content === 'Unpack Subgraph')!
        )

        expect(openPanel).toHaveBeenCalledWith('subgraph')
        expect(unpackSubgraph).toHaveBeenCalled()
        registerSpy.mockRestore()
      })

      it('keeps setSizeForImage as a no-op compatibility hook', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const node = await registerTestNode()

        node.setSizeForImage?.()

        expect(warnSpy).toHaveBeenCalledWith(
          'node.setSizeForImage is deprecated. Now it has no effect. Please remove the call to it.'
        )
        warnSpy.mockRestore()
      })

      it('navigates image previews with keyboard handlers', async () => {
        const node = await registerTestNode()
        Object.assign(node, {
          flags: { collapsed: false },
          imgs: [{}, {}, {}],
          imageIndex: 0
        })
        const preventDefault = vi.fn()
        const stopImmediatePropagation = vi.fn()

        expect(
          node.onKeyDown?.({
            key: 'ArrowLeft',
            preventDefault,
            stopImmediatePropagation
          } as unknown as KeyboardEvent)
        ).toBe(false)
        expect(node.imageIndex).toBe(2)

        node.onKeyDown?.({
          key: 'ArrowRight',
          preventDefault,
          stopImmediatePropagation
        } as unknown as KeyboardEvent)
        expect(node.imageIndex).toBe(0)

        node.onKeyDown?.({
          key: 'Escape',
          preventDefault,
          stopImmediatePropagation
        } as unknown as KeyboardEvent)
        expect(node.imageIndex).toBeNull()
        expect(preventDefault).toHaveBeenCalledTimes(3)
        expect(stopImmediatePropagation).toHaveBeenCalledTimes(3)
      })

      it('keeps keyboard events untouched when nodes are collapsed or lack images', async () => {
        const node = await registerTestNode()
        Object.assign(node, {
          flags: { collapsed: true },
          imgs: [{}, {}],
          imageIndex: 0
        })
        const event = {
          key: 'ArrowLeft',
          preventDefault: vi.fn(),
          stopImmediatePropagation: vi.fn()
        } as unknown as KeyboardEvent

        expect(node.onKeyDown?.(event)).toBeUndefined()
        expect(event.preventDefault).not.toHaveBeenCalled()

        Object.assign(node, {
          flags: { collapsed: false },
          imgs: undefined,
          imageIndex: 0
        })
        expect(node.onKeyDown?.(event)).toBeUndefined()
      })
    })

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
        mockCanvas.ds.visible_area = undefined

        const service = await getService()
        const center = service.getCanvasCenter()
        expect(center).toEqual([0, 0])

        mockCanvas.ds.visible_area = savedVisibleArea
      })

      it('returns [0, 0] without throwing when app.canvas is undefined', async () => {
        mockApp.canvas = undefined

        const service = await getService()
        expect(() => service.getCanvasCenter()).not.toThrow()
        expect(service.getCanvasCenter()).toEqual([0, 0])
      })

      it('accounts for device pixel ratio when computing the center', async () => {
        vi.stubGlobal('devicePixelRatio', 2)
        mockCanvas.ds.visible_area = [10, 20, 200, 100]

        const service = await getService()

        expect(service.getCanvasCenter()).toEqual([60, 45])
      })

      it('falls back to a device pixel ratio of one when it is unavailable', async () => {
        vi.stubGlobal('devicePixelRatio', undefined)
        mockCanvas.ds.visible_area = [10, 20, 200, 100]

        const service = await getService()

        expect(service.getCanvasCenter()).toEqual([110, 70])
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
        service.goToNode(42)

        expect(mockCanvas.animateToBounds).toHaveBeenCalledWith(bounds)
      })

      it('does nothing when node does not exist', async () => {
        mockCanvas.graph.getNodeById.mockReturnValue(null)

        const service = await getService()
        service.goToNode(999)

        expect(mockCanvas.animateToBounds).not.toHaveBeenCalled()
      })

      it('does nothing when the serialized node id is invalid', async () => {
        const service = await getService()

        service.goToNode('')

        expect(mockCanvas.graph.getNodeById).not.toHaveBeenCalled()
        expect(mockCanvas.animateToBounds).not.toHaveBeenCalled()
      })
    })

    describe('addNodeOnGraph', () => {
      it('creates and adds normal nodes to the active graph', async () => {
        const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
        const node = createMockNode()
        const createNodeSpy = vi
          .spyOn(LiteGraph, 'createNode')
          .mockReturnValue(node)
        const service = await getService()

        const result = service.addNodeOnGraph(createNodeDef())

        expect(createNodeSpy).toHaveBeenCalledWith('TestNode', 'Test Node', {
          pos: [400, 300]
        })
        expect(mockCanvas.graph.add).toHaveBeenCalledWith(node, undefined)
        expect(result).toBe(node)
        createNodeSpy.mockRestore()
      })

      it('uses a supplied position when creating normal nodes', async () => {
        const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
        const node = createMockNode()
        const createNodeSpy = vi
          .spyOn(LiteGraph, 'createNode')
          .mockReturnValue(node)
        const service = await getService()

        service.addNodeOnGraph(createNodeDef(), { pos: [12, 34] })

        expect(createNodeSpy).toHaveBeenCalledWith('TestNode', 'Test Node', {
          pos: [12, 34]
        })
        createNodeSpy.mockRestore()
      })

      it('uses the active subgraph when one is present', async () => {
        const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
        const node = createMockNode()
        const subgraph = { add: vi.fn() }
        mockWorkflowStore.activeSubgraph = subgraph
        const createNodeSpy = vi
          .spyOn(LiteGraph, 'createNode')
          .mockReturnValue(node)
        const service = await getService()

        const result = service.addNodeOnGraph(createNodeDef())

        expect(subgraph.add).toHaveBeenCalledWith(node, undefined)
        expect(mockCanvas.graph.add).not.toHaveBeenCalled()
        expect(result).toBe(node)
        createNodeSpy.mockRestore()
      })

      it('returns null when LiteGraph cannot create the node', async () => {
        const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
        const createNodeSpy = vi
          .spyOn(LiteGraph, 'createNode')
          .mockReturnValue(null)
        const service = await getService()

        expect(service.addNodeOnGraph(createNodeDef())).toBeNull()
        expect(mockCanvas.graph.add).not.toHaveBeenCalled()
        createNodeSpy.mockRestore()
      })

      it('returns null when there is no graph to receive a created node', async () => {
        const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
        const node = createMockNode()
        const createNodeSpy = vi
          .spyOn(LiteGraph, 'createNode')
          .mockReturnValue(node)
        mockApp.graph = null
        const service = await getService()

        expect(service.addNodeOnGraph(createNodeDef())).toBeNull()
        expect(mockCanvas.graph.add).not.toHaveBeenCalled()

        createNodeSpy.mockRestore()
      })

      it('deserializes subgraph blueprints at the canvas center', async () => {
        const node = createMockNode({ flags: {} })
        const blueprint = {
          nodes: [{ id: 1 }],
          definitions: { subgraphs: [{ id: 'subgraph-1' }] }
        }
        mockSubgraphStore.getBlueprint.mockReturnValue(blueprint)
        mockCanvas._deserializeItems.mockReturnValue({
          nodes: new Map([[node.id, node]])
        })
        const service = await getService()

        const result = service.addNodeOnGraph(
          createNodeDef({ name: 'SubgraphBlueprint.Basic' })
        )

        expect(mockCanvas._deserializeItems).toHaveBeenCalledWith(
          {
            nodes: blueprint.nodes,
            subgraphs: blueprint.definitions.subgraphs
          },
          { position: [400, 300] }
        )
        expect(result).toBe(node)
      })

      it('starts ghost placement for subgraph blueprints when requested', async () => {
        const dragEvent = new DragEvent('dragstart')
        const node = createMockNode({ flags: {} })
        mockSubgraphStore.getBlueprint.mockReturnValue({
          nodes: [{ id: 1 }]
        })
        mockCanvas._deserializeItems.mockReturnValue({
          nodes: new Map([[node.id, node]])
        })
        const service = await getService()

        const result = service.addNodeOnGraph(
          createNodeDef({ name: 'SubgraphBlueprint.Ghost' }),
          {},
          { ghost: true, dragEvent }
        )

        expect(result).toBe(node)
        expect(node.flags.ghost).toBe(true)
        expect(mockCanvas.graph.trigger).toHaveBeenCalledWith(
          'node:property:changed',
          {
            nodeId: node.id,
            property: 'flags.ghost',
            oldValue: false,
            newValue: true
          }
        )
        expect(mockCanvas.startGhostPlacement).toHaveBeenCalledWith(
          node,
          dragEvent
        )
      })

      it('throws when blueprint deserialization fails', async () => {
        mockSubgraphStore.getBlueprint.mockReturnValue({ nodes: [] })
        mockCanvas._deserializeItems.mockReturnValue(null)
        const service = await getService()

        expect(() =>
          service.addNodeOnGraph(
            createNodeDef({ name: 'SubgraphBlueprint.Broken' })
          )
        ).toThrow('Failed to add subgraph blueprint')
      })

      it('throws when blueprint deserialization returns no node', async () => {
        mockSubgraphStore.getBlueprint.mockReturnValue({ nodes: [] })
        mockCanvas._deserializeItems.mockReturnValue({
          nodes: new Map()
        })
        const service = await getService()

        expect(() =>
          service.addNodeOnGraph(
            createNodeDef({ name: 'SubgraphBlueprint.Empty' })
          )
        ).toThrow(
          'Subgraph blueprint was added, but failed to resolve a subgraph Node'
        )
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

      it('does nothing when the canvas graph has no nodes collection', async () => {
        const savedNodes = mockCanvas.graph.nodes
        mockCanvas.graph.nodes = undefined as unknown as typeof savedNodes

        const service = await getService()
        service.fitView()

        expect(mockCreateBounds).not.toHaveBeenCalled()
        expect(mockCanvas.ds.fitToBounds).not.toHaveBeenCalled()

        mockCanvas.graph.nodes = savedNodes
      })
    })

    describe('updatePreviews', () => {
      it('routes new image outputs through image and canvas previews', async () => {
        const { isAnimatedOutput } = vi.mocked(
          await import('@/utils/litegraphUtil')
        )
        const service = await getService()
        const output = { images: [{ filename: 'image.png' }] }
        const node = createMockNode({
          flags: { collapsed: false },
          imgs: [{}],
          images: undefined,
          preview: undefined
        })
        mockNodeOutputStore.getNodeOutputs.mockReturnValue(output)

        service.updatePreviews(node)

        expect(node.images).toBe(output.images)
        expect(isAnimatedOutput).toHaveBeenCalledWith(output)
        expect(mockNodeImagePreview.showPreview).toHaveBeenCalled()
        expect(mockNodeVideoPreview.showPreview).not.toHaveBeenCalled()
        expect(mockAnimatedPreview.removeAnimatedPreview).toHaveBeenCalledWith(
          node
        )
        expect(
          mockCanvasImagePreview.showCanvasImagePreview
        ).toHaveBeenCalledWith(node)
      })

      it('routes video outputs through video previews', async () => {
        const { isVideoOutput } = vi.mocked(
          await import('@/utils/litegraphUtil')
        )
        isVideoOutput.mockReturnValueOnce(true)
        const service = await getService()
        const node = createMockNode({
          flags: { collapsed: false },
          imgs: [{}],
          images: undefined
        })
        mockNodeOutputStore.getNodeOutputs.mockReturnValue({
          images: [{ filename: 'frame.png' }]
        })

        service.updatePreviews(node)

        expect(mockNodeVideoPreview.showPreview).toHaveBeenCalled()
        expect(mockNodeImagePreview.showPreview).not.toHaveBeenCalled()
      })

      it('routes animated outputs through animated previews', async () => {
        const { isAnimatedOutput } = vi.mocked(
          await import('@/utils/litegraphUtil')
        )
        isAnimatedOutput.mockReturnValueOnce(true)
        const service = await getService()
        const node = createMockNode({
          flags: { collapsed: false },
          imgs: [{}],
          images: undefined
        })
        mockNodeOutputStore.getNodeOutputs.mockReturnValue({
          images: [{ filename: 'animated.webp' }]
        })

        service.updatePreviews(node)

        expect(
          mockCanvasImagePreview.removeCanvasImagePreview
        ).toHaveBeenCalledWith(node)
        expect(mockAnimatedPreview.showAnimatedPreview).toHaveBeenCalledWith(
          node
        )
      })

      it('updates preview-only changes without requiring output metadata', async () => {
        const preview = { filename: 'preview.png' }
        const service = await getService()
        const node = createMockNode({
          flags: { collapsed: false },
          imgs: undefined,
          images: undefined,
          preview: undefined
        })
        mockNodeOutputStore.getNodeOutputs.mockReturnValue(undefined)
        mockNodeOutputStore.getNodePreviews.mockReturnValue(preview)

        service.updatePreviews(node)

        expect(node.preview).toBe(preview)
        expect(mockNodeImagePreview.showPreview).toHaveBeenCalled()
        expect(
          mockCanvasImagePreview.showCanvasImagePreview
        ).not.toHaveBeenCalled()
      })

      it('uses video previews for video nodes even when output metadata is not video', async () => {
        const { isVideoNode } = vi.mocked(await import('@/utils/litegraphUtil'))
        isVideoNode.mockReturnValueOnce(true)
        const service = await getService()
        const output = { images: [{ filename: 'frame.png' }] }
        const node = createMockNode({
          flags: { collapsed: false },
          imgs: [{}],
          images: undefined
        })
        mockNodeOutputStore.getNodeOutputs.mockReturnValue(output)

        service.updatePreviews(node)

        expect(mockNodeVideoPreview.showPreview).toHaveBeenCalled()
        expect(mockNodeImagePreview.showPreview).not.toHaveBeenCalled()
      })

      it('refreshes existing still-image previews when output metadata is unchanged', async () => {
        const service = await getService()
        const images = [{ filename: 'same.png' }]
        const node = createMockNode({
          flags: { collapsed: false },
          imgs: [{}],
          images,
          animatedImages: false
        })
        mockNodeOutputStore.getNodeOutputs.mockReturnValue({ images })
        mockNodeOutputStore.getNodePreviews.mockReturnValue(undefined)

        service.updatePreviews(node)

        expect(mockNodeImagePreview.showPreview).not.toHaveBeenCalled()
        expect(mockAnimatedPreview.removeAnimatedPreview).toHaveBeenCalledWith(
          node
        )
        expect(
          mockCanvasImagePreview.showCanvasImagePreview
        ).toHaveBeenCalledWith(node)
      })

      it('catches errors and logs them', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})

        mockNodeOutputStore.getNodeOutputs.mockImplementation(() => {
          throw new Error('test error')
        })

        const service = await getService()
        const badNode = createMockNode({ flags: { collapsed: false } })
        expect(() => service.updatePreviews(badNode)).not.toThrow()
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error drawing node background',
          expect.any(Error)
        )

        consoleSpy.mockRestore()
      })

      it('skips collapsed nodes', async () => {
        const service = await getService()
        const node = createMockNode({
          flags: { collapsed: true },
          imgs: undefined,
          images: undefined,
          preview: undefined
        })

        service.updatePreviews(node)

        expect(mockNodeOutputStore.getNodeOutputs).not.toHaveBeenCalled()
      })
    })
  })
})
