/**
 * Type definitions for ComfyUI app objects accessed during stability checking
 */

// Slot interface for subgraph inputs/outputs
interface SubgraphSlot {
  name: string
  boundingRect?: [number, number, number, number] // [x, y, width, height]
  pos?: [number, number] // [x, y] position
}

// Subgraph extends LGraph with additional properties
interface Subgraph extends LGraph {
  constructor: { name: string }
  inputNode?: LGraphNode
  outputNode?: LGraphNode
  inputs?: SubgraphSlot[]
  outputs?: SubgraphSlot[]
}

// Extend existing LiteGraph types
declare module 'litegraph.js' {
  interface LGraph {
    dirty?: boolean
    inputNode?: LGraphNode
    outputNode?: LGraphNode
    inputs?: SubgraphSlot[]
    outputs?: SubgraphSlot[]
    nodes?: LGraphNode[]
    getNodeById?: (id: number) => LGraphNode | null
    slotAnchorX?: number
    constructor?: { name: string }
  }

  interface LGraphCanvas {
    isDragging?: boolean
    node_dragging?: boolean
    connecting?: boolean
    resizing?: boolean
    zooming?: boolean
    needs_redraw?: boolean
    render_requested?: boolean
    dirty_canvas?: boolean
    dirty_bgcanvas?: boolean
    animating?: boolean
    animations?: unknown[]
    el?: HTMLCanvasElement
    canvas?: HTMLCanvasElement
    graph?: LGraph
    ds?: {
      convertOffsetToCanvas?: (
        pos: [number, number]
      ) => [number, number] | Float32Array | Float64Array
      convertCanvasToOffset?: (
        pos: [number, number]
      ) => [number, number] | Float32Array | Float64Array
      scale?: number
      offset?: [number, number]
    }
    pointer?: {
      onDoubleClick?: (event: MouseEvent | PointerEvent) => void
    }
    linkConnector?: {
      node?: LGraphNode
      slot?: number
      type?: 'input' | 'output'
    }
  }

  interface LGraphNode {
    comboWidget?: {
      isRefreshing?: boolean
    }
    widgets?: Array<
      IBaseWidget<unknown, string, unknown> & {
        last_y?: number
        name?: string
        value?: unknown
      }
    >[]
    onPointerDown?: (
      event: PointerEvent,
      pointer: { x: number; y: number },
      linkConnector: unknown
    ) => void
    is_selected?: boolean
    id: number
    type: string
    title?: string
    getConnectionPos?: (
      isInput: boolean,
      slotIndex: number
    ) => [number, number] | Float32Array | Float64Array
    getBounding?: () =>
      | [number, number, number, number]
      | Float32Array
      | Float64Array
    inputs?: Array<{
      name?: string
      type?: string
      link?: number | null
      widget?: { name?: string }
      pos?: [number, number]
    }>
    outputs?: Array<{
      name?: string
      type?: string
      links?: number[]
      pos?: [number, number]
    }>
    pos?: [number, number] | Float32Array | Float64Array
    size?: [number, number] | Float32Array | Float64Array
    mode?: number
    flags?: { collapsed?: boolean; pinned?: boolean }
    disconnectInput?: (slotIndex: number) => void
    disconnectOutput?: (slotIndex: number) => void
  }

  interface IBaseWidget<T, K extends string, O> {
    isRemote?: boolean
    isLoading?: boolean
    pending?: boolean
    updating?: boolean
  }
}

// ExtensionManager is actually the workspace store (see src/views/GraphView.vue)
// This interface represents the runtime structure from useWorkspaceStore()
interface ExtensionManager {
  // Direct workspace store properties
  spinner?: boolean
  shiftDown?: boolean
  focusMode?: boolean

