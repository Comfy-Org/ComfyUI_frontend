import type { ContextMenu } from "./ContextMenu"
import type { CustomEventDispatcher, ICustomEventTarget } from "./infrastructure/CustomEventTarget"
import type { LGraphCanvasEventMap } from "./infrastructure/LGraphCanvasEventMap"
import type {
  CanvasColour,
  ColorOption,
  ConnectingLink,
  ContextMenuDivElement,
  DefaultConnectionColors,
  Dictionary,
  Direction,
  IBoundaryNodes,
  IColorable,
  IContextMenuOptions,
  IContextMenuValue,
  INodeInputSlot,
  INodeOutputSlot,
  INodeSlot,
  INodeSlotContextItem,
  ISlotType,
  LinkSegment,
  NullableProperties,
  Point,
  Positionable,
  ReadOnlyPoint,
  ReadOnlyRect,
  Rect,
  Size,
} from "./interfaces"
import type { LGraph } from "./LGraph"
import type {
  CanvasMouseEvent,
  CanvasPointerEvent,
  CanvasPointerExtensions,
} from "./types/events"
import type { ClipboardItems, SubgraphIO } from "./types/serialisation"
import type { NeverNever } from "./types/utility"
import type { PickNevers } from "./types/utility"
import type { IBaseWidget } from "./types/widgets"

import { LinkConnector } from "@/canvas/LinkConnector"

import { isOverNodeInput, isOverNodeOutput } from "./canvas/measureSlots"
import { CanvasPointer } from "./CanvasPointer"
import { type AnimationOptions, DragAndScale } from "./DragAndScale"
import { strokeShape } from "./draw"
import { NullGraphError } from "./infrastructure/NullGraphError"
import { LGraphGroup } from "./LGraphGroup"
import { LGraphNode, type NodeId, type NodeProperty } from "./LGraphNode"
import { LiteGraph, Rectangle, SubgraphNode } from "./litegraph"
import { type LinkId, LLink } from "./LLink"
import {
  containsRect,
  createBounds,
  distance,
  findPointOnCurve,
  isInRect,
  isInRectangle,
  isPointInRect,
  overlapBounding,
  snapPoint,
} from "./measure"
import { NodeInputSlot } from "./node/NodeInputSlot"
import { Reroute, type RerouteId } from "./Reroute"
import { stringOrEmpty } from "./strings"
import { Subgraph } from "./subgraph/Subgraph"
import { SubgraphInputNode } from "./subgraph/SubgraphInputNode"
import { SubgraphIONodeBase } from "./subgraph/SubgraphIONodeBase"
import { SubgraphOutputNode } from "./subgraph/SubgraphOutputNode"
import {
  CanvasItem,
  LGraphEventMode,
  LinkDirection,
  LinkMarkerShape,
  LinkRenderType,
  RenderShape,
  TitleMode,
} from "./types/globalEnums"
import { alignNodes, distributeNodes, getBoundaryNodes } from "./utils/arrange"
import { findFirstNode, getAllNestedItems } from "./utils/collections"
import { BaseWidget } from "./widgets/BaseWidget"
import { toConcreteWidget } from "./widgets/widgetMap"

interface IShowSearchOptions {
  node_to?: LGraphNode | null
  node_from?: LGraphNode | null
  slot_from: number | INodeOutputSlot | INodeInputSlot | null | undefined
  type_filter_in?: ISlotType
  type_filter_out?: ISlotType | false

  // TODO check for registered_slot_[in/out]_types not empty // this will be checked for functionality enabled : filter on slot type, in and out
  do_type_filter?: boolean
  show_general_if_none_on_typefilter?: boolean
  show_general_after_typefiltered?: boolean
  hide_on_mouse_leave?: boolean
  show_all_if_empty?: boolean
  show_all_on_open?: boolean
}

interface ICreateNodeOptions {
  /** input */
  nodeFrom?: SubgraphInputNode | LGraphNode | null
  /** input */
  slotFrom?: number | INodeOutputSlot | INodeInputSlot | SubgraphIO | null
  /** output */
  nodeTo?: SubgraphOutputNode | LGraphNode | null
  /** output */
  slotTo?: number | INodeOutputSlot | INodeInputSlot | SubgraphIO | null
  /** pass the event coords */

  /** Create the connection from a reroute */
  afterRerouteId?: RerouteId

  // FIXME: Should not be optional
  /** choose a nodetype to add, AUTO to set at first good */
  nodeType?: string
  e?: CanvasMouseEvent
  allow_searchbox?: boolean
}

interface ICreateDefaultNodeOptions extends ICreateNodeOptions {
  /** Position of new node */
  position: Point
  /** adjust x,y */
  posAdd?: Point
  /** alpha, adjust the position x,y based on the new node size w,h */
  posSizeFix?: Point
}

interface HasShowSearchCallback {
  /** See {@link LGraphCanvas.showSearchBox} */
  showSearchBox: (
    event: MouseEvent,
    options?: IShowSearchOptions,
  ) => HTMLDivElement | void
}

interface ICloseable {
  close(): void
}

interface IDialogExtensions extends ICloseable {
  modified(): void
  is_modified: boolean
}

interface IDialog extends HTMLDivElement, IDialogExtensions {}
type PromptDialog = Omit<IDialog, "modified">

interface IDialogOptions {
  position?: Point
  event?: MouseEvent
  checkForInput?: boolean
  closeOnLeave?: boolean
  onclose?(): void
}

/** @inheritdoc {@link LGraphCanvas.state} */
export interface LGraphCanvasState {
  /** {@link Positionable} items are being dragged on the canvas. */
  draggingItems: boolean
  /** The canvas itself is being dragged. */
  draggingCanvas: boolean
  /** The canvas is read-only, preventing changes to nodes, disconnecting links, moving items, etc. */
  readOnly: boolean

  /** Bit flags indicating what is currently below the pointer. */
  hoveringOver: CanvasItem
  /** If `true`, pointer move events will set the canvas cursor style. */
  shouldSetCursor: boolean

  /**
   * Dirty flag indicating that {@link selectedItems} has changed.
   * Downstream consumers may reset to false once actioned.
   */
  selectionChanged: boolean
}

/**
 * The items created by a clipboard paste operation.
 * Includes maps of original copied IDs to newly created items.
 */
interface ClipboardPasteResult {
  /** All successfully created items */
  created: Positionable[]
  /** Map: original node IDs to newly created nodes */
  nodes: Map<NodeId, LGraphNode>
  /** Map: original link IDs to new link IDs */
  links: Map<LinkId, LLink>
  /** Map: original reroute IDs to newly created reroutes */
  reroutes: Map<RerouteId, Reroute>
}

/** Options for {@link LGraphCanvas.pasteFromClipboard}. */
interface IPasteFromClipboardOptions {
  /** If `true`, always attempt to connect inputs of pasted nodes - including to nodes that were not pasted. */
  connectInputs?: boolean
  /** The position to paste the items at. */
  position?: Point
}

interface ICreatePanelOptions {
  closable?: any
  window?: any
  onOpen?: () => void
  onClose?: () => void
  width?: any
  height?: any
}

const cursors = {
  NE: "nesw-resize",
  SE: "nwse-resize",
  SW: "nesw-resize",
  NW: "nwse-resize",
} as const

/**
 * This class is in charge of rendering one graph inside a canvas. And provides all the interaction required.
 * Valid callbacks are: onNodeSelected, onNodeDeselected, onShowNodePanel, onNodeDblClicked
 */
export class LGraphCanvas implements CustomEventDispatcher<LGraphCanvasEventMap> {
  // Optimised buffers used during rendering
  static #temp = new Float32Array(4)
  static #temp_vec2 = new Float32Array(2)
  static #tmp_area = new Float32Array(4)
  static #margin_area = new Float32Array(4)
  static #link_bounding = new Float32Array(4)
  static #lTempA: Point = new Float32Array(2)
  static #lTempB: Point = new Float32Array(2)
  static #lTempC: Point = new Float32Array(2)

  static DEFAULT_BACKGROUND_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQBJREFUeNrs1rEKwjAUhlETUkj3vP9rdmr1Ysammk2w5wdxuLgcMHyptfawuZX4pJSWZTnfnu/lnIe/jNNxHHGNn//HNbbv+4dr6V+11uF527arU7+u63qfa/bnmh8sWLBgwYJlqRf8MEptXPBXJXa37BSl3ixYsGDBMliwFLyCV/DeLIMFCxYsWLBMwSt4Be/NggXLYMGCBUvBK3iNruC9WbBgwYJlsGApeAWv4L1ZBgsWLFiwYJmCV/AK3psFC5bBggULloJX8BpdwXuzYMGCBctgwVLwCl7Be7MMFixYsGDBsu8FH1FaSmExVfAxBa/gvVmwYMGCZbBg/W4vAQYA5tRF9QYlv/QAAAAASUVORK5CYII="

  static DEFAULT_EVENT_LINK_COLOR = "#A86"

  /** Link type to colour dictionary. */
  static link_type_colors: Dictionary<string> = {
    "-1": LGraphCanvas.DEFAULT_EVENT_LINK_COLOR,
    "number": "#AAA",
    "node": "#DCA",
  }

  static gradients: Record<string, CanvasGradient> = {}

  static search_limit = -1
  static node_colors: Record<string, ColorOption> = {
    red: { color: "#322", bgcolor: "#533", groupcolor: "#A88" },
    brown: { color: "#332922", bgcolor: "#593930", groupcolor: "#b06634" },
    green: { color: "#232", bgcolor: "#353", groupcolor: "#8A8" },
    blue: { color: "#223", bgcolor: "#335", groupcolor: "#88A" },
    pale_blue: {
      color: "#2a363b",
      bgcolor: "#3f5159",
      groupcolor: "#3f789e",
    },
    cyan: { color: "#233", bgcolor: "#355", groupcolor: "#8AA" },
    purple: { color: "#323", bgcolor: "#535", groupcolor: "#a1309b" },
    yellow: { color: "#432", bgcolor: "#653", groupcolor: "#b58b2a" },
    black: { color: "#222", bgcolor: "#000", groupcolor: "#444" },
  }

  /**
   * @internal Exclusively a workaround for design limitation in {@link LGraphNode.computeSize}.
   */
  static _measureText?: (text: string, fontStyle?: string) => number

  /**
   * The state of this canvas, e.g. whether it is being dragged, or read-only.
   *
   * Implemented as a POCO that can be proxied without side-effects.
   */
  state: LGraphCanvasState = {
    draggingItems: false,
    draggingCanvas: false,
    readOnly: false,
    hoveringOver: CanvasItem.Nothing,
    shouldSetCursor: true,
    selectionChanged: false,
  }

  #subgraph?: Subgraph
  get subgraph(): Subgraph | undefined {
    return this.#subgraph
  }

  set subgraph(value: Subgraph | undefined) {
    if (value !== this.#subgraph) {
      this.#subgraph = value
      if (value) this.dispatch("litegraph:set-graph", { oldGraph: this.#subgraph, newGraph: value })
    }
  }

  /** Dispatches a custom event on the canvas. */
  dispatch<T extends keyof NeverNever<LGraphCanvasEventMap>>(type: T, detail: LGraphCanvasEventMap[T]): boolean
  dispatch<T extends keyof PickNevers<LGraphCanvasEventMap>>(type: T): boolean
  dispatch<T extends keyof LGraphCanvasEventMap>(type: T, detail?: LGraphCanvasEventMap[T]) {
    const event = new CustomEvent(type as string, { detail, bubbles: true })
    return this.canvas.dispatchEvent(event)
  }

  dispatchEvent<TEvent extends keyof LGraphCanvasEventMap>(type: TEvent, detail: LGraphCanvasEventMap[TEvent]) {
    this.canvas.dispatchEvent(new CustomEvent(type, { detail }))
  }

  #updateCursorStyle() {
    if (!this.state.shouldSetCursor) return

    const crosshairItems =
      CanvasItem.Node |
      CanvasItem.RerouteSlot |
      CanvasItem.SubgraphIoNode |
      CanvasItem.SubgraphIoSlot

    let cursor = "default"
    if (this.state.draggingCanvas) {
      cursor = "grabbing"
    } else if (this.state.readOnly) {
      cursor = "grab"
    } else if (this.pointer.resizeDirection) {
      cursor = cursors[this.pointer.resizeDirection] ?? cursors.SE
    } else if (this.state.hoveringOver & crosshairItems) {
      cursor = "crosshair"
    } else if (this.state.hoveringOver & CanvasItem.Reroute) {
      cursor = "grab"
    }

    this.canvas.style.cursor = cursor
  }

  // Whether the canvas was previously being dragged prior to pressing space key.
  // null if space key is not pressed.
  private _previously_dragging_canvas: boolean | null = null

  // #region Legacy accessors
  /** @deprecated @inheritdoc {@link LGraphCanvasState.readOnly} */
  get read_only(): boolean {
    return this.state.readOnly
  }

  set read_only(value: boolean) {
    this.state.readOnly = value
    this.#updateCursorStyle()
  }

  get isDragging(): boolean {
    return this.state.draggingItems
  }

  set isDragging(value: boolean) {
    this.state.draggingItems = value
  }

  get hoveringOver(): CanvasItem {
    return this.state.hoveringOver
  }

  set hoveringOver(value: CanvasItem) {
    this.state.hoveringOver = value
    this.#updateCursorStyle()
  }

  /** @deprecated Replace all references with {@link pointer}.{@link CanvasPointer.isDown isDown}. */
  get pointer_is_down() {
    return this.pointer.isDown
  }

  /** @deprecated Replace all references with {@link pointer}.{@link CanvasPointer.isDouble isDouble}. */
  get pointer_is_double() {
    return this.pointer.isDouble
  }

  /** @deprecated @inheritdoc {@link LGraphCanvasState.draggingCanvas} */
  get dragging_canvas(): boolean {
    return this.state.draggingCanvas
  }

  set dragging_canvas(value: boolean) {
    this.state.draggingCanvas = value
    this.#updateCursorStyle()
  }

  /**
   * @deprecated Use {@link LGraphNode.titleFontStyle} instead.
   */
  get title_text_font(): string {
    return `${LiteGraph.NODE_TEXT_SIZE}px ${LiteGraph.NODE_FONT}`
  }
  // #endregion Legacy accessors

  get inner_text_font(): string {
    return `normal ${LiteGraph.NODE_SUBTEXT_SIZE}px ${LiteGraph.NODE_FONT}`
  }

  #maximumFrameGap = 0
  /** Maximum frames per second to render. 0: unlimited. Default: 0 */
  public get maximumFps() {
    return this.#maximumFrameGap > Number.EPSILON ? this.#maximumFrameGap / 1000 : 0
  }

  public set maximumFps(value) {
    this.#maximumFrameGap = value > Number.EPSILON ? 1000 / value : 0
  }

  /**
   * @deprecated Use {@link LiteGraphGlobal.ROUND_RADIUS} instead.
   */
  get round_radius() {
    return LiteGraph.ROUND_RADIUS
  }

  /**
   * @deprecated Use {@link LiteGraphGlobal.ROUND_RADIUS} instead.
   */
  set round_radius(value: number) {
    LiteGraph.ROUND_RADIUS = value
  }

  /**
   * Render low quality when zoomed out.
   */
  get low_quality(): boolean {
    return this.ds.scale < this.low_quality_zoom_threshold
  }

  options: {
    skip_events?: any
    viewport?: any
    skip_render?: any
    autoresize?: any
  }

  background_image: string
  readonly ds: DragAndScale
  readonly pointer: CanvasPointer
  zoom_modify_alpha: boolean
  zoom_speed: number
  node_title_color: string
  default_link_color: string
  default_connection_color: {
    input_off: string
    input_on: string
    output_off: string
    output_on: string
  }

  default_connection_color_byType: Dictionary<CanvasColour>
  default_connection_color_byTypeOff: Dictionary<CanvasColour>

  /** Gets link colours. Extremely basic impl. until the legacy object dictionaries are removed. */
  colourGetter: DefaultConnectionColors = {
    getConnectedColor: (type: string) =>
      this.default_connection_color_byType[type] ||
      this.default_connection_color.output_on,
    getDisconnectedColor: (type: string) =>
      this.default_connection_color_byTypeOff[type] ||
      this.default_connection_color_byType[type] ||
      this.default_connection_color.output_off,
  }

  highquality_render: boolean
  use_gradients: boolean
  editor_alpha: number
  pause_rendering: boolean
  clear_background: boolean
  clear_background_color: string
  render_only_selected: boolean
  show_info: boolean
  allow_dragcanvas: boolean
  allow_dragnodes: boolean
  allow_interaction: boolean
  multi_select: boolean
  allow_searchbox: boolean
  allow_reconnect_links: boolean
  align_to_grid: boolean
  drag_mode: boolean
  dragging_rectangle: Rect | null
  filter?: string | null
  set_canvas_dirty_on_mouse_event: boolean
  always_render_background: boolean
  render_shadows: boolean
  render_canvas_border: boolean
  render_connections_shadows: boolean
  render_connections_border: boolean
  render_curved_connections: boolean
  render_connection_arrows: boolean
  render_collapsed_slots: boolean
  render_execution_order: boolean
  render_link_tooltip: boolean

  /** Shape of the markers shown at the midpoint of links.  Default: Circle */
  linkMarkerShape: LinkMarkerShape = LinkMarkerShape.Circle
  links_render_mode: number
  /** Zoom threshold for low quality rendering. Zoom below this threshold will render low quality. */
  low_quality_zoom_threshold: number = 0.6
  /** mouse in canvas coordinates, where 0,0 is the top-left corner of the blue rectangle */
  readonly mouse: Point
  /** mouse in graph coordinates, where 0,0 is the top-left corner of the blue rectangle */
  readonly graph_mouse: Point
  /** @deprecated LEGACY: REMOVE THIS, USE {@link graph_mouse} INSTEAD */
  canvas_mouse: Point
  /** to personalize the search box */
  onSearchBox?: (helper: Element, str: string, canvas: LGraphCanvas) => any
  onSearchBoxSelection?: (name: any, event: any, canvas: LGraphCanvas) => void
  onMouse?: (e: CanvasMouseEvent) => boolean
  /** to render background objects (behind nodes and connections) in the canvas affected by transform */
  onDrawBackground?: (ctx: CanvasRenderingContext2D, visible_area: any) => void
  /** to render foreground objects (above nodes and connections) in the canvas affected by transform */
  onDrawForeground?: (arg0: CanvasRenderingContext2D, arg1: any) => void
  connections_width: number
  /** The current node being drawn by {@link drawNode}.  This should NOT be used to determine the currently selected node.  See {@link selectedItems} */
  current_node: LGraphNode | null
  /** used for widgets */
  node_widget?: [LGraphNode, IBaseWidget] | null
  /** The link to draw a tooltip for. */
  over_link_center?: LinkSegment
  last_mouse_position: Point
  /** The visible area of this canvas.  Tightly coupled with {@link ds}. */
  visible_area: Rectangle
  /** Contains all links and reroutes that were rendered.  Repopulated every render cycle. */
  renderedPaths: Set<LinkSegment> = new Set()
  /** @deprecated Replaced by {@link renderedPaths}, but length is set to 0 by some extensions. */
  visible_links: LLink[] = []
  /** @deprecated This array is populated and cleared to support legacy extensions. The contents are ignored by Litegraph. */
  connecting_links: ConnectingLink[] | null
  linkConnector = new LinkConnector(links => this.connecting_links = links)
  /** The viewport of this canvas.  Tightly coupled with {@link ds}. */
  readonly viewport?: Rect
  autoresize: boolean
  static active_canvas: LGraphCanvas
  frame = 0
  last_draw_time = 0
  render_time = 0
  fps = 0
  /** @deprecated See {@link LGraphCanvas.selectedItems} */
  selected_nodes: Dictionary<LGraphNode> = {}
  /** All selected nodes, groups, and reroutes */
  selectedItems: Set<Positionable> = new Set()
  /** The group currently being resized. */
  resizingGroup: LGraphGroup | null = null
  /** @deprecated See {@link LGraphCanvas.selectedItems} */
  selected_group: LGraphGroup | null = null
  /** The nodes that are currently visible on the canvas. */
  visible_nodes: LGraphNode[] = []
  /**
   * The IDs of the nodes that are currently visible on the canvas. More
   * performant than {@link visible_nodes} for visibility checks.
   */
  #visible_node_ids: Set<NodeId> = new Set()
  node_over?: LGraphNode
  node_capturing_input?: LGraphNode | null
  highlighted_links: Dictionary<boolean> = {}

  #visibleReroutes: Set<Reroute> = new Set()

  dirty_canvas: boolean = true
  dirty_bgcanvas: boolean = true
  /** A map of nodes that require selective-redraw */
  dirty_nodes = new Map<NodeId, LGraphNode>()
  dirty_area?: Rect | null
  /** @deprecated Unused */
  node_in_panel?: LGraphNode | null
  last_mouse: ReadOnlyPoint = [0, 0]
  last_mouseclick: number = 0
  graph: LGraph | Subgraph | null
  get _graph(): LGraph | Subgraph {
    if (!this.graph) throw new NullGraphError()
    return this.graph
  }

  canvas: HTMLCanvasElement & ICustomEventTarget<LGraphCanvasEventMap>
  bgcanvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  _events_binded?: boolean
  _mousedown_callback?(e: PointerEvent): void
  _mousewheel_callback?(e: WheelEvent): void
  _mousemove_callback?(e: PointerEvent): void
  _mouseup_callback?(e: PointerEvent): void
  _mouseout_callback?(e: PointerEvent): void
  _mousecancel_callback?(e: PointerEvent): void
  _key_callback?(e: KeyboardEvent): void
  bgctx?: CanvasRenderingContext2D | null
  is_rendering?: boolean
  /** @deprecated Panels */
  block_click?: boolean
  /** @deprecated Panels */
  last_click_position?: Point | null
  resizing_node?: LGraphNode | null
  /** @deprecated See {@link LGraphCanvas.resizingGroup} */
  selected_group_resizing?: boolean
  /** @deprecated See {@link pointer}.{@link CanvasPointer.dragStarted dragStarted} */
  last_mouse_dragging?: boolean
  onMouseDown?: (arg0: CanvasMouseEvent) => void
  _highlight_pos?: Point
  _highlight_input?: INodeInputSlot
  // TODO: Check if panels are used
  /** @deprecated Panels */
  node_panel?: any
  /** @deprecated Panels */
  options_panel?: any
  _bg_img?: HTMLImageElement
  _pattern?: CanvasPattern
  _pattern_img?: HTMLImageElement
  // TODO: This looks like another panel thing
  prompt_box?: PromptDialog | null
  search_box?: HTMLDivElement
  /** @deprecated Panels */
  SELECTED_NODE?: LGraphNode
  /** @deprecated Panels */
  NODEPANEL_IS_OPEN?: boolean

  /** Once per frame check of snap to grid value.  @todo Update on change. */
  #snapToGrid?: number
  /** Set on keydown, keyup. @todo */
  #shiftDown: boolean = false

  /** If true, enable drag zoom. Ctrl+Shift+Drag Up/Down: zoom canvas. */
  dragZoomEnabled: boolean = false
  /** The start position of the drag zoom. */
  #dragZoomStart: { pos: Point, scale: number } | null = null

  getMenuOptions?(): IContextMenuValue<string>[]
  getExtraMenuOptions?(
    canvas: LGraphCanvas,
    options: IContextMenuValue<string>[],
  ): IContextMenuValue<string>[]
  static active_node: LGraphNode
  /** called before modifying the graph */
  onBeforeChange?(graph: LGraph): void
  /** called after modifying the graph */
  onAfterChange?(graph: LGraph): void
  onClear?: () => void
  /** called after moving a node @deprecated Does not handle multi-node move, and can return the wrong node. */
  onNodeMoved?: (node_dragged: LGraphNode | undefined) => void
  /** @deprecated Called with the deprecated {@link selected_nodes} when the selection changes. Replacement not yet impl. */
  onSelectionChange?: (selected: Dictionary<Positionable>) => void
  /** called when rendering a tooltip */
  onDrawLinkTooltip?: (
    ctx: CanvasRenderingContext2D,
    link: LLink | null,
    canvas?: LGraphCanvas,
  ) => boolean

  /** to render foreground objects not affected by transform (for GUIs) */
  onDrawOverlay?: (ctx: CanvasRenderingContext2D) => void
  onRenderBackground?: (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
  ) => boolean

  onNodeDblClicked?: (n: LGraphNode) => void
  onShowNodePanel?: (n: LGraphNode) => void
  onNodeSelected?: (node: LGraphNode) => void
  onNodeDeselected?: (node: LGraphNode) => void
  onRender?: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void

  /**
   * Creates a new instance of LGraphCanvas.
   * @param canvas The canvas HTML element (or its id) to use, or null / undefined to leave blank.
   * @param graph The graph that owns this canvas.
   * @param options
   */
  constructor(
    canvas: HTMLCanvasElement,
    graph: LGraph,
    options?: LGraphCanvas["options"],
  ) {
    options ||= {}
    this.options = options

    // if(graph === undefined)
    // throw ("No graph assigned");
    this.background_image = LGraphCanvas.DEFAULT_BACKGROUND_IMAGE

    this.ds = new DragAndScale(canvas)
    this.pointer = new CanvasPointer(canvas)

    this.linkConnector.events.addEventListener("link-created", () => this.#dirty())

    // @deprecated Workaround: Keep until connecting_links is removed.
    this.linkConnector.events.addEventListener("reset", () => {
      this.connecting_links = null
      this.dirty_bgcanvas = true
    })

    // Dropped a link on the canvas
    this.linkConnector.events.addEventListener("dropped-on-canvas", (customEvent) => {
      if (!this.connecting_links) return

      const e = customEvent.detail
      this.emitEvent({
        subType: "empty-release",
        originalEvent: e,
        linkReleaseContext: { links: this.connecting_links },
      })

      const firstLink = this.linkConnector.renderLinks[0]

      // No longer in use
      // add menu when releasing link in empty space
      if (LiteGraph.release_link_on_empty_shows_menu) {
        const linkReleaseContext = this.linkConnector.state.connectingTo === "input"
          ? {
            node_from: firstLink.node as LGraphNode,
            slot_from: firstLink.fromSlot as INodeOutputSlot,
            type_filter_in: firstLink.fromSlot.type,
          }
          : {
            node_to: firstLink.node as LGraphNode,
            slot_to: firstLink.fromSlot as INodeInputSlot,
            type_filter_out: firstLink.fromSlot.type,
          }

        const afterRerouteId = firstLink.fromReroute?.id

        if ("shiftKey" in e && e.shiftKey) {
          if (this.allow_searchbox) {
            this.showSearchBox(e as unknown as MouseEvent, linkReleaseContext as IShowSearchOptions)
          }
        } else if (this.linkConnector.state.connectingTo === "input") {
          this.showConnectionMenu({ nodeFrom: firstLink.node as LGraphNode, slotFrom: firstLink.fromSlot as INodeOutputSlot, e, afterRerouteId })
        } else {
          this.showConnectionMenu({ nodeTo: firstLink.node as LGraphNode, slotTo: firstLink.fromSlot as INodeInputSlot, e, afterRerouteId })
        }
      }
    })

    // otherwise it generates ugly patterns when scaling down too much
    this.zoom_modify_alpha = true
    // in range (1.01, 2.5). Less than 1 will invert the zoom direction
    this.zoom_speed = 1.1

    this.node_title_color = LiteGraph.NODE_TITLE_COLOR
    this.default_link_color = LiteGraph.LINK_COLOR
    this.default_connection_color = {
      input_off: "#778",
      input_on: "#7F7",
      output_off: "#778",
      output_on: "#7F7",
    }
    this.default_connection_color_byType = {
      /* number: "#7F7",
            string: "#77F",
            boolean: "#F77", */
    }
    this.default_connection_color_byTypeOff = {
      /* number: "#474",
            string: "#447",
            boolean: "#744", */
    }

    this.highquality_render = true
    // set to true to render titlebar with gradients
    this.use_gradients = false
    // used for transition
    this.editor_alpha = 1
    this.pause_rendering = false
    this.clear_background = true
    this.clear_background_color = "#222"

    this.render_only_selected = true
    this.show_info = true
    this.allow_dragcanvas = true
    this.allow_dragnodes = true
    // allow to control widgets, buttons, collapse, etc
    this.allow_interaction = true
    // allow selecting multi nodes without pressing extra keys
    this.multi_select = false
    this.allow_searchbox = true
    // allows to change a connection with having to redo it again
    this.allow_reconnect_links = true
    // snap to grid
    this.align_to_grid = false

    this.drag_mode = false
    this.dragging_rectangle = null

    // allows to filter to only accept some type of nodes in a graph
    this.filter = null

    // forces to redraw the canvas on mouse events (except move)
    this.set_canvas_dirty_on_mouse_event = true
    this.always_render_background = false
    this.render_shadows = true
    this.render_canvas_border = true
    // too much cpu
    this.render_connections_shadows = false
    this.render_connections_border = true
    this.render_curved_connections = false
    this.render_connection_arrows = false
    this.render_collapsed_slots = true
    this.render_execution_order = false
    this.render_link_tooltip = true

    this.links_render_mode = LinkRenderType.SPLINE_LINK

    this.mouse = [0, 0]
    this.graph_mouse = [0, 0]
    this.canvas_mouse = this.graph_mouse

    this.connections_width = 3

    this.current_node = null
    this.node_widget = null
    this.last_mouse_position = [0, 0]
    this.visible_area = this.ds.visible_area
    // Explicitly null-checked
    this.connecting_links = null

    // to constraint render area to a portion of the canvas
    this.viewport = options.viewport || null

    // link canvas and graph
    this.graph = graph
    graph?.attachCanvas(this)

    // TypeScript strict workaround: cannot use method to initialize properties.
    this.canvas = undefined!
    this.bgcanvas = undefined!
    this.ctx = undefined!

    this.setCanvas(canvas, options.skip_events)
    this.clear()

    LGraphCanvas._measureText = (text: string, fontStyle = this.inner_text_font) => {
      const { ctx } = this
      const { font } = ctx
      try {
        ctx.font = fontStyle
        return ctx.measureText(text).width
      } finally {
        ctx.font = font
      }
    }

    if (!options.skip_render) {
      this.startRendering()
    }

    this.autoresize = options.autoresize
  }

  static onGroupAdd(info: unknown, entry: unknown, mouse_event: MouseEvent): void {
    const canvas = LGraphCanvas.active_canvas

    const group = new LiteGraph.LGraphGroup()
    group.pos = canvas.convertEventToCanvasOffset(mouse_event)
    if (!canvas.graph) throw new NullGraphError()
    canvas.graph.add(group)
  }

  /**
   * @deprecated Functionality moved to {@link getBoundaryNodes}.  The new function returns null on failure, instead of an object with all null properties.
   * Determines the furthest nodes in each direction
   * @param nodes the nodes to from which boundary nodes will be extracted
   * @returns
   */
  static getBoundaryNodes(
    nodes: LGraphNode[] | Dictionary<LGraphNode>,
  ): NullableProperties<IBoundaryNodes> {
    const _nodes = Array.isArray(nodes) ? nodes : Object.values(nodes)
    return (
      getBoundaryNodes(_nodes) ?? {
        top: null,
        right: null,
        bottom: null,
        left: null,
      }
    )
  }

  /**
   * @deprecated Functionality moved to {@link alignNodes}.  The new function does not set dirty canvas.
   * @param nodes a list of nodes
   * @param direction Direction to align the nodes
   * @param align_to Node to align to (if null, align to the furthest node in the given direction)
   */
  static alignNodes(
    nodes: Dictionary<LGraphNode>,
    direction: Direction,
    align_to?: LGraphNode,
  ): void {
    alignNodes(Object.values(nodes), direction, align_to)
    LGraphCanvas.active_canvas.setDirty(true, true)
  }

  static onNodeAlign(
    value: IContextMenuValue,
    options: IContextMenuOptions,
    event: MouseEvent,
    prev_menu: ContextMenu<string>,
    node: LGraphNode,
  ): void {
    new LiteGraph.ContextMenu(["Top", "Bottom", "Left", "Right"], {
      event,
      callback: inner_clicked,
      parentMenu: prev_menu,
    })

    function inner_clicked(value: string) {
      alignNodes(
        Object.values(LGraphCanvas.active_canvas.selected_nodes),
        value.toLowerCase() as Direction,
        node,
      )
      LGraphCanvas.active_canvas.setDirty(true, true)
    }
  }

  static onGroupAlign(
    value: IContextMenuValue,
    options: IContextMenuOptions,
    event: MouseEvent,
    prev_menu: ContextMenu<string>,
  ): void {
    new LiteGraph.ContextMenu(["Top", "Bottom", "Left", "Right"], {
      event,
      callback: inner_clicked,
      parentMenu: prev_menu,
    })

    function inner_clicked(value: string) {
      alignNodes(
        Object.values(LGraphCanvas.active_canvas.selected_nodes),
        value.toLowerCase() as Direction,
      )
      LGraphCanvas.active_canvas.setDirty(true, true)
    }
  }

  static createDistributeMenu(
    value: IContextMenuValue,
    options: IContextMenuOptions,
    event: MouseEvent,
    prev_menu: ContextMenu<string>,
  ): void {
    new LiteGraph.ContextMenu(["Vertically", "Horizontally"], {
      event,
      callback: inner_clicked,
      parentMenu: prev_menu,
    })

    function inner_clicked(value: string) {
      const canvas = LGraphCanvas.active_canvas
      distributeNodes(Object.values(canvas.selected_nodes), value === "Horizontally")
      canvas.setDirty(true, true)
    }
  }

  static onMenuAdd(
    value: unknown,
    options: unknown,
    e: MouseEvent,
    prev_menu?: ContextMenu<string>,
    callback?: (node: LGraphNode | null) => void,
  ): boolean | undefined {
    const canvas = LGraphCanvas.active_canvas
    const ref_window = canvas.getCanvasWindow()
    const { graph } = canvas
    if (!graph) return

    inner_onMenuAdded("", prev_menu)
    return false

    type AddNodeMenu = Omit<IContextMenuValue<string>, "callback"> & {
      callback: (
        value: { value: string },
        event: Event,
        mouseEvent: MouseEvent,
        contextMenu: ContextMenu<string>
      ) => void
    }

    function inner_onMenuAdded(base_category: string, prev_menu?: ContextMenu<string>): void {
      if (!graph) return

      const categories = LiteGraph
        .getNodeTypesCategories(canvas.filter || graph.filter)
        .filter(category => category.startsWith(base_category))
      const entries: AddNodeMenu[] = []

      for (const category of categories) {
        if (!category) continue

        const base_category_regex = new RegExp(`^(${base_category})`)
        const category_name = category
          .replace(base_category_regex, "")
          .split("/", 1)[0]
        const category_path =
          base_category === ""
            ? `${category_name}/`
            : `${base_category}${category_name}/`

        let name = category_name
        // in case it has a namespace like "shader::math/rand" it hides the namespace
        if (name.includes("::")) name = name.split("::", 2)[1]

        const index = entries.findIndex(entry => entry.value === category_path)
        if (index === -1) {
          entries.push({
            value: category_path,
            content: name,
            has_submenu: true,
            callback: function (value, event, mouseEvent, contextMenu) {
              inner_onMenuAdded(value.value, contextMenu)
            },
          })
        }
      }

      const nodes = LiteGraph.getNodeTypesInCategory(
        base_category.slice(0, -1),
        canvas.filter || graph.filter,
      )

      for (const node of nodes) {
        if (node.skip_list) continue

        const entry: AddNodeMenu = {
          value: node.type,
          content: node.title,
          has_submenu: false,
          callback: function (value, event, mouseEvent, contextMenu) {
            if (!canvas.graph) throw new NullGraphError()

            const first_event = contextMenu.getFirstEvent()
            canvas.graph.beforeChange()
            const node = LiteGraph.createNode(value.value)
            if (node) {
              if (!first_event) throw new TypeError("Context menu event was null. This should not occur in normal usage.")
              node.pos = canvas.convertEventToCanvasOffset(first_event)
              canvas.graph.add(node)
            } else {
              console.warn("Failed to create node of type:", value.value)
            }

            callback?.(node)
            canvas.graph.afterChange()
          },
        }

        entries.push(entry)
      }

      // @ts-expect-error Remove param ref_window - unused
      new LiteGraph.ContextMenu(entries, { event: e, parentMenu: prev_menu }, ref_window)
    }
  }

  static onMenuCollapseAll() {}
  static onMenuNodeEdit() {}

  /** @param _options Parameter is never used */
  static showMenuNodeOptionalOutputs(
    v: unknown,
    /** Unused - immediately overwritten */
    _options: INodeOutputSlot[],
    e: MouseEvent,
    prev_menu: ContextMenu<INodeSlotContextItem>,
    node: LGraphNode,
  ): boolean | undefined {
    if (!node) return

    const canvas = LGraphCanvas.active_canvas

    let entries: (IContextMenuValue<INodeSlotContextItem> | null)[] = []

    if (LiteGraph.do_add_triggers_slots && node.findOutputSlot("onExecuted") == -1) {
      entries.push({ content: "On Executed", value: ["onExecuted", LiteGraph.EVENT, { nameLocked: true }], className: "event" })
    }
    // add callback for modifing the menu elements onMenuNodeOutputs
    const retEntries = node.onMenuNodeOutputs?.(entries)
    if (retEntries) entries = retEntries

    if (!entries.length) return

    new LiteGraph.ContextMenu<INodeSlotContextItem>(
      entries,
      {
        event: e,
        callback: inner_clicked,
        parentMenu: prev_menu,
        node,
      },
    )

    function inner_clicked(this: ContextMenuDivElement<INodeSlotContextItem>, v: IContextMenuValue<INodeSlotContextItem>, e: any, prev: any) {
      if (!node) return

      // TODO: This is a static method, so the below "that" appears broken.
      if (v.callback) v.callback.call(this, node, v, e, prev)

      if (!v.value) return

      const value = v.value[1]

      if (value &&
        (typeof value === "object" || Array.isArray(value))) {
        // submenu why?
        const entries = []
        for (const i in value) {
          entries.push({ content: i, value: value[i] })
        }
        new LiteGraph.ContextMenu(entries, {
          event: e,
          callback: inner_clicked,
          parentMenu: prev_menu,
          node,
        })
        return false
      }

      const { graph } = node
      if (!graph) throw new NullGraphError()

      graph.beforeChange()
      node.addOutput(v.value[0], v.value[1], v.value[2])

      // a callback to the node when adding a slot
      node.onNodeOutputAdd?.(v.value)
      canvas.setDirty(true, true)
      graph.afterChange()
    }

    return false
  }

  /** @param value Parameter is never used */
  static onShowMenuNodeProperties(
    value: NodeProperty | undefined,
    options: unknown,
    e: MouseEvent,
    prev_menu: ContextMenu<string>,
    node: LGraphNode,
  ): boolean | undefined {
    if (!node || !node.properties) return

    const canvas = LGraphCanvas.active_canvas
    const ref_window = canvas.getCanvasWindow()

    const entries: IContextMenuValue<string>[] = []
    for (const i in node.properties) {
      value = node.properties[i] !== undefined ? node.properties[i] : " "
      if (typeof value == "object")
        value = JSON.stringify(value)
      const info = node.getPropertyInfo(i)
      if (info.type == "enum" || info.type == "combo")
        value = LGraphCanvas.getPropertyPrintableValue(value, info.values)

      // value could contain invalid html characters, clean that
      value = LGraphCanvas.decodeHTML(stringOrEmpty(value))
      entries.push({
        content:
         `<span class='property_name'>${info.label || i}</span>` +
         `<span class='property_value'>${value}</span>`,
        value: i,
      })
    }
    if (!entries.length) {
      return
    }

    new LiteGraph.ContextMenu<string>(
      entries,
      {
        event: e,
        callback: inner_clicked,
        parentMenu: prev_menu,
        allow_html: true,
        node,
      },
      // @ts-expect-error Unused
      ref_window,
    )

    function inner_clicked(this: ContextMenuDivElement, v: { value: any }) {
      if (!node) return

      const rect = this.getBoundingClientRect()
      canvas.showEditPropertyValue(node, v.value, {
        position: [rect.left, rect.top],
      })
    }

    return false
  }

  /** @deprecated */
  static decodeHTML(str: string): string {
    const e = document.createElement("div")
    e.textContent = str
    return e.innerHTML
  }

  static onMenuResizeNode(
    value: IContextMenuValue,
    options: IContextMenuOptions,
    e: MouseEvent,
    menu: ContextMenu,
    node: LGraphNode,
  ): void {
    if (!node) return

    const fApplyMultiNode = function (node: LGraphNode) {
      node.setSize(node.computeSize())
    }

    const canvas = LGraphCanvas.active_canvas
    if (!canvas.selected_nodes || Object.keys(canvas.selected_nodes).length <= 1) {
      fApplyMultiNode(node)
    } else {
      for (const i in canvas.selected_nodes) {
        fApplyMultiNode(canvas.selected_nodes[i])
      }
    }

    canvas.setDirty(true, true)
  }

  // TODO refactor :: this is used fot title but not for properties!
  static onShowPropertyEditor(
    item: { property: keyof LGraphNode, type: string },
    options: IContextMenuOptions<string>,
    e: MouseEvent,
    menu: ContextMenu<string>,
    node: LGraphNode,
  ): void {
    const property = item.property || "title"
    const value = node[property]

    const title = document.createElement("span")
    title.className = "name"
    title.textContent = property

    const input = document.createElement("input")
    Object.assign(input, { type: "text", className: "value", autofocus: true })

    const button = document.createElement("button")
    button.textContent = "OK"

    // TODO refactor :: use createDialog ?
    const dialog = Object.assign(document.createElement("div"), {
      is_modified: false,
      className: "graphdialog",
      close: () => dialog.remove(),
    })
    dialog.append(title, input, button)

    input.value = String(value)
    input.addEventListener("blur", function () {
      this.focus()
    })
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      dialog.is_modified = true
      if (e.key == "Escape") {
        // ESC
        dialog.close()
      } else if (e.key == "Enter") {
        // save
        inner()
      } else if (!e.target || !("localName" in e.target) || e.target.localName != "textarea") {
        return
      }
      e.preventDefault()
      e.stopPropagation()
    })

    const canvas = LGraphCanvas.active_canvas
    const canvasEl = canvas.canvas

    const rect = canvasEl.getBoundingClientRect()
    const offsetx = rect ? -20 - rect.left : -20
    const offsety = rect ? -20 - rect.top : -20

    if (e) {
      dialog.style.left = `${e.clientX + offsetx}px`
      dialog.style.top = `${e.clientY + offsety}px`
    } else {
      dialog.style.left = `${canvasEl.width * 0.5 + offsetx}px`
      dialog.style.top = `${canvasEl.height * 0.5 + offsety}px`
    }

    button.addEventListener("click", inner)

    if (canvasEl.parentNode == null) throw new TypeError("canvasEl.parentNode was null")
    canvasEl.parentNode.append(dialog)

    input.focus()

    let dialogCloseTimer: number
    dialog.addEventListener("mouseleave", function () {
      if (LiteGraph.dialog_close_on_mouse_leave) {
        if (!dialog.is_modified && LiteGraph.dialog_close_on_mouse_leave) {
          dialogCloseTimer = setTimeout(
            dialog.close,
            LiteGraph.dialog_close_on_mouse_leave_delay,
          )
        }
      }
    })
    dialog.addEventListener("mouseenter", function () {
      if (LiteGraph.dialog_close_on_mouse_leave) {
        if (dialogCloseTimer) clearTimeout(dialogCloseTimer)
      }
    })

    function inner() {
      if (input) setValue(input.value)
    }

    function setValue(value: NodeProperty) {
      if (item.type == "Number") {
        value = Number(value)
      } else if (item.type == "Boolean") {
        value = Boolean(value)
      }
      // @ts-expect-error Requires refactor.
      node[property] = value
      dialog.remove()
      canvas.setDirty(true, true)
    }
  }

