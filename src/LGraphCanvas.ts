import type { CanvasColour, Dictionary, Direction, IBoundaryNodes, IContextMenuOptions, INodeSlot, INodeInputSlot, INodeOutputSlot, IOptionalSlotData, Point, Rect, Rect32, Size, IContextMenuValue, ISlotType, ConnectingLink, NullableProperties } from "./interfaces"
import type { IWidget, TWidgetValue } from "./types/widgets"
import type { LGraphNode, NodeId } from "./LGraphNode"
import type { CanvasDragEvent, CanvasMouseEvent, CanvasWheelEvent, CanvasEventDetail, CanvasPointerEvent } from "./types/events"
import type { IClipboardContents } from "./types/serialisation"
import type { LLink } from "./LLink"
import type { LGraph } from "./LGraph"
import type { ContextMenu } from "./ContextMenu"
import { LGraphEventMode, LinkDirection, LinkRenderType, RenderShape, TitleMode } from "./types/globalEnums"
import { LGraphGroup } from "./LGraphGroup"
import { isInsideRectangle, distance, overlapBounding, isPointInRectangle } from "./measure"
import { drawSlot, LabelPosition } from "./draw"
import { DragAndScale } from "./DragAndScale"
import { LinkReleaseContextExtended, LiteGraph, clamp } from "./litegraph"
import { stringOrEmpty, stringOrNull } from "./strings"
import { alignNodes, distributeNodes, getBoundaryNodes } from "./utils/arrange"

interface IShowSearchOptions {
    node_to?: LGraphNode
    node_from?: LGraphNode
    slot_from: number | INodeOutputSlot | INodeInputSlot
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

interface INodeFromTo {
    /** input */
    nodeFrom?: LGraphNode
    /** input */
    slotFrom?: number | INodeOutputSlot | INodeInputSlot
    /** output */
    nodeTo?: LGraphNode
    /** output */
    slotTo?: number | INodeOutputSlot | INodeInputSlot
    /** pass the event coords */
}

interface ICreateNodeOptions extends INodeFromTo {
    // FIXME: Should not be optional
    /** Position of new node */
    position?: Point

    // FIXME: Should not be optional
    /** choose a nodetype to add, AUTO to set at first good */
    nodeType?: string //nodeNewType
    /** adjust x,y */
    posAdd?: Point //-alphaPosY*30]
    /** alpha, adjust the position x,y based on the new node size w,h */
    posSizeFix?: Point //-alphaPosY*2*/
    e?: CanvasMouseEvent
    allow_searchbox?: boolean
    showSearchBox?: LGraphCanvas["showSearchBox"]
}

interface ICloseableDiv extends HTMLDivElement {
    close?(): void
}

interface IDialog extends ICloseableDiv {
    modified?(): void
    close?(): void
    is_modified?: boolean
}

interface IDialogOptions {
    position?: Point
    event?: MouseEvent
    checkForInput?: boolean
    closeOnLeave?: boolean
    onclose?(): void
}

interface IDrawSelectionBoundingOptions {
    shape?: RenderShape
    title_height?: number
    title_mode?: TitleMode
    fgcolor?: CanvasColour
    padding?: number
    collapsed?: boolean
}

/** @inheritdoc {@link LGraphCanvas.state} */
export interface LGraphCanvasState {
    /** {@link Positionable} items are being dragged on the canvas. */
    draggingItems: boolean
    /** The canvas itself is being dragged. */
    draggingCanvas: boolean
    /** The canvas is read-only, preventing changes to nodes, disconnecting links, moving items, etc. */
    readOnly: boolean
}

/**
 * This class is in charge of rendering one graph inside a canvas. And provides all the interaction required.
 * Valid callbacks are: onNodeSelected, onNodeDeselected, onShowNodePanel, onNodeDblClicked
 *
 * @param {HTMLCanvas} canvas the canvas where you want to render (it accepts a selector in string format or the canvas element itself)
 * @param {LGraph} graph [optional]
 * @param {Object} options [optional] { skip_rendering, autoresize, viewport }
 */
export class LGraphCanvas {

    /* Interaction */
    static #temp = new Float32Array(4)
    static #temp_vec2 = new Float32Array(2)
    static #tmp_area = new Float32Array(4)
    static #margin_area = new Float32Array(4)
    static #link_bounding = new Float32Array(4)
    static #tempA = new Float32Array(2)
    static #tempB = new Float32Array(2)

    static DEFAULT_BACKGROUND_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQBJREFUeNrs1rEKwjAUhlETUkj3vP9rdmr1Ysammk2w5wdxuLgcMHyptfawuZX4pJSWZTnfnu/lnIe/jNNxHHGNn//HNbbv+4dr6V+11uF527arU7+u63qfa/bnmh8sWLBgwYJlqRf8MEptXPBXJXa37BSl3ixYsGDBMliwFLyCV/DeLIMFCxYsWLBMwSt4Be/NggXLYMGCBUvBK3iNruC9WbBgwYJlsGApeAWv4L1ZBgsWLFiwYJmCV/AK3psFC5bBggULloJX8BpdwXuzYMGCBctgwVLwCl7Be7MMFixYsGDBsu8FH1FaSmExVfAxBa/gvVmwYMGCZbBg/W4vAQYA5tRF9QYlv/QAAAAASUVORK5CYII="

    /** Initialised from LiteGraphGlobal static block to avoid circular dependency. */
    static link_type_colors: Record<string, string>
    static gradients: Record<string, CanvasGradient> = {} //cache of gradients

    static search_limit = -1
    static node_colors = {
        red: { color: "#322", bgcolor: "#533", groupcolor: "#A88" },
        brown: { color: "#332922", bgcolor: "#593930", groupcolor: "#b06634" },
        green: { color: "#232", bgcolor: "#353", groupcolor: "#8A8" },
        blue: { color: "#223", bgcolor: "#335", groupcolor: "#88A" },
        pale_blue: {
            color: "#2a363b",
            bgcolor: "#3f5159",
            groupcolor: "#3f789e"
        },
        cyan: { color: "#233", bgcolor: "#355", groupcolor: "#8AA" },
        purple: { color: "#323", bgcolor: "#535", groupcolor: "#a1309b" },
        yellow: { color: "#432", bgcolor: "#653", groupcolor: "#b58b2a" },
        black: { color: "#222", bgcolor: "#000", groupcolor: "#444" }
    }

    /**
     * The state of this canvas, e.g. whether it is being dragged, or read-only.
     * 
     * Implemented as a POCO that can be proxied without side-effects.
     */
    state: LGraphCanvasState = {
        draggingItems: false,
        draggingCanvas: false,
        readOnly: false,
    }

    /** @inheritdoc {@link LGraphCanvasState.draggingCanvas} */
    get dragging_canvas(): boolean {
        return this.state.draggingCanvas
    }
    set dragging_canvas(value: boolean) {
        this.state.draggingCanvas = value
    }

    // Whether the canvas was previously being dragged prior to pressing space key.
    // null if space key is not pressed.
    private _previously_dragging_canvas: boolean | null = null

    /** @inheritdoc {@link LGraphCanvasState.readOnly} */
    get read_only(): boolean {
        return this.state.readOnly
    }
    set read_only(value: boolean) {
        this.state.readOnly = value
    }

    get isDragging(): boolean {
        return this.state.draggingItems
    }
    set isDragging(value: boolean) {
        this.state.draggingItems = value
    }
    options: { skip_events?: any; viewport?: any; skip_render?: any; autoresize?: any }
    background_image: string
    ds: DragAndScale
    zoom_modify_alpha: boolean
    zoom_speed: number
    title_text_font: string
    inner_text_font: string
    node_title_color: string
    default_link_color: string
    default_connection_color: {
        input_off: string; input_on: string //"#BBD"
        output_off: string; output_on: string //"#BBD"
    }
    default_connection_color_byType: Dictionary<CanvasColour>
    default_connection_color_byTypeOff: Dictionary<CanvasColour>
    highquality_render: boolean
    use_gradients: boolean
    editor_alpha: number
    pause_rendering: boolean
    clear_background: boolean
    clear_background_color: string
    render_only_selected: boolean
    live_mode: boolean
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
    render_title_colored: boolean
    render_link_tooltip: boolean
    links_render_mode: number
    /** mouse in canvas coordinates, where 0,0 is the top-left corner of the blue rectangle */
    mouse: Point
    /** mouse in graph coordinates, where 0,0 is the top-left corner of the blue rectangle */
    graph_mouse: Point
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
    round_radius: number
    current_node: LGraphNode | null
    /** used for widgets */
    node_widget?: [LGraphNode, IWidget] | null
    over_link_center: LLink | null
    last_mouse_position: Point
    visible_area?: Rect32
    visible_links?: LLink[]
    connecting_links: ConnectingLink[] | null
    viewport?: Rect
    autoresize: boolean
    static active_canvas: LGraphCanvas
    static onMenuNodeOutputs?(entries: IOptionalSlotData<INodeOutputSlot>[]): IOptionalSlotData<INodeOutputSlot>[]
    frame = 0
    last_draw_time = 0
    render_time = 0
    fps = 0
    selected_nodes: Dictionary<LGraphNode> = {}
    /** @deprecated Temporary implementation only - will be replaced with `selectedItems: Set<Positionable>`. */
    selectedGroups: Set<LGraphGroup> = new Set()
    selected_group: LGraphGroup | null = null
    visible_nodes: LGraphNode[] = []
    node_dragged?: LGraphNode
    node_over?: LGraphNode
    node_capturing_input?: LGraphNode
    highlighted_links: Dictionary<boolean> = {}
    link_over_widget?: IWidget
    link_over_widget_type?: string

    dirty_canvas: boolean = true
    dirty_bgcanvas: boolean = true
    /** A map of nodes that require selective-redraw */
    dirty_nodes = new Map<NodeId, LGraphNode>()
    dirty_area?: Rect
    // Unused
    node_in_panel?: LGraphNode
    last_mouse: Point = [0, 0]
    last_mouseclick: number = 0
    pointer_is_down: boolean = false
    pointer_is_double: boolean = false
    graph!: LGraph
    _graph_stack: LGraph[] | null = null
    canvas: HTMLCanvasElement
    bgcanvas: HTMLCanvasElement
    ctx?: CanvasRenderingContext2D
    _events_binded?: boolean
    _mousedown_callback?(e: CanvasMouseEvent): boolean
    _mousewheel_callback?(e: CanvasMouseEvent): boolean
    _mousemove_callback?(e: CanvasMouseEvent): boolean
    _mouseup_callback?(e: CanvasMouseEvent): boolean
    _mouseout_callback?(e: CanvasMouseEvent): boolean
    _key_callback?(e: KeyboardEvent): boolean
    _ondrop_callback?(e: CanvasDragEvent): unknown
    gl?: never
    bgctx?: CanvasRenderingContext2D
    is_rendering?: boolean
    block_click?: boolean
    last_click_position?: Point
    resizing_node?: LGraphNode
    selected_group_resizing?: boolean
    last_mouse_dragging: boolean
    onMouseDown: (arg0: CanvasMouseEvent) => void
    _highlight_pos?: Point
    _highlight_input?: INodeInputSlot
    // TODO: Check if panels are used
    node_panel
    options_panel
    onDropItem: (e: Event) => any
    _bg_img: HTMLImageElement
    _pattern?: CanvasPattern
    _pattern_img: HTMLImageElement
    // TODO: This looks like another panel thing
    prompt_box: IDialog
    search_box: HTMLDivElement
    SELECTED_NODE: LGraphNode
    NODEPANEL_IS_OPEN: boolean
    getMenuOptions?(): IContextMenuValue[]
    getExtraMenuOptions?(canvas: LGraphCanvas, options: IContextMenuValue[]): IContextMenuValue[]
    static active_node: LGraphNode
    /** called before modifying the graph */
    onBeforeChange?(graph: LGraph): void
    /** called after modifying the graph */
    onAfterChange?(graph: LGraph): void
    onClear?: () => void
    /** called after moving a node */
    onNodeMoved?: (node_dragged: LGraphNode) => void
    /** called if the selection changes */
    onSelectionChange?: (selected_nodes: Dictionary<LGraphNode>) => void
    /** called when rendering a tooltip */
    onDrawLinkTooltip?: (ctx: CanvasRenderingContext2D, link: LLink, canvas?: LGraphCanvas) => boolean
    /** to render foreground objects not affected by transform (for GUIs) */
    onDrawOverlay?: (ctx: CanvasRenderingContext2D) => void
    onRenderBackground?: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => boolean
    onNodeDblClicked?: (n: LGraphNode) => void
    onShowNodePanel?: (n: LGraphNode) => void
    onNodeSelected?: (node: LGraphNode) => void
    onNodeDeselected?: (node: LGraphNode) => void
    onRender?: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void
    /** Implement this function to allow conversion of widget types to input types, e.g. number -> INT or FLOAT for widget link validation checks */
    getWidgetLinkType?: (widget: IWidget, node: LGraphNode) => string | null | undefined

    /**
     * Creates a new instance of LGraphCanvas.
     * @param canvas The canvas HTML element (or its id) to use, or null / undefined to leave blank.
     * @param graph The graph that owns this canvas.
     * @param options 
     */
    constructor(canvas: HTMLCanvasElement, graph: LGraph, options?: LGraphCanvas["options"]) {
        options ||= {}
        this.options = options

        //if(graph === undefined)
        //	throw ("No graph assigned");
        this.background_image = LGraphCanvas.DEFAULT_BACKGROUND_IMAGE

        this.ds = new DragAndScale()
        this.zoom_modify_alpha = true //otherwise it generates ugly patterns when scaling down too much
        this.zoom_speed = 1.1 // in range (1.01, 2.5). Less than 1 will invert the zoom direction

        this.title_text_font = "" + LiteGraph.NODE_TEXT_SIZE + "px Arial"
        this.inner_text_font =
            "normal " + LiteGraph.NODE_SUBTEXT_SIZE + "px Arial"
        this.node_title_color = LiteGraph.NODE_TITLE_COLOR
        this.default_link_color = LiteGraph.LINK_COLOR
        this.default_connection_color = {
            input_off: "#778",
            input_on: "#7F7", //"#BBD"
            output_off: "#778",
            output_on: "#7F7" //"#BBD"
        }
        this.default_connection_color_byType = {
            /*number: "#7F7",
            string: "#77F",
            boolean: "#F77",*/
        }
        this.default_connection_color_byTypeOff = {
            /*number: "#474",
            string: "#447",
            boolean: "#744",*/
        }

        this.highquality_render = true
        this.use_gradients = false //set to true to render titlebar with gradients
        this.editor_alpha = 1 //used for transition
        this.pause_rendering = false
        this.clear_background = true
        this.clear_background_color = "#222"

        this.render_only_selected = true
        this.live_mode = false
        this.show_info = true
        this.allow_dragcanvas = true
        this.allow_dragnodes = true
        this.allow_interaction = true //allow to control widgets, buttons, collapse, etc
        this.multi_select = false //allow selecting multi nodes without pressing extra keys
        this.allow_searchbox = true
        this.allow_reconnect_links = true //allows to change a connection with having to redo it again
        this.align_to_grid = false //snap to grid

        this.drag_mode = false
        this.dragging_rectangle = null

        this.filter = null //allows to filter to only accept some type of nodes in a graph

        this.set_canvas_dirty_on_mouse_event = true //forces to redraw the canvas on mouse events (except move)
        this.always_render_background = false
        this.render_shadows = true
        this.render_canvas_border = true
        this.render_connections_shadows = false //too much cpu
        this.render_connections_border = true
        this.render_curved_connections = false
        this.render_connection_arrows = false
        this.render_collapsed_slots = true
        this.render_execution_order = false
        this.render_title_colored = true
        this.render_link_tooltip = true

        this.links_render_mode = LinkRenderType.SPLINE_LINK

        this.mouse = [0, 0]
        this.graph_mouse = [0, 0]
        this.canvas_mouse = this.graph_mouse

        //to personalize the search box
        this.onSearchBox = null
        this.onSearchBoxSelection = null

        //callbacks
        this.onMouse = null
        this.onDrawBackground = null
        this.onDrawForeground = null
        this.onDrawOverlay = null
        this.onDrawLinkTooltip = null
        this.onNodeMoved = null
        this.onSelectionChange = null
        // FIXME: Typo, does nothing
        //called before any link changes
        // @ts-expect-error
        this.onConnectingChange = null
        this.onBeforeChange = null
        this.onAfterChange = null

        this.connections_width = 3
        this.round_radius = 8

        this.current_node = null
        this.node_widget = null
        this.over_link_center = null
        this.last_mouse_position = [0, 0]
        this.visible_area = this.ds.visible_area
        this.visible_links = []
        this.connecting_links = null // Explicitly null-checked

        this.viewport = options.viewport || null //to constraint render area to a portion of the canvas

        //link canvas and graph
        graph?.attachCanvas(this)

        this.setCanvas(canvas, options.skip_events)
        this.clear()

        if (!options.skip_render) {
            this.startRendering()
        }

        this.autoresize = options.autoresize
    }

    static getFileExtension(url: string): string {
        const question = url.indexOf("?")
        if (question !== -1) url = url.substring(0, question)

        const point = url.lastIndexOf(".")
        return point === -1
            ? ""
            : url.substring(point + 1).toLowerCase()
    }

