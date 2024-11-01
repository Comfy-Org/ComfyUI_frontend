import type { Dictionary, IContextMenuValue, IFoundSlot, INodeFlags, INodeInputSlot, INodeOutputSlot, IOptionalSlotData, ISlotType, Point, Rect, Size } from "./interfaces"
import type { LGraph } from "./LGraph"
import type { IWidget, TWidgetValue } from "./types/widgets"
import type { ISerialisedNode } from "./types/serialisation"
import type { LGraphCanvas } from "./LGraphCanvas"
import type { CanvasMouseEvent } from "./types/events"
import type { DragAndScale } from "./DragAndScale"
import { LGraphEventMode, NodeSlotType, TitleMode, RenderShape } from "./types/globalEnums"
import { BadgePosition, LGraphBadge } from "./LGraphBadge"
import { type LGraphNodeConstructor, LiteGraph } from "./litegraph"
import { isInsideRectangle } from "./measure"
import { LLink } from "./LLink"

export type NodeId = number | string

export interface INodePropertyInfo {
    name: string
    type: string
    default_value: unknown
}

export type INodeProperties = Dictionary<unknown> & {
    horizontal?: boolean
}

interface IMouseOverData {
    inputId: number | null
    outputId: number | null
    overWidget: IWidget | null
}

interface ConnectByTypeOptions {
    /** @deprecated Events */
    createEventInCase?: boolean
    /** Allow our wildcard slot to connect to typed slots on remote node. Default: true */
    wildcardToTyped?: boolean
    /** Allow our typed slot to connect to wildcard slots on remote node. Default: true */
    typedToWildcard?: boolean
}

/** Internal type used for type safety when implementing generic checks for inputs & outputs */
interface IGenericLinkOrLinks {
    links?: INodeOutputSlot["links"]
    link?: INodeInputSlot["link"]
}

interface FindFreeSlotOptions {
    /** Slots matching these types will be ignored.  Default: [] */
    typesNotAccepted?: ISlotType[]
    /** If true, the slot itself is returned instead of the index.  Default: false */
    returnObj?: boolean
}

/*
title: string
pos: [x,y]
size: [x,y]

input|output: every connection
    +  { name:string, type:string, pos: [x,y]=Optional, direction: "input"|"output", links: Array });

general properties:
    + clip_area: if you render outside the node, it will be clipped
    + unsafe_execution: not allowed for safe execution
    + skip_repeated_outputs: when adding new outputs, it wont show if there is one already connected
    + resizable: if set to false it wont be resizable with the mouse
    + horizontal: slots are distributed horizontally
    + widgets_start_y: widgets start at y distance from the top of the node

flags object:
    + collapsed: if it is collapsed

supported callbacks:
    + onAdded: when added to graph (warning: this is called BEFORE the node is configured when loading)
    + onRemoved: when removed from graph
    + onStart:	when the graph starts playing
    + onStop:	when the graph stops playing
    + onDrawForeground: render the inside widgets inside the node
    + onDrawBackground: render the background area inside the node (only in edit mode)
    + onMouseDown
    + onMouseMove
    + onMouseUp
    + onMouseEnter
    + onMouseLeave
    + onExecute: execute the node
    + onPropertyChanged: when a property is changed in the panel (return true to skip default behaviour)
    + onGetInputs: returns an array of possible inputs
    + onGetOutputs: returns an array of possible outputs
    + onBounding: in case this node has a bigger bounding than the node itself (the callback receives the bounding as [x,y,w,h])
    + onDblClick: double clicked in the node
    + onNodeTitleDblClick: double clicked in the node title
    + onInputDblClick: input slot double clicked (can be used to automatically create a node connected)
    + onOutputDblClick: output slot double clicked (can be used to automatically create a node connected)
    + onConfigure: called after the node has been configured
    + onSerialize: to add extra info when serializing (the callback receives the object that should be filled with the data)
    + onSelected
    + onDeselected
    + onDropItem : DOM item dropped over the node
    + onDropFile : file dropped over the node
    + onConnectInput : if returns false the incoming connection will be canceled
    + onConnectionsChange : a connection changed (new one or removed) (NodeSlotType.INPUT or NodeSlotType.OUTPUT, slot, true if connected, link_info, input_info )
    + onAction: action slot triggered
    + getExtraMenuOptions: to add option to context menu
*/

export interface LGraphNode {
    constructor: LGraphNodeConstructor
}

/**
 * Base Class for all the node type classes
 * @param {String} name a name for the node
 */
export class LGraphNode {
    // Static properties used by dynamic child classes
    static title?: string
    static MAX_CONSOLE?: number
    static type?: string
    static category?: string
    static supported_extensions?: string[]
    static filter?: string
    static skip_list?: boolean

    title?: string
    graph: LGraph
    id?: NodeId
    type?: string
    inputs: INodeInputSlot[]
    outputs: INodeOutputSlot[]
    // Not used
    connections: unknown[]
    properties: INodeProperties
    properties_info: INodePropertyInfo[]
    flags: INodeFlags
    widgets?: IWidget[]

    size: Size
    locked?: boolean

    // Execution order, automatically computed during run
    order?: number
    mode: LGraphEventMode
    last_serialization?: ISerialisedNode
    serialize_widgets?: boolean
    color: string
    bgcolor: string
    boxcolor: string
    exec_version: number
    action_call?: string
    execute_triggered: number
    action_triggered: number
    widgets_up?: boolean
    widgets_start_y?: number
    lostFocusAt?: number
    gotFocusAt?: number
    badges: (LGraphBadge | (() => LGraphBadge))[]
    badgePosition: BadgePosition
    onOutputRemoved?(this: LGraphNode, slot: number): void
    onInputRemoved?(this: LGraphNode, slot: number, input: INodeInputSlot): void
    _collapsed_width: number
    onBounding?(this: LGraphNode, out: Rect): void
    horizontal?: boolean
    console?: string[]
    _level: number
    _shape?: RenderShape
    subgraph?: LGraph
    skip_subgraph_button?: boolean
    mouseOver?: IMouseOverData
    is_selected?: boolean
    redraw_on_mouse?: boolean
    // Appears unused
    optional_inputs?
    // Appears unused
    optional_outputs?
    resizable?: boolean
    clonable?: boolean
    _relative_id?: number
    clip_area?: boolean
    ignore_remove?: boolean
    has_errors?: boolean
    removable?: boolean
    block_delete?: boolean
    showAdvanced?: boolean

    _pos: Point
    public get pos() {
        return this._pos
    }
    public set pos(value) {
        if (!value || value.length < 2) return

        this._pos[0] = value[0]
        this._pos[1] = value[1]
    }

    get shape(): RenderShape {
        return this._shape
    }
    set shape(v: RenderShape | "default" | "box" | "round" | "circle" | "card") {
        switch (v) {
            case "default":
                delete this._shape
                break
            case "box":
                this._shape = RenderShape.BOX
                break
            case "round":
                this._shape = RenderShape.ROUND
                break
            case "circle":
                this._shape = RenderShape.CIRCLE
                break
            case "card":
                this._shape = RenderShape.CARD
                break
            default:
                this._shape = v
        }
    }

    // Used in group node
    setInnerNodes?(this: LGraphNode, nodes: LGraphNode[]): void

