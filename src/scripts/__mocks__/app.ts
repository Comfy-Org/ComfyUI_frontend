import { TestRunner, assert, vi } from 'vitest'

import { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import { DragAndScale } from '@/lib/litegraph/src/DragAndScale'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ANIM_PREVIEW_WIDGET as realAnimationWidget,
  ComfyApp as RealComfyApp,
  sanitizeNodeName as realSanitizeNodeName
} from '@/scripts/app'

type Canvas = Pick<
  RealComfyApp['canvas'],
  | 'canvas'
  | 'ds'
  | 'graph_mouse'
  | 'graph'
  | 'isDragging'
  | 'linkConnector'
  | 'mouse'
  | 'node_over'
  | 'read_only'
  | 'selected_nodes'
  | 'selectedItems'
  | 'selectOnly'
  | 'subgraph'
> &
  Pick<RealComfyApp['canvas'], keyof typeof canvasActions>

const canvasActions = vi.mockObject<
  Pick<
    RealComfyApp['canvas'],
    | '_deserializeItems'
    | 'copyToClipboard'
    | 'deleteSelected'
    | 'emitAfterChange'
    | 'emitBeforeChange'
    | 'getWidgetAtCursor'
    | 'pasteFromClipboard'
    | 'processMouseDown'
    | 'processMouseMove'
    | 'processMouseUp'
    | 'processMouseWheel'
    | 'processSelect'
    | 'selectItems'
    | 'setDirty'
    | 'setGraph'
  >
>(
  {
    setDirty() {},
    setGraph(graph) {
      state().canvas.graph = graph
    },
    _deserializeItems() {
      assert.fail('Configure app.canvas._deserializeItems for this test')
    },
    copyToClipboard: () => '',
    pasteFromClipboard() {},
    selectItems() {},
    deleteSelected() {},
    processSelect() {},
    processMouseDown() {},
    processMouseMove() {},
    processMouseUp() {},
    processMouseWheel() {},
    emitBeforeChange() {},
    emitAfterChange() {},
    getWidgetAtCursor: () => undefined
  },
  { spy: true }
)

const actions = vi.mockObject<
  Pick<
    RealComfyApp,
    | 'clean'
    | 'getPreviewFormatParam'
    | 'getRandParam'
    | 'graphToPrompt'
    | 'handleFile'
    | 'loadGraphData'
    | 'openClipspace'
    | 'queuePrompt'
    | 'refreshComboInNodes'
    | 'refreshMissingModels'
    | 'registerExtension'
    | 'registerNodeDef'
    | 'setup'
    | 'showErrorOnFileLoad'
  >
>(
  {
    async setup() {},
    async loadGraphData() {
      return false
    },
    async queuePrompt() {
      return false
    },
    async graphToPrompt() {
      assert.fail('Configure app.graphToPrompt for this test')
    },
    registerExtension() {},
    async registerNodeDef() {},
    async refreshMissingModels() {
      assert.fail('Configure app.refreshMissingModels for this test')
    },
    async refreshComboInNodes() {},
    clean() {},
    openClipspace() {},
    getPreviewFormatParam: () => '',
    getRandParam: () => '',
    async handleFile() {},
    showErrorOnFileLoad() {}
  },
  { spy: true }
)

const apiActions: Pick<
  RealComfyApp['api'],
  'addEventListener' | 'removeEventListener'
> = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}

const settings: Pick<
  RealComfyApp['ui']['settings'],
  'addSetting' | 'dispatchChange'
> = {
  addSetting: vi.fn(() => {
    assert.fail('Configure app.ui.settings.addSetting for this test')
  }),
  dispatchChange: vi.fn()
}

const setting: RealComfyApp['extensionManager']['setting'] = {
  get: vi.fn(() => undefined),
  set: vi.fn()
}

const uiActions: Pick<RealComfyApp['ui'], 'restoreMenuPosition'> = {
  restoreMenuPosition: vi.fn()
}

type AppState = {
  -readonly [K in
    | 'configuringGraph'
    | 'lastExecutionError'
    | 'nodeOutputs'
    | 'nodePreviewImages'
    | 'vueAppReady']: RealComfyApp[K]
} & {
  rootGraph: RealComfyApp['rootGraphOrUndefined']
  canvas: Canvas
  api: Pick<RealComfyApp['api'], 'clientId'> & typeof apiActions
  ui: Pick<
    RealComfyApp['ui'],
    'autoQueueEnabled' | 'autoQueueMode' | 'menuContainer'
  > &
    typeof uiActions & { settings: typeof settings }
  menu: Pick<RealComfyApp['menu'], 'element'>
  extensionManager: Pick<RealComfyApp['extensionManager'], 'setting'>
  clipspace: Pick<typeof RealComfyApp, 'clipspace_return_node' | 'clipspace'>
}