    static onGroupAdd(info: unknown, entry: unknown, mouse_event: MouseEvent): void {
        const canvas = LGraphCanvas.active_canvas

        const group = new LiteGraph.LGraphGroup()
        group.pos = canvas.convertEventToCanvasOffset(mouse_event)
        canvas.graph.add(group)
    }
    /**
     * @deprecated Functionality moved to {@link getBoundaryNodes}.  The new function returns null on failure, instead of an object with all null properties.
     * Determines the furthest nodes in each direction
     * @param {Dictionary<LGraphNode>} nodes the nodes to from which boundary nodes will be extracted
     * @return {{left: LGraphNode, top: LGraphNode, right: LGraphNode, bottom: LGraphNode}}
     */
    static getBoundaryNodes(nodes: LGraphNode[] | Dictionary<LGraphNode>): NullableProperties<IBoundaryNodes> {
        const _nodes = Array.isArray(nodes) ? nodes : Object.values(nodes)
        return getBoundaryNodes(_nodes) ?? {
            top: null,
            right: null,
            bottom: null,
            left: null
        }
    }
    /**
     * @deprecated Functionality moved to {@link alignNodes}.  The new function does not set dirty canvas.
     * @param {Dictionary<LGraphNode>} nodes a list of nodes
     * @param {"top"|"bottom"|"left"|"right"} direction Direction to align the nodes
     * @param {LGraphNode?} align_to Node to align to (if null, align to the furthest node in the given direction)
     */
    static alignNodes(nodes: Dictionary<LGraphNode>, direction: Direction, align_to?: LGraphNode): void {
        alignNodes(Object.values(nodes), direction, align_to)
        LGraphCanvas.active_canvas.setDirty(true, true)
    }
    static onNodeAlign(value: IContextMenuValue, options: IContextMenuOptions, event: MouseEvent, prev_menu: ContextMenu, node: LGraphNode): void {
        new LiteGraph.ContextMenu(["Top", "Bottom", "Left", "Right"], {
            event: event,
            callback: inner_clicked,
            parentMenu: prev_menu,
        })

        function inner_clicked(value: string) {
            alignNodes(Object.values(LGraphCanvas.active_canvas.selected_nodes), (value.toLowerCase() as Direction), node)
            LGraphCanvas.active_canvas.setDirty(true, true)
        }
    }
    static onGroupAlign(value: IContextMenuValue, options: IContextMenuOptions, event: MouseEvent, prev_menu: ContextMenu): void {
        new LiteGraph.ContextMenu(["Top", "Bottom", "Left", "Right"], {
            event: event,
            callback: inner_clicked,
            parentMenu: prev_menu,
        })

        function inner_clicked(value: string) {
            alignNodes(Object.values(LGraphCanvas.active_canvas.selected_nodes), (value.toLowerCase() as Direction))
            LGraphCanvas.active_canvas.setDirty(true, true)
        }
    }
    static createDistributeMenu(value: IContextMenuValue, options: IContextMenuOptions, event: MouseEvent, prev_menu: ContextMenu, node: LGraphNode): void {
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
    static onMenuAdd(node: LGraphNode, options: IContextMenuOptions, e: MouseEvent, prev_menu: ContextMenu, callback?: (node: LGraphNode) => void): boolean {

        const canvas = LGraphCanvas.active_canvas
        const ref_window = canvas.getCanvasWindow()
        const graph = canvas.graph
        if (!graph)
            return

        function inner_onMenuAdded(base_category: string, prev_menu: ContextMenu): void {

            const categories = LiteGraph.getNodeTypesCategories(canvas.filter || graph.filter).filter(function (category) { return category.startsWith(base_category) })
            const entries = []

            categories.map(function (category) {

                if (!category)
                    return

                const base_category_regex = new RegExp('^(' + base_category + ')')
                const category_name = category.replace(base_category_regex, "").split('/')[0]
                const category_path = base_category === '' ? category_name + '/' : base_category + category_name + '/'

                let name = category_name
                if (name.indexOf("::") != -1) //in case it has a namespace like "shader::math/rand" it hides the namespace
                    name = name.split("::")[1]

                const index = entries.findIndex(function (entry) { return entry.value === category_path })
                if (index === -1) {
                    entries.push({
                        value: category_path, content: name, has_submenu: true, callback: function (value, event, mouseEvent, contextMenu) {
                            inner_onMenuAdded(value.value, contextMenu)
                        }
                    })
                }

            })

            const nodes = LiteGraph.getNodeTypesInCategory(base_category.slice(0, -1), canvas.filter || graph.filter)
            nodes.map(function (node) {

                if (node.skip_list)
                    return

                const entry = {
                    value: node.type, content: node.title, has_submenu: false, callback: function (value, event, mouseEvent, contextMenu) {

                        const first_event = contextMenu.getFirstEvent()
                        canvas.graph.beforeChange()
                        const node = LiteGraph.createNode(value.value)
                        if (node) {
                            node.pos = canvas.convertEventToCanvasOffset(first_event)
                            canvas.graph.add(node)
                        }

                        callback?.(node)
                        canvas.graph.afterChange()

                    }
                }

                entries.push(entry)

            })

            // @ts-expect-error Remove param ref_window - unused
            new LiteGraph.ContextMenu(entries, { event: e, parentMenu: prev_menu }, ref_window)

        }

        inner_onMenuAdded('', prev_menu)
        return false

    }

    static onMenuCollapseAll() { }
    static onMenuNodeEdit() { }

    /** @param options Parameter is never used */
    static showMenuNodeOptionalInputs(v: unknown, options: INodeInputSlot[], e: MouseEvent, prev_menu: ContextMenu, node: LGraphNode): boolean {
        if (!node) return

        // FIXME: Static function this
        const that = this
        const canvas = LGraphCanvas.active_canvas
        const ref_window = canvas.getCanvasWindow()

        options = node.onGetInputs
            ? node.onGetInputs()
            : node.optional_inputs

        let entries: IOptionalSlotData<INodeInputSlot>[] = []
        if (options) {
            for (let i = 0; i < options.length; i++) {
                const entry = options[i]
                if (!entry) {
                    entries.push(null)
                    continue
                }
                let label = entry[0]
                entry[2] ||= {}

                if (entry[2].label) {
                    label = entry[2].label
                }

                entry[2].removable = true
                const data: IOptionalSlotData<INodeInputSlot> = { content: label, value: entry }
                if (entry[1] == LiteGraph.ACTION) {
                    data.className = "event"
                }
                entries.push(data)
            }
        }

        const retEntries = node.onMenuNodeInputs?.(entries)
        if (retEntries) entries = retEntries

        if (!entries.length) {
            console.log("no input entries")
            return
        }

        new LiteGraph.ContextMenu(
            entries,
            {
                event: e,
                callback: inner_clicked,
                parentMenu: prev_menu,
                node: node
            },
            // @ts-expect-error Unused param
            ref_window
        )

        function inner_clicked(v, e, prev) {
            if (!node) return

            v.callback?.call(that, node, v, e, prev)

            if (!v.value) return
            node.graph.beforeChange()
            node.addInput(v.value[0], v.value[1], v.value[2])

            // callback to the node when adding a slot
            node.onNodeInputAdd?.(v.value)
            canvas.setDirty(true, true)
            node.graph.afterChange()
        }

        return false
    }

    /** @param options Parameter is never used */
    static showMenuNodeOptionalOutputs(v: unknown, options: INodeOutputSlot[], e: unknown, prev_menu: ContextMenu, node: LGraphNode): boolean {
        if (!node) return

        const that = this
        const canvas = LGraphCanvas.active_canvas
        const ref_window = canvas.getCanvasWindow()

        options = node.onGetOutputs
            ? node.onGetOutputs()
            : node.optional_outputs

        let entries: IOptionalSlotData<INodeOutputSlot>[] = []
        if (options) {
            for (let i = 0; i < options.length; i++) {
                const entry = options[i]
                if (!entry) {
                    //separator?
                    entries.push(null)
                    continue
                }

                if (node.flags &&
                    node.flags.skip_repeated_outputs &&
                    node.findOutputSlot(entry[0]) != -1) {
                    continue
                } //skip the ones already on
                let label = entry[0]
                entry[2] ||= {}
                if (entry[2].label) {
                    label = entry[2].label
                }
                entry[2].removable = true
                const data: IOptionalSlotData<INodeOutputSlot> = { content: label, value: entry }
                if (entry[1] == LiteGraph.EVENT) {
                    data.className = "event"
                }
                entries.push(data)
            }
        }

        if (this.onMenuNodeOutputs) entries = this.onMenuNodeOutputs(entries)
        if (LiteGraph.do_add_triggers_slots) { //canvas.allow_addOutSlot_onExecuted
            if (node.findOutputSlot("onExecuted") == -1) {
                // @ts-expect-error Events
                entries.push({ content: "On Executed", value: ["onExecuted", LiteGraph.EVENT, { nameLocked: true }], className: "event" }) //, opts: {}
            }
        }
        // add callback for modifing the menu elements onMenuNodeOutputs
        const retEntries = node.onMenuNodeOutputs?.(entries)
        if (retEntries) entries = retEntries

        if (!entries.length) return

        new LiteGraph.ContextMenu(
            entries,
            {
                event: e,
                callback: inner_clicked,
                parentMenu: prev_menu,
                node: node
            },
            // @ts-expect-error Unused
            ref_window
        )

        function inner_clicked(v, e, prev) {
            if (!node) return

            // TODO: This is a static method, so the below "that" appears broken.
            if (v.callback) v.callback.call(that, node, v, e, prev)

            if (!v.value) return

            const value = v.value[1]

            if (value &&
                (typeof value === "object" || Array.isArray(value))) {
                //submenu why?
                const entries = []
                for (const i in value) {
                    entries.push({ content: i, value: value[i] })
                }
                new LiteGraph.ContextMenu(entries, {
                    event: e,
                    callback: inner_clicked,
                    parentMenu: prev_menu,
                    node: node
                })
                return false
            }

            const graph = node.graph
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
    static onShowMenuNodeProperties(value: unknown, options: unknown, e: MouseEvent, prev_menu: ContextMenu, node: LGraphNode): boolean {
        if (!node || !node.properties) return

        const canvas = LGraphCanvas.active_canvas
        const ref_window = canvas.getCanvasWindow()

        const entries = []
        for (const i in node.properties) {
            value = node.properties[i] !== undefined ? node.properties[i] : " "
            if (typeof value == "object")
                value = JSON.stringify(value)
            const info = node.getPropertyInfo(i)
            if (info.type == "enum" || info.type == "combo")
                value = LGraphCanvas.getPropertyPrintableValue(value, info.values)

            //value could contain invalid html characters, clean that
            value = LGraphCanvas.decodeHTML(stringOrNull(value))
            entries.push({
                content: "<span class='property_name'>" +
                    (info.label || i) +
                    "</span>" +
                    "<span class='property_value'>" +
                    value +
                    "</span>",
                value: i
            })
        }
        if (!entries.length) {
            return
        }

        new LiteGraph.ContextMenu(
            entries,
            {
                event: e,
                callback: inner_clicked,
                parentMenu: prev_menu,
                allow_html: true,
                node: node
            },
            // @ts-expect-error Unused
            ref_window
        )

        function inner_clicked(v: { value: any }) {
            if (!node) return

            const rect = this.getBoundingClientRect()
            canvas.showEditPropertyValue(node, v.value, {
                position: [rect.left, rect.top]
            })
        }

        return false
    }
    static decodeHTML(str: string): string {
        const e = document.createElement("div")
        e.innerText = str
        return e.innerHTML
    }
    static onMenuResizeNode(value: IContextMenuValue, options: IContextMenuOptions, e: MouseEvent, menu: ContextMenu, node: LGraphNode): void {
        if (!node) return

        const fApplyMultiNode = function (node: LGraphNode) {
            node.size = node.computeSize()
            node.onResize?.(node.size)
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
    static onShowPropertyEditor(item: { property: string; type: string }, options: IContextMenuOptions, e: MouseEvent, menu: ContextMenu, node: LGraphNode): void {
        const property = item.property || "title"
        const value = node[property]

        // TODO: Remove "any" kludge
        // TODO refactor :: use createDialog ?
        const dialog: any = document.createElement("div")
        dialog.is_modified = false
        dialog.className = "graphdialog"
        dialog.innerHTML =
            "<span class='name'></span><input autofocus type='text' class='value'/><button>OK</button>"
        dialog.close = function () {
            dialog.parentNode?.removeChild(dialog)
        }
        const title = dialog.querySelector(".name")
        title.innerText = property
        const input = dialog.querySelector(".value")
        if (input) {
            input.value = value
            input.addEventListener("blur", function () {
                this.focus()
            })
            input.addEventListener("keydown", function (e: KeyboardEvent) {
                dialog.is_modified = true
                if (e.keyCode == 27) {
                    //ESC
                    dialog.close()
                } else if (e.keyCode == 13) {
                    inner() // save
                    // @ts-expect-error Intentional - undefined if not present
                } else if (e.keyCode != 13 && e.target.localName != "textarea") {
                    return
                }
                e.preventDefault()
                e.stopPropagation()
            })
        }

        const canvas = LGraphCanvas.active_canvas
        const canvasEl = canvas.canvas

        const rect = canvasEl.getBoundingClientRect()
        let offsetx = -20
        let offsety = -20
        if (rect) {
            offsetx -= rect.left
            offsety -= rect.top
        }

        if (e) {
            dialog.style.left = e.clientX + offsetx + "px"
            dialog.style.top = e.clientY + offsety + "px"
        } else {
            dialog.style.left = canvasEl.width * 0.5 + offsetx + "px"
            dialog.style.top = canvasEl.height * 0.5 + offsety + "px"
        }

        const button = dialog.querySelector("button")
        button.addEventListener("click", inner)
        canvasEl.parentNode.appendChild(dialog)

        input?.focus()

        let dialogCloseTimer = null
        dialog.addEventListener("mouseleave", function () {
            if (LiteGraph.dialog_close_on_mouse_leave)
                if (!dialog.is_modified && LiteGraph.dialog_close_on_mouse_leave)
                    dialogCloseTimer = setTimeout(dialog.close, LiteGraph.dialog_close_on_mouse_leave_delay) //dialog.close();
        })
        dialog.addEventListener("mouseenter", function () {
            if (LiteGraph.dialog_close_on_mouse_leave)
                if (dialogCloseTimer) clearTimeout(dialogCloseTimer)
        })

        function inner() {
            if (input) setValue(input.value)
        }

        function setValue(value) {
            if (item.type == "Number") {
                value = Number(value)
            } else if (item.type == "Boolean") {
                value = Boolean(value)
            }
            node[property] = value
            dialog.parentNode?.removeChild(dialog)
            canvas.setDirty(true, true)
        }
    }
    static getPropertyPrintableValue(value: unknown, values: unknown[] | object): string {
        if (!values)
            return String(value)

        if (Array.isArray(values)) {
            return String(value)
        }

        if (typeof values === "object") {
            let desc_value = ""
            for (const k in values) {
                if (values[k] != value)
                    continue
                desc_value = k
                break
            }
            return String(value) + " (" + desc_value + ")"
        }
    }
    static onMenuNodeCollapse(value: IContextMenuValue, options: IContextMenuOptions, e: MouseEvent, menu: ContextMenu, node: LGraphNode): void {
        node.graph.beforeChange( /*?*/)

        const fApplyMultiNode = function (node) {
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

        node.graph.afterChange( /*?*/)
    }
    static onMenuToggleAdvanced(value: IContextMenuValue, options: IContextMenuOptions, e: MouseEvent, menu: ContextMenu, node: LGraphNode): void {
        node.graph.beforeChange( /*?*/)
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
        node.graph.afterChange( /*?*/)
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static onMenuNodePin(value: IContextMenuValue, options: IContextMenuOptions, e: MouseEvent, menu: ContextMenu, node: LGraphNode): void {
    }
    static onMenuNodeMode(value: IContextMenuValue, options: IContextMenuOptions, e: MouseEvent, menu: ContextMenu, node: LGraphNode): boolean {
        new LiteGraph.ContextMenu(
            LiteGraph.NODE_MODES,
            { event: e, callback: inner_clicked, parentMenu: menu, node: node }
        )

        function inner_clicked(v) {
            if (!node) return

            const kV = Object.values(LiteGraph.NODE_MODES).indexOf(v)
            const fApplyMultiNode = function (node) {
                if (kV >= 0 && LiteGraph.NODE_MODES[kV])
                    node.changeMode(kV)
                else {
                    console.warn("unexpected mode: " + v)
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
    static onMenuNodeColors(value: IContextMenuValue, options: IContextMenuOptions, e: MouseEvent, menu: ContextMenu, node: LGraphNode): boolean {
        if (!node) throw "no node for color"

        const values: IContextMenuValue[] = []
        values.push({
            value: null,
            content: "<span style='display: block; padding-left: 4px;'>No color</span>"
        })

        for (const i in LGraphCanvas.node_colors) {
            const color = LGraphCanvas.node_colors[i]
            value = {
                value: i,
                content: "<span style='display: block; color: #999; padding-left: 4px; border-left: 8px solid " +
                    color.color +
                    "; background-color:" +
                    color.bgcolor +
                    "'>" +
                    i +
                    "</span>"
            }
            values.push(value)
        }
        new LiteGraph.ContextMenu(values, {
            event: e,
            callback: inner_clicked,
            parentMenu: menu,
            node: node
        })

        function inner_clicked(v: { value: string | number }) {
            if (!node) return

            const color = v.value ? LGraphCanvas.node_colors[v.value] : null

            const fApplyColor = function (node: LGraphNode) {
                if (color) {
                    if (node instanceof LGraphGroup) {
                        node.color = color.groupcolor
                    } else {
                        node.color = color.color
                        node.bgcolor = color.bgcolor
                    }
                } else {
                    delete node.color
                    delete node.bgcolor
                }
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
    static onMenuNodeShapes(value: IContextMenuValue, options: IContextMenuOptions, e: MouseEvent, menu: ContextMenu, node: LGraphNode): boolean {
        if (!node) throw "no node passed"

        new LiteGraph.ContextMenu(LiteGraph.VALID_SHAPES, {
            event: e,
            callback: inner_clicked,
            parentMenu: menu,
            node: node
        })

        function inner_clicked(v) {
            if (!node) return

            node.graph.beforeChange( /*?*/) //node

            const fApplyMultiNode = function (node) {
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

            node.graph.afterChange( /*?*/) //node
            canvas.setDirty(true)
        }

        return false
    }
    static onMenuNodeRemove(value: IContextMenuValue, options: IContextMenuOptions, e: MouseEvent, menu: ContextMenu, node: LGraphNode): void {
        if (!node) throw "no node passed"

        const graph = node.graph
        graph.beforeChange()

        const fApplyMultiNode = function (node: LGraphNode) {
            if (node.removable === false) return

            graph.remove(node)
        }

        const canvas = LGraphCanvas.active_canvas
        if (!canvas.selected_nodes || Object.keys(canvas.selected_nodes).length <= 1) {
            fApplyMultiNode(node)
        } else {
            for (const i in canvas.selected_nodes) {
                fApplyMultiNode(canvas.selected_nodes[i])
            }
        }

        graph.afterChange()
        canvas.setDirty(true, true)
    }
    static onMenuNodeToSubgraph(value: IContextMenuValue, options: IContextMenuOptions, e: MouseEvent, menu: ContextMenu, node: LGraphNode): void {
        const graph = node.graph
        const canvas = LGraphCanvas.active_canvas
        if (!canvas) return

        let nodes_list = Object.values(canvas.selected_nodes || {})
        if (!nodes_list.length)
            nodes_list = [node]

        const subgraph_node = LiteGraph.createNode("graph/subgraph")
        // @ts-expect-error Refactor this to use typed array.
        subgraph_node.pos = node.pos.concat()
        graph.add(subgraph_node)

        // @ts-expect-error Doesn't exist anywhere...
        subgraph_node.buildFromNodes(nodes_list)

        canvas.deselectAllNodes()
        canvas.setDirty(true, true)
    }
    static onMenuNodeClone(value: IContextMenuValue, options: IContextMenuOptions, e: MouseEvent, menu: ContextMenu, node: LGraphNode): void {

        const graph = node.graph
        graph.beforeChange()

        const newSelected: Dictionary<LGraphNode> = {}

        const fApplyMultiNode = function (node) {
            if (node.clonable === false) return

            const newnode = node.clone()
            if (!newnode) return

            newnode.pos = [node.pos[0] + 5, node.pos[1] + 5]
            node.graph.add(newnode)
            newSelected[newnode.id] = newnode
        }

        const canvas = LGraphCanvas.active_canvas
        if (!canvas.selected_nodes || Object.keys(canvas.selected_nodes).length <= 1) {
            fApplyMultiNode(node)
        } else {
            for (const i in canvas.selected_nodes) {
                fApplyMultiNode(canvas.selected_nodes[i])
            }
        }

        if (Object.keys(newSelected).length) {
            canvas.selectNodes(newSelected)
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

        //this.scale = 1;
        //this.offset = [0,0];
        this.dragging_rectangle = null

        this.selected_nodes = {}
        /** All selected groups */
        this.selectedGroups = null
        /** The group currently being resized */
        this.selected_group = null

        this.visible_nodes = []
        this.node_dragged = null
        this.node_over = null
        this.node_capturing_input = null
        this.connecting_links = null
        this.highlighted_links = {}

        this.dragging_canvas = false

        this.dirty_canvas = true
        this.dirty_bgcanvas = true
        this.dirty_area = null

        this.node_in_panel = null
        this.node_widget = null

        this.last_mouse = [0, 0]
        this.last_mouseclick = 0
        this.pointer_is_down = false
        this.pointer_is_double = false
        this.visible_area.set([0, 0, 0, 0])

        this.onClear?.()
    }
    /**
     * assigns a graph, you can reassign graphs to the same canvas
     *
     * @param {LGraph} graph
     */
    setGraph(graph: LGraph, skip_clear: boolean): void {
        if (this.graph == graph) return

        if (!skip_clear) this.clear()

        if (!graph && this.graph) {
            this.graph.detachCanvas(this)
            return
        }

        graph.attachCanvas(this)

        //remove the graph stack in case a subgraph was open
        this._graph_stack &&= null

        this.setDirty(true, true)
    }
    /**
     * returns the top level graph (in case there are subgraphs open on the canvas)
     *
     * @return {LGraph} graph
     */
    getTopGraph(): LGraph {
        return this._graph_stack.length
            ? this._graph_stack[0]
            : this.graph
    }
    /**
     * opens a graph contained inside a node in the current graph
     *
     * @param {LGraph} graph
     */
    openSubgraph(graph: LGraph): void {
        if (!graph) throw "graph cannot be null"

        if (this.graph == graph) throw "graph cannot be the same"

        this.clear()

        if (this.graph) {
            this._graph_stack ||= []
            this._graph_stack.push(this.graph)
        }

        graph.attachCanvas(this)
        this.checkPanels()
        this.setDirty(true, true)
    }
    /**
     * closes a subgraph contained inside a node
     *
     * @param {LGraph} assigns a graph
     */
    closeSubgraph(): void {
        if (!this._graph_stack || this._graph_stack.length == 0) return

        const subgraph_node = this.graph._subgraph_node
        const graph = this._graph_stack.pop()
        this.selected_nodes = {}
        this.highlighted_links = {}
        graph.attachCanvas(this)
        this.setDirty(true, true)
        if (subgraph_node) {
            this.centerOnNode(subgraph_node)
            this.selectNodes([subgraph_node])
        }
        // when close sub graph back to offset [0, 0] scale 1
        this.ds.offset = [0, 0]
        this.ds.scale = 1
    }
    /**
     * returns the visually active graph (in case there are more in the stack)
     * @return {LGraph} the active graph
     */
    getCurrentGraph(): LGraph {
        return this.graph
    }
    /**
     * Finds the canvas if required, throwing on failure.
     * @param canvas Canvas element, or its element ID
     * @returns The canvas element
     * @throws If {@link canvas} is an element ID that does not belong to a valid HTML canvas element
     */
    #validateCanvas(canvas: string | HTMLCanvasElement): HTMLCanvasElement & { data?: LGraphCanvas } {
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
     *
     * @param canvas The canvas element to assign, or its HTML element ID.  If null or undefined, the current reference is cleared.
     * @param skip_events If true, events on the previous canvas will not be removed.  Has no effect on the first invocation.
     */
    setCanvas(canvas: string | HTMLCanvasElement, skip_events?: boolean) {
        const element = this.#validateCanvas(canvas)
        if (element === this.canvas) return
        //maybe detach events from old_canvas
        if (!element && this.canvas && !skip_events) this.unbindEvents()

        this.canvas = element
        this.ds.element = element

        if (!element) return

        // TODO: classList.add
        element.className += " lgraphcanvas"
        element.data = this
        // @ts-expect-error Likely safe to remove.  A decent default, but expectation is to be configured by calling app.
        element.tabindex = "1" //to allow key events

        // Background canvas: To render objects behind nodes (background, links, groups)
        this.bgcanvas = null
        if (!this.bgcanvas) {
            this.bgcanvas = document.createElement("canvas")
            this.bgcanvas.width = this.canvas.width
            this.bgcanvas.height = this.canvas.height
        }
        if (element.getContext == null) {
            if (element.localName != "canvas") {
                throw "Element supplied for LGraphCanvas must be a <canvas> element, you passed a " +
                element.localName
            }
            throw "This browser doesn't support Canvas"
        }

        const ctx = (this.ctx = element.getContext("2d"))
        if (ctx == null) {
            // @ts-expect-error WebGL
            if (!element.webgl_enabled) {
                console.warn(
                    "This canvas seems to be WebGL, enabling WebGL renderer"
                )
            }
            this.enableWebGL()
        }

        if (!skip_events) this.bindEvents()
    }
    //used in some events to capture them
    _doNothing(e: Event) {
        //console.log("pointerevents: _doNothing "+e.type);
        e.preventDefault()
        return false
    }
    _doReturnTrue(e: Event) {
        e.preventDefault()
        return true
    }
    /**
     * binds mouse, keyboard, touch and drag events to the canvas
     **/
    bindEvents(): void {
        if (this._events_binded) {
            console.warn("LGraphCanvas: events already binded")
            return
        }

        //console.log("pointerevents: bindEvents");
        const canvas = this.canvas

        const ref_window = this.getCanvasWindow()
        const document = ref_window.document //hack used when moving canvas between windows

        this._mousedown_callback = this.processMouseDown.bind(this)
        this._mousewheel_callback = this.processMouseWheel.bind(this)
        // why mousemove and mouseup were not binded here?
        this._mousemove_callback = this.processMouseMove.bind(this)
        this._mouseup_callback = this.processMouseUp.bind(this)
        this._mouseout_callback = this.processMouseOut.bind(this)

        LiteGraph.pointerListenerAdd(canvas, "down", this._mousedown_callback, true) //down do not need to store the binded
        canvas.addEventListener("mousewheel", this._mousewheel_callback, false)

        LiteGraph.pointerListenerAdd(canvas, "up", this._mouseup_callback, true) // CHECK: ??? binded or not
        LiteGraph.pointerListenerAdd(canvas, "move", this._mousemove_callback)
        canvas.addEventListener("pointerout", this._mouseout_callback)

        canvas.addEventListener("contextmenu", this._doNothing)
        canvas.addEventListener(
            "DOMMouseScroll",
            this._mousewheel_callback,
            false
        )

        //Keyboard ******************
        this._key_callback = this.processKey.bind(this)

        canvas.addEventListener("keydown", this._key_callback, true)
        document.addEventListener("keyup", this._key_callback, true) //in document, otherwise it doesn't fire keyup

        //Dropping Stuff over nodes ************************************
        this._ondrop_callback = this.processDrop.bind(this)

        canvas.addEventListener("dragover", this._doNothing, false)
        canvas.addEventListener("dragend", this._doNothing, false)
        canvas.addEventListener("drop", this._ondrop_callback, false)
        canvas.addEventListener("dragenter", this._doReturnTrue, false)

        this._events_binded = true
    }
    /**
     * unbinds mouse events from the canvas
     **/
    unbindEvents(): void {
        if (!this._events_binded) {
            console.warn("LGraphCanvas: no events binded")
            return
        }

        //console.log("pointerevents: unbindEvents");
        const ref_window = this.getCanvasWindow()
        const document = ref_window.document

        this.canvas.removeEventListener("pointerout", this._mouseout_callback)
        LiteGraph.pointerListenerRemove(this.canvas, "move", this._mousemove_callback)
        LiteGraph.pointerListenerRemove(this.canvas, "up", this._mouseup_callback)
        LiteGraph.pointerListenerRemove(this.canvas, "down", this._mousedown_callback)
        this.canvas.removeEventListener(
            "mousewheel",
            this._mousewheel_callback
        )
        this.canvas.removeEventListener(
            "DOMMouseScroll",
            this._mousewheel_callback
        )
        this.canvas.removeEventListener("keydown", this._key_callback)
        document.removeEventListener("keyup", this._key_callback)
        this.canvas.removeEventListener("contextmenu", this._doNothing)
        this.canvas.removeEventListener("drop", this._ondrop_callback)
        this.canvas.removeEventListener("dragenter", this._doReturnTrue)

        this._mousedown_callback = null
        this._mousewheel_callback = null
        this._key_callback = null
        this._ondrop_callback = null

        this._events_binded = false
    }
    /**
     * this function allows to render the canvas using WebGL instead of Canvas2D
     * this is useful if you plant to render 3D objects inside your nodes, it uses litegl.js for webgl and canvas2DtoWebGL to emulate the Canvas2D calls in webGL
     **/
    enableWebGL(): void {
        // TODO: Delete or move all webgl to a module and never load it.
        // @ts-expect-error
        if (typeof GL === "undefined") {
            throw "litegl.js must be included to use a WebGL canvas"
        }
        // @ts-expect-error
        if (typeof enableWebGLCanvas === "undefined") {
            throw "webglCanvas.js must be included to use this feature"
        }

        // @ts-expect-error
        this.gl = this.ctx = enableWebGLCanvas(this.canvas)
        // @ts-expect-error
        this.ctx.webgl = true
        this.bgcanvas = this.canvas
        this.bgctx = this.gl
        // @ts-expect-error
        this.canvas.webgl_enabled = true

        /*
    GL.create({ canvas: this.bgcanvas });
    this.bgctx = enableWebGLCanvas( this.bgcanvas );
    window.gl = this.gl;
    */
    }
    /**
     * marks as dirty the canvas, this way it will be rendered again
     *
     * @class LGraphCanvas
     * @param {bool} fgcanvas if the foreground canvas is dirty (the one containing the nodes)
     * @param {bool} bgcanvas if the background canvas is dirty (the one containing the wires)
     */
    setDirty(fgcanvas: boolean, bgcanvas?: boolean): void {
        if (fgcanvas) this.dirty_canvas = true
        if (bgcanvas) this.dirty_bgcanvas = true
    }
    /**
     * Used to attach the canvas in a popup
     *
     * @return {window} returns the window where the canvas is attached (the DOM root node)
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
        //already rendering
        if (this.is_rendering) return

        this.is_rendering = true
        renderFrame.call(this)

        function renderFrame(this: LGraphCanvas) {
            if (!this.pause_rendering) {
                this.draw()
            }

            const window = this.getCanvasWindow()
            if (this.is_rendering) {
                window.requestAnimationFrame(renderFrame.bind(this))
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
    //used to block future mouse events (because of im gui)
    blockClick(): void {
        this.block_click = true
        this.last_mouseclick = 0
    }

    /**
     * Gets the widget at the current cursor position
     * @param node Optional node to check for widgets under cursor
     * @returns The widget located at the current cursor position or null
     */
    getWidgetAtCursor(node?: LGraphNode): IWidget | null {
        node ??= this.node_over

        if (!node.widgets) return null

        const graphPos = this.graph_mouse
        const x = graphPos[0] - node.pos[0]
        const y = graphPos[1] - node.pos[1]

        for (const widget of node.widgets) {
            if(widget.hidden || (widget.advanced && !node.showAdvanced)) continue;

            let widgetWidth, widgetHeight
            if (widget.computeSize) {
                ([widgetWidth, widgetHeight] = widget.computeSize(node.size[0]))
            } else {
                widgetWidth = (widget).width || node.size[0]
                widgetHeight = LiteGraph.NODE_WIDGET_HEIGHT
            }

            if (
                widget.last_y !== undefined &&
                x >= 6 &&
                x <= widgetWidth - 12 &&
                y >= widget.last_y &&
                y <= widget.last_y + widgetHeight
            ) {
                return widget
            }
        }

        return null
    }

    /**
     * Clears highlight and mouse-over information from nodes that should not have it.
     * 
     * Intended to be called when the pointer moves away from a node.
     * @param {LGraphNode} node The node that the mouse is now over
     * @param {MouseEvent} e MouseEvent that is triggering this
     */
    updateMouseOverNodes(node: LGraphNode, e: CanvasMouseEvent): void {
        const nodes = this.graph._nodes
        const l = nodes.length
        for (let i = 0; i < l; ++i) {
            if (nodes[i].mouseOver && node != nodes[i]) {
                //mouse leave
                nodes[i].mouseOver = null
                this._highlight_input = null
                this._highlight_pos = null
                this.link_over_widget = null

                // Hover transitions
                // TODO: Implement single lerp ease factor for current progress on hover in/out.  In drawNode, multiply by ease factor and differential value (e.g. bg alpha +0.5).
                nodes[i].lostFocusAt = LiteGraph.getTime()

                this.node_over?.onMouseLeave?.(e)
                this.node_over = null
                this.dirty_canvas = true
            }
        }
    }

    processMouseDown(e: CanvasPointerEvent): boolean {

        if (this.set_canvas_dirty_on_mouse_event)
            this.dirty_canvas = true

        if (!this.graph) return

        this.adjustMouseEvent(e)

        const ref_window = this.getCanvasWindow()
        LGraphCanvas.active_canvas = this

        const x = e.clientX
        const y = e.clientY
        this.ds.viewport = this.viewport
        const is_inside = !this.viewport || (this.viewport && x >= this.viewport[0] && x < (this.viewport[0] + this.viewport[2]) && y >= this.viewport[1] && y < (this.viewport[1] + this.viewport[3]))

        //move mouse move event to the window in case it drags outside of the canvas
        if (!this.options.skip_events) {
            LiteGraph.pointerListenerRemove(this.canvas, "move", this._mousemove_callback)
            //catch for the entire window
            LiteGraph.pointerListenerAdd(ref_window.document, "move", this._mousemove_callback, true)
            LiteGraph.pointerListenerAdd(ref_window.document, "up", this._mouseup_callback, true)
        }

        if (!is_inside) return

        let node = this.graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes, 5)
        let skip_action = false
        const now = LiteGraph.getTime()
        const is_primary = (e.isPrimary === undefined || !e.isPrimary)
        const is_double_click = (now - this.last_mouseclick < 300)
        this.mouse[0] = e.clientX
        this.mouse[1] = e.clientY
        this.graph_mouse[0] = e.canvasX
        this.graph_mouse[1] = e.canvasY
        this.last_click_position = [this.mouse[0], this.mouse[1]]

        this.pointer_is_double = this.pointer_is_down && is_primary
        this.pointer_is_down = true

        this.canvas.focus()

        LiteGraph.closeAllContextMenus(ref_window)

        if (this.onMouse?.(e) == true) return

        //left button mouse / single finger
        if (e.which == 1 && !this.pointer_is_double) {
            if ((e.metaKey || e.ctrlKey) && !e.altKey) {
                this.dragging_rectangle = new Float32Array(4)
                this.dragging_rectangle[0] = e.canvasX
                this.dragging_rectangle[1] = e.canvasY
                this.dragging_rectangle[2] = 1
                this.dragging_rectangle[3] = 1
                skip_action = true
            }

            // clone node ALT dragging
            if (LiteGraph.alt_drag_do_clone_nodes && e.altKey && !e.ctrlKey && node && this.allow_interaction && !skip_action && !this.read_only) {
                const node_data = node.clone()?.serialize()
                const cloned = LiteGraph.createNode(node_data.type)
                if (cloned) {
                    cloned.configure(node_data)
                    cloned.pos[0] += 5
                    cloned.pos[1] += 5

                    this.graph.add(cloned, false)
                    node = cloned
                    skip_action = true
                    if (this.allow_dragnodes) {
                        this.graph.beforeChange()
                        this.node_dragged = node
                        this.isDragging = true
                    }
                    if (!this.selected_nodes[node.id]) {
                        this.processNodeSelected(node, e)
                    }
                }
            }

            let clicking_canvas_bg = false

            //when clicked on top of a node
            //and it is not interactive
            if (node && (this.allow_interaction || node.flags.allow_interaction) && !skip_action && !this.read_only) {
                //if it wasn't selected?
                if (!this.live_mode && !node.flags.pinned) {
                    this.bringToFront(node)
                }

                //not dragging mouse to connect two slots
                if (this.allow_interaction && !this.connecting_links && !node.flags.collapsed && !this.live_mode) {
                    //Search for corner for resize
                    if (!skip_action &&
                        node.resizable !== false && node.inResizeCorner(e.canvasX, e.canvasY)) {
                        this.graph.beforeChange()
                        this.resizing_node = node
                        this.canvas.style.cursor = "se-resize"
                        skip_action = true
                    } else {
                        //search for outputs
                        if (node.outputs) {
                            for (let i = 0, l = node.outputs.length; i < l; ++i) {
                                const output = node.outputs[i]
                                const link_pos = node.getConnectionPos(false, i)
                                if (isInsideRectangle(
                                    e.canvasX,
                                    e.canvasY,
                                    link_pos[0] - 15,
                                    link_pos[1] - 10,
                                    30,
                                    20
                                )) {
                                    // Drag multiple output links
                                    if (e.shiftKey) {
                                        if (output.links?.length > 0) {

                                            this.connecting_links = []
                                            for (const linkId of output.links) {
                                                const link = this.graph.links[linkId]
                                                const slot = link.target_slot
                                                const linked_node = this.graph._nodes_by_id[link.target_id]
                                                const input = linked_node.inputs[slot]
                                                const pos = linked_node.getConnectionPos(true, slot)

                                                this.connecting_links.push({
                                                    node: linked_node,
                                                    slot: slot,
                                                    input: input,
                                                    output: null,
                                                    pos: pos,
                                                    direction: node.horizontal !== true ? LinkDirection.RIGHT : LinkDirection.CENTER,
                                                })
                                            }

                                            skip_action = true
                                            break
                                        }
                                    }

                                    output.slot_index = i
                                    this.connecting_links = [
                                        {
                                            node: node,
                                            slot: i,
                                            input: null,
                                            output: output,
                                            pos: link_pos,
                                        }
                                    ]

                                    if (LiteGraph.shift_click_do_break_link_from) {
                                        if (e.shiftKey) {
                                            node.disconnectOutput(i)
                                        }
                                    } else if (LiteGraph.ctrl_alt_click_do_break_link) {
                                        if (e.ctrlKey && e.altKey && !e.shiftKey) {
                                            node.disconnectOutput(i)
                                        }
                                    }

                                    if (is_double_click) {
                                        node.onOutputDblClick?.(i, e)
                                    } else {
                                        node.onOutputClick?.(i, e)
                                    }

                                    skip_action = true
                                    break
                                }
                            }
                        }

                        //search for inputs
                        if (node.inputs) {
                            for (let i = 0, l = node.inputs.length; i < l; ++i) {
                                const input = node.inputs[i]
                                const link_pos = node.getConnectionPos(true, i)
                                if (isInsideRectangle(
                                    e.canvasX,
                                    e.canvasY,
                                    link_pos[0] - 15,
                                    link_pos[1] - 10,
                                    30,
                                    20
                                )) {
                                    if (is_double_click) {
                                        node.onInputDblClick?.(i, e)
                                    } else {
                                        node.onInputClick?.(i, e)
                                    }

                                    if (input.link !== null) {
                                        //before disconnecting
                                        const link_info = this.graph.links[input.link]
                                        const slot = link_info.origin_slot
                                        const linked_node = this.graph._nodes_by_id[link_info.origin_id]
                                        if (LiteGraph.click_do_break_link_to || (LiteGraph.ctrl_alt_click_do_break_link && e.ctrlKey && e.altKey && !e.shiftKey)) {
                                            node.disconnectInput(i)
                                        } else if (e.shiftKey) {
                                            this.connecting_links = [{
                                                node: linked_node,
                                                slot,
                                                output: linked_node.outputs[slot],
                                                pos: linked_node.getConnectionPos(false, slot),
                                            }]

                                            this.dirty_bgcanvas = true
                                            skip_action = true
                                        } else if (this.allow_reconnect_links) {
                                            if (!LiteGraph.click_do_break_link_to) {
                                                node.disconnectInput(i)
                                            }
                                            this.connecting_links = [
                                                {
                                                    node: linked_node,
                                                    slot: slot,
                                                    input: null,
                                                    output: linked_node.outputs[slot],
                                                    pos: linked_node.getConnectionPos(false, slot),
                                                }
                                            ]

                                            this.dirty_bgcanvas = true
                                            skip_action = true
                                        } else {
                                            // do same action as has not node ?
                                        }

                                    } else {
                                        // has not node
                                    }

                                    if (!skip_action) {
                                        // connect from in to out, from to to from
                                        this.connecting_links = [
                                            {
                                                node: node,
                                                slot: i,
                                                input: input,
                                                output: null,
                                                pos: link_pos,
                                            }
                                        ]

                                        this.dirty_bgcanvas = true
                                        skip_action = true
                                    }

                                    break
                                }
                            }
                        }
                    }
                }

                //it wasn't clicked on the links boxes
                if (!skip_action) {
                    let block_drag_node = node?.pinned ? true : false
                    const pos: Point = [e.canvasX - node.pos[0], e.canvasY - node.pos[1]]

                    //widgets
                    const widget = this.processNodeWidgets(node, this.graph_mouse, e)
                    if (widget) {
                        block_drag_node = true
                        this.node_widget = [node, widget]
                    }

                    //double clicking
                    if (this.allow_interaction && is_double_click && this.selected_nodes[node.id]) {
                        // Check if it's a double click on the title bar
                        // Note: pos[1] is the y-coordinate of the node's body
                        // If clicking on node header (title), pos[1] is negative
                        if (pos[1] < 0) {
                            node.onNodeTitleDblClick?.(e, pos, this)
                        }
                        //double click node
                        node.onDblClick?.(e, pos, this)
                        this.processNodeDblClicked(node)
                        block_drag_node = true
                    }

                    //if do not capture mouse
                    if (node.onMouseDown?.(e, pos, this)) {
                        block_drag_node = true
                    } else {
                        //open subgraph button
                        if (node.subgraph && !node.skip_subgraph_button) {
                            if (!node.flags.collapsed && pos[0] > node.size[0] - LiteGraph.NODE_TITLE_HEIGHT && pos[1] < 0) {
                                const that = this
                                setTimeout(function () {
                                    that.openSubgraph(node.subgraph)
                                }, 10)
                            }
                        }

                        if (this.live_mode) {
                            clicking_canvas_bg = true
                            block_drag_node = true
                        }
                    }

                    if (!block_drag_node) {
                        if (this.allow_dragnodes) {
                            this.graph.beforeChange()
                            this.node_dragged = node
                            this.isDragging = true
                        }
                        // Account for shift + click + drag
                        if (!(e.shiftKey && !e.ctrlKey && !e.altKey) || !node.is_selected) {
                            this.processNodeSelected(node, e)
                        }
                    } else { // double-click
                        /**
                         * Don't call the function if the block is already selected.
                         * Otherwise, it could cause the block to be unselected while its panel is open.
                         */
                        if (!node.is_selected) this.processNodeSelected(node, e)
                    }

                    this.dirty_canvas = true
                }
            } //clicked outside of nodes
            else {
                if (!skip_action) {
                    //search for link connector
                    if (!this.read_only) {
                        // Set the width of the line for isPointInStroke checks
                        const lineWidth = this.ctx.lineWidth
                        this.ctx.lineWidth = this.connections_width + 7
                        for (let i = 0; i < this.visible_links.length; ++i) {
                            const link = this.visible_links[i]
                            const center = link._pos
                            let overLink: LLink = null
                            if (!center ||
                                e.canvasX < center[0] - 4 ||
                                e.canvasX > center[0] + 4 ||
                                e.canvasY < center[1] - 4 ||
                                e.canvasY > center[1] + 4) {
                                // If we shift click on a link then start a link from that input
                                if (e.shiftKey && link.path && this.ctx.isPointInStroke(link.path, e.canvasX, e.canvasY)) {
                                    overLink = link
                                } else {
                                    continue
                                }
                            }
                            if (overLink) {
                                const slot = overLink.origin_slot
                                const originNode = this.graph._nodes_by_id[overLink.origin_id]

                                this.connecting_links ??= []
                                this.connecting_links.push({
                                    node: originNode,
                                    slot,
                                    output: originNode.outputs[slot],
                                    pos: originNode.getConnectionPos(false, slot),
                                })
                                skip_action = true
                            } else {
                                //link clicked
                                this.showLinkMenu(link, e)
                                this.over_link_center = null //clear tooltip
                            }
                            break
                        }

                        // Restore line width
                        this.ctx.lineWidth = lineWidth
                    }

                    this.selected_group = this.graph.getGroupOnPos(e.canvasX, e.canvasY)
                    this.selected_group_resizing = false

                    const group = this.selected_group
                    if (this.selected_group && !this.read_only) {
                        if (e.ctrlKey) {
                            this.dragging_rectangle = null
                        }

                        const dist = distance([e.canvasX, e.canvasY], [this.selected_group.pos[0] + this.selected_group.size[0], this.selected_group.pos[1] + this.selected_group.size[1]])
                        if (dist * this.ds.scale < 10) {
                            this.selected_group_resizing = true
                        } else {
                            const f = group.font_size || LiteGraph.DEFAULT_GROUP_FONT_SIZE
                            const headerHeight = f * 1.4
                            if (isInsideRectangle(e.canvasX, e.canvasY, group.pos[0], group.pos[1], group.size[0], headerHeight)) {
                                this.selected_group.recomputeInsideNodes()
                                if (!e.shiftKey && !e.ctrlKey && !e.metaKey) this.deselectAllNodes()
                                this.selectedGroups ??= new Set()
                                this.selectedGroups.add(group)
                                group.selected = true

                                this.isDragging = true
                                skip_action = true
                            }
                        }

                        if (is_double_click) {
                            this.emitEvent({
                                subType: "group-double-click",
                                originalEvent: e,
                                group: this.selected_group,
                            })
                        }
                    } else if (is_double_click && !this.read_only) {
                        // Double click within group should not trigger the searchbox.
                        if (this.allow_searchbox) {
                            this.showSearchBox(e)
                            e.preventDefault()
                            e.stopPropagation()
                        }
                        this.emitEvent({
                            subType: "empty-double-click",
                            originalEvent: e,
                        })
                    }

                    clicking_canvas_bg = true
                }
            }

            if (!skip_action && clicking_canvas_bg && this.allow_dragcanvas) {
                this.dragging_canvas = true
            }

        } else if (e.which == 2) {
            //middle button
            if (LiteGraph.middle_click_slot_add_default_node) {
                if (node && this.allow_interaction && !skip_action && !this.read_only) {
                    //not dragging mouse to connect two slots
                    if (!this.connecting_links &&
                        !node.flags.collapsed &&
                        !this.live_mode) {
                        let mClikSlot: INodeSlot | false = false
                        let mClikSlot_index: number | false = false
                        let mClikSlot_isOut: boolean = false
                        //search for outputs
                        if (node.outputs) {
                            for (let i = 0, l = node.outputs.length; i < l; ++i) {
                                const output = node.outputs[i]
                                const link_pos = node.getConnectionPos(false, i)
                                if (isInsideRectangle(e.canvasX, e.canvasY, link_pos[0] - 15, link_pos[1] - 10, 30, 20)) {
                                    mClikSlot = output
                                    mClikSlot_index = i
                                    mClikSlot_isOut = true
                                    break
                                }
                            }
                        }

                        //search for inputs
                        if (node.inputs) {
                            for (let i = 0, l = node.inputs.length; i < l; ++i) {
                                const input = node.inputs[i]
                                const link_pos = node.getConnectionPos(true, i)
                                if (isInsideRectangle(e.canvasX, e.canvasY, link_pos[0] - 15, link_pos[1] - 10, 30, 20)) {
                                    mClikSlot = input
                                    mClikSlot_index = i
                                    mClikSlot_isOut = false
                                    break
                                }
                            }
                        }
                        // Middle clicked a slot
                        if (mClikSlot && mClikSlot_index !== false) {

                            const alphaPosY = 0.5 - ((mClikSlot_index + 1) / ((mClikSlot_isOut ? node.outputs.length : node.inputs.length)))
                            const node_bounding = node.getBounding()
                            // estimate a position: this is a bad semi-bad-working mess .. REFACTOR with a correct autoplacement that knows about the others slots and nodes
                            const posRef: Point = [
                                (!mClikSlot_isOut ? node_bounding[0] : node_bounding[0] + node_bounding[2]),
                                e.canvasY - 80
                            ]
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            const nodeCreated = this.createDefaultNodeForSlot({
                                nodeFrom: !mClikSlot_isOut ? null : node,
                                slotFrom: !mClikSlot_isOut ? null : mClikSlot_index,
                                nodeTo: !mClikSlot_isOut ? node : null,
                                slotTo: !mClikSlot_isOut ? mClikSlot_index : null,
                                position: posRef,
                                nodeType: "AUTO",
                                posAdd: [!mClikSlot_isOut ? -30 : 30, -alphaPosY * 130],
                                posSizeFix: [!mClikSlot_isOut ? -1 : 0, 0]
                            })
                            skip_action = true
                        }
                    }
                }
            }

            // Drag canvas using middle mouse button
            if (!skip_action && this.allow_dragcanvas) {
                this.dragging_canvas = true
            }

        } else if (e.which == 3 || this.pointer_is_double) {

            //right button
            if (this.allow_interaction && !skip_action && !this.read_only) {

                // is it hover a node ?
                if (node) {
                    if (Object.keys(this.selected_nodes).length
                        && (this.selected_nodes[node.id] || e.shiftKey || e.ctrlKey || e.metaKey)) {
                        // is multiselected or using shift to include the now node
                        if (!this.selected_nodes[node.id]) this.selectNodes([node], true) // add this if not present
                    } else {
                        // update selection
                        this.selectNodes([node])
                    }
                }

                // Show context menu for the node or group under the pointer
                this.processContextMenu(node, e)
            }

        }

        this.last_mouse[0] = e.clientX
        this.last_mouse[1] = e.clientY
        this.last_mouseclick = LiteGraph.getTime()
        this.last_mouse_dragging = true

        this.graph.change()

        //this is to ensure to defocus(blur) if a text input element is on focus
        if (!ref_window.document.activeElement ||
            (ref_window.document.activeElement.nodeName.toLowerCase() != "input" &&
                ref_window.document.activeElement.nodeName.toLowerCase() != "textarea")) {
            e.preventDefault()
        }
        e.stopPropagation()

        this.onMouseDown?.(e)

        return false
    }
    /**
     * Called when a mouse move event has to be processed
     **/
    processMouseMove(e: CanvasMouseEvent): boolean {
        if (this.autoresize) this.resize()

        if (this.set_canvas_dirty_on_mouse_event)
            this.dirty_canvas = true

        if (!this.graph) return

        LGraphCanvas.active_canvas = this
        this.adjustMouseEvent(e)
        const mouse: Point = [e.clientX, e.clientY]
        this.mouse[0] = mouse[0]
        this.mouse[1] = mouse[1]
        const delta = [
            mouse[0] - this.last_mouse[0],
            mouse[1] - this.last_mouse[1]
        ]
        this.last_mouse = mouse
        this.graph_mouse[0] = e.canvasX
        this.graph_mouse[1] = e.canvasY

        if (this.block_click) {
            e.preventDefault()
            return false
        }

        e.dragging = this.last_mouse_dragging

        if (this.node_widget) {
            this.processNodeWidgets(
                this.node_widget[0],
                this.graph_mouse,
                e,
                this.node_widget[1]
            )
            this.dirty_canvas = true
        }

        //get node over
        const node = this.graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes)

        if (this.dragging_rectangle) {
            this.dragging_rectangle[2] = e.canvasX - this.dragging_rectangle[0]
            this.dragging_rectangle[3] = e.canvasY - this.dragging_rectangle[1]
            this.dirty_canvas = true
        }
        else if (this.selected_group_resizing && !this.read_only) {
            //moving/resizing a group
            this.selected_group.resize(
                e.canvasX - this.selected_group.pos[0],
                e.canvasY - this.selected_group.pos[1]
            )
            this.dirty_bgcanvas = true
        } else if (this.dragging_canvas) {
            this.ds.offset[0] += delta[0] / this.ds.scale
            this.ds.offset[1] += delta[1] / this.ds.scale
            this.dirty_canvas = true
            this.dirty_bgcanvas = true
        } else if ((this.allow_interaction || (node && node.flags.allow_interaction)) && !this.read_only) {
            if (this.connecting_links) this.dirty_canvas = true

            //remove mouseover flag
            this.updateMouseOverNodes(node, e)

            //mouse over a node
            if (node) {

                if (node.redraw_on_mouse)
                    this.dirty_canvas = true

                // For input/output hovering
                //to store the output of isOverNodeInput
                const pos: Point = [0, 0]
                const inputId = this.isOverNodeInput(node, e.canvasX, e.canvasY, pos)
                const outputId = this.isOverNodeOutput(node, e.canvasX, e.canvasY, pos)
                const overWidget = this.getWidgetAtCursor(node)

                if (!node.mouseOver) {
                    //mouse enter
                    node.mouseOver = {
                        inputId: null,
                        outputId: null,
                        overWidget: null,
                    }
                    this.node_over = node
                    this.dirty_canvas = true

                    node.onMouseEnter?.(e)
                }

                //in case the node wants to do something
                node.onMouseMove?.(e, [e.canvasX - node.pos[0], e.canvasY - node.pos[1]], this)

                // The input the mouse is over has changed
                if (node.mouseOver.inputId !== inputId || node.mouseOver.outputId !== outputId || node.mouseOver.overWidget !== overWidget) {
                    node.mouseOver.inputId = inputId
                    node.mouseOver.outputId = outputId
                    node.mouseOver.overWidget = overWidget

                    // Check if link is over anything it could connect to - record position of valid target for snap / highlight
                    if (this.connecting_links) {
                        const firstLink = this.connecting_links[0]

                        // Default: nothing highlighted
                        let highlightPos: Point = null
                        let highlightInput: INodeInputSlot = null
                        let linkOverWidget: IWidget = null

                        if (firstLink.node === node) {
                            // Cannot connect link from a node to itself
                        } else if (firstLink.output) {

                            // Connecting from an output to an input

                            if (inputId === -1 && outputId === -1) {
                                // Allow support for linking to widgets, handled externally to LiteGraph
                                if (this.getWidgetLinkType && overWidget) {
                                    const widgetLinkType = this.getWidgetLinkType(overWidget, node)
                                    if (widgetLinkType && LiteGraph.isValidConnection(firstLink.output.type, widgetLinkType)) {
                                        if (firstLink.node.isValidWidgetLink?.(firstLink.output.slot_index, node, overWidget) !== false) {
                                            linkOverWidget = overWidget
                                            this.link_over_widget_type = widgetLinkType
                                        }
                                    }
                                }
                                // Node background / title under the pointer
                                if (!linkOverWidget) {
                                    const targetSlotId = firstLink.node.findConnectByTypeSlot(true, node, firstLink.output.type)
                                    if (targetSlotId !== null && targetSlotId >= 0) {
                                        node.getConnectionPos(true, targetSlotId, pos)
                                        highlightPos = pos
                                        highlightInput = node.inputs[targetSlotId]
                                    }
                                }
                            } else if (this.isOverNodeBox(node, e.canvasX, e.canvasY)) {
                                //mouse on top of the corner box, don't know what to do
                            } else {
                                //check if I have a slot below de mouse
                                if (inputId != -1 && node.inputs[inputId] && LiteGraph.isValidConnection(firstLink.output.type, node.inputs[inputId].type)) {
                                    highlightPos = pos
                                    highlightInput = node.inputs[inputId] // XXX CHECK THIS
                                }
                            }

                        } else if (firstLink.input) {

                            // Connecting from an input to an output
                            if (inputId === -1 && outputId === -1) {
                                const targetSlotId = firstLink.node.findConnectByTypeSlot(false, node, firstLink.input.type)
                                if (targetSlotId !== null && targetSlotId >= 0) {
                                    node.getConnectionPos(false, targetSlotId, pos)
                                    highlightPos = pos
                                }
                            } else if (this.isOverNodeBox(node, e.canvasX, e.canvasY)) {
                                //mouse on top of the corner box, don't know what to do
                            } else {
                                //check if I have a slot below de mouse
                                if (outputId != -1 && node.outputs[outputId] && LiteGraph.isValidConnection(firstLink.input.type, node.outputs[outputId].type)) {
                                    highlightPos = pos
                                }
                            }
                        }
                        this._highlight_pos = highlightPos
                        this._highlight_input = highlightInput
                        this.link_over_widget = linkOverWidget
                    }

                    this.dirty_canvas = true
                }

                //Search for corner
                if (this.canvas) {
                    this.canvas.style.cursor = node.inResizeCorner(e.canvasX, e.canvasY)
                        ? "se-resize"
                        : "crosshair"
                }
            } else { //not over a node
                //search for link connector
                let over_link: LLink = null
                for (let i = 0; i < this.visible_links.length; ++i) {
                    const link = this.visible_links[i]
                    const center = link._pos
                    if (!center ||
                        e.canvasX < center[0] - 4 ||
                        e.canvasX > center[0] + 4 ||
                        e.canvasY < center[1] - 4 ||
                        e.canvasY > center[1] + 4) {
                        continue
                    }
                    over_link = link
                    break
                }
                if (over_link != this.over_link_center) {
                    this.over_link_center = over_link
                    this.dirty_canvas = true
                }

                if (this.canvas) {
                    this.canvas.style.cursor = ""
                }
            } //end

            //send event to node if capturing input (used with widgets that allow drag outside of the area of the node)
            if (this.node_capturing_input && this.node_capturing_input != node) {
                this.node_capturing_input.onMouseMove?.(e, [e.canvasX - this.node_capturing_input.pos[0], e.canvasY - this.node_capturing_input.pos[1]], this)
            }

            //node being dragged
            if (this.isDragging && !this.live_mode) {
                //console.log("draggin!",this.selected_nodes);
                const nodes = new Set<LGraphNode>()
                const deltax = delta[0] / this.ds.scale
                const deltay = delta[1] / this.ds.scale
                for (const i in this.selected_nodes) {
                    const n = this.selected_nodes[i]
                    nodes.add(n)
                    n.pos[0] += delta[0] / this.ds.scale
                    n.pos[1] += delta[1] / this.ds.scale
                    /*
                     * Don't call the function if the block is already selected.
                     * Otherwise, it could cause the block to be unselected while dragging.
                     */
                    if (!n.is_selected) this.processNodeSelected(n, e)

                }

                if (this.selectedGroups) {
                    for (const group of this.selectedGroups) {
                        group.move(deltax, deltay, true)
                        if (!e.ctrlKey) {
                            for (const node of group._nodes) {
                                if (!nodes.has(node)) {
                                    node.pos[0] += deltax
                                    node.pos[1] += deltay
                                }
                            }
                        }
                    }
                }

                this.dirty_canvas = true
                this.dirty_bgcanvas = true
            }

            if (this.resizing_node && !this.live_mode) {
                //convert mouse to node space
                const desired_size: Size = [e.canvasX - this.resizing_node.pos[0], e.canvasY - this.resizing_node.pos[1]]
                const min_size = this.resizing_node.computeSize()
                desired_size[0] = Math.max(min_size[0], desired_size[0])
                desired_size[1] = Math.max(min_size[1], desired_size[1])
                this.resizing_node.setSize(desired_size)

                this.canvas.style.cursor = "se-resize"
                this.dirty_canvas = true
                this.dirty_bgcanvas = true
            }
        }

        e.preventDefault()
        return false
    }
    /**
     * Called when a mouse up event has to be processed
     **/
    processMouseUp(e: CanvasPointerEvent): boolean {
        //early exit for extra pointer
        if (e.isPrimary === false) return false
        if (!this.graph) return

        const window = this.getCanvasWindow()
        const document = window.document
        LGraphCanvas.active_canvas = this

        //restore the mousemove event back to the canvas
        if (!this.options.skip_events) {
            LiteGraph.pointerListenerRemove(document, "move", this._mousemove_callback, true)
            LiteGraph.pointerListenerAdd(this.canvas, "move", this._mousemove_callback, true)
            LiteGraph.pointerListenerRemove(document, "up", this._mouseup_callback, true)
        }

        this.adjustMouseEvent(e)
        const now = LiteGraph.getTime()
        e.click_time = now - this.last_mouseclick
        this.last_mouse_dragging = false
        this.last_click_position = null

        //used to avoid sending twice a click in an immediate button
        this.block_click &&= false

        if (e.which == 1) {

            if (this.node_widget) {
                this.processNodeWidgets(this.node_widget[0], this.graph_mouse, e)
            }

            //left button
            this.node_widget = null

            if (this.selected_group) {
                const diffx = this.selected_group.pos[0] -
                    Math.round(this.selected_group.pos[0])
                const diffy = this.selected_group.pos[1] -
                    Math.round(this.selected_group.pos[1])
                this.selected_group.move(diffx, diffy, e.ctrlKey)
                this.selected_group.pos[0] = Math.round(
                    this.selected_group.pos[0]
                )
                this.selected_group.pos[1] = Math.round(
                    this.selected_group.pos[1]
                )
                if (this.selected_group._nodes.length) {
                    this.dirty_canvas = true
                }
                this.selected_group = null
            }
            this.selected_group_resizing = false
            this.isDragging = false

            let node = this.graph.getNodeOnPos(
                e.canvasX,
                e.canvasY,
                this.visible_nodes
            )

            if (this.dragging_rectangle) {
                if (this.graph) {
                    const nodes = this.graph._nodes
                    const node_bounding = new Float32Array(4)

                    //compute bounding and flip if left to right
                    const w = Math.abs(this.dragging_rectangle[2])
                    const h = Math.abs(this.dragging_rectangle[3])
                    const startx = this.dragging_rectangle[2] < 0
                        ? this.dragging_rectangle[0] - w
                        : this.dragging_rectangle[0]
                    const starty = this.dragging_rectangle[3] < 0
                        ? this.dragging_rectangle[1] - h
                        : this.dragging_rectangle[1]
                    this.dragging_rectangle[0] = startx
                    this.dragging_rectangle[1] = starty
                    this.dragging_rectangle[2] = w
                    this.dragging_rectangle[3] = h

                    // test dragging rect size, if minimun simulate a click
                    if (!node || (w > 10 && h > 10)) {
                        //test against all nodes (not visible because the rectangle maybe start outside
                        const to_select = []
                        for (let i = 0; i < nodes.length; ++i) {
                            const nodeX = nodes[i]
                            nodeX.getBounding(node_bounding)
                            if (!overlapBounding(
                                this.dragging_rectangle,
                                node_bounding
                            )) {
                                continue
                            } //out of the visible area
                            to_select.push(nodeX)
                        }
                        if (to_select.length) {
                            this.selectNodes(to_select, e.shiftKey) // add to selection with shift
                        }

                        // Select groups
                        if (!e.shiftKey) this.deselectGroups()
                        this.selectedGroups ??= new Set()

                        const groups = this.graph.groups
                        for (const group of groups) {
                            const r = this.dragging_rectangle
                            const pos = group.pos
                            const size = group.size
                            if (!isInsideRectangle(pos[0], pos[1], r[0], r[1], r[2], r[3]) || !isInsideRectangle(pos[0] + size[0], pos[1] + size[1], r[0], r[1], r[2], r[3])) continue
                            this.selectedGroups.add(group)
                            group.recomputeInsideNodes()
                            group.selected = true
                        }
                    } else {
                        // will select of update selection
                        this.selectNodes([node], e.shiftKey || e.ctrlKey || e.metaKey) // add to selection add to selection with ctrlKey or shiftKey
                    }

                }
                this.dragging_rectangle = null
            } else if (this.connecting_links) {

                //node below mouse
                if (node) {
                    for (const link of this.connecting_links) {

                        //dragging a connection
                        this.dirty_canvas = true
                        this.dirty_bgcanvas = true

                        //slot below mouse? connect
                        if (link.output) {

                            const slot = this.isOverNodeInput(
                                node,
                                e.canvasX,
                                e.canvasY
                            )
                            if (slot != -1) {
                                link.node.connect(link.slot, node, slot)
                            } else if (this.link_over_widget) {
                                this.emitEvent({
                                    subType: "connectingWidgetLink",
                                    link,
                                    node,
                                    widget: this.link_over_widget
                                })
                                this.link_over_widget = null
                            } else {
                                //not on top of an input
                                // look for a good slot
                                link.node.connectByType(link.slot, node, link.output.type)
                            }
                        } else if (link.input) {
                            const slot = this.isOverNodeOutput(
                                node,
                                e.canvasX,
                                e.canvasY
                            )

                            if (slot != -1) {
                                node.connect(slot, link.node, link.slot) // this is inverted has output-input nature like
                            } else {
                                //not on top of an input
                                // look for a good slot
                                link.node.connectByTypeOutput(link.slot, node, link.input.type)
                            }
                        }
                    }
                } else {
                    const firstLink = this.connecting_links[0]
                    const linkReleaseContext = firstLink.output ? {
                        node_from: firstLink.node,
                        slot_from: firstLink.output,
                        type_filter_in: firstLink.output.type
                    } : {
                        node_to: firstLink.node,
                        slot_from: firstLink.input,
                        type_filter_out: firstLink.input.type
                    }
                    // For external event only.
                    const linkReleaseContextExtended: LinkReleaseContextExtended = {
                        links: this.connecting_links,
                    }
                    this.emitEvent({
                        subType: "empty-release",
                        originalEvent: e,
                        linkReleaseContext: linkReleaseContextExtended,
                    })
                    // add menu when releasing link in empty space
                    if (LiteGraph.release_link_on_empty_shows_menu) {
                        if (e.shiftKey) {
                            if (this.allow_searchbox) {
                                this.showSearchBox(e, linkReleaseContext)
                            }
                        } else {
                            if (firstLink.output) {
                                this.showConnectionMenu({ nodeFrom: firstLink.node, slotFrom: firstLink.output, e: e })
                            } else if (firstLink.input) {
                                this.showConnectionMenu({ nodeTo: firstLink.node, slotTo: firstLink.input, e: e })
                            }
                        }
                    }
                }

                this.connecting_links = null
            } //not dragging connection
            else if (this.resizing_node) {
                this.dirty_canvas = true
                this.dirty_bgcanvas = true
                this.graph.afterChange(this.resizing_node)
                this.resizing_node = null
            } else if (this.node_dragged) {
                //node being dragged?
                node = this.node_dragged
                if (node &&
                    e.click_time < 300 &&
                    isInsideRectangle(e.canvasX, e.canvasY, node.pos[0], node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT, LiteGraph.NODE_TITLE_HEIGHT, LiteGraph.NODE_TITLE_HEIGHT)) {
                    node.collapse()
                }

                this.dirty_canvas = true
                this.dirty_bgcanvas = true
                this.node_dragged.pos[0] = Math.round(this.node_dragged.pos[0])
                this.node_dragged.pos[1] = Math.round(this.node_dragged.pos[1])
                if (this.graph.config.align_to_grid || this.align_to_grid) {
                    this.node_dragged.alignToGrid()
                }
                this.onNodeMoved?.(this.node_dragged)
                this.graph.afterChange(this.node_dragged)
                this.node_dragged = null
            } //no node being dragged
            else {
                //get node over
                node = this.graph.getNodeOnPos(
                    e.canvasX,
                    e.canvasY,
                    this.visible_nodes
                )

                if (!node && e.click_time < 300 && !this.graph.groups.some(x => x.isPointInTitlebar(e.canvasX, e.canvasY))) {
                    this.deselectAllNodes()
                }

                this.dirty_canvas = true
                this.dragging_canvas = false

                // @ts-expect-error Unused param
                this.node_over?.onMouseUp?.(e, [e.canvasX - this.node_over.pos[0], e.canvasY - this.node_over.pos[1]], this)
                this.node_capturing_input?.onMouseUp?.(e, [
                    e.canvasX - this.node_capturing_input.pos[0],
                    e.canvasY - this.node_capturing_input.pos[1]
                ])
            }
        } else if (e.which == 2) {
            //middle button
            this.dirty_canvas = true
            this.dragging_canvas = false
        } else if (e.which == 3) {
            //right button
            this.dirty_canvas = true
            this.dragging_canvas = false
        }

        this.pointer_is_down = false
        this.pointer_is_double = false

        this.graph.change()

        e.stopPropagation()
        e.preventDefault()
        return false
    }

    /**
     * Called when the mouse moves off the canvas.  Clears all node hover states.
     * @param e
     */
    processMouseOut(e: CanvasMouseEvent): void {
        // TODO: Check if document.contains(e.relatedTarget) - handle mouseover node textarea etc.
        this.updateMouseOverNodes(null, e)
    }

    /**
     * Called when a mouse wheel event has to be processed
     **/
    processMouseWheel(e: CanvasWheelEvent): boolean {
        if (!this.graph || !this.allow_dragcanvas) return

        // TODO: Mouse wheel zoom rewrite
        // @ts-expect-error
        const delta = e.wheelDeltaY ?? e.detail * -60

        this.adjustMouseEvent(e)

        const pos: Point = [e.clientX, e.clientY]
        if (this.viewport && !isPointInRectangle(pos, this.viewport)) return

        let scale = this.ds.scale

        if (delta > 0) scale *= this.zoom_speed
        else if (delta < 0) scale *= 1 / this.zoom_speed

        this.ds.changeScale(scale, [e.clientX, e.clientY])

        this.graph.change()

        e.preventDefault()
        return false
    }
    /**
     * returns true if a position (in graph space) is on top of a node little corner box
     **/
    isOverNodeBox(node: LGraphNode, canvasx: number, canvasy: number): boolean {
        const title_height = LiteGraph.NODE_TITLE_HEIGHT
        return Boolean(isInsideRectangle(
            canvasx,
            canvasy,
            node.pos[0] + 2,
            node.pos[1] + 2 - title_height,
            title_height - 4,
            title_height - 4
        ))
    }
    /**
     * returns the INDEX if a position (in graph space) is on top of a node input slot
     **/
    isOverNodeInput(node: LGraphNode, canvasx: number, canvasy: number, slot_pos?: Point): number {
        if (node.inputs) {
            for (let i = 0, l = node.inputs.length; i < l; ++i) {
                const input = node.inputs[i]
                const link_pos = node.getConnectionPos(true, i)
                let is_inside = false
                if (node.horizontal) {
                    is_inside = isInsideRectangle(
                        canvasx,
                        canvasy,
                        link_pos[0] - 5,
                        link_pos[1] - 10,
                        10,
                        20
                    )
                } else {
                    // TODO: Find a cheap way to measure text, and do it on node label change instead of here
                    // Input icon width + text approximation
                    const width = 20 + (((input.label?.length ?? input.name?.length) || 3) * 7)
                    is_inside = isInsideRectangle(
                        canvasx,
                        canvasy,
                        link_pos[0] - 10,
                        link_pos[1] - 10,
                        width,
                        20
                    )
                }
                if (is_inside) {
                    if (slot_pos) {
                        slot_pos[0] = link_pos[0]
                        slot_pos[1] = link_pos[1]
                    }
                    return i
                }
            }
        }
        return -1
    }
    /**
     * returns the INDEX if a position (in graph space) is on top of a node output slot
     **/
    isOverNodeOutput(node: LGraphNode, canvasx: number, canvasy: number, slot_pos?: Point): number {
        if (node.outputs) {
            for (let i = 0, l = node.outputs.length; i < l; ++i) {
                const link_pos = node.getConnectionPos(false, i)
                let is_inside = false
                if (node.horizontal) {
                    is_inside = isInsideRectangle(
                        canvasx,
                        canvasy,
                        link_pos[0] - 5,
                        link_pos[1] - 10,
                        10,
                        20
                    )
                } else {
                    is_inside = isInsideRectangle(
                        canvasx,
                        canvasy,
                        link_pos[0] - 10,
                        link_pos[1] - 10,
                        40,
                        20
                    )
                }
                if (is_inside) {
                    if (slot_pos) {
                        slot_pos[0] = link_pos[0]
                        slot_pos[1] = link_pos[1]
                    }
                    return i
                }
            }
        }
        return -1
    }
    /**
     * process a key event
     **/
    processKey(e: KeyboardEvent): boolean | null {
        if (!this.graph) return

        let block_default = false
        //console.log(e); //debug
        // @ts-expect-error
        if (e.target.localName == "input") return

        if (e.type == "keydown") {
            // TODO: Switch
            if (e.keyCode == 32) {
                // space
                this.read_only = true
                if (this._previously_dragging_canvas === null) {
                    this._previously_dragging_canvas = this.dragging_canvas
                }
                this.dragging_canvas = this.pointer_is_down
                block_default = true
            }

            else if (e.keyCode == 27) {
                //esc
                this.node_panel?.close()
                this.options_panel?.close()
                block_default = true
            }

            //select all Control A
            else if (e.keyCode == 65 && e.ctrlKey) {
                this.selectNodes()
                block_default = true
            }

            else if ((e.keyCode === 67) && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                //copy
                if (this.selected_nodes) {
                    this.copyToClipboard()
                    block_default = true
                }
            }

            else if ((e.keyCode === 86) && (e.metaKey || e.ctrlKey)) {
                //paste
                this.pasteFromClipboard(e.shiftKey)
            }

            //delete or backspace
            else if (e.keyCode == 46 || e.keyCode == 8) {
                // @ts-expect-error
                if (e.target.localName != "input" && e.target.localName != "textarea") {
                    this.deleteSelectedNodes()
                    block_default = true
                }
            }

            //collapse
            //...
            //TODO
            if (this.selected_nodes) {
                for (const i in this.selected_nodes) {
                    this.selected_nodes[i].onKeyDown?.(e)
                }
            }
        } else if (e.type == "keyup") {
            if (e.keyCode == 32) {
                // space
                this.read_only = false
                this.dragging_canvas = this._previously_dragging_canvas ?? false
                this._previously_dragging_canvas = null
            }

            if (this.selected_nodes) {
                for (const i in this.selected_nodes) {
                    this.selected_nodes[i].onKeyUp?.(e)
                }
            }
        }

        // TODO: Do we need to remeasure and recalculate everything on every key down/up?
        this.graph.change()

        if (block_default) {
            e.preventDefault()
            e.stopImmediatePropagation()
            return false
        }
    }
    copyToClipboard(nodes?: Dictionary<LGraphNode>): void {
        const clipboard_info: IClipboardContents = {
            nodes: [],
            links: []
        }
        let index = 0
        const selected_nodes_array: LGraphNode[] = []
        if (!nodes) nodes = this.selected_nodes
        for (const i in nodes) {
            const node = nodes[i]
            if (node.clonable === false) continue

            node._relative_id = index
            selected_nodes_array.push(node)
            index += 1
        }

        for (let i = 0; i < selected_nodes_array.length; ++i) {
            const node = selected_nodes_array[i]
            const cloned = node.clone()
            if (!cloned) {
                console.warn("node type not found: " + node.type)
                continue
            }
            clipboard_info.nodes.push(cloned.serialize())
            if (node.inputs?.length) {
                for (let j = 0; j < node.inputs.length; ++j) {
                    const input = node.inputs[j]
                    if (!input || input.link == null) continue

                    const link_info = this.graph.links[input.link]
                    if (!link_info) continue

                    const target_node = this.graph.getNodeById(link_info.origin_id)
                    if (!target_node) continue

                    clipboard_info.links.push([
                        target_node._relative_id,
                        link_info.origin_slot, //j,
                        node._relative_id,
                        link_info.target_slot,
                        target_node.id
                    ])
                }
            }
        }
        localStorage.setItem(
            "litegrapheditor_clipboard",
            JSON.stringify(clipboard_info)
        )
    }

    emitEvent(detail: CanvasEventDetail): void {
        this.canvas.dispatchEvent(new CustomEvent(
            "litegraph:canvas",
            {
                bubbles: true,
                detail
            }
        ))
    }

    emitBeforeChange(): void {
        this.emitEvent({
            subType: "before-change",
        })
    }

    emitAfterChange(): void {
        this.emitEvent({
            subType: "after-change",
        })
    }

    _pasteFromClipboard(isConnectUnselected = false): void {
        // if ctrl + shift + v is off, return when isConnectUnselected is true (shift is pressed) to maintain old behavior
        if (!LiteGraph.ctrl_shift_v_paste_connect_unselected_outputs && isConnectUnselected) return
        const data = localStorage.getItem("litegrapheditor_clipboard")
        if (!data) return

        this.graph.beforeChange()

        //create nodes
        const clipboard_info: IClipboardContents = JSON.parse(data)
        // calculate top-left node, could work without this processing but using diff with last node pos :: clipboard_info.nodes[clipboard_info.nodes.length-1].pos
        let posMin: false | [number, number] = false
        let posMinIndexes: false | [number, number] = false
        for (let i = 0; i < clipboard_info.nodes.length; ++i) {
            if (posMin) {
                if (posMin[0] > clipboard_info.nodes[i].pos[0]) {
                    posMin[0] = clipboard_info.nodes[i].pos[0]
                    posMinIndexes[0] = i
                }
                if (posMin[1] > clipboard_info.nodes[i].pos[1]) {
                    posMin[1] = clipboard_info.nodes[i].pos[1]
                    posMinIndexes[1] = i
                }
            }
            else {
                posMin = [clipboard_info.nodes[i].pos[0], clipboard_info.nodes[i].pos[1]]
                posMinIndexes = [i, i]
            }
        }
        const nodes: LGraphNode[] = []
        for (let i = 0; i < clipboard_info.nodes.length; ++i) {
            const node_data = clipboard_info.nodes[i]
            const node = LiteGraph.createNode(node_data.type)
            if (node) {
                node.configure(node_data)

                //paste in last known mouse position
                node.pos[0] += this.graph_mouse[0] - posMin[0] //+= 5;
                node.pos[1] += this.graph_mouse[1] - posMin[1] //+= 5;

                this.graph.add(node, true)

                nodes.push(node)
            }
        }

        //create links
        for (let i = 0; i < clipboard_info.links.length; ++i) {
            const link_info = clipboard_info.links[i]
            let origin_node: LGraphNode = undefined
            const origin_node_relative_id = link_info[0]
            if (origin_node_relative_id != null) {
                origin_node = nodes[origin_node_relative_id]
            } else if (LiteGraph.ctrl_shift_v_paste_connect_unselected_outputs && isConnectUnselected) {
                const origin_node_id = link_info[4]
                if (origin_node_id) {
                    origin_node = this.graph.getNodeById(origin_node_id)
                }
            }
            const target_node = nodes[link_info[2]]
            if (origin_node && target_node)
                origin_node.connect(link_info[1], target_node, link_info[3])

            else
                console.warn("Warning, nodes missing on pasting")
        }

        this.selectNodes(nodes)

        this.graph.afterChange()
    }

    pasteFromClipboard(isConnectUnselected = false): void {
        this.emitBeforeChange()
        try {
            this._pasteFromClipboard(isConnectUnselected)
        } finally {
            this.emitAfterChange()
        }
    }
    /**
     * process a item drop event on top the canvas
     **/
    processDrop(e: CanvasDragEvent): boolean {
        e.preventDefault()
        this.adjustMouseEvent(e)
        const x = e.clientX
        const y = e.clientY
        const is_inside = !this.viewport || (this.viewport && x >= this.viewport[0] && x < (this.viewport[0] + this.viewport[2]) && y >= this.viewport[1] && y < (this.viewport[1] + this.viewport[3]))
        if (!is_inside) return

        const pos = [e.canvasX, e.canvasY]
        const node = this.graph ? this.graph.getNodeOnPos(pos[0], pos[1]) : null

        if (!node) {
            const r = this.onDropItem?.(e)
            if (!r) this.checkDropItem(e)
            return
        }

        if (node.onDropFile || node.onDropData) {
            const files = e.dataTransfer.files
            if (files && files.length) {
                for (let i = 0; i < files.length; i++) {
                    const file = e.dataTransfer.files[0]
                    const filename = file.name
                    node.onDropFile?.(file)

                    if (node.onDropData) {
                        //prepare reader
                        const reader = new FileReader()
                        reader.onload = function (event) {
                            const data = event.target.result
                            node.onDropData(data, filename, file)
                        }

                        //read data
                        const type = file.type.split("/")[0]
                        if (type == "text" || type == "") {
                            reader.readAsText(file)
                        } else if (type == "image") {
                            reader.readAsDataURL(file)
                        } else {
                            reader.readAsArrayBuffer(file)
                        }
                    }
                }
            }
        }

        if (node.onDropItem?.(e)) return true

        return this.onDropItem
            ? this.onDropItem(e)
            : false
    }
    //called if the graph doesn't have a default drop item behaviour
    checkDropItem(e: CanvasDragEvent): void {
        if (!e.dataTransfer.files.length) return

        const file = e.dataTransfer.files[0]
        const ext = LGraphCanvas.getFileExtension(file.name).toLowerCase()
        const nodetype = LiteGraph.node_types_by_file_extension[ext]
        if (!nodetype) return

        this.graph.beforeChange()
        const node = LiteGraph.createNode(nodetype.type)
        node.pos = [e.canvasX, e.canvasY]
        this.graph.add(node)
        node.onDropFile?.(file)
        this.graph.afterChange()
    }
    processNodeDblClicked(n: LGraphNode): void {
        this.onShowNodePanel?.(n)
        this.onNodeDblClicked?.(n)

        this.setDirty(true)
    }
    processNodeSelected(node: LGraphNode, e: CanvasMouseEvent): void {
        this.selectNode(node, e && (e.shiftKey || e.metaKey || e.ctrlKey || this.multi_select))
        this.onNodeSelected?.(node)
    }
    /**
     * selects a given node (or adds it to the current selection)
     **/
    selectNode(node: LGraphNode, add_to_current_selection?: boolean): void {
        if (node == null) {
            this.deselectAllNodes()
        } else {
            this.selectNodes([node], add_to_current_selection)
        }
    }
    /**
     * selects several nodes (or adds them to the current selection)
     **/
    selectNodes(nodes?: LGraphNode[] | Dictionary<LGraphNode>, add_to_current_selection?: boolean): void {
        if (!add_to_current_selection) {
            this.deselectAllNodes()
        }

        nodes = nodes || this.graph._nodes
        if (typeof nodes == "string") nodes = [nodes]
        for (const i in nodes) {
            const node: LGraphNode = nodes[i]
            if (node.is_selected) {
                this.deselectNode(node)
                continue
            }

            if (!node.is_selected) {
                node.onSelected?.()
            }
            node.is_selected = true
            this.selected_nodes[node.id] = node

            if (node.inputs) {
                for (let j = 0; j < node.inputs.length; ++j) {
                    this.highlighted_links[node.inputs[j].link] = true
                }
            }
            if (node.outputs) {
                for (let j = 0; j < node.outputs.length; ++j) {
                    const out = node.outputs[j]
                    if (out.links) {
                        for (let k = 0; k < out.links.length; ++k) {
                            this.highlighted_links[out.links[k]] = true
                        }
                    }
                }
            }
        }

        this.onSelectionChange?.(this.selected_nodes)

        this.setDirty(true)
    }
    /**
     * removes a node from the current selection
     **/
    deselectNode(node: LGraphNode): void {
        if (!node.is_selected) return
        node.onDeselected?.()
        node.is_selected = false
        delete this.selected_nodes[node.id]

        this.onNodeDeselected?.(node)

        //remove highlighted
        if (node.inputs) {
            for (let i = 0; i < node.inputs.length; ++i) {
                delete this.highlighted_links[node.inputs[i].link]
            }
        }
        if (node.outputs) {
            for (let i = 0; i < node.outputs.length; ++i) {
                const out = node.outputs[i]
                if (out.links) {
                    for (let j = 0; j < out.links.length; ++j) {
                        delete this.highlighted_links[out.links[j]]
                    }
                }
            }
        }
    }
    /**
     * removes all nodes from the current selection
     **/
    deselectAllNodes(): void {
        if (!this.graph) return
        const nodes = this.graph._nodes
        for (let i = 0, l = nodes.length; i < l; ++i) {
            const node = nodes[i]
            if (!node.is_selected) {
                continue
            }
            node.onDeselected?.()
            node.is_selected = false
            this.onNodeDeselected?.(node)
        }
        this.selected_nodes = {}
        this.current_node = null
        this.highlighted_links = {}
        this.deselectGroups()

        this.onSelectionChange?.(this.selected_nodes)
        this.setDirty(true)
    }

    deselectGroups() {
        if (!this.selectedGroups) return
        for (const group of this.selectedGroups) {
            delete group.selected
        }
        this.selectedGroups = null
    }

    /**
     * deletes all nodes in the current selection from the graph
     **/
    deleteSelectedNodes(): void {

        this.graph.beforeChange()

        for (const i in this.selected_nodes) {
            const node = this.selected_nodes[i]

            if (node.block_delete) continue

            //autoconnect when possible (very basic, only takes into account first input-output)
            if (node.inputs?.length && node.outputs && node.outputs.length && LiteGraph.isValidConnection(node.inputs[0].type, node.outputs[0].type) && node.inputs[0].link && node.outputs[0].links && node.outputs[0].links.length) {
                const input_link = node.graph.links[node.inputs[0].link]
                const output_link = node.graph.links[node.outputs[0].links[0]]
                const input_node = node.getInputNode(0)
                const output_node = node.getOutputNodes(0)[0]
                if (input_node && output_node)
                    input_node.connect(input_link.origin_slot, output_node, output_link.target_slot)
            }
            this.graph.remove(node)
            this.onNodeDeselected?.(node)
        }
        this.selected_nodes = {}
        this.current_node = null
        this.highlighted_links = {}
        this.setDirty(true)
        this.graph.afterChange()
    }
    /**
     * centers the camera on a given node
     **/
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
     **/
    adjustMouseEvent(e: CanvasMouseEvent | CanvasDragEvent | CanvasWheelEvent): asserts e is CanvasMouseEvent {
        let clientX_rel = e.clientX
        let clientY_rel = e.clientY

        if (this.canvas) {
            const b = this.canvas.getBoundingClientRect()
            clientX_rel -= b.left
            clientY_rel -= b.top
        }

        // TODO: Find a less brittle way to do this

        // Only set deltaX and deltaY if not already set.
        // If deltaX and deltaY are already present, they are read-only.
        // Setting them would result browser error => zoom in/out feature broken.
        // @ts-expect-error This behaviour is not guaranteed but for now works on all browsers
        if (e.deltaX === undefined) e.deltaX = clientX_rel - this.last_mouse_position[0]
        // @ts-expect-error This behaviour is not guaranteed but for now works on all browsers
        if (e.deltaY === undefined) e.deltaY = clientY_rel - this.last_mouse_position[1]

        this.last_mouse_position[0] = clientX_rel
        this.last_mouse_position[1] = clientY_rel

        e.canvasX = clientX_rel / this.ds.scale - this.ds.offset[0]
        e.canvasY = clientY_rel / this.ds.scale - this.ds.offset[1]
    }
    /**
     * changes the zoom level of the graph (default is 1), you can pass also a place used to pivot the zoom
     **/
    setZoom(value: number, zooming_center: Point) {
        this.ds.changeScale(value, zooming_center)
        this.dirty_canvas = true
        this.dirty_bgcanvas = true
    }
    /**
     * converts a coordinate from graph coordinates to canvas2D coordinates
     **/
    convertOffsetToCanvas(pos: Point, out: Point): Point {
        // @ts-expect-error Unused param
        return this.ds.convertOffsetToCanvas(pos, out)
    }
    /**
     * converts a coordinate from Canvas2D coordinates to graph space
     **/
    convertCanvasToOffset(pos: Point, out?: Point): Point {
        return this.ds.convertCanvasToOffset(pos, out)
    }
    //converts event coordinates from canvas2D to graph coordinates
    convertEventToCanvasOffset(e: MouseEvent): Point {
        const rect = this.canvas.getBoundingClientRect()
        // TODO: -> this.ds.convertCanvasToOffset
        return this.convertCanvasToOffset([
            e.clientX - rect.left,
            e.clientY - rect.top
        ])
    }
    /**
     * brings a node to front (above all other nodes)
     **/
    bringToFront(node: LGraphNode): void {
        const i = this.graph._nodes.indexOf(node)
        if (i == -1) return

        this.graph._nodes.splice(i, 1)
        this.graph._nodes.push(node)
    }
    /**
     * sends a node to the back (below all other nodes)
     **/
    sendToBack(node: LGraphNode): void {
        const i = this.graph._nodes.indexOf(node)
        if (i == -1) return

        this.graph._nodes.splice(i, 1)
        this.graph._nodes.unshift(node)
    }

    /**
     * Determines which nodes are visible and populates {@link out} with the results.
     * @param nodes The list of nodes to check - if falsy, all nodes in the graph will be checked
     * @param out Array to write visible nodes into - if falsy, a new array is created instead
     * @returns {LGraphNode[]} Array passed ({@link out}), or a new array containing all visible nodes
     */
    computeVisibleNodes(nodes?: LGraphNode[], out?: LGraphNode[]): LGraphNode[] {
        const visible_nodes = out || []
        visible_nodes.length = 0
        nodes ||= this.graph._nodes
        for (let i = 0, l = nodes.length; i < l; ++i) {
            const n = nodes[i]

            //skip rendering nodes in live mode
            if (this.live_mode && !n.onDrawBackground && !n.onDrawForeground) continue
            // Not in visible area
            if (!overlapBounding(this.visible_area, n.getBounding(LGraphCanvas.#temp, true))) continue

            visible_nodes.push(n)
        }
        return visible_nodes
    }

    /**
     * renders the whole canvas content, by rendering in two separated canvas, one containing the background grid and the connections, and one containing the nodes)
     **/
    draw(force_canvas?: boolean, force_bgcanvas?: boolean): void {
        if (!this.canvas || this.canvas.width == 0 || this.canvas.height == 0) return

        //fps counting
        const now = LiteGraph.getTime()
        this.render_time = (now - this.last_draw_time) * 0.001
        this.last_draw_time = now

        if (this.graph) {
            this.ds.computeVisibleArea(this.viewport)
        }

        if (this.dirty_bgcanvas ||
            force_bgcanvas ||
            this.always_render_background ||
            (this.graph &&
                this.graph._last_trigger_time &&
                now - this.graph._last_trigger_time < 1000)) {
            this.drawBackCanvas()
        }

        if (this.dirty_canvas || force_canvas) {
            this.drawFrontCanvas()
        }

        this.fps = this.render_time ? 1.0 / this.render_time : 0
        this.frame += 1
    }
    /**
     * draws the front canvas (the one containing all the nodes)
     **/
    drawFrontCanvas(): void {
        this.dirty_canvas = false

        if (!this.ctx) {
            this.ctx = this.bgcanvas.getContext("2d")
        }
        const ctx = this.ctx
        //maybe is using webgl...
        if (!ctx) return

        const canvas = this.canvas
        // @ts-expect-error
        if (ctx.start2D && !this.viewport) {
            // @ts-expect-error
            ctx.start2D()
            ctx.restore()
            ctx.setTransform(1, 0, 0, 1, 0, 0)
        }

        //clip dirty area if there is one, otherwise work in full canvas
        const area = this.viewport || this.dirty_area
        if (area) {
            ctx.save()
            ctx.beginPath()
            ctx.rect(area[0], area[1], area[2], area[3])
            ctx.clip()
        }

        //clear
        //canvas.width = canvas.width;
        if (this.clear_background) {
            if (area)
                ctx.clearRect(area[0], area[1], area[2], area[3])
            else
                ctx.clearRect(0, 0, canvas.width, canvas.height)
        }

        //draw bg canvas
        if (this.bgcanvas == this.canvas) {
            this.drawBackCanvas()
        } else {
            const scale = window.devicePixelRatio
            ctx.drawImage(this.bgcanvas, 0, 0, this.bgcanvas.width / scale, this.bgcanvas.height / scale)
        }

        //rendering
        this.onRender?.(canvas, ctx)

        //info widget
        if (this.show_info) {
            this.renderInfo(ctx, area ? area[0] : 0, area ? area[1] : 0)
        }

        if (this.graph) {
            //apply transformations
            ctx.save()
            this.ds.toCanvasContext(ctx)

            //draw nodes
            const visible_nodes = this.computeVisibleNodes(
                null,
                this.visible_nodes
            )

            for (let i = 0; i < visible_nodes.length; ++i) {
                const node = visible_nodes[i]

                //transform coords system
                ctx.save()
                ctx.translate(node.pos[0], node.pos[1])

                //Draw
                this.drawNode(node, ctx)

                //Restore
                ctx.restore()
            }

            //on top (debug)
            if (this.render_execution_order) {
                this.drawExecutionOrder(ctx)
            }

            //connections ontop?
            if (this.graph.config.links_ontop) {
                if (!this.live_mode) {
                    this.drawConnections(ctx)
                }
            }

            if (this.connecting_links) {
                //current connection (the one being dragged by the mouse)
                for (const link of this.connecting_links) {
                    ctx.lineWidth = this.connections_width
                    let link_color = null

                    const connInOrOut = link.output || link.input

                    const connType = connInOrOut.type
                    let connDir = connInOrOut.dir
                    if (connDir == null) {
                        if (link.output)
                            connDir = link.node.horizontal ? LinkDirection.DOWN : LinkDirection.RIGHT

                        else
                            connDir = link.node.horizontal ? LinkDirection.UP : LinkDirection.LEFT
                    }
                    const connShape = connInOrOut.shape

                    switch (connType) {
                        case LiteGraph.EVENT:
                            link_color = LiteGraph.EVENT_LINK_COLOR
                            break
                        default:
                            link_color = LiteGraph.CONNECTING_LINK_COLOR
                    }

                    const highlightPos: Point = this.#getHighlightPosition()
                    //the connection being dragged by the mouse
                    this.renderLink(
                        ctx,
                        link.pos,
                        highlightPos,
                        null,
                        false,
                        null,
                        link_color,
                        connDir,
                        link.direction ?? LinkDirection.CENTER
                    )

                    ctx.beginPath()
                    if (connType === LiteGraph.EVENT ||
                        connShape === RenderShape.BOX) {
                        ctx.rect(
                            link.pos[0] - 6 + 0.5,
                            link.pos[1] - 5 + 0.5,
                            14,
                            10
                        )
                        ctx.fill()
                        ctx.beginPath()
                        ctx.rect(
                            this.graph_mouse[0] - 6 + 0.5,
                            this.graph_mouse[1] - 5 + 0.5,
                            14,
                            10
                        )
                    } else if (connShape === RenderShape.ARROW) {
                        ctx.moveTo(link.pos[0] + 8, link.pos[1] + 0.5)
                        ctx.lineTo(link.pos[0] - 4, link.pos[1] + 6 + 0.5)
                        ctx.lineTo(link.pos[0] - 4, link.pos[1] - 6 + 0.5)
                        ctx.closePath()
                    }
                    else {
                        ctx.arc(
                            link.pos[0],
                            link.pos[1],
                            4,
                            0,
                            Math.PI * 2
                        )
                        ctx.fill()
                        ctx.beginPath()
                        ctx.arc(
                            this.graph_mouse[0],
                            this.graph_mouse[1],
                            4,
                            0,
                            Math.PI * 2
                        )
                    }
                    ctx.fill()

                    // Gradient half-border over target node
                    this.#renderSnapHighlight(ctx, highlightPos)
                }
            }

            //the selection rectangle
            if (this.dragging_rectangle) {
                ctx.strokeStyle = "#FFF"
                ctx.strokeRect(
                    this.dragging_rectangle[0],
                    this.dragging_rectangle[1],
                    this.dragging_rectangle[2],
                    this.dragging_rectangle[3]
                )
            }

            //on top of link center
            if (this.over_link_center && this.render_link_tooltip)
                this.drawLinkTooltip(ctx, this.over_link_center)

            //to remove
            else
                this.onDrawLinkTooltip?.(ctx, null)

            //custom info
            this.onDrawForeground?.(ctx, this.visible_area)

            ctx.restore()
        }

        //draws panel in the corner 
        if (this._graph_stack?.length) {
            this.drawSubgraphPanel(ctx)
        }

        this.onDrawOverlay?.(ctx)

        if (area) ctx.restore()

        // FIXME: Remove this hook
        //this is a function I use in webgl renderer
        // @ts-expect-error
        if (ctx.finish2D) ctx.finish2D()
    }

    /** Get the target snap / highlight point in graph space */
    #getHighlightPosition(): Point {
        return LiteGraph.snaps_for_comfy
            ? this._highlight_pos ?? this.graph_mouse
            : this.graph_mouse
    }

    /**
     * Renders indicators showing where a link will connect if released.
     * Partial border over target node and a highlight over the slot itself.
     * @param ctx Canvas 2D context
     */
    #renderSnapHighlight(ctx: CanvasRenderingContext2D, highlightPos: Point): void {
        if (!this._highlight_pos) return

        ctx.fillStyle = "#ffcc00"
        ctx.beginPath()
        const shape = this._highlight_input?.shape

        if (shape === RenderShape.ARROW) {
            ctx.moveTo(highlightPos[0] + 8, highlightPos[1] + 0.5)
            ctx.lineTo(highlightPos[0] - 4, highlightPos[1] + 6 + 0.5)
            ctx.lineTo(highlightPos[0] - 4, highlightPos[1] - 6 + 0.5)
            ctx.closePath()
        } else {
            ctx.arc(
                highlightPos[0],
                highlightPos[1],
                6,
                0,
                Math.PI * 2
            )
        }
        ctx.fill()

        if (!LiteGraph.snap_highlights_node) return

        // Ensure we're mousing over a node and connecting a link
        const node = this.node_over
        if (!(node && this.connecting_links?.[0])) return

        const { strokeStyle, lineWidth } = ctx

        const area = LGraphCanvas.#tmp_area
        node.measure(area)
        node.onBounding?.(area)
        const gap = 3
        const radius = this.round_radius + gap

        const x = area[0] - gap
        const y = area[1] - gap
        const width = area[2] + (gap * 2)
        const height = area[3] + (gap * 2)

        ctx.beginPath()
        ctx.roundRect(x, y, width, height, radius)

        // TODO: Currently works on LTR slots only.  Add support for other directions.
        const start = this.connecting_links[0].output === null ? 0 : 1
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
        linearGradient.addColorStop(start + (0.67 * inverter), "#ddeeff33")
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

        ctx.strokeStyle = gradient
        ctx.stroke()

        ctx.setLineDash([])
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = strokeStyle
    }

    /**
     * draws the panel in the corner that shows subgraph properties
     **/
    drawSubgraphPanel(ctx: CanvasRenderingContext2D): void {
        const subgraph = this.graph
        const subnode = subgraph._subgraph_node
        if (!subnode) {
            console.warn("subgraph without subnode")
            return
        }
        this.drawSubgraphPanelLeft(subgraph, subnode, ctx)
        this.drawSubgraphPanelRight(subgraph, subnode, ctx)
    }
    drawSubgraphPanelLeft(subgraph: LGraph, subnode: LGraphNode, ctx: CanvasRenderingContext2D): void {
        const num = subnode.inputs ? subnode.inputs.length : 0
        const w = 200
        const h = Math.floor(LiteGraph.NODE_SLOT_HEIGHT * 1.6)

        ctx.fillStyle = "#111"
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        ctx.roundRect(10, 10, w, (num + 1) * h + 50, [8])
        ctx.fill()
        ctx.globalAlpha = 1

        ctx.fillStyle = "#888"
        ctx.font = "14px Arial"
        ctx.textAlign = "left"
        ctx.fillText("Graph Inputs", 20, 34)
        // var pos = this.mouse;
        if (this.drawButton(w - 20, 20, 20, 20, "X", "#151515")) {
            this.closeSubgraph()
            return
        }

        let y = 50
        ctx.font = "14px Arial"
        if (subnode.inputs)
            for (let i = 0; i < subnode.inputs.length; ++i) {
                const input = subnode.inputs[i]
                if (input.not_subgraph_input) continue

                //input button clicked
                if (this.drawButton(20, y + 2, w - 20, h - 2)) {
                    // @ts-expect-error ctor props
                    const type = subnode.constructor.input_node_type || "graph/input"
                    this.graph.beforeChange()
                    const newnode = LiteGraph.createNode(type)
                    if (newnode) {
                        subgraph.add(newnode)
                        this.block_click = false
                        this.last_click_position = null
                        this.selectNodes([newnode])
                        this.node_dragged = newnode
                        this.dragging_canvas = false
                        newnode.setProperty("name", input.name)
                        newnode.setProperty("type", input.type)
                        this.node_dragged.pos[0] = this.graph_mouse[0] - 5
                        this.node_dragged.pos[1] = this.graph_mouse[1] - 5
                        this.graph.afterChange()
                    }

                    else
                        console.error("graph input node not found:", type)
                }
                ctx.fillStyle = "#9C9"
                ctx.beginPath()
                ctx.arc(w - 16, y + h * 0.5, 5, 0, 2 * Math.PI)
                ctx.fill()
                ctx.fillStyle = "#AAA"
                ctx.fillText(input.name, 30, y + h * 0.75)
                // var tw = ctx.measureText(input.name);
                ctx.fillStyle = "#777"
                // @ts-expect-error FIXME: Should be a string?  Should be a number?
                ctx.fillText(input.type, 130, y + h * 0.75)
                y += h
            }
        //add + button
        if (this.drawButton(20, y + 2, w - 20, h - 2, "+", "#151515", "#222")) {
            this.showSubgraphPropertiesDialog(subnode)
        }
    }
    drawSubgraphPanelRight(subgraph: LGraph, subnode: LGraphNode, ctx: CanvasRenderingContext2D): void {
        const num = subnode.outputs ? subnode.outputs.length : 0
        const canvas_w = this.bgcanvas.width
        const w = 200
        const h = Math.floor(LiteGraph.NODE_SLOT_HEIGHT * 1.6)

        ctx.fillStyle = "#111"
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        ctx.roundRect(canvas_w - w - 10, 10, w, (num + 1) * h + 50, [8])
        ctx.fill()
        ctx.globalAlpha = 1

        ctx.fillStyle = "#888"
        ctx.font = "14px Arial"
        ctx.textAlign = "left"
        const title_text = "Graph Outputs"
        const tw = ctx.measureText(title_text).width
        ctx.fillText(title_text, (canvas_w - tw) - 20, 34)
        // var pos = this.mouse;
        if (this.drawButton(canvas_w - w, 20, 20, 20, "X", "#151515")) {
            this.closeSubgraph()
            return
        }

        let y = 50
        ctx.font = "14px Arial"
        if (subnode.outputs)
            for (let i = 0; i < subnode.outputs.length; ++i) {
                const output = subnode.outputs[i]
                if (output.not_subgraph_input) continue

                //output button clicked
                if (this.drawButton(canvas_w - w, y + 2, w - 20, h - 2)) {
                    // @ts-expect-error ctor props
                    const type = subnode.constructor.output_node_type || "graph/output"
                    this.graph.beforeChange()
                    const newnode = LiteGraph.createNode(type)
                    if (newnode) {
                        subgraph.add(newnode)
                        this.block_click = false
                        this.last_click_position = null
                        this.selectNodes([newnode])
                        this.node_dragged = newnode
                        this.dragging_canvas = false
                        newnode.setProperty("name", output.name)
                        newnode.setProperty("type", output.type)
                        this.node_dragged.pos[0] = this.graph_mouse[0] - 5
                        this.node_dragged.pos[1] = this.graph_mouse[1] - 5
                        this.graph.afterChange()
                    }

                    else
                        console.error("graph input node not found:", type)
                }
                ctx.fillStyle = "#9C9"
                ctx.beginPath()
                ctx.arc(canvas_w - w + 16, y + h * 0.5, 5, 0, 2 * Math.PI)
                ctx.fill()
                ctx.fillStyle = "#AAA"
                ctx.fillText(output.name, canvas_w - w + 30, y + h * 0.75)
                // var tw = ctx.measureText(input.name);
                ctx.fillStyle = "#777"
                // @ts-expect-error slot type issue
                ctx.fillText(output.type, canvas_w - w + 130, y + h * 0.75)
                y += h
            }
        //add + button
        if (this.drawButton(canvas_w - w, y + 2, w - 20, h - 2, "+", "#151515", "#222")) {
            this.showSubgraphPropertiesDialogRight(subnode)
        }
    }
    //Draws a button into the canvas overlay and computes if it was clicked using the immediate gui paradigm
    drawButton(x: number, y: number, w: number, h: number, text?: string, bgcolor?: CanvasColour, hovercolor?: CanvasColour, textcolor?: CanvasColour): boolean {
        const ctx = this.ctx
        bgcolor = bgcolor || LiteGraph.NODE_DEFAULT_COLOR
        hovercolor = hovercolor || "#555"
        textcolor = textcolor || LiteGraph.NODE_TEXT_COLOR
        let pos = this.ds.convertOffsetToCanvas(this.graph_mouse)
        const hover = LiteGraph.isInsideRectangle(pos[0], pos[1], x, y, w, h)
        pos = this.last_click_position ? [this.last_click_position[0], this.last_click_position[1]] : null
        if (pos) {
            const rect = this.canvas.getBoundingClientRect()
            pos[0] -= rect.left
            pos[1] -= rect.top
        }
        const clicked = pos && LiteGraph.isInsideRectangle(pos[0], pos[1], x, y, w, h)

        ctx.fillStyle = hover ? hovercolor : bgcolor
        if (clicked) ctx.fillStyle = "#AAA"
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, [4])
        ctx.fill()

        if (text != null) {
            if (text.constructor == String) {
                ctx.fillStyle = textcolor
                ctx.textAlign = "center"
                ctx.font = ((h * 0.65) | 0) + "px Arial"
                ctx.fillText(text, x + w * 0.5, y + h * 0.75)
                ctx.textAlign = "left"
            }
        }

        const was_clicked = clicked && !this.block_click
        if (clicked) this.blockClick()
        return was_clicked
    }
    isAreaClicked(x: number, y: number, w: number, h: number, hold_click: boolean): boolean {
        const clickPos = this.last_click_position
        const clicked = clickPos && LiteGraph.isInsideRectangle(clickPos[0], clickPos[1], x, y, w, h)
        const was_clicked = clicked && !this.block_click
        if (clicked && hold_click) this.blockClick()
        return was_clicked
    }
    /**
     * draws some useful stats in the corner of the canvas
     **/
    renderInfo(ctx: CanvasRenderingContext2D, x: number, y: number): void {
        x = x || 10
        y = y || this.canvas.offsetHeight - 80

        ctx.save()
        ctx.translate(x, y)

        ctx.font = "10px Arial"
        ctx.fillStyle = "#888"
        ctx.textAlign = "left"
        if (this.graph) {
            ctx.fillText("T: " + this.graph.globaltime.toFixed(2) + "s", 5, 13 * 1)
            ctx.fillText("I: " + this.graph.iteration, 5, 13 * 2)
            ctx.fillText("N: " + this.graph._nodes.length + " [" + this.visible_nodes.length + "]", 5, 13 * 3)
            ctx.fillText("V: " + this.graph._version, 5, 13 * 4)
            ctx.fillText("FPS:" + this.fps.toFixed(2), 5, 13 * 5)
        } else {
            ctx.fillText("No graph selected", 5, 13 * 1)
        }
        ctx.restore()
    }
    /**
     * draws the back canvas (the one containing the background and the connections)
     **/
    drawBackCanvas(): void {
        const canvas = this.bgcanvas
        if (canvas.width != this.canvas.width ||
            canvas.height != this.canvas.height) {
            canvas.width = this.canvas.width
            canvas.height = this.canvas.height
        }

        if (!this.bgctx) {
            this.bgctx = this.bgcanvas.getContext("2d")
        }
        const ctx = this.bgctx
        // TODO: Remove this
        // @ts-expect-error
        if (ctx.start) ctx.start()

        const viewport = this.viewport || [0, 0, ctx.canvas.width, ctx.canvas.height]

        //clear
        if (this.clear_background) {
            ctx.clearRect(viewport[0], viewport[1], viewport[2], viewport[3])
        }

        //show subgraph stack header
        if (this._graph_stack?.length) {
            ctx.save()
            const subgraph_node = this.graph._subgraph_node
            ctx.strokeStyle = subgraph_node.bgcolor
            ctx.lineWidth = 10
            ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)
            ctx.lineWidth = 1
            ctx.font = "40px Arial"
            ctx.textAlign = "center"
            ctx.fillStyle = subgraph_node.bgcolor || "#AAA"
            let title = ""
            for (let i = 1; i < this._graph_stack.length; ++i) {
                title +=
                    this._graph_stack[i]._subgraph_node.getTitle() + " >> "
            }
            ctx.fillText(
                title + subgraph_node.getTitle(),
                canvas.width * 0.5,
                40
            )
            ctx.restore()
        }

        const bg_already_painted = this.onRenderBackground
            ? this.onRenderBackground(canvas, ctx)
            : false

        //reset in case of error
        if (!this.viewport) {
            const scale = window.devicePixelRatio
            ctx.restore()
            ctx.setTransform(scale, 0, 0, scale, 0, 0)
        }
        this.visible_links.length = 0

        if (this.graph) {
            //apply transformations
            ctx.save()
            this.ds.toCanvasContext(ctx)

            //render BG
            if (this.ds.scale < 1.5 && !bg_already_painted && this.clear_background_color) {
                ctx.fillStyle = this.clear_background_color
                ctx.fillRect(
                    this.visible_area[0],
                    this.visible_area[1],
                    this.visible_area[2],
                    this.visible_area[3]
                )
            }

            if (this.background_image &&
                this.ds.scale > 0.5 &&
                !bg_already_painted) {
                if (this.zoom_modify_alpha) {
                    ctx.globalAlpha =
                        (1.0 - 0.5 / this.ds.scale) * this.editor_alpha
                } else {
                    ctx.globalAlpha = this.editor_alpha
                }
                ctx.imageSmoothingEnabled = false
                if (!this._bg_img ||
                    this._bg_img.name != this.background_image) {
                    this._bg_img = new Image()
                    this._bg_img.name = this.background_image
                    this._bg_img.src = this.background_image
                    const that = this
                    this._bg_img.onload = function () {
                        that.draw(true, true)
                    }
                }

                let pattern = this._pattern
                if (pattern == null && this._bg_img.width > 0) {
                    pattern = ctx.createPattern(this._bg_img, "repeat")
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
                        this.visible_area[3]
                    )
                    ctx.fillStyle = "transparent"
                }

                ctx.globalAlpha = 1.0
                ctx.imageSmoothingEnabled = true
            }

            //groups
            if (this.graph._groups.length && !this.live_mode) {
                this.drawGroups(canvas, ctx)
            }

            this.onDrawBackground?.(ctx, this.visible_area)

            //DEBUG: show clipping area
            //ctx.fillStyle = "red";
            //ctx.fillRect( this.visible_area[0] + 10, this.visible_area[1] + 10, this.visible_area[2] - 20, this.visible_area[3] - 20);
            //bg
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

            //draw connections
            if (!this.live_mode) {
                this.drawConnections(ctx)
            }

            ctx.shadowColor = "rgba(0,0,0,0)"

            //restore state
            ctx.restore()
        }

        // TODO: Remove this
        // @ts-expect-error
        ctx.finish?.()

        this.dirty_bgcanvas = false
        //to force to repaint the front canvas with the bgcanvas
        // But why would you actually want to do this?
        this.dirty_canvas = true
    }
    /**
     * draws the given node inside the canvas
     **/
    drawNode(node: LGraphNode, ctx: CanvasRenderingContext2D): void {
        this.current_node = node

        const color = node.color || node.constructor.color || LiteGraph.NODE_DEFAULT_COLOR
        let bgcolor = node.bgcolor || node.constructor.bgcolor || LiteGraph.NODE_DEFAULT_BGCOLOR

        const low_quality = this.ds.scale < 0.6 //zoomed out

        //only render if it forces it to do it
        if (this.live_mode) {
            if (!node.flags.collapsed) {
                ctx.shadowColor = "transparent"
                node.onDrawForeground?.(ctx, this, this.canvas)
            }
            return
        }

        const editor_alpha = this.editor_alpha
        ctx.globalAlpha = editor_alpha

        if (this.render_shadows && !low_quality) {
            ctx.shadowColor = LiteGraph.DEFAULT_SHADOW_COLOR
            ctx.shadowOffsetX = 2 * this.ds.scale
            ctx.shadowOffsetY = 2 * this.ds.scale
            ctx.shadowBlur = 3 * this.ds.scale
        } else {
            ctx.shadowColor = "transparent"
        }

        //custom draw collapsed method (draw after shadows because they are affected)
        if (node.flags.collapsed && node.onDrawCollapsed?.(ctx, this) == true)
            return

        //clip if required (mask)
        const shape = node._shape || RenderShape.BOX
        const size = LGraphCanvas.#temp_vec2
        LGraphCanvas.#temp_vec2.set(node.size)
        const horizontal = node.horizontal // || node.flags.horizontal;

        if (node.flags.collapsed) {
            ctx.font = this.inner_text_font
            const title = node.getTitle ? node.getTitle() : node.title
            if (title != null) {
                node._collapsed_width = Math.min(
                    node.size[0],
                    ctx.measureText(title).width +
                    LiteGraph.NODE_TITLE_HEIGHT * 2
                ) //LiteGraph.NODE_COLLAPSED_WIDTH;
                size[0] = node._collapsed_width
                size[1] = 0
            }
        }

        if (node.clip_area) {
            //Start clipping
            ctx.save()
            ctx.beginPath()
            if (shape == RenderShape.BOX) {
                ctx.rect(0, 0, size[0], size[1])
            } else if (shape == RenderShape.ROUND) {
                ctx.roundRect(0, 0, size[0], size[1], [10])
            } else if (shape == RenderShape.CIRCLE) {
                ctx.arc(
                    size[0] * 0.5,
                    size[1] * 0.5,
                    size[0] * 0.5,
                    0,
                    Math.PI * 2
                )
            }
            ctx.clip()
        }

        //draw shape
        if (node.has_errors) {
            bgcolor = "red"
        }
        this.drawNodeShape(
            node,
            ctx,
            size,
            color,
            bgcolor,
            node.is_selected
        )

        if (!low_quality) {
            node.drawBadges(ctx)
        }

        ctx.shadowColor = "transparent"

        //draw foreground
        node.onDrawForeground?.(ctx, this, this.canvas)

        //connection slots
        ctx.textAlign = horizontal ? "center" : "left"
        ctx.font = this.inner_text_font

        const render_text = !low_quality
        const highlightColour = LiteGraph.NODE_TEXT_HIGHLIGHT_COLOR ?? LiteGraph.NODE_SELECTED_TITLE_COLOR ?? LiteGraph.NODE_TEXT_COLOR

        const out_slot = this.connecting_links ? this.connecting_links[0].output : null
        const in_slot = this.connecting_links ? this.connecting_links[0].input : null
        ctx.lineWidth = 1

        let max_y = 0
        const slot_pos = new Float32Array(2) //to reuse

        //render inputs and outputs
        if (!node.flags.collapsed) {
            //input connection slots
            if (node.inputs) {
                for (let i = 0; i < node.inputs.length; i++) {
                    const slot = node.inputs[i]

                    const slot_type = slot.type

                    //change opacity of incompatible slots when dragging a connection
                    const isValid = !this.connecting_links || (out_slot && LiteGraph.isValidConnection(slot.type, out_slot.type))
                    const highlight = isValid && node.mouseOver?.inputId === i
                    const label_color = highlight ? highlightColour : LiteGraph.NODE_TEXT_COLOR
                    ctx.globalAlpha = isValid ? editor_alpha : 0.4 * editor_alpha

                    ctx.fillStyle =
                        slot.link != null
                            ? slot.color_on ||
                            this.default_connection_color_byType[slot_type] ||
                            this.default_connection_color.input_on
                            : slot.color_off ||
                            this.default_connection_color_byTypeOff[slot_type] ||
                            this.default_connection_color_byType[slot_type] ||
                            this.default_connection_color.input_off

                    const pos = node.getConnectionPos(true, i, slot_pos)
                    pos[0] -= node.pos[0]
                    pos[1] -= node.pos[1]
                    if (max_y < pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5) {
                        max_y = pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5
                    }

                    drawSlot(ctx, slot, pos, {
                        horizontal,
                        low_quality,
                        render_text,
                        label_color,
                        label_position: LabelPosition.Right,
                        // Input slot is not stroked.
                        do_stroke: false,
                        highlight,
                    })
                }
            }

            //output connection slots
            ctx.textAlign = horizontal ? "center" : "right"
            ctx.strokeStyle = "black"
            if (node.outputs) {
                for (let i = 0; i < node.outputs.length; i++) {
                    const slot = node.outputs[i]

                    const slot_type = slot.type

                    //change opacity of incompatible slots when dragging a connection
                    const isValid = !this.connecting_links || (in_slot && LiteGraph.isValidConnection(slot_type, in_slot.type))
                    const highlight = isValid && node.mouseOver?.outputId === i
                    const label_color = highlight ? highlightColour : LiteGraph.NODE_TEXT_COLOR
                    ctx.globalAlpha = isValid ? editor_alpha : 0.4 * editor_alpha

                    const pos = node.getConnectionPos(false, i, slot_pos)
                    pos[0] -= node.pos[0]
                    pos[1] -= node.pos[1]
                    if (max_y < pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5) {
                        max_y = pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5
                    }

                    ctx.fillStyle =
                        slot.links && slot.links.length
                            ? slot.color_on ||
                            this.default_connection_color_byType[slot_type] ||
                            this.default_connection_color.output_on
                            : slot.color_off ||
                            this.default_connection_color_byTypeOff[slot_type] ||
                            this.default_connection_color_byType[slot_type] ||
                            this.default_connection_color.output_off

                    drawSlot(ctx, slot, pos, {
                        horizontal,
                        low_quality,
                        render_text,
                        label_color,
                        label_position: LabelPosition.Left,
                        do_stroke: true,
                        highlight,
                    })
                }
            }

            ctx.textAlign = "left"
            ctx.globalAlpha = 1

            if (node.widgets) {
                let widgets_y = max_y
                if (horizontal || node.widgets_up) {
                    widgets_y = 2
                }
                if (node.widgets_start_y != null)
                    widgets_y = node.widgets_start_y
                this.drawNodeWidgets(
                    node,
                    widgets_y,
                    ctx,
                    this.node_widget && this.node_widget[0] == node
                        ? this.node_widget[1]
                        : null
                )
            }
        } else if (this.render_collapsed_slots) {
            //if collapsed
            let input_slot = null
            let output_slot = null
            let slot

            //get first connected slot to render
            if (node.inputs) {
                for (let i = 0; i < node.inputs.length; i++) {
                    slot = node.inputs[i]
                    if (slot.link == null) {
                        continue
                    }
                    input_slot = slot
                    break
                }
            }
            if (node.outputs) {
                for (let i = 0; i < node.outputs.length; i++) {
                    slot = node.outputs[i]
                    if (!slot.links || !slot.links.length) {
                        continue
                    }
                    output_slot = slot
                }
            }

            if (input_slot) {
                let x = 0
                let y = LiteGraph.NODE_TITLE_HEIGHT * -0.5 //center
                if (horizontal) {
                    x = node._collapsed_width * 0.5
                    y = -LiteGraph.NODE_TITLE_HEIGHT
                }
                ctx.fillStyle = "#686"
                ctx.beginPath()
                if (slot.type === LiteGraph.EVENT ||
                    slot.shape === RenderShape.BOX) {
                    ctx.rect(x - 7 + 0.5, y - 4, 14, 8)
                } else if (slot.shape === RenderShape.ARROW) {
                    ctx.moveTo(x + 8, y)
                    ctx.lineTo(x + -4, y - 4)
                    ctx.lineTo(x + -4, y + 4)
                    ctx.closePath()
                } else {
                    ctx.arc(x, y, 4, 0, Math.PI * 2)
                }
                ctx.fill()
            }

            if (output_slot) {
                let x = node._collapsed_width
                let y = LiteGraph.NODE_TITLE_HEIGHT * -0.5 //center
                if (horizontal) {
                    x = node._collapsed_width * 0.5
                    y = 0
                }
                ctx.fillStyle = "#686"
                ctx.strokeStyle = "black"
                ctx.beginPath()
                if (slot.type === LiteGraph.EVENT ||
                    slot.shape === RenderShape.BOX) {
                    ctx.rect(x - 7 + 0.5, y - 4, 14, 8)
                } else if (slot.shape === RenderShape.ARROW) {
                    ctx.moveTo(x + 6, y)
                    ctx.lineTo(x - 6, y - 4)
                    ctx.lineTo(x - 6, y + 4)
                    ctx.closePath()
                } else {
                    ctx.arc(x, y, 4, 0, Math.PI * 2)
                }
                ctx.fill()
                //ctx.stroke();
            }
        }

        if (node.clip_area) {
            ctx.restore()
        }

        ctx.globalAlpha = 1.0
    }
    //used by this.over_link_center
    drawLinkTooltip(ctx: CanvasRenderingContext2D, link: LLink): void {
        const pos = link._pos
        ctx.fillStyle = "black"
        ctx.beginPath()
        ctx.arc(pos[0], pos[1], 3, 0, Math.PI * 2)
        ctx.fill()

        if (link.data == null)
            return

        if (this.onDrawLinkTooltip?.(ctx, link, this) == true)
            return

        // TODO: Better value typing
        const data = link.data
        let text: string = null

        if (typeof data === "number")
            text = data.toFixed(2)
        else if (typeof data === "string")
            text = "\"" + data + "\""
        else if (typeof data === "boolean")
            text = String(data)
        else if (data.toToolTip)
            text = data.toToolTip()
        else
            text = "[" + data.constructor.name + "]"

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
     * @param selected Whether to render the node as selected.  Likely to be removed in future, as current usage is simply the is_selected property of the node.
     * @param mouse_over Deprecated
     */
    drawNodeShape(
        node: LGraphNode,
        ctx: CanvasRenderingContext2D,
        size: Size,
        fgcolor: CanvasColour,
        bgcolor: CanvasColour,
        selected: boolean
    ): void {
        //bg rect
        ctx.strokeStyle = fgcolor
        ctx.fillStyle = bgcolor

        const title_height = LiteGraph.NODE_TITLE_HEIGHT
        const low_quality = this.ds.scale < 0.5

        //render node area depending on shape
        const shape = node._shape || node.constructor.shape || RenderShape.ROUND
        const title_mode = node.constructor.title_mode

        const render_title = title_mode == TitleMode.TRANSPARENT_TITLE || title_mode == TitleMode.NO_TITLE
            ? false
            : true

        // Normalised node dimensions
        const area = LGraphCanvas.#tmp_area
        node.measure(area)
        area[0] -= node.pos[0]
        area[1] -= node.pos[1]
        area[2]++

        const old_alpha = ctx.globalAlpha

        //full node shape
        //if(node.flags.collapsed)
        {
            ctx.beginPath()
            if (shape == RenderShape.BOX || low_quality) {
                ctx.fillRect(area[0], area[1], area[2], area[3])
            } else if (shape == RenderShape.ROUND ||
                shape == RenderShape.CARD) {
                ctx.roundRect(
                    area[0],
                    area[1],
                    area[2],
                    area[3],
                    shape == RenderShape.CARD ? [this.round_radius, this.round_radius, 0, 0] : [this.round_radius]
                )
            } else if (shape == RenderShape.CIRCLE) {
                ctx.arc(
                    size[0] * 0.5,
                    size[1] * 0.5,
                    size[0] * 0.5,
                    0,
                    Math.PI * 2
                )
            }
            ctx.fill()

            //separator
            if (!node.flags.collapsed && render_title) {
                ctx.shadowColor = "transparent"
                ctx.fillStyle = "rgba(0,0,0,0.2)"
                ctx.fillRect(0, -1, area[2], 2)
            }
        }
        ctx.shadowColor = "transparent"

        node.onDrawBackground?.(ctx, this, this.canvas, this.graph_mouse)

        //title bg (remember, it is rendered ABOVE the node)
        if (render_title || title_mode == TitleMode.TRANSPARENT_TITLE) {
            //title bar
            if (node.onDrawTitleBar) {
                node.onDrawTitleBar(ctx, title_height, size, this.ds.scale, fgcolor)
            } else if (
                title_mode != TitleMode.TRANSPARENT_TITLE &&
                (node.constructor.title_color || this.render_title_colored)
            ) {
                const title_color = node.constructor.title_color || fgcolor

                if (node.flags.collapsed) {
                    ctx.shadowColor = LiteGraph.DEFAULT_SHADOW_COLOR
                }

                //* gradient test
                if (this.use_gradients) {
                    // TODO: This feature may not have been completed.  Could finish or remove.
                    // Original impl. may cause CanvasColour to be used as index key.  Also, colour requires validation before blindly passing on.
                    // @ts-expect-error Fix or remove gradient feature
                    let grad = LGraphCanvas.gradients[title_color]
                    if (!grad) {
                        // @ts-expect-error Fix or remove gradient feature
                        grad = LGraphCanvas.gradients[title_color] = ctx.createLinearGradient(0, 0, 400, 0)
                        grad.addColorStop(0, title_color)
                        grad.addColorStop(1, "#000")
                    }
                    ctx.fillStyle = grad
                } else {
                    ctx.fillStyle = title_color
                }

                //ctx.globalAlpha = 0.5 * old_alpha;
                ctx.beginPath()
                if (shape == RenderShape.BOX || low_quality) {
                    ctx.rect(0, -title_height, size[0] + 1, title_height)
                } else if (shape == RenderShape.ROUND || shape == RenderShape.CARD) {
                    ctx.roundRect(
                        0,
                        -title_height,
                        size[0] + 1,
                        title_height,
                        node.flags.collapsed ? [this.round_radius] : [this.round_radius, this.round_radius, 0, 0]
                    )
                }
                ctx.fill()
                ctx.shadowColor = "transparent"
            }

            let colState: string | boolean = false
            if (LiteGraph.node_box_coloured_by_mode) {
                if (LiteGraph.NODE_MODES_COLORS[node.mode]) {
                    colState = LiteGraph.NODE_MODES_COLORS[node.mode]
                }
            }
            if (LiteGraph.node_box_coloured_when_on) {
                colState = node.action_triggered ? "#FFF" : (node.execute_triggered ? "#AAA" : colState)
            }

            //title box
            const box_size = 10
            if (node.onDrawTitleBox) {
                node.onDrawTitleBox(ctx, title_height, size, this.ds.scale)
            } else if (shape == RenderShape.ROUND ||
                shape == RenderShape.CIRCLE ||
                shape == RenderShape.CARD) {
                if (low_quality) {
                    ctx.fillStyle = "black"
                    ctx.beginPath()
                    ctx.arc(
                        title_height * 0.5,
                        title_height * -0.5,
                        box_size * 0.5 + 1,
                        0,
                        Math.PI * 2
                    )
                    ctx.fill()
                }

                ctx.fillStyle = node.boxcolor || colState || LiteGraph.NODE_DEFAULT_BOXCOLOR
                if (low_quality)
                    ctx.fillRect(title_height * 0.5 - box_size * 0.5, title_height * -0.5 - box_size * 0.5, box_size, box_size)

                else {
                    ctx.beginPath()
                    ctx.arc(
                        title_height * 0.5,
                        title_height * -0.5,
                        box_size * 0.5,
                        0,
                        Math.PI * 2
                    )
                    ctx.fill()
                }
            } else {
                if (low_quality) {
                    ctx.fillStyle = "black"
                    ctx.fillRect(
                        (title_height - box_size) * 0.5 - 1,
                        (title_height + box_size) * -0.5 - 1,
                        box_size + 2,
                        box_size + 2
                    )
                }
                ctx.fillStyle = node.boxcolor || colState || LiteGraph.NODE_DEFAULT_BOXCOLOR
                ctx.fillRect(
                    (title_height - box_size) * 0.5,
                    (title_height + box_size) * -0.5,
                    box_size,
                    box_size
                )
            }
            ctx.globalAlpha = old_alpha

            //title text
            if (node.onDrawTitleText) {
                node.onDrawTitleText(
                    ctx,
                    title_height,
                    size,
                    this.ds.scale,
                    this.title_text_font,
                    selected
                )
            }
            if (!low_quality) {
                ctx.font = this.title_text_font
                const title = String(node.getTitle()) + (node.pinned ? "📌" : "")
                if (title) {
                    if (selected) {
                        ctx.fillStyle = LiteGraph.NODE_SELECTED_TITLE_COLOR
                    } else {
                        ctx.fillStyle =
                            node.constructor.title_text_color || this.node_title_color
                    }
                    if (node.flags.collapsed) {
                        ctx.textAlign = "left"
                        // const measure = ctx.measureText(title)
                        ctx.fillText(
                            title.substr(0, 20), //avoid urls too long
                            title_height, // + measure.width * 0.5,
                            LiteGraph.NODE_TITLE_TEXT_Y - title_height
                        )
                        ctx.textAlign = "left"
                    } else {
                        ctx.textAlign = "left"
                        ctx.fillText(
                            title,
                            title_height,
                            LiteGraph.NODE_TITLE_TEXT_Y - title_height
                        )
                    }
                }
            }

            //subgraph box
            if (!node.flags.collapsed && node.subgraph && !node.skip_subgraph_button) {
                const w = LiteGraph.NODE_TITLE_HEIGHT
                const x = node.size[0] - w
                const over = LiteGraph.isInsideRectangle(this.graph_mouse[0] - node.pos[0], this.graph_mouse[1] - node.pos[1], x + 2, -w + 2, w - 4, w - 4)
                ctx.fillStyle = over ? "#888" : "#555"
                if (shape == RenderShape.BOX || low_quality) {
                    ctx.fillRect(x + 2, -w + 2, w - 4, w - 4)
                }
                else {
                    ctx.beginPath()
                    ctx.roundRect(x + 2, -w + 2, w - 4, w - 4, [4])
                    ctx.fill()
                }
                ctx.fillStyle = "#333"
                ctx.beginPath()
                ctx.moveTo(x + w * 0.2, -w * 0.6)
                ctx.lineTo(x + w * 0.8, -w * 0.6)
                ctx.lineTo(x + w * 0.5, -w * 0.3)
                ctx.fill()
            }

            //custom title render
            node.onDrawTitle?.(ctx)
        }

        //render selection marker
        if (selected) {
            node.onBounding?.(area)

            this.drawSelectionBounding(
                ctx,
                area,
                {
                    shape,
                    title_height,
                    title_mode,
                    fgcolor,
                    collapsed: node.flags?.collapsed
                }
            )
        }

        // these counter helps in conditioning drawing based on if the node has been executed or an action occurred
        if (node.execute_triggered > 0) node.execute_triggered--
        if (node.action_triggered > 0) node.action_triggered--
    }

    /**
     * Draws the selection bounding of an area.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Vector4} area
     * @param {{
     *   shape: LiteGraph.Shape,
     *   title_height: number,
     *   title_mode: LiteGraph.TitleMode,
     *   fgcolor: string,
     *   padding: number,
     * }} options
     */
    drawSelectionBounding(
        ctx: CanvasRenderingContext2D,
        area: Rect,
        {
            shape = RenderShape.BOX,
            title_height = LiteGraph.NODE_TITLE_HEIGHT,
            title_mode = TitleMode.NORMAL_TITLE,
            fgcolor = LiteGraph.NODE_BOX_OUTLINE_COLOR,
            padding = 6,
            collapsed = false,
        }: IDrawSelectionBoundingOptions = {}
    ) {
        // Adjust area if title is transparent
        if (title_mode === TitleMode.TRANSPARENT_TITLE) {
            area[1] -= title_height
            area[3] += title_height
        }

        // Set up context
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.8
        ctx.beginPath()

        // Draw shape based on type
        const [x, y, width, height] = area
        switch (shape) {
            case RenderShape.BOX: {
                ctx.rect(x - padding, y - padding, width + 2 * padding, height + 2 * padding)
                break
            }
            case RenderShape.ROUND:
            case RenderShape.CARD: {
                const radius = this.round_radius * 2
                const isCollapsed = shape === RenderShape.CARD && collapsed
                const cornerRadii = isCollapsed || shape === RenderShape.ROUND ? [radius] : [radius, 2, radius, 2]
                ctx.roundRect(x - padding, y - padding, width + 2 * padding, height + 2 * padding, cornerRadii)
                break
            }
            case RenderShape.CIRCLE: {
                const centerX = x + width / 2
                const centerY = y + height / 2
                const radius = Math.max(width, height) / 2 + padding
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
                break
            }
        }

        // Stroke the shape
        ctx.strokeStyle = LiteGraph.NODE_BOX_OUTLINE_COLOR
        ctx.stroke()

        // Reset context
        ctx.strokeStyle = fgcolor
        ctx.globalAlpha = 1
    }

    drawConnections(ctx: CanvasRenderingContext2D): void {
        const now = LiteGraph.getTime()
        const visible_area = this.visible_area
        LGraphCanvas.#margin_area[0] = visible_area[0] - 20
        LGraphCanvas.#margin_area[1] = visible_area[1] - 20
        LGraphCanvas.#margin_area[2] = visible_area[2] + 40
        LGraphCanvas.#margin_area[3] = visible_area[3] + 40

        //draw connections
        ctx.lineWidth = this.connections_width

        ctx.fillStyle = "#AAA"
        ctx.strokeStyle = "#AAA"
        ctx.globalAlpha = this.editor_alpha
        //for every node
        const nodes = this.graph._nodes
        for (let n = 0, l = nodes.length; n < l; ++n) {
            const node = nodes[n]
            //for every input (we render just inputs because it is easier as every slot can only have one input)
            if (!node.inputs || !node.inputs.length) continue

            for (let i = 0; i < node.inputs.length; ++i) {
                const input = node.inputs[i]
                if (!input || input.link == null) continue

                const link_id = input.link
                const link = this.graph.links[link_id]
                if (!link) continue

                //find link info
                const start_node = this.graph.getNodeById(link.origin_id)
                if (start_node == null) continue

                const start_node_slot = link.origin_slot
                let start_node_slotpos: Point = null
                if (start_node_slot == -1) {
                    start_node_slotpos = [
                        start_node.pos[0] + 10,
                        start_node.pos[1] + 10
                    ]
                } else {
                    start_node_slotpos = start_node.getConnectionPos(
                        false,
                        start_node_slot,
                        LGraphCanvas.#tempA
                    )
                }
                const end_node_slotpos = node.getConnectionPos(true, i, LGraphCanvas.#tempB)

                //compute link bounding
                LGraphCanvas.#link_bounding[0] = start_node_slotpos[0]
                LGraphCanvas.#link_bounding[1] = start_node_slotpos[1]
                LGraphCanvas.#link_bounding[2] = end_node_slotpos[0] - start_node_slotpos[0]
                LGraphCanvas.#link_bounding[3] = end_node_slotpos[1] - start_node_slotpos[1]
                if (LGraphCanvas.#link_bounding[2] < 0) {
                    LGraphCanvas.#link_bounding[0] += LGraphCanvas.#link_bounding[2]
                    LGraphCanvas.#link_bounding[2] = Math.abs(LGraphCanvas.#link_bounding[2])
                }
                if (LGraphCanvas.#link_bounding[3] < 0) {
                    LGraphCanvas.#link_bounding[1] += LGraphCanvas.#link_bounding[3]
                    LGraphCanvas.#link_bounding[3] = Math.abs(LGraphCanvas.#link_bounding[3])
                }

                //skip links outside of the visible area of the canvas
                if (!overlapBounding(LGraphCanvas.#link_bounding, LGraphCanvas.#margin_area))
                    continue

                const start_slot = start_node.outputs[start_node_slot]
                const end_slot = node.inputs[i]
                if (!start_slot || !end_slot)
                    continue
                const start_dir = start_slot.dir ||
                    (start_node.horizontal ? LinkDirection.DOWN : LinkDirection.RIGHT)
                const end_dir = end_slot.dir ||
                    (node.horizontal ? LinkDirection.UP : LinkDirection.LEFT)

                this.renderLink(
                    ctx,
                    start_node_slotpos,
                    end_node_slotpos,
                    link,
                    false,
                    0,
                    null,
                    start_dir,
                    end_dir
                )

                //event triggered rendered on top
                if (link && link._last_time && now - link._last_time < 1000) {
                    const f = 2.0 - (now - link._last_time) * 0.002
                    const tmp = ctx.globalAlpha
                    ctx.globalAlpha = tmp * f
                    this.renderLink(
                        ctx,
                        start_node_slotpos,
                        end_node_slotpos,
                        link,
                        true,
                        f,
                        "white",
                        start_dir,
                        end_dir
                    )
                    ctx.globalAlpha = tmp
                }
            }
        }
        ctx.globalAlpha = 1
    }

    /**
     * draws a link between two points
     * @param {vec2} a start pos
     * @param {vec2} b end pos
     * @param {Object} link the link object with all the link info
     * @param {boolean} skip_border ignore the shadow of the link
     * @param {boolean} flow show flow animation (for events)
     * @param {string} color the color for the link
     * @param {LinkDirection} start_dir the direction enum
     * @param {LinkDirection} end_dir the direction enum
     * @param {number} num_sublines number of sublines (useful to represent vec3 or rgb)
     **/
    renderLink(ctx: CanvasRenderingContext2D,
        a: Point,
        b: Point,
        link: LLink,
        skip_border: boolean,
        flow: number,
        color: CanvasColour,
        start_dir: LinkDirection,
        end_dir: LinkDirection,
        num_sublines?: number): void {

        if (link) {
            this.visible_links.push(link)
        }

        //choose color
        if (!color && link) {
            color = link.color || LGraphCanvas.link_type_colors[link.type]
        }
        color ||= this.default_link_color
        if (link != null && this.highlighted_links[link.id]) {
            color = "#FFF"
        }

        start_dir = start_dir || LinkDirection.RIGHT
        end_dir = end_dir || LinkDirection.LEFT

        const dist = distance(a, b)

        // TODO: Subline code below was inserted in the wrong place - should be before this statement
        if (this.render_connections_border && this.ds.scale > 0.6) {
            ctx.lineWidth = this.connections_width + 4
        }
        ctx.lineJoin = "round"
        num_sublines ||= 1
        if (num_sublines > 1) {
            ctx.lineWidth = 0.5
        }

        //begin line shape
        const path = new Path2D()
        if (link) {
            // Store the path on the link for hittests
            link.path = path
        }
        for (let i = 0; i < num_sublines; i += 1) {
            const offsety = (i - (num_sublines - 1) * 0.5) * 5

            if (this.links_render_mode == LinkRenderType.SPLINE_LINK) {
                path.moveTo(a[0], a[1] + offsety)
                let start_offset_x = 0
                let start_offset_y = 0
                let end_offset_x = 0
                let end_offset_y = 0
                switch (start_dir) {
                    case LinkDirection.LEFT:
                        start_offset_x = dist * -0.25
                        break
                    case LinkDirection.RIGHT:
                        start_offset_x = dist * 0.25
                        break
                    case LinkDirection.UP:
                        start_offset_y = dist * -0.25
                        break
                    case LinkDirection.DOWN:
                        start_offset_y = dist * 0.25
                        break
                }
                switch (end_dir) {
                    case LinkDirection.LEFT:
                        end_offset_x = dist * -0.25
                        break
                    case LinkDirection.RIGHT:
                        end_offset_x = dist * 0.25
                        break
                    case LinkDirection.UP:
                        end_offset_y = dist * -0.25
                        break
                    case LinkDirection.DOWN:
                        end_offset_y = dist * 0.25
                        break
                }
                path.bezierCurveTo(
                    a[0] + start_offset_x,
                    a[1] + start_offset_y + offsety,
                    b[0] + end_offset_x,
                    b[1] + end_offset_y + offsety,
                    b[0],
                    b[1] + offsety
                )
            } else if (this.links_render_mode == LinkRenderType.LINEAR_LINK) {
                path.moveTo(a[0], a[1] + offsety)
                let start_offset_x = 0
                let start_offset_y = 0
                let end_offset_x = 0
                let end_offset_y = 0
                switch (start_dir) {
                    case LinkDirection.LEFT:
                        start_offset_x = -1
                        break
                    case LinkDirection.RIGHT:
                        start_offset_x = 1
                        break
                    case LinkDirection.UP:
                        start_offset_y = -1
                        break
                    case LinkDirection.DOWN:
                        start_offset_y = 1
                        break
                }
                switch (end_dir) {
                    case LinkDirection.LEFT:
                        end_offset_x = -1
                        break
                    case LinkDirection.RIGHT:
                        end_offset_x = 1
                        break
                    case LinkDirection.UP:
                        end_offset_y = -1
                        break
                    case LinkDirection.DOWN:
                        end_offset_y = 1
                        break
                }
                const l = 15
                path.lineTo(
                    a[0] + start_offset_x * l,
                    a[1] + start_offset_y * l + offsety
                )
                path.lineTo(
                    b[0] + end_offset_x * l,
                    b[1] + end_offset_y * l + offsety
                )
                path.lineTo(b[0], b[1] + offsety)
            } else if (this.links_render_mode == LinkRenderType.STRAIGHT_LINK) {
                path.moveTo(a[0], a[1])
                let start_x = a[0]
                let start_y = a[1]
                let end_x = b[0]
                let end_y = b[1]
                if (start_dir == LinkDirection.RIGHT) {
                    start_x += 10
                } else {
                    start_y += 10
                }
                if (end_dir == LinkDirection.LEFT) {
                    end_x -= 10
                } else {
                    end_y -= 10
                }
                path.lineTo(start_x, start_y)
                path.lineTo((start_x + end_x) * 0.5, start_y)
                path.lineTo((start_x + end_x) * 0.5, end_y)
                path.lineTo(end_x, end_y)
                path.lineTo(b[0], b[1])
            } else {
                return
            } //unknown
        }

        //rendering the outline of the connection can be a little bit slow
        if (this.render_connections_border &&
            this.ds.scale > 0.6 &&
            !skip_border) {
            ctx.strokeStyle = "rgba(0,0,0,0.5)"
            ctx.stroke(path)
        }

        ctx.lineWidth = this.connections_width
        ctx.fillStyle = ctx.strokeStyle = color
        ctx.stroke(path)
        //end line shape
        const pos = this.computeConnectionPoint(a, b, 0.5, start_dir, end_dir)
        if (link?._pos) {
            link._pos[0] = pos[0]
            link._pos[1] = pos[1]
        }

        //render arrow in the middle
        if (this.ds.scale >= 0.6 &&
            this.highquality_render &&
            end_dir != LinkDirection.CENTER) {
            //render arrow
            if (this.render_connection_arrows) {
                //compute two points in the connection
                const posA = this.computeConnectionPoint(
                    a,
                    b,
                    0.25,
                    start_dir,
                    end_dir
                )
                const posB = this.computeConnectionPoint(
                    a,
                    b,
                    0.26,
                    start_dir,
                    end_dir
                )
                const posC = this.computeConnectionPoint(
                    a,
                    b,
                    0.75,
                    start_dir,
                    end_dir
                )
                const posD = this.computeConnectionPoint(
                    a,
                    b,
                    0.76,
                    start_dir,
                    end_dir
                )

                //compute the angle between them so the arrow points in the right direction
                let angleA = 0
                let angleB = 0
                if (this.render_curved_connections) {
                    angleA = -Math.atan2(posB[0] - posA[0], posB[1] - posA[1])
                    angleB = -Math.atan2(posD[0] - posC[0], posD[1] - posC[1])
                } else {
                    angleB = angleA = b[1] > a[1] ? 0 : Math.PI
                }

                //render arrow
                ctx.save()
                ctx.translate(posA[0], posA[1])
                ctx.rotate(angleA)
                ctx.beginPath()
                ctx.moveTo(-5, -3)
                ctx.lineTo(0, +7)
                ctx.lineTo(+5, -3)
                ctx.fill()
                ctx.restore()
                ctx.save()
                ctx.translate(posC[0], posC[1])
                ctx.rotate(angleB)
                ctx.beginPath()
                ctx.moveTo(-5, -3)
                ctx.lineTo(0, +7)
                ctx.lineTo(+5, -3)
                ctx.fill()
                ctx.restore()
            }

            //circle
            ctx.beginPath()
            ctx.arc(pos[0], pos[1], 5, 0, Math.PI * 2)
            ctx.fill()
        }

        //render flowing points
        if (flow) {
            ctx.fillStyle = color
            for (let i = 0; i < 5; ++i) {
                const f = (LiteGraph.getTime() * 0.001 + i * 0.2) % 1
                const flowPos = this.computeConnectionPoint(
                    a,
                    b,
                    f,
                    start_dir,
                    end_dir
                )
                ctx.beginPath()
                ctx.arc(flowPos[0], flowPos[1], 5, 0, 2 * Math.PI)
                ctx.fill()
            }
        }
    }
    //returns the link center point based on curvature
    computeConnectionPoint(a: Point,
        b: Point,
        t: number,
        start_dir: number,
        end_dir: number): number[] {
        start_dir ||= LinkDirection.RIGHT
        end_dir ||= LinkDirection.LEFT

        const dist = distance(a, b)
        const p0 = a
        const p1 = [a[0], a[1]]
        const p2 = [b[0], b[1]]
        const p3 = b

        switch (start_dir) {
            case LinkDirection.LEFT:
                p1[0] += dist * -0.25
                break
            case LinkDirection.RIGHT:
                p1[0] += dist * 0.25
                break
            case LinkDirection.UP:
                p1[1] += dist * -0.25
                break
            case LinkDirection.DOWN:
                p1[1] += dist * 0.25
                break
        }
        switch (end_dir) {
            case LinkDirection.LEFT:
                p2[0] += dist * -0.25
                break
            case LinkDirection.RIGHT:
                p2[0] += dist * 0.25
                break
            case LinkDirection.UP:
                p2[1] += dist * -0.25
                break
            case LinkDirection.DOWN:
                p2[1] += dist * 0.25
                break
        }

        const c1 = (1 - t) * (1 - t) * (1 - t)
        const c2 = 3 * ((1 - t) * (1 - t)) * t
        const c3 = 3 * (1 - t) * (t * t)
        const c4 = t * t * t

        const x = c1 * p0[0] + c2 * p1[0] + c3 * p2[0] + c4 * p3[0]
        const y = c1 * p0[1] + c2 * p1[1] + c3 * p2[1] + c4 * p3[1]
        return [x, y]
    }
    drawExecutionOrder(ctx: CanvasRenderingContext2D): void {
        ctx.shadowColor = "transparent"
        ctx.globalAlpha = 0.25

        ctx.textAlign = "center"
        ctx.strokeStyle = "white"
        ctx.globalAlpha = 0.75

        const visible_nodes = this.visible_nodes
        for (let i = 0; i < visible_nodes.length; ++i) {
            const node = visible_nodes[i]
            ctx.fillStyle = "black"
            ctx.fillRect(
                node.pos[0] - LiteGraph.NODE_TITLE_HEIGHT,
                node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT,
                LiteGraph.NODE_TITLE_HEIGHT,
                LiteGraph.NODE_TITLE_HEIGHT
            )
            if (node.order == 0) {
                ctx.strokeRect(
                    node.pos[0] - LiteGraph.NODE_TITLE_HEIGHT + 0.5,
                    node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT + 0.5,
                    LiteGraph.NODE_TITLE_HEIGHT,
                    LiteGraph.NODE_TITLE_HEIGHT
                )
            }
            ctx.fillStyle = "#FFF"
            ctx.fillText(
                stringOrEmpty(node.order),
                node.pos[0] + LiteGraph.NODE_TITLE_HEIGHT * -0.5,
                node.pos[1] - 6
            )
        }
        ctx.globalAlpha = 1
    }
    /**
     * draws the widgets stored inside a node
     **/
    drawNodeWidgets(node: LGraphNode,
        posY: number,
        ctx: CanvasRenderingContext2D,
        active_widget: IWidget) {
        if (!node.widgets || !node.widgets.length) return 0
        const width = node.size[0]
        const widgets = node.widgets
        posY += 2
        const H = LiteGraph.NODE_WIDGET_HEIGHT
        const show_text = this.ds.scale > 0.5
        ctx.save()
        ctx.globalAlpha = this.editor_alpha
        const outline_color = LiteGraph.WIDGET_OUTLINE_COLOR
        const background_color = LiteGraph.WIDGET_BGCOLOR
        const text_color = LiteGraph.WIDGET_TEXT_COLOR
        const secondary_text_color = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR
        const margin = 15

        for (let i = 0; i < widgets.length; ++i) {
            const w = widgets[i]
            if(w.hidden || (w.advanced && !node.showAdvanced)) continue;
            const y = w.y || posY

            if (w === this.link_over_widget) {
                ctx.fillStyle = this.default_connection_color_byType[this.link_over_widget_type] ||
                    this.default_connection_color.input_on

                // Manually draw a slot next to the widget simulating an input
                drawSlot(ctx, {}, [10, y + 10], {})
            }

            w.last_y = y
            ctx.strokeStyle = outline_color
            ctx.fillStyle = "#222"
            ctx.textAlign = "left"
            //ctx.lineWidth = 2;
            if (w.disabled)
                ctx.globalAlpha *= 0.5
            const widget_width = w.width || width

            switch (w.type) {
                case "button":
                    ctx.fillStyle = background_color
                    if (w.clicked) {
                        ctx.fillStyle = "#AAA"
                        w.clicked = false
                        this.dirty_canvas = true
                    }
                    ctx.fillRect(margin, y, widget_width - margin * 2, H)
                    if (show_text && !w.disabled)
                        ctx.strokeRect(margin, y, widget_width - margin * 2, H)
                    if (show_text) {
                        ctx.textAlign = "center"
                        ctx.fillStyle = text_color
                        ctx.fillText(w.label || w.name, widget_width * 0.5, y + H * 0.7)
                    }
                    break
                case "toggle":
                    ctx.textAlign = "left"
                    ctx.strokeStyle = outline_color
                    ctx.fillStyle = background_color
                    ctx.beginPath()
                    if (show_text)
                        ctx.roundRect(margin, y, widget_width - margin * 2, H, [H * 0.5])

                    else
                        ctx.rect(margin, y, widget_width - margin * 2, H)
                    ctx.fill()
                    if (show_text && !w.disabled)
                        ctx.stroke()
                    ctx.fillStyle = w.value ? "#89A" : "#333"
                    ctx.beginPath()
                    ctx.arc(widget_width - margin * 2, y + H * 0.5, H * 0.36, 0, Math.PI * 2)
                    ctx.fill()
                    if (show_text) {
                        ctx.fillStyle = secondary_text_color
                        const label = w.label || w.name
                        if (label != null) {
                            ctx.fillText(label, margin * 2, y + H * 0.7)
                        }
                        ctx.fillStyle = w.value ? text_color : secondary_text_color
                        ctx.textAlign = "right"
                        ctx.fillText(
                            w.value
                                ? w.options.on || "true"
                                : w.options.off || "false",
                            widget_width - 40,
                            y + H * 0.7
                        )
                    }
                    break
                case "slider": {
                    ctx.fillStyle = background_color
                    ctx.fillRect(margin, y, widget_width - margin * 2, H)
                    const range = w.options.max - w.options.min
                    let nvalue = (w.value - w.options.min) / range
                    if (nvalue < 0.0) nvalue = 0.0
                    if (nvalue > 1.0) nvalue = 1.0
                    ctx.fillStyle = w.options.hasOwnProperty("slider_color") ? w.options.slider_color : (active_widget == w ? "#89A" : "#678")
                    ctx.fillRect(margin, y, nvalue * (widget_width - margin * 2), H)
                    if (show_text && !w.disabled)
                        ctx.strokeRect(margin, y, widget_width - margin * 2, H)
                    if (w.marker) {
                        let marker_nvalue = (w.marker - w.options.min) / range
                        if (marker_nvalue < 0.0) marker_nvalue = 0.0
                        if (marker_nvalue > 1.0) marker_nvalue = 1.0
                        ctx.fillStyle = w.options.hasOwnProperty("marker_color") ? w.options.marker_color : "#AA9"
                        ctx.fillRect(margin + marker_nvalue * (widget_width - margin * 2), y, 2, H)
                    }
                    if (show_text) {
                        ctx.textAlign = "center"
                        ctx.fillStyle = text_color
                        ctx.fillText(
                            w.label || w.name + "  " + Number(w.value).toFixed(
                                w.options.precision != null
                                    ? w.options.precision
                                    : 3
                            ),
                            widget_width * 0.5,
                            y + H * 0.7
                        )
                    }
                    break
                }
                case "number":
                case "combo":
                    ctx.textAlign = "left"
                    ctx.strokeStyle = outline_color
                    ctx.fillStyle = background_color
                    ctx.beginPath()
                    if (show_text)
                        ctx.roundRect(margin, y, widget_width - margin * 2, H, [H * 0.5])

                    else
                        ctx.rect(margin, y, widget_width - margin * 2, H)
                    ctx.fill()
                    if (show_text) {
                        if (!w.disabled)
                            ctx.stroke()
                        ctx.fillStyle = text_color
                        if (!w.disabled) {
                            ctx.beginPath()
                            ctx.moveTo(margin + 16, y + 5)
                            ctx.lineTo(margin + 6, y + H * 0.5)
                            ctx.lineTo(margin + 16, y + H - 5)
                            ctx.fill()
                            ctx.beginPath()
                            ctx.moveTo(widget_width - margin - 16, y + 5)
                            ctx.lineTo(widget_width - margin - 6, y + H * 0.5)
                            ctx.lineTo(widget_width - margin - 16, y + H - 5)
                            ctx.fill()
                        }
                        ctx.fillStyle = secondary_text_color
                        ctx.fillText(w.label || w.name, margin * 2 + 5, y + H * 0.7)
                        ctx.fillStyle = text_color
                        ctx.textAlign = "right"
                        if (w.type == "number") {
                            ctx.fillText(
                                Number(w.value).toFixed(
                                    w.options.precision !== undefined
                                        ? w.options.precision
                                        : 3
                                ),
                                widget_width - margin * 2 - 20,
                                y + H * 0.7
                            )
                        } else {
                            let v = typeof w.value === "number" ? String(w.value) : w.value
                            if (w.options.values) {
                                let values = w.options.values
                                if (typeof values === "function")
                                    // @ts-expect-error
                                    values = values()
                                if (values && !Array.isArray(values))
                                    v = values[w.value]
                            }
                            const labelWidth = ctx.measureText(w.label || w.name).width + margin * 2
                            const inputWidth = widget_width - margin * 4
                            const availableWidth = inputWidth - labelWidth
                            const textWidth = ctx.measureText(v).width
                            if (textWidth > availableWidth) {
                                const ELLIPSIS = "\u2026"
                                const ellipsisWidth = ctx.measureText(ELLIPSIS).width
                                const charWidthAvg = ctx.measureText("a").width
                                if (availableWidth <= ellipsisWidth) {
                                    v = "\u2024" // One dot leader
                                } else {
                                    v = `${v}`
                                    const overflowWidth = (textWidth + ellipsisWidth) - availableWidth
                                    // Only first 3 characters need to be measured precisely
                                    if (overflowWidth + charWidthAvg * 3 > availableWidth) {
                                        const preciseRange = availableWidth + charWidthAvg * 3
                                        const preTruncateCt = Math.floor((preciseRange - ellipsisWidth) / charWidthAvg)
                                        v = v.substr(0, preTruncateCt)
                                    }
                                    while (ctx.measureText(v).width + ellipsisWidth > availableWidth) {
                                        v = v.substr(0, v.length - 1)
                                    }
                                    v += ELLIPSIS
                                }
                            }
                            ctx.fillText(
                                v,
                                widget_width - margin * 2 - 20,
                                y + H * 0.7
                            )
                        }
                    }
                    break
                case "string":
                case "text":
                    ctx.textAlign = "left"
                    ctx.strokeStyle = outline_color
                    ctx.fillStyle = background_color
                    ctx.beginPath()

                    if (show_text)
                        ctx.roundRect(margin, y, widget_width - margin * 2, H, [H * 0.5])
                    else
                        ctx.rect(margin, y, widget_width - margin * 2, H)
                    ctx.fill()
                    if (show_text) {
                        if (!w.disabled)
                            ctx.stroke()
                        ctx.save()
                        ctx.beginPath()
                        ctx.rect(margin, y, widget_width - margin * 2, H)
                        ctx.clip()

                        //ctx.stroke();
                        ctx.fillStyle = secondary_text_color
                        const label = w.label || w.name
                        if (label != null)
                            ctx.fillText(label, margin * 2, y + H * 0.7)
                        ctx.fillStyle = text_color
                        ctx.textAlign = "right"
                        ctx.fillText(String(w.value).substr(0, 30), widget_width - margin * 2, y + H * 0.7) //30 chars max
                        ctx.restore()
                    }
                    break
                // Custom widgets
                default:
                    w.draw?.(ctx, node, widget_width, y, H)
                    break
            }
            posY += (w.computeSize ? w.computeSize(widget_width)[1] : H) + 4
            ctx.globalAlpha = this.editor_alpha

        }
        ctx.restore()
        ctx.textAlign = "left"
    }
    /**
     * process an event on widgets
     **/
    processNodeWidgets(node: LGraphNode,
        // TODO: Hitting enter does not trigger onWidgetChanged - may require a separate value processor for processKey
        pos: Point,
        event: CanvasMouseEvent,
        active_widget?: IWidget): IWidget {
        if (!node.widgets || !node.widgets.length || (!this.allow_interaction && !node.flags.allow_interaction)) {
            return null
        }

        const x = pos[0] - node.pos[0]
        const y = pos[1] - node.pos[1]
        const width = node.size[0]
        const that = this
        const ref_window = this.getCanvasWindow()

        let values
        let values_list
        for (let i = 0; i < node.widgets.length; ++i) {
            const w = node.widgets[i]
            if (!w || w.disabled || w.hidden || (w.advanced && !node.showAdvanced))
                continue
            const widget_height = w.computeSize ? w.computeSize(width)[1] : LiteGraph.NODE_WIDGET_HEIGHT
            const widget_width = w.width || width
            //outside
            if (w != active_widget &&
                (x < 6 || x > widget_width - 12 || y < w.last_y || y > w.last_y + widget_height || w.last_y === undefined))
                continue

            const old_value = w.value

            //if ( w == active_widget || (x > 6 && x < widget_width - 12 && y > w.last_y && y < w.last_y + widget_height) ) {
            //inside widget
            switch (w.type) {
                case "button": {
                    // FIXME: This one-function-to-rule-them-all pattern is nuts.  Split events into manageable chunks.
                    if (event.type === LiteGraph.pointerevents_method + "down") {
                        if (w.callback) {
                            setTimeout(function () {
                                w.callback(w, that, node, pos, event)
                            }, 20)
                        }
                        w.clicked = true
                        this.dirty_canvas = true
                    }
                    break
                }
                case "slider": {
                    const nvalue = clamp((x - 15) / (widget_width - 30), 0, 1)
                    if (w.options.read_only) break
                    w.value = w.options.min + (w.options.max - w.options.min) * nvalue
                    if (old_value != w.value) {
                        setTimeout(function () {
                            inner_value_change(w, w.value)
                        }, 20)
                    }
                    this.dirty_canvas = true
                    break
                }
                case "number":
                case "combo": {
                    let delta = x < 40 ? -1 : x > widget_width - 40 ? 1 : 0
                    const allow_scroll = delta && (x > -3 && x < widget_width + 3)
                        ? false
                        : true
                    // TODO: Type checks on widget values
                    if (allow_scroll && event.type == LiteGraph.pointerevents_method + "move" && w.type == "number") {
                        if (event.deltaX)
                            w.value += event.deltaX * 0.1 * (w.options.step || 1)
                        if (w.options.min != null && w.value < w.options.min) {
                            w.value = w.options.min
                        }
                        if (w.options.max != null && w.value > w.options.max) {
                            w.value = w.options.max
                        }
                    } else if (event.type == LiteGraph.pointerevents_method + "down") {
                        values = w.options.values
                        if (typeof values === "function") {
                            // @ts-expect-error
                            values = w.options.values(w, node)
                        }
                        values_list = null

                        if (w.type != "number")
                            values_list = Array.isArray(values) ? values : Object.keys(values)

                        delta = x < 40 ? -1 : x > widget_width - 40 ? 1 : 0
                        if (w.type == "number") {
                            w.value += delta * 0.1 * (w.options.step || 1)
                            if (w.options.min != null && w.value < w.options.min) {
                                w.value = w.options.min
                            }
                            if (w.options.max != null && w.value > w.options.max) {
                                w.value = w.options.max
                            }
                        } else if (delta) { //clicked in arrow, used for combos 
                            let index = -1
                            this.last_mouseclick = 0 //avoids dobl click event
                            index = typeof values === "object"
                                ? values_list.indexOf(String(w.value)) + delta
                                : values_list.indexOf(w.value) + delta

                            if (index >= values_list.length) index = values_list.length - 1
                            if (index < 0) index = 0

                            w.value = Array.isArray(values)
                                ? values[index]
                                : index
                        } else { //combo clicked 
                            const text_values = values != values_list ? Object.values(values) : values
                            new LiteGraph.ContextMenu(text_values, {
                                scale: Math.max(1, this.ds.scale),
                                event: event,
                                className: "dark",
                                callback: inner_clicked.bind(w)
                            },
                                // @ts-expect-error Not impl - harmless
                                ref_window)
                            function inner_clicked(v) {
                                if (values != values_list)
                                    v = text_values.indexOf(v)
                                this.value = v
                                inner_value_change(this, v)
                                that.dirty_canvas = true
                                return false
                            }
                        }
                    } //end mousedown
                    else if (event.type == LiteGraph.pointerevents_method + "up" && w.type == "number") {
                        delta = x < 40 ? -1 : x > widget_width - 40 ? 1 : 0
                        if (event.click_time < 200 && delta == 0) {
                            this.prompt("Value", w.value, function (v) {
                                // check if v is a valid equation or a number
                                if (/^[0-9+\-*/()\s]+|\d+\.\d+$/.test(v)) {
                                    try { //solve the equation if possible
                                        v = eval(v)
                                    } catch { }
                                }
                                this.value = Number(v)
                                inner_value_change(this, this.value)
                            }.bind(w),
                                event)
                        }
                    }

                    if (old_value != w.value)
                        setTimeout(
                            function () {
                                inner_value_change(this, this.value)
                            }.bind(w),
                            20
                        )
                    this.dirty_canvas = true
                    break
                }
                case "toggle":
                    if (event.type == LiteGraph.pointerevents_method + "down") {
                        w.value = !w.value
                        setTimeout(function () {
                            inner_value_change(w, w.value)
                        }, 20)
                    }
                    break
                case "string":
                case "text":
                    if (event.type == LiteGraph.pointerevents_method + "down") {
                        this.prompt("Value", w.value, function (v: any) {
                            inner_value_change(this, v)
                        }.bind(w),
                            event, w.options ? w.options.multiline : false)
                    }
                    break
                default:
                    if (w.mouse) this.dirty_canvas = w.mouse(event, [x, y], node)
                    break
            } //end switch

            //value changed
            if (old_value != w.value) {
                node.onWidgetChanged?.(w.name, w.value, old_value, w)
                node.graph._version++
            }

            return w
        } //end for

        function inner_value_change(widget: IWidget, value: TWidgetValue) {
            const v = widget.type === "number" ? Number(value) : value
            widget.value = v
            if (widget.options?.property && node.properties[widget.options.property] !== undefined) {
                node.setProperty(widget.options.property, v)
            }
            widget.callback?.(widget.value, that, node, pos, event)
        }

        return null
    }

    /**
     * draws every group area in the background
     **/
    drawGroups(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
        if (!this.graph) return

        const groups = this.graph._groups

        ctx.save()
        ctx.globalAlpha = 0.5 * this.editor_alpha

        for (let i = 0; i < groups.length; ++i) {
            const group = groups[i]

            if (!overlapBounding(this.visible_area, group._bounding)) {
                continue
            } //out of the visible area

            group.draw(this, ctx)
        }

        ctx.restore()
    }
    adjustNodesSize(): void {
        const nodes = this.graph._nodes
        for (let i = 0; i < nodes.length; ++i) {
            nodes[i].size = nodes[i].computeSize()
        }
        this.setDirty(true, true)
    }
    /**
     * resizes the canvas to a given size, if no size is passed, then it tries to fill the parentNode
     * @todo Remove or rewrite
     **/
    resize(width?: number, height?: number): void {
        if (!width && !height) {
            const parent = this.canvas.parentElement
            width = parent.offsetWidth
            height = parent.offsetHeight
        }

        if (this.canvas.width == width && this.canvas.height == height)
            return

        this.canvas.width = width
        this.canvas.height = height
        this.bgcanvas.width = this.canvas.width
        this.bgcanvas.height = this.canvas.height
        this.setDirty(true, true)
    }
    /**
     * switches to live mode (node shapes are not rendered, only the content)
     * this feature was designed when graphs where meant to create user interfaces
     **/
    switchLiveMode(transition: boolean): void {
        if (!transition) {
            this.live_mode = !this.live_mode
            this.dirty_canvas = true
            this.dirty_bgcanvas = true
            return
        }

        const self = this
        const delta = this.live_mode ? 1.1 : 0.9
        if (this.live_mode) {
            this.live_mode = false
            this.editor_alpha = 0.1
        }

        const t = setInterval(function () {
            self.editor_alpha *= delta
            self.dirty_canvas = true
            self.dirty_bgcanvas = true

            if (delta < 1 && self.editor_alpha < 0.01) {
                clearInterval(t)
                if (delta < 1) self.live_mode = true
            }
            if (delta > 1 && self.editor_alpha > 0.99) {
                clearInterval(t)
                self.editor_alpha = 1
            }
        }, 1)
    }

    onNodeSelectionChange(): void { }

    /**
     * Determines the furthest nodes in each direction for the currently selected nodes
     * @return {{left: LGraphNode, top: LGraphNode, right: LGraphNode, bottom: LGraphNode}}
     */
    boundaryNodesForSelection(): NullableProperties<IBoundaryNodes> {
        return LGraphCanvas.getBoundaryNodes(this.selected_nodes)
    }
    showLinkMenu(link: LLink, e: CanvasMouseEvent): boolean {
        const graph = this.graph
        const node_left = graph.getNodeById(link.origin_id)
        const node_right = graph.getNodeById(link.target_id)
        // TODO: Replace ternary with ?? ""
        const fromType = node_left?.outputs?.[link.origin_slot]
            ? node_left.outputs[link.origin_slot].type
            : false
        const destType = node_right?.outputs?.[link.target_slot]
            ? node_right.inputs[link.target_slot].type
            : false

        const options = ["Add Node", null, "Delete", null]

        const menu = new LiteGraph.ContextMenu(options, {
            event: e,
            title: link.data != null ? link.data.constructor.name : null,
            callback: inner_clicked
        })

        function inner_clicked(v: string, options: unknown, e: MouseEvent) {
            switch (v) {
                case "Add Node":
                    LGraphCanvas.onMenuAdd(null, null, e, menu, function (node) {
                        if (!node.inputs?.length || !node.outputs?.length) return

                        // leave the connection type checking inside connectByType
                        // @ts-expect-error Assigning from check to false results in the type being treated as "*".  This should fail.
                        if (node_left.connectByType(link.origin_slot, node, fromType)) {
                            // @ts-expect-error Assigning from check to false results in the type being treated as "*".  This should fail.
                            node.connectByType(link.target_slot, node_right, destType)
                            node.pos[0] -= node.size[0] * 0.5
                        }
                    })
                    break

                case "Delete":
                    graph.removeLink(link.id)
                    break
                default:
            }
        }

        return false
    }
    createDefaultNodeForSlot(optPass: ICreateNodeOptions): boolean {
        const opts = Object.assign<ICreateNodeOptions, ICreateNodeOptions>({
            nodeFrom: null,
            slotFrom: null,
            nodeTo: null,
            slotTo: null,
            position: [0, 0],
            nodeType: null,
            posAdd: [0, 0],
            posSizeFix: [0, 0]
        }, optPass || {})

        const isFrom = opts.nodeFrom && opts.slotFrom !== null
        const isTo = !isFrom && opts.nodeTo && opts.slotTo !== null

        if (!isFrom && !isTo) {
            console.warn("No data passed to createDefaultNodeForSlot " + opts.nodeFrom + " " + opts.slotFrom + " " + opts.nodeTo + " " + opts.slotTo)
            return false
        }
        if (!opts.nodeType) {
            console.warn("No type to createDefaultNodeForSlot")
            return false
        }

        const nodeX = isFrom ? opts.nodeFrom : opts.nodeTo
        let slotX = isFrom ? opts.slotFrom : opts.slotTo

        let iSlotConn: number | false = false
        switch (typeof slotX) {
            case "string":
                iSlotConn = isFrom ? nodeX.findOutputSlot(slotX, false) : nodeX.findInputSlot(slotX, false)
                slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX]
                break
            case "object":
                // ok slotX
                iSlotConn = isFrom ? nodeX.findOutputSlot(slotX.name) : nodeX.findInputSlot(slotX.name)
                break
            case "number":
                iSlotConn = slotX
                slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX]
                break
            case "undefined":
            default:
                console.warn("Cant get slot information " + slotX)
                return false
        }

        // check for defaults nodes for this slottype
        const fromSlotType = slotX.type == LiteGraph.EVENT ? "_event_" : slotX.type
        const slotTypesDefault = isFrom ? LiteGraph.slot_types_default_out : LiteGraph.slot_types_default_in
        if (slotTypesDefault?.[fromSlotType]) {
            // TODO: Remove "any" kludge
            let nodeNewType: any = false
            if (typeof slotTypesDefault[fromSlotType] == "object") {
                for (const typeX in slotTypesDefault[fromSlotType]) {
                    if (opts.nodeType == slotTypesDefault[fromSlotType][typeX] || opts.nodeType == "AUTO") {
                        nodeNewType = slotTypesDefault[fromSlotType][typeX]
                        break
                    }
                }
            } else if (opts.nodeType == slotTypesDefault[fromSlotType] || opts.nodeType == "AUTO") {
                nodeNewType = slotTypesDefault[fromSlotType]
            }
            if (nodeNewType) {
                // TODO: Remove "any" kludge
                let nodeNewOpts: any = false
                if (typeof nodeNewType == "object" && nodeNewType.node) {
                    nodeNewOpts = nodeNewType
                    nodeNewType = nodeNewType.node
                }

                //that.graph.beforeChange();
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
                                    nodeNewOpts.inputs[i][1]
                                )
                            }
                        }
                        if (nodeNewOpts.outputs) {
                            newNode.outputs = []
                            for (const i in nodeNewOpts.outputs) {
                                newNode.addOutput(
                                    nodeNewOpts.outputs[i][0],
                                    nodeNewOpts.outputs[i][1]
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
                    this.graph.add(newNode)
                    newNode.pos = [
                        opts.position[0] + opts.posAdd[0] + (opts.posSizeFix[0] ? opts.posSizeFix[0] * newNode.size[0] : 0),
                        opts.position[1] + opts.posAdd[1] + (opts.posSizeFix[1] ? opts.posSizeFix[1] * newNode.size[1] : 0)
                    ]

                    // connect the two!
                    if (isFrom) {
                        opts.nodeFrom.connectByType(iSlotConn, newNode, fromSlotType)
                    } else {
                        opts.nodeTo.connectByTypeOutput(iSlotConn, newNode, fromSlotType)
                    }

                    // if connecting in between
                    if (isFrom && isTo) {
                        // TODO
                    }

                    return true
                }
                console.log("failed creating " + nodeNewType)
            }
        }
        return false
    }
    showConnectionMenu(optPass: Partial<ICreateNodeOptions & { e: MouseEvent }>): void {
        const opts = Object.assign<ICreateNodeOptions, ICreateNodeOptions>({
            nodeFrom: null,
            slotFrom: null,
            nodeTo: null,
            slotTo: null,
            e: null,
            allow_searchbox: this.allow_searchbox,
            showSearchBox: this.showSearchBox,
        }, optPass || {})
        const that = this

        const isFrom = opts.nodeFrom && opts.slotFrom
        const isTo = !isFrom && opts.nodeTo && opts.slotTo

        if (!isFrom && !isTo) {
            console.warn("No data passed to showConnectionMenu")
            return
        }

        const nodeX = isFrom ? opts.nodeFrom : opts.nodeTo
        let slotX = isFrom ? opts.slotFrom : opts.slotTo

        let iSlotConn: number
        switch (typeof slotX) {
            case "string":
                iSlotConn = isFrom ? nodeX.findOutputSlot(slotX, false) : nodeX.findInputSlot(slotX, false)
                slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX]
                break
            case "object":
                // ok slotX
                iSlotConn = isFrom ? nodeX.findOutputSlot(slotX.name) : nodeX.findInputSlot(slotX.name)
                break
            case "number":
                iSlotConn = slotX
                slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX]
                break
            default:
                console.warn("Cant get slot information " + slotX)
                return
        }

        const options = ["Add Node", null]

        if (opts.allow_searchbox) {
            options.push("Search")
            options.push(null)
        }

        // get defaults nodes for this slottype
        const fromSlotType = slotX.type == LiteGraph.EVENT ? "_event_" : slotX.type
        const slotTypesDefault = isFrom ? LiteGraph.slot_types_default_out : LiteGraph.slot_types_default_in
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
        const menu = new LiteGraph.ContextMenu(options, {
            event: opts.e,
            title: (slotX && slotX.name != "" ? (slotX.name + (fromSlotType ? " | " : "")) : "") + (slotX && fromSlotType ? fromSlotType : ""),
            callback: inner_clicked
        })

        // callback
        function inner_clicked(v: string, options: unknown, e: MouseEvent) {
            //console.log("Process showConnectionMenu selection");
            switch (v) {
                case "Add Node":
                    LGraphCanvas.onMenuAdd(null, null, e, menu, function (node) {
                        if (isFrom) {
                            opts.nodeFrom.connectByType(iSlotConn, node, fromSlotType)
                        } else {
                            opts.nodeTo.connectByTypeOutput(iSlotConn, node, fromSlotType)
                        }
                    })
                    break
                case "Search":
                    if (isFrom) {
                        opts.showSearchBox(e, { node_from: opts.nodeFrom, slot_from: slotX, type_filter_in: fromSlotType })
                    } else {
                        opts.showSearchBox(e, { node_to: opts.nodeTo, slot_from: slotX, type_filter_out: fromSlotType })
                    }
                    break
                default: {
                    // check for defaults nodes for this slottype
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const nodeCreated = that.createDefaultNodeForSlot(Object.assign<ICreateNodeOptions, ICreateNodeOptions>(opts, {
                        position: [opts.e.canvasX, opts.e.canvasY],
                        nodeType: v
                    }))
                    break
                }
            }
        }
    }
    // refactor: there are different dialogs, some uses createDialog some dont
    prompt(title: string, value: any, callback: (arg0: any) => void, event: CanvasMouseEvent, multiline?: boolean): HTMLDivElement {
        const that = this
        title = title || ""

        const dialog: IDialog = document.createElement("div")
        dialog.is_modified = false
        dialog.className = "graphdialog rounded"
        dialog.innerHTML = multiline
            ? "<span class='name'></span> <textarea autofocus class='value'></textarea><button class='rounded'>OK</button>"
            : "<span class='name'></span> <input autofocus type='text' class='value'/><button class='rounded'>OK</button>"
        dialog.close = function () {
            that.prompt_box = null
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog)
            }
        }

        const graphcanvas = LGraphCanvas.active_canvas
        const canvas = graphcanvas.canvas
        canvas.parentNode.appendChild(dialog)

        if (this.ds.scale > 1) dialog.style.transform = "scale(" + this.ds.scale + ")"

        let dialogCloseTimer = null
        let prevent_timeout = 0
        LiteGraph.pointerListenerAdd(dialog, "leave", function () {
            if (prevent_timeout)
                return
            if (LiteGraph.dialog_close_on_mouse_leave)
                if (!dialog.is_modified && LiteGraph.dialog_close_on_mouse_leave)
                    dialogCloseTimer = setTimeout(dialog.close, LiteGraph.dialog_close_on_mouse_leave_delay) //dialog.close();
        })
        LiteGraph.pointerListenerAdd(dialog, "enter", function () {
            if (LiteGraph.dialog_close_on_mouse_leave && dialogCloseTimer)
                clearTimeout(dialogCloseTimer)
        })
        const selInDia = dialog.querySelectorAll("select")
        if (selInDia) {
            // if filtering, check focus changed to comboboxes and prevent closing
            for (const selIn of selInDia) {
                selIn.addEventListener("click", function () { prevent_timeout++ })
                selIn.addEventListener("blur", function () { prevent_timeout = 0 })
                selIn.addEventListener("change", function () { prevent_timeout = -1 })
            }
        }
        this.prompt_box?.close()
        this.prompt_box = dialog

        const name_element: HTMLSpanElement = dialog.querySelector(".name")
        name_element.innerText = title
        const value_element: HTMLTextAreaElement | HTMLInputElement = dialog.querySelector(".value")
        value_element.value = value
        value_element.select()

        const input = value_element
        input.addEventListener("keydown", function (e: KeyboardEvent) {
            dialog.is_modified = true
            if (e.keyCode == 27) {
                //ESC
                dialog.close()
            } else if (e.keyCode == 13 && (e.target as Element).localName != "textarea") {
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
            dialog.style.left = event.clientX + offsetx + "px"
            dialog.style.top = event.clientY + offsety + "px"
        } else {
            dialog.style.left = canvas.width * 0.5 + offsetx + "px"
            dialog.style.top = canvas.height * 0.5 + offsety + "px"
        }

        setTimeout(function () {
            input.focus()
            const clickTime = Date.now()
            function handleOutsideClick(e: MouseEvent) {
                if (e.target === canvas && Date.now() - clickTime > 256) {
                    dialog.close()
                    canvas.parentNode.removeEventListener("click", handleOutsideClick)
                    canvas.parentNode.removeEventListener("touchend", handleOutsideClick)
                }
            }
            canvas.parentNode.addEventListener("click", handleOutsideClick)
            canvas.parentNode.addEventListener("touchend", handleOutsideClick)
        }, 10)

        return dialog
    }
    showSearchBox(event: CanvasMouseEvent, options?: IShowSearchOptions): HTMLDivElement {
        // proposed defaults
        const def_options: IShowSearchOptions = {
            slot_from: null,
            node_from: null,
            node_to: null,
            do_type_filter: LiteGraph.search_filter_enabled // TODO check for registered_slot_[in/out]_types not empty // this will be checked for functionality enabled : filter on slot type, in and out
            ,

            // @ts-expect-error
            type_filter_in: false // these are default: pass to set initially set values
            ,

            type_filter_out: false,
            show_general_if_none_on_typefilter: true,
            show_general_after_typefiltered: true,
            hide_on_mouse_leave: LiteGraph.search_hide_on_mouse_leave,
            show_all_if_empty: true,
            show_all_on_open: LiteGraph.search_show_all_on_open
        }
        options = Object.assign(def_options, options || {})

        //console.log(options);
        const that = this
        const graphcanvas = LGraphCanvas.active_canvas
        const canvas = graphcanvas.canvas
        const root_document = canvas.ownerDocument || document

        const dialog = document.createElement("div")
        dialog.className = "litegraph litesearchbox graphdialog rounded"
        dialog.innerHTML = "<span class='name'>Search</span> <input autofocus type='text' class='value rounded'/>"
        if (options.do_type_filter) {
            dialog.innerHTML += "<select class='slot_in_type_filter'><option value=''></option></select>"
            dialog.innerHTML += "<select class='slot_out_type_filter'><option value=''></option></select>"
        }
        dialog.innerHTML += "<div class='helper'></div>"

        if (root_document.fullscreenElement)
            root_document.fullscreenElement.appendChild(dialog)

        else {
            root_document.body.appendChild(dialog)
            root_document.body.style.overflow = "hidden"
        }
        // dialog element has been appended
        let selIn
        let selOut
        if (options.do_type_filter) {
            selIn = dialog.querySelector(".slot_in_type_filter")
            selOut = dialog.querySelector(".slot_out_type_filter")
        }

        // @ts-expect-error Panel?
        dialog.close = function () {
            that.search_box = null
            this.blur()
            canvas.focus()
            root_document.body.style.overflow = ""

            setTimeout(function () {
                that.canvas.focus()
            }, 20) //important, if canvas loses focus keys wont be captured
            dialog.parentNode?.removeChild(dialog)
        }

        if (this.ds.scale > 1) {
            dialog.style.transform = "scale(" + this.ds.scale + ")"
        }

        // hide on mouse leave
        if (options.hide_on_mouse_leave) {
            // FIXME: Remove "any" kludge
            let prevent_timeout: any = false
            let timeout_close = null
            LiteGraph.pointerListenerAdd(dialog, "enter", function () {
                if (timeout_close) {
                    clearTimeout(timeout_close)
                    timeout_close = null
                }
            })
            LiteGraph.pointerListenerAdd(dialog, "leave", function () {
                if (prevent_timeout)
                    return
                timeout_close = setTimeout(function () {
                    // @ts-expect-error Panel?
                    dialog.close()
                }, typeof options.hide_on_mouse_leave === "number" ? options.hide_on_mouse_leave : 500)
            })
            // if filtering, check focus changed to comboboxes and prevent closing
            if (options.do_type_filter) {
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

        const helper = dialog.querySelector(".helper")

        let first = null
        let timeout = null
        let selected = null

        const input = dialog.querySelector("input")
        if (input) {
            input.addEventListener("blur", function () {
                this.focus()
            })
            input.addEventListener("keydown", function (e) {
                if (e.keyCode == 38) {
                    //UP
                    changeSelection(false)
                } else if (e.keyCode == 40) {
                    //DOWN
                    changeSelection(true)
                } else if (e.keyCode == 27) {
                    //ESC
                    // @ts-expect-error Panel?
                    dialog.close()
                } else if (e.keyCode == 13) {
                    if (selected) {
                        select(unescape(selected.dataset["type"]))
                    } else if (first) {
                        select(first)
                    } else {
                        // @ts-expect-error Panel?
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
                const nSlots = aSlots.length // this for object :: Object.keys(aSlots).length;

                if (options.type_filter_in == LiteGraph.EVENT || options.type_filter_in == LiteGraph.ACTION)
                    options.type_filter_in = "_event_"
                /* this will filter on * .. but better do it manually in case
                else if(options.type_filter_in === "" || options.type_filter_in === 0)
                    options.type_filter_in = "*";*/
                for (let iK = 0; iK < nSlots; iK++) {
                    const opt = document.createElement('option')
                    opt.value = aSlots[iK]
                    opt.innerHTML = aSlots[iK]
                    selIn.appendChild(opt)
                    // @ts-expect-error
                    if (options.type_filter_in !== false && (options.type_filter_in + "").toLowerCase() == (aSlots[iK] + "").toLowerCase()) {
                        //selIn.selectedIndex ..
                        opt.selected = true
                        //console.log("comparing IN "+options.type_filter_in+" :: "+aSlots[iK]);
                    } else {
                        //console.log("comparing OUT "+options.type_filter_in+" :: "+aSlots[iK]);
                    }
                }
                selIn.addEventListener("change", function () {
                    refreshHelper()
                })
            }
            if (selOut) {
                const aSlots = LiteGraph.slot_types_out
                const nSlots = aSlots.length // this for object :: Object.keys(aSlots).length; 

                if (options.type_filter_out == LiteGraph.EVENT || options.type_filter_out == LiteGraph.ACTION)
                    options.type_filter_out = "_event_"
                /* this will filter on * .. but better do it manually in case
                else if(options.type_filter_out === "" || options.type_filter_out === 0)
                    options.type_filter_out = "*";*/
                for (let iK = 0; iK < nSlots; iK++) {
                    const opt = document.createElement('option')
                    opt.value = aSlots[iK]
                    opt.innerHTML = aSlots[iK]
                    selOut.appendChild(opt)
                    if (options.type_filter_out !== false && (options.type_filter_out + "").toLowerCase() == (aSlots[iK] + "").toLowerCase())
                        opt.selected = true
                }
                selOut.addEventListener("change", function () {
                    refreshHelper()
                })
            }
        }

        //compute best position
        const rect = canvas.getBoundingClientRect()

        const left = (event ? event.clientX : (rect.left + rect.width * 0.5)) - 80
        const top = (event ? event.clientY : (rect.top + rect.height * 0.5)) - 20
        dialog.style.left = left + "px"
        dialog.style.top = top + "px"

        //To avoid out of screen problems
        if (event.layerY > (rect.height - 200))
            // @ts-expect-error
            helper.style.maxHeight = (rect.height - event.layerY - 20) + "px"

        requestAnimationFrame(function () {
            input.focus()
        })
        if (options.show_all_on_open) refreshHelper()

        function select(name) {
            if (name) {
                if (that.onSearchBoxSelection) {
                    that.onSearchBoxSelection(name, event, graphcanvas)
                } else {
                    const extra = LiteGraph.searchbox_extras[name.toLowerCase()]
                    if (extra)
                        name = extra.type

                    graphcanvas.graph.beforeChange()
                    const node = LiteGraph.createNode(name)
                    if (node) {
                        node.pos = graphcanvas.convertEventToCanvasOffset(
                            event
                        )
                        graphcanvas.graph.add(node, false)
                    }

                    if (extra?.data) {
                        if (extra.data.properties) {
                            for (const i in extra.data.properties) {
                                node.addProperty(i, extra.data.properties[i])
                            }
                        }
                        if (extra.data.inputs) {
                            node.inputs = []
                            for (const i in extra.data.inputs) {
                                node.addOutput(
                                    extra.data.inputs[i][0],
                                    extra.data.inputs[i][1]
                                )
                            }
                        }
                        if (extra.data.outputs) {
                            node.outputs = []
                            for (const i in extra.data.outputs) {
                                node.addOutput(
                                    extra.data.outputs[i][0],
                                    extra.data.outputs[i][1]
                                )
                            }
                        }
                        if (extra.data.title) {
                            node.title = extra.data.title
                        }
                        if (extra.data.json) {
                            node.configure(extra.data.json)
                        }

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
                                iS = options.slot_from.name
                                    ? options.node_from.findOutputSlot(options.slot_from.name)
                                    : -1
                                // @ts-expect-error change interface check
                                if (iS == -1 && typeof options.slot_from.slot_index !== "undefined") iS = options.slot_from.slot_index
                                break
                            case "number":
                                iS = options.slot_from
                                break
                            default:
                                iS = 0 // try with first if no name set
                        }
                        if (typeof options.node_from.outputs[iS] !== "undefined") {
                            if (iS !== false && iS > -1) {
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
                                iS = options.slot_from.name
                                    ? options.node_to.findInputSlot(options.slot_from.name)
                                    : -1
                                // @ts-expect-error change interface check
                                if (iS == -1 && typeof options.slot_from.slot_index !== "undefined") iS = options.slot_from.slot_index
                                break
                            case "number":
                                iS = options.slot_from
                                break
                            default:
                                iS = 0 // try with first if no name set
                        }
                        if (typeof options.node_to.inputs[iS] !== "undefined") {
                            if (iS !== false && iS > -1) {
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

            // @ts-expect-error Panel?
            dialog.close()
        }

        function changeSelection(forward) {
            const prev = selected
            if (!selected) {
                selected = forward
                    ? helper.childNodes[0]
                    : helper.childNodes[helper.childNodes.length]
            } else {
                selected.classList.remove("selected")
                selected = forward
                    ? selected.nextSibling
                    : selected.previousSibling
                selected ||= prev
            }
            if (!selected) return

            selected.classList.add("selected")
            selected.scrollIntoView({ block: "end", behavior: "smooth" })
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
                    for (let i = 0; i < list.length; ++i) {
                        addResult(list[i])
                    }
                }
            } else {
                let c = 0
                str = str.toLowerCase()
                const filter = graphcanvas.filter || graphcanvas.graph.filter

                // FIXME: any
                // filter by type preprocess
                let sIn: any = false
                let sOut: any = false
                if (options.do_type_filter && that.search_box) {
                    sIn = that.search_box.querySelector(".slot_in_type_filter")
                    sOut = that.search_box.querySelector(".slot_out_type_filter")
                }

                //extras
                for (const i in LiteGraph.searchbox_extras) {
                    const extra = LiteGraph.searchbox_extras[i]
                    if ((!options.show_all_if_empty || str) && extra.desc.toLowerCase().indexOf(str) === -1)
                        continue
                    const ctor = LiteGraph.registered_node_types[extra.type]
                    if (ctor && ctor.filter != filter)
                        continue
                    if (!inner_test_filter(extra.type))
                        continue
                    addResult(extra.desc, "searchbox_extra")
                    if (LGraphCanvas.search_limit !== -1 && c++ > LGraphCanvas.search_limit) {
                        break
                    }
                }

                let filtered = null
                if (Array.prototype.filter) { //filter supported
                    const keys = Object.keys(LiteGraph.registered_node_types) //types
                    filtered = keys.filter(inner_test_filter)
                } else {
                    filtered = []
                    for (const i in LiteGraph.registered_node_types) {
                        if (inner_test_filter(i))
                            filtered.push(i)
                    }
                }

                for (let i = 0; i < filtered.length; i++) {
                    addResult(filtered[i])
                    if (LGraphCanvas.search_limit !== -1 && c++ > LGraphCanvas.search_limit)
                        break
                }

                // add general type if filtering
                if (options.show_general_after_typefiltered
                    && (sIn.value || sOut.value)) {
                    // FIXME: Undeclared variable again
                    // @ts-expect-error
                    filtered_extra = []
                    for (const i in LiteGraph.registered_node_types) {
                        if (inner_test_filter(i, { inTypeOverride: sIn && sIn.value ? "*" : false, outTypeOverride: sOut && sOut.value ? "*" : false }))
                            // @ts-expect-error
                            filtered_extra.push(i)
                    }
                    // @ts-expect-error
                    for (let i = 0; i < filtered_extra.length; i++) {
                        // @ts-expect-error
                        addResult(filtered_extra[i], "generic_type")
                        if (LGraphCanvas.search_limit !== -1 && c++ > LGraphCanvas.search_limit)
                            break
                    }
                }

                // check il filtering gave no results
                if ((sIn.value || sOut.value) &&
                    ((helper.childNodes.length == 0 && options.show_general_if_none_on_typefilter))) {
                    // @ts-expect-error
                    filtered_extra = []
                    for (const i in LiteGraph.registered_node_types) {
                        if (inner_test_filter(i, { skipFilter: true }))
                            // @ts-expect-error
                            filtered_extra.push(i)
                    }
                    // @ts-expect-error
                    for (let i = 0; i < filtered_extra.length; i++) {
                        // @ts-expect-error
                        addResult(filtered_extra[i], "not_in_filter")
                        if (LGraphCanvas.search_limit !== -1 && c++ > LGraphCanvas.search_limit)
                            break
                    }
                }

                function inner_test_filter(type: string, optsIn?: number | { inTypeOverride?: string | boolean; outTypeOverride?: string | boolean; skipFilter?: boolean }): boolean {
                    optsIn = optsIn || {}
                    const optsDef = {
                        skipFilter: false,
                        inTypeOverride: false,
                        outTypeOverride: false
                    }
                    const opts = Object.assign(optsDef, optsIn)
                    const ctor = LiteGraph.registered_node_types[type]
                    if (filter && ctor.filter != filter)
                        return false
                    if ((!options.show_all_if_empty || str) && type.toLowerCase().indexOf(str) === -1 && (!ctor.title || ctor.title.toLowerCase().indexOf(str) === -1))
                        return false

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
                    help.innerText = nodeType?.title
                    const typeEl = document.createElement("span")
                    typeEl.className = "litegraph lite-search-item-type"
                    typeEl.textContent = type
                    help.append(typeEl)
                } else {
                    help.innerText = type
                }

                help.dataset["type"] = escape(type)
                help.className = "litegraph lite-search-item"
                if (className) {
                    help.className += " " + className
                }
                help.addEventListener("click", function () {
                    select(unescape(this.dataset["type"]))
                })
                helper.appendChild(help)
            }
        }

        return dialog
    }
    showEditPropertyValue(node: LGraphNode, property: string, options: IDialogOptions): IDialog {
        if (!node || node.properties[property] === undefined) return

        options = options || {}

        const info = node.getPropertyInfo(property)
        const type = info.type

        let input_html = ""

        if (type == "string" || type == "number" || type == "array" || type == "object") {
            input_html = "<input autofocus type='text' class='value'/>"
        } else if ((type == "enum" || type == "combo") && info.values) {
            input_html = "<select autofocus type='text' class='value'>"
            for (const i in info.values) {
                const v = Array.isArray(info.values)
                    ? info.values[i]
                    : i

                input_html +=
                    "<option value='" +
                    v +
                    "' " +
                    (v == node.properties[property] ? "selected" : "") +
                    ">" +
                    info.values[i] +
                    "</option>"
            }
            input_html += "</select>"
        } else if (type == "boolean" || type == "toggle") {
            input_html =
                "<input autofocus type='checkbox' class='value' " +
                (node.properties[property] ? "checked" : "") +
                "/>"
        } else {
            console.warn("unknown type: " + type)
            return
        }

        const dialog = this.createDialog(
            "<span class='name'>" +
            (info.label || property) +
            "</span>" +
            input_html +
            "<button>OK</button>",
            options
        )

        let input: HTMLInputElement | HTMLSelectElement
        if ((type == "enum" || type == "combo") && info.values) {
            input = dialog.querySelector("select")
            input.addEventListener("change", function (e) {
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

                let v = node.properties[property] !== undefined ? node.properties[property] : ""
                if (type !== 'string') {
                    v = JSON.stringify(v)
                }

                // @ts-expect-error
                input.value = v
                input.addEventListener("keydown", function (e) {
                    if (e.keyCode == 27) {
                        //ESC
                        dialog.close()
                    } else if (e.keyCode == 13) {
                        // ENTER
                        inner() // save
                    } else if (e.keyCode != 13) {
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
        button.addEventListener("click", inner)

        function inner() {
            setValue(input.value)
        }

        function setValue(value: string | number) {

            if (info?.values && typeof info.values === "object" && info.values[value] != undefined)
                value = info.values[value]

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
            this.setDirty(true, true)
        }

        return dialog
    }
    // TODO refactor, theer are different dialog, some uses createDialog, some dont
    createDialog(html: string, options: IDialogOptions): IDialog {
        const def_options = { checkForInput: false, closeOnLeave: true, closeOnLeave_checkModified: true }
        options = Object.assign(def_options, options || {})
        const dialog: IDialog = document.createElement("div")
        dialog.className = "graphdialog"
        dialog.innerHTML = html
        dialog.is_modified = false

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
        } //centered
        else {
            offsetx += this.canvas.width * 0.5
            offsety += this.canvas.height * 0.5
        }

        dialog.style.left = offsetx + "px"
        dialog.style.top = offsety + "px"

        this.canvas.parentNode.appendChild(dialog)

        // acheck for input and use default behaviour: save on enter, close on esc
        if (options.checkForInput) {
            const aI = dialog.querySelectorAll("input")
            const focused = false
            aI?.forEach(function (iX) {
                iX.addEventListener("keydown", function (e) {
                    dialog.modified()
                    if (e.keyCode == 27) {
                        dialog.close()
                    } else if (e.keyCode != 13) {
                        return
                    }
                    // set value ?
                    e.preventDefault()
                    e.stopPropagation()
                })
                if (!focused) iX.focus()
            })
        }

        dialog.modified = function () {
            dialog.is_modified = true
        }
        dialog.close = function () {
            dialog.parentNode?.removeChild(dialog)
        }

        let dialogCloseTimer = null
        let prevent_timeout = 0
        dialog.addEventListener("mouseleave", function () {
            if (prevent_timeout)
                return
            if (!dialog.is_modified && LiteGraph.dialog_close_on_mouse_leave)
                dialogCloseTimer = setTimeout(dialog.close, LiteGraph.dialog_close_on_mouse_leave_delay) //dialog.close();
        })
        dialog.addEventListener("mouseenter", function () {
            if (options.closeOnLeave || LiteGraph.dialog_close_on_mouse_leave)
                if (dialogCloseTimer) clearTimeout(dialogCloseTimer)
        })
        const selInDia = dialog.querySelectorAll("select")
        // if filtering, check focus changed to comboboxes and prevent closing
        selInDia?.forEach(function (selIn) {
            selIn.addEventListener("click", function () { prevent_timeout++ })
            selIn.addEventListener("blur", function () { prevent_timeout = 0 })
            selIn.addEventListener("change", function () { prevent_timeout = -1 })
        })

        return dialog
    }
    createPanel(title, options) {
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
            root.header.appendChild(close)
        }
        root.title_element = root.querySelector(".dialog-title")
        root.title_element.innerText = title
        root.content = root.querySelector(".dialog-content")
        root.alt_content = root.querySelector(".dialog-alt-content")
        root.footer = root.querySelector(".dialog-footer")

        root.close = function () {
            if (typeof root.onClose == "function") root.onClose()
            root.parentNode?.removeChild(root)
            /* XXX CHECK THIS */
            this.parentNode?.removeChild(this)
            /* XXX this was not working, was fixed with an IF, check this */
        }

        // function to swap panel content
        root.toggleAltContent = function (force: unknown) {
            let vTo: string
            let vAlt: string
            if (typeof force != "undefined") {
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
            if (typeof force != "undefined") {
                vTo = force ? "block" : "none"
            } else {
                vTo = root.footer.style.display != "block" ? "block" : "none"
            }
            root.footer.style.display = vTo
        }

        root.clear = function () {
            this.content.innerHTML = ""
        }

        root.addHTML = function (code, classname, on_footer) {
            const elem = document.createElement("div")
            if (classname)
                elem.className = classname
            elem.innerHTML = code
            if (on_footer)
                root.footer.appendChild(elem)

            else
                root.content.appendChild(elem)
            return elem
        }

        root.addButton = function (name, callback, options) {
            // TODO: any kludge
            const elem: any = document.createElement("button")
            elem.innerText = name
            elem.options = options
            elem.classList.add("btn")
            elem.addEventListener("click", callback)
            root.footer.appendChild(elem)
            return elem
        }

        root.addSeparator = function () {
            const elem = document.createElement("div")
            elem.className = "separator"
            root.content.appendChild(elem)
        }

        root.addWidget = function (type, name, value, options, callback) {
            options = options || {}
            let str_value = String(value)
            type = type.toLowerCase()
            if (type == "number")
                str_value = value.toFixed(3)

            // FIXME: any kludge
            const elem: any = document.createElement("div")
            elem.className = "property"
            elem.innerHTML = "<span class='property_name'></span><span class='property_value'></span>"
            elem.querySelector(".property_name").innerText = options.label || name
            // TODO: any kludge
            const value_element: any = elem.querySelector(".property_value")
            value_element.innerText = str_value
            elem.dataset["property"] = name
            elem.dataset["type"] = options.type || type
            elem.options = options
            elem.value = value

            if (type == "code")
                elem.addEventListener("click", function () { root.inner_showCodePad(this.dataset["property"]) })
            else if (type == "boolean") {
                elem.classList.add("boolean")
                if (value)
                    elem.classList.add("bool-on")
                elem.addEventListener("click", function () {
                    const propname = this.dataset["property"]
                    this.value = !this.value
                    this.classList.toggle("bool-on")
                    this.querySelector(".property_value").innerText = this.value ? "true" : "false"
                    innerChange(propname, this.value)
                })
            }
            else if (type == "string" || type == "number") {
                value_element.setAttribute("contenteditable", true)
                value_element.addEventListener("keydown", function (e) {
                    // allow for multiline
                    if (e.code == "Enter" && (type != "string" || !e.shiftKey)) {
                        e.preventDefault()
                        this.blur()
                    }
                })
                value_element.addEventListener("blur", function () {
                    let v = this.innerText
                    const propname = this.parentNode.dataset["property"]
                    const proptype = this.parentNode.dataset["type"]
                    if (proptype == "number")
                        v = Number(v)
                    innerChange(propname, v)
                })
            }
            else if (type == "enum" || type == "combo") {
                const str_value = LGraphCanvas.getPropertyPrintableValue(value, options.values)
                value_element.innerText = str_value

                value_element.addEventListener("click", function (event) {
                    const values = options.values || []
                    const propname = this.parentNode.dataset["property"]
                    const elem_that = this
                    new LiteGraph.ContextMenu(values, {
                        event: event,
                        className: "dark",
                        callback: inner_clicked
                    },
                        // @ts-expect-error
                        ref_window)
                    function inner_clicked(v) {
                        //node.setProperty(propname,v); 
                        //graphcanvas.dirty_canvas = true;
                        elem_that.innerText = v
                        innerChange(propname, v)
                        return false
                    }
                })
            }

            root.content.appendChild(elem)

            function innerChange(name, value) {
                options.callback?.(name, value, options)
                callback?.(name, value, options)
            }

            return elem
        }

        if (root.onOpen && typeof root.onOpen == "function") root.onOpen()

        return root
    }
    closePanels(): void {
        document.querySelector<ICloseableDiv>("#node-panel")?.close()
        document.querySelector<ICloseableDiv>("#option-panel")?.close()
    }
    showShowNodePanel(node: LGraphNode): void {
        this.SELECTED_NODE = node
        this.closePanels()
        const ref_window = this.getCanvasWindow()
        const graphcanvas = this
        const panel = this.createPanel(node.title || "", {
            closable: true,
            window: ref_window,
            onOpen: function () {
                graphcanvas.NODEPANEL_IS_OPEN = true
            },
            onClose: function () {
                graphcanvas.NODEPANEL_IS_OPEN = false
                graphcanvas.node_panel = null
            }
        })
        graphcanvas.node_panel = panel
        panel.id = "node-panel"
        panel.node = node
        panel.classList.add("settings")

        function inner_refresh() {
            //clear
            panel.content.innerHTML = ""
            // @ts-expect-error ctor props
            panel.addHTML(`<span class='node_type'>${node.type}</span><span class='node_desc'>${node.constructor.desc || ""}</span><span class='separator'></span>`)

            panel.addHTML("<h3>Properties</h3>")

            const fUpdate = function (name, value) {
                graphcanvas.graph.beforeChange(node)
                switch (name) {
                    case "Title":
                        node.title = value
                        break
                    case "Mode": {
                        const kV = Object.values(LiteGraph.NODE_MODES).indexOf(value)
                        if (kV >= 0 && LiteGraph.NODE_MODES[kV]) {
                            node.changeMode(kV)
                        } else {
                            console.warn("unexpected mode: " + value)
                        }
                        break
                    }
                    case "Color":
                        if (LGraphCanvas.node_colors[value]) {
                            node.color = LGraphCanvas.node_colors[value].color
                            node.bgcolor = LGraphCanvas.node_colors[value].bgcolor
                        } else {
                            console.warn("unexpected color: " + value)
                        }
                        break
                    default:
                        node.setProperty(name, value)
                        break
                }
                graphcanvas.graph.afterChange()
                graphcanvas.dirty_canvas = true
            }

            panel.addWidget("string", "Title", node.title, {}, fUpdate)

            panel.addWidget("combo", "Mode", LiteGraph.NODE_MODES[node.mode], { values: LiteGraph.NODE_MODES }, fUpdate)

            const nodeCol = node.color !== undefined
                ? Object.keys(LGraphCanvas.node_colors).filter(function (nK) { return LGraphCanvas.node_colors[nK].color == node.color })
                : ""

            panel.addWidget("combo", "Color", nodeCol, { values: Object.keys(LGraphCanvas.node_colors) }, fUpdate)

            for (const pName in node.properties) {
                const value = node.properties[pName]
                const info = node.getPropertyInfo(pName)

                //in case the user wants control over the side panel widget
                if (node.onAddPropertyToPanel?.(pName, panel))
                    continue

                panel.addWidget(info.widget || info.type, pName, value, info, fUpdate)
            }

            panel.addSeparator()

            node.onShowCustomPanelInfo?.(panel)

            panel.footer.innerHTML = "" // clear
            panel.addButton("Delete", function () {
                if (node.block_delete)
                    return
                node.graph.remove(node)
                panel.close()
            }).classList.add("delete")
        }

        panel.inner_showCodePad = function (propname) {
            panel.classList.remove("settings")
            panel.classList.add("centered")

            panel.alt_content.innerHTML = "<textarea class='code'></textarea>"
            const textarea = panel.alt_content.querySelector("textarea")
            const fDoneWith = function () {
                panel.toggleAltContent(false)
                panel.toggleFooterVisibility(true)
                textarea.parentNode.removeChild(textarea)
                panel.classList.add("settings")
                panel.classList.remove("centered")
                inner_refresh()
            }
            textarea.value = node.properties[propname]
            textarea.addEventListener("keydown", function (e) {
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
            panel.alt_content.appendChild(assign)
            const button = panel.addButton("Close", fDoneWith)
            button.style.float = "right"
            panel.alt_content.appendChild(button)
        }

        inner_refresh()

        this.canvas.parentNode.appendChild(panel)
    }
    showSubgraphPropertiesDialog(node: LGraphNode) {
        console.log("showing subgraph properties dialog")

        const old_panel = this.canvas.parentNode.querySelector<ICloseableDiv>(".subgraph_dialog")
        old_panel?.close()

        const panel = this.createPanel("Subgraph Inputs", { closable: true, width: 500 })
        panel.node = node
        panel.classList.add("subgraph_dialog")

        function inner_refresh() {
            panel.clear()

            //show currents
            if (node.inputs)
                for (let i = 0; i < node.inputs.length; ++i) {
                    const input = node.inputs[i]
                    if (input.not_subgraph_input)
                        continue
                    const html = "<button>&#10005;</button> <span class='bullet_icon'></span><span class='name'></span><span class='type'></span>"
                    const elem = panel.addHTML(html, "subgraph_property")
                    elem.dataset["name"] = input.name
                    elem.dataset["slot"] = i
                    elem.querySelector(".name").innerText = input.name
                    elem.querySelector(".type").innerText = input.type
                    elem.querySelector("button").addEventListener("click", function () {
                        node.removeInput(Number(this.parentNode.dataset["slot"]))
                        inner_refresh()
                    })
                }
        }

        //add extra
        const html = " + <span class='label'>Name</span><input class='name'/><span class='label'>Type</span><input class='type'></input><button>+</button>"
        const elem = panel.addHTML(html, "subgraph_property extra", true)
        elem.querySelector("button").addEventListener("click", function () {
            const elem = this.parentNode
            const name = elem.querySelector(".name").value
            const type = elem.querySelector(".type").value
            if (!name || node.findInputSlot(name) != -1)
                return
            node.addInput(name, type)
            elem.querySelector(".name").value = ""
            elem.querySelector(".type").value = ""
            inner_refresh()
        })

        inner_refresh()
        this.canvas.parentNode.appendChild(panel)
        return panel
    }
    showSubgraphPropertiesDialogRight(node: LGraphNode): any {

        // console.log("showing subgraph properties dialog");
        // old_panel if old_panel is exist close it
        const old_panel = this.canvas.parentNode.querySelector<ICloseableDiv>(".subgraph_dialog")
        old_panel?.close()
        // new panel
        const panel = this.createPanel("Subgraph Outputs", { closable: true, width: 500 })
        panel.node = node
        panel.classList.add("subgraph_dialog")

        function inner_refresh() {
            panel.clear()
            //show currents
            if (node.outputs)
                for (let i = 0; i < node.outputs.length; ++i) {
                    // FIXME: Rename - it's an output
                    const input = node.outputs[i]
                    if (input.not_subgraph_output)
                        continue
                    const html = "<button>&#10005;</button> <span class='bullet_icon'></span><span class='name'></span><span class='type'></span>"
                    const elem = panel.addHTML(html, "subgraph_property")
                    elem.dataset["name"] = input.name
                    elem.dataset["slot"] = i
                    elem.querySelector(".name").innerText = input.name
                    elem.querySelector(".type").innerText = input.type
                    elem.querySelector("button").addEventListener("click", function () {
                        node.removeOutput(Number(this.parentNode.dataset["slot"]))
                        inner_refresh()
                    })
                }
        }

        //add extra
        const html = " + <span class='label'>Name</span><input class='name'/><span class='label'>Type</span><input class='type'></input><button>+</button>"
        const elem = panel.addHTML(html, "subgraph_property extra", true)
        elem.querySelector(".name").addEventListener("keydown", function (e) {
            if (e.keyCode == 13) addOutput.apply(this)
        })
        elem.querySelector("button").addEventListener("click", function () {
            addOutput.apply(this)
        })
        function addOutput() {
            const elem = this.parentNode
            const name = elem.querySelector(".name").value
            const type = elem.querySelector(".type").value
            if (!name || node.findOutputSlot(name) != -1)
                return
            node.addOutput(name, type)
            elem.querySelector(".name").value = ""
            elem.querySelector(".type").value = ""
            inner_refresh()
        }

        inner_refresh()
        this.canvas.parentNode.appendChild(panel)
        return panel
    }
    checkPanels(): void {
        if (!this.canvas) return

        const panels = this.canvas.parentNode.querySelectorAll(".litegraph.dialog")
        for (let i = 0; i < panels.length; ++i) {
            const panel = panels[i]
            // @ts-expect-error Panel
            if (!panel.node) continue
            // @ts-expect-error Panel
            if (!panel.node.graph || panel.graph != this.graph) panel.close()
        }
    }
    getCanvasMenuOptions(): IContextMenuValue[] {
        let options: IContextMenuValue[] = null
        if (this.getMenuOptions) {
            options = this.getMenuOptions()
        } else {
            options = [
                {
                    content: "Add Node",
                    has_submenu: true,
                    // @ts-expect-error Might be broken?  Or just param overlap
                    callback: LGraphCanvas.onMenuAdd
                },
                { content: "Add Group", callback: LGraphCanvas.onGroupAdd },
                //{ content: "Arrange", callback: that.graph.arrange },
                //{content:"Collapse All", callback: LGraphCanvas.onMenuCollapseAll }
            ]
            if (Object.keys(this.selected_nodes).length > 1) {
                options.push({
                    content: "Align",
                    has_submenu: true,
                    callback: LGraphCanvas.onGroupAlign,
                })
            }

            if (this._graph_stack && this._graph_stack.length > 0) {
                options.push(null, {
                    content: "Close subgraph",
                    callback: this.closeSubgraph.bind(this)
                })
            }
        }

        const extra = this.getExtraMenuOptions?.(this, options)
        return extra
            ? options.concat(extra)
            : options
    }
    //called by processContextMenu to extract the menu list
    getNodeMenuOptions(node: LGraphNode): IContextMenuValue[] {
        let options: IContextMenuValue[] = null

        if (node.getMenuOptions) {
            options = node.getMenuOptions(this)
        } else {
            options = [
                {
                    content: "Inputs",
                    has_submenu: true,
                    disabled: true,
                    callback: LGraphCanvas.showMenuNodeOptionalInputs
                },
                {
                    content: "Outputs",
                    has_submenu: true,
                    disabled: true,
                    callback: LGraphCanvas.showMenuNodeOptionalOutputs
                },
                null,
                {
                    content: "Properties",
                    has_submenu: true,
                    callback: LGraphCanvas.onShowMenuNodeProperties
                },
                {
                    content: "Properties Panel",
                    callback: function (item, options, e, menu, node) { LGraphCanvas.active_canvas.showShowNodePanel(node) }
                },
                null,
                {
                    content: "Title",
                    callback: LGraphCanvas.onShowPropertyEditor
                },
                {
                    content: "Mode",
                    has_submenu: true,
                    callback: LGraphCanvas.onMenuNodeMode
                }
            ]
            if (node.resizable !== false) {
                options.push({
                    content: "Resize", callback: LGraphCanvas.onMenuResizeNode
                })
            }
            if (node.collapsible) {
                options.push({
                    content: node.collapsed ? "Expand" : "Collapse",
                    callback: LGraphCanvas.onMenuNodeCollapse
                })
            }
            if (node.widgets?.some(w => w.advanced)) {
                options.push({
                    content: node.showAdvanced ? "Hide Advanced" : "Show Advanced",
                    callback: LGraphCanvas.onMenuToggleAdvanced
                })
            }
            options.push(
                {
                    content: node.pinned ? "Unpin" : "Pin",
                    callback: (...args) => {
                        // @ts-expect-error Not impl.
                        LGraphCanvas.onMenuNodePin(...args)
                        for (const i in this.selected_nodes) {
                            const node = this.selected_nodes[i]
                            node.pin()
                        }
                        this.setDirty(true, true)
                    }
                },
                {
                    content: "Colors",
                    has_submenu: true,
                    callback: LGraphCanvas.onMenuNodeColors
                },
                {
                    content: "Shapes",
                    has_submenu: true,
                    callback: LGraphCanvas.onMenuNodeShapes
                },
                null
            )
        }

        const inputs = node.onGetInputs?.()
        if (inputs?.length)
            options[0].disabled = false

        const outputs = node.onGetOutputs?.()
        if (outputs?.length)
            options[1].disabled = false

        const extra = node.getExtraMenuOptions?.(this, options)
        if (extra) {
            extra.push(null)
            options = extra.concat(options)
        }

        if (node.clonable !== false) {
            options.push({
                content: "Clone",
                callback: LGraphCanvas.onMenuNodeClone
            })
        }

        // TODO: Subgraph code never implemented.
        // options.push({
        //     content: "To Subgraph",
        //     callback: LGraphCanvas.onMenuNodeToSubgraph
        // })

        if (Object.keys(this.selected_nodes).length > 1) {
            options.push({
                content: "Align Selected To",
                has_submenu: true,
                callback: LGraphCanvas.onNodeAlign,
            })
            options.push({
                content: "Distribute Nodes",
                has_submenu: true,
                callback: LGraphCanvas.createDistributeMenu,
            })
        }

        options.push(null, {
            content: "Remove",
            disabled: !(node.removable !== false && !node.block_delete),
            callback: LGraphCanvas.onMenuNodeRemove
        })

        node.graph?.onGetNodeMenuOptions?.(options, node)

        return options
    }
    getGroupMenuOptions(group: LGraphGroup): IContextMenuValue[] {
        console.warn("LGraphCanvas.getGroupMenuOptions is deprecated, use LGraphGroup.getMenuOptions instead")
        return group.getMenuOptions()
    }
    processContextMenu(node: LGraphNode, event: CanvasMouseEvent): void {
        const that = this
        const canvas = LGraphCanvas.active_canvas
        const ref_window = canvas.getCanvasWindow()

        // TODO: Remove type kludge
        let menu_info: (IContextMenuValue | string)[] = null
        const options: IContextMenuOptions = {
            event: event,
            callback: inner_option_clicked,
            extra: node
        }

        if (node) options.title = node.type

        //check if mouse is in input
        let slot: ReturnType<LGraphNode["getSlotInPosition"]> = null
        if (node) {
            slot = node.getSlotInPosition(event.canvasX, event.canvasY)
            LGraphCanvas.active_node = node
        }

        if (slot) {
            //on slot
            menu_info = []
            if (node.getSlotMenuOptions) {
                menu_info = node.getSlotMenuOptions(slot)
            } else {
                if (slot?.output?.links?.length)
                    menu_info.push({ content: "Disconnect Links", slot: slot })

                const _slot = slot.input || slot.output
                if (_slot.removable) {
                    menu_info.push(
                        _slot.locked
                            ? "Cannot remove"
                            : { content: "Remove Slot", slot: slot }
                    )
                }
                if (!_slot.nameLocked)
                    menu_info.push({ content: "Rename Slot", slot: slot })

            }
            // @ts-expect-error Slot type can be number and has number checks
            options.title = (slot.input ? slot.input.type : slot.output.type) || "*"
            if (slot.input && slot.input.type == LiteGraph.ACTION)
                options.title = "Action"

            if (slot.output && slot.output.type == LiteGraph.EVENT)
                options.title = "Event"
        } else if (node) {
            //on node
            menu_info = this.getNodeMenuOptions(node)
        } else {
            menu_info = this.getCanvasMenuOptions()
            const group = this.graph.getGroupOnPos(
                event.canvasX,
                event.canvasY
            )
            if (group) {
                //on group
                menu_info.push(null, {
                    content: "Edit Group",
                    has_submenu: true,
                    submenu: {
                        title: "Group",
                        extra: group,
                        options: group.getMenuOptions()
                    }
                })
            }
        }

        //show menu
        if (!menu_info)
            return

        // @ts-expect-error Remove param ref_window - unused
        new LiteGraph.ContextMenu(menu_info, options, ref_window)

        function inner_option_clicked(v, options) {
            if (!v) return

            if (v.content == "Remove Slot") {
                const info = v.slot
                node.graph.beforeChange()
                if (info.input) {
                    node.removeInput(info.slot)
                } else if (info.output) {
                    node.removeOutput(info.slot)
                }
                node.graph.afterChange()
                return
            } else if (v.content == "Disconnect Links") {
                const info = v.slot
                node.graph.beforeChange()
                if (info.output) {
                    node.disconnectOutput(info.slot)
                } else if (info.input) {
                    node.disconnectInput(info.slot)
                }
                node.graph.afterChange()
                return
            } else if (v.content == "Rename Slot") {
                const info = v.slot
                const slot_info = info.input
                    ? node.getInputInfo(info.slot)
                    : node.getOutputInfo(info.slot)
                const dialog = that.createDialog(
                    "<span class='name'>Name</span><input autofocus type='text'/><button>OK</button>",
                    options
                )
                const input = dialog.querySelector("input")
                if (input && slot_info) {
                    input.value = slot_info.label || ""
                }
                const inner = function () {
                    node.graph.beforeChange()
                    if (input.value) {
                        if (slot_info) {
                            slot_info.label = input.value
                        }
                        that.setDirty(true)
                    }
                    dialog.close()
                    node.graph.afterChange()
                }
                dialog.querySelector("button").addEventListener("click", inner)
                input.addEventListener("keydown", function (e) {
                    dialog.is_modified = true
                    if (e.keyCode == 27) {
                        //ESC
                        dialog.close()
                    } else if (e.keyCode == 13) {
                        inner() // save
                    } else if (e.keyCode != 13 && (e.target as Element).localName != "textarea") {
                        return
                    }
                    e.preventDefault()
                    e.stopPropagation()
                })
                input.focus()
            }

            //if(v.callback)
            //	return v.callback.call(that, node, options, e, menu, that, event );
        }
    }
}