    onConnectInput?(this: LGraphNode, target_slot: number, type: unknown, output: INodeOutputSlot, node: LGraphNode, slot: number): boolean
    onConnectOutput?(this: LGraphNode, slot: number, type: unknown, input: INodeInputSlot, target_node: number | LGraphNode, target_slot: number): boolean
    onResize?(this: LGraphNode, size: Size): void
    onPropertyChanged?(this: LGraphNode, name: string, value: unknown, prev_value?: unknown): boolean
    onConnectionsChange?(this: LGraphNode, type: ISlotType, index: number, isConnected: boolean, link_info: LLink, inputOrOutput: INodeInputSlot | INodeOutputSlot): void
    onInputAdded?(this: LGraphNode, input: INodeInputSlot): void
    onOutputAdded?(this: LGraphNode, output: INodeOutputSlot): void
    onConfigure?(this: LGraphNode, serialisedNode: ISerialisedNode): void
    onSerialize?(this: LGraphNode, serialised: ISerialisedNode): any
    onExecute?(this: LGraphNode, param?: unknown, options?: { action_call?: any }): void
    onAction?(this: LGraphNode, action: string, param: unknown, options: { action_call?: string }): void
    onDrawBackground?(this: LGraphNode, ctx: CanvasRenderingContext2D, canvas: LGraphCanvas, canvasElement: HTMLCanvasElement, mousePosition: Point): void
    onNodeCreated?(this: LGraphNode): void
    /**
     * Callback invoked by {@link connect} to override the target slot index.  Its return value overrides the target index selection.
     * @param target_slot The current input slot index 
     * @param requested_slot The originally requested slot index - could be negative, or if using (deprecated) name search, a string
     * @returns {number | null} If a number is returned, the connection will be made to that input index.
     * If an invalid index or non-number (false, null, NaN etc) is returned, the connection will be cancelled.
     */
    onBeforeConnectInput?(this: LGraphNode, target_slot: number, requested_slot?: number | string): number | false | null
    onShowCustomPanelInfo?(this: LGraphNode, panel: any): void
    onAddPropertyToPanel?(this: LGraphNode, pName: string, panel: any): boolean
    onWidgetChanged?(this: LGraphNode, name: string, value: unknown, old_value: unknown, w: IWidget): void
    onDeselected?(this: LGraphNode): void
    onKeyUp?(this: LGraphNode, e: KeyboardEvent): void
    onKeyDown?(this: LGraphNode, e: KeyboardEvent): void
    onSelected?(this: LGraphNode): void
    getExtraMenuOptions?(this: LGraphNode, canvas: LGraphCanvas, options: IContextMenuValue[]): IContextMenuValue[]
    getMenuOptions?(this: LGraphNode, canvas: LGraphCanvas): IContextMenuValue[]
    onAdded?(this: LGraphNode, graph: LGraph): void
    onDrawCollapsed?(this: LGraphNode, ctx: CanvasRenderingContext2D, cavnas: LGraphCanvas): boolean
    onDrawForeground?(this: LGraphNode, ctx: CanvasRenderingContext2D, canvas: LGraphCanvas, canvasElement: HTMLCanvasElement): void
    onMouseLeave?(this: LGraphNode, e: CanvasMouseEvent): void
    getSlotMenuOptions?(this: LGraphNode, slot: IFoundSlot): IContextMenuValue[]
    // FIXME: Re-typing
    onDropItem?(this: LGraphNode, event: Event): boolean
    onDropData?(this: LGraphNode, data: string | ArrayBuffer, filename: any, file: any): void
    onDropFile?(this: LGraphNode, file: any): void
    onInputClick?(this: LGraphNode, index: number, e: CanvasMouseEvent): void
    onInputDblClick?(this: LGraphNode, index: number, e: CanvasMouseEvent): void
    onOutputClick?(this: LGraphNode, index: number, e: CanvasMouseEvent): void
    onOutputDblClick?(this: LGraphNode, index: number, e: CanvasMouseEvent): void
    // TODO: Return type
    onGetPropertyInfo?(this: LGraphNode, property: string): any
    onNodeOutputAdd?(this: LGraphNode, value): void
    onNodeInputAdd?(this: LGraphNode, value): void
    onMenuNodeInputs?(this: LGraphNode, entries: IOptionalSlotData<INodeInputSlot>[]): IOptionalSlotData<INodeInputSlot>[]
    onMenuNodeOutputs?(this: LGraphNode, entries: IOptionalSlotData<INodeOutputSlot>[]): IOptionalSlotData<INodeOutputSlot>[]
    onGetInputs?(this: LGraphNode): INodeInputSlot[]
    onGetOutputs?(this: LGraphNode): INodeOutputSlot[]
    onMouseUp?(this: LGraphNode, e: CanvasMouseEvent, pos: Point): void
    onMouseEnter?(this: LGraphNode, e: CanvasMouseEvent): void
    onMouseDown?(this: LGraphNode, e: CanvasMouseEvent, pos: Point, canvas: LGraphCanvas): boolean
    onDblClick?(this: LGraphNode, e: CanvasMouseEvent, pos: Point, canvas: LGraphCanvas): void
    onNodeTitleDblClick?(this: LGraphNode, e: CanvasMouseEvent, pos: Point, canvas: LGraphCanvas): void
    onDrawTitle?(this: LGraphNode, ctx: CanvasRenderingContext2D): void
    onDrawTitleText?(this: LGraphNode, ctx: CanvasRenderingContext2D, title_height: number, size: Size, scale: number, title_text_font: string, selected: boolean): void
    onDrawTitleBox?(this: LGraphNode, ctx: CanvasRenderingContext2D, title_height: number, size: Size, scale: number): void
    onDrawTitleBar?(this: LGraphNode, ctx: CanvasRenderingContext2D, title_height: number, size: Size, scale: number, fgcolor: any): void
    onRemoved?(this: LGraphNode): void
    onMouseMove?(this: LGraphNode, e: MouseEvent, pos: Point, arg2: LGraphCanvas): void
    onPropertyChange?(this: LGraphNode): void
    updateOutputData?(this: LGraphNode, origin_slot: number): void
    isValidWidgetLink?(slot_index: number, node: LGraphNode, overWidget: IWidget): boolean | undefined

    constructor(title: string) {
        this._ctor(title)
    }

    _ctor(title: string): void {
        this.title = title || "Unnamed"
        this.size = [LiteGraph.NODE_WIDTH, 60]
        this.graph = null
        // Initialize _pos with a Float32Array of length 2, default value [10, 10]
        this._pos = new Float32Array([10, 10])

        this.id = LiteGraph.use_uuids ? LiteGraph.uuidv4() : -1
        this.type = null

        //inputs available: array of inputs
        this.inputs = []
        this.outputs = []
        this.connections = []
        this.badges = []
        this.badgePosition = BadgePosition.TopLeft

        //local data
        this.properties = {} //for the values
        this.properties_info = [] //for the info

        this.flags = {}
    }

    /**
     * configure a node from an object containing the serialized info
     */
    configure(info: ISerialisedNode): void {
        if (this.graph) {
            this.graph._version++
        }
        for (const j in info) {
            if (j == "properties") {
                //i don't want to clone properties, I want to reuse the old container
                for (const k in info.properties) {
                    this.properties[k] = info.properties[k]
                    this.onPropertyChanged?.(k, info.properties[k])
                }
                continue
            }

            if (info[j] == null) {
                continue
            } else if (typeof info[j] == "object") {
                //object
                if (this[j]?.configure) {
                    this[j]?.configure(info[j])
                } else {
                    this[j] = LiteGraph.cloneObject(info[j], this[j])
                }
            } //value
            else {
                this[j] = info[j]
            }
        }

        if (!info.title) {
            this.title = this.constructor.title
        }

        if (this.inputs) {
            for (let i = 0; i < this.inputs.length; ++i) {
                const input = this.inputs[i]
                const link = this.graph ? this.graph.links[input.link] : null
                this.onConnectionsChange?.(NodeSlotType.INPUT, i, true, link, input)
                this.onInputAdded?.(input)
            }
        }

        if (this.outputs) {
            for (let i = 0; i < this.outputs.length; ++i) {
                const output = this.outputs[i]
                if (!output.links) {
                    continue
                }
                for (let j = 0; j < output.links.length; ++j) {
                    const link = this.graph ? this.graph.links[output.links[j]] : null
                    this.onConnectionsChange?.(NodeSlotType.OUTPUT, i, true, link, output)
                }
                this.onOutputAdded?.(output)
            }
        }

        if (this.widgets) {
            for (let i = 0; i < this.widgets.length; ++i) {
                const w = this.widgets[i]
                if (!w)
                    continue
                if (w.options?.property && (this.properties[w.options.property] != undefined))
                    w.value = JSON.parse(JSON.stringify(this.properties[w.options.property]))
            }
            if (info.widgets_values) {
                for (let i = 0; i < info.widgets_values.length; ++i) {
                    if (this.widgets[i]) {
                        this.widgets[i].value = info.widgets_values[i]
                    }
                }
            }
        }

        // Sync the state of this.resizable.
        if (this.pinned) this.pin(true)

        this.onConfigure?.(info)
    }

    /**
     * serialize the content
     */
    serialize(): ISerialisedNode {
        //create serialization object
        const o: ISerialisedNode = {
            id: this.id,
            type: this.type,
            pos: this.pos,
            size: this.size,
            flags: LiteGraph.cloneObject(this.flags),
            order: this.order,
            mode: this.mode,
            showAdvanced: this.showAdvanced
        }

        //special case for when there were errors
        if (this.constructor === LGraphNode && this.last_serialization)
            return this.last_serialization

        if (this.inputs) o.inputs = this.inputs

        if (this.outputs) {
            //clear outputs last data (because data in connections is never serialized but stored inside the outputs info)
            for (let i = 0; i < this.outputs.length; i++) {
                delete this.outputs[i]._data
            }
            o.outputs = this.outputs
        }

        if (this.title && this.title != this.constructor.title) o.title = this.title

        if (this.properties) o.properties = LiteGraph.cloneObject(this.properties)

        if (this.widgets && this.serialize_widgets) {
            o.widgets_values = []
            for (let i = 0; i < this.widgets.length; ++i) {
                if (this.widgets[i])
                    o.widgets_values[i] = this.widgets[i].value
                else
                    o.widgets_values[i] = null
            }
        }

        if (!o.type) o.type = this.constructor.type

        if (this.color) o.color = this.color
        if (this.bgcolor) o.bgcolor = this.bgcolor
        if (this.boxcolor) o.boxcolor = this.boxcolor
        if (this.shape) o.shape = this.shape

        if (this.onSerialize?.(o)) console.warn("node onSerialize shouldnt return anything, data should be stored in the object pass in the first parameter")

        return o
    }

    /* Creates a clone of this node */
    clone(): LGraphNode {
        const node = LiteGraph.createNode(this.type)
        if (!node) return null

        //we clone it because serialize returns shared containers
        const data = LiteGraph.cloneObject(this.serialize())

        //remove links
        if (data.inputs) {
            for (let i = 0; i < data.inputs.length; ++i) {
                data.inputs[i].link = null
            }
        }

        if (data.outputs) {
            for (let i = 0; i < data.outputs.length; ++i) {
                if (data.outputs[i].links) {
                    data.outputs[i].links.length = 0
                }
            }
        }

        delete data.id

        if (LiteGraph.use_uuids) data.id = LiteGraph.uuidv4()

        //remove links
        node.configure(data)

        return node
    }

    /**
     * serialize and stringify
     */
    toString(): string {
        return JSON.stringify(this.serialize())
    }

    /**
     * get the title string
     */
    getTitle(): string {
        return this.title || this.constructor.title
    }

    /**
     * sets the value of a property
     * @param {String} name
     * @param {*} value
     */
    setProperty(name: string, value: TWidgetValue): void {
        this.properties ||= {}
        if (value === this.properties[name])
            return

        const prev_value = this.properties[name]
        this.properties[name] = value
        //abort change
        if (this.onPropertyChanged?.(name, value, prev_value) === false)
            this.properties[name] = prev_value

        if (this.widgets) //widgets could be linked to properties
            for (let i = 0; i < this.widgets.length; ++i) {
                const w = this.widgets[i]
                if (!w)
                    continue
                if (w.options.property == name) {
                    w.value = value
                    break
                }
            }
    }