  static getPropertyPrintableValue(value: unknown, values: unknown[] | object | undefined): string | undefined {
    if (!values) return String(value)

    if (Array.isArray(values)) {
      return String(value)
    }

    if (typeof values === "object") {
      let desc_value = ""
      for (const k in values) {
        // @ts-expect-error deprecated #578
        if (values[k] != value) continue

        desc_value = k
        break
      }
      return `${String(value)} (${desc_value})`
    }
  }

  static onMenuNodeCollapse(
    value: IContextMenuValue,
    options: IContextMenuOptions,
    e: MouseEvent,
    menu: ContextMenu,
    node: LGraphNode,
  ): void {
    if (!node.graph) throw new NullGraphError()

    node.graph.beforeChange()

    const fApplyMultiNode = function (node: LGraphNode) {
      node.collapse()
    }

    const graphcanvas = LGraphCanvas.active_canvas
    if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
      fApplyMultiNode(node)
    } else {
      for (const i in graphcanvas.selected_nodes) {
        fApplyMultiNode(graphcanvas.selected_nodes[i])
      }
    }

    node.graph.afterChange()
  }

  static onMenuToggleAdvanced(
    value: IContextMenuValue,
    options: IContextMenuOptions,
    e: MouseEvent,
    menu: ContextMenu,
    node: LGraphNode,
  ): void {
    if (!node.graph) throw new NullGraphError()

    node.graph.beforeChange()
    const fApplyMultiNode = function (node: LGraphNode) {
      node.toggleAdvanced()
    }

    const graphcanvas = LGraphCanvas.active_canvas
    if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
      fApplyMultiNode(node)
    } else {
      for (const i in graphcanvas.selected_nodes) {
        fApplyMultiNode(graphcanvas.selected_nodes[i])
      }
    }
    node.graph.afterChange()
  }

  static onMenuNodeMode(
    value: IContextMenuValue,
    options: IContextMenuOptions,
    e: MouseEvent,
    menu: ContextMenu,
    node: LGraphNode,
  ): boolean {
    new LiteGraph.ContextMenu(
      LiteGraph.NODE_MODES,
      { event: e, callback: inner_clicked, parentMenu: menu, node },
    )

    function inner_clicked(v: string) {
      if (!node) return

      const kV = Object.values(LiteGraph.NODE_MODES).indexOf(v)
      const fApplyMultiNode = function (node: LGraphNode) {
        if (kV !== -1 && LiteGraph.NODE_MODES[kV]) {
          node.changeMode(kV)
        } else {
          console.warn(`unexpected mode: ${v}`)
          node.changeMode(LGraphEventMode.ALWAYS)
        }
      }

      const graphcanvas = LGraphCanvas.active_canvas
      if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
        fApplyMultiNode(node)
      } else {
        for (const i in graphcanvas.selected_nodes) {
          fApplyMultiNode(graphcanvas.selected_nodes[i])
        }
      }
    }

    return false
  }

  /** @param value Parameter is never used */
  static onMenuNodeColors(
    value: IContextMenuValue<string | null>,
    options: IContextMenuOptions,
    e: MouseEvent,
    menu: ContextMenu<string | null>,
    node: LGraphNode,
  ): boolean {
    if (!node) throw "no node for color"

    const values: IContextMenuValue<string | null, unknown, { value: string | null }>[] = []
    values.push({
      value: null,
      content: "<span style='display: block; padding-left: 4px;'>No color</span>",
    })

    for (const i in LGraphCanvas.node_colors) {
      const color = LGraphCanvas.node_colors[i]
      value = {
        value: i,
        content: `<span style='display: block; color: #999; padding-left: 4px;` +
          ` border-left: 8px solid ${color.color}; background-color:${color.bgcolor}'>${i}</span>`,
      }
      values.push(value)
    }
    new LiteGraph.ContextMenu<string | null>(values, {
      event: e,
      callback: inner_clicked,
      parentMenu: menu,
      node,
    })

    function inner_clicked(v: IContextMenuValue<string>) {
      if (!node) return

      const fApplyColor = function (item: IColorable) {
        const colorOption = v.value ? LGraphCanvas.node_colors[v.value] : null
        item.setColorOption(colorOption)
      }

      const canvas = LGraphCanvas.active_canvas
      if (!canvas.selected_nodes || Object.keys(canvas.selected_nodes).length <= 1) {
        fApplyColor(node)
      } else {
        for (const i in canvas.selected_nodes) {
          fApplyColor(canvas.selected_nodes[i])
        }
      }
      canvas.setDirty(true, true)
    }

    return false
  }

  static onMenuNodeShapes(
    value: IContextMenuValue<typeof LiteGraph.VALID_SHAPES[number]>,
    options: IContextMenuOptions<typeof LiteGraph.VALID_SHAPES[number]>,
    e: MouseEvent,
    menu?: ContextMenu<typeof LiteGraph.VALID_SHAPES[number]>,
    node?: LGraphNode,
  ): boolean {
    if (!node) throw "no node passed"

    new LiteGraph.ContextMenu<typeof LiteGraph.VALID_SHAPES[number]>(LiteGraph.VALID_SHAPES, {
      event: e,
      callback: inner_clicked,
      parentMenu: menu,
      node,
    })

    function inner_clicked(v: typeof LiteGraph.VALID_SHAPES[number]) {
      if (!node) return
      if (!node.graph) throw new NullGraphError()

      node.graph.beforeChange()

      const fApplyMultiNode = function (node: LGraphNode) {
        node.shape = v
      }

      const canvas = LGraphCanvas.active_canvas
      if (!canvas.selected_nodes || Object.keys(canvas.selected_nodes).length <= 1) {
        fApplyMultiNode(node)
      } else {
        for (const i in canvas.selected_nodes) {
          fApplyMultiNode(canvas.selected_nodes[i])
        }
      }

      node.graph.afterChange()
      canvas.setDirty(true)
    }

    return false
  }

  static onMenuNodeRemove(): void {
    LGraphCanvas.active_canvas.deleteSelected()
  }

  static onMenuNodeClone(
    value: IContextMenuValue,
    options: IContextMenuOptions,
    e: MouseEvent,
    menu: ContextMenu,
    node: LGraphNode,
  ): void {
    const { graph } = node
    if (!graph) throw new NullGraphError()
    graph.beforeChange()

    const newSelected = new Set<LGraphNode>()

    const fApplyMultiNode = function (node: LGraphNode, newNodes: Set<LGraphNode>): void {
      if (node.clonable === false) return

      const newnode = node.clone()
      if (!newnode) return

      newnode.pos = [node.pos[0] + 5, node.pos[1] + 5]
      if (!node.graph) throw new NullGraphError()

      node.graph.add(newnode)
      newNodes.add(newnode)
    }

    const canvas = LGraphCanvas.active_canvas
    if (!canvas.selected_nodes || Object.keys(canvas.selected_nodes).length <= 1) {
      fApplyMultiNode(node, newSelected)
    } else {
      for (const i in canvas.selected_nodes) {
        fApplyMultiNode(canvas.selected_nodes[i], newSelected)
      }
    }

    if (newSelected.size) {
      canvas.selectNodes([...newSelected])
    }

    graph.afterChange()

    canvas.setDirty(true, true)
  }

  /**
   * clears all the data inside
   *
   */
  clear(): void {
    this.frame = 0
    this.last_draw_time = 0
    this.render_time = 0
    this.fps = 0

    // this.scale = 1;
    // this.offset = [0,0];
    this.dragging_rectangle = null

    this.selected_nodes = {}
    this.selected_group = null
    this.selectedItems.clear()
    this.state.selectionChanged = true
    this.onSelectionChange?.(this.selected_nodes)

    this.visible_nodes = []
    this.node_over = undefined
    this.node_capturing_input = null
    this.connecting_links = null
    this.highlighted_links = {}

    this.dragging_canvas = false

    this.#dirty()
    this.dirty_area = null

    this.node_in_panel = null
    this.node_widget = null

    this.last_mouse = [0, 0]
    this.last_mouseclick = 0
    this.pointer.reset()
    this.visible_area.set([0, 0, 0, 0])

    this.onClear?.()
  }

  /**
   * Assigns a new graph to this canvas.
   */
  setGraph(newGraph: LGraph | Subgraph): void {
    const { graph } = this
    if (newGraph === graph) return

    this.clear()
    newGraph.attachCanvas(this)

    this.dispatch("litegraph:set-graph", { newGraph, oldGraph: graph })
    this.#dirty()
  }

  openSubgraph(subgraph: Subgraph): void {
    const { graph } = this
    if (!graph) throw new NullGraphError()

    const options = { bubbles: true, detail: { subgraph, closingGraph: graph }, cancelable: true }
    const mayContinue = this.canvas.dispatchEvent(new CustomEvent("subgraph-opening", options))
    if (!mayContinue) return

    this.clear()
    this.subgraph = subgraph
    this.setGraph(subgraph)

    this.canvas.dispatchEvent(new CustomEvent("subgraph-opened", options))
  }

  /**
   * @returns the visually active graph (in case there are more in the stack)
   */
  getCurrentGraph(): LGraph | null {
    return this.graph
  }

  /**
   * Finds the canvas if required, throwing on failure.
   * @param canvas Canvas element, or its element ID
   * @returns The canvas element
   * @throws If {@link canvas} is an element ID that does not belong to a valid HTML canvas element
   */
  #validateCanvas(
    canvas: string | HTMLCanvasElement,
  ): HTMLCanvasElement & { data?: LGraphCanvas } {
    if (typeof canvas === "string") {
      const el = document.getElementById(canvas)
      if (!(el instanceof HTMLCanvasElement)) throw "Error validating LiteGraph canvas: Canvas element not found"
      return el
    }
    return canvas
  }

  /**
   * Sets the current HTML canvas element.
   * Calls bindEvents to add input event listeners, and (re)creates the background canvas.
   * @param canvas The canvas element to assign, or its HTML element ID.  If null or undefined, the current reference is cleared.
   * @param skip_events If true, events on the previous canvas will not be removed.  Has no effect on the first invocation.
   */
  setCanvas(canvas: string | HTMLCanvasElement, skip_events?: boolean) {
    const element = this.#validateCanvas(canvas)
    if (element === this.canvas) return
    // maybe detach events from old_canvas
    if (!element && this.canvas && !skip_events) this.unbindEvents()

    this.canvas = element
    this.ds.element = element
    this.pointer.element = element

    if (!element) return

    // TODO: classList.add
    element.className += " lgraphcanvas"
    element.data = this

    // Background canvas: To render objects behind nodes (background, links, groups)
    this.bgcanvas = document.createElement("canvas")
    this.bgcanvas.width = this.canvas.width
    this.bgcanvas.height = this.canvas.height

    const ctx = element.getContext?.("2d")
    if (ctx == null) {
      if (element.localName != "canvas") {
        throw `Element supplied for LGraphCanvas must be a <canvas> element, you passed a ${element.localName}`
      }
      throw "This browser doesn't support Canvas"
    }
    this.ctx = ctx

    if (!skip_events) this.bindEvents()
  }

  /** Captures an event and prevents default - returns false. */
  _doNothing(e: Event): boolean {
    // console.log("pointerevents: _doNothing "+e.type);
    e.preventDefault()
    return false
  }

  /** Captures an event and prevents default - returns true. */
  _doReturnTrue(e: Event): boolean {
    e.preventDefault()
    return true
  }

  /**
   * binds mouse, keyboard, touch and drag events to the canvas
   */
  bindEvents(): void {
    if (this._events_binded) {
      console.warn("LGraphCanvas: events already binded")
      return
    }

    const { canvas } = this
    // hack used when moving canvas between windows
    const { document } = this.getCanvasWindow()

    this._mousedown_callback = this.processMouseDown.bind(this)
    this._mousewheel_callback = this.processMouseWheel.bind(this)
    this._mousemove_callback = this.processMouseMove.bind(this)
    this._mouseup_callback = this.processMouseUp.bind(this)
    this._mouseout_callback = this.processMouseOut.bind(this)
    this._mousecancel_callback = this.processMouseCancel.bind(this)

    canvas.addEventListener("pointerdown", this._mousedown_callback, true)
    canvas.addEventListener("wheel", this._mousewheel_callback, false)

    canvas.addEventListener("pointerup", this._mouseup_callback, true)
    canvas.addEventListener("pointermove", this._mousemove_callback)
    canvas.addEventListener("pointerout", this._mouseout_callback)
    canvas.addEventListener("pointercancel", this._mousecancel_callback, true)

    canvas.addEventListener("contextmenu", this._doNothing)

    // Keyboard
    this._key_callback = this.processKey.bind(this)

    canvas.addEventListener("keydown", this._key_callback, true)
    // keyup event must be bound on the document
    document.addEventListener("keyup", this._key_callback, true)

    canvas.addEventListener("dragover", this._doNothing, false)
    canvas.addEventListener("dragend", this._doNothing, false)
    canvas.addEventListener("dragenter", this._doReturnTrue, false)

    this._events_binded = true
  }

  /**
   * unbinds mouse events from the canvas
   */
  unbindEvents(): void {
    if (!this._events_binded) {
      console.warn("LGraphCanvas: no events binded")
      return
    }

    // console.log("pointerevents: unbindEvents");
    const { document } = this.getCanvasWindow()
    const { canvas } = this

    // Assertions: removing nullish is fine.
    canvas.removeEventListener("pointercancel", this._mousecancel_callback!)
    canvas.removeEventListener("pointerout", this._mouseout_callback!)
    canvas.removeEventListener("pointermove", this._mousemove_callback!)
    canvas.removeEventListener("pointerup", this._mouseup_callback!)
    canvas.removeEventListener("pointerdown", this._mousedown_callback!)
    canvas.removeEventListener("wheel", this._mousewheel_callback!)
    canvas.removeEventListener("keydown", this._key_callback!)
    document.removeEventListener("keyup", this._key_callback!)
    canvas.removeEventListener("contextmenu", this._doNothing)
    canvas.removeEventListener("dragenter", this._doReturnTrue)

    this._mousedown_callback = undefined
    this._mousewheel_callback = undefined
    this._key_callback = undefined

    this._events_binded = false
  }

  /**
   * Ensures the canvas will be redrawn on the next frame by setting the dirty flag(s).
   * Without parameters, this function does nothing.
   * @todo Impl. `setDirty()` or similar as shorthand to redraw everything.
   * @param fgcanvas If true, marks the foreground canvas as dirty (nodes and anything drawn on top of them).  Default: false
   * @param bgcanvas If true, mark the background canvas as dirty (background, groups, links).  Default: false
   */
  setDirty(fgcanvas: boolean, bgcanvas?: boolean): void {
    if (fgcanvas) this.dirty_canvas = true
    if (bgcanvas) this.dirty_bgcanvas = true
  }

  /** Marks the entire canvas as dirty. */
  #dirty(): void {
    this.dirty_canvas = true
    this.dirty_bgcanvas = true
  }

  #linkConnectorDrop(): void {
    const { graph, linkConnector, pointer } = this
    if (!graph) throw new NullGraphError()

    pointer.onDragEnd = upEvent => linkConnector.dropLinks(graph, upEvent)
    pointer.finally = () => this.linkConnector.reset(true)
  }

  /**
   * Used to attach the canvas in a popup
   * @returns returns the window where the canvas is attached (the DOM root node)
   */
  getCanvasWindow(): Window {
    if (!this.canvas) return window

    const doc = this.canvas.ownerDocument
    // @ts-expect-error Check if required
    return doc.defaultView || doc.parentWindow
  }

  /**
   * starts rendering the content of the canvas when needed
   *
   */
  startRendering(): void {
    // already rendering
    if (this.is_rendering) return

    this.is_rendering = true
    renderFrame.call(this)

    /** Render loop */
    function renderFrame(this: LGraphCanvas) {
      if (!this.pause_rendering) {
        this.draw()
      }

      const window = this.getCanvasWindow()
      if (this.is_rendering) {
        if (this.#maximumFrameGap > 0) {
          // Manual FPS limit
          const gap = this.#maximumFrameGap - (LiteGraph.getTime() - this.last_draw_time)
          setTimeout(renderFrame.bind(this), Math.max(1, gap))
        } else {
          // FPS limited by refresh rate
          window.requestAnimationFrame(renderFrame.bind(this))
        }
      }
    }
  }

  /**
   * stops rendering the content of the canvas (to save resources)
   *
   */
  stopRendering(): void {
    this.is_rendering = false
    /*
    if(this.rendering_timer_id)
    {
        clearInterval(this.rendering_timer_id);
        this.rendering_timer_id = null;
    }
    */
  }

  /* LiteGraphCanvas input */
  // used to block future mouse events (because of im gui)
  blockClick(): void {
    this.block_click = true
    this.last_mouseclick = 0
  }

  /**
   * Gets the widget at the current cursor position.
   * @param node Optional node to check for widgets under cursor
   * @returns The widget located at the current cursor position, if any is found.
   * @deprecated Use {@link LGraphNode.getWidgetOnPos} instead.
   * ```ts
   * const [x, y] = canvas.graph_mouse
   * const widget = canvas.node_over?.getWidgetOnPos(x, y, true)
   * ```
   */
  getWidgetAtCursor(node?: LGraphNode): IBaseWidget | undefined {
    node ??= this.node_over
    return node?.getWidgetOnPos(this.graph_mouse[0], this.graph_mouse[1], true)
  }

  /**
   * Clears highlight and mouse-over information from nodes that should not have it.
   *
   * Intended to be called when the pointer moves away from a node.
   * @param node The node that the mouse is now over
   * @param e MouseEvent that is triggering this
   */
  updateMouseOverNodes(node: LGraphNode | null, e: CanvasMouseEvent): void {
    if (!this.graph) throw new NullGraphError()

    const { pointer } = this
    const nodes = this.graph._nodes
    for (const otherNode of nodes) {
      if (otherNode.mouseOver && node != otherNode) {
        // mouse leave
        if (!pointer.eDown) pointer.resizeDirection = undefined
        otherNode.mouseOver = undefined
        this._highlight_input = undefined
        this._highlight_pos = undefined
        this.linkConnector.overWidget = undefined

        // Hover transitions
        // TODO: Implement single lerp ease factor for current progress on hover in/out.
        // In drawNode, multiply by ease factor and differential value (e.g. bg alpha +0.5).
        otherNode.lostFocusAt = LiteGraph.getTime()

        this.node_over?.onMouseLeave?.(e)
        this.node_over = undefined
        this.dirty_canvas = true
      }
    }
  }

  processMouseDown(e: PointerEvent): void {
    if (this.dragZoomEnabled && e.ctrlKey && e.shiftKey && !e.altKey && e.buttons) {
      this.#dragZoomStart = { pos: [e.x, e.y], scale: this.ds.scale }
      return
    }

    const { graph, pointer } = this
    this.adjustMouseEvent(e)
    if (e.isPrimary) pointer.down(e)

    if (this.set_canvas_dirty_on_mouse_event) this.dirty_canvas = true

    if (!graph) return

    const ref_window = this.getCanvasWindow()
    LGraphCanvas.active_canvas = this

    const x = e.clientX
    const y = e.clientY
    this.ds.viewport = this.viewport
    const is_inside = !this.viewport || isInRect(x, y, this.viewport)

    if (!is_inside) return

    const node = graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes) ?? undefined

    this.mouse[0] = x
    this.mouse[1] = y
    this.graph_mouse[0] = e.canvasX
    this.graph_mouse[1] = e.canvasY
    this.last_click_position = [this.mouse[0], this.mouse[1]]

    pointer.isDouble = pointer.isDown && e.isPrimary
    pointer.isDown = true

    this.canvas.focus()

    LiteGraph.closeAllContextMenus(ref_window)

    if (this.onMouse?.(e) == true) return

    // left button mouse / single finger
    if (e.button === 0 && !pointer.isDouble) {
      this.#processPrimaryButton(e, node)
    } else if (e.button === 1) {
      this.#processMiddleButton(e, node)
    } else if (
      (e.button === 2 || pointer.isDouble) &&
      this.allow_interaction &&
      !this.read_only
    ) {
      // Right / aux button
      const { linkConnector, subgraph } = this

      // Sticky select - won't remove single nodes
      if (subgraph?.inputNode.containsPoint(this.graph_mouse)) {
        // Subgraph input node
        this.processSelect(subgraph.inputNode, e, true)
        subgraph.inputNode.onPointerDown(e, pointer, linkConnector)
      } else if (subgraph?.outputNode.containsPoint(this.graph_mouse)) {
        // Subgraph output node
        this.processSelect(subgraph.outputNode, e, true)
        subgraph.outputNode.onPointerDown(e, pointer, linkConnector)
      } else {
        if (node) {
          this.processSelect(node, e, true)
        } else if (this.links_render_mode !== LinkRenderType.HIDDEN_LINK) {
        // Reroutes
          const reroute = graph.getRerouteOnPos(e.canvasX, e.canvasY, this.#visibleReroutes)
          if (reroute) {
            if (e.altKey) {
              pointer.onClick = (upEvent) => {
                if (upEvent.altKey) {
                // Ensure deselected
                  if (reroute.selected) {
                    this.deselect(reroute)
                    this.onSelectionChange?.(this.selected_nodes)
                  }
                  reroute.remove()
                }
              }
            } else {
              this.processSelect(reroute, e, true)
            }
          }
        }

        // Show context menu for the node or group under the pointer
        pointer.onClick ??= () => this.processContextMenu(node, e)
      }
    }

    this.last_mouse = [x, y]
    this.last_mouseclick = LiteGraph.getTime()
    this.last_mouse_dragging = true

    graph.change()

    // this is to ensure to defocus(blur) if a text input element is on focus
    if (
      !ref_window.document.activeElement ||
      (ref_window.document.activeElement.nodeName.toLowerCase() != "input" &&
        ref_window.document.activeElement.nodeName.toLowerCase() != "textarea")
    ) {
      e.preventDefault()
    }
    e.stopPropagation()

    this.onMouseDown?.(e)
  }

  /**
   * Returns the first matching positionable item at the given co-ordinates.
   *
   * Order of preference:
   * - Subgraph IO Nodes
   * - Reroutes
   * - Group titlebars
   * @param x The x coordinate in canvas space
   * @param y The y coordinate in canvas space
   * @returns The positionable item or undefined
   */
  #getPositionableOnPos(x: number, y: number): Positionable | undefined {
    const ioNode = this.subgraph?.getIoNodeOnPos(x, y)
    if (ioNode) return ioNode

    for (const reroute of this.#visibleReroutes) {
      if (reroute.containsPoint([x, y])) return reroute
    }

    return this.graph?.getGroupTitlebarOnPos(x, y)
  }

  #processPrimaryButton(e: CanvasPointerEvent, node: LGraphNode | undefined) {
    const { pointer, graph, linkConnector, subgraph } = this
    if (!graph) throw new NullGraphError()

    const x = e.canvasX
    const y = e.canvasY

    // Modifiers
    const ctrlOrMeta = e.ctrlKey || e.metaKey

    // Multi-select drag rectangle
    if (ctrlOrMeta && !e.altKey) {
      const dragRect = new Float32Array(4)
      dragRect[0] = x
      dragRect[1] = y
      dragRect[2] = 1
      dragRect[3] = 1

      pointer.onClick = (eUp) => {
        // Click, not drag
        const clickedItem = node ?? this.#getPositionableOnPos(eUp.canvasX, eUp.canvasY)
        this.processSelect(clickedItem, eUp)
      }
      pointer.onDragStart = () => this.dragging_rectangle = dragRect
      pointer.onDragEnd = upEvent => this.#handleMultiSelect(upEvent, dragRect)
      pointer.finally = () => this.dragging_rectangle = null
      return
    }

    if (this.read_only) {
      pointer.finally = () => this.dragging_canvas = false
      this.dragging_canvas = true
      return
    }

    // clone node ALT dragging
    if (LiteGraph.alt_drag_do_clone_nodes && e.altKey && !e.ctrlKey && node && this.allow_interaction) {
      const node_data = node.clone()?.serialize()
      if (node_data?.type != null) {
        const cloned = LiteGraph.createNode(node_data.type)
        if (cloned) {
          cloned.configure(node_data)
          cloned.pos[0] += 5
          cloned.pos[1] += 5

          if (this.allow_dragnodes) {
            pointer.onDragStart = (pointer) => {
              graph.add(cloned, false)
              this.#startDraggingItems(cloned, pointer)
            }
            pointer.onDragEnd = e => this.#processDraggedItems(e)
          } else {
          // TODO: Check if before/after change are necessary here.
            graph.beforeChange()
            graph.add(cloned, false)
            graph.afterChange()
          }

          return
        }
      }
    }

    // Node clicked
    if (node && (this.allow_interaction || node.flags.allow_interaction)) {
      this.#processNodeClick(e, ctrlOrMeta, node)
    } else {
      // Subgraph IO nodes
      if (subgraph) {
        const { inputNode, outputNode } = subgraph

        if (processSubgraphIONode(this, inputNode)) return
        if (processSubgraphIONode(this, outputNode)) return

        function processSubgraphIONode(canvas: LGraphCanvas, ioNode: SubgraphInputNode | SubgraphOutputNode) {
          if (!ioNode.containsPoint([x, y])) return false

          ioNode.onPointerDown(e, pointer, linkConnector)
          pointer.onClick ??= () => canvas.processSelect(ioNode, e)
          pointer.onDragStart ??= () => canvas.#startDraggingItems(ioNode, pointer, true)
          pointer.onDragEnd ??= eUp => canvas.#processDraggedItems(eUp)
          return true
        }
      }

      // Reroutes
      if (this.links_render_mode !== LinkRenderType.HIDDEN_LINK) {
        for (const reroute of this.#visibleReroutes) {
          const overReroute = reroute.containsPoint([x, y])
          if (!reroute.isSlotHovered && !overReroute) continue

          if (overReroute) {
            pointer.onClick = () => this.processSelect(reroute, e)
            if (!e.shiftKey) {
              pointer.onDragStart = pointer => this.#startDraggingItems(reroute, pointer, true)
              pointer.onDragEnd = e => this.#processDraggedItems(e)
            }
          }

          if (reroute.isOutputHovered || (overReroute && e.shiftKey)) {
            linkConnector.dragFromReroute(graph, reroute)
            this.#linkConnectorDrop()
          }

          if (reroute.isInputHovered) {
            linkConnector.dragFromRerouteToOutput(graph, reroute)
            this.#linkConnectorDrop()
          }

          reroute.hideSlots()
          this.dirty_bgcanvas = true
          return
        }
      }

      // Links - paths of links & reroutes
      // Set the width of the line for isPointInStroke checks
      const { lineWidth } = this.ctx
      this.ctx.lineWidth = this.connections_width + 7
      const dpi = window?.devicePixelRatio || 1

      for (const linkSegment of this.renderedPaths) {
        const centre = linkSegment._pos
        if (!centre) continue

        // If we shift click on a link then start a link from that input
        if (
          (e.shiftKey || e.altKey) &&
          linkSegment.path &&
          this.ctx.isPointInStroke(linkSegment.path, x * dpi, y * dpi)
        ) {
          this.ctx.lineWidth = lineWidth

          if (e.shiftKey && !e.altKey) {
            linkConnector.dragFromLinkSegment(graph, linkSegment)
            this.#linkConnectorDrop()

            return
          } else if (e.altKey && !e.shiftKey) {
            const newReroute = graph.createReroute([x, y], linkSegment)
            pointer.onDragStart = pointer => this.#startDraggingItems(newReroute, pointer)
            pointer.onDragEnd = e => this.#processDraggedItems(e)
            return
          }
        } else if (isInRectangle(x, y, centre[0] - 4, centre[1] - 4, 8, 8)) {
          this.ctx.lineWidth = lineWidth

          pointer.onClick = () => this.showLinkMenu(linkSegment, e)
          pointer.onDragStart = () => this.dragging_canvas = true
          pointer.finally = () => this.dragging_canvas = false

          // clear tooltip
          this.over_link_center = undefined
          return
        }
      }

      // Restore line width
      this.ctx.lineWidth = lineWidth

      // Groups
      const group = graph.getGroupOnPos(x, y)
      this.selected_group = group ?? null
      if (group) {
        if (group.isInResize(x, y)) {
          // Resize group
          const b = group.boundingRect
          const offsetX = x - (b[0] + b[2])
          const offsetY = y - (b[1] + b[3])

          pointer.onDragStart = () => this.resizingGroup = group
          pointer.onDrag = (eMove) => {
            if (this.read_only) return

            // Resize only by the exact pointer movement
            const pos: Point = [
              eMove.canvasX - group.pos[0] - offsetX,
              eMove.canvasY - group.pos[1] - offsetY,
            ]
            // Unless snapping.
            if (this.#snapToGrid) snapPoint(pos, this.#snapToGrid)

            const resized = group.resize(pos[0], pos[1])
            if (resized) this.dirty_bgcanvas = true
          }
          pointer.finally = () => this.resizingGroup = null
        } else {
          const f = group.font_size || LiteGraph.DEFAULT_GROUP_FONT_SIZE
          const headerHeight = f * 1.4
          if (
            isInRectangle(
              x,
              y,
              group.pos[0],
              group.pos[1],
              group.size[0],
              headerHeight,
            )
          ) {
            // In title bar
            pointer.onClick = () => this.processSelect(group, e)
            pointer.onDragStart = (pointer) => {
              group.recomputeInsideNodes()
              this.#startDraggingItems(group, pointer, true)
            }
            pointer.onDragEnd = e => this.#processDraggedItems(e)
          }
        }

        pointer.onDoubleClick = () => {
          this.emitEvent({
            subType: "group-double-click",
            originalEvent: e,
            group,
          })
        }
      } else {
        pointer.onDoubleClick = () => {
          // Double click within group should not trigger the searchbox.
          if (this.allow_searchbox) {
            this.showSearchBox(e)
            e.preventDefault()
          }
          this.emitEvent({
            subType: "empty-double-click",
            originalEvent: e,
          })
        }
      }
    }

    if (
      !pointer.onDragStart &&
      !pointer.onClick &&
      !pointer.onDrag &&
      this.allow_dragcanvas
    ) {
      pointer.onClick = () => this.processSelect(null, e)
      pointer.finally = () => this.dragging_canvas = false
      this.dragging_canvas = true
    }
  }

  /**
   * Processes a pointerdown event inside the bounds of a node.  Part of {@link processMouseDown}.
   * @param e The pointerdown event
   * @param ctrlOrMeta Ctrl or meta key is pressed
   * @param node The node to process a click event for
   */
  #processNodeClick(
    e: CanvasPointerEvent,
    ctrlOrMeta: boolean,
    node: LGraphNode,
  ): void {
    const { pointer, graph, linkConnector } = this
    if (!graph) throw new NullGraphError()

    const x = e.canvasX
    const y = e.canvasY

    pointer.onClick = () => this.processSelect(node, e)

    // Immediately bring to front
    if (!node.flags.pinned) {
      this.bringToFront(node)
    }

    // Collapse toggle
    const inCollapse = node.isPointInCollapse(x, y)
    if (inCollapse) {
      pointer.onClick = () => {
        node.collapse()
        this.setDirty(true, true)
      }
    } else if (!node.flags.collapsed) {
      const { inputs, outputs } = node

      // Outputs
      if (outputs) {
        for (const [i, output] of outputs.entries()) {
          const link_pos = node.getOutputPos(i)
          if (isInRectangle(x, y, link_pos[0] - 15, link_pos[1] - 10, 30, 20)) {
            // Drag multiple output links
            if (e.shiftKey && (output.links?.length || output._floatingLinks?.size)) {
              linkConnector.moveOutputLink(graph, output)
              this.#linkConnectorDrop()
              return
            }

            // New output link
            linkConnector.dragNewFromOutput(graph, node, output)
            this.#linkConnectorDrop()

            if (LiteGraph.shift_click_do_break_link_from) {
              if (e.shiftKey) {
                node.disconnectOutput(i)
              }
            } else if (LiteGraph.ctrl_alt_click_do_break_link) {
              if (ctrlOrMeta && e.altKey && !e.shiftKey) {
                node.disconnectOutput(i)
              }
            }

            // TODO: Move callbacks to the start of this closure (onInputClick is already correct).
            pointer.onDoubleClick = () => node.onOutputDblClick?.(i, e)
            pointer.onClick = () => node.onOutputClick?.(i, e)

            return
          }
        }
      }

      // Inputs
      if (inputs) {
        for (const [i, input] of inputs.entries()) {
          const link_pos = node.getInputPos(i)
          const isInSlot = input instanceof NodeInputSlot
            ? isInRect(x, y, input.boundingRect)
            : isInRectangle(x, y, link_pos[0] - 15, link_pos[1] - 10, 30, 20)

          if (isInSlot) {
            pointer.onDoubleClick = () => node.onInputDblClick?.(i, e)
            pointer.onClick = () => node.onInputClick?.(i, e)

            const shouldBreakLink = LiteGraph.ctrl_alt_click_do_break_link &&
              ctrlOrMeta &&
              e.altKey &&
              !e.shiftKey
            if (input.link !== null || input._floatingLinks?.size) {
              // Existing link
              if (shouldBreakLink || LiteGraph.click_do_break_link_to) {
                node.disconnectInput(i, true)
              } else if (e.shiftKey || this.allow_reconnect_links) {
                linkConnector.moveInputLink(graph, input)
              }
            }

            // Dragging a new link from input to output
            if (!linkConnector.isConnecting) {
              linkConnector.dragNewFromInput(graph, node, input)
            }

            this.#linkConnectorDrop()
            this.dirty_bgcanvas = true

            return
          }
        }
      }
    }

    // Click was inside the node, but not on input/output, or resize area
    const pos: Point = [x - node.pos[0], y - node.pos[1]]

    // Widget
    const widget = node.getWidgetOnPos(x, y)
    if (widget) {
      this.#processWidgetClick(e, node, widget)
      this.node_widget = [node, widget]
    } else {
      // Node background
      pointer.onDoubleClick = () => {
        // Double-click
        // Check if it's a double click on the title bar
        // Note: pos[1] is the y-coordinate of the node's body
        // If clicking on node header (title), pos[1] is negative
        if (pos[1] < 0 && !inCollapse) {
          node.onNodeTitleDblClick?.(e, pos, this)
        } else if (node instanceof SubgraphNode) {
          this.openSubgraph(node.subgraph)
        }

        node.onDblClick?.(e, pos, this)
        this.emitEvent({
          subType: "node-double-click",
          originalEvent: e,
          node,
        })
        this.processNodeDblClicked(node)
      }

      // Mousedown callback - can block drag
      if (node.onMouseDown?.(e, pos, this) || !this.allow_dragnodes)
        return

      // Check for resize AFTER checking all other interaction areas
      if (!node.flags.collapsed) {
        const resizeDirection = node.findResizeDirection(x, y)
        if (resizeDirection) {
          pointer.resizeDirection = resizeDirection
          const startBounds = new Rectangle(node.pos[0], node.pos[1], node.size[0], node.size[1])

          pointer.onDragStart = () => {
            graph.beforeChange()
            this.resizing_node = node
          }

          pointer.onDrag = (eMove) => {
            if (this.read_only) return

            const deltaX = eMove.canvasX - x
            const deltaY = eMove.canvasY - y

            const newBounds = new Rectangle(startBounds.x, startBounds.y, startBounds.width, startBounds.height)

            // Handle resize based on the direction
            switch (resizeDirection) {
            case "NE": // North-East (top-right)
              newBounds.y = startBounds.y + deltaY
              newBounds.width = startBounds.width + deltaX
              newBounds.height = startBounds.height - deltaY
              break
            case "SE": // South-East (bottom-right)
              newBounds.width = startBounds.width + deltaX
              newBounds.height = startBounds.height + deltaY
              break
            case "SW": // South-West (bottom-left)
              newBounds.x = startBounds.x + deltaX
              newBounds.width = startBounds.width - deltaX
              newBounds.height = startBounds.height + deltaY
              break
            case "NW": // North-West (top-left)
              newBounds.x = startBounds.x + deltaX
              newBounds.y = startBounds.y + deltaY
              newBounds.width = startBounds.width - deltaX
              newBounds.height = startBounds.height - deltaY
              break
            }

            // Apply snapping to position changes
            if (this.#snapToGrid) {
              if (resizeDirection.includes("N") || resizeDirection.includes("W")) {
                const originalX = newBounds.x
                const originalY = newBounds.y

                snapPoint(newBounds.pos, this.#snapToGrid)

                // Adjust size to compensate for snapped position
                if (resizeDirection.includes("N")) {
                  newBounds.height += originalY - newBounds.y
                }
                if (resizeDirection.includes("W")) {
                  newBounds.width += originalX - newBounds.x
                }
              }

              snapPoint(newBounds.size, this.#snapToGrid)
            }

            // Apply snapping to size changes

            // Enforce minimum size
            const min = node.computeSize()
            if (newBounds.width < min[0]) {
              // If resizing from left, adjust position to maintain right edge
              if (resizeDirection.includes("W")) {
                newBounds.x = startBounds.x + startBounds.width - min[0]
              }
              newBounds.width = min[0]
            }
            if (newBounds.height < min[1]) {
              // If resizing from top, adjust position to maintain bottom edge
              if (resizeDirection.includes("N")) {
                newBounds.y = startBounds.y + startBounds.height - min[1]
              }
              newBounds.height = min[1]
            }

            node.pos = newBounds.pos
            node.setSize(newBounds.size)

            this.#dirty()
          }

          pointer.onDragEnd = () => {
            this.#dirty()
            graph.afterChange(node)
          }
          pointer.finally = () => {
            this.resizing_node = null
            pointer.resizeDirection = undefined
          }

          // Set appropriate cursor for resize direction
          this.canvas.style.cursor = cursors[resizeDirection]
          return
        }
      }

      // Drag node
      pointer.onDragStart = pointer => this.#startDraggingItems(node, pointer, true)
      pointer.onDragEnd = e => this.#processDraggedItems(e)
    }

    this.dirty_canvas = true
  }

  #processWidgetClick(e: CanvasPointerEvent, node: LGraphNode, widget: IBaseWidget) {
    const { pointer } = this

    // Custom widget - CanvasPointer
    if (typeof widget.onPointerDown === "function") {
      const handled = widget.onPointerDown(pointer, node, this)
      if (handled) return
    }

    const oldValue = widget.value

    const pos = this.graph_mouse
    const x = pos[0] - node.pos[0]
    const y = pos[1] - node.pos[1]

    const widgetInstance = toConcreteWidget(widget, node, false)
    if (widgetInstance) {
      pointer.onClick = () => widgetInstance.onClick({
        e,
        node,
        canvas: this,
      })
      pointer.onDrag = eMove => widgetInstance.onDrag?.({
        e: eMove,
        node,
        canvas: this,
      })
    } else if (widget.mouse) {
      const result = widget.mouse(e, [x, y], node)
      if (result != null) this.dirty_canvas = result
    }

    // value changed
    if (oldValue != widget.value) {
      node.onWidgetChanged?.(widget.name, widget.value, oldValue, widget)
      if (!node.graph) throw new NullGraphError()
      node.graph._version++
    }

    // Clean up state var
    pointer.finally = () => {
      // Legacy custom widget callback
      if (widget.mouse) {
        const { eUp } = pointer
        if (!eUp) return
        const { canvasX, canvasY } = eUp
        widget.mouse(eUp, [canvasX - node.pos[0], canvasY - node.pos[1]], node)
      }

      this.node_widget = null
    }
  }

  /**
   * Pointer middle button click processing.  Part of {@link processMouseDown}.
   * @param e The pointerdown event
   * @param node The node to process a click event for
   */
  #processMiddleButton(e: CanvasPointerEvent, node: LGraphNode | undefined) {
    const { pointer } = this

    if (
      LiteGraph.middle_click_slot_add_default_node &&
      node &&
      this.allow_interaction &&
      !this.read_only &&
      !this.connecting_links &&
      !node.flags.collapsed
    ) {
      // not dragging mouse to connect two slots
      let mClikSlot: INodeSlot | false = false
      let mClikSlot_index: number | false = false
      let mClikSlot_isOut: boolean = false
      const { inputs, outputs } = node

      // search for outputs
      if (outputs) {
        for (const [i, output] of outputs.entries()) {
          const link_pos = node.getOutputPos(i)
          if (isInRectangle(e.canvasX, e.canvasY, link_pos[0] - 15, link_pos[1] - 10, 30, 20)) {
            mClikSlot = output
            mClikSlot_index = i
            mClikSlot_isOut = true
            break
          }
        }
      }

      // search for inputs
      if (inputs) {
        for (const [i, input] of inputs.entries()) {
          const link_pos = node.getInputPos(i)
          if (isInRectangle(e.canvasX, e.canvasY, link_pos[0] - 15, link_pos[1] - 10, 30, 20)) {
            mClikSlot = input
            mClikSlot_index = i
            mClikSlot_isOut = false
            break
          }
        }
      }
      // Middle clicked a slot
      if (mClikSlot && mClikSlot_index !== false) {
        const alphaPosY =
          0.5 -
          (mClikSlot_index + 1) /
          (mClikSlot_isOut ? outputs.length : inputs.length)
        const node_bounding = node.getBounding()
        // estimate a position: this is a bad semi-bad-working mess .. REFACTOR with
        // a correct autoplacement that knows about the others slots and nodes
        const posRef: Point = [
          !mClikSlot_isOut
            ? node_bounding[0]
            : node_bounding[0] + node_bounding[2],
          e.canvasY - 80,
        ]

        pointer.onClick = () => this.createDefaultNodeForSlot({
          nodeFrom: !mClikSlot_isOut ? null : node,
          slotFrom: !mClikSlot_isOut ? null : mClikSlot_index,
          nodeTo: !mClikSlot_isOut ? node : null,
          slotTo: !mClikSlot_isOut ? mClikSlot_index : null,
          position: posRef,
          nodeType: "AUTO",
          posAdd: [!mClikSlot_isOut ? -30 : 30, -alphaPosY * 130],
          posSizeFix: [!mClikSlot_isOut ? -1 : 0, 0],
        })
      }
    }

    // Drag canvas using middle mouse button
    if (this.allow_dragcanvas) {
      pointer.onDragStart = () => this.dragging_canvas = true
      pointer.finally = () => this.dragging_canvas = false
    }
  }

  #processDragZoom(e: PointerEvent): void {
    // stop canvas zoom action
    if (!e.buttons) {
      this.#dragZoomStart = null
      return
    }

    const start = this.#dragZoomStart
    if (!start) throw new TypeError("Drag-zoom state object was null")
    if (!this.graph) throw new NullGraphError()

    // calculate delta
    const deltaY = e.y - start.pos[1]
    const startScale = start.scale

    const scale = startScale - deltaY / 100

    this.ds.changeScale(scale, start.pos)
    this.graph.change()
  }

  /**
   * Called when a mouse move event has to be processed
   */
  processMouseMove(e: PointerEvent): void {
    if (this.dragZoomEnabled && e.ctrlKey && e.shiftKey && this.#dragZoomStart) {
      this.#processDragZoom(e)
      return
    }

    if (this.autoresize) this.resize()

    if (this.set_canvas_dirty_on_mouse_event) this.dirty_canvas = true

    const { graph, resizingGroup, linkConnector, pointer, subgraph } = this
    if (!graph) return

    LGraphCanvas.active_canvas = this
    this.adjustMouseEvent(e)
    const mouse: ReadOnlyPoint = [e.clientX, e.clientY]
    this.mouse[0] = mouse[0]
    this.mouse[1] = mouse[1]
    const delta = [
      mouse[0] - this.last_mouse[0],
      mouse[1] - this.last_mouse[1],
    ]
    this.last_mouse = mouse
    const { canvasX: x, canvasY: y } = e
    this.graph_mouse[0] = x
    this.graph_mouse[1] = y

    if (e.isPrimary) pointer.move(e)

    /** See {@link state}.{@link LGraphCanvasState.hoveringOver hoveringOver} */
    let underPointer = CanvasItem.Nothing
    if (subgraph) {
      underPointer |= subgraph.inputNode.onPointerMove(e)
      underPointer |= subgraph.outputNode.onPointerMove(e)
    }

    if (this.block_click) {
      e.preventDefault()
      return
    }

    e.dragging = this.last_mouse_dragging

    if (this.node_widget) {
      // Legacy widget mouse callbacks for pointermove events
      const [node, widget] = this.node_widget

      if (widget?.mouse) {
        const relativeX = x - node.pos[0]
        const relativeY = y - node.pos[1]
        const result = widget.mouse(e, [relativeX, relativeY], node)
        if (result != null) this.dirty_canvas = result
      }
    }

    // get node over
    const node = graph.getNodeOnPos(
      x,
      y,
      this.visible_nodes,
    )

    const dragRect = this.dragging_rectangle
    if (dragRect) {
      dragRect[2] = x - dragRect[0]
      dragRect[3] = y - dragRect[1]
      this.dirty_canvas = true
    } else if (resizingGroup) {
      // Resizing a group
      underPointer |= CanvasItem.Group
      pointer.resizeDirection = "SE"
    } else if (this.dragging_canvas) {
      this.ds.offset[0] += delta[0] / this.ds.scale
      this.ds.offset[1] += delta[1] / this.ds.scale
      this.#dirty()
    } else if (
      (this.allow_interaction || node?.flags.allow_interaction) &&
      !this.read_only
    ) {
      if (linkConnector.isConnecting) this.dirty_canvas = true

      // remove mouseover flag
      this.updateMouseOverNodes(node, e)

      // mouse over a node
      if (node) {
        underPointer |= CanvasItem.Node

        if (node.redraw_on_mouse) this.dirty_canvas = true

        // For input/output hovering
        // to store the output of isOverNodeInput
        const pos: Point = [0, 0]
        const inputId = isOverNodeInput(node, x, y, pos)
        const outputId = isOverNodeOutput(node, x, y, pos)
        const overWidget = node.getWidgetOnPos(x, y, true) ?? undefined

        if (!node.mouseOver) {
          // mouse enter
          node.mouseOver = {}
          this.node_over = node
          this.dirty_canvas = true

          for (const reroute of this.#visibleReroutes) {
            reroute.hideSlots()
            this.dirty_bgcanvas = true
          }
          node.onMouseEnter?.(e)
        }

        // in case the node wants to do something
        node.onMouseMove?.(e, [x - node.pos[0], y - node.pos[1]], this)

        // The input the mouse is over has changed
        const { mouseOver } = node
        if (
          mouseOver.inputId !== inputId ||
          mouseOver.outputId !== outputId ||
          mouseOver.overWidget !== overWidget
        ) {
          mouseOver.inputId = inputId
          mouseOver.outputId = outputId
          mouseOver.overWidget = overWidget

          // State reset
          linkConnector.overWidget = undefined

          // Check if link is over anything it could connect to - record position of valid target for snap / highlight
          if (linkConnector.isConnecting) {
            const firstLink = linkConnector.renderLinks.at(0)

            // Default: nothing highlighted
            let highlightPos: Point | undefined
            let highlightInput: INodeInputSlot | undefined

            if (!firstLink || !linkConnector.isNodeValidDrop(node)) {
              // No link, or none of the dragged links may be dropped here
            } else if (linkConnector.state.connectingTo === "input") {
              if (overWidget) {
                // Check widgets first - inputId is only valid if over the input socket
                const slot = node.getSlotFromWidget(overWidget)

                if (slot && linkConnector.isInputValidDrop(node, slot)) {
                  highlightInput = slot
                  highlightPos = node.getInputSlotPos(slot)
                  linkConnector.overWidget = overWidget
                }
              }

              // Not over a valid widget - treat drop on invalid widget same as node background
              if (!linkConnector.overWidget) {
                if (inputId === -1 && outputId === -1) {
                // Node background / title under the pointer
                  const result = node.findInputByType(firstLink.fromSlot.type)
                  if (result) {
                    highlightInput = result.slot
                    highlightPos = node.getInputSlotPos(result.slot)
                  }
                } else if (
                  inputId != -1 &&
                  node.inputs[inputId] &&
                  LiteGraph.isValidConnection(firstLink.fromSlot.type, node.inputs[inputId].type)
                ) {
                  highlightPos = pos
                  // XXX CHECK THIS
                  highlightInput = node.inputs[inputId]
                }

                if (highlightInput) {
                  const widget = node.getWidgetFromSlot(highlightInput)
                  if (widget) linkConnector.overWidget = widget
                }
              }
            } else if (linkConnector.state.connectingTo === "output") {
              // Connecting from an input to an output
              if (inputId === -1 && outputId === -1) {
                const result = node.findOutputByType(firstLink.fromSlot.type)
                if (result) {
                  highlightPos = node.getOutputPos(result.index)
                }
              } else {
                // check if I have a slot below de mouse
                if (
                  outputId != -1 &&
                  node.outputs[outputId] &&
                  LiteGraph.isValidConnection(firstLink.fromSlot.type, node.outputs[outputId].type)
                ) {
                  highlightPos = pos
                }
              }
            }
            this._highlight_pos = highlightPos
            this._highlight_input = highlightInput
          }

          this.dirty_canvas = true
        }

        // Resize direction - only show resize cursor if not over inputs/outputs/widgets
        if (!pointer.eDown) {
          if (inputId === -1 && outputId === -1 && !overWidget) {
            pointer.resizeDirection = node.findResizeDirection(x, y)
          } else {
            // Clear resize direction when over inputs/outputs/widgets
            pointer.resizeDirection &&= undefined
          }
        }
      } else {
        // Reroutes
        underPointer = this.#updateReroutes(underPointer)

        // Not over a node
        const segment = this.#getLinkCentreOnPos(e)
        if (this.over_link_center !== segment) {
          underPointer |= CanvasItem.Link
          this.over_link_center = segment
          this.dirty_bgcanvas = true
        }

        if (this.canvas) {
          const group = graph.getGroupOnPos(x, y)
          if (
            group &&
            !e.ctrlKey &&
            !this.read_only &&
            group.isInResize(x, y)
          ) {
            pointer.resizeDirection = "SE"
          } else {
            pointer.resizeDirection &&= undefined
          }
        }
      }

      // send event to node if capturing input (used with widgets that allow drag outside of the area of the node)
      if (this.node_capturing_input && this.node_capturing_input != node) {
        this.node_capturing_input.onMouseMove?.(
          e,
          [
            x - this.node_capturing_input.pos[0],
            y - this.node_capturing_input.pos[1],
          ],
          this,
        )
      }

      // Items being dragged
      if (this.isDragging) {
        const selected = this.selectedItems
        const allItems = e.ctrlKey ? selected : getAllNestedItems(selected)

        const deltaX = delta[0] / this.ds.scale
        const deltaY = delta[1] / this.ds.scale
        for (const item of allItems) {
          item.move(deltaX, deltaY, true)
        }

        this.#dirty()
      }
    }

    this.hoveringOver = underPointer

    e.preventDefault()
    return
  }

  /**
   * Updates the hover / snap state of all visible reroutes.
   * @returns The original value of {@link underPointer}, with any found reroute items added.
   */
  #updateReroutes(underPointer: CanvasItem): CanvasItem {
    const { graph, pointer, linkConnector } = this
    if (!graph) throw new NullGraphError()

    // Update reroute hover state
    if (!pointer.isDown) {
      let anyChanges = false
      for (const reroute of this.#visibleReroutes) {
        anyChanges ||= reroute.updateVisibility(this.graph_mouse)

        if (reroute.isSlotHovered) underPointer |= CanvasItem.RerouteSlot
      }
      if (anyChanges) this.dirty_bgcanvas = true
    } else if (linkConnector.isConnecting) {
      // Highlight the reroute that the mouse is over
      for (const reroute of this.#visibleReroutes) {
        if (reroute.containsPoint(this.graph_mouse)) {
          if (linkConnector.isRerouteValidDrop(reroute)) {
            linkConnector.overReroute = reroute
            this._highlight_pos = reroute.pos
          }

          return underPointer |= CanvasItem.RerouteSlot
        }
      }
    }

    this._highlight_pos &&= undefined
    linkConnector.overReroute &&= undefined
    return underPointer
  }

  /**
   * Start dragging an item, optionally including all other selected items.
   *
   * ** This function sets the {@link CanvasPointer.finally}() callback. **
   * @param item The item that the drag event started on
   * @param pointer The pointer event that initiated the drag, e.g. pointerdown
   * @param sticky If `true`, the item is added to the selection - see {@link processSelect}
   */
  #startDraggingItems(item: Positionable, pointer: CanvasPointer, sticky = false): void {
    this.emitBeforeChange()
    this.graph?.beforeChange()
    // Ensure that dragging is properly cleaned up, on success or failure.
    pointer.finally = () => {
      this.isDragging = false
      this.graph?.afterChange()
      this.emitAfterChange()
    }

    this.processSelect(item, pointer.eDown, sticky)
    this.isDragging = true
  }

  /**
   * Handles shared clean up and placement after items have been dragged.
   * @param e The event that completed the drag, e.g. pointerup, pointermove
   */
  #processDraggedItems(e: CanvasPointerEvent): void {
    const { graph } = this
    if (e.shiftKey || LiteGraph.alwaysSnapToGrid)
      graph?.snapToGrid(this.selectedItems)

    this.dirty_canvas = true
    this.dirty_bgcanvas = true

    // TODO: Replace legacy behaviour: callbacks were never extended for multiple items
    this.onNodeMoved?.(findFirstNode(this.selectedItems))
  }

  /**
   * Called when a mouse up event has to be processed
   */
  processMouseUp(e: PointerEvent): void {
    // early exit for extra pointer
    if (e.isPrimary === false) return

    const { graph, pointer } = this
    if (!graph) return

    LGraphCanvas.active_canvas = this

    this.adjustMouseEvent(e)

    const now = LiteGraph.getTime()
    e.click_time = now - this.last_mouseclick

    /** The mouseup event occurred near the mousedown event. */
    /** Normal-looking click event - mouseUp occurred near mouseDown, without dragging. */
    const isClick = pointer.up(e)
    if (isClick === true) {
      pointer.isDown = false
      pointer.isDouble = false
      // Required until all link behaviour is added to Pointer API
      this.connecting_links = null
      this.dragging_canvas = false

      graph.change()

      e.stopPropagation()
      e.preventDefault()
      return
    }

    this.last_mouse_dragging = false
    this.last_click_position = null

    // used to avoid sending twice a click in an immediate button
    this.block_click &&= false

    if (e.button === 0) {
      // left button
      this.selected_group = null

      this.isDragging = false

      const x = e.canvasX
      const y = e.canvasY

      if (!this.linkConnector.isConnecting) {
        this.dirty_canvas = true

        // @ts-expect-error Unused param
        this.node_over?.onMouseUp?.(e, [x - this.node_over.pos[0], y - this.node_over.pos[1]], this)
        this.node_capturing_input?.onMouseUp?.(e, [
          x - this.node_capturing_input.pos[0],
          y - this.node_capturing_input.pos[1],
        ])
      }
    } else if (e.button === 1) {
      // middle button
      this.dirty_canvas = true
      this.dragging_canvas = false
    } else if (e.button === 2) {
      // right button
      this.dirty_canvas = true
    }

    pointer.isDown = false
    pointer.isDouble = false

    graph.change()

    e.stopPropagation()
    e.preventDefault()
    return
  }

  /**
   * Called when the mouse moves off the canvas.  Clears all node hover states.
   * @param e
   */
  processMouseOut(e: MouseEvent): void {
    // TODO: Check if document.contains(e.relatedTarget) - handle mouseover node textarea etc.
    this.adjustMouseEvent(e)
    this.updateMouseOverNodes(null, e)
  }

  processMouseCancel(): void {
    console.warn("Pointer cancel!")
    this.pointer.reset()
  }

  /**
   * Called when a mouse wheel event has to be processed
   */
  processMouseWheel(e: WheelEvent): void {
    if (!this.graph || !this.allow_dragcanvas) return

    // TODO: Mouse wheel zoom rewrite
    // @ts-expect-error
    const delta = e.wheelDeltaY ?? e.detail * -60

    this.adjustMouseEvent(e)

    const pos: Point = [e.clientX, e.clientY]
    if (this.viewport && !isPointInRect(pos, this.viewport)) return

    let { scale } = this.ds

    if (
      LiteGraph.macTrackpadGestures &&
      (!LiteGraph.macGesturesRequireMac || navigator.userAgent.includes("Mac"))
    ) {
      if (e.ctrlKey) {
        scale *= 1 + e.deltaY * (1 - this.zoom_speed) * 0.18
        this.ds.changeScale(scale, [e.clientX, e.clientY], false)
      } else {
        this.ds.offset[0] -= e.deltaX * 1.18 * (1 / scale)
        this.ds.offset[1] -= e.deltaY * 1.18 * (1 / scale)
      }
    } else {
      if (delta > 0) {
        scale *= this.zoom_speed
      } else if (delta < 0) {
        scale *= 1 / (this.zoom_speed)
      }
      this.ds.changeScale(scale, [e.clientX, e.clientY])
    }

    this.graph.change()

    e.preventDefault()
    return
  }

  #noItemsSelected(): void {
    const event = new CustomEvent("litegraph:no-items-selected", { bubbles: true })
    this.canvas.dispatchEvent(event)
  }

  /**
   * process a key event
   */
  processKey(e: KeyboardEvent): void {
    this.#shiftDown = e.shiftKey

    const { graph } = this
    if (!graph) return

    let block_default = false
    // @ts-expect-error
    if (e.target.localName == "input") return

    if (e.type == "keydown") {
      // TODO: Switch
      if (e.key === " ") {
        // space
        this.read_only = true
        if (this._previously_dragging_canvas === null) {
          this._previously_dragging_canvas = this.dragging_canvas
        }
        this.dragging_canvas = this.pointer.isDown
        block_default = true
      } else if (e.key === "Escape") {
        // esc
        if (this.linkConnector.isConnecting) {
          this.linkConnector.reset()
          e.preventDefault()
          return
        }
        this.node_panel?.close()
        this.options_panel?.close()
        if (this.node_panel || this.options_panel) block_default = true
      } else if (e.keyCode === 65 && e.ctrlKey) {
        // select all Control A
        this.selectItems()
        block_default = true
      } else if (e.keyCode === 67 && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        // copy
        if (this.selected_nodes) {
          this.copyToClipboard()
          block_default = true
        }
      } else if (e.keyCode === 86 && (e.metaKey || e.ctrlKey)) {
        // paste
        this.pasteFromClipboard({ connectInputs: e.shiftKey })
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // delete or backspace
        // @ts-expect-error
        if (e.target.localName != "input" && e.target.localName != "textarea") {
          if (this.selectedItems.size === 0) {
            this.#noItemsSelected()
            return
          }

          this.deleteSelected()
          block_default = true
        }
      }

      // TODO
      for (const node of Object.values(this.selected_nodes)) {
        node.onKeyDown?.(e)
      }
    } else if (e.type == "keyup") {
      if (e.key === " ") {
        // space
        this.read_only = false
        this.dragging_canvas = (this._previously_dragging_canvas ?? false) && this.pointer.isDown
        this._previously_dragging_canvas = null
      }

      for (const node of Object.values(this.selected_nodes)) {
        node.onKeyUp?.(e)
      }
    }

    // TODO: Do we need to remeasure and recalculate everything on every key down/up?
    graph.change()

    if (block_default) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  }

  /**
   * Copies canvas items to an internal, app-specific clipboard backed by local storage.
   * When called without parameters, it copies {@link selectedItems}.
   * @param items The items to copy.  If nullish, all selected items are copied.
   */
  copyToClipboard(items?: Iterable<Positionable>): void {
    const serialisable: Required<ClipboardItems> = {
      nodes: [],
      groups: [],
      reroutes: [],
      links: [],
    }

    // Create serialisable objects
    for (const item of items ?? this.selectedItems) {
      if (item instanceof LGraphNode) {
        // Nodes
        if (item.clonable === false) continue

        const cloned = item.clone()?.serialize()
        if (!cloned) continue

        cloned.id = item.id
        serialisable.nodes.push(cloned)

        // Links
        if (item.inputs) {
          for (const { link: linkId } of item.inputs) {
            if (linkId == null) continue

            const link = this.graph?._links.get(linkId)?.asSerialisable()
            if (link) serialisable.links.push(link)
          }
        }
      } else if (item instanceof LGraphGroup) {
        // Groups
        serialisable.groups.push(item.serialize())
      } else if (item instanceof Reroute) {
        // Reroutes
        serialisable.reroutes.push(item.asSerialisable())
      }
    }

    localStorage.setItem(
      "litegrapheditor_clipboard",
      JSON.stringify(serialisable),
    )
  }

  emitEvent(detail: LGraphCanvasEventMap["litegraph:canvas"]): void {
    this.canvas.dispatchEvent(
      new CustomEvent("litegraph:canvas", {
        bubbles: true,
        detail,
      }),
    )
  }

  /** @todo Refactor to where it belongs - e.g. Deleting / creating nodes is not actually canvas event. */
  emitBeforeChange(): void {
    this.emitEvent({
      subType: "before-change",
    })
  }

  /** @todo See {@link emitBeforeChange} */
  emitAfterChange(): void {
    this.emitEvent({
      subType: "after-change",
    })
  }

  /**
   * Pastes the items from the canvas "clipbaord" - a local storage variable.
   */
  _pasteFromClipboard(options: IPasteFromClipboardOptions = {}): ClipboardPasteResult | undefined {
    const {
      connectInputs = false,
      position = this.graph_mouse,
    } = options

    // if ctrl + shift + v is off, return when isConnectUnselected is true (shift is pressed) to maintain old behavior
    if (!LiteGraph.ctrl_shift_v_paste_connect_unselected_outputs && connectInputs) return

    const data = localStorage.getItem("litegrapheditor_clipboard")
    if (!data) return

    const { graph } = this
    if (!graph) throw new NullGraphError()
    graph.beforeChange()

    // Parse & initialise
    const parsed: ClipboardItems = JSON.parse(data)
    parsed.nodes ??= []
    parsed.groups ??= []
    parsed.reroutes ??= []
    parsed.links ??= []

    // Find top-left-most boundary
    let offsetX = Infinity
    let offsetY = Infinity
    for (const item of [...parsed.nodes, ...parsed.reroutes]) {
      if (item.pos == null) throw new TypeError("Invalid node encounterd on paste.  `pos` was null.")

      if (item.pos[0] < offsetX) offsetX = item.pos[0]
      if (item.pos[1] < offsetY) offsetY = item.pos[1]
    }

    // TODO: Remove when implementing `asSerialisable`
    if (parsed.groups) {
      for (const group of parsed.groups) {
        if (group.bounding[0] < offsetX) offsetX = group.bounding[0]
        if (group.bounding[1] < offsetY) offsetY = group.bounding[1]
      }
    }

    const results: ClipboardPasteResult = {
      created: [],
      nodes: new Map<NodeId, LGraphNode>(),
      links: new Map<LinkId, LLink>(),
      reroutes: new Map<RerouteId, Reroute>(),
    }
    const { created, nodes, links, reroutes } = results

    // const failedNodes: ISerialisedNode[] = []

    // Groups
    for (const info of parsed.groups) {
      info.id = -1

      const group = new LGraphGroup()
      group.configure(info)
      graph.add(group)
      created.push(group)
    }

    // Nodes
    for (const info of parsed.nodes) {
      const node = info.type == null ? null : LiteGraph.createNode(info.type)
      if (!node) {
        // failedNodes.push(info)
        continue
      }

      nodes.set(info.id, node)
      info.id = -1

      node.configure(info)
      graph.add(node)

      created.push(node)
    }

    // Reroutes
    for (const info of parsed.reroutes) {
      const { id, ...rerouteInfo } = info

      const reroute = graph.setReroute(rerouteInfo)
      created.push(reroute)
      reroutes.set(id, reroute)
    }

    // Remap reroute parentIds for pasted reroutes
    for (const reroute of reroutes.values()) {
      if (reroute.parentId == null) continue

      const mapped = reroutes.get(reroute.parentId)
      if (mapped) reroute.parentId = mapped.id
    }

    // Links
    for (const info of parsed.links) {
      // Find the copied node / reroute ID
      let outNode: LGraphNode | null | undefined = nodes.get(info.origin_id)
      let afterRerouteId: number | undefined
      if (info.parentId != null) afterRerouteId = reroutes.get(info.parentId)?.id

      // If it wasn't copied, use the original graph value
      if (connectInputs && LiteGraph.ctrl_shift_v_paste_connect_unselected_outputs) {
        outNode ??= graph.getNodeById(info.origin_id)
        afterRerouteId ??= info.parentId
      }

      const inNode = nodes.get(info.target_id)
      if (inNode) {
        const link = outNode?.connect(
          info.origin_slot,
          inNode,
          info.target_slot,
          afterRerouteId,
        )
        if (link) links.set(info.id, link)
      }
    }

    // Remap linkIds
    for (const reroute of reroutes.values()) {
      const ids = [...reroute.linkIds].map(x => links.get(x)?.id ?? x)
      reroute.update(reroute.parentId, undefined, ids, reroute.floating)

      // Remove any invalid items
      if (!reroute.validateLinks(graph.links, graph.floatingLinks)) {
        graph.removeReroute(reroute.id)
      }
    }

    // Adjust positions
    for (const item of created) {
      item.pos[0] += position[0] - offsetX
      item.pos[1] += position[1] - offsetY
    }

    // TODO: Report failures, i.e. `failedNodes`

    this.selectItems(created)

    graph.afterChange()

    return results
  }

  pasteFromClipboard(options: IPasteFromClipboardOptions = {}): void {
    this.emitBeforeChange()
    try {
      this._pasteFromClipboard(options)
    } finally {
      this.emitAfterChange()
    }
  }

  processNodeDblClicked(n: LGraphNode): void {
    this.onShowNodePanel?.(n)
    this.onNodeDblClicked?.(n)

    this.setDirty(true)
  }

  #handleMultiSelect(e: CanvasPointerEvent, dragRect: Float32Array) {
    // Process drag
    // Convert Point pair (pos, offset) to Rect
    const { graph, selectedItems, subgraph } = this
    if (!graph) throw new NullGraphError()

    const w = Math.abs(dragRect[2])
    const h = Math.abs(dragRect[3])
    if (dragRect[2] < 0) dragRect[0] -= w
    if (dragRect[3] < 0) dragRect[1] -= h
    dragRect[2] = w
    dragRect[3] = h

    // Select nodes - any part of the node is in the select area
    const isSelected = new Set<Positionable>()
    const notSelected: Positionable[] = []

    if (subgraph) {
      const { inputNode, outputNode } = subgraph

      if (overlapBounding(dragRect, inputNode.boundingRect)) {
        addPositionable(inputNode)
      }
      if (overlapBounding(dragRect, outputNode.boundingRect)) {
        addPositionable(outputNode)
      }
    }

    for (const nodeX of graph._nodes) {
      if (overlapBounding(dragRect, nodeX.boundingRect)) {
        addPositionable(nodeX)
      }
    }

    // Select groups - the group is wholly inside the select area
    for (const group of graph.groups) {
      if (!containsRect(dragRect, group._bounding)) continue

      group.recomputeInsideNodes()
      addPositionable(group)
    }

    // Select reroutes - the centre point is inside the select area
    for (const reroute of graph.reroutes.values()) {
      if (!isPointInRect(reroute.pos, dragRect)) continue

      selectedItems.add(reroute)
      reroute.selected = true
      addPositionable(reroute)
    }

    if (e.shiftKey) {
      // Add to selection
      for (const item of notSelected) this.select(item)
    } else if (e.altKey) {
      // Remove from selection
      for (const item of isSelected) this.deselect(item)
    } else {
      // Replace selection
      for (const item of selectedItems.values()) {
        if (!isSelected.has(item)) this.deselect(item)
      }
      for (const item of notSelected) this.select(item)
    }
    this.onSelectionChange?.(this.selected_nodes)

    function addPositionable(item: Positionable): void {
      if (!item.selected || !selectedItems.has(item)) notSelected.push(item)
      else isSelected.add(item)
    }
  }

  /**
   * Determines whether to select or deselect an item that has received a pointer event.  Will deselect other nodes if
   * @param item Canvas item to select/deselect
   * @param e The MouseEvent to handle
   * @param sticky Prevents deselecting individual nodes (as used by aux/right-click)
   * @remarks
   * Accessibility: anyone using {@link mutli_select} always deselects when clicking empty space.
   */
  processSelect<TPositionable extends Positionable = LGraphNode>(
    item: TPositionable | null | undefined,
    e: CanvasMouseEvent | undefined,
    sticky: boolean = false,
  ): void {
    const addModifier = e?.shiftKey
    const subtractModifier = e != null && (e.metaKey || e.ctrlKey)
    const eitherModifier = addModifier || subtractModifier
    const modifySelection = eitherModifier || this.multi_select

    if (!item) {
      if (!eitherModifier || this.multi_select) this.deselectAll()
    } else if (!item.selected || !this.selectedItems.has(item)) {
      if (!modifySelection) this.deselectAll(item)
      this.select(item)
    } else if (modifySelection && !sticky) {
      this.deselect(item)
    } else if (!sticky) {
      this.deselectAll(item)
    } else {
      return
    }
    this.onSelectionChange?.(this.selected_nodes)
    this.setDirty(true)
  }

  /**
   * Selects a {@link Positionable} item.
   * @param item The canvas item to add to the selection.
   */
  select<TPositionable extends Positionable = LGraphNode>(item: TPositionable): void {
    if (item.selected && this.selectedItems.has(item)) return

    item.selected = true
    this.selectedItems.add(item)
    this.state.selectionChanged = true
    if (!(item instanceof LGraphNode)) return

    // Node-specific handling
    item.onSelected?.()
    this.selected_nodes[item.id] = item

    this.onNodeSelected?.(item)

    // Highlight links
    if (item.inputs) {
      for (const input of item.inputs) {
        if (input.link == null) continue
        this.highlighted_links[input.link] = true
      }
    }
    if (item.outputs) {
      for (const id of item.outputs.flatMap(x => x.links)) {
        if (id == null) continue
        this.highlighted_links[id] = true
      }
    }
  }

  /**
   * Deselects a {@link Positionable} item.
   * @param item The canvas item to remove from the selection.
   */
  deselect<TPositionable extends Positionable = LGraphNode>(item: TPositionable): void {
    if (!item.selected && !this.selectedItems.has(item)) return

    item.selected = false
    this.selectedItems.delete(item)
    this.state.selectionChanged = true
    if (!(item instanceof LGraphNode)) return

    // Node-specific handling
    item.onDeselected?.()
    delete this.selected_nodes[item.id]

    this.onNodeDeselected?.(item)

    // Should be moved to top of function, and throw if null
    const { graph } = this
    if (!graph) return

    // Clear link highlight
    if (item.inputs) {
      for (const input of item.inputs) {
        if (input.link == null) continue

        const node = LLink.getOriginNode(graph, input.link)
        if (node && this.selectedItems.has(node)) continue

        delete this.highlighted_links[input.link]
      }
    }
    if (item.outputs) {
      for (const id of item.outputs.flatMap(x => x.links)) {
        if (id == null) continue

        const node = LLink.getTargetNode(graph, id)
        if (node && this.selectedItems.has(node)) continue

        delete this.highlighted_links[id]
      }
    }
  }

  /** @deprecated See {@link LGraphCanvas.processSelect} */
  processNodeSelected(item: LGraphNode, e: CanvasMouseEvent): void {
    this.processSelect(
      item,
      e,
      e && (e.shiftKey || e.metaKey || e.ctrlKey || this.multi_select),
    )
  }

  /** @deprecated See {@link LGraphCanvas.select} */
  selectNode(node: LGraphNode, add_to_current_selection?: boolean): void {
    if (node == null) {
      this.deselectAll()
    } else {
      this.selectNodes([node], add_to_current_selection)
    }
  }

  get empty(): boolean {
    if (!this.graph) throw new NullGraphError()
    return this.graph.empty
  }

  get positionableItems() {
    if (!this.graph) throw new NullGraphError()
    return this.graph.positionableItems()
  }

  /**
   * Selects several items.
   * @param items Items to select - if falsy, all items on the canvas will be selected
   * @param add_to_current_selection If set, the items will be added to the current selection instead of replacing it
   */
  selectItems(items?: Positionable[], add_to_current_selection?: boolean): void {
    const itemsToSelect = items ?? this.positionableItems
    if (!add_to_current_selection) this.deselectAll()
    for (const item of itemsToSelect) this.select(item)
    this.onSelectionChange?.(this.selected_nodes)
    this.setDirty(true)
  }

  /**
   * selects several nodes (or adds them to the current selection)
   * @deprecated See {@link LGraphCanvas.selectItems}
   */
  selectNodes(nodes?: LGraphNode[], add_to_current_selection?: boolean): void {
    this.selectItems(nodes, add_to_current_selection)
  }

  /** @deprecated See {@link LGraphCanvas.deselect} */
  deselectNode(node: LGraphNode): void {
    this.deselect(node)
  }

  /**
   * Deselects all items on the canvas.
   * @param keepSelected If set, this item will not be removed from the selection.
   */
  deselectAll(keepSelected?: Positionable): void {
    if (!this.graph) return

    const selected = this.selectedItems
    if (!selected.size) return

    let wasSelected: Positionable | undefined
    for (const sel of selected) {
      if (sel === keepSelected) {
        wasSelected = sel
        continue
      }
      sel.onDeselected?.()
      sel.selected = false
    }
    selected.clear()
    if (wasSelected) selected.add(wasSelected)

    this.setDirty(true)

    // Legacy code
    const oldNode = keepSelected?.id == null ? null : this.selected_nodes[keepSelected.id]
    this.selected_nodes = {}
    this.current_node = null
    this.highlighted_links = {}

    if (keepSelected instanceof LGraphNode) {
      // Handle old object lookup
      if (oldNode) this.selected_nodes[oldNode.id] = oldNode

      // Highlight links
      if (keepSelected.inputs) {
        for (const input of keepSelected.inputs) {
          if (input.link == null) continue
          this.highlighted_links[input.link] = true
        }
      }
      if (keepSelected.outputs) {
        for (const id of keepSelected.outputs.flatMap(x => x.links)) {
          if (id == null) continue
          this.highlighted_links[id] = true
        }
      }
    }

    this.state.selectionChanged = true
    this.onSelectionChange?.(this.selected_nodes)
  }

  /** @deprecated See {@link LGraphCanvas.deselectAll} */
  deselectAllNodes(): void {
    this.deselectAll()
  }

  /**
   * Deletes all selected items from the graph.
   * @todo Refactor deletion task to LGraph.  Selection is a canvas property, delete is a graph action.
   */
  deleteSelected(): void {
    const { graph } = this
    if (!graph) throw new NullGraphError()

    this.emitBeforeChange()
    graph.beforeChange()

    for (const item of this.selectedItems) {
      if (item instanceof LGraphNode) {
        const node = item
        if (node.block_delete) continue
        node.connectInputToOutput()
        graph.remove(node)
        this.onNodeDeselected?.(node)
      } else if (item instanceof LGraphGroup) {
        graph.remove(item)
      } else if (item instanceof Reroute) {
        graph.removeReroute(item.id)
      }
    }

    this.selected_nodes = {}
    this.selectedItems.clear()
    this.current_node = null
    this.highlighted_links = {}

    this.state.selectionChanged = true
    this.onSelectionChange?.(this.selected_nodes)
    this.setDirty(true)
    graph.afterChange()
    this.emitAfterChange()
  }

  /**
   * deletes all nodes in the current selection from the graph
   * @deprecated See {@link LGraphCanvas.deleteSelected}
   */
  deleteSelectedNodes(): void {
    this.deleteSelected()
  }

  /**
   * centers the camera on a given node
   */
  centerOnNode(node: LGraphNode): void {
    const dpi = window?.devicePixelRatio || 1
    this.ds.offset[0] =
      -node.pos[0] -
      node.size[0] * 0.5 +
      (this.canvas.width * 0.5) / (this.ds.scale * dpi)
    this.ds.offset[1] =
      -node.pos[1] -
      node.size[1] * 0.5 +
      (this.canvas.height * 0.5) / (this.ds.scale * dpi)
    this.setDirty(true, true)
  }

  /**
   * adds some useful properties to a mouse event, like the position in graph coordinates
   */
  adjustMouseEvent<T extends MouseEvent>(
    e: T & Partial<CanvasPointerExtensions>,
  ): asserts e is T & CanvasMouseEvent {
    let clientX_rel = e.clientX
    let clientY_rel = e.clientY

    if (this.canvas) {
      const b = this.canvas.getBoundingClientRect()
      clientX_rel -= b.left
      clientY_rel -= b.top
    }

    e.safeOffsetX = clientX_rel
    e.safeOffsetY = clientY_rel

    // TODO: Find a less brittle way to do this

    // Only set deltaX and deltaY if not already set.
    // If deltaX and deltaY are already present, they are read-only.
    // Setting them would result browser error => zoom in/out feature broken.
    if (e.deltaX === undefined)
      e.deltaX = clientX_rel - this.last_mouse_position[0]
    if (e.deltaY === undefined)
      e.deltaY = clientY_rel - this.last_mouse_position[1]

    this.last_mouse_position[0] = clientX_rel
    this.last_mouse_position[1] = clientY_rel

    e.canvasX = clientX_rel / this.ds.scale - this.ds.offset[0]
    e.canvasY = clientY_rel / this.ds.scale - this.ds.offset[1]
  }

  /**
   * changes the zoom level of the graph (default is 1), you can pass also a place used to pivot the zoom
   */
  setZoom(value: number, zooming_center: Point) {
    this.ds.changeScale(value, zooming_center)
    this.#dirty()
  }

  /**
   * converts a coordinate from graph coordinates to canvas2D coordinates
   */
  convertOffsetToCanvas(pos: Point, out: Point): Point {
    // @ts-expect-error Unused param
    return this.ds.convertOffsetToCanvas(pos, out)
  }

  /**
   * converts a coordinate from Canvas2D coordinates to graph space
   */
  convertCanvasToOffset(pos: Point, out?: Point): Point {
    return this.ds.convertCanvasToOffset(pos, out)
  }

  // converts event coordinates from canvas2D to graph coordinates
  convertEventToCanvasOffset(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect()
    // TODO: -> this.ds.convertCanvasToOffset
    return this.convertCanvasToOffset([
      e.clientX - rect.left,
      e.clientY - rect.top,
    ])
  }

  /**
   * brings a node to front (above all other nodes)
   */
  bringToFront(node: LGraphNode): void {
    const { graph } = this
    if (!graph) throw new NullGraphError()

    const i = graph._nodes.indexOf(node)
    if (i == -1) return

    graph._nodes.splice(i, 1)
    graph._nodes.push(node)
  }

  /**
   * sends a node to the back (below all other nodes)
   */
  sendToBack(node: LGraphNode): void {
    const { graph } = this
    if (!graph) throw new NullGraphError()

    const i = graph._nodes.indexOf(node)
    if (i == -1) return

    graph._nodes.splice(i, 1)
    graph._nodes.unshift(node)
  }

  /**
   * Determines which nodes are visible and populates {@link out} with the results.
   * @param nodes The list of nodes to check - if falsy, all nodes in the graph will be checked
   * @param out Array to write visible nodes into - if falsy, a new array is created instead
   * @returns Array passed ({@link out}), or a new array containing all visible nodes
   */
  computeVisibleNodes(nodes?: LGraphNode[], out?: LGraphNode[]): LGraphNode[] {
    const visible_nodes = out || []
    visible_nodes.length = 0
    if (!this.graph) throw new NullGraphError()

    const _nodes = nodes || this.graph._nodes
    for (const node of _nodes) {
      node.updateArea(this.ctx)
      // Not in visible area
      if (!overlapBounding(this.visible_area, node.renderArea)) continue

      visible_nodes.push(node)
    }
    return visible_nodes
  }

  /**
   * Checks if a node is visible on the canvas.
   * @param node The node to check
   * @returns `true` if the node is visible, otherwise `false`
   */
  isNodeVisible(node: LGraphNode): boolean {
    return this.#visible_node_ids.has(node.id)
  }

  /**
   * renders the whole canvas content, by rendering in two separated canvas, one containing the background grid and the connections, and one containing the nodes)
   */
  draw(force_canvas?: boolean, force_bgcanvas?: boolean): void {
    if (!this.canvas || this.canvas.width == 0 || this.canvas.height == 0) return

    // fps counting
    const now = LiteGraph.getTime()
    this.render_time = (now - this.last_draw_time) * 0.001
    this.last_draw_time = now

    if (this.graph) this.ds.computeVisibleArea(this.viewport)

    // Compute node size before drawing links.
    if (this.dirty_canvas || force_canvas) {
      this.computeVisibleNodes(undefined, this.visible_nodes)
      // Update visible node IDs
      this.#visible_node_ids = new Set(this.visible_nodes.map(node => node.id))

      // Arrange subgraph IO nodes
      const { subgraph } = this
      if (subgraph) {
        subgraph.inputNode.arrange()
        subgraph.outputNode.arrange()
      }
    }

    if (
      this.dirty_bgcanvas ||
      force_bgcanvas ||
      this.always_render_background ||
      (this.graph?._last_trigger_time &&
        now - this.graph._last_trigger_time < 1000)
    ) {
      this.drawBackCanvas()
    }

    if (this.dirty_canvas || force_canvas) this.drawFrontCanvas()

    this.fps = this.render_time ? 1.0 / this.render_time : 0
    this.frame++
  }

  /**
   * draws the front canvas (the one containing all the nodes)
   */
  drawFrontCanvas(): void {
    this.dirty_canvas = false

    const { ctx, canvas, graph, linkConnector } = this

    // @ts-expect-error
    if (ctx.start2D && !this.viewport) {
      // @ts-expect-error
      ctx.start2D()
      ctx.restore()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    }

    // clip dirty area if there is one, otherwise work in full canvas
    const area = this.viewport || this.dirty_area
    if (area) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(area[0], area[1], area[2], area[3])
      ctx.clip()
    }

    // TODO: Set snapping value when changed instead of once per frame
    this.#snapToGrid = this.#shiftDown || LiteGraph.alwaysSnapToGrid
      ? this.graph?.getSnapToGridSize()
      : undefined

    // clear
    // canvas.width = canvas.width;
    if (this.clear_background) {
      if (area) ctx.clearRect(area[0], area[1], area[2], area[3])
      else ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    // draw bg canvas
    if (this.bgcanvas == this.canvas) {
      this.drawBackCanvas()
    } else {
      const scale = window.devicePixelRatio
      ctx.drawImage(
        this.bgcanvas,
        0,
        0,
        this.bgcanvas.width / scale,
        this.bgcanvas.height / scale,
      )
    }

    // rendering
    this.onRender?.(canvas, ctx)

    // info widget
    if (this.show_info) {
      this.renderInfo(ctx, area ? area[0] : 0, area ? area[1] : 0)
    }

    if (graph) {
      // apply transformations
      ctx.save()
      this.ds.toCanvasContext(ctx)

      // draw nodes
      const { visible_nodes } = this
      const drawSnapGuides = this.#snapToGrid && this.isDragging

      for (const node of visible_nodes) {
        ctx.save()

        // Draw snap shadow
        if (drawSnapGuides && this.selectedItems.has(node))
          this.drawSnapGuide(ctx, node)

        // Localise co-ordinates to node position
        ctx.translate(node.pos[0], node.pos[1])

        // Draw
        this.drawNode(node, ctx)

        ctx.restore()
      }

      // Draw subgraph IO nodes
      this.subgraph?.draw(ctx, this.colourGetter)

      // on top (debug)
      if (this.render_execution_order) {
        this.drawExecutionOrder(ctx)
      }

      // connections ontop?
      if (graph.config.links_ontop) {
        this.drawConnections(ctx)
      }

      if (linkConnector.isConnecting) {
        // current connection (the one being dragged by the mouse)
        const { renderLinks } = linkConnector
        const highlightPos = this.#getHighlightPosition()
        ctx.lineWidth = this.connections_width

        for (const renderLink of renderLinks) {
          const { fromSlot, fromPos: pos, fromDirection, dragDirection } = renderLink
          const connShape = fromSlot.shape
          const connType = fromSlot.type

          const colour = connType === LiteGraph.EVENT
            ? LiteGraph.EVENT_LINK_COLOR
            : LiteGraph.CONNECTING_LINK_COLOR

          // the connection being dragged by the mouse
          this.renderLink(
            ctx,
            pos,
            highlightPos,
            null,
            false,
            null,
            colour,
            fromDirection,
            dragDirection,
          )

          ctx.beginPath()
          if (connType === LiteGraph.EVENT || connShape === RenderShape.BOX) {
            ctx.rect(pos[0] - 6 + 0.5, pos[1] - 5 + 0.5, 14, 10)
            ctx.rect(
              highlightPos[0] - 6 + 0.5,
              highlightPos[1] - 5 + 0.5,
              14,
              10,
            )
          } else if (connShape === RenderShape.ARROW) {
            ctx.moveTo(pos[0] + 8, pos[1] + 0.5)
            ctx.lineTo(pos[0] - 4, pos[1] + 6 + 0.5)
            ctx.lineTo(pos[0] - 4, pos[1] - 6 + 0.5)
            ctx.closePath()
          } else {
            ctx.arc(pos[0], pos[1], 4, 0, Math.PI * 2)
            ctx.arc(highlightPos[0], highlightPos[1], 4, 0, Math.PI * 2)
          }
          ctx.fill()
        }

        // Gradient half-border over target node
        this.#renderSnapHighlight(ctx, highlightPos)
      }

      // Area-selection rectangle
      if (this.dragging_rectangle) {
        const { eDown, eMove } = this.pointer
        ctx.strokeStyle = "#FFF"

        if (eDown && eMove) {
          // Do not scale the selection box
          const transform = ctx.getTransform()
          const ratio = Math.max(1, window.devicePixelRatio)
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

          const x = eDown.safeOffsetX
          const y = eDown.safeOffsetY
          ctx.strokeRect(x, y, eMove.safeOffsetX - x, eMove.safeOffsetY - y)

          ctx.setTransform(transform)
        } else {
          // Fallback to legacy behaviour
          const [x, y, w, h] = this.dragging_rectangle
          ctx.strokeRect(x, y, w, h)
        }
      }

      // on top of link center
      if (!this.isDragging && this.over_link_center && this.render_link_tooltip) {
        this.drawLinkTooltip(ctx, this.over_link_center)
      } else {
        this.onDrawLinkTooltip?.(ctx, null)
      }

      // custom info
      this.onDrawForeground?.(ctx, this.visible_area)

      ctx.restore()
    }

    this.onDrawOverlay?.(ctx)

    if (area) ctx.restore()
  }

  /** @returns If the pointer is over a link centre marker, the link segment it belongs to.  Otherwise, `undefined`.  */
  #getLinkCentreOnPos(e: CanvasMouseEvent): LinkSegment | undefined {
    for (const linkSegment of this.renderedPaths) {
      const centre = linkSegment._pos
      if (!centre) continue

      if (isInRectangle(e.canvasX, e.canvasY, centre[0] - 4, centre[1] - 4, 8, 8)) {
        return linkSegment
      }
    }
  }

  /** Get the target snap / highlight point in graph space */
  #getHighlightPosition(): ReadOnlyPoint {
    return LiteGraph.snaps_for_comfy
      ? this.linkConnector.state.snapLinksPos ?? this._highlight_pos ?? this.graph_mouse
      : this.graph_mouse
  }

  /**
   * Renders indicators showing where a link will connect if released.
   * Partial border over target node and a highlight over the slot itself.
   * @param ctx Canvas 2D context
   */
  #renderSnapHighlight(
    ctx: CanvasRenderingContext2D,
    highlightPos: ReadOnlyPoint,
  ): void {
    const linkConnectorSnap = !!this.linkConnector.state.snapLinksPos
    if (!this._highlight_pos && !linkConnectorSnap) return

    ctx.fillStyle = "#ffcc00"
    ctx.beginPath()
    const shape = this._highlight_input?.shape

    if (shape === RenderShape.ARROW) {
      ctx.moveTo(highlightPos[0] + 8, highlightPos[1] + 0.5)
      ctx.lineTo(highlightPos[0] - 4, highlightPos[1] + 6 + 0.5)
      ctx.lineTo(highlightPos[0] - 4, highlightPos[1] - 6 + 0.5)
      ctx.closePath()
    } else {
      ctx.arc(highlightPos[0], highlightPos[1], 6, 0, Math.PI * 2)
    }
    ctx.fill()

    const { linkConnector } = this
    const { overReroute, overWidget } = linkConnector
    if (!LiteGraph.snap_highlights_node || !linkConnector.isConnecting || linkConnectorSnap) return

    // Reroute highlight
    overReroute?.drawHighlight(ctx, "#ffcc00aa")

    // Ensure we're mousing over a node and connecting a link
    const node = this.node_over
    if (!node) return

    const { strokeStyle, lineWidth } = ctx

    const area = node.boundingRect
    const gap = 3
    const radius = LiteGraph.ROUND_RADIUS + gap

    const x = area[0] - gap
    const y = area[1] - gap
    const width = area[2] + gap * 2
    const height = area[3] + gap * 2

    ctx.beginPath()
    ctx.roundRect(x, y, width, height, radius)

    // TODO: Currently works on LTR slots only.  Add support for other directions.
    const start = linkConnector.state.connectingTo === "output" ? 0 : 1
    const inverter = start ? -1 : 1

    // Radial highlight centred on highlight pos
    const hx = highlightPos[0]
    const hy = highlightPos[1]
    const gRadius = width < height
      ? width
      : width * Math.max(height / width, 0.5)

    const gradient = ctx.createRadialGradient(hx, hy, 0, hx, hy, gRadius)
    gradient.addColorStop(1, "#00000000")
    gradient.addColorStop(0, "#ffcc00aa")

    // Linear gradient over half the node.
    const linearGradient = ctx.createLinearGradient(x, y, x + width, y)
    linearGradient.addColorStop(0.5, "#00000000")
    linearGradient.addColorStop(start + 0.67 * inverter, "#ddeeff33")
    linearGradient.addColorStop(start + inverter, "#ffcc0055")

    /**
     * Workaround for a canvas render issue.
     * In Chromium 129 (2024-10-15), rounded corners can be rendered with the wrong part of a gradient colour.
     * Occurs only at certain thicknesses / arc sizes.
     */
    ctx.setLineDash([radius, radius * 0.001])

    ctx.lineWidth = 1
    ctx.strokeStyle = linearGradient
    ctx.stroke()

    if (overWidget) {
      const { computedHeight } = overWidget

      ctx.beginPath()
      const { pos: [nodeX, nodeY] } = node
      const height = LiteGraph.NODE_WIDGET_HEIGHT
      if (
        overWidget.type.startsWith("custom") &&
        computedHeight != null &&
        computedHeight > height * 2
      ) {
        // Most likely DOM widget text box
        ctx.rect(
          nodeX + 9,
          nodeY + overWidget.y + 9,
          (overWidget.width ?? area[2]) - 18,
          computedHeight - 18,
        )
      } else {
        // Regular widget, probably
        ctx.roundRect(
          nodeX + BaseWidget.margin,
          nodeY + overWidget.y,
          overWidget.width ?? area[2],
          height,
          height * 0.5,
        )
      }
      ctx.stroke()
    }

    ctx.strokeStyle = gradient
    ctx.stroke()

    ctx.setLineDash([])
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = strokeStyle
  }

  /**
   * draws some useful stats in the corner of the canvas
   */
  renderInfo(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    x = x || 10
    y = y || this.canvas.offsetHeight - 80

    ctx.save()
    ctx.translate(x, y)

    ctx.font = `10px ${LiteGraph.DEFAULT_FONT}`
    ctx.fillStyle = "#888"
    ctx.textAlign = "left"
    if (this.graph) {
      ctx.fillText(`T: ${this.graph.globaltime.toFixed(2)}s`, 5, 13 * 1)
      ctx.fillText(`I: ${this.graph.iteration}`, 5, 13 * 2)
      ctx.fillText(`N: ${this.graph._nodes.length} [${this.visible_nodes.length}]`, 5, 13 * 3)
      ctx.fillText(`V: ${this.graph._version}`, 5, 13 * 4)
      ctx.fillText(`FPS:${this.fps.toFixed(2)}`, 5, 13 * 5)
    } else {
      ctx.fillText("No graph selected", 5, 13 * 1)
    }
    ctx.restore()
  }

  /**
   * draws the back canvas (the one containing the background and the connections)
   */
  drawBackCanvas(): void {
    const canvas = this.bgcanvas
    if (
      canvas.width != this.canvas.width ||
      canvas.height != this.canvas.height
    ) {
      canvas.width = this.canvas.width
      canvas.height = this.canvas.height
    }

    if (!this.bgctx) {
      this.bgctx = this.bgcanvas.getContext("2d")
    }
    const ctx = this.bgctx
    if (!ctx) throw new TypeError("Background canvas context was null.")

    const viewport = this.viewport || [0, 0, ctx.canvas.width, ctx.canvas.height]

    // clear
    if (this.clear_background) {
      ctx.clearRect(viewport[0], viewport[1], viewport[2], viewport[3])
    }

    const bg_already_painted = this.onRenderBackground
      ? this.onRenderBackground(canvas, ctx)
      : false

    // reset in case of error
    if (!this.viewport) {
      const scale = window.devicePixelRatio
      ctx.restore()
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
    }

    if (this.graph) {
      // apply transformations
      ctx.save()
      this.ds.toCanvasContext(ctx)

      // render BG
      if (
        this.ds.scale < 1.5 &&
        !bg_already_painted &&
        this.clear_background_color
      ) {
        ctx.fillStyle = this.clear_background_color
        ctx.fillRect(
          this.visible_area[0],
          this.visible_area[1],
          this.visible_area[2],
          this.visible_area[3],
        )
      }

      if (this.background_image && this.ds.scale > 0.5 && !bg_already_painted) {
        if (this.zoom_modify_alpha) {
          ctx.globalAlpha = (1.0 - 0.5 / this.ds.scale) * this.editor_alpha
        } else {
          ctx.globalAlpha = this.editor_alpha
        }
        ctx.imageSmoothingEnabled = false
        if (!this._bg_img || this._bg_img.name != this.background_image) {
          this._bg_img = new Image()
          this._bg_img.name = this.background_image
          this._bg_img.src = this.background_image
          const that = this
          this._bg_img.addEventListener("load", function () {
            that.draw(true, true)
          })
        }

        let pattern = this._pattern
        if (pattern == null && this._bg_img.width > 0) {
          pattern = ctx.createPattern(this._bg_img, "repeat") ?? undefined
          this._pattern_img = this._bg_img
          this._pattern = pattern
        }

        // NOTE: This ridiculous kludge provides a significant performance increase when rendering many large (> canvas width) paths in HTML canvas.
        // I could find no documentation or explanation.  Requires that the BG image is set.
        if (pattern) {
          ctx.fillStyle = pattern
          ctx.fillRect(
            this.visible_area[0],
            this.visible_area[1],
            this.visible_area[2],
            this.visible_area[3],
          )
          ctx.fillStyle = "transparent"
        }

        ctx.globalAlpha = 1.0
        ctx.imageSmoothingEnabled = true
      }

      // groups
      if (this.graph._groups.length) {
        this.drawGroups(canvas, ctx)
      }

      this.onDrawBackground?.(ctx, this.visible_area)

      // DEBUG: show clipping area
      // ctx.fillStyle = "red";
      // ctx.fillRect( this.visible_area[0] + 10, this.visible_area[1] + 10, this.visible_area[2] - 20, this.visible_area[3] - 20);
      // bg
      if (this.render_canvas_border) {
        ctx.strokeStyle = "#235"
        ctx.strokeRect(0, 0, canvas.width, canvas.height)
      }

      if (this.render_connections_shadows) {
        ctx.shadowColor = "#000"
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        ctx.shadowBlur = 6
      } else {
        ctx.shadowColor = "rgba(0,0,0,0)"
      }

      // draw connections
      this.drawConnections(ctx)

      ctx.shadowColor = "rgba(0,0,0,0)"

      // restore state
      ctx.restore()
    }

    this.dirty_bgcanvas = false
    // Forces repaint of the front canvas.
    this.dirty_canvas = true
  }

  /**
   * draws the given node inside the canvas
   */
  drawNode(node: LGraphNode, ctx: CanvasRenderingContext2D): void {
    this.current_node = node

    // Skip all node rendering when Vue nodes mode is enabled
    if (LiteGraph.vueNodesMode) {
      return
    }

    const color = node.renderingColor
    const bgcolor = node.renderingBgColor

    const { low_quality, editor_alpha } = this
    ctx.globalAlpha = editor_alpha

    if (this.render_shadows && !low_quality) {
      ctx.shadowColor = LiteGraph.DEFAULT_SHADOW_COLOR
      ctx.shadowOffsetX = 2 * this.ds.scale
      ctx.shadowOffsetY = 2 * this.ds.scale
      ctx.shadowBlur = 3 * this.ds.scale
    } else {
      ctx.shadowColor = "transparent"
    }

    // custom draw collapsed method (draw after shadows because they are affected)
    if (node.flags.collapsed && node.onDrawCollapsed?.(ctx, this) == true)
      return

    // clip if required (mask)
    const shape = node._shape || RenderShape.BOX
    const size = LGraphCanvas.#temp_vec2
    size.set(node.renderingSize)

    if (node.collapsed) {
      ctx.font = this.inner_text_font
    }

    if (node.clip_area) {
      // Start clipping
      ctx.save()
      ctx.beginPath()
      if (shape == RenderShape.BOX) {
        ctx.rect(0, 0, size[0], size[1])
      } else if (shape == RenderShape.ROUND) {
        ctx.roundRect(0, 0, size[0], size[1], [10])
      } else if (shape == RenderShape.CIRCLE) {
        ctx.arc(size[0] * 0.5, size[1] * 0.5, size[0] * 0.5, 0, Math.PI * 2)
      }
      ctx.clip()
    }

    // draw shape
    this.drawNodeShape(
      node,
      ctx,
      size,
      color,
      bgcolor,
      !!node.selected,
    )

    if (!low_quality) {
      node.drawBadges(ctx)
    }

    ctx.shadowColor = "transparent"

    // TODO: Legacy behaviour: onDrawForeground received ctx in this state
    ctx.strokeStyle = LiteGraph.NODE_BOX_OUTLINE_COLOR

    // Draw Foreground
    node.onDrawForeground?.(ctx, this, this.canvas)

    // connection slots
    ctx.font = this.inner_text_font

    // render inputs and outputs
    node._setConcreteSlots()
    if (!node.collapsed) {
      node.arrange()
      node.drawSlots(ctx, {
        fromSlot: this.linkConnector.renderLinks[0]?.fromSlot as INodeOutputSlot | INodeInputSlot,
        colorContext: this.colourGetter,
        editorAlpha: this.editor_alpha,
        lowQuality: this.low_quality,
      })

      ctx.textAlign = "left"
      ctx.globalAlpha = 1

      this.drawNodeWidgets(node, null, ctx)
    } else if (this.render_collapsed_slots) {
      node.drawCollapsedSlots(ctx)
    }

    if (node.clip_area) {
      ctx.restore()
    }

    ctx.globalAlpha = 1.0
  }

  /**
   * Draws the link mouseover effect and tooltip.
   * @param ctx Canvas 2D context to draw on
   * @param link The link to render the mouseover effect for
   * @remarks
   * Called against {@link LGraphCanvas.over_link_center}.
   * @todo Split tooltip from hover, so it can be drawn / eased separately
   */
  drawLinkTooltip(ctx: CanvasRenderingContext2D, link: LinkSegment): void {
    const pos = link._pos
    ctx.fillStyle = "black"
    ctx.beginPath()
    if (this.linkMarkerShape === LinkMarkerShape.Arrow) {
      const transform = ctx.getTransform()
      ctx.translate(pos[0], pos[1])
      // Assertion: Number.isFinite guarantees this is a number.
      if (Number.isFinite(link._centreAngle)) ctx.rotate(link._centreAngle as number)
      ctx.moveTo(-2, -3)
      ctx.lineTo(+4, 0)
      ctx.lineTo(-2, +3)
      ctx.setTransform(transform)
    } else if (
      this.linkMarkerShape == null ||
      this.linkMarkerShape === LinkMarkerShape.Circle
    ) {
      ctx.arc(pos[0], pos[1], 3, 0, Math.PI * 2)
    }
    ctx.fill()

    // @ts-expect-error TODO: Better value typing
    const { data } = link
    if (data == null) return

    // @ts-expect-error TODO: Better value typing
    if (this.onDrawLinkTooltip?.(ctx, link, this) == true) return

    let text: string | null = null

    if (typeof data === "number")
      text = data.toFixed(2)
    else if (typeof data === "string")
      text = `"${data}"`
    else if (typeof data === "boolean")
      text = String(data)
    else if (data.toToolTip)
      text = data.toToolTip()
    else
      text = `[${data.constructor.name}]`

    if (text == null) return

    // Hard-coded tooltip limit
    text = text.substring(0, 30)

    ctx.font = "14px Courier New"
    const info = ctx.measureText(text)
    const w = info.width + 20
    const h = 24
    ctx.shadowColor = "black"
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
    ctx.shadowBlur = 3
    ctx.fillStyle = "#454"
    ctx.beginPath()
    ctx.roundRect(pos[0] - w * 0.5, pos[1] - 15 - h, w, h, [3])
    ctx.moveTo(pos[0] - 10, pos[1] - 15)
    ctx.lineTo(pos[0] + 10, pos[1] - 15)
    ctx.lineTo(pos[0], pos[1] - 5)
    ctx.fill()
    ctx.shadowColor = "transparent"
    ctx.textAlign = "center"
    ctx.fillStyle = "#CEC"
    ctx.fillText(text, pos[0], pos[1] - 15 - h * 0.3)
  }

  /**
   * Draws the shape of the given node on the canvas
   * @param node The node to draw
   * @param ctx 2D canvas rendering context used to draw
   * @param size Size of the background to draw, in graph units.  Differs from node size if collapsed, etc.
   * @param fgcolor Foreground colour - used for text
   * @param bgcolor Background colour of the node
   * @param _selected Whether to render the node as selected.  Likely to be removed in future, as current usage is simply the selected property of the node.
   */
  drawNodeShape(
    node: LGraphNode,
    ctx: CanvasRenderingContext2D,
    size: Size,
    fgcolor: CanvasColour,
    bgcolor: CanvasColour,
    _selected: boolean,
  ): void {
    // Rendering options
    ctx.strokeStyle = fgcolor
    ctx.fillStyle = bgcolor

    const title_height = LiteGraph.NODE_TITLE_HEIGHT
    const { low_quality } = this

    const { collapsed } = node.flags
    const shape = node.renderingShape
    const { title_mode } = node

    const render_title = title_mode == TitleMode.TRANSPARENT_TITLE || title_mode == TitleMode.NO_TITLE
      ? false
      : true

    // Normalised node dimensions
    const area = LGraphCanvas.#tmp_area
    area.set(node.boundingRect)
    area[0] -= node.pos[0]
    area[1] -= node.pos[1]

    const old_alpha = ctx.globalAlpha

    // Draw node background (shape)
    ctx.beginPath()
    if (shape == RenderShape.BOX || low_quality) {
      ctx.rect(area[0], area[1], area[2], area[3])
    } else if (shape == RenderShape.ROUND || shape == RenderShape.CARD) {
      ctx.roundRect(
        area[0],
        area[1],
        area[2],
        area[3],
        shape == RenderShape.CARD
          ? [LiteGraph.ROUND_RADIUS, LiteGraph.ROUND_RADIUS, 0, 0]
          : [LiteGraph.ROUND_RADIUS],
      )
    } else if (shape == RenderShape.CIRCLE) {
      ctx.arc(size[0] * 0.5, size[1] * 0.5, size[0] * 0.5, 0, Math.PI * 2)
    }
    ctx.fill()

    // Separator - title bar <-> body
    if (!collapsed && render_title) {
      ctx.shadowColor = "transparent"
      ctx.fillStyle = "rgba(0,0,0,0.2)"
      ctx.fillRect(0, -1, area[2], 2)
    }
    ctx.shadowColor = "transparent"

    node.onDrawBackground?.(ctx)

    // Title bar background (remember, it is rendered ABOVE the node)
    if (render_title || title_mode == TitleMode.TRANSPARENT_TITLE) {
      node.drawTitleBarBackground(ctx, {
        scale: this.ds.scale,
        low_quality,
      })

      // title box
      node.drawTitleBox(ctx, {
        scale: this.ds.scale,
        low_quality,
        box_size: 10,
      })

      ctx.globalAlpha = old_alpha

      // title text
      node.drawTitleText(ctx, {
        scale: this.ds.scale,
        default_title_color: this.node_title_color,
        low_quality,
      })

      // custom title render
      node.onDrawTitle?.(ctx)
    }

    // Draw stroke styles
    for (const getStyle of Object.values(node.strokeStyles)) {
      const strokeStyle = getStyle.call(node)
      if (strokeStyle) {
        strokeShape(ctx, area, {
          shape,
          title_height,
          title_mode,
          collapsed,
          ...strokeStyle,
        })
      }
    }

    node.drawProgressBar(ctx)

    // these counter helps in conditioning drawing based on if the node has been executed or an action occurred
    if (node.execute_triggered != null && node.execute_triggered > 0) node.execute_triggered--
    if (node.action_triggered != null && node.action_triggered > 0) node.action_triggered--
  }

  /**
   * Draws a snap guide for a {@link Positionable} item.
   *
   * Initial design was a simple white rectangle representing the location the
   * item would land if dropped.
   * @param ctx The 2D canvas context to draw on
   * @param item The item to draw a snap guide for
   * @param shape The shape of the snap guide to draw
   * @todo Update to align snapping with boundingRect
   * @todo Shapes
   */
  drawSnapGuide(
    ctx: CanvasRenderingContext2D,
    item: Positionable,
    shape = RenderShape.ROUND,
  ) {
    const snapGuide = LGraphCanvas.#temp
    snapGuide.set(item.boundingRect)

    // Not all items have pos equal to top-left of bounds
    const { pos } = item
    const offsetX = pos[0] - snapGuide[0]
    const offsetY = pos[1] - snapGuide[1]

    // Normalise boundingRect to pos to snap
    snapGuide[0] += offsetX
    snapGuide[1] += offsetY
    if (this.#snapToGrid) snapPoint(snapGuide, this.#snapToGrid)
    snapGuide[0] -= offsetX
    snapGuide[1] -= offsetY

    const { globalAlpha } = ctx
    ctx.globalAlpha = 1
    ctx.beginPath()
    const [x, y, w, h] = snapGuide
    if (shape === RenderShape.CIRCLE) {
      const midX = x + (w * 0.5)
      const midY = y + (h * 0.5)
      const radius = Math.min(w * 0.5, h * 0.5)
      ctx.arc(midX, midY, radius, 0, Math.PI * 2)
    } else {
      ctx.rect(x, y, w, h)
    }

    ctx.lineWidth = 0.5
    ctx.strokeStyle = "#FFFFFF66"
    ctx.fillStyle = "#FFFFFF22"
    ctx.fill()
    ctx.stroke()
    ctx.globalAlpha = globalAlpha
  }

  drawConnections(ctx: CanvasRenderingContext2D): void {
    this.renderedPaths.clear()
    if (this.links_render_mode === LinkRenderType.HIDDEN_LINK) return

    const { graph, subgraph } = this
    if (!graph) throw new NullGraphError()

    const visibleReroutes: Reroute[] = []

    const now = LiteGraph.getTime()
    const { visible_area } = this
    LGraphCanvas.#margin_area[0] = visible_area[0] - 20
    LGraphCanvas.#margin_area[1] = visible_area[1] - 20
    LGraphCanvas.#margin_area[2] = visible_area[2] + 40
    LGraphCanvas.#margin_area[3] = visible_area[3] + 40

    // draw connections
    ctx.lineWidth = this.connections_width

    ctx.fillStyle = "#AAA"
    ctx.strokeStyle = "#AAA"
    ctx.globalAlpha = this.editor_alpha
    // for every node
    const nodes = graph._nodes
    for (const node of nodes) {
      // for every input (we render just inputs because it is easier as every slot can only have one input)
      const { inputs } = node
      if (!inputs?.length) continue

      for (const [i, input] of inputs.entries()) {
        if (!input || input.link == null) continue

        const link_id = input.link
        const link = graph._links.get(link_id)
        if (!link) continue

        const endPos = node.getInputPos(i)

        // find link info
        const start_node = graph.getNodeById(link.origin_id)
        if (start_node == null) continue

        const outputId = link.origin_slot
        const startPos: Point = outputId === -1
          ? [start_node.pos[0] + 10, start_node.pos[1] + 10]
          : start_node.getOutputPos(outputId)

        const output = start_node.outputs[outputId]
        if (!output) continue

        this.#renderAllLinkSegments(ctx, link, startPos, endPos, visibleReroutes, now, output.dir, input.dir)
      }
    }

    if (subgraph) {
      for (const output of subgraph.inputNode.slots) {
        if (!output.linkIds.length) continue

        // find link info
        for (const linkId of output.linkIds) {
          const resolved = LLink.resolve(linkId, graph)
          if (!resolved) continue

          const { link, inputNode, input } = resolved
          if (!inputNode || !input) continue

          const endPos = inputNode.getInputPos(link.target_slot)

          this.#renderAllLinkSegments(ctx, link, output.pos, endPos, visibleReroutes, now, input.dir, input.dir)
        }
      }

      for (const input of subgraph.outputNode.slots) {
        if (!input.linkIds.length) continue

        // find link info
        const resolved = LLink.resolve(input.linkIds[0], graph)
        if (!resolved) continue

        const { link, outputNode, output } = resolved
        if (!outputNode || !output) continue

        const startPos = outputNode.getOutputPos(link.origin_slot)

        this.#renderAllLinkSegments(ctx, link, startPos, input.pos, visibleReroutes, now, output.dir, input.dir)
      }
    }

    if (graph.floatingLinks.size > 0) {
      this.#renderFloatingLinks(ctx, graph, visibleReroutes, now)
    }

    const rerouteSet = this.#visibleReroutes
    rerouteSet.clear()

    // Render reroutes, ordered by number of non-floating links
    visibleReroutes.sort((a, b) => a.linkIds.size - b.linkIds.size)
    for (const reroute of visibleReroutes) {
      rerouteSet.add(reroute)

      if (
        this.#snapToGrid &&
        this.isDragging &&
        this.selectedItems.has(reroute)
      ) {
        this.drawSnapGuide(ctx, reroute, RenderShape.CIRCLE)
      }
      reroute.draw(ctx, this._pattern)

      // Never draw slots when the pointer is down
      if (!this.pointer.isDown) reroute.drawSlots(ctx)
    }
    ctx.globalAlpha = 1
  }

  #renderFloatingLinks(ctx: CanvasRenderingContext2D, graph: LGraph, visibleReroutes: Reroute[], now: number) {
    // Render floating links with 3/4 current alpha
    const { globalAlpha } = ctx
    ctx.globalAlpha = globalAlpha * 0.33

    // Floating reroutes
    for (const link of graph.floatingLinks.values()) {
      const reroutes = LLink.getReroutes(graph, link)
      const firstReroute = reroutes[0]
      const reroute = reroutes.at(-1)
      if (!firstReroute || !reroute?.floating) continue

      // Input not connected
      if (reroute.floating.slotType === "input") {
        const node = graph.getNodeById(link.target_id)
        if (!node) continue

        const startPos = firstReroute.pos
        const endPos = node.getInputPos(link.target_slot)
        const endDirection = node.inputs[link.target_slot]?.dir

        firstReroute._dragging = true
        this.#renderAllLinkSegments(ctx, link, startPos, endPos, visibleReroutes, now, LinkDirection.CENTER, endDirection, true)
      } else {
        const node = graph.getNodeById(link.origin_id)
        if (!node) continue

        const startPos = node.getOutputPos(link.origin_slot)
        const endPos = reroute.pos
        const startDirection = node.outputs[link.origin_slot]?.dir

        link._dragging = true
        this.#renderAllLinkSegments(ctx, link, startPos, endPos, visibleReroutes, now, startDirection, LinkDirection.CENTER, true)
      }
    }
    ctx.globalAlpha = globalAlpha
  }

  #renderAllLinkSegments(
    ctx: CanvasRenderingContext2D,
    link: LLink,
    startPos: Point,
    endPos: Point,
    visibleReroutes: Reroute[],
    now: number,
    startDirection?: LinkDirection,
    endDirection?: LinkDirection,
    disabled: boolean = false,
  ) {
    const { graph, renderedPaths } = this
    if (!graph) return

    // Get all points this link passes through
    const reroutes = LLink.getReroutes(graph, link)
    const points: [Point, ...Point[], Point] = [
      startPos,
      ...reroutes.map(x => x.pos),
      endPos,
    ]

    // Bounding box of all points (bezier overshoot on long links will be cut)
    const pointsX = points.map(x => x[0])
    const pointsY = points.map(x => x[1])
    LGraphCanvas.#link_bounding[0] = Math.min(...pointsX)
    LGraphCanvas.#link_bounding[1] = Math.min(...pointsY)
    LGraphCanvas.#link_bounding[2] = Math.max(...pointsX) - LGraphCanvas.#link_bounding[0]
    LGraphCanvas.#link_bounding[3] = Math.max(...pointsY) - LGraphCanvas.#link_bounding[1]

    // skip links outside of the visible area of the canvas
    if (!overlapBounding(LGraphCanvas.#link_bounding, LGraphCanvas.#margin_area))
      return

    const start_dir = startDirection || LinkDirection.RIGHT
    const end_dir = endDirection || LinkDirection.LEFT

    // Has reroutes
    if (reroutes.length) {
      let startControl: Point | undefined

      const l = reroutes.length
      for (let j = 0; j < l; j++) {
        const reroute = reroutes[j]

        // Only render once
        if (!renderedPaths.has(reroute)) {
          renderedPaths.add(reroute)
          visibleReroutes.push(reroute)
          reroute._colour = link.color ||
            LGraphCanvas.link_type_colors[link.type] ||
            this.default_link_color

          const prevReroute = graph.getReroute(reroute.parentId)
          const rerouteStartPos = prevReroute?.pos ?? startPos
          reroute.calculateAngle(this.last_draw_time, graph, rerouteStartPos)

          // Skip the first segment if it is being dragged
          if (!reroute._dragging) {
            this.renderLink(
              ctx,
              rerouteStartPos,
              reroute.pos,
              link,
              false,
              0,
              null,
              startControl === undefined ? start_dir : LinkDirection.CENTER,
              LinkDirection.CENTER,
              {
                startControl,
                endControl: reroute.controlPoint,
                reroute,
                disabled,
              },
            )
          }
        }

        if (!startControl && reroutes.at(-1)?.floating?.slotType === "input") {
          // Floating link connected to an input
          startControl = [0, 0]
        } else {
          // Calculate start control for the next iter control point
          const nextPos = reroutes[j + 1]?.pos ?? endPos
          const dist = Math.min(Reroute.maxSplineOffset, distance(reroute.pos, nextPos) * 0.25)
          startControl = [dist * reroute.cos, dist * reroute.sin]
        }
      }

      // Skip the last segment if it is being dragged
      if (link._dragging) return

      // Use runtime fallback; TypeScript cannot evaluate this correctly.
      const segmentStartPos = points.at(-2) ?? startPos

      // Render final link segment
      this.renderLink(
        ctx,
        segmentStartPos,
        endPos,
        link,
        false,
        0,
        null,
        LinkDirection.CENTER,
        end_dir,
        { startControl, disabled },
      )
      // Skip normal render when link is being dragged
    } else if (!link._dragging) {
      this.renderLink(
        ctx,
        startPos,
        endPos,
        link,
        false,
        0,
        null,
        start_dir,
        end_dir,
      )
    }
    renderedPaths.add(link)

    // event triggered rendered on top
    if (link?._last_time && now - link._last_time < 1000) {
      const f = 2.0 - (now - link._last_time) * 0.002
      const tmp = ctx.globalAlpha
      ctx.globalAlpha = tmp * f
      this.renderLink(
        ctx,
        startPos,
        endPos,
        link,
        true,
        f,
        "white",
        start_dir,
        end_dir,
      )
      ctx.globalAlpha = tmp
    }
  }

  /**
   * draws a link between two points
   * @param ctx Canvas 2D rendering context
   * @param a start pos
   * @param b end pos
   * @param link the link object with all the link info
   * @param skip_border ignore the shadow of the link
   * @param flow show flow animation (for events)
   * @param color the color for the link
   * @param start_dir the direction enum
   * @param end_dir the direction enum
   */
  renderLink(
    ctx: CanvasRenderingContext2D,
    a: ReadOnlyPoint,
    b: ReadOnlyPoint,
    link: LLink | null,
    skip_border: boolean,
    flow: number | null,
    color: CanvasColour | null,
    start_dir: LinkDirection,
    end_dir: LinkDirection,
    {
      startControl,
      endControl,
      reroute,
      num_sublines = 1,
      disabled = false,
    }: {
      /** When defined, render data will be saved to this reroute instead of the {@link link}. */
      reroute?: Reroute
      /** Offset of the bezier curve control point from {@link a point a} (output side) */
      startControl?: ReadOnlyPoint
      /** Offset of the bezier curve control point from {@link b point b} (input side) */
      endControl?: ReadOnlyPoint
      /** Number of sublines (useful to represent vec3 or rgb) @todo If implemented, refactor calculations out of the loop */
      num_sublines?: number
      /** Whether this is a floating link segment */
      disabled?: boolean
    } = {},
  ): void {
    const linkColour =
      link != null && this.highlighted_links[link.id]
        ? "#FFF"
        : color ||
          link?.color ||
          (link?.type != null && LGraphCanvas.link_type_colors[link.type]) ||
          this.default_link_color
    const startDir = start_dir || LinkDirection.RIGHT
    const endDir = end_dir || LinkDirection.LEFT

    const dist = this.links_render_mode == LinkRenderType.SPLINE_LINK && (!endControl || !startControl)
      ? distance(a, b)
      : 0

    // TODO: Subline code below was inserted in the wrong place - should be before this statement
    if (this.render_connections_border && !this.low_quality) {
      ctx.lineWidth = this.connections_width + 4
    }
    ctx.lineJoin = "round"
    num_sublines ||= 1
    if (num_sublines > 1) ctx.lineWidth = 0.5

    // begin line shape
    const path = new Path2D()

    /** The link or reroute we're currently rendering */
    const linkSegment = reroute ?? link
    if (linkSegment) linkSegment.path = path

    const innerA = LGraphCanvas.#lTempA
    const innerB = LGraphCanvas.#lTempB

    /** Reference to {@link reroute._pos} if present, or {@link link._pos} if present.  Caches the centre point of the link. */
    const pos: Point = linkSegment?._pos ?? [0, 0]

    for (let i = 0; i < num_sublines; i++) {
      const offsety = (i - (num_sublines - 1) * 0.5) * 5
      innerA[0] = a[0]
      innerA[1] = a[1]
      innerB[0] = b[0]
      innerB[1] = b[1]

      if (this.links_render_mode == LinkRenderType.SPLINE_LINK) {
        if (endControl) {
          innerB[0] = b[0] + endControl[0]
          innerB[1] = b[1] + endControl[1]
        } else {
          this.#addSplineOffset(innerB, endDir, dist)
        }
        if (startControl) {
          innerA[0] = a[0] + startControl[0]
          innerA[1] = a[1] + startControl[1]
        } else {
          this.#addSplineOffset(innerA, startDir, dist)
        }
        path.moveTo(a[0], a[1] + offsety)
        path.bezierCurveTo(
          innerA[0],
          innerA[1] + offsety,
          innerB[0],
          innerB[1] + offsety,
          b[0],
          b[1] + offsety,
        )

        // Calculate centre point
        findPointOnCurve(pos, a, b, innerA, innerB, 0.5)

        if (linkSegment && this.linkMarkerShape === LinkMarkerShape.Arrow) {
          const justPastCentre = LGraphCanvas.#lTempC
          findPointOnCurve(justPastCentre, a, b, innerA, innerB, 0.51)

          linkSegment._centreAngle = Math.atan2(
            justPastCentre[1] - pos[1],
            justPastCentre[0] - pos[0],
          )
        }
      } else {
        const l = this.links_render_mode == LinkRenderType.LINEAR_LINK ? 15 : 10
        switch (startDir) {
        case LinkDirection.LEFT:
          innerA[0] += -l
          break
        case LinkDirection.RIGHT:
          innerA[0] += l
          break
        case LinkDirection.UP:
          innerA[1] += -l
          break
        case LinkDirection.DOWN:
          innerA[1] += l
          break
        }
        switch (endDir) {
        case LinkDirection.LEFT:
          innerB[0] += -l
          break
        case LinkDirection.RIGHT:
          innerB[0] += l
          break
        case LinkDirection.UP:
          innerB[1] += -l
          break
        case LinkDirection.DOWN:
          innerB[1] += l
          break
        }
        if (this.links_render_mode == LinkRenderType.LINEAR_LINK) {
          path.moveTo(a[0], a[1] + offsety)
          path.lineTo(innerA[0], innerA[1] + offsety)
          path.lineTo(innerB[0], innerB[1] + offsety)
          path.lineTo(b[0], b[1] + offsety)

          // Calculate centre point
          pos[0] = (innerA[0] + innerB[0]) * 0.5
          pos[1] = (innerA[1] + innerB[1]) * 0.5

          if (linkSegment && this.linkMarkerShape === LinkMarkerShape.Arrow) {
            linkSegment._centreAngle = Math.atan2(
              innerB[1] - innerA[1],
              innerB[0] - innerA[0],
            )
          }
        } else if (this.links_render_mode == LinkRenderType.STRAIGHT_LINK) {
          const midX = (innerA[0] + innerB[0]) * 0.5

          path.moveTo(a[0], a[1])
          path.lineTo(innerA[0], innerA[1])
          path.lineTo(midX, innerA[1])
          path.lineTo(midX, innerB[1])
          path.lineTo(innerB[0], innerB[1])
          path.lineTo(b[0], b[1])

          // Calculate centre point
          pos[0] = midX
          pos[1] = (innerA[1] + innerB[1]) * 0.5

          if (linkSegment && this.linkMarkerShape === LinkMarkerShape.Arrow) {
            const diff = innerB[1] - innerA[1]
            if (Math.abs(diff) < 4) linkSegment._centreAngle = 0
            else if (diff > 0) linkSegment._centreAngle = Math.PI * 0.5
            else linkSegment._centreAngle = -(Math.PI * 0.5)
          }
        } else {
          return
        }
      }
    }

    // rendering the outline of the connection can be a little bit slow
    if (this.render_connections_border && !this.low_quality && !skip_border) {
      ctx.strokeStyle = "rgba(0,0,0,0.5)"
      ctx.stroke(path)
    }

    ctx.lineWidth = this.connections_width
    ctx.fillStyle = ctx.strokeStyle = linkColour
    ctx.stroke(path)

    // render arrow in the middle
    if (
      this.ds.scale >= 0.6 &&
      this.highquality_render &&
      linkSegment
    ) {
      // render arrow
      if (this.render_connection_arrows) {
        // compute two points in the connection
        const posA = this.computeConnectionPoint(a, b, 0.25, startDir, endDir)
        const posB = this.computeConnectionPoint(a, b, 0.26, startDir, endDir)
        const posC = this.computeConnectionPoint(a, b, 0.75, startDir, endDir)
        const posD = this.computeConnectionPoint(a, b, 0.76, startDir, endDir)

        // compute the angle between them so the arrow points in the right direction
        let angleA = 0
        let angleB = 0
        if (this.render_curved_connections) {
          angleA = -Math.atan2(posB[0] - posA[0], posB[1] - posA[1])
          angleB = -Math.atan2(posD[0] - posC[0], posD[1] - posC[1])
        } else {
          angleB = angleA = b[1] > a[1] ? 0 : Math.PI
        }

        // render arrow
        const transform = ctx.getTransform()
        ctx.translate(posA[0], posA[1])
        ctx.rotate(angleA)
        ctx.beginPath()
        ctx.moveTo(-5, -3)
        ctx.lineTo(0, +7)
        ctx.lineTo(+5, -3)
        ctx.fill()
        ctx.setTransform(transform)

        ctx.translate(posC[0], posC[1])
        ctx.rotate(angleB)
        ctx.beginPath()
        ctx.moveTo(-5, -3)
        ctx.lineTo(0, +7)
        ctx.lineTo(+5, -3)
        ctx.fill()
        ctx.setTransform(transform)
      }

      // Draw link centre marker
      ctx.beginPath()
      if (this.linkMarkerShape === LinkMarkerShape.Arrow) {
        const transform = ctx.getTransform()
        ctx.translate(pos[0], pos[1])
        if (linkSegment._centreAngle) ctx.rotate(linkSegment._centreAngle)
        // The math is off, but it currently looks better in chromium
        ctx.moveTo(-3.2, -5)
        ctx.lineTo(+7, 0)
        ctx.lineTo(-3.2, +5)
        ctx.setTransform(transform)
      } else if (
        this.linkMarkerShape == null ||
        this.linkMarkerShape === LinkMarkerShape.Circle
      ) {
        ctx.arc(pos[0], pos[1], 5, 0, Math.PI * 2)
      }
      if (disabled) {
        const { fillStyle, globalAlpha } = ctx
        ctx.fillStyle = this._pattern ?? "#797979"
        ctx.globalAlpha = 0.75
        ctx.fill()
        ctx.globalAlpha = globalAlpha
        ctx.fillStyle = fillStyle
      }
      ctx.fill()

      if (LLink._drawDebug) {
        const { fillStyle, font, globalAlpha, lineWidth, strokeStyle } = ctx
        ctx.globalAlpha = 1
        ctx.lineWidth = 4
        ctx.fillStyle = "white"
        ctx.strokeStyle = "black"
        ctx.font = "16px Arial"

        const text = String(linkSegment.id)
        const { width, actualBoundingBoxAscent } = ctx.measureText(text)
        const x = pos[0] - width * 0.5
        const y = pos[1] + actualBoundingBoxAscent * 0.5
        ctx.strokeText(text, x, y)
        ctx.fillText(text, x, y)

        ctx.font = font
        ctx.globalAlpha = globalAlpha
        ctx.lineWidth = lineWidth
        ctx.fillStyle = fillStyle
        ctx.strokeStyle = strokeStyle
      }
    }

    // render flowing points
    if (flow) {
      ctx.fillStyle = linkColour
      for (let i = 0; i < 5; ++i) {
        const f = (LiteGraph.getTime() * 0.001 + i * 0.2) % 1
        const flowPos = this.computeConnectionPoint(a, b, f, startDir, endDir)
        ctx.beginPath()
        ctx.arc(flowPos[0], flowPos[1], 5, 0, 2 * Math.PI)
        ctx.fill()
      }
    }
  }

  /**
   * Finds a point along a spline represented by a to b, with spline endpoint directions dictacted by start_dir and end_dir.
   * @param a Start point
   * @param b End point
   * @param t Time: distance between points (e.g 0.25 is 25% along the line)
   * @param start_dir Spline start direction
   * @param end_dir Spline end direction
   * @returns The point at {@link t} distance along the spline a-b.
   */
  computeConnectionPoint(
    a: ReadOnlyPoint,
    b: ReadOnlyPoint,
    t: number,
    start_dir: LinkDirection,
    end_dir: LinkDirection,
  ): Point {
    start_dir ||= LinkDirection.RIGHT
    end_dir ||= LinkDirection.LEFT

    const dist = distance(a, b)
    const pa: Point = [a[0], a[1]]
    const pb: Point = [b[0], b[1]]

    this.#addSplineOffset(pa, start_dir, dist)
    this.#addSplineOffset(pb, end_dir, dist)

    const c1 = (1 - t) * (1 - t) * (1 - t)
    const c2 = 3 * ((1 - t) * (1 - t)) * t
    const c3 = 3 * (1 - t) * (t * t)
    const c4 = t * t * t

    const x = c1 * a[0] + c2 * pa[0] + c3 * pb[0] + c4 * b[0]
    const y = c1 * a[1] + c2 * pa[1] + c3 * pb[1] + c4 * b[1]
    return [x, y]
  }

  /**
   * Modifies an existing point, adding a single-axis offset.
   * @param point The point to add the offset to
   * @param direction The direction to add the offset in
   * @param dist Distance to offset
   * @param factor Distance is mulitplied by this value.  Default: 0.25
   */
  #addSplineOffset(
    point: Point,
    direction: LinkDirection,
    dist: number,
    factor = 0.25,
  ): void {
    switch (direction) {
    case LinkDirection.LEFT:
      point[0] += dist * -factor
      break
    case LinkDirection.RIGHT:
      point[0] += dist * factor
      break
    case LinkDirection.UP:
      point[1] += dist * -factor
      break
    case LinkDirection.DOWN:
      point[1] += dist * factor
      break
    }
  }

  drawExecutionOrder(ctx: CanvasRenderingContext2D): void {
    ctx.shadowColor = "transparent"
    ctx.globalAlpha = 0.25

    ctx.textAlign = "center"
    ctx.strokeStyle = "white"
    ctx.globalAlpha = 0.75

    const { visible_nodes } = this
    for (const node of visible_nodes) {
      ctx.fillStyle = "black"
      ctx.fillRect(
        node.pos[0] - LiteGraph.NODE_TITLE_HEIGHT,
        node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT,
        LiteGraph.NODE_TITLE_HEIGHT,
        LiteGraph.NODE_TITLE_HEIGHT,
      )
      if (node.order == 0) {
        ctx.strokeRect(
          node.pos[0] - LiteGraph.NODE_TITLE_HEIGHT + 0.5,
          node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT + 0.5,
          LiteGraph.NODE_TITLE_HEIGHT,
          LiteGraph.NODE_TITLE_HEIGHT,
        )
      }
      ctx.fillStyle = "#FFF"
      ctx.fillText(
        stringOrEmpty(node.order),
        node.pos[0] + LiteGraph.NODE_TITLE_HEIGHT * -0.5,
        node.pos[1] - 6,
      )
    }
    ctx.globalAlpha = 1
  }

  /**
   * draws the widgets stored inside a node
   * @deprecated Use {@link LGraphNode.drawWidgets} instead.
   * @remarks Currently there are extensions hijacking this function, so we cannot remove it.
   */
  drawNodeWidgets(
    node: LGraphNode,
    _posY: null,
    ctx: CanvasRenderingContext2D,
  ): void {
    node.drawWidgets(ctx, {
      lowQuality: this.low_quality,
      editorAlpha: this.editor_alpha,
    })
  }

  /**
   * draws every group area in the background
   */
  drawGroups(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    if (!this.graph) return

    const groups = this.graph._groups

    ctx.save()
    ctx.globalAlpha = 0.5 * this.editor_alpha
    const drawSnapGuides = this.#snapToGrid && this.isDragging

    for (const group of groups) {
      // out of the visible area
      if (!overlapBounding(this.visible_area, group._bounding)) {
        continue
      }

      // Draw snap shadow
      if (drawSnapGuides && this.selectedItems.has(group))
        this.drawSnapGuide(ctx, group)

      group.draw(this, ctx)
    }

    ctx.restore()
  }

  /**
   * resizes the canvas to a given size, if no size is passed, then it tries to fill the parentNode
   * @todo Remove or rewrite
   */
  resize(width?: number, height?: number): void {
    if (!width && !height) {
      const parent = this.canvas.parentElement
      if (!parent) throw new TypeError("Attempted to resize canvas, but parent element was null.")
      width = parent.offsetWidth
      height = parent.offsetHeight
    }

    if (this.canvas.width == width && this.canvas.height == height) return

    this.canvas.width = width ?? 0
    this.canvas.height = height ?? 0
    this.bgcanvas.width = this.canvas.width
    this.bgcanvas.height = this.canvas.height
    this.setDirty(true, true)
  }

  onNodeSelectionChange(): void {}

  /**
   * Determines the furthest nodes in each direction for the currently selected nodes
   */
  boundaryNodesForSelection(): NullableProperties<IBoundaryNodes> {
    return LGraphCanvas.getBoundaryNodes(this.selected_nodes)
  }

  showLinkMenu(segment: LinkSegment, e: CanvasMouseEvent): boolean {
    const { graph } = this
    if (!graph) throw new NullGraphError()

    const title = "data" in segment && segment.data != null
      ? segment.data.constructor.name
      : undefined

    const { origin_id, origin_slot } = segment
    if (origin_id == null || origin_slot == null) {
      new LiteGraph.ContextMenu<string>(["Link has no origin"], {
        event: e,
        title,
      })
      return false
    }

    const node_left = graph.getNodeById(origin_id)
    const fromType = node_left?.outputs?.[origin_slot]?.type

    const options = ["Add Node", "Add Reroute", null, "Delete", null]

    const menu = new LiteGraph.ContextMenu<string>(options, {
      event: e,
      title,
      callback: inner_clicked.bind(this),
    })

    return false

    function inner_clicked(this: LGraphCanvas, v: string, options: unknown, e: MouseEvent) {
      if (!graph) throw new NullGraphError()

      switch (v) {
      case "Add Node":
        LGraphCanvas.onMenuAdd(null, null, e, menu, (node) => {
          if (!node?.inputs?.length || !node?.outputs?.length || origin_slot == null) return

          // leave the connection type checking inside connectByType
          const options = { afterRerouteId: segment.parentId }
          if (node_left?.connectByType(origin_slot, node, fromType ?? "*", options)) {
            node.pos[0] -= node.size[0] * 0.5
          }
        })
        break

      case "Add Reroute": {
        try {
          this.emitBeforeChange()
          this.adjustMouseEvent(e)
          graph.createReroute(segment._pos, segment)
          this.setDirty(false, true)
        } catch (error) {
          console.error(error)
        } finally {
          this.emitAfterChange()
        }
        break
      }

      case "Delete":
        graph.removeLink(segment.id)
        break
      default:
      }
    }
  }

  createDefaultNodeForSlot(optPass: ICreateDefaultNodeOptions): boolean {
    type DefaultOptions = ICreateDefaultNodeOptions & {
      posAdd: Point
      posSizeFix: Point
    }

    const opts = Object.assign<DefaultOptions, ICreateDefaultNodeOptions>({
      nodeFrom: null,
      slotFrom: null,
      nodeTo: null,
      slotTo: null,
      position: [0, 0],
      nodeType: undefined,
      posAdd: [0, 0],
      posSizeFix: [0, 0],
    }, optPass)
    const { afterRerouteId } = opts

    const isFrom = opts.nodeFrom && opts.slotFrom !== null
    const isTo = !isFrom && opts.nodeTo && opts.slotTo !== null

    if (!isFrom && !isTo) {
      console.warn(`No data passed to createDefaultNodeForSlot`, opts.nodeFrom, opts.slotFrom, opts.nodeTo, opts.slotTo)
      return false
    }
    if (!opts.nodeType) {
      console.warn("No type to createDefaultNodeForSlot")
      return false
    }

    const nodeX = isFrom ? opts.nodeFrom : opts.nodeTo
    if (!nodeX) throw new TypeError("nodeX was null when creating default node for slot.")

    let slotX = isFrom ? opts.slotFrom : opts.slotTo

    let iSlotConn: number | false = false
    if (nodeX instanceof SubgraphIONodeBase) {
      if (typeof slotX !== "object" || !slotX) {
        console.warn("Cant get slot information", slotX)
        return false
      }
      const { name } = slotX
      iSlotConn = nodeX.slots.findIndex(s => s.name === name)
      slotX = nodeX.slots[iSlotConn]
      if (!slotX) {
        console.warn("Cant get slot information", slotX)
        return false
      }
    } else {
      switch (typeof slotX) {
      case "string":
        iSlotConn = isFrom ? nodeX.findOutputSlot(slotX, false) : nodeX.findInputSlot(slotX, false)
        slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX]
        break
      case "object":
        if (slotX === null) {
          console.warn("Cant get slot information", slotX)
          return false
        }

        // ok slotX
        iSlotConn = isFrom ? nodeX.findOutputSlot(slotX.name) : nodeX.findInputSlot(slotX.name)
        break
      case "number":
        iSlotConn = slotX
        slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX]
        break
      case "undefined":
      default:
        console.warn("Cant get slot information", slotX)
        return false
      }
    }

    // check for defaults nodes for this slottype
    const fromSlotType = slotX.type == LiteGraph.EVENT ? "_event_" : slotX.type
    const slotTypesDefault = isFrom
      ? LiteGraph.slot_types_default_out
      : LiteGraph.slot_types_default_in
    if (slotTypesDefault?.[fromSlotType]) {
      // TODO: Remove "any" kludge
      let nodeNewType: any = false
      if (typeof slotTypesDefault[fromSlotType] == "object") {
        for (const typeX in slotTypesDefault[fromSlotType]) {
          if (
            opts.nodeType == slotTypesDefault[fromSlotType][typeX] ||
            opts.nodeType == "AUTO"
          ) {
            nodeNewType = slotTypesDefault[fromSlotType][typeX]
            break
          }
        }
      } else if (
        opts.nodeType == slotTypesDefault[fromSlotType] ||
        opts.nodeType == "AUTO"
      ) {
        nodeNewType = slotTypesDefault[fromSlotType]
      }
      if (nodeNewType) {
        // TODO: Remove "any" kludge
        let nodeNewOpts: any = false
        if (typeof nodeNewType == "object" && nodeNewType.node) {
          nodeNewOpts = nodeNewType
          nodeNewType = nodeNewType.node
        }

        // that.graph.beforeChange();
        const newNode = LiteGraph.createNode(nodeNewType)
        if (newNode) {
          // if is object pass options
          if (nodeNewOpts) {
            if (nodeNewOpts.properties) {
              for (const i in nodeNewOpts.properties) {
                newNode.addProperty(i, nodeNewOpts.properties[i])
              }
            }
            if (nodeNewOpts.inputs) {
              newNode.inputs = []
              for (const i in nodeNewOpts.inputs) {
                newNode.addOutput(
                  nodeNewOpts.inputs[i][0],
                  nodeNewOpts.inputs[i][1],
                )
              }
            }
            if (nodeNewOpts.outputs) {
              newNode.outputs = []
              for (const i in nodeNewOpts.outputs) {
                newNode.addOutput(
                  nodeNewOpts.outputs[i][0],
                  nodeNewOpts.outputs[i][1],
                )
              }
            }
            if (nodeNewOpts.title) {
              newNode.title = nodeNewOpts.title
            }
            if (nodeNewOpts.json) {
              newNode.configure(nodeNewOpts.json)
            }
          }

          // add the node
          if (!this.graph) throw new NullGraphError()

          this.graph.add(newNode)
          newNode.pos = [
            opts.position[0] + opts.posAdd[0] + (opts.posSizeFix[0] ? opts.posSizeFix[0] * newNode.size[0] : 0),
            opts.position[1] + opts.posAdd[1] + (opts.posSizeFix[1] ? opts.posSizeFix[1] * newNode.size[1] : 0),
          ]

          // Interim API - allow the link connection to be canceled.
          // TODO: https://github.com/Comfy-Org/litegraph.js/issues/946
          const detail = { node: newNode, opts }
          const mayConnectLinks = this.canvas.dispatchEvent(new CustomEvent("connect-new-default-node", { detail, cancelable: true }))
          if (!mayConnectLinks) return true

          // connect the two!
          if (isFrom) {
            if (!opts.nodeFrom) throw new TypeError("createDefaultNodeForSlot - nodeFrom was null")
            opts.nodeFrom.connectByType(iSlotConn, newNode, fromSlotType, { afterRerouteId })
          } else {
            if (!opts.nodeTo) throw new TypeError("createDefaultNodeForSlot - nodeTo was null")
            opts.nodeTo.connectByTypeOutput(iSlotConn, newNode, fromSlotType, { afterRerouteId })
          }

          // if connecting in between
          if (isFrom && isTo) {
            // TODO
          }

          return true
        }
        console.log(`failed creating ${nodeNewType}`)
      }
    }
    return false
  }

  showConnectionMenu(optPass: Partial<ICreateNodeOptions & { e: MouseEvent }>): ContextMenu<string> | undefined {
    const opts = Object.assign<ICreateNodeOptions & HasShowSearchCallback, ICreateNodeOptions>({
      nodeFrom: null,
      slotFrom: null,
      nodeTo: null,
      slotTo: null,
      e: undefined,
      allow_searchbox: this.allow_searchbox,
      showSearchBox: this.showSearchBox,
    }, optPass || {})
    const dirty = () => this.#dirty()
    const that = this
    const { graph } = this
    const { afterRerouteId } = opts

    const isFrom = opts.nodeFrom && opts.slotFrom
    const isTo = !isFrom && opts.nodeTo && opts.slotTo

    if (!isFrom && !isTo) {
      console.warn("No data passed to showConnectionMenu")
      return
    }

    const nodeX = isFrom ? opts.nodeFrom : opts.nodeTo
    if (!nodeX) throw new TypeError("nodeX was null when creating default node for slot.")
    let slotX = isFrom ? opts.slotFrom : opts.slotTo

    let iSlotConn: number
    if (nodeX instanceof SubgraphIONodeBase) {
      if (typeof slotX !== "object" || !slotX) {
        console.warn("Cant get slot information", slotX)
        return
      }
      const { name } = slotX
      iSlotConn = nodeX.slots.findIndex(s => s.name === name)
      slotX = nodeX.slots[iSlotConn]
      if (!slotX) {
        console.warn("Cant get slot information", slotX)
        return
      }
    } else {
      switch (typeof slotX) {
      case "string":
        iSlotConn = isFrom
          ? nodeX.findOutputSlot(slotX, false)
          : nodeX.findInputSlot(slotX, false)
        slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX]
        break
      case "object":
        if (slotX === null) {
          console.warn("Cant get slot information", slotX)
          return
        }

        // ok slotX
        iSlotConn = isFrom
          ? nodeX.findOutputSlot(slotX.name)
          : nodeX.findInputSlot(slotX.name)
        break
      case "number":
        iSlotConn = slotX
        slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX]
        break
      default:
        console.warn("Cant get slot information", slotX)
        return
      }
    }

    const options = ["Add Node", "Add Reroute", null]

    if (opts.allow_searchbox) {
      options.push("Search", null)
    }

    // get defaults nodes for this slottype
    const fromSlotType = slotX.type == LiteGraph.EVENT ? "_event_" : slotX.type
    const slotTypesDefault = isFrom
      ? LiteGraph.slot_types_default_out
      : LiteGraph.slot_types_default_in
    if (slotTypesDefault?.[fromSlotType]) {
      if (typeof slotTypesDefault[fromSlotType] == "object") {
        for (const typeX in slotTypesDefault[fromSlotType]) {
          options.push(slotTypesDefault[fromSlotType][typeX])
        }
      } else {
        options.push(slotTypesDefault[fromSlotType])
      }
    }

    // build menu
    const menu = new LiteGraph.ContextMenu<string>(options, {
      event: opts.e,
      extra: slotX,
      title:
        (slotX && slotX.name != ""
          ? slotX.name + (fromSlotType ? " | " : "")
          : "") + (slotX && fromSlotType ? fromSlotType : ""),
      callback: inner_clicked,
    })

    return menu

    // callback
    function inner_clicked(v: string | undefined, options: IContextMenuOptions<string, INodeInputSlot | INodeOutputSlot>, e: MouseEvent) {
      switch (v) {
      case "Add Node":
        LGraphCanvas.onMenuAdd(null, null, e, menu, function (node) {
          if (!node) return

          if (isFrom) {
            if (!opts.nodeFrom) throw new TypeError("Cannot add node to SubgraphInputNode: nodeFrom was null")
            const slot = opts.nodeFrom.connectByType(iSlotConn, node, fromSlotType, { afterRerouteId })
            if (!slot) console.warn("Failed to make new connection.")
            // }
          } else {
            if (!opts.nodeTo) throw new TypeError("Cannot add node to SubgraphInputNode: nodeTo was null")
            opts.nodeTo.connectByTypeOutput(iSlotConn, node, fromSlotType, { afterRerouteId })
          }
        })
        break
      case "Add Reroute":{
        const node = isFrom ? opts.nodeFrom : opts.nodeTo
        const slot = options.extra

        if (!graph) throw new NullGraphError()
        if (!node) throw new TypeError("Cannot add reroute: node was null")
        if (!slot) throw new TypeError("Cannot add reroute: slot was null")
        if (!opts.e) throw new TypeError("Cannot add reroute: CanvasPointerEvent was null")

        if (node instanceof SubgraphIONodeBase) {
          throw new TypeError("Cannot add floating reroute to Subgraph IO Nodes")
        } else {
          const reroute = node.connectFloatingReroute([opts.e.canvasX, opts.e.canvasY], slot, afterRerouteId)
          if (!reroute) throw new Error("Failed to create reroute")
        }

        dirty()
        break
      }
      case "Search":
        if (isFrom) {
          // @ts-expect-error Subgraph
          opts.showSearchBox(e, { node_from: opts.nodeFrom, slot_from: slotX, type_filter_in: fromSlotType })
        } else {
          // @ts-expect-error Subgraph
          opts.showSearchBox(e, { node_to: opts.nodeTo, slot_from: slotX, type_filter_out: fromSlotType })
        }
        break
      default: {
        const customProps = {
          position: [opts.e?.canvasX ?? 0, opts.e?.canvasY ?? 0],
          nodeType: v,
          afterRerouteId,
        } satisfies Partial<ICreateDefaultNodeOptions>

        const options = Object.assign(opts, customProps)
        if (!that.createDefaultNodeForSlot(options))
          break
      }
      }
    }
  }

  // refactor: there are different dialogs, some uses createDialog some dont
  prompt(
    title: string,
    value: any,
    callback: (arg0: any) => void,
    event: CanvasMouseEvent,
    multiline?: boolean,
  ): HTMLDivElement {
    const that = this
    title = title || ""

    const customProperties = {
      is_modified: false,
      className: "graphdialog rounded",
      innerHTML: multiline
        ? "<span class='name'></span> <textarea autofocus class='value'></textarea><button class='rounded'>OK</button>"
        : "<span class='name'></span> <input autofocus type='text' class='value'/><button class='rounded'>OK</button>",
      close() {
        that.prompt_box = null
        if (dialog.parentNode) {
          dialog.remove()
        }
      },
    } satisfies Partial<IDialog>

    const div = document.createElement("div")
    const dialog: PromptDialog = Object.assign(div, customProperties)

    const graphcanvas = LGraphCanvas.active_canvas
    const { canvas } = graphcanvas
    if (!canvas.parentNode) throw new TypeError("canvas element parentNode was null when opening a prompt.")
    canvas.parentNode.append(dialog)

    if (this.ds.scale > 1) dialog.style.transform = `scale(${this.ds.scale})`

    let dialogCloseTimer: number
    let prevent_timeout = 0
    LiteGraph.pointerListenerAdd(dialog, "leave", function () {
      if (prevent_timeout) return
      if (LiteGraph.dialog_close_on_mouse_leave) {
        if (!dialog.is_modified && LiteGraph.dialog_close_on_mouse_leave) {
          dialogCloseTimer = setTimeout(
            dialog.close,
            LiteGraph.dialog_close_on_mouse_leave_delay,
          )
        }
      }
    })
    LiteGraph.pointerListenerAdd(dialog, "enter", function () {
      if (LiteGraph.dialog_close_on_mouse_leave && dialogCloseTimer)
        clearTimeout(dialogCloseTimer)
    })
    const selInDia = dialog.querySelectorAll("select")
    if (selInDia) {
      // if filtering, check focus changed to comboboxes and prevent closing
      for (const selIn of selInDia) {
        selIn.addEventListener("click", function () {
          prevent_timeout++
        })
        selIn.addEventListener("blur", function () {
          prevent_timeout = 0
        })
        selIn.addEventListener("change", function () {
          prevent_timeout = -1
        })
      }
    }
    this.prompt_box?.close()
    this.prompt_box = dialog

    const name_element: HTMLSpanElement | null = dialog.querySelector(".name")
    if (!name_element) throw new TypeError("name_element was null")

    name_element.textContent = title
    const value_element: HTMLInputElement | null = dialog.querySelector(".value")
    if (!value_element) throw new TypeError("value_element was null")

    value_element.value = value
    value_element.select()

    const input = value_element
    input.addEventListener("keydown", function (e: KeyboardEvent) {
      dialog.is_modified = true
      if (e.key == "Escape") {
        // ESC
        dialog.close()
      } else if (
        e.key == "Enter" &&
        (e.target as Element).localName != "textarea"
      ) {
        if (callback) {
          callback(this.value)
        }
        dialog.close()
      } else {
        return
      }
      e.preventDefault()
      e.stopPropagation()
    })

    const button = dialog.querySelector("button")
    if (!button) throw new TypeError("button was null when opening prompt")

    button.addEventListener("click", function () {
      callback?.(input.value)
      that.setDirty(true)
      dialog.close()
    })

    const rect = canvas.getBoundingClientRect()
    let offsetx = -20
    let offsety = -20
    if (rect) {
      offsetx -= rect.left
      offsety -= rect.top
    }

    if (event) {
      dialog.style.left = `${event.clientX + offsetx}px`
      dialog.style.top = `${event.clientY + offsety}px`
    } else {
      dialog.style.left = `${canvas.width * 0.5 + offsetx}px`
      dialog.style.top = `${canvas.height * 0.5 + offsety}px`
    }

    setTimeout(function () {
      input.focus()
      const clickTime = Date.now()
      function handleOutsideClick(e: Event) {
        if (e.target === canvas && Date.now() - clickTime > 256) {
          dialog.close()
          canvas.parentElement?.removeEventListener("click", handleOutsideClick)
          canvas.parentElement?.removeEventListener("touchend", handleOutsideClick)
        }
      }
      canvas.parentElement?.addEventListener("click", handleOutsideClick)
      canvas.parentElement?.addEventListener("touchend", handleOutsideClick)
    }, 10)

    return dialog
  }

  showSearchBox(
    event: MouseEvent,
    searchOptions?: IShowSearchOptions,
  ): HTMLDivElement {
    // proposed defaults
    const options: IShowSearchOptions = {
      slot_from: null,
      node_from: null,
      node_to: null,
      // TODO check for registered_slot_[in/out]_types not empty
      // this will be checked for functionality enabled : filter on slot type, in and out
      do_type_filter: LiteGraph.search_filter_enabled,

      // these are default: pass to set initially set values
      // @ts-expect-error
      type_filter_in: false,

      type_filter_out: false,
      show_general_if_none_on_typefilter: true,
      show_general_after_typefiltered: true,
      hide_on_mouse_leave: LiteGraph.search_hide_on_mouse_leave,
      show_all_if_empty: true,
      show_all_on_open: LiteGraph.search_show_all_on_open,
    }
    Object.assign(options, searchOptions)

    // console.log(options);
    const that = this
    const graphcanvas = LGraphCanvas.active_canvas
    const { canvas } = graphcanvas
    const root_document = canvas.ownerDocument || document

    const div = document.createElement("div")
    const dialog = Object.assign(div, {
      close(this: typeof div) {
        that.search_box = undefined
        this.blur()
        canvas.focus()
        root_document.body.style.overflow = ""

        // important, if canvas loses focus keys wont be captured
        setTimeout(() => canvas.focus(), 20)
        dialog.remove()
      },
    } satisfies Partial<HTMLDivElement> & ICloseable)
    dialog.className = "litegraph litesearchbox graphdialog rounded"
    dialog.innerHTML = "<span class='name'>Search</span> <input autofocus type='text' class='value rounded'/>"
    if (options.do_type_filter) {
      dialog.innerHTML += "<select class='slot_in_type_filter'><option value=''></option></select>"
      dialog.innerHTML += "<select class='slot_out_type_filter'><option value=''></option></select>"
    }
    const helper = document.createElement("div")
    helper.className = "helper"
    dialog.append(helper)

    if (root_document.fullscreenElement) {
      root_document.fullscreenElement.append(dialog)
    } else {
      root_document.body.append(dialog)
      root_document.body.style.overflow = "hidden"
    }

    // dialog element has been appended
    let selIn
    let selOut
    if (options.do_type_filter) {
      selIn = dialog.querySelector(".slot_in_type_filter")
      selOut = dialog.querySelector(".slot_out_type_filter")
    }

    if (this.ds.scale > 1) {
      dialog.style.transform = `scale(${this.ds.scale})`
    }

    // hide on mouse leave
    if (options.hide_on_mouse_leave) {
      // FIXME: Remove "any" kludge
      let prevent_timeout: any = false
      let timeout_close: number | null = null
      LiteGraph.pointerListenerAdd(dialog, "enter", function () {
        if (timeout_close) {
          clearTimeout(timeout_close)
          timeout_close = null
        }
      })
      dialog.addEventListener("pointerleave", function () {
        if (prevent_timeout) return

        const hideDelay = options.hide_on_mouse_leave
        const delay = typeof hideDelay === "number" ? hideDelay : 500
        timeout_close = setTimeout(dialog.close, delay)
      })
      // if filtering, check focus changed to comboboxes and prevent closing
      if (options.do_type_filter) {
        if (!selIn) throw new TypeError("selIn was null when showing search box")
        if (!selOut) throw new TypeError("selOut was null when showing search box")

        selIn.addEventListener("click", function () {
          prevent_timeout++
        })
        selIn.addEventListener("blur", function () {
          prevent_timeout = 0
        })
        selIn.addEventListener("change", function () {
          prevent_timeout = -1
        })
        selOut.addEventListener("click", function () {
          prevent_timeout++
        })
        selOut.addEventListener("blur", function () {
          prevent_timeout = 0
        })
        selOut.addEventListener("change", function () {
          prevent_timeout = -1
        })
      }
    }

    // @ts-expect-error Panel?
    that.search_box?.close()
    that.search_box = dialog

    let first: string | null = null
    let timeout: number | null = null
    let selected: ChildNode | null = null

    const maybeInput = dialog.querySelector("input")
    if (!maybeInput) throw new TypeError("Could not create search input box.")

    const input = maybeInput

    if (input) {
      input.addEventListener("blur", function () {
        this.focus()
      })
      input.addEventListener("keydown", function (e) {
        if (e.key == "ArrowUp") {
          // UP
          changeSelection(false)
        } else if (e.key == "ArrowDown") {
          // DOWN
          changeSelection(true)
        } else if (e.key == "Escape") {
          // ESC
          dialog.close()
        } else if (e.key == "Enter") {
          if (selected instanceof HTMLElement) {
            select(unescape(String(selected.dataset["type"])))
          } else if (first) {
            select(first)
          } else {
            dialog.close()
          }
        } else {
          if (timeout) {
            clearInterval(timeout)
          }
          timeout = setTimeout(refreshHelper, 10)
          return
        }
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return true
      })
    }

    // if should filter on type, load and fill selected and choose elements if passed
    if (options.do_type_filter) {
      if (selIn) {
        const aSlots = LiteGraph.slot_types_in
        const nSlots = aSlots.length

        if (
          options.type_filter_in == LiteGraph.EVENT ||
          options.type_filter_in == LiteGraph.ACTION
        ) {
          options.type_filter_in = "_event_"
        }
        for (let iK = 0; iK < nSlots; iK++) {
          const opt = document.createElement("option")
          opt.value = aSlots[iK]
          opt.innerHTML = aSlots[iK]
          selIn.append(opt)
          if (
            // @ts-expect-error
            options.type_filter_in !== false &&
            String(options.type_filter_in).toLowerCase() ==
            String(aSlots[iK]).toLowerCase()
          ) {
            opt.selected = true
          }
        }
        selIn.addEventListener("change", function () {
          refreshHelper()
        })
      }
      if (selOut) {
        const aSlots = LiteGraph.slot_types_out

        if (
          options.type_filter_out == LiteGraph.EVENT ||
          options.type_filter_out == LiteGraph.ACTION
        ) {
          options.type_filter_out = "_event_"
        }
        for (const aSlot of aSlots) {
          const opt = document.createElement("option")
          opt.value = aSlot
          opt.innerHTML = aSlot
          selOut.append(opt)
          if (
            options.type_filter_out !== false &&
            String(options.type_filter_out).toLowerCase() ==
            String(aSlot).toLowerCase()
          ) {
            opt.selected = true
          }
        }
        selOut.addEventListener("change", function () {
          refreshHelper()
        })
      }
    }

    // compute best position
    const rect = canvas.getBoundingClientRect()

    const left = (event ? event.clientX : rect.left + rect.width * 0.5) - 80
    const top = (event ? event.clientY : rect.top + rect.height * 0.5) - 20
    dialog.style.left = `${left}px`
    dialog.style.top = `${top}px`

    // To avoid out of screen problems
    if (event.layerY > rect.height - 200) {
      helper.style.maxHeight = `${rect.height - event.layerY - 20}px`
    }
    requestAnimationFrame(function () {
      input.focus()
    })
    if (options.show_all_on_open) refreshHelper()

    function select(name: string) {
      if (name) {
        if (that.onSearchBoxSelection) {
          that.onSearchBoxSelection(name, event, graphcanvas)
        } else {
          if (!graphcanvas.graph) throw new NullGraphError()

          graphcanvas.graph.beforeChange()
          const node = LiteGraph.createNode(name)
          if (node) {
            node.pos = graphcanvas.convertEventToCanvasOffset(event)
            graphcanvas.graph.add(node, false)
          }

          // join node after inserting
          if (options.node_from) {
            // FIXME: any
            let iS: any = false
            switch (typeof options.slot_from) {
            case "string":
              iS = options.node_from.findOutputSlot(options.slot_from)
              break
            case "object":
              if (options.slot_from == null) throw new TypeError("options.slot_from was null when showing search box")

              iS = options.slot_from.name
                ? options.node_from.findOutputSlot(options.slot_from.name)
                : -1
              // @ts-expect-error change interface check
              if (iS == -1 && options.slot_from.slot_index !== undefined) iS = options.slot_from.slot_index
              break
            case "number":
              iS = options.slot_from
              break
            default:
              // try with first if no name set
              iS = 0
            }
            if (options.node_from.outputs[iS] !== undefined) {
              if (iS !== false && iS > -1) {
                if (node == null) throw new TypeError("options.slot_from was null when showing search box")

                options.node_from.connectByType(iS, node, options.node_from.outputs[iS].type)
              }
            } else {
              // console.warn("cant find slot " + options.slot_from);
            }
          }
          if (options.node_to) {
            // FIXME: any
            let iS: any = false
            switch (typeof options.slot_from) {
            case "string":
              iS = options.node_to.findInputSlot(options.slot_from)
              break
            case "object":
              if (options.slot_from == null) throw new TypeError("options.slot_from was null when showing search box")

              iS = options.slot_from.name
                ? options.node_to.findInputSlot(options.slot_from.name)
                : -1
              // @ts-expect-error change interface check
              if (iS == -1 && options.slot_from.slot_index !== undefined) iS = options.slot_from.slot_index
              break
            case "number":
              iS = options.slot_from
              break
            default:
              // try with first if no name set
              iS = 0
            }
            if (options.node_to.inputs[iS] !== undefined) {
              if (iS !== false && iS > -1) {
                if (node == null) throw new TypeError("options.slot_from was null when showing search box")
                // try connection
                options.node_to.connectByTypeOutput(iS, node, options.node_to.inputs[iS].type)
              }
            } else {
              // console.warn("cant find slot_nodeTO " + options.slot_from);
            }
          }

          graphcanvas.graph.afterChange()
        }
      }

      dialog.close()
    }

    function changeSelection(forward: boolean) {
      const prev = selected
      if (!selected) {
        selected = forward
          ? helper.childNodes[0]
          : helper.childNodes[helper.childNodes.length]
      } else if (selected instanceof Element) {
        selected.classList.remove("selected")
        selected = forward
          ? selected.nextSibling
          : selected.previousSibling
        selected ||= prev
      }

      if (selected instanceof Element) {
        selected.classList.add("selected")
        selected.scrollIntoView({ block: "end", behavior: "smooth" })
      }
    }

    function refreshHelper() {
      timeout = null
      let str = input.value
      first = null
      helper.innerHTML = ""
      if (!str && !options.show_all_if_empty) return

      if (that.onSearchBox) {
        const list = that.onSearchBox(helper, str, graphcanvas)
        if (list) {
          for (const item of list) {
            addResult(item)
          }
        }
      } else {
        let c = 0
        str = str.toLowerCase()
        if (!graphcanvas.graph) throw new NullGraphError()

        const filter = graphcanvas.filter || graphcanvas.graph.filter

        // FIXME: any
        // filter by type preprocess
        let sIn: any = false
        let sOut: any = false
        if (options.do_type_filter && that.search_box) {
          sIn = that.search_box.querySelector(".slot_in_type_filter")
          sOut = that.search_box.querySelector(".slot_out_type_filter")
        }

        const keys = Object.keys(LiteGraph.registered_node_types)
        const filtered = keys.filter(x => inner_test_filter(x))

        for (const item of filtered) {
          addResult(item)
          if (LGraphCanvas.search_limit !== -1 && c++ > LGraphCanvas.search_limit)
            break
        }

        // add general type if filtering
        if (
          options.show_general_after_typefiltered &&
          (sIn.value || sOut.value)
        ) {
          // FIXME: Undeclared variable again
          // @ts-expect-error
          filtered_extra = []
          for (const i in LiteGraph.registered_node_types) {
            if (
              inner_test_filter(i, {
                inTypeOverride: sIn && sIn.value ? "*" : false,
                outTypeOverride: sOut && sOut.value ? "*" : false,
              })
            ) {
              // @ts-expect-error
              filtered_extra.push(i)
            }
          }
          // @ts-expect-error
          for (const extraItem of filtered_extra) {
            addResult(extraItem, "generic_type")
            if (LGraphCanvas.search_limit !== -1 && c++ > LGraphCanvas.search_limit)
              break
          }
        }

        // check il filtering gave no results
        if (
          (sIn.value || sOut.value) &&
          helper.childNodes.length == 0 &&
          options.show_general_if_none_on_typefilter
        ) {
          // @ts-expect-error
          filtered_extra = []
          for (const i in LiteGraph.registered_node_types) {
            if (inner_test_filter(i, { skipFilter: true }))
              // @ts-expect-error
              filtered_extra.push(i)
          }
          // @ts-expect-error
          for (const extraItem of filtered_extra) {
            addResult(extraItem, "not_in_filter")
            if (LGraphCanvas.search_limit !== -1 && c++ > LGraphCanvas.search_limit)
              break
          }
        }

        function inner_test_filter(
          type: string,
          optsIn?: {
            inTypeOverride?: string | boolean
            outTypeOverride?: string | boolean
            skipFilter?: boolean
          },
        ): boolean {
          optsIn = optsIn || {}
          const optsDef = {
            skipFilter: false,
            inTypeOverride: false,
            outTypeOverride: false,
          }
          const opts = Object.assign(optsDef, optsIn)
          const ctor = LiteGraph.registered_node_types[type]
          if (filter && ctor.filter != filter) return false
          if (
            (!options.show_all_if_empty || str) &&
            !type.toLowerCase().includes(str) &&
            (!ctor.title || !ctor.title.toLowerCase().includes(str))
          ) {
            return false
          }

          // filter by slot IN, OUT types
          if (options.do_type_filter && !opts.skipFilter) {
            const sType = type

            let sV = opts.inTypeOverride !== false
              ? opts.inTypeOverride
              : sIn.value
            // type is stored
            if (sIn && sV && LiteGraph.registered_slot_in_types[sV]?.nodes) {
              const doesInc = LiteGraph.registered_slot_in_types[sV].nodes.includes(sType)
              if (doesInc === false) return false
            }

            sV = sOut.value
            if (opts.outTypeOverride !== false) sV = opts.outTypeOverride
            // type is stored
            if (sOut && sV && LiteGraph.registered_slot_out_types[sV]?.nodes) {
              const doesInc = LiteGraph.registered_slot_out_types[sV].nodes.includes(sType)
              if (doesInc === false) return false
            }
          }
          return true
        }
      }

      function addResult(type: string, className?: string): void {
        const help = document.createElement("div")
        first ||= type

        const nodeType = LiteGraph.registered_node_types[type]
        if (nodeType?.title) {
          help.textContent = nodeType?.title
          const typeEl = document.createElement("span")
          typeEl.className = "litegraph lite-search-item-type"
          typeEl.textContent = type
          help.append(typeEl)
        } else {
          help.textContent = type
        }

        help.dataset["type"] = escape(type)
        help.className = "litegraph lite-search-item"
        if (className) {
          help.className += ` ${className}`
        }
        help.addEventListener("click", function () {
          select(unescape(String(this.dataset["type"])))
        })
        helper.append(help)
      }
    }

    return dialog
  }

  showEditPropertyValue(
    node: LGraphNode,
    property: string,
    options: IDialogOptions,
  ): IDialog | undefined {
    if (!node || node.properties[property] === undefined) return

    options = options || {}

    const info = node.getPropertyInfo(property)
    const { type } = info

    let input_html = ""

    if (
      type == "string" ||
      type == "number" ||
      type == "array" ||
      type == "object"
    ) {
      input_html = "<input autofocus type='text' class='value'/>"
    } else if ((type == "enum" || type == "combo") && info.values) {
      input_html = "<select autofocus type='text' class='value'>"
      for (const i in info.values) {
        const v = Array.isArray(info.values) ? info.values[i] : i

        const selected = v == node.properties[property] ? "selected" : ""
        input_html += `<option value='${v}' ${selected}>${info.values[i]}</option>`
      }
      input_html += "</select>"
    } else if (type == "boolean" || type == "toggle") {
      const checked = node.properties[property] ? "checked" : ""
      input_html = `<input autofocus type='checkbox' class='value' ${checked}/>`
    } else {
      console.warn(`unknown type: ${type}`)
      return
    }

    const dialog = this.createDialog(
      `<span class='name'>${info.label || property}</span>${input_html}<button>OK</button>`,
      options,
    )

    let input: HTMLInputElement | HTMLSelectElement | null
    if ((type == "enum" || type == "combo") && info.values) {
      input = dialog.querySelector("select")
      input?.addEventListener("change", function (e) {
        dialog.modified()
        setValue((e.target as HTMLSelectElement)?.value)
      })
    } else if (type == "boolean" || type == "toggle") {
      input = dialog.querySelector("input")
      input?.addEventListener("click", function () {
        dialog.modified()
        // @ts-expect-error
        setValue(!!input.checked)
      })
    } else {
      input = dialog.querySelector("input")
      if (input) {
        input.addEventListener("blur", function () {
          this.focus()
        })

        let v = node.properties[property] !== undefined
          ? node.properties[property]
          : ""
        if (type !== "string") {
          v = JSON.stringify(v)
        }

        // @ts-expect-error
        input.value = v
        input.addEventListener("keydown", function (e) {
          if (e.key == "Escape") {
            // ESC
            dialog.close()
          } else if (e.key == "Enter") {
            // ENTER
            // save
            inner()
          } else {
            dialog.modified()
            return
          }
          e.preventDefault()
          e.stopPropagation()
        })
      }
    }
    input?.focus()

    const button = dialog.querySelector("button")
    if (!button) throw new TypeError("Show edit property value button was null.")
    button.addEventListener("click", inner)

    function inner() {
      setValue(input?.value)
    }
    const dirty = () => this.#dirty()

    function setValue(value: string | number | undefined) {
      if (
        info?.values &&
        typeof info.values === "object" &&
        info.values[value] != undefined
      ) {
        value = info.values[value]
      }

      if (typeof node.properties[property] == "number") {
        value = Number(value)
      }
      if (type == "array" || type == "object") {
        // @ts-expect-error JSON.parse doesn't care.
        value = JSON.parse(value)
      }
      node.properties[property] = value
      if (node.graph) {
        node.graph._version++
      }
      node.onPropertyChanged?.(property, value)
      options.onclose?.()
      dialog.close()
      dirty()
    }

    return dialog
  }

  // TODO refactor, theer are different dialog, some uses createDialog, some dont
  createDialog(html: string, options: IDialogOptions): IDialog {
    const def_options = {
      checkForInput: false,
      closeOnLeave: true,
      closeOnLeave_checkModified: true,
    }
    options = Object.assign(def_options, options || {})

    const customProperties = {
      className: "graphdialog",
      innerHTML: html,
      is_modified: false,
      modified() {
        this.is_modified = true
      },
      close(this: IDialog) {
        this.remove()
      },
    } satisfies Partial<IDialog>

    const div = document.createElement("div")
    const dialog: IDialog = Object.assign(div, customProperties)

    const rect = this.canvas.getBoundingClientRect()
    let offsetx = -20
    let offsety = -20
    if (rect) {
      offsetx -= rect.left
      offsety -= rect.top
    }

    if (options.position) {
      offsetx += options.position[0]
      offsety += options.position[1]
    } else if (options.event) {
      offsetx += options.event.clientX
      offsety += options.event.clientY
    } else {
      // centered
      offsetx += this.canvas.width * 0.5
      offsety += this.canvas.height * 0.5
    }

    dialog.style.left = `${offsetx}px`
    dialog.style.top = `${offsety}px`

    if (!this.canvas.parentNode) throw new TypeError("Canvas parent element was null.")
    this.canvas.parentNode.append(dialog)

    // acheck for input and use default behaviour: save on enter, close on esc
    if (options.checkForInput) {
      const aI = dialog.querySelectorAll("input")
      if (aI) {
        for (const iX of aI) {
          iX.addEventListener("keydown", function (e) {
            dialog.modified()
            if (e.key == "Escape") {
              dialog.close()
            } else if (e.key != "Enter") {
              return
            }
            e.preventDefault()
            e.stopPropagation()
          })
          iX.focus()
        }
      }
    }

    let dialogCloseTimer: number
    let prevent_timeout = 0
    dialog.addEventListener("mouseleave", function () {
      if (prevent_timeout) return

      if (!dialog.is_modified && LiteGraph.dialog_close_on_mouse_leave) {
        dialogCloseTimer = setTimeout(
          dialog.close,
          LiteGraph.dialog_close_on_mouse_leave_delay,
        )
      }
    })
    dialog.addEventListener("mouseenter", function () {
      if (options.closeOnLeave || LiteGraph.dialog_close_on_mouse_leave) {
        if (dialogCloseTimer) clearTimeout(dialogCloseTimer)
      }
    })
    const selInDia = dialog.querySelectorAll("select")
    // if filtering, check focus changed to comboboxes and prevent closing
    if (selInDia) {
      for (const selIn of selInDia) {
        selIn.addEventListener("click", function () {
          prevent_timeout++
        })
        selIn.addEventListener("blur", function () {
          prevent_timeout = 0
        })
        selIn.addEventListener("change", function () {
          prevent_timeout = -1
        })
      }
    }

    return dialog
  }

  createPanel(title: string, options: ICreatePanelOptions) {
    options = options || {}

    const ref_window = options.window || window
    // TODO: any kludge
    const root: any = document.createElement("div")
    root.className = "litegraph dialog"
    root.innerHTML = "<div class='dialog-header'><span class='dialog-title'></span></div><div class='dialog-content'></div><div style='display:none;' class='dialog-alt-content'></div><div class='dialog-footer'></div>"
    root.header = root.querySelector(".dialog-header")

    if (options.width)
      root.style.width = options.width + (typeof options.width === "number" ? "px" : "")
    if (options.height)
      root.style.height = options.height + (typeof options.height === "number" ? "px" : "")
    if (options.closable) {
      const close = document.createElement("span")
      close.innerHTML = "&#10005;"
      close.classList.add("close")
      close.addEventListener("click", function () {
        root.close()
      })
      root.header.append(close)
    }
    root.title_element = root.querySelector(".dialog-title")
    root.title_element.textContent = title
    root.content = root.querySelector(".dialog-content")
    root.alt_content = root.querySelector(".dialog-alt-content")
    root.footer = root.querySelector(".dialog-footer")

    root.close = function () {
      if (typeof root.onClose == "function") root.onClose()
      root.remove()
      this.remove()
    }

    // function to swap panel content
    root.toggleAltContent = function (force: unknown) {
      let vTo: string
      let vAlt: string
      if (force !== undefined) {
        vTo = force ? "block" : "none"
        vAlt = force ? "none" : "block"
      } else {
        vTo = root.alt_content.style.display != "block" ? "block" : "none"
        vAlt = root.alt_content.style.display != "block" ? "none" : "block"
      }
      root.alt_content.style.display = vTo
      root.content.style.display = vAlt
    }

    root.toggleFooterVisibility = function (force: unknown) {
      let vTo: string
      if (force !== undefined) {
        vTo = force ? "block" : "none"
      } else {
        vTo = root.footer.style.display != "block" ? "block" : "none"
      }
      root.footer.style.display = vTo
    }

    root.clear = function () {
      this.content.innerHTML = ""
    }

    root.addHTML = function (code: string, classname: string, on_footer: any) {
      const elem = document.createElement("div")
      if (classname) elem.className = classname
      elem.innerHTML = code
      if (on_footer) root.footer.append(elem)
      else root.content.append(elem)
      return elem
    }

    root.addButton = function (name: any, callback: any, options: any) {
      // TODO: any kludge
      const elem: any = document.createElement("button")
      elem.textContent = name
      elem.options = options
      elem.classList.add("btn")
      elem.addEventListener("click", callback)
      root.footer.append(elem)
      return elem
    }

    root.addSeparator = function () {
      const elem = document.createElement("div")
      elem.className = "separator"
      root.content.append(elem)
    }

    root.addWidget = function (type: string, name: any, value: unknown, options: { label?: any, type?: any, values?: any, callback?: any }, callback: (arg0: any, arg1: any, arg2: any) => void) {
      options = options || {}
      let str_value = String(value)
      type = type.toLowerCase()
      if (type == "number" && typeof value === "number") str_value = value.toFixed(3)

      // FIXME: any kludge
      const elem: HTMLDivElement & { options?: unknown, value?: unknown } = document.createElement("div")
      elem.className = "property"
      elem.innerHTML = "<span class='property_name'></span><span class='property_value'></span>"
      const nameSpan = elem.querySelector(".property_name")
      if (!nameSpan) throw new TypeError("Property name element was null.")

      nameSpan.textContent = options.label || name
      // TODO: any kludge
      const value_element: HTMLSpanElement | null = elem.querySelector(".property_value")
      if (!value_element) throw new TypeError("Property name element was null.")
      value_element.textContent = str_value
      elem.dataset["property"] = name
      elem.dataset["type"] = options.type || type
      elem.options = options
      elem.value = value

      if (type == "code") {
        elem.addEventListener("click", function () {
          root.inner_showCodePad(this.dataset["property"])
        })
      } else if (type == "boolean") {
        elem.classList.add("boolean")
        if (value) elem.classList.add("bool-on")
        elem.addEventListener("click", () => {
          const propname = elem.dataset["property"]
          elem.value = !elem.value
          elem.classList.toggle("bool-on")
          if (!value_element) throw new TypeError("Property name element was null.")

          value_element.textContent = elem.value
            ? "true"
            : "false"
          innerChange(propname, elem.value)
        })
      } else if (type == "string" || type == "number") {
        if (!value_element) throw new TypeError("Property name element was null.")
        value_element.setAttribute("contenteditable", "true")
        value_element.addEventListener("keydown", function (e) {
          // allow for multiline
          if (e.code == "Enter" && (type != "string" || !e.shiftKey)) {
            e.preventDefault()
            this.blur()
          }
        })
        value_element.addEventListener("blur", function () {
          let v: string | number | null = this.textContent
          const propname = this.parentElement?.dataset["property"]
          const proptype = this.parentElement?.dataset["type"]
          if (proptype == "number") v = Number(v)
          innerChange(propname, v)
        })
      } else if (type == "enum" || type == "combo") {
        const str_value = LGraphCanvas.getPropertyPrintableValue(value, options.values)
        if (!value_element) throw new TypeError("Property name element was null.")
        value_element.textContent = str_value ?? ""

        value_element.addEventListener("click", function (event) {
          const values = options.values || []
          const propname = this.parentElement?.dataset["property"]
          const inner_clicked = (v: string | null) => {
            // node.setProperty(propname,v);
            // graphcanvas.dirty_canvas = true;
            this.textContent = v
            innerChange(propname, v)
            return false
          }
          new LiteGraph.ContextMenu(
            values,
            {
              event,
              className: "dark",
              callback: inner_clicked,
            },
            // @ts-expect-error
            ref_window,
          )
        })
      }

      root.content.append(elem)

      function innerChange(name: string | undefined, value: unknown) {
        options.callback?.(name, value, options)
        callback?.(name, value, options)
      }

      return elem
    }

    if (typeof root.onOpen == "function") root.onOpen()

    return root
  }

  closePanels(): void {
    type MightHaveClose = HTMLDivElement & Partial<ICloseable>
    document.querySelector<MightHaveClose>("#node-panel")?.close?.()
    document.querySelector<MightHaveClose>("#option-panel")?.close?.()
  }

  showShowNodePanel(node: LGraphNode): void {
    this.SELECTED_NODE = node
    this.closePanels()
    const ref_window = this.getCanvasWindow()
    const panel = this.createPanel(node.title || "", {
      closable: true,
      window: ref_window,
      onOpen: () => {
        this.NODEPANEL_IS_OPEN = true
      },
      onClose: () => {
        this.NODEPANEL_IS_OPEN = false
        this.node_panel = null
      },
    })
    this.node_panel = panel
    panel.id = "node-panel"
    panel.node = node
    panel.classList.add("settings")

    const inner_refresh = () => {
      // clear
      panel.content.innerHTML = ""
      // @ts-expect-error ctor props
      panel.addHTML(`<span class='node_type'>${node.type}</span><span class='node_desc'>${node.constructor.desc || ""}</span><span class='separator'></span>`)

      panel.addHTML("<h3>Properties</h3>")

      const fUpdate = (name: string, value: string | number | boolean | object | undefined) => {
        if (!this.graph) throw new NullGraphError()
        this.graph.beforeChange(node)
        switch (name) {
        case "Title":
          if (typeof value !== "string") throw new TypeError("Attempting to set title to non-string value.")

          node.title = value
          break
        case "Mode": {
          if (typeof value !== "string") throw new TypeError("Attempting to set mode to non-string value.")

          const kV = Object.values(LiteGraph.NODE_MODES).indexOf(value)
          if (kV !== -1 && LiteGraph.NODE_MODES[kV]) {
            node.changeMode(kV)
          } else {
            console.warn(`unexpected mode: ${value}`)
          }
          break
        }
        case "Color":
          if (typeof value !== "string") throw new TypeError("Attempting to set colour to non-string value.")

          if (LGraphCanvas.node_colors[value]) {
            node.color = LGraphCanvas.node_colors[value].color
            node.bgcolor = LGraphCanvas.node_colors[value].bgcolor
          } else {
            console.warn(`unexpected color: ${value}`)
          }
          break
        default:
          node.setProperty(name, value)
          break
        }
        this.graph.afterChange()
        this.dirty_canvas = true
      }

      panel.addWidget("string", "Title", node.title, {}, fUpdate)

      const mode = node.mode == null ? undefined : LiteGraph.NODE_MODES[node.mode]
      panel.addWidget("combo", "Mode", mode, { values: LiteGraph.NODE_MODES }, fUpdate)

      const nodeCol = node.color !== undefined
        ? Object.keys(LGraphCanvas.node_colors).filter(function (nK) { return LGraphCanvas.node_colors[nK].color == node.color })
        : ""

      panel.addWidget("combo", "Color", nodeCol, { values: Object.keys(LGraphCanvas.node_colors) }, fUpdate)

      for (const pName in node.properties) {
        const value = node.properties[pName]
        const info = node.getPropertyInfo(pName)

        // in case the user wants control over the side panel widget
        if (node.onAddPropertyToPanel?.(pName, panel)) continue

        panel.addWidget(info.widget || info.type, pName, value, info, fUpdate)
      }

      panel.addSeparator()

      node.onShowCustomPanelInfo?.(panel)

      // clear
      panel.footer.innerHTML = ""
      panel.addButton("Delete", function () {
        if (node.block_delete) return
        if (!node.graph) throw new NullGraphError()

        node.graph.remove(node)
        panel.close()
      }).classList.add("delete")
    }

    panel.inner_showCodePad = function (propname: string) {
      panel.classList.remove("settings")
      panel.classList.add("centered")

      panel.alt_content.innerHTML = "<textarea class='code'></textarea>"
      const textarea: HTMLTextAreaElement = panel.alt_content.querySelector("textarea")
      const fDoneWith = function () {
        panel.toggleAltContent(false)
        panel.toggleFooterVisibility(true)
        textarea.remove()
        panel.classList.add("settings")
        panel.classList.remove("centered")
        inner_refresh()
      }
      textarea.value = String(node.properties[propname])
      textarea.addEventListener("keydown", function (e: KeyboardEvent) {
        if (e.code == "Enter" && e.ctrlKey) {
          node.setProperty(propname, textarea.value)
          fDoneWith()
        }
      })
      panel.toggleAltContent(true)
      panel.toggleFooterVisibility(false)
      textarea.style.height = "calc(100% - 40px)"

      const assign = panel.addButton("Assign", function () {
        node.setProperty(propname, textarea.value)
        fDoneWith()
      })
      panel.alt_content.append(assign)
      const button = panel.addButton("Close", fDoneWith)
      button.style.float = "right"
      panel.alt_content.append(button)
    }

    inner_refresh()

    if (!this.canvas.parentNode) throw new TypeError("showNodePanel - this.canvas.parentNode was null")
    this.canvas.parentNode.append(panel)
  }

  checkPanels(): void {
    if (!this.canvas) return

    if (!this.canvas.parentNode) throw new TypeError("checkPanels - this.canvas.parentNode was null")
    const panels = this.canvas.parentNode.querySelectorAll(".litegraph.dialog")
    for (const panel of panels) {
      // @ts-expect-error Panel
      if (!panel.node) continue
      // @ts-expect-error Panel
      if (!panel.node.graph || panel.graph != this.graph) panel.close()
    }
  }

  getCanvasMenuOptions(): IContextMenuValue<string>[] {
    let options: IContextMenuValue<string>[]
    if (this.getMenuOptions) {
      options = this.getMenuOptions()
    } else {
      options = [
        {
          content: "Add Node",
          has_submenu: true,
          callback: LGraphCanvas.onMenuAdd,
        },
        { content: "Add Group", callback: LGraphCanvas.onGroupAdd },
        // { content: "Arrange", callback: that.graph.arrange },
        // {content:"Collapse All", callback: LGraphCanvas.onMenuCollapseAll }
      ]
      if (Object.keys(this.selected_nodes).length > 1) {
        options.push({
          content: "Convert to Subgraph 🆕",
          callback: () => {
            if (!this.selectedItems.size) throw new Error("Convert to Subgraph: Nothing selected.")
            this._graph.convertToSubgraph(this.selectedItems)
          },
        }, {
          content: "Align",
          has_submenu: true,
          callback: LGraphCanvas.onGroupAlign,
        })
      }
    }

    const extra = this.getExtraMenuOptions?.(this, options)
    return Array.isArray(extra)
      ? options.concat(extra)
      : options
  }

  // called by processContextMenu to extract the menu list
  getNodeMenuOptions(node: LGraphNode) {
    let options: (IContextMenuValue<string> | IContextMenuValue<string | null> | IContextMenuValue<INodeSlotContextItem> | IContextMenuValue<unknown, LGraphNode> | IContextMenuValue<typeof LiteGraph.VALID_SHAPES[number]> | null)[]

    if (node.getMenuOptions) {
      options = node.getMenuOptions(this)
    } else {
      options = [
        {
          content: "Inputs",
          has_submenu: true,
          disabled: true,
        },
        {
          content: "Outputs",
          has_submenu: true,
          disabled: true,
          callback: LGraphCanvas.showMenuNodeOptionalOutputs,
        },
        null,
        {
          content: "Convert to Subgraph 🆕",
          callback: () => {
            if (!this.selectedItems.size) throw new Error("Convert to Subgraph: Nothing selected.")
            this._graph.convertToSubgraph(this.selectedItems)
          },
        },
        {
          content: "Properties",
          has_submenu: true,
          callback: LGraphCanvas.onShowMenuNodeProperties,
        },
        {
          content: "Properties Panel",
          callback: function (item: any, options: any, e: any, menu: any, node: LGraphNode) { LGraphCanvas.active_canvas.showShowNodePanel(node) },
        },
        null,
        {
          content: "Title",
          callback: LGraphCanvas.onShowPropertyEditor,
        },
        {
          content: "Mode",
          has_submenu: true,
          callback: LGraphCanvas.onMenuNodeMode,
        },
      ]
      if (node.resizable !== false) {
        options.push({
          content: "Resize",
          callback: LGraphCanvas.onMenuResizeNode,
        })
      }
      if (node.collapsible) {
        options.push({
          content: node.collapsed ? "Expand" : "Collapse",
          callback: LGraphCanvas.onMenuNodeCollapse,
        })
      }
      if (node.widgets?.some(w => w.advanced)) {
        options.push({
          content: node.showAdvanced ? "Hide Advanced" : "Show Advanced",
          callback: LGraphCanvas.onMenuToggleAdvanced,
        })
      }
      options.push(
        {
          content: node.pinned ? "Unpin" : "Pin",
          callback: () => {
            for (const i in this.selected_nodes) {
              const node = this.selected_nodes[i]
              node.pin()
            }
            this.setDirty(true, true)
          },
        },
        {
          content: "Colors",
          has_submenu: true,
          callback: LGraphCanvas.onMenuNodeColors,
        },
        {
          content: "Shapes",
          has_submenu: true,
          callback: LGraphCanvas.onMenuNodeShapes,
        },
        null,
      )
    }

    const extra = node.getExtraMenuOptions?.(this, options)
    if (Array.isArray(extra) && extra.length > 0) {
      extra.push(null)
      options = extra.concat(options)
    }

    if (node.clonable !== false) {
      options.push({
        content: "Clone",
        callback: LGraphCanvas.onMenuNodeClone,
      })
    }

    if (Object.keys(this.selected_nodes).length > 1) {
      options.push({
        content: "Align Selected To",
        has_submenu: true,
        callback: LGraphCanvas.onNodeAlign,
      }, {
        content: "Distribute Nodes",
        has_submenu: true,
        callback: LGraphCanvas.createDistributeMenu,
      })
    }

    options.push(null, {
      content: "Remove",
      disabled: !(node.removable !== false && !node.block_delete),
      callback: LGraphCanvas.onMenuNodeRemove,
    })

    node.graph?.onGetNodeMenuOptions?.(options, node)

    return options
  }

  /** @deprecated */
  getGroupMenuOptions(group: LGraphGroup) {
    console.warn("LGraphCanvas.getGroupMenuOptions is deprecated, use LGraphGroup.getMenuOptions instead")
    return group.getMenuOptions()
  }

  processContextMenu(node: LGraphNode | undefined, event: CanvasMouseEvent): void {
    const canvas = LGraphCanvas.active_canvas
    const ref_window = canvas.getCanvasWindow()

    // TODO: Remove type kludge
    let menu_info: (IContextMenuValue | string | null)[]
    const options: IContextMenuOptions = {
      event,
      callback: inner_option_clicked,
      extra: node,
    }

    if (node) {
      options.title = node.displayType ?? node.type ?? undefined
      LGraphCanvas.active_node = node

      // check if mouse is in input
      const slot = node.getSlotInPosition(event.canvasX, event.canvasY)
      if (slot) {
        // on slot
        menu_info = []
        if (node.getSlotMenuOptions) {
          menu_info = node.getSlotMenuOptions(slot)
        } else {
          if (slot.output?.links?.length || slot.input?.link != null) {
            menu_info.push({ content: "Disconnect Links", slot })
          }

          const _slot = slot.input || slot.output
          if (!_slot) throw new TypeError("Both in put and output slots were null when processing context menu.")

          if (_slot.removable) {
            menu_info.push(
              _slot.locked
                ? "Cannot remove"
                : { content: "Remove Slot", slot },
            )
          }
          if (!_slot.nameLocked && !(("link" in _slot) && _slot.widget)) {
            menu_info.push({ content: "Rename Slot", slot })
          }

          if (node.getExtraSlotMenuOptions) {
            menu_info.push(...node.getExtraSlotMenuOptions(slot))
          }
        }
        // @ts-expect-error Slot type can be number and has number checks
        options.title = (slot.input ? slot.input.type : slot.output.type) || "*"
        if (slot.input && slot.input.type == LiteGraph.ACTION)
          options.title = "Action"

        if (slot.output && slot.output.type == LiteGraph.EVENT)
          options.title = "Event"
      } else {
        // on node
        menu_info = this.getNodeMenuOptions(node)
      }
    } else {
      menu_info = this.getCanvasMenuOptions()
      if (!this.graph) throw new NullGraphError()

      // Check for reroutes
      if (this.links_render_mode !== LinkRenderType.HIDDEN_LINK) {
        const reroute = this.graph.getRerouteOnPos(event.canvasX, event.canvasY, this.#visibleReroutes)
        if (reroute) {
          menu_info.unshift({
            content: "Delete Reroute",
            callback: () => {
              if (!this.graph) throw new NullGraphError()

              this.graph.removeReroute(reroute.id)
            },
          }, null)
        }
      }

      const group = this.graph.getGroupOnPos(
        event.canvasX,
        event.canvasY,
      )
      if (group) {
        // on group
        menu_info.push(null, {
          content: "Edit Group",
          has_submenu: true,
          submenu: {
            title: "Group",
            extra: group,
            options: group.getMenuOptions(),
          },
        })
      }
    }

    // show menu
    if (!menu_info) return

    // @ts-expect-error Remove param ref_window - unused
    new LiteGraph.ContextMenu(menu_info, options, ref_window)

    const createDialog = (options: IDialogOptions) => this.createDialog(
      "<span class='name'>Name</span><input autofocus type='text'/><button>OK</button>",
      options,
    )
    const setDirty = () => this.setDirty(true)

    function inner_option_clicked(v: IContextMenuValue<unknown>, options: IDialogOptions) {
      if (!v) return

      if (v.content == "Remove Slot") {
        if (!node?.graph) throw new NullGraphError()

        const info = v.slot
        if (!info) throw new TypeError("Found-slot info was null when processing context menu.")

        node.graph.beforeChange()
        if (info.input) {
          node.removeInput(info.slot)
        } else if (info.output) {
          node.removeOutput(info.slot)
        }
        node.graph.afterChange()
        return
      } else if (v.content == "Disconnect Links") {
        if (!node?.graph) throw new NullGraphError()

        const info = v.slot
        if (!info) throw new TypeError("Found-slot info was null when processing context menu.")

        node.graph.beforeChange()
        if (info.output) {
          node.disconnectOutput(info.slot)
        } else if (info.input) {
          node.disconnectInput(info.slot, true)
        }
        node.graph.afterChange()
        return
      } else if (v.content == "Rename Slot") {
        if (!node) throw new TypeError("`node` was null when processing the context menu.")

        const info = v.slot
        if (!info) throw new TypeError("Found-slot info was null when processing context menu.")

        const slot_info = info.input
          ? node.getInputInfo(info.slot)
          : node.getOutputInfo(info.slot)
        const dialog = createDialog(options)

        const input = dialog.querySelector("input")
        if (input && slot_info) {
          input.value = slot_info.label || ""
        }
        const inner = function () {
          if (!node.graph) throw new NullGraphError()

          node.graph.beforeChange()
          if (input?.value) {
            if (slot_info) {
              slot_info.label = input.value
            }
            setDirty()
          }
          dialog.close()
          node.graph.afterChange()
        }
        dialog.querySelector("button")?.addEventListener("click", inner)
        if (!input) throw new TypeError("Input element was null when processing context menu.")

        input.addEventListener("keydown", function (e) {
          dialog.is_modified = true
          if (e.key == "Escape") {
            // ESC
            dialog.close()
          } else if (e.key == "Enter") {
            // save
            inner()
          } else if ((e.target as Element).localName != "textarea") {
            return
          }
          e.preventDefault()
          e.stopPropagation()
        })
        input.focus()
      }
    }
  }

  /**
   * Starts an animation to fit the view around the specified selection of nodes.
   * @param bounds The bounds to animate the view to, defined by a rectangle.
   */
  animateToBounds(bounds: ReadOnlyRect, options: AnimationOptions = {}) {
    const setDirty = () => this.setDirty(true, true)
    this.ds.animateToBounds(bounds, setDirty, options)
  }

  /**
   * Fits the view to the selected nodes with animation.
   * If nothing is selected, the view is fitted around all items in the graph.
   */
  fitViewToSelectionAnimated(options: AnimationOptions = {}) {
    const items = this.selectedItems.size
      ? Array.from(this.selectedItems)
      : this.positionableItems
    const bounds = createBounds(items)
    if (!bounds) throw new TypeError("Attempted to fit to view but could not calculate bounds.")

    const setDirty = () => this.setDirty(true, true)
    this.ds.animateToBounds(bounds, setDirty, options)
  }
}