function createState(): AppState {
  const rootGraph = new LGraph()
  const element = document.createElement('canvas')
  return {
    rootGraph,
    nodeOutputs: {},
    nodePreviewImages: {},
    vueAppReady: false,
    configuringGraph: false,
    lastExecutionError: null,
    api: { ...apiActions, clientId: undefined },
    ui: {
      ...uiActions,
      settings: { ...settings },
      autoQueueEnabled: false,
      autoQueueMode: 'instant',
      menuContainer: document.createElement('div')
    },
    menu: { element: document.createElement('div') },
    extensionManager: { setting: { ...setting } },
    clipspace: { clipspace: null, clipspace_return_node: null },
    canvas: {
      ...canvasActions,
      graph: rootGraph,
      ds: new DragAndScale(element),
      canvas: element,
      selected_nodes: {},
      selectedItems: new Set(),
      subgraph: undefined,
      graph_mouse: [0, 0],
      mouse: [0, 0],
      node_over: undefined,
      read_only: false,
      selectOnly: false,
      isDragging: false,
      linkConnector: new LinkConnector(() => {})
    }
  }
}

const stateKey = Symbol('app mock state')

declare module 'vitest' {
  interface TestContext {
    [stateKey]?: AppState
  }
}

function state(): AppState {
  const test = TestRunner.getCurrentTest()
  assert.exists(test, 'Configure app state inside a test or beforeEach')
  return (test.context[stateKey] ??= createState())
}

export const app = {
  ...actions,
  get canvas() {
    return state().canvas
  },
  set canvas(value: Canvas) {
    state().canvas = value
  },
  get rootGraph() {
    const graph = state().rootGraph
    assert.exists(graph, 'The test has not initialized a root graph')
    return graph
  },
  set rootGraph(value: RealComfyApp['rootGraph']) {
    state().rootGraph = value
  },
  get rootGraphOrUndefined() {
    return state().rootGraph
  },
  set rootGraphOrUndefined(value: RealComfyApp['rootGraphOrUndefined']) {
    state().rootGraph = value
  },
  get graph(): RealComfyApp['rootGraphOrUndefined'] {
    return state().rootGraph
  },
  set graph(value: RealComfyApp['graph']) {
    state().rootGraph = value
  },
  get isGraphReady() {
    return state().rootGraph !== undefined
  },
  get nodeOutputs() {
    return state().nodeOutputs
  },
  set nodeOutputs(value: RealComfyApp['nodeOutputs']) {
    state().nodeOutputs = value
  },
  get nodePreviewImages() {
    return state().nodePreviewImages
  },
  set nodePreviewImages(value: RealComfyApp['nodePreviewImages']) {
    state().nodePreviewImages = value
  },
  get vueAppReady() {
    return state().vueAppReady
  },
  set vueAppReady(value: RealComfyApp['vueAppReady']) {
    state().vueAppReady = value
  },
  get configuringGraph() {
    return state().configuringGraph
  },
  set configuringGraph(value: RealComfyApp['configuringGraph']) {
    state().configuringGraph = value
  },
  get lastExecutionError() {
    return state().lastExecutionError
  },
  set lastExecutionError(value: RealComfyApp['lastExecutionError']) {
    state().lastExecutionError = value
  },
  get api() {
    return state().api
  },
  get ui() {
    return state().ui
  },
  get menu() {
    return state().menu
  },
  get extensionManager() {
    return state().extensionManager
  }
}

export const ComfyApp = {
  ...vi.mockObject<
    Pick<
      typeof RealComfyApp,
      | 'copyToClipspace'
      | 'onClipspaceEditorClosed'
      | 'onClipspaceEditorSave'
      | 'pasteFromClipspace'
    >
  >(
    {
      copyToClipspace() {},
      pasteFromClipspace() {},
      onClipspaceEditorSave() {},
      onClipspaceEditorClosed() {}
    },
    { spy: true }
  ),
  get clipspace() {
    return state().clipspace.clipspace
  },
  set clipspace(value: typeof RealComfyApp.clipspace) {
    state().clipspace.clipspace = value
  },
  get clipspace_return_node() {
    return state().clipspace.clipspace_return_node
  },
  set clipspace_return_node(value: typeof RealComfyApp.clipspace_return_node) {
    state().clipspace.clipspace_return_node = value
  }
}

export const sanitizeNodeName = vi.fn<typeof realSanitizeNodeName>(() => {
  assert.fail('Configure sanitizeNodeName for this test')
})

export const ANIM_PREVIEW_WIDGET: typeof realAnimationWidget =
  '$$comfy_animation_preview'