    /**
     * sets the output data
     * @param {number} slot
     * @param {*} data
     */
    setOutputData(slot: number, data: unknown): void {
        if (!this.outputs) return

        //this maybe slow and a niche case
        //if(slot && slot.constructor === String)
        //	slot = this.findOutputSlot(slot);
        if (slot == -1 || slot >= this.outputs.length) return

        const output_info = this.outputs[slot]
        if (!output_info) return

        //store data in the output itself in case we want to debug
        output_info._data = data

        //if there are connections, pass the data to the connections
        if (this.outputs[slot].links) {
            for (let i = 0; i < this.outputs[slot].links.length; i++) {
                const link_id = this.outputs[slot].links[i]
                const link = this.graph.links[link_id]
                if (link)
                    link.data = data
            }
        }
    }

    /**
     * sets the output data type, useful when you want to be able to overwrite the data type
     * @param {number} slot
     * @param {String} datatype
     */
    setOutputDataType(slot: number, type: ISlotType): void {
        if (!this.outputs) return
        if (slot == -1 || slot >= this.outputs.length) return
        const output_info = this.outputs[slot]
        if (!output_info) return
        //store data in the output itself in case we want to debug
        output_info.type = type

        //if there are connections, pass the data to the connections
        if (this.outputs[slot].links) {
            for (let i = 0; i < this.outputs[slot].links.length; i++) {
                const link_id = this.outputs[slot].links[i]
                this.graph.links[link_id].type = type
            }
        }
    }

    /**
     * Retrieves the input data (data traveling through the connection) from one slot
     * @param {number} slot
     * @param {boolean} force_update if set to true it will force the connected node of this slot to output data into this link
     * @return {*} data or if it is not connected returns undefined
     */
    getInputData(slot: number, force_update?: boolean): unknown {
        if (!this.inputs) return

        if (slot >= this.inputs.length || this.inputs[slot].link == null) return

        const link_id = this.inputs[slot].link
        const link: LLink = this.graph.links[link_id]
        //bug: weird case but it happens sometimes
        if (!link) return null

        if (!force_update) return link.data

        //special case: used to extract data from the incoming connection before the graph has been executed
        const node = this.graph.getNodeById(link.origin_id)
        if (!node) return link.data

        if (node.updateOutputData) {
            node.updateOutputData(link.origin_slot)
        } else {
            node.onExecute?.()
        }

        return link.data
    }

    /**
     * Retrieves the input data type (in case this supports multiple input types)
     * @param {number} slot
     * @return {String} datatype in string format
     */
    getInputDataType(slot: number): ISlotType {
        if (!this.inputs) return null

        if (slot >= this.inputs.length || this.inputs[slot].link == null) return null
        const link_id = this.inputs[slot].link
        const link = this.graph.links[link_id]
        //bug: weird case but it happens sometimes
        if (!link) return null

        const node = this.graph.getNodeById(link.origin_id)
        if (!node) return link.type

        const output_info = node.outputs[link.origin_slot]
        return output_info
            ? output_info.type
            : null
    }

    /**
     * Retrieves the input data from one slot using its name instead of slot number
     * @param {String} slot_name
     * @param {boolean} force_update if set to true it will force the connected node of this slot to output data into this link
     * @return {*} data or if it is not connected returns null
     */
    getInputDataByName(slot_name: string, force_update: boolean): unknown {
        const slot = this.findInputSlot(slot_name)
        return slot == -1
            ? null
            : this.getInputData(slot, force_update)
    }

    /**
     * tells you if there is a connection in one input slot
     * @param {number} slot
     * @return {boolean}
     */
    isInputConnected(slot: number): boolean {
        if (!this.inputs) return false
        return slot < this.inputs.length && this.inputs[slot].link != null
    }

    /**
     * tells you info about an input connection (which node, type, etc)
     * @param {number} slot
     * @return {Object} object or null { link: id, name: string, type: string or 0 }
     */
    getInputInfo(slot: number): INodeInputSlot {
        return !this.inputs || !(slot < this.inputs.length)
            ? null
            : this.inputs[slot]
    }

    /**
     * Returns the link info in the connection of an input slot
     * @param {number} slot
     * @return {LLink} object or null
     */
    getInputLink(slot: number): LLink | null {
        if (!this.inputs) return null
        if (slot < this.inputs.length) {
            const slot_info = this.inputs[slot]
            return this.graph.links[slot_info.link]
        }
        return null
    }

    /**
     * returns the node connected in the input slot
     * @param {number} slot
     * @return {LGraphNode} node or null
     */
    getInputNode(slot: number): LGraphNode {
        if (!this.inputs) return null
        if (slot >= this.inputs.length) return null

        const input = this.inputs[slot]
        if (!input || input.link === null) return null

        const link_info = this.graph.links[input.link]
        if (!link_info) return null

        return this.graph.getNodeById(link_info.origin_id)
    }

    /**
     * returns the value of an input with this name, otherwise checks if there is a property with that name
     * @param {string} name
     * @return {*} value
     */
    getInputOrProperty(name: string): unknown {
        if (!this.inputs || !this.inputs.length) {
            return this.properties ? this.properties[name] : null
        }

        for (let i = 0, l = this.inputs.length; i < l; ++i) {
            const input_info = this.inputs[i]
            if (name == input_info.name && input_info.link != null) {
                const link = this.graph.links[input_info.link]
                if (link) return link.data
            }
        }
        return this.properties[name]
    }

    /**
     * tells you the last output data that went in that slot
     * @param {number} slot
     * @return {Object}  object or null
     */
    getOutputData(slot: number): unknown {
        if (!this.outputs) return null
        if (slot >= this.outputs.length) return null

        const info = this.outputs[slot]
        return info._data
    }

    /**
     * tells you info about an output connection (which node, type, etc)
     * @param {number} slot
     * @return {Object}  object or null { name: string, type: string, links: [ ids of links in number ] }
     */
    getOutputInfo(slot: number): INodeOutputSlot {
        return !this.outputs || !(slot < this.outputs.length)
            ? null
            : this.outputs[slot]
    }

    /**
     * tells you if there is a connection in one output slot
     * @param {number} slot
     * @return {boolean}
     */
    isOutputConnected(slot: number): boolean {
        if (!this.outputs) return false
        return slot < this.outputs.length && this.outputs[slot].links?.length > 0
    }

    /**
     * tells you if there is any connection in the output slots
     * @return {boolean}
     */
    isAnyOutputConnected(): boolean {
        if (!this.outputs) return false

        for (let i = 0; i < this.outputs.length; ++i) {
            if (this.outputs[i].links && this.outputs[i].links.length) {
                return true
            }
        }
        return false
    }

    /**
     * retrieves all the nodes connected to this output slot
     * @param {number} slot
     * @return {array}
     */
    getOutputNodes(slot: number): LGraphNode[] {
        if (!this.outputs || this.outputs.length == 0) return null

        if (slot >= this.outputs.length) return null

        const output = this.outputs[slot]
        if (!output.links || output.links.length == 0) return null

        const r: LGraphNode[] = []
        for (let i = 0; i < output.links.length; i++) {
            const link_id = output.links[i]
            const link = this.graph.links[link_id]
            if (link) {
                const target_node = this.graph.getNodeById(link.target_id)
                if (target_node) {
                    r.push(target_node)
                }
            }
        }
        return r
    }

    addOnTriggerInput(): number {
        const trigS = this.findInputSlot("onTrigger")
        if (trigS == -1) { //!trigS || 
            const input = this.addInput("onTrigger", LiteGraph.EVENT, { optional: true, nameLocked: true })
            return this.findInputSlot("onTrigger")
        }
        return trigS
    }

    addOnExecutedOutput(): number {
        const trigS = this.findOutputSlot("onExecuted")
        if (trigS == -1) { //!trigS || 
            const output = this.addOutput("onExecuted", LiteGraph.ACTION, { optional: true, nameLocked: true })
            return this.findOutputSlot("onExecuted")
        }
        return trigS
    }

    onAfterExecuteNode(param: unknown, options?: { action_call?: any }) {
        const trigS = this.findOutputSlot("onExecuted")
        if (trigS != -1) {

            //console.debug(this.id+":"+this.order+" triggering slot onAfterExecute");
            //console.debug(param);
            //console.debug(options);
            this.triggerSlot(trigS, param, null, options)

        }
    }

    changeMode(modeTo: number): boolean {
        switch (modeTo) {
            case LGraphEventMode.ON_EVENT:
                // this.addOnExecutedOutput();
                break

            case LGraphEventMode.ON_TRIGGER:
                this.addOnTriggerInput()
                this.addOnExecutedOutput()
                break

            case LGraphEventMode.NEVER:
                break

            case LGraphEventMode.ALWAYS:
                break

            // @ts-expect-error Not impl.
            case LiteGraph.ON_REQUEST:
                break

            default:
                return false
                break
        }
        this.mode = modeTo
        return true
    }

    /**
     * Triggers the node code execution, place a boolean/counter to mark the node as being executed
     * @param {*} param
     * @param {*} options
     */
    doExecute(param?: unknown, options?: { action_call?: any }): void {
        options = options || {}
        if (this.onExecute) {

            // enable this to give the event an ID
            options.action_call ||= this.id + "_exec_" + Math.floor(Math.random() * 9999)

            this.graph.nodes_executing[this.id] = true //.push(this.id);
            this.onExecute(param, options)
            this.graph.nodes_executing[this.id] = false //.pop();

            // save execution/action ref
            this.exec_version = this.graph.iteration
            if (options?.action_call) {
                this.action_call = options.action_call // if (param)
                this.graph.nodes_executedAction[this.id] = options.action_call
            }
        }
        this.execute_triggered = 2 // the nFrames it will be used (-- each step), means "how old" is the event
        this.onAfterExecuteNode?.(param, options) // callback
    }