  // Computed store references from workspace store
  toast?: {
    add?: (message: {
      text: string
      type?: 'info' | 'success' | 'warn' | 'error'
    }) => void
    remove?: (id: string) => void
  }
  command?: {
    commands?: Array<{
      id: string
      function: () => void | Promise<void>
      label?: string | (() => string)
    }>
    execute?: (id: string) => Promise<void>
  }
  setting?: {
    settings?: Record<string, unknown>
    get?: (key: string) => unknown
    set?: (key: string, value: unknown) => Promise<void>
  }
  workflow?: {
    // From workflow store
    isBusy?: boolean
    syncWorkflows?: () => Promise<void>
    activeWorkflow?: {
      isModified?: boolean
      filename?: string
      changeTracker?: {
        undoQueue: Array<{ type: string; data: unknown }>
        redoQueue: Array<{ type: string; data: unknown }>
        checkState?: () => boolean
      }
      delete?: () => Promise<void>
    }
  }
  queueSettings?: {
    // From queue settings store
    batchCount?: number
    autoQueue?: boolean
    [key: string]: unknown
  }

  // Extensions-related properties (added during app initialization)
  isLoading?: boolean

  // Standard extension manager interface methods
  registerSidebarTab?: (tab: {
    id: string
    icon: string
    title: string
    component: unknown
  }) => void
  unregisterSidebarTab?: (id: string) => void
  getSidebarTabs?: () => Array<{
    id: string
    icon: string
    title: string
    component: unknown
  }>
}

interface ComfyWidget {
  isRemote?: boolean
  isLoading?: boolean
  pending?: boolean
  updating?: boolean
}

interface ComfyNode {
  widgets?: ComfyWidget[]
  comboWidget?: {
    isRefreshing?: boolean
  }
}

interface ComfyGraph {
  dirty?: boolean
  nodes?: ComfyNode[]
}

interface ComfyCanvas {
  rendering?: boolean
  is_rendering?: boolean
  canvas?: HTMLCanvasElement
  el?: HTMLCanvasElement

  // LiteGraph-specific properties
  dragging?: boolean
  isDragging?: boolean
  node_dragging?: boolean
  connecting?: boolean
  resizing?: boolean
  zooming?: boolean
  needs_redraw?: boolean
  render_requested?: boolean
  dirty_canvas?: boolean
  dirty_bgcanvas?: boolean
  animating?: boolean
  animations?: unknown[]
}

interface ComfyApp {
  graph?: ComfyGraph & LGraph
  canvas?: ComfyCanvas & LGraphCanvas
  extensionManager?: ExtensionManager
  ui?: {
    settings?: {
      addEventListener?: (
        event: string,
        callback: () => void,
        options?: AddEventListenerOptions
      ) => void
      getSettingValue?: (setting: string) => Promise<unknown>
    }
  }
  registerExtension?: (extension: {
    name: string
    init?: () => void
    settings?: Array<{ id: string; [key: string]: any }>
  }) => void
  graphToPrompt?: () => Promise<{ workflow: unknown; output: unknown }>
  canvasPosToClientPos?: (
    pos: [number, number]
  ) => [number, number] | Float32Array | Float64Array
}

interface CanvasStabilityTracker {
  renderingHistory: Array<{
    time: number
    rendering: boolean
  }>
  lastCheckTime: number
}

interface CanvasStabilityPerf {
  lastCheckTime: number
  longTaskCount: number
}

interface CanvasStabilityDimensions {
  width: number
  height: number
  styleWidth: string
  styleHeight: string
  pixelRatio: number
}

// Import the real type for proper usage
type CanvasPointerEvent =
  import('@/lib/litegraph/src/types/events').CanvasPointerEvent

declare global {
  interface Window {
    app?: ComfyApp
    __canvasStabilityTracker?: CanvasStabilityTracker
    __canvasStabilityPerf?: CanvasStabilityPerf
    __canvasStabilityDimensions?: CanvasStabilityDimensions
  }

  // Alternative access pattern for browser tests
  var app: ComfyApp | undefined
}

// Export the Subgraph type for use in other files
export { Subgraph }

export {}