    /**
     * Triggers an action, wrapped by logics to control execution flow
     * @param {String} action name
     * @param {*} param
     */
    actionDo(action: string, param: unknown, options: { action_call?: string }): void {
        options = options || {}
        if (this.onAction) {

            // enable this to give the event an ID
            options.action_call ||= this.id + "_" + (action ? action : "action") + "_" + Math.floor(Math.random() * 9999)

            this.graph.nodes_actioning[this.id] = (action ? action : "actioning") //.push(this.id);
            this.onAction(action, param, options)
            this.graph.nodes_actioning[this.id] = false //.pop();

            // save execution/action ref
            if (options?.action_call) {
                this.action_call = options.action_call // if (param)
                this.graph.nodes_executedAction[this.id] = options.action_call
            }
        }
        this.action_triggered = 2 // the nFrames it will be used (-- each step), means "how old" is the event
        this.onAfterExecuteNode?.(param, options)
    }

    /**
     * Triggers an event in this node, this will trigger any output with the same name
     * @param {String} event name ( "on_play", ... ) if action is equivalent to false then the event is send to all
     * @param {*} param
     */
    trigger(action: string, param: unknown, options: { action_call?: any }): void {
        if (!this.outputs || !this.outputs.length) {
            return
        }

        if (this.graph)
            this.graph._last_trigger_time = LiteGraph.getTime()

        for (let i = 0; i < this.outputs.length; ++i) {
            const output = this.outputs[i]
            if (!output || output.type !== LiteGraph.EVENT || (action && output.name != action))
                continue
            this.triggerSlot(i, param, null, options)
        }
    }

    /**
     * Triggers a slot event in this node: cycle output slots and launch execute/action on connected nodes
     * @param {Number} slot the index of the output slot
     * @param {*} param
     * @param {Number} link_id [optional] in case you want to trigger and specific output link in a slot
     */
    triggerSlot(slot: number, param: unknown, link_id: number, options: { action_call?: any }): void {
        options = options || {}
        if (!this.outputs) return

        if (slot == null) {
            console.error("slot must be a number")
            return
        }

        if (typeof slot !== "number")
            console.warn("slot must be a number, use node.trigger('name') if you want to use a string")

        const output = this.outputs[slot]
        if (!output) return

        const links = output.links
        if (!links || !links.length) return

        if (this.graph)
            this.graph._last_trigger_time = LiteGraph.getTime()

        //for every link attached here
        for (let k = 0; k < links.length; ++k) {
            const id = links[k]
            //to skip links
            if (link_id != null && link_id != id) continue

            const link_info = this.graph.links[links[k]]
            //not connected
            if (!link_info) continue

            link_info._last_time = LiteGraph.getTime()
            const node = this.graph.getNodeById(link_info.target_id)
            //node not found?
            if (!node) continue

            if (node.mode === LGraphEventMode.ON_TRIGGER) {
                // generate unique trigger ID if not present
                if (!options.action_call) options.action_call = this.id + "_trigg_" + Math.floor(Math.random() * 9999)
                // -- wrapping node.onExecute(param); --
                node.doExecute?.(param, options)
            }
            else if (node.onAction) {
                // generate unique action ID if not present
                if (!options.action_call) options.action_call = this.id + "_act_" + Math.floor(Math.random() * 9999)
                //pass the action name
                const target_connection = node.inputs[link_info.target_slot]
                // wrap node.onAction(target_connection.name, param);
                node.actionDo(target_connection.name, param, options)
            }
        }
    }

    /**
     * clears the trigger slot animation
     * @param {Number} slot the index of the output slot
     * @param {Number} link_id [optional] in case you want to trigger and specific output link in a slot
     */
    clearTriggeredSlot(slot: number, link_id: number): void {
        if (!this.outputs) return

        const output = this.outputs[slot]
        if (!output) return

        const links = output.links
        if (!links || !links.length) return

        //for every link attached here
        for (let k = 0; k < links.length; ++k) {
            const id = links[k]
            //to skip links
            if (link_id != null && link_id != id) continue

            const link_info = this.graph.links[links[k]]
            //not connected
            if (!link_info) continue

            link_info._last_time = 0
        }
    }

    /**
     * changes node size and triggers callback
     * @param {vec2} size
     */
    setSize(size: Size): void {
        this.size = size
        this.onResize?.(this.size)
    }

    /**
     * add a new property to this node
     * @param {string} name
     * @param {*} default_value
     * @param {string} type string defining the output type ("vec3","number",...)
     * @param {Object} extra_info this can be used to have special properties of the property (like values, etc)
     */
    addProperty(name: string,
        default_value: unknown,
        type?: string,
        extra_info?: Dictionary<unknown>): INodePropertyInfo {
        const o: INodePropertyInfo = { name: name, type: type, default_value: default_value }
        if (extra_info) {
            for (const i in extra_info) {
                o[i] = extra_info[i]
            }
        }
        this.properties_info ||= []
        this.properties_info.push(o)
        this.properties ||= {}
        this.properties[name] = default_value
        return o
    }

    /**
     * add a new output slot to use in this node
     * @param {string} name
     * @param {string} type string defining the output type ("vec3","number",...)
     * @param {Object} extra_info this can be used to have special properties of an output (label, special color, position, etc)
     */
    addOutput(name?: string, type?: ISlotType, extra_info?: object): INodeOutputSlot {
        const output = { name: name, type: type, links: null }
        if (extra_info) {
            for (const i in extra_info) {
                output[i] = extra_info[i]
            }
        }

        this.outputs ||= []
        this.outputs.push(output)
        this.onOutputAdded?.(output)

        if (LiteGraph.auto_load_slot_types) LiteGraph.registerNodeAndSlotType(this, type, true)

        this.setSize(this.computeSize())
        this.setDirtyCanvas(true, true)
        return output
    }

    /**
     * add a new output slot to use in this node
     * @param {Array} array of triplets like [[name,type,extra_info],[...]]
     */
    addOutputs(array: [string, ISlotType, Record<string, unknown>][]): void {
        for (let i = 0; i < array.length; ++i) {
            const info = array[i]
            const o = { name: info[0], type: info[1], links: null }
            if (array[2]) {
                for (const j in info[2]) {
                    o[j] = info[2][j]
                }
            }

            this.outputs ||= []
            this.outputs.push(o)
            this.onOutputAdded?.(o)

            if (LiteGraph.auto_load_slot_types) LiteGraph.registerNodeAndSlotType(this, info[1], true)

        }

        this.setSize(this.computeSize())
        this.setDirtyCanvas(true, true)
    }

    /**
     * remove an existing output slot
     * @param {number} slot
     */
    removeOutput(slot: number): void {
        this.disconnectOutput(slot)
        this.outputs.splice(slot, 1)
        for (let i = slot; i < this.outputs.length; ++i) {
            if (!this.outputs[i] || !this.outputs[i].links)
                continue
            const links = this.outputs[i].links
            for (let j = 0; j < links.length; ++j) {
                const link = this.graph.links[links[j]]
                if (!link) continue

                link.origin_slot -= 1
            }
        }

        this.setSize(this.computeSize())
        this.onOutputRemoved?.(slot)
        this.setDirtyCanvas(true, true)
    }

    /**
     * add a new input slot to use in this node
     * @param {string} name
     * @param {string} type string defining the input type ("vec3","number",...), it its a generic one use 0
     * @param {Object} extra_info this can be used to have special properties of an input (label, color, position, etc)
     */
    addInput(name: string, type: ISlotType, extra_info?: object): INodeInputSlot {
        type = type || 0
        const input: INodeInputSlot = { name: name, type: type, link: null }
        if (extra_info) {
            for (const i in extra_info) {
                input[i] = extra_info[i]
            }
        }

        this.inputs ||= []
        this.inputs.push(input)
        this.setSize(this.computeSize())

        this.onInputAdded?.(input)
        LiteGraph.registerNodeAndSlotType(this, type)

        this.setDirtyCanvas(true, true)
        return input
    }

    /**
     * add several new input slots in this node
     * @param {Array} array of triplets like [[name,type,extra_info],[...]]
     */
    addInputs(array: [string, ISlotType, Record<string, unknown>][]): void {
        for (let i = 0; i < array.length; ++i) {
            const info = array[i]
            const o: INodeInputSlot = { name: info[0], type: info[1], link: null }
            // TODO: Checking the wrong variable here - confirm no downstream consumers, then remove.
            if (array[2]) {
                for (const j in info[2]) {
                    o[j] = info[2][j]
                }
            }

            this.inputs ||= []
            this.inputs.push(o)
            this.onInputAdded?.(o)

            LiteGraph.registerNodeAndSlotType(this, info[1])
        }

        this.setSize(this.computeSize())
        this.setDirtyCanvas(true, true)
    }

    /**
     * remove an existing input slot
     * @param {number} slot
     */
    removeInput(slot: number): void {
        this.disconnectInput(slot)
        const slot_info = this.inputs.splice(slot, 1)
        for (let i = slot; i < this.inputs.length; ++i) {
            if (!this.inputs[i]) continue

            const link = this.graph.links[this.inputs[i].link]
            if (!link) continue

            link.target_slot -= 1
        }
        this.setSize(this.computeSize())
        this.onInputRemoved?.(slot, slot_info[0])
        this.setDirtyCanvas(true, true)
    }

    /**
     * add an special connection to this node (used for special kinds of graphs)
     * @param {string} name
     * @param {string} type string defining the input type ("vec3","number",...)
     * @param {[x,y]} pos position of the connection inside the node
     * @param {string} direction if is input or output
     */
    addConnection(name: string, type: string, pos: Point, direction: string) {
        const o = {
            name: name,
            type: type,
            pos: pos,
            direction: direction,
            links: null
        }
        this.connections.push(o)
        return o
    }

    /**
     * computes the minimum size of a node according to its inputs and output slots
     * @param out
     * @return the total size
     */
    computeSize(out?: Size): Size {
        const ctorSize = this.constructor.size
        if (ctorSize) return [ctorSize[0], ctorSize[1]]

        let rows = Math.max(
            this.inputs ? this.inputs.length : 1,
            this.outputs ? this.outputs.length : 1
        )
        const size = out || new Float32Array([0, 0])
        rows = Math.max(rows, 1)
        const font_size = LiteGraph.NODE_TEXT_SIZE //although it should be graphcanvas.inner_text_font size

        const title_width = compute_text_size(this.title)
        let input_width = 0
        let output_width = 0

        if (this.inputs) {
            for (let i = 0, l = this.inputs.length; i < l; ++i) {
                const input = this.inputs[i]
                const text = input.label || input.name || ""
                const text_width = compute_text_size(text)
                if (input_width < text_width)
                    input_width = text_width
            }
        }

        if (this.outputs) {
            for (let i = 0, l = this.outputs.length; i < l; ++i) {
                const output = this.outputs[i]
                const text = output.label || output.name || ""
                const text_width = compute_text_size(text)
                if (output_width < text_width)
                    output_width = text_width
            }
        }

        size[0] = Math.max(input_width + output_width + 10, title_width)
        size[0] = Math.max(size[0], LiteGraph.NODE_WIDTH)
        if (this.widgets?.length)
            size[0] = Math.max(size[0], LiteGraph.NODE_WIDTH * 1.5)

        size[1] = (this.constructor.slot_start_y || 0) + rows * LiteGraph.NODE_SLOT_HEIGHT

        let widgets_height = 0
        if (this.widgets?.length) {
            for (let i = 0, l = this.widgets.length; i < l; ++i) {
                const widget = this.widgets[i]
                if (widget.hidden || (widget.advanced && !this.showAdvanced)) continue;

                widgets_height += widget.computeSize
                    ? widget.computeSize(size[0])[1] + 4
                    : LiteGraph.NODE_WIDGET_HEIGHT + 4
            }
            widgets_height += 8
        }

        //compute height using widgets height
        if (this.widgets_up)
            size[1] = Math.max(size[1], widgets_height)
        else if (this.widgets_start_y != null)
            size[1] = Math.max(size[1], widgets_height + this.widgets_start_y)
        else
            size[1] += widgets_height

        function compute_text_size(text: string) {
            return text
                ? font_size * text.length * 0.6
                : 0
        }

        if (this.constructor.min_height && size[1] < this.constructor.min_height) {
            size[1] = this.constructor.min_height
        }

        //margin
        size[1] += 6

        return size
    }

    inResizeCorner(canvasX: number, canvasY: number): boolean {
        const rows = this.outputs ? this.outputs.length : 1
        const outputs_offset = (this.constructor.slot_start_y || 0) + rows * LiteGraph.NODE_SLOT_HEIGHT
        return isInsideRectangle(canvasX,
            canvasY,
            this.pos[0] + this.size[0] - 15,
            this.pos[1] + Math.max(this.size[1] - 15, outputs_offset),
            20,
            20
        )
    }

    /**
     * returns all the info available about a property of this node.
     *
     * @param {String} property name of the property
     * @return {Object} the object with all the available info
     */
    getPropertyInfo(property: string) {
        let info = null

        //there are several ways to define info about a property
        //legacy mode
        if (this.properties_info) {
            for (let i = 0; i < this.properties_info.length; ++i) {
                if (this.properties_info[i].name == property) {
                    info = this.properties_info[i]
                    break
                }
            }
        }
        //litescene mode using the constructor
        if (this.constructor["@" + property])
            info = this.constructor["@" + property]

        if (this.constructor.widgets_info?.[property])
            info = this.constructor.widgets_info[property]

        //litescene mode using the constructor
        if (!info && this.onGetPropertyInfo) {
            info = this.onGetPropertyInfo(property)
        }

        info ||= {}
        info.type ||= typeof this.properties[property]
        if (info.widget == "combo")
            info.type = "enum"

        return info
    }

    /**
     * Defines a widget inside the node, it will be rendered on top of the node, you can control lots of properties
     *
     * @param {String} type the widget type (could be "number","string","combo"
     * @param {String} name the text to show on the widget
     * @param {String} value the default value
     * @param {Function|String} callback function to call when it changes (optionally, it can be the name of the property to modify)
     * @param {Object} options the object that contains special properties of this widget
     * @return {Object} the created widget object
     */
    addWidget(type: string, name: string, value: any, callback: IWidget["callback"], options?: any): IWidget {
        this.widgets ||= []

        if (!options && callback && typeof callback === "object") {
            options = callback
            callback = null
        }

        //options can be the property name
        if (options && typeof options === "string")
            options = { property: options }

        //callback can be the property name
        if (callback && typeof callback === "string") {
            options ||= {}
            options.property = callback
            callback = null
        }

        if (callback && typeof callback !== "function") {
            console.warn("addWidget: callback must be a function")
            callback = null
        }

        const w: IWidget = {
            // @ts-expect-error Type check or just assert?
            type: type.toLowerCase(),
            name: name,
            value: value,
            callback: callback,
            options: options || {}
        }

        if (w.options.y !== undefined) {
            w.y = w.options.y
        }

        if (!callback && !w.options.callback && !w.options.property) {
            console.warn("LiteGraph addWidget(...) without a callback or property assigned")
        }
        if (type == "combo" && !w.options.values) {
            throw "LiteGraph addWidget('combo',...) requires to pass values in options: { values:['red','blue'] }"
        }
        this.widgets.push(w)
        this.setSize(this.computeSize())
        return w
    }

    addCustomWidget(custom_widget: IWidget): IWidget {
        this.widgets ||= []
        this.widgets.push(custom_widget)
        return custom_widget
    }

    /**
     * Measures the node for rendering, populating {@link out} with the results in graph space.
     * @param out Results (x, y, width, height) are inserted into this array.
     * @param pad Expands the area by this amount on each side.  Default: 0
     */
    measure(out: Rect, pad = 0): void {
        const titleMode = this.constructor.title_mode
        const renderTitle = titleMode != TitleMode.TRANSPARENT_TITLE && titleMode != TitleMode.NO_TITLE
        const titleHeight = renderTitle ? LiteGraph.NODE_TITLE_HEIGHT : 0

        out[0] = this.pos[0] - pad
        out[1] = this.pos[1] + -titleHeight - pad
        if (!this.flags?.collapsed) {
            out[2] = this.size[0] + (2 * pad)
            out[3] = this.size[1] + titleHeight + (2 * pad)
        } else {
            out[2] = (this._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH) + (2 * pad)
            out[3] = LiteGraph.NODE_TITLE_HEIGHT + (2 * pad)
        }
    }

    /**
     * returns the bounding of the object, used for rendering purposes
     * @param out {Float32Array[4]?} [optional] a place to store the output, to free garbage
     * @param compute_outer {boolean?} [optional] set to true to include the shadow and connection points in the bounding calculation
     * @return {Float32Array[4]} the bounding box in format of [topleft_cornerx, topleft_cornery, width, height]
     */
    getBounding(out?: Float32Array, compute_outer?: boolean): Float32Array {
        out = out || new Float32Array(4)
        this.measure(out)
        if (compute_outer) {
            // 4 offset for collapsed node connection points
            out[0] -= 4
            out[1] -= 4
            // Add shadow & left offset
            out[2] += 6 + 4
            // Add shadow & top offsets
            out[3] += 5 + 4
        }
        this.onBounding?.(out)
        return out
    }

    /**
     * checks if a point is inside the shape of a node
     * @param {number} x
     * @param {number} y
     * @return {boolean}
     */
    isPointInside(x: number, y: number, margin?: number, skip_title?: boolean): boolean {
        margin ||= 0

        const margin_top = skip_title || this.graph?.isLive()
            ? 0
            : LiteGraph.NODE_TITLE_HEIGHT

        if (this.flags.collapsed) {
            //if ( distance([x,y], [this.pos[0] + this.size[0]*0.5, this.pos[1] + this.size[1]*0.5]) < LiteGraph.NODE_COLLAPSED_RADIUS)
            if (isInsideRectangle(
                x,
                y,
                this.pos[0] - margin,
                this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT - margin,
                (this._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH) +
                2 * margin,
                LiteGraph.NODE_TITLE_HEIGHT + 2 * margin
            )) {
                return true
            }
        } else if (this.pos[0] - 4 - margin < x &&
            this.pos[0] + this.size[0] + 4 + margin > x &&
            this.pos[1] - margin_top - margin < y &&
            this.pos[1] + this.size[1] + margin > y) {
            return true
        }
        return false
    }

    /**
     * checks if a point is inside a node slot, and returns info about which slot
     * @param x
     * @param y
     * @returns if found the object contains { input|output: slot object, slot: number, link_pos: [x,y] }
     */
    getSlotInPosition(x: number, y: number): IFoundSlot | null {
        //search for inputs
        const link_pos = new Float32Array(2)
        if (this.inputs) {
            for (let i = 0, l = this.inputs.length; i < l; ++i) {
                const input = this.inputs[i]
                this.getConnectionPos(true, i, link_pos)
                if (isInsideRectangle(x, y, link_pos[0] - 10, link_pos[1] - 5, 20, 10)) {
                    return { input, slot: i, link_pos }
                }
            }
        }

        if (this.outputs) {
            for (let i = 0, l = this.outputs.length; i < l; ++i) {
                const output = this.outputs[i]
                this.getConnectionPos(false, i, link_pos)
                if (isInsideRectangle(x, y, link_pos[0] - 10, link_pos[1] - 5, 20, 10)) {
                    return { output, slot: i, link_pos }
                }
            }
        }

        return null
    }

    /**
     * Returns the input slot with a given name (used for dynamic slots), -1 if not found
     * @param name the name of the slot
     * @param returnObj if the obj itself wanted
     * @returns the slot (-1 if not found)
     */
    findInputSlot<TReturn extends false>(name: string, returnObj?: TReturn): number
    findInputSlot<TReturn extends true>(name: string, returnObj?: TReturn): INodeInputSlot
    findInputSlot(name: string, returnObj: boolean = false) {
        if (!this.inputs) return -1

        for (let i = 0, l = this.inputs.length; i < l; ++i) {
            if (name == this.inputs[i].name) {
                return !returnObj ? i : this.inputs[i]
            }
        }
        return -1
    }

    /**
     * returns the output slot with a given name (used for dynamic slots), -1 if not found
     * @param {string} name the name of the slot
     * @param {boolean} returnObj if the obj itself wanted
     * @return {number | INodeOutputSlot} the slot (-1 if not found)
     */
    findOutputSlot<TReturn extends false>(name: string, returnObj?: TReturn): number
    findOutputSlot<TReturn extends true>(name: string, returnObj?: TReturn): INodeOutputSlot
    findOutputSlot(name: string, returnObj: boolean = false) {
        if (!this.outputs) return -1

        for (let i = 0, l = this.outputs.length; i < l; ++i) {
            if (name == this.outputs[i].name) {
                return !returnObj ? i : this.outputs[i]
            }
        }
        return -1
    }

    /**
     * Finds the first free input slot.
     * @param {object} optsIn
     * @return The index of the first matching slot, the slot itself if returnObj is true, or -1 if not found.
     */
    findInputSlotFree<TReturn extends false>(optsIn?: FindFreeSlotOptions & { returnObj?: TReturn }): number
    findInputSlotFree<TReturn extends true>(optsIn?: FindFreeSlotOptions & { returnObj?: TReturn }): INodeInputSlot
    findInputSlotFree(optsIn?: FindFreeSlotOptions) {
        return this.#findFreeSlot(this.inputs, optsIn)
    }

    /**
     * Finds the first free output slot.
     * @param {object} optsIn
     * @return The index of the first matching slot, the slot itself if returnObj is true, or -1 if not found.
     */
    findOutputSlotFree<TReturn extends false>(optsIn?: FindFreeSlotOptions & { returnObj?: TReturn }): number
    findOutputSlotFree<TReturn extends true>(optsIn?: FindFreeSlotOptions & { returnObj?: TReturn }): INodeOutputSlot
    findOutputSlotFree(optsIn?: FindFreeSlotOptions) {
        return this.#findFreeSlot(this.outputs, optsIn)
    }

    /**
     * Finds the next free slot
     * @param slots The slots to search, i.e. this.inputs or this.outputs
     * @param options Options
     */
    #findFreeSlot<TSlot extends INodeInputSlot | INodeOutputSlot>(slots: TSlot[], options?: FindFreeSlotOptions): TSlot | number {
        const defaults = {
            returnObj: false,
            typesNotAccepted: []
        }
        const opts = Object.assign(defaults, options || {})
        const length = slots?.length
        if (!(length > 0)) return -1

        for (let i = 0; i < length; ++i) {
            const slot: TSlot & IGenericLinkOrLinks = slots[i]
            if (!slot || slot.link || slot.links?.length) continue
            if (opts.typesNotAccepted?.includes?.(slot.type)) continue
            return !opts.returnObj ? i : slot
        }
        return -1
    }

    /**
     * findSlotByType for INPUTS
     */
    findInputSlotByType<TReturn extends false>(type: ISlotType, returnObj?: TReturn, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): number
    findInputSlotByType<TReturn extends true>(type: ISlotType, returnObj?: TReturn, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): INodeInputSlot
    findInputSlotByType(type: ISlotType, returnObj?: boolean, preferFreeSlot?: boolean, doNotUseOccupied?: boolean) {
        return this.#findSlotByType(this.inputs, type, returnObj, preferFreeSlot, doNotUseOccupied)
    }

    /**
     * findSlotByType for OUTPUTS
     */
    findOutputSlotByType<TReturn extends false>(type: ISlotType, returnObj?: TReturn, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): number
    findOutputSlotByType<TReturn extends true>(type: ISlotType, returnObj?: TReturn, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): INodeOutputSlot
    findOutputSlotByType(type: ISlotType, returnObj?: boolean, preferFreeSlot?: boolean, doNotUseOccupied?: boolean) {
        return this.#findSlotByType(this.outputs, type, returnObj, preferFreeSlot, doNotUseOccupied)
    }

    /**
     * returns the output (or input) slot with a given type, -1 if not found
     * @param {boolean} input uise inputs instead of outputs
     * @param {string} type the type of the slot
     * @param {boolean} returnObj if the obj itself wanted
     * @param {boolean} preferFreeSlot if we want a free slot (if not found, will return the first of the type anyway)
     * @return {number_or_object} the slot (-1 if not found)
     */
    findSlotByType<TSlot extends true | false, TReturn extends false>(input: TSlot, type: ISlotType, returnObj?: TReturn, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): number
    findSlotByType<TSlot extends true, TReturn extends true>(input: TSlot, type: ISlotType, returnObj?: TReturn, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): INodeInputSlot
    findSlotByType<TSlot extends false, TReturn extends true>(input: TSlot, type: ISlotType, returnObj?: TReturn, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): INodeOutputSlot
    findSlotByType(input: boolean, type: ISlotType, returnObj?: boolean, preferFreeSlot?: boolean, doNotUseOccupied?: boolean) {
        return input
            ? this.#findSlotByType(this.inputs, type, returnObj, preferFreeSlot, doNotUseOccupied)
            : this.#findSlotByType(this.outputs, type, returnObj, preferFreeSlot, doNotUseOccupied)
    }

    /**
     * Finds a matching slot from those provided, returning the slot itself or its index in {@link slots}.
     * @param slots Slots to search (this.inputs or this.outputs)
     * @param type Type of slot to look for
     * @param returnObj If true, returns the slot itself.  Otherwise, the index.
     * @param preferFreeSlot Prefer a free slot, but if none are found, fall back to an occupied slot.
     * @param doNotUseOccupied Do not fall back to occupied slots.
     * @see {findSlotByType}
     * @see {findOutputSlotByType}
     * @see {findInputSlotByType}
     * @returns If a match is found, the slot if returnObj is true, otherwise the index.  If no matches are found, -1
     */
    #findSlotByType<TSlot extends INodeInputSlot | INodeOutputSlot>(slots: TSlot[], type: ISlotType, returnObj?: boolean, preferFreeSlot?: boolean, doNotUseOccupied?: boolean): TSlot | number {
        const length = slots?.length
        if (!length) return -1

        // !! empty string type is considered 0, * !!
        if (type == "" || type == "*") type = 0
        const sourceTypes = String(type).toLowerCase().split(",")

        // Run the search
        let occupiedSlot: number | TSlot | null = null
        for (let i = 0; i < length; ++i) {
            const slot: TSlot & IGenericLinkOrLinks = slots[i]
            const destTypes = slot.type == "0" || slot.type == "*"
                ? ["0"]
                : String(slot.type).toLowerCase().split(",")

            for (const sourceType of sourceTypes) {
                // TODO: Remove _event_ entirely.
                const source = sourceType == "_event_" ? LiteGraph.EVENT : sourceType

                for (const destType of destTypes) {
                    const dest = destType == "_event_" ? LiteGraph.EVENT : destType

                    if (source == dest || source === "*" || dest === "*") {
                        if (preferFreeSlot && (slot.links?.length || slot.link != null)) {
                            // In case we can't find a free slot.
                            occupiedSlot ??= returnObj ? slot : i
                            continue
                        }
                        return returnObj ? slot : i
                    }
                }
            }
        }

        return doNotUseOccupied ? -1 : occupiedSlot ?? -1
    }

    /**
     * Determines the slot index to connect to when attempting to connect by type.
     * 
     * @param findInputs If true, searches for an input.  Otherwise, an output.
     * @param node The node at the other end of the connection.
     * @param slotType The type of slot at the other end of the connection.
     * @param options Search restrictions to adhere to.
     * @see {connectByType}
     * @see {connectByTypeOutput}
     */
    findConnectByTypeSlot(
        findInputs: boolean,
        node: LGraphNode,
        slotType: ISlotType,
        options?: ConnectByTypeOptions
    ): number | null {
        // LEGACY: Old options names
        if (options && typeof options === "object") {
            if ("firstFreeIfInputGeneralInCase" in options) options.wildcardToTyped = !!options.firstFreeIfInputGeneralInCase
            if ("firstFreeIfOutputGeneralInCase" in options) options.wildcardToTyped = !!options.firstFreeIfOutputGeneralInCase
            if ("generalTypeInCase" in options) options.typedToWildcard = !!options.generalTypeInCase
        }
        const optsDef: ConnectByTypeOptions = {
            createEventInCase: true,
            wildcardToTyped: true,
            typedToWildcard: true
        }
        const opts = Object.assign(optsDef, options)

        if (node && typeof node === "number") {
            node = this.graph.getNodeById(node)
        }
        const slot = node.findSlotByType(findInputs, slotType, false, true)
        if (slot >= 0 && slot !== null) return slot

        // TODO: Remove or reimpl. events.  WILL CREATE THE onTrigger IN SLOT
        if (opts.createEventInCase && slotType == LiteGraph.EVENT) {
            if (findInputs) return -1
            if (LiteGraph.do_add_triggers_slots) return node.addOnExecutedOutput()
        }

        // connect to the first general output slot if not found a specific type and 
        if (opts.typedToWildcard) {
            const generalSlot = node.findSlotByType(findInputs, 0, false, true, true)
            if (generalSlot >= 0) return generalSlot
        }
        // connect to the first free input slot if not found a specific type and this output is general
        if (opts.wildcardToTyped && (slotType == 0 || slotType == "*" || slotType == "")) {
            const opt = { typesNotAccepted: [LiteGraph.EVENT] }
            const nonEventSlot = findInputs
                ? node.findInputSlotFree(opt)
                : node.findOutputSlotFree(opt)
            if (nonEventSlot >= 0) return nonEventSlot
        }
        return null
    }

    /**
     * connect this node output to the input of another node BY TYPE
     * @param {number} slot (could be the number of the slot or the string with the name of the slot)
     * @param {LGraphNode} target_node the target node
     * @param {string} target_slotType the input slot type of the target node
     * @return {Object} the link_info is created, otherwise null
     */
    connectByType(slot: number | string, target_node: LGraphNode, target_slotType: ISlotType, optsIn?: ConnectByTypeOptions): LLink | null {
        const slotIndex = this.findConnectByTypeSlot(true, target_node, target_slotType, optsIn)
        if (slotIndex !== null) return this.connect(slot, target_node, slotIndex)

        console.debug("[connectByType]: no way to connect type: ", target_slotType, " to node: ", target_node)
        return null
    }

    /**
     * connect this node input to the output of another node BY TYPE
     * @method connectByType
     * @param {number | string} slot (could be the number of the slot or the string with the name of the slot)
     * @param {LGraphNode} source_node the target node
     * @param {string} source_slotType the output slot type of the target node
     * @return {Object} the link_info is created, otherwise null
     */
    connectByTypeOutput(slot: number | string, source_node: LGraphNode, source_slotType: ISlotType, optsIn?: ConnectByTypeOptions): LLink | null {
        // LEGACY: Old options names
        if (typeof optsIn === "object") {
            if ("firstFreeIfInputGeneralInCase" in optsIn) optsIn.wildcardToTyped = !!optsIn.firstFreeIfInputGeneralInCase
            if ("generalTypeInCase" in optsIn) optsIn.typedToWildcard = !!optsIn.generalTypeInCase
        }
        const slotIndex = this.findConnectByTypeSlot(false, source_node, source_slotType, optsIn)
        if (slotIndex !== null) return source_node.connect(slotIndex, this, slot)

        console.debug("[connectByType]: no way to connect type: ", source_slotType, " to node: ", source_node)
        return null
    }

    /**
     * Connect an output of this node to an input of another node
     * @param {number | string} slot (could be the number of the slot or the string with the name of the slot)
     * @param {LGraphNode} target_node the target node
     * @param {number | string} target_slot the input slot of the target node (could be the number of the slot or the string with the name of the slot, or -1 to connect a trigger)
     * @return {Object} the link_info is created, otherwise null
     */
    connect(slot: number | string, target_node: LGraphNode, target_slot: ISlotType): LLink | null {
        // Allow legacy API support for searching target_slot by string, without mutating the input variables
        let targetIndex: number

        if (!this.graph) {
            //could be connected before adding it to a graph
            //due to link ids being associated with graphs
            console.log("Connect: Error, node doesn't belong to any graph. Nodes must be added first to a graph before connecting them.")
            return null
        }

        //seek for the output slot
        if (typeof slot === "string") {
            slot = this.findOutputSlot(slot)
            if (slot == -1) {
                if (LiteGraph.debug) console.log("Connect: Error, no slot of name " + slot)
                return null
            }
        } else if (!this.outputs || slot >= this.outputs.length) {
            if (LiteGraph.debug) console.log("Connect: Error, slot number not found")
            return null
        }

        if (target_node && typeof target_node === "number") {
            target_node = this.graph.getNodeById(target_node)
        }
        if (!target_node) throw "target node is null"

        //avoid loopback
        if (target_node == this) return null

        //you can specify the slot by name
        if (typeof target_slot === "string") {
            targetIndex = target_node.findInputSlot(target_slot)
            if (targetIndex == -1) {
                if (LiteGraph.debug) console.log("Connect: Error, no slot of name " + targetIndex)
                return null
            }
        } else if (target_slot === LiteGraph.EVENT) {
            // TODO: Events
            if (LiteGraph.do_add_triggers_slots) {
                target_node.changeMode(LGraphEventMode.ON_TRIGGER)
                targetIndex = target_node.findInputSlot("onTrigger")
            } else {
                return null
            }
        } else if (typeof target_slot === "number") {
            targetIndex = target_slot
        } else {
            targetIndex = 0
        }

        // Allow target node to change slot
        if (target_node.onBeforeConnectInput) {
            // This way node can choose another slot (or make a new one?)
            const requestedIndex: false | number | null = target_node.onBeforeConnectInput(targetIndex, target_slot)
            targetIndex = typeof requestedIndex === "number" ? requestedIndex : null
        }

        if (targetIndex === null || !target_node.inputs || targetIndex >= target_node.inputs.length) {
            if (LiteGraph.debug) console.log("Connect: Error, slot number not found")
            return null
        }

        let changed = false

        const input = target_node.inputs[targetIndex]
        let link_info: LLink = null
        const output = this.outputs[slot]

        if (!this.outputs[slot]) return null

        //check targetSlot and check connection types
        if (!LiteGraph.isValidConnection(output.type, input.type)) {
            this.setDirtyCanvas(false, true)
            // @ts-expect-error Unused param
            if (changed) this.graph.connectionChange(this, link_info)
            return null
        }

        // Allow nodes to block connection
        if (target_node.onConnectInput?.(targetIndex, output.type, output, this, slot) === false)
            return null
        if (this.onConnectOutput?.(slot, input.type, input, target_node, targetIndex) === false)
            return null

        //if there is something already plugged there, disconnect
        if (target_node.inputs[targetIndex]?.link != null) {
            this.graph.beforeChange()
            target_node.disconnectInput(targetIndex)
            changed = true
        }
        if (output.links?.length) {
            if (output.type === LiteGraph.EVENT && !LiteGraph.allow_multi_output_for_events) {
                this.graph.beforeChange()
                // @ts-expect-error Unused param
                this.disconnectOutput(slot, false, { doProcessChange: false })
                changed = true
            }
        }

        const nextId = LiteGraph.use_uuids
            ? LiteGraph.uuidv4()
            : ++this.graph.last_link_id

        //create link class
        link_info = new LLink(
            nextId,
            input.type || output.type,
            this.id,
            slot,
            target_node.id,
            targetIndex
        )

        //add to graph links list
        this.graph.links[link_info.id] = link_info

        //connect in output
        output.links ??= []
        output.links.push(link_info.id)
        //connect in input
        target_node.inputs[targetIndex].link = link_info.id
        if (this.graph) this.graph._version++

        //link_info has been created now, so its updated
        this.onConnectionsChange?.(
            NodeSlotType.OUTPUT,
            slot,
            true,
            link_info,
            output
        )

        target_node.onConnectionsChange?.(
            NodeSlotType.INPUT,
            targetIndex,
            true,
            link_info,
            input
        )
        this.graph?.onNodeConnectionChange?.(
            NodeSlotType.INPUT,
            target_node,
            targetIndex,
            this,
            slot
        )
        this.graph?.onNodeConnectionChange?.(
            NodeSlotType.OUTPUT,
            this,
            slot,
            target_node,
            targetIndex
        )

        this.setDirtyCanvas(false, true)
        this.graph.afterChange()
        this.graph.connectionChange(this)

        return link_info
    }

    /**
     * disconnect one output to an specific node
     * @param {number_or_string} slot (could be the number of the slot or the string with the name of the slot)
     * @param {LGraphNode} target_node the target node to which this slot is connected [Optional, if not target_node is specified all nodes will be disconnected]
     * @return {boolean} if it was disconnected successfully
     */
    disconnectOutput(slot: string | number, target_node?: LGraphNode): boolean {
        if (typeof slot === "string") {
            slot = this.findOutputSlot(slot)
            if (slot == -1) {
                if (LiteGraph.debug) console.log("Connect: Error, no slot of name " + slot)
                return false
            }
        } else if (!this.outputs || slot >= this.outputs.length) {
            if (LiteGraph.debug) console.log("Connect: Error, slot number not found")
            return false
        }

        //get output slot
        const output = this.outputs[slot]
        if (!output || !output.links || output.links.length == 0)
            return false

        //one of the output links in this slot
        const graph = this.graph
        if (target_node) {
            if (typeof target_node === "number")
                target_node = graph.getNodeById(target_node)
            if (!target_node)
                throw "Target Node not found"

            for (let i = 0, l = output.links.length; i < l; i++) {
                const link_id = output.links[i]
                const link_info = graph.links[link_id]

                //is the link we are searching for...
                if (link_info.target_id == target_node.id) {
                    output.links.splice(i, 1) //remove here
                    const input = target_node.inputs[link_info.target_slot]
                    input.link = null //remove there

                    delete graph.links[link_id] //remove the link from the links pool //remove the link from the links pool
                    if (graph) graph._version++

                    //link_info hasn't been modified so its ok
                    target_node.onConnectionsChange?.(
                        NodeSlotType.INPUT,
                        link_info.target_slot,
                        false,
                        link_info,
                        input
                    )
                    this.onConnectionsChange?.(
                        NodeSlotType.OUTPUT,
                        slot,
                        false,
                        link_info,
                        output
                    )

                    // FIXME: Called twice.
                    graph?.onNodeConnectionChange?.(NodeSlotType.OUTPUT, this, slot)
                    graph?.onNodeConnectionChange?.(NodeSlotType.OUTPUT, this, slot)
                    graph?.onNodeConnectionChange?.(NodeSlotType.INPUT, target_node, link_info.target_slot)
                    break
                }
            }
        } //all the links in this output slot
        else {
            for (let i = 0, l = output.links.length; i < l; i++) {
                const link_id = output.links[i]
                const link_info = graph.links[link_id]
                //bug: it happens sometimes
                if (!link_info) continue

                target_node = graph.getNodeById(link_info.target_id)
                if (graph) graph._version++

                if (target_node) {
                    const input = target_node.inputs[link_info.target_slot]
                    //remove other side link
                    input.link = null

                    //link_info hasn't been modified so its ok
                    target_node.onConnectionsChange?.(
                        NodeSlotType.INPUT,
                        link_info.target_slot,
                        false,
                        link_info,
                        input
                    )
                    // FIXME: Called twice.
                    graph?.onNodeConnectionChange?.(NodeSlotType.INPUT, target_node, link_info.target_slot)
                }
                //remove the link from the links pool
                delete graph.links[link_id]

                this.onConnectionsChange?.(
                    NodeSlotType.OUTPUT,
                    slot,
                    false,
                    link_info,
                    output
                )
                graph?.onNodeConnectionChange?.(NodeSlotType.OUTPUT, this, slot)
                graph?.onNodeConnectionChange?.(NodeSlotType.INPUT, target_node, link_info.target_slot)
            }
            output.links = null
        }

        this.setDirtyCanvas(false, true)
        graph.connectionChange(this)
        return true
    }

    /**
     * Disconnect one input
     * @param slot Input slot index, or the name of the slot
     * @return true if disconnected successfully or already disconnected, otherwise false
     */
    disconnectInput(slot: number | string): boolean {
        // Allow search by string
        if (typeof slot === "string") {
            slot = this.findInputSlot(slot)
            if (slot == -1) {
                if (LiteGraph.debug) console.log("Connect: Error, no slot of name " + slot)
                return false
            }
        } else if (!this.inputs || slot >= this.inputs.length) {
            if (LiteGraph.debug) {
                console.log("Connect: Error, slot number not found")
            }
            return false
        }

        const input = this.inputs[slot]
        if (!input) {
            return false
        }

        const link_id = this.inputs[slot].link
        if (link_id != null) {
            this.inputs[slot].link = null

            //remove other side
            const link_info = this.graph.links[link_id]
            if (link_info) {
                const target_node = this.graph.getNodeById(link_info.origin_id)
                if (!target_node) {
                    return false
                }

                const output = target_node.outputs[link_info.origin_slot]
                if (!(output?.links?.length > 0)) {
                    return false
                }

                //search in the inputs list for this link
                let i = 0
                for (const l = output.links.length; i < l; i++) {
                    if (output.links[i] == link_id) {
                        output.links.splice(i, 1)
                        break
                    }
                }

                delete this.graph.links[link_id] //remove from the pool
                if (this.graph) this.graph._version++

                this.onConnectionsChange?.(
                    NodeSlotType.INPUT,
                    slot,
                    false,
                    link_info,
                    input
                )
                target_node.onConnectionsChange?.(
                    NodeSlotType.OUTPUT,
                    i,
                    false,
                    link_info,
                    output
                )
                this.graph?.onNodeConnectionChange?.(NodeSlotType.OUTPUT, target_node, i)
                this.graph?.onNodeConnectionChange?.(NodeSlotType.INPUT, this, slot)
            }
        }

        this.setDirtyCanvas(false, true)
        this.graph?.connectionChange(this)
        return true
    }

    /**
     * returns the center of a connection point in canvas coords
     * @param {boolean} is_input true if if a input slot, false if it is an output
     * @param {number_or_string} slot (could be the number of the slot or the string with the name of the slot)
     * @param {vec2} out [optional] a place to store the output, to free garbage
     * @return {[x,y]} the position
     **/
    getConnectionPos(is_input: boolean, slot_number: number, out?: Point): Point {
        out ||= new Float32Array(2)

        const num_slots = is_input
            ? this.inputs?.length ?? 0
            : this.outputs?.length ?? 0

        const offset = LiteGraph.NODE_SLOT_HEIGHT * 0.5

        if (this.flags.collapsed) {
            const w = this._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH
            if (this.horizontal) {
                out[0] = this.pos[0] + w * 0.5
                out[1] = is_input
                    ? this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT
                    : this.pos[1]
            } else {
                out[0] = is_input
                    ? this.pos[0]
                    : this.pos[0] + w
                out[1] = this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT * 0.5
            }
            return out
        }

        //weird feature that never got finished
        if (is_input && slot_number == -1) {
            out[0] = this.pos[0] + LiteGraph.NODE_TITLE_HEIGHT * 0.5
            out[1] = this.pos[1] + LiteGraph.NODE_TITLE_HEIGHT * 0.5
            return out
        }

        //hard-coded pos
        if (is_input &&
            num_slots > slot_number &&
            this.inputs[slot_number].pos) {

            out[0] = this.pos[0] + this.inputs[slot_number].pos[0]
            out[1] = this.pos[1] + this.inputs[slot_number].pos[1]
            return out
        } else if (!is_input &&
            num_slots > slot_number &&
            this.outputs[slot_number].pos) {

            out[0] = this.pos[0] + this.outputs[slot_number].pos[0]
            out[1] = this.pos[1] + this.outputs[slot_number].pos[1]
            return out
        }

        //horizontal distributed slots
        if (this.horizontal) {
            out[0] = this.pos[0] + (slot_number + 0.5) * (this.size[0] / num_slots)
            out[1] = is_input
                ? this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT
                : this.pos[1] + this.size[1]
            return out
        }

        //default vertical slots
        out[0] = is_input
            ? this.pos[0] + offset
            : this.pos[0] + this.size[0] + 1 - offset
        out[1] =
            this.pos[1] +
            (slot_number + 0.7) * LiteGraph.NODE_SLOT_HEIGHT +
            (this.constructor.slot_start_y || 0)
        return out
    }

    /* Force align to grid */
    alignToGrid(): void {
        this.pos[0] = LiteGraph.CANVAS_GRID_SIZE * Math.round(this.pos[0] / LiteGraph.CANVAS_GRID_SIZE)
        this.pos[1] = LiteGraph.CANVAS_GRID_SIZE * Math.round(this.pos[1] / LiteGraph.CANVAS_GRID_SIZE)
    }

    /* Console output */
    trace(msg?: string): void {
        this.console ||= []
        this.console.push(msg)
        if (this.console.length > LGraphNode.MAX_CONSOLE)
            this.console.shift()

        this.graph.onNodeTrace?.(this, msg)
    }

    /* Forces to redraw or the main canvas (LGraphNode) or the bg canvas (links) */
    setDirtyCanvas(dirty_foreground: boolean, dirty_background?: boolean): void {
        this.graph?.sendActionToCanvas("setDirty", [
            dirty_foreground,
            dirty_background
        ])
    }

    loadImage(url: string): HTMLImageElement {
        interface AsyncImageElement extends HTMLImageElement { ready?: boolean }

        const img: AsyncImageElement = new Image()
        img.src = LiteGraph.node_images_path + url
        img.ready = false

        const that = this
        img.onload = function (this: AsyncImageElement) {
            this.ready = true
            that.setDirtyCanvas(true)
        }
        return img
    }

    /* Allows to get onMouseMove and onMouseUp events even if the mouse is out of focus */
    captureInput(v: boolean): void {
        if (!this.graph || !this.graph.list_of_graphcanvas)
            return

        const list = this.graph.list_of_graphcanvas

        for (let i = 0; i < list.length; ++i) {
            const c = list[i]
            //releasing somebody elses capture?!
            if (!v && c.node_capturing_input != this)
                continue

            //change
            c.node_capturing_input = v ? this : null
        }
    }

    get collapsed() {
        return !!this.flags.collapsed
    }

    get collapsible() {
        return !this.pinned && (this.constructor.collapsable !== false)
    }

    /**
     * Collapse the node to make it smaller on the canvas
     **/
    collapse(force?: boolean): void {
        if (!this.collapsible && !force) return
        this.graph._version++
        this.flags.collapsed = !this.flags.collapsed
        this.setDirtyCanvas(true, true)
    }

    /**
     * Toggles advanced mode of the node, showing advanced widgets
     */
    toggleAdvanced() {
        if (!this.widgets?.some(w => w.advanced)) return
        this.graph._version++
        this.showAdvanced = !this.showAdvanced
        const prefSize = this.computeSize()
        if (this.size[0] < prefSize[0] || this.size[1] < prefSize[1]) {
            this.setSize([Math.max(this.size[0], prefSize[0]), Math.max(this.size[1], prefSize[1])])
        }
        this.setDirtyCanvas(true, true)
    }

    get pinned() {
        return !!this.flags.pinned
    }

    /**
     * Prevents the node being accidentally moved or resized by mouse interaction.
     **/
    pin(v?: boolean): void {
        this.graph._version++
        this.flags.pinned = v === undefined
            ? !this.flags.pinned
            : v
        this.resizable = !this.pinned
        // Delete the flag if unpinned, so that we don't get unnecessary
        // flags.pinned = false in serialized object.
        if (!this.pinned)
            delete this.flags.pinned
    }

    localToScreen(x: number, y: number, dragAndScale: DragAndScale): Point {
        return [
            (x + this.pos[0]) * dragAndScale.scale + dragAndScale.offset[0],
            (y + this.pos[1]) * dragAndScale.scale + dragAndScale.offset[1]
        ]
    }

    get width() {
        return this.collapsed ? this._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH : this.size[0]
    }

    get height() {
        // @ts-expect-error Not impl.
        return this.collapsed ? LiteGraph.NODE_COLLAPSED_HEIGHT : this.size[1]
    }

    drawBadges(ctx: CanvasRenderingContext2D, { gap = 2 } = {}): void {
        const badgeInstances = this.badges.map(badge => badge instanceof LGraphBadge ? badge : badge())
        const isLeftAligned = this.badgePosition === BadgePosition.TopLeft

        let currentX = isLeftAligned ? 0 : this.width - badgeInstances.reduce((acc, badge) => acc + badge.getWidth(ctx) + gap, 0)
        const y = -(LiteGraph.NODE_TITLE_HEIGHT + gap)

        for (const badge of badgeInstances) {
            badge.draw(ctx, currentX, y - badge.height)
            currentX += badge.getWidth(ctx) + gap
        }
    }
}
