import type {
  Dictionary,
  IContextMenuValue,
  IFoundSlot,
  INodeFlags,
  INodeInputSlot,
  INodeOutputSlot,
  IOptionalSlotData,
  IPinnable,
  ISlotType,
  Point,
  Positionable,
  ReadOnlyRect,
  Rect,
  Size,
} from "./interfaces"
import type { LGraph } from "./LGraph"
import type { IWidget, TWidgetValue } from "./types/widgets"
import type { ISerialisedNode } from "./types/serialisation"
import type { LGraphCanvas } from "./LGraphCanvas"
import type { CanvasMouseEvent } from "./types/events"
import type { DragAndScale } from "./DragAndScale"
import type { Reroute, RerouteId } from "./Reroute"
import {
  LGraphEventMode,
  NodeSlotType,
  TitleMode,
  RenderShape,
} from "./types/globalEnums"
import { BadgePosition, LGraphBadge } from "./LGraphBadge"
import { type LGraphNodeConstructor, LiteGraph } from "./litegraph"
import { isInRectangle, isInRect, snapPoint } from "./measure"
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

export interface IMouseOverData {
  inputId: number | null
  outputId: number | null
  overWidget: IWidget | null
}

export interface ConnectByTypeOptions {
  /** @deprecated Events */
  createEventInCase?: boolean
  /** Allow our wildcard slot to connect to typed slots on remote node. Default: true */
  wildcardToTyped?: boolean
  /** Allow our typed slot to connect to wildcard slots on remote node. Default: true */
  typedToWildcard?: boolean
  /** The {@link Reroute.id} that the connection is being dragged from. */
  afterRerouteId?: RerouteId
}

/** Internal type used for type safety when implementing generic checks for inputs & outputs */
export interface IGenericLinkOrLinks {
  links?: INodeOutputSlot["links"]
  link?: INodeInputSlot["link"]
}

export interface FindFreeSlotOptions {
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
    + onStart: when the graph starts playing
    + onStop: when the graph stops playing
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

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface LGraphNode {
  constructor: LGraphNodeConstructor
}

/**
 * Base Class for all the node type classes
 * @param {string} name a name for the node
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class LGraphNode implements Positionable, IPinnable {
  // Static properties used by dynamic child classes
  static title?: string
  static MAX_CONSOLE?: number
  static type?: string
  static category?: string
  static supported_extensions?: string[]
  static filter?: string
  static skip_list?: boolean

  /** Default setting for {@link LGraphNode.connectInputToOutput}. @see {@link INodeFlags.keepAllLinksOnBypass} */
  static keepAllLinksOnBypass: boolean = false

  title: string
  graph: LGraph | null = null
  id: NodeId
  type: string | null = null
  inputs: INodeInputSlot[] = []
  outputs: INodeOutputSlot[] = []
  // Not used
  connections: unknown[] = []
  properties: INodeProperties = {}
  properties_info: INodePropertyInfo[] = []
  flags: INodeFlags = {}
  widgets?: IWidget[]
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
  badges: (LGraphBadge | (() => LGraphBadge))[] = []
  badgePosition: BadgePosition = BadgePosition.TopLeft
  onOutputRemoved?(this: LGraphNode, slot: number): void
  onInputRemoved?(this: LGraphNode, slot: number, input: INodeInputSlot): void
  _collapsed_width: number
  /** Called once at the start of every frame.  Caller may change the values in {@link out}, which will be reflected in {@link boundingRect}. */
  onBounding?(this: LGraphNode, out: Rect): void
  horizontal?: boolean
  console?: string[]
  _level: number
  _shape?: RenderShape
  subgraph?: LGraph
  skip_subgraph_button?: boolean
  mouseOver?: IMouseOverData
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
  selected?: boolean
  showAdvanced?: boolean

  /** @inheritdoc {@link renderArea} */
  #renderArea: Float32Array = new Float32Array(4)
  /**
   * Rect describing the node area, including shadows and any protrusions.
   * Determines if the node is visible.  Calculated once at the start of every frame.
   */
  get renderArea(): ReadOnlyRect {
    return this.#renderArea
  }

  /** @inheritdoc {@link boundingRect} */
  #boundingRect: Float32Array = new Float32Array(4)
  /**
   * Cached node position & area as `x, y, width, height`.  Includes changes made by {@link onBounding}, if present.
   *
   * Determines the node hitbox and other rendering effects.  Calculated once at the start of every frame.
   */
  get boundingRect(): ReadOnlyRect {
    return this.#boundingRect
  }

  /** {@link pos} and {@link size} values are backed by this {@link Rect}. */
  _posSize: Float32Array = new Float32Array(4)
  _pos: Point = this._posSize.subarray(0, 2)
  _size: Size = this._posSize.subarray(2, 4)

  public get pos() {
    return this._pos
  }

  public set pos(value) {
    if (!value || value.length < 2) return

    this._pos[0] = value[0]
    this._pos[1] = value[1]
  }

  public get size() {
    return this._size
  }

  public set size(value) {
    if (!value || value.length < 2) return

    this._size[0] = value[0]
    this._size[1] = value[1]
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

  public get is_selected(): boolean {
    return this.selected
  }

  public set is_selected(value: boolean) {
    this.selected = value
  }

  // Used in group node
  setInnerNodes?(this: LGraphNode, nodes: LGraphNode[]): void

  onConnectInput?(
    this: LGraphNode,
    target_slot: number,
    type: unknown,
    output: INodeOutputSlot,
    node: LGraphNode,
    slot: number,
  ): boolean
  onConnectOutput?(
    this: LGraphNode,
    slot: number,
    type: unknown,
    input: INodeInputSlot,
    target_node: number | LGraphNode,
    target_slot: number,
  ): boolean
  onResize?(this: LGraphNode, size: Size): void
  onPropertyChanged?(
    this: LGraphNode,
    name: string,
    value: unknown,
    prev_value?: unknown,
  ): boolean
  onConnectionsChange?(
    this: LGraphNode,
    type: ISlotType,
    index: number,
    isConnected: boolean,
    link_info: LLink,
    inputOrOutput: INodeInputSlot | INodeOutputSlot,
  ): void
  onInputAdded?(this: LGraphNode, input: INodeInputSlot): void
  onOutputAdded?(this: LGraphNode, output: INodeOutputSlot): void
  onConfigure?(this: LGraphNode, serialisedNode: ISerialisedNode): void
  onSerialize?(this: LGraphNode, serialised: ISerialisedNode): any
  onExecute?(
    this: LGraphNode,
    param?: unknown,
    options?: { action_call?: any },
  ): void
  onAction?(
    this: LGraphNode,
    action: string,
    param: unknown,
    options: { action_call?: string },
  ): void
  onDrawBackground?(
    this: LGraphNode,
    ctx: CanvasRenderingContext2D,
    canvas: LGraphCanvas,
    canvasElement: HTMLCanvasElement,
    mousePosition: Point,
  ): void
  onNodeCreated?(this: LGraphNode): void
  /**
   * Callback invoked by {@link connect} to override the target slot index.
   * Its return value overrides the target index selection.
   * @param target_slot The current input slot index
   * @param requested_slot The originally requested slot index - could be negative, or if using (deprecated) name search, a string
   * @returns {number | null} If a number is returned, the connection will be made to that input index.
   * If an invalid index or non-number (false, null, NaN etc) is returned, the connection will be cancelled.
   */
  onBeforeConnectInput?(
    this: LGraphNode,
    target_slot: number,
    requested_slot?: number | string,
  ): number | false | null
  onShowCustomPanelInfo?(this: LGraphNode, panel: any): void
  onAddPropertyToPanel?(this: LGraphNode, pName: string, panel: any): boolean
  onWidgetChanged?(
    this: LGraphNode,
    name: string,
    value: unknown,
    old_value: unknown,
    w: IWidget,
  ): void
  onDeselected?(this: LGraphNode): void
  onKeyUp?(this: LGraphNode, e: KeyboardEvent): void
  onKeyDown?(this: LGraphNode, e: KeyboardEvent): void
  onSelected?(this: LGraphNode): void
  getExtraMenuOptions?(
    this: LGraphNode,
    canvas: LGraphCanvas,
    options: IContextMenuValue[],
  ): IContextMenuValue[]
  getMenuOptions?(this: LGraphNode, canvas: LGraphCanvas): IContextMenuValue[]
  onAdded?(this: LGraphNode, graph: LGraph): void
  onDrawCollapsed?(
    this: LGraphNode,
    ctx: CanvasRenderingContext2D,
    cavnas: LGraphCanvas,
  ): boolean
  onDrawForeground?(
    this: LGraphNode,
    ctx: CanvasRenderingContext2D,
    canvas: LGraphCanvas,
    canvasElement: HTMLCanvasElement,
  ): void
  onMouseLeave?(this: LGraphNode, e: CanvasMouseEvent): void
  getSlotMenuOptions?(this: LGraphNode, slot: IFoundSlot): IContextMenuValue[]
  // FIXME: Re-typing
  onDropItem?(this: LGraphNode, event: Event): boolean
  onDropData?(
    this: LGraphNode,
    data: string | ArrayBuffer,
    filename: any,
    file: any,
  ): void
  onDropFile?(this: LGraphNode, file: any): void
  onInputClick?(this: LGraphNode, index: number, e: CanvasMouseEvent): void
  onInputDblClick?(this: LGraphNode, index: number, e: CanvasMouseEvent): void
  onOutputClick?(this: LGraphNode, index: number, e: CanvasMouseEvent): void
  onOutputDblClick?(this: LGraphNode, index: number, e: CanvasMouseEvent): void
  // TODO: Return type
  onGetPropertyInfo?(this: LGraphNode, property: string): any
  onNodeOutputAdd?(this: LGraphNode, value): void
  onNodeInputAdd?(this: LGraphNode, value): void
  onMenuNodeInputs?(
    this: LGraphNode,
    entries: IOptionalSlotData<INodeInputSlot>[],
  ): IOptionalSlotData<INodeInputSlot>[]
  onMenuNodeOutputs?(
    this: LGraphNode,
    entries: IOptionalSlotData<INodeOutputSlot>[],
  ): IOptionalSlotData<INodeOutputSlot>[]
  onGetInputs?(this: LGraphNode): INodeInputSlot[]
  onGetOutputs?(this: LGraphNode): INodeOutputSlot[]
  onMouseUp?(this: LGraphNode, e: CanvasMouseEvent, pos: Point): void
  onMouseEnter?(this: LGraphNode, e: CanvasMouseEvent): void
  /** Blocks drag if return value is truthy. @param pos Offset from {@link LGraphNode.pos}. */
  onMouseDown?(
    this: LGraphNode,
    e: CanvasMouseEvent,
    pos: Point,
    canvas: LGraphCanvas,
  ): boolean
  /** @param pos Offset from {@link LGraphNode.pos}. */
  onDblClick?(
    this: LGraphNode,
    e: CanvasMouseEvent,
    pos: Point,
    canvas: LGraphCanvas,
  ): void
  /** @param pos Offset from {@link LGraphNode.pos}. */
  onNodeTitleDblClick?(
    this: LGraphNode,
    e: CanvasMouseEvent,
    pos: Point,
    canvas: LGraphCanvas,
  ): void
  onDrawTitle?(this: LGraphNode, ctx: CanvasRenderingContext2D): void
  onDrawTitleText?(
    this: LGraphNode,
    ctx: CanvasRenderingContext2D,
    title_height: number,
    size: Size,
    scale: number,
    title_text_font: string,
    selected: boolean,
  ): void
  onDrawTitleBox?(
    this: LGraphNode,
    ctx: CanvasRenderingContext2D,
    title_height: number,
    size: Size,
    scale: number,
  ): void
  onDrawTitleBar?(
    this: LGraphNode,
    ctx: CanvasRenderingContext2D,
    title_height: number,
    size: Size,
    scale: number,
    fgcolor: any,
  ): void
  onRemoved?(this: LGraphNode): void
  onMouseMove?(
    this: LGraphNode,
    e: MouseEvent,
    pos: Point,
    arg2: LGraphCanvas,
  ): void
  onPropertyChange?(this: LGraphNode): void
  updateOutputData?(this: LGraphNode, origin_slot: number): void
  isValidWidgetLink?(
    slot_index: number,
    node: LGraphNode,
    overWidget: IWidget,
  ): boolean | undefined

  constructor(title: string) {
    this.id = LiteGraph.use_uuids ? LiteGraph.uuidv4() : -1
    this.title = title || "Unnamed"
    this.size = [LiteGraph.NODE_WIDTH, 60]
    this.pos = [10, 10]
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
        // i don't want to clone properties, I want to reuse the old container
        for (const k in info.properties) {
          this.properties[k] = info.properties[k]
          this.onPropertyChanged?.(k, info.properties[k])
        }
        continue
      }

      if (info[j] == null) {
        continue
      } else if (typeof info[j] == "object") {
        // object
        if (this[j]?.configure) {
          this[j]?.configure(info[j])
        } else {
          this[j] = LiteGraph.cloneObject(info[j], this[j])
        }
      } else {
        // value
        this[j] = info[j]
      }
    }

    if (!info.title) {
      this.title = this.constructor.title
    }

    if (this.inputs) {
      for (let i = 0; i < this.inputs.length; ++i) {
        const input = this.inputs[i]
        const link = this.graph ? this.graph._links.get(input.link) : null
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
          const link = this.graph
            ? this.graph._links.get(output.links[j])
            : null
          this.onConnectionsChange?.(NodeSlotType.OUTPUT, i, true, link, output)
        }
        this.onOutputAdded?.(output)
      }
    }

    if (this.widgets) {
      for (let i = 0; i < this.widgets.length; ++i) {
        const w = this.widgets[i]
        if (!w) continue

        if (w.options?.property && this.properties[w.options.property] != undefined)
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
    // create serialization object
    const o: ISerialisedNode = {
      id: this.id,
      type: this.type,
      pos: [this.pos[0], this.pos[1]],
      size: [this.size[0], this.size[1]],
      flags: LiteGraph.cloneObject(this.flags),
      order: this.order,
      mode: this.mode,
      showAdvanced: this.showAdvanced,
    }

    // special case for when there were errors
    if (this.constructor === LGraphNode && this.last_serialization)
      return this.last_serialization

    if (this.inputs) o.inputs = this.inputs

    if (this.outputs) {
      // clear outputs last data (because data in connections is never serialized but stored inside the outputs info)
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

    // we clone it because serialize returns shared containers
    const data = LiteGraph.cloneObject(this.serialize())

    // remove links
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

    // remove links
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
   * @param name
   * @param value
   */
  setProperty(name: string, value: TWidgetValue): void {
    this.properties ||= {}
    if (value === this.properties[name]) return

    const prev_value = this.properties[name]
    this.properties[name] = value
    // abort change
    if (this.onPropertyChanged?.(name, value, prev_value) === false)
      this.properties[name] = prev_value

    // widgets could be linked to properties
    if (this.widgets) {
      for (let i = 0; i < this.widgets.length; ++i) {
        const w = this.widgets[i]
        if (!w) continue

        if (w.options.property == name) {
          w.value = value
          break
        }
      }
    }
  }

  /**
   * sets the output data
   * @param slot
   * @param data
   */
  setOutputData(slot: number, data: unknown): void {
    if (!this.outputs) return

    // this maybe slow and a niche case
    // if(slot && slot.constructor === String)
    // slot = this.findOutputSlot(slot);
    if (slot == -1 || slot >= this.outputs.length) return

    const output_info = this.outputs[slot]
    if (!output_info) return

    // store data in the output itself in case we want to debug
    output_info._data = data

    // if there are connections, pass the data to the connections
    if (this.outputs[slot].links) {
      for (let i = 0; i < this.outputs[slot].links.length; i++) {
        const link_id = this.outputs[slot].links[i]
        const link = this.graph._links.get(link_id)
        if (link) link.data = data
      }
    }
  }

  /**
   * sets the output data type, useful when you want to be able to overwrite the data type
   */
  setOutputDataType(slot: number, type: ISlotType): void {
    if (!this.outputs) return
    if (slot == -1 || slot >= this.outputs.length) return
    const output_info = this.outputs[slot]
    if (!output_info) return
    // store data in the output itself in case we want to debug
    output_info.type = type

    // if there are connections, pass the data to the connections
    if (this.outputs[slot].links) {
      for (let i = 0; i < this.outputs[slot].links.length; i++) {
        const link_id = this.outputs[slot].links[i]
        this.graph._links.get(link_id).type = type
      }
    }
  }

  /**
   * Retrieves the input data (data traveling through the connection) from one slot
   * @param slot
   * @param force_update if set to true it will force the connected node of this slot to output data into this link
   * @returns data or if it is not connected returns undefined
   */
  getInputData(slot: number, force_update?: boolean): unknown {
    if (!this.inputs) return

    if (slot >= this.inputs.length || this.inputs[slot].link == null) return

    const link_id = this.inputs[slot].link
    const link = this.graph._links.get(link_id)
    // bug: weird case but it happens sometimes
    if (!link) return null

    if (!force_update) return link.data

    // special case: used to extract data from the incoming connection before the graph has been executed
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
   * @param slot
   * @returns datatype in string format
   */
  getInputDataType(slot: number): ISlotType {
    if (!this.inputs) return null
    if (slot >= this.inputs.length || this.inputs[slot].link == null) return null

    const link_id = this.inputs[slot].link
    const link = this.graph._links.get(link_id)
    // bug: weird case but it happens sometimes
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
   * @param slot_name
   * @param force_update if set to true it will force the connected node of this slot to output data into this link
   * @returns data or if it is not connected returns null
   */
  getInputDataByName(slot_name: string, force_update: boolean): unknown {
    const slot = this.findInputSlot(slot_name)
    return slot == -1
      ? null
      : this.getInputData(slot, force_update)
  }

  /**
   * tells you if there is a connection in one input slot
   * @param slot The 0-based index of the input to check
   * @returns `true` if the input slot has a link ID (does not perform validation)
   */
  isInputConnected(slot: number): boolean {
    if (!this.inputs) return false
    return slot < this.inputs.length && this.inputs[slot].link != null
  }

  /**
   * tells you info about an input connection (which node, type, etc)
   * @returns object or null { link: id, name: string, type: string or 0 }
   */
  getInputInfo(slot: number): INodeInputSlot {
    return !this.inputs || !(slot < this.inputs.length)
      ? null
      : this.inputs[slot]
  }

  /**
   * Returns the link info in the connection of an input slot
   * @returns object or null
   */
  getInputLink(slot: number): LLink | null {
    if (!this.inputs) return null
    if (slot < this.inputs.length) {
      const slot_info = this.inputs[slot]
      return this.graph._links.get(slot_info.link)
    }
    return null
  }

  /**
   * returns the node connected in the input slot
   * @returns node or null
   */
  getInputNode(slot: number): LGraphNode {
    if (!this.inputs) return null
    if (slot >= this.inputs.length) return null

    const input = this.inputs[slot]
    if (!input || input.link === null) return null

    const link_info = this.graph._links.get(input.link)
    if (!link_info) return null

    return this.graph.getNodeById(link_info.origin_id)
  }

  /**
   * returns the value of an input with this name, otherwise checks if there is a property with that name
   * @returns value
   */
  getInputOrProperty(name: string): unknown {
    if (!this.inputs || !this.inputs.length) {
      return this.properties ? this.properties[name] : null
    }

    for (let i = 0, l = this.inputs.length; i < l; ++i) {
      const input_info = this.inputs[i]
      if (name == input_info.name && input_info.link != null) {
        const link = this.graph._links.get(input_info.link)
        if (link) return link.data
      }
    }
    return this.properties[name]
  }

  /**
   * tells you the last output data that went in that slot
   * @returns object or null
   */
  getOutputData(slot: number): unknown {
    if (!this.outputs) return null
    if (slot >= this.outputs.length) return null

    const info = this.outputs[slot]
    return info._data
  }

  /**
   * tells you info about an output connection (which node, type, etc)
   * @returns object or null { name: string, type: string, links: [ ids of links in number ] }
   */
  getOutputInfo(slot: number): INodeOutputSlot {
    return !this.outputs || !(slot < this.outputs.length)
      ? null
      : this.outputs[slot]
  }

  /**
   * tells you if there is a connection in one output slot
   */
  isOutputConnected(slot: number): boolean {
    if (!this.outputs) return false
    return slot < this.outputs.length && this.outputs[slot].links?.length > 0
  }

  /**
   * tells you if there is any connection in the output slots
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
   */
  getOutputNodes(slot: number): LGraphNode[] {
    if (!this.outputs || this.outputs.length == 0) return null

    if (slot >= this.outputs.length) return null

    const output = this.outputs[slot]
    if (!output.links || output.links.length == 0) return null

    const r: LGraphNode[] = []
    for (let i = 0; i < output.links.length; i++) {
      const link_id = output.links[i]
      const link = this.graph._links.get(link_id)
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
    // !trigS ||
    if (trigS == -1) {
      const input = this.addInput("onTrigger", LiteGraph.EVENT, {
        optional: true,
        nameLocked: true,
      })
      return this.findInputSlot("onTrigger")
    }
    return trigS
  }

  addOnExecutedOutput(): number {
    const trigS = this.findOutputSlot("onExecuted")
    // !trigS ||
    if (trigS == -1) {
      const output = this.addOutput("onExecuted", LiteGraph.ACTION, {
        optional: true,
        nameLocked: true,
      })
      return this.findOutputSlot("onExecuted")
    }
    return trigS
  }

  onAfterExecuteNode(param: unknown, options?: { action_call?: any }) {
    const trigS = this.findOutputSlot("onExecuted")
    if (trigS != -1) {
      // console.debug(this.id+":"+this.order+" triggering slot onAfterExecute");
      // console.debug(param);
      // console.debug(options);
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
   */
  doExecute(param?: unknown, options?: { action_call?: any }): void {
    options = options || {}
    if (this.onExecute) {
      // enable this to give the event an ID
      options.action_call ||= this.id + "_exec_" + Math.floor(Math.random() * 9999)

      this.graph.nodes_executing[this.id] = true // .push(this.id);
      this.onExecute(param, options)
      this.graph.nodes_executing[this.id] = false // .pop();

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
   * @param action name
   */
  actionDo(
    action: string,
    param: unknown,
    options: { action_call?: string },
  ): void {
    options = options || {}
    if (this.onAction) {
      // enable this to give the event an ID
      options.action_call ||= this.id + "_" + (action ? action : "action") + "_" + Math.floor(Math.random() * 9999)

      this.graph.nodes_actioning[this.id] = action ? action : "actioning" // .push(this.id);
      this.onAction(action, param, options)
      this.graph.nodes_actioning[this.id] = false // .pop();

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
   * @param action name ( "on_play", ... ) if action is equivalent to false then the event is send to all
   */
  trigger(
    action: string,
    param: unknown,
    options: { action_call?: any },
  ): void {
    if (!this.outputs || !this.outputs.length) {
      return
    }

    if (this.graph) this.graph._last_trigger_time = LiteGraph.getTime()

    for (let i = 0; i < this.outputs.length; ++i) {
      const output = this.outputs[i]
      if (
        !output ||
        output.type !== LiteGraph.EVENT ||
        (action && output.name != action)
      )
        continue
      this.triggerSlot(i, param, null, options)
    }
  }

  /**
   * Triggers a slot event in this node: cycle output slots and launch execute/action on connected nodes
   * @param slot the index of the output slot
   * @param link_id [optional] in case you want to trigger and specific output link in a slot
   */
  triggerSlot(
    slot: number,
    param: unknown,
    link_id: number,
    options: { action_call?: any },
  ): void {
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

    if (this.graph) this.graph._last_trigger_time = LiteGraph.getTime()

    // for every link attached here
    for (let k = 0; k < links.length; ++k) {
      const id = links[k]
      // to skip links
      if (link_id != null && link_id != id) continue

      const link_info = this.graph._links.get(id)
      // not connected
      if (!link_info) continue

      link_info._last_time = LiteGraph.getTime()
      const node = this.graph.getNodeById(link_info.target_id)
      // node not found?
      if (!node) continue

      if (node.mode === LGraphEventMode.ON_TRIGGER) {
        // generate unique trigger ID if not present
        if (!options.action_call)
          options.action_call = this.id + "_trigg_" + Math.floor(Math.random() * 9999)
        // -- wrapping node.onExecute(param); --
        node.doExecute?.(param, options)
      } else if (node.onAction) {
        // generate unique action ID if not present
        if (!options.action_call)
          options.action_call = this.id + "_act_" + Math.floor(Math.random() * 9999)
        // pass the action name
        const target_connection = node.inputs[link_info.target_slot]
        // wrap node.onAction(target_connection.name, param);
        node.actionDo(target_connection.name, param, options)
      }
    }
  }

  /**
   * clears the trigger slot animation
   * @param slot the index of the output slot
   * @param link_id [optional] in case you want to trigger and specific output link in a slot
   */
  clearTriggeredSlot(slot: number, link_id: number): void {
    if (!this.outputs) return

    const output = this.outputs[slot]
    if (!output) return

    const links = output.links
    if (!links || !links.length) return

    // for every link attached here
    for (let k = 0; k < links.length; ++k) {
      const id = links[k]
      // to skip links
      if (link_id != null && link_id != id) continue

      const link_info = this.graph._links.get(id)
      // not connected
      if (!link_info) continue

      link_info._last_time = 0
    }
  }

  /**
   * changes node size and triggers callback
   */
  setSize(size: Size): void {
    this.size = size
    this.onResize?.(this.size)
  }

  /**
   * add a new property to this node
   * @param type string defining the output type ("vec3","number",...)
   * @param extra_info this can be used to have special properties of the property (like values, etc)
   */
  addProperty(
    name: string,
    default_value: unknown,
    type?: string,
    extra_info?: Dictionary<unknown>,
  ): INodePropertyInfo {
    const o: INodePropertyInfo = {
      name: name,
      type: type,
      default_value: default_value,
    }
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
   * @param type string defining the output type ("vec3","number",...)
   * @param extra_info this can be used to have special properties of an output (label, special color, position, etc)
   */
  addOutput(
    name?: string,
    type?: ISlotType,
    extra_info?: object,
  ): INodeOutputSlot {
    const output = { name: name, type: type, links: null }
    if (extra_info) {
      for (const i in extra_info) {
        output[i] = extra_info[i]
      }
    }

    this.outputs ||= []
    this.outputs.push(output)
    this.onOutputAdded?.(output)

    if (LiteGraph.auto_load_slot_types)
      LiteGraph.registerNodeAndSlotType(this, type, true)

    this.setSize(this.computeSize())
    this.setDirtyCanvas(true, true)
    return output
  }

  /**
   * add a new output slot to use in this node
   * @param array of triplets like [[name,type,extra_info],[...]]
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

      if (LiteGraph.auto_load_slot_types)
        LiteGraph.registerNodeAndSlotType(this, info[1], true)
    }

    this.setSize(this.computeSize())
    this.setDirtyCanvas(true, true)
  }

  /**
   * remove an existing output slot
   */
  removeOutput(slot: number): void {
    this.disconnectOutput(slot)
    this.outputs.splice(slot, 1)
    for (let i = slot; i < this.outputs.length; ++i) {
      if (!this.outputs[i] || !this.outputs[i].links) continue

      const links = this.outputs[i].links
      for (let j = 0; j < links.length; ++j) {
        const link = this.graph._links.get(links[j])
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
   * @param type string defining the input type ("vec3","number",...), it its a generic one use 0
   * @param extra_info this can be used to have special properties of an input (label, color, position, etc)
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
   * @param array of triplets like [[name,type,extra_info],[...]]
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
   */
  removeInput(slot: number): void {
    this.disconnectInput(slot)
    const slot_info = this.inputs.splice(slot, 1)
    for (let i = slot; i < this.inputs.length; ++i) {
      if (!this.inputs[i]) continue

      const link = this.graph._links.get(this.inputs[i].link)
      if (!link) continue

      link.target_slot -= 1
    }
    this.setSize(this.computeSize())
    this.onInputRemoved?.(slot, slot_info[0])
    this.setDirtyCanvas(true, true)
  }

  /**
   * add an special connection to this node (used for special kinds of graphs)
   * @param type string defining the input type ("vec3","number",...)
   * @param pos position of the connection inside the node
   * @param direction if is input or output
   */
  addConnection(name: string, type: string, pos: Point, direction: string) {
    const o = {
      name: name,
      type: type,
      pos: pos,
      direction: direction,
      links: null,
    }
    this.connections.push(o)
    return o
  }

  /**
   * computes the minimum size of a node according to its inputs and output slots
   * @returns the total size
   */
  computeSize(out?: Size): Size {
    const ctorSize = this.constructor.size
    if (ctorSize) return [ctorSize[0], ctorSize[1]]

    let rows = Math.max(
      this.inputs ? this.inputs.length : 1,
      this.outputs ? this.outputs.length : 1,
    )
    const size = out || new Float32Array([0, 0])
    rows = Math.max(rows, 1)
    const font_size = LiteGraph.NODE_TEXT_SIZE // although it should be graphcanvas.inner_text_font size

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
        if (widget.hidden || (widget.advanced && !this.showAdvanced)) continue

        widgets_height += widget.computeSize
          ? widget.computeSize(size[0])[1] + 4
          : LiteGraph.NODE_WIDGET_HEIGHT + 4
      }
      widgets_height += 8
    }

    // compute height using widgets height
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

    // margin
    size[1] += 6

    return size
  }

  inResizeCorner(canvasX: number, canvasY: number): boolean {
    const rows = this.outputs ? this.outputs.length : 1
    const outputs_offset = (this.constructor.slot_start_y || 0) + rows * LiteGraph.NODE_SLOT_HEIGHT
    return isInRectangle(
      canvasX,
      canvasY,
      this.pos[0] + this.size[0] - 15,
      this.pos[1] + Math.max(this.size[1] - 15, outputs_offset),
      20,
      20,
    )
  }

  /**
   * returns all the info available about a property of this node.
   * @param property name of the property
   * @returns the object with all the available info
   */
  getPropertyInfo(property: string) {
    let info = null

    // there are several ways to define info about a property
    // legacy mode
    if (this.properties_info) {
      for (let i = 0; i < this.properties_info.length; ++i) {
        if (this.properties_info[i].name == property) {
          info = this.properties_info[i]
          break
        }
      }
    }
    // litescene mode using the constructor
    if (this.constructor["@" + property])
      info = this.constructor["@" + property]

    if (this.constructor.widgets_info?.[property])
      info = this.constructor.widgets_info[property]

    // litescene mode using the constructor
    if (!info && this.onGetPropertyInfo) {
      info = this.onGetPropertyInfo(property)
    }

    info ||= {}
    info.type ||= typeof this.properties[property]
    if (info.widget == "combo") info.type = "enum"

    return info
  }

  /**
   * Defines a widget inside the node, it will be rendered on top of the node, you can control lots of properties
   * @param type the widget type (could be "number","string","combo"
   * @param name the text to show on the widget
   * @param value the default value
   * @param callback function to call when it changes (optionally, it can be the name of the property to modify)
   * @param options the object that contains special properties of this widget
   * @returns the created widget object
   */
  addWidget(
    type: string,
    name: string,
    value: any,
    callback: IWidget["callback"],
    options?: any,
  ): IWidget {
    this.widgets ||= []

    if (!options && callback && typeof callback === "object") {
      options = callback
      callback = null
    }

    // options can be the property name
    if (options && typeof options === "string")
      options = { property: options }

    // callback can be the property name
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
      options: options || {},
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

  move(deltaX: number, deltaY: number): void {
    if (this.pinned) return

    this.pos[0] += deltaX
    this.pos[1] += deltaY
  }

  /**
   * Internal method to measure the node for rendering.  Prefer {@link boundingRect} where possible.
   *
   * Populates {@link out} with the results in graph space.
   * Adjusts for title and collapsed status, but does not call {@link onBounding}.
   * @param out `x, y, width, height` are written to this array.
   * @param pad Expands the area by this amount on each side.  Default: 0
   */
  measure(out: Rect, pad = 0): void {
    const titleMode = this.constructor.title_mode
    const renderTitle =
      titleMode != TitleMode.TRANSPARENT_TITLE &&
      titleMode != TitleMode.NO_TITLE
    const titleHeight = renderTitle ? LiteGraph.NODE_TITLE_HEIGHT : 0

    out[0] = this.pos[0] - pad
    out[1] = this.pos[1] + -titleHeight - pad
    if (!this.flags?.collapsed) {
      out[2] = this.size[0] + 2 * pad
      out[3] = this.size[1] + titleHeight + 2 * pad
    } else {
      out[2] = (this._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH) + 2 * pad
      out[3] = LiteGraph.NODE_TITLE_HEIGHT + 2 * pad
    }
  }

  /**
   * returns the bounding of the object, used for rendering purposes
   * @param out {Float32Array[4]?} [optional] a place to store the output, to free garbage
   * @param includeExternal {boolean?} [optional] set to true to
   * include the shadow and connection points in the bounding calculation
   * @returns the bounding box in format of [topleft_cornerx, topleft_cornery, width, height]
   */
  getBounding(out?: Rect, includeExternal?: boolean): Rect {
    out ||= new Float32Array(4)

    const rect = includeExternal ? this.renderArea : this.boundingRect
    out[0] = rect[0]
    out[1] = rect[1]
    out[2] = rect[2]
    out[3] = rect[3]

    return out
  }

  /**
   * Calculates the render area of this node, populating both {@link boundingRect} and {@link renderArea}.
   * Called automatically at the start of every frame.
   */
  updateArea(): void {
    const bounds = this.#boundingRect
    this.measure(bounds)
    this.onBounding?.(bounds)

    const renderArea = this.#renderArea
    renderArea.set(bounds)
    // 4 offset for collapsed node connection points
    renderArea[0] -= 4
    renderArea[1] -= 4
    // Add shadow & left offset
    renderArea[2] += 6 + 4
    // Add shadow & top offsets
    renderArea[3] += 5 + 4
  }

  /**
   * checks if a point is inside the shape of a node
   */
  isPointInside(x: number, y: number): boolean {
    return isInRect(x, y, this.boundingRect)
  }

  /**
   * Checks if the provided point is inside this node's collapse button area.
   * @param x X co-ordinate to check
   * @param y Y co-ordinate to check
   * @returns true if the x,y point is in the collapse button area, otherwise false
   */
  isPointInCollapse(x: number, y: number): boolean {
    const squareLength = LiteGraph.NODE_TITLE_HEIGHT
    return isInRectangle(
      x,
      y,
      this.pos[0],
      this.pos[1] - squareLength,
      squareLength,
      squareLength,
    )
  }

  /**
   * checks if a point is inside a node slot, and returns info about which slot
   * @param x
   * @param y
   * @returns if found the object contains { input|output: slot object, slot: number, link_pos: [x,y] }
   */
  getSlotInPosition(x: number, y: number): IFoundSlot | null {
    // search for inputs
    const link_pos = new Float32Array(2)
    if (this.inputs) {
      for (let i = 0, l = this.inputs.length; i < l; ++i) {
        const input = this.inputs[i]
        this.getConnectionPos(true, i, link_pos)
        if (isInRectangle(x, y, link_pos[0] - 10, link_pos[1] - 5, 20, 10)) {
          return { input, slot: i, link_pos }
        }
      }
    }

    if (this.outputs) {
      for (let i = 0, l = this.outputs.length; i < l; ++i) {
        const output = this.outputs[i]
        this.getConnectionPos(false, i, link_pos)
        if (isInRectangle(x, y, link_pos[0] - 10, link_pos[1] - 5, 20, 10)) {
          return { output, slot: i, link_pos }
        }
      }
    }

    return null
  }

  /**
   * Gets the widget on this node at the given co-ordinates.
   * @param canvasX X co-ordinate in graph space
   * @param canvasY Y co-ordinate in graph space
   * @returns The widget found, otherwise `null`
   */
  getWidgetOnPos(
    canvasX: number,
    canvasY: number,
    includeDisabled = false,
  ): IWidget | null {
    const { widgets, pos, size } = this
    if (!widgets?.length) return null

    const x = canvasX - pos[0]
    const y = canvasY - pos[1]
    const nodeWidth = size[0]

    for (const widget of widgets) {
      if (
        !widget ||
        (widget.disabled && !includeDisabled) ||
        widget.hidden ||
        (widget.advanced && !this.showAdvanced)
      )
        continue

      const h = widget.computeSize
        ? widget.computeSize(nodeWidth)[1]
        : LiteGraph.NODE_WIDGET_HEIGHT
      const w = widget.width || nodeWidth
      if (
        widget.last_y !== undefined &&
        isInRectangle(x, y, 6, widget.last_y, w - 12, h)
      )
        return widget
    }
    return null
  }

  /**
   * Returns the input slot with a given name (used for dynamic slots), -1 if not found
   * @param name the name of the slot to find
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
   * @param name the name of the slot to find
   * @param returnObj if the obj itself wanted
   * @returns the slot (-1 if not found)
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
   * @param optsIn
   * @returns The index of the first matching slot, the slot itself if returnObj is true, or -1 if not found.
   */
  findInputSlotFree<TReturn extends false>(
    optsIn?: FindFreeSlotOptions & { returnObj?: TReturn },
  ): number
  findInputSlotFree<TReturn extends true>(
    optsIn?: FindFreeSlotOptions & { returnObj?: TReturn },
  ): INodeInputSlot
  findInputSlotFree(optsIn?: FindFreeSlotOptions) {
    return this.#findFreeSlot(this.inputs, optsIn)
  }

  /**
   * Finds the first free output slot.
   * @param optsIn
   * @returns The index of the first matching slot, the slot itself if returnObj is true, or -1 if not found.
   */
  findOutputSlotFree<TReturn extends false>(
    optsIn?: FindFreeSlotOptions & { returnObj?: TReturn },
  ): number
  findOutputSlotFree<TReturn extends true>(
    optsIn?: FindFreeSlotOptions & { returnObj?: TReturn },
  ): INodeOutputSlot
  findOutputSlotFree(optsIn?: FindFreeSlotOptions) {
    return this.#findFreeSlot(this.outputs, optsIn)
  }

  /**
   * Finds the next free slot
   * @param slots The slots to search, i.e. this.inputs or this.outputs
   */
  #findFreeSlot<TSlot extends INodeInputSlot | INodeOutputSlot>(
    slots: TSlot[],
    options?: FindFreeSlotOptions,
  ): TSlot | number {
    const defaults = {
      returnObj: false,
      typesNotAccepted: [],
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
  findInputSlotByType<TReturn extends false>(
    type: ISlotType,
    returnObj?: TReturn,
    preferFreeSlot?: boolean,
    doNotUseOccupied?: boolean,
  ): number
  findInputSlotByType<TReturn extends true>(
    type: ISlotType,
    returnObj?: TReturn,
    preferFreeSlot?: boolean,
    doNotUseOccupied?: boolean,
  ): INodeInputSlot
  findInputSlotByType(
    type: ISlotType,
    returnObj?: boolean,
    preferFreeSlot?: boolean,
    doNotUseOccupied?: boolean,
  ) {
    return this.#findSlotByType(
      this.inputs,
      type,
      returnObj,
      preferFreeSlot,
      doNotUseOccupied,
    )
  }

  /**
   * findSlotByType for OUTPUTS
   */
  findOutputSlotByType<TReturn extends false>(
    type: ISlotType,
    returnObj?: TReturn,
    preferFreeSlot?: boolean,
    doNotUseOccupied?: boolean,
  ): number
  findOutputSlotByType<TReturn extends true>(
    type: ISlotType,
    returnObj?: TReturn,
    preferFreeSlot?: boolean,
    doNotUseOccupied?: boolean,
  ): INodeOutputSlot
  findOutputSlotByType(
    type: ISlotType,
    returnObj?: boolean,
    preferFreeSlot?: boolean,
    doNotUseOccupied?: boolean,
  ) {
    return this.#findSlotByType(
      this.outputs,
      type,
      returnObj,
      preferFreeSlot,
      doNotUseOccupied,
    )
  }

  /**
   * returns the output (or input) slot with a given type, -1 if not found
   * @param input uise inputs instead of outputs
   * @param type the type of the slot to find
   * @param returnObj if the obj itself wanted
   * @param preferFreeSlot if we want a free slot (if not found, will return the first of the type anyway)
   * @returns the slot (-1 if not found)
   */
  findSlotByType<TSlot extends true | false, TReturn extends false>(
    input: TSlot,
    type: ISlotType,
    returnObj?: TReturn,
    preferFreeSlot?: boolean,
    doNotUseOccupied?: boolean,
  ): number
  findSlotByType<TSlot extends true, TReturn extends true>(
    input: TSlot,
    type: ISlotType,
    returnObj?: TReturn,
    preferFreeSlot?: boolean,
    doNotUseOccupied?: boolean,
  ): INodeInputSlot
  findSlotByType<TSlot extends false, TReturn extends true>(
    input: TSlot,
    type: ISlotType,
    returnObj?: TReturn,
    preferFreeSlot?: boolean,
    doNotUseOccupied?: boolean,
  ): INodeOutputSlot
  findSlotByType(
    input: boolean,
    type: ISlotType,
    returnObj?: boolean,
    preferFreeSlot?: boolean,
    doNotUseOccupied?: boolean,
  ) {
    return input
      ? this.#findSlotByType(
        this.inputs,
        type,
        returnObj,
        preferFreeSlot,
        doNotUseOccupied,
      )
      : this.#findSlotByType(
        this.outputs,
        type,
        returnObj,
        preferFreeSlot,
        doNotUseOccupied,
      )
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
  #findSlotByType<TSlot extends INodeInputSlot | INodeOutputSlot>(
    slots: TSlot[],
    type: ISlotType,
    returnObj?: boolean,
    preferFreeSlot?: boolean,
    doNotUseOccupied?: boolean,
  ): TSlot | number {
    const length = slots?.length
    if (!length) return -1

    // !! empty string type is considered 0, * !!
    if (type == "" || type == "*") type = 0
    const sourceTypes = String(type).toLowerCase()
      .split(",")

    // Run the search
    let occupiedSlot: number | TSlot | null = null
    for (let i = 0; i < length; ++i) {
      const slot: TSlot & IGenericLinkOrLinks = slots[i]
      const destTypes = slot.type == "0" || slot.type == "*"
        ? ["0"]
        : String(slot.type).toLowerCase()
          .split(",")

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
    options?: ConnectByTypeOptions,
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
      typedToWildcard: true,
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
    if (
      opts.wildcardToTyped &&
      (slotType == 0 || slotType == "*" || slotType == "")
    ) {
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
   * @param slot (could be the number of the slot or the string with the name of the slot)
   * @param target_node the target node
   * @param target_slotType the input slot type of the target node
   * @returns the link_info is created, otherwise null
   */
  connectByType(
    slot: number | string,
    target_node: LGraphNode,
    target_slotType: ISlotType,
    optsIn?: ConnectByTypeOptions,
  ): LLink | null {
    const slotIndex = this.findConnectByTypeSlot(
      true,
      target_node,
      target_slotType,
      optsIn,
    )
    if (slotIndex !== null)
      return this.connect(slot, target_node, slotIndex, optsIn?.afterRerouteId)

    console.debug("[connectByType]: no way to connect type: ", target_slotType, " to node: ", target_node)
    return null
  }

  /**
   * connect this node input to the output of another node BY TYPE
   * @param slot (could be the number of the slot or the string with the name of the slot)
   * @param source_node the target node
   * @param source_slotType the output slot type of the target node
   * @returns the link_info is created, otherwise null
   */
  connectByTypeOutput(
    slot: number | string,
    source_node: LGraphNode,
    source_slotType: ISlotType,
    optsIn?: ConnectByTypeOptions,
  ): LLink | null {
    // LEGACY: Old options names
    if (typeof optsIn === "object") {
      if ("firstFreeIfInputGeneralInCase" in optsIn) optsIn.wildcardToTyped = !!optsIn.firstFreeIfInputGeneralInCase
      if ("generalTypeInCase" in optsIn) optsIn.typedToWildcard = !!optsIn.generalTypeInCase
    }
    const slotIndex = this.findConnectByTypeSlot(
      false,
      source_node,
      source_slotType,
      optsIn,
    )
    if (slotIndex !== null)
      return source_node.connect(slotIndex, this, slot, optsIn?.afterRerouteId)

    console.debug("[connectByType]: no way to connect type: ", source_slotType, " to node: ", source_node)
    return null
  }

  /**
   * Connect an output of this node to an input of another node
   * @param slot (could be the number of the slot or the string with the name of the slot)
   * @param target_node the target node
   * @param target_slot the input slot of the target node (could be the number of the slot or the string with the name of the slot, or -1 to connect a trigger)
   * @returns the link_info is created, otherwise null
   */
  connect(
    slot: number | string,
    target_node: LGraphNode,
    target_slot: ISlotType,
    afterRerouteId?: RerouteId,
  ): LLink | null {
    // Allow legacy API support for searching target_slot by string, without mutating the input variables
    let targetIndex: number

    const graph = this.graph
    if (!graph) {
      // could be connected before adding it to a graph
      // due to link ids being associated with graphs
      console.log("Connect: Error, node doesn't belong to any graph. Nodes must be added first to a graph before connecting them.")
      return null
    }

    // seek for the output slot
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
      target_node = graph.getNodeById(target_node)
    }
    if (!target_node) throw "target node is null"

    // avoid loopback
    if (target_node == this) return null

    // you can specify the slot by name
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
      const requestedIndex: false | number | null =
        target_node.onBeforeConnectInput(targetIndex, target_slot)
      targetIndex = typeof requestedIndex === "number" ? requestedIndex : null
    }

    if (
      targetIndex === null ||
      !target_node.inputs ||
      targetIndex >= target_node.inputs.length
    ) {
      if (LiteGraph.debug) console.log("Connect: Error, slot number not found")
      return null
    }

    let changed = false

    const input = target_node.inputs[targetIndex]
    let link_info: LLink = null
    const output = this.outputs[slot]

    if (!this.outputs[slot]) return null

    // check targetSlot and check connection types
    if (!LiteGraph.isValidConnection(output.type, input.type)) {
      this.setDirtyCanvas(false, true)
      // @ts-expect-error Unused param
      if (changed) graph.connectionChange(this, link_info)
      return null
    }

    // Allow nodes to block connection
    if (target_node.onConnectInput?.(targetIndex, output.type, output, this, slot) === false)
      return null
    if (this.onConnectOutput?.(slot, input.type, input, target_node, targetIndex) === false)
      return null

    // if there is something already plugged there, disconnect
    if (target_node.inputs[targetIndex]?.link != null) {
      graph.beforeChange()
      target_node.disconnectInput(targetIndex, true)
      changed = true
    }
    if (output.links?.length) {
      if (output.type === LiteGraph.EVENT && !LiteGraph.allow_multi_output_for_events) {
        graph.beforeChange()
        // @ts-expect-error Unused param
        this.disconnectOutput(slot, false, { doProcessChange: false })
        changed = true
      }
    }

    // UUID: LinkIds
    // const nextId = LiteGraph.use_uuids ? LiteGraph.uuidv4() : ++graph.state.lastLinkId
    const nextId = ++graph.state.lastLinkId

    // create link class
    link_info = new LLink(
      nextId,
      input.type || output.type,
      this.id,
      slot,
      target_node.id,
      targetIndex,
      afterRerouteId,
    )

    // add to graph links list
    graph._links.set(link_info.id, link_info)

    // connect in output
    output.links ??= []
    output.links.push(link_info.id)
    // connect in input
    target_node.inputs[targetIndex].link = link_info.id

    // Reroutes
    LLink.getReroutes(graph, link_info)
      .forEach(x => x?.linkIds.add(nextId))
    graph._version++

    // link_info has been created now, so its updated
    this.onConnectionsChange?.(
      NodeSlotType.OUTPUT,
      slot,
      true,
      link_info,
      output,
    )

    target_node.onConnectionsChange?.(
      NodeSlotType.INPUT,
      targetIndex,
      true,
      link_info,
      input,
    )
    graph.onNodeConnectionChange?.(
      NodeSlotType.INPUT,
      target_node,
      targetIndex,
      this,
      slot,
    )
    graph.onNodeConnectionChange?.(
      NodeSlotType.OUTPUT,
      this,
      slot,
      target_node,
      targetIndex,
    )

    this.setDirtyCanvas(false, true)
    graph.afterChange()
    graph.connectionChange(this)

    return link_info
  }

  /**
   * disconnect one output to an specific node
   * @param slot (could be the number of the slot or the string with the name of the slot)
   * @param target_node the target node to which this slot is connected [Optional,
   * if not target_node is specified all nodes will be disconnected]
   * @returns if it was disconnected successfully
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

    // get output slot
    const output = this.outputs[slot]
    if (!output || !output.links || output.links.length == 0) return false

    // one of the output links in this slot
    const graph = this.graph
    if (target_node) {
      if (typeof target_node === "number")
        target_node = graph.getNodeById(target_node)
      if (!target_node) throw "Target Node not found"

      for (let i = 0, l = output.links.length; i < l; i++) {
        const link_id = output.links[i]
        const link_info = graph._links.get(link_id)

        // is the link we are searching for...
        if (link_info.target_id == target_node.id) {
          output.links.splice(i, 1) // remove here
          const input = target_node.inputs[link_info.target_slot]
          input.link = null // remove there

          // remove the link from the links pool
          graph._links.delete(link_id)
          graph._version++

          // link_info hasn't been modified so its ok
          target_node.onConnectionsChange?.(
            NodeSlotType.INPUT,
            link_info.target_slot,
            false,
            link_info,
            input,
          )
          this.onConnectionsChange?.(
            NodeSlotType.OUTPUT,
            slot,
            false,
            link_info,
            output,
          )

          graph.onNodeConnectionChange?.(NodeSlotType.OUTPUT, this, slot)
          graph.onNodeConnectionChange?.(NodeSlotType.INPUT, target_node, link_info.target_slot)
          break
        }
      }
    } else {
      // all the links in this output slot
      for (let i = 0, l = output.links.length; i < l; i++) {
        const link_id = output.links[i]
        const link_info = graph._links.get(link_id)
        // bug: it happens sometimes
        if (!link_info) continue

        target_node = graph.getNodeById(link_info.target_id)
        graph._version++

        if (target_node) {
          const input = target_node.inputs[link_info.target_slot]
          // remove other side link
          input.link = null

          // link_info hasn't been modified so its ok
          target_node.onConnectionsChange?.(
            NodeSlotType.INPUT,
            link_info.target_slot,
            false,
            link_info,
            input,
          )
        }
        // remove the link from the links pool
        graph._links.delete(link_id)

        this.onConnectionsChange?.(
          NodeSlotType.OUTPUT,
          slot,
          false,
          link_info,
          output,
        )
        graph.onNodeConnectionChange?.(NodeSlotType.OUTPUT, this, slot)
        graph.onNodeConnectionChange?.(NodeSlotType.INPUT, target_node, link_info.target_slot)
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
   * @param keepReroutes If `true`, reroutes will not be garbage collected.
   * @returns true if disconnected successfully or already disconnected, otherwise false
   */
  disconnectInput(slot: number | string, keepReroutes?: boolean): boolean {
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
    if (!input) return false

    const link_id = this.inputs[slot].link
    if (link_id != null) {
      this.inputs[slot].link = null

      // remove other side
      const link_info = this.graph._links.get(link_id)
      if (link_info) {
        const target_node = this.graph.getNodeById(link_info.origin_id)
        if (!target_node) return false

        const output = target_node.outputs[link_info.origin_slot]
        if (!(output?.links?.length > 0)) return false

        // search in the inputs list for this link
        let i = 0
        for (const l = output.links.length; i < l; i++) {
          if (output.links[i] == link_id) {
            output.links.splice(i, 1)
            break
          }
        }

        link_info.disconnect(this.graph, keepReroutes)
        if (this.graph) this.graph._version++

        this.onConnectionsChange?.(
          NodeSlotType.INPUT,
          slot,
          false,
          link_info,
          input,
        )
        target_node.onConnectionsChange?.(
          NodeSlotType.OUTPUT,
          i,
          false,
          link_info,
          output,
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
   * @param is_input true if if a input slot, false if it is an output
   * @param slot_number (could be the number of the slot or the string with the name of the slot)
   * @param out [optional] a place to store the output, to free garbage
   * @returns the position
   */
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

    // weird feature that never got finished
    if (is_input && slot_number == -1) {
      out[0] = this.pos[0] + LiteGraph.NODE_TITLE_HEIGHT * 0.5
      out[1] = this.pos[1] + LiteGraph.NODE_TITLE_HEIGHT * 0.5
      return out
    }

    // hard-coded pos
    if (
      is_input &&
      num_slots > slot_number &&
      this.inputs[slot_number].pos
    ) {
      out[0] = this.pos[0] + this.inputs[slot_number].pos[0]
      out[1] = this.pos[1] + this.inputs[slot_number].pos[1]
      return out
    } else if (
      !is_input &&
      num_slots > slot_number &&
      this.outputs[slot_number].pos
    ) {
      out[0] = this.pos[0] + this.outputs[slot_number].pos[0]
      out[1] = this.pos[1] + this.outputs[slot_number].pos[1]
      return out
    }

    // horizontal distributed slots
    if (this.horizontal) {
      out[0] = this.pos[0] + (slot_number + 0.5) * (this.size[0] / num_slots)
      out[1] = is_input
        ? this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT
        : this.pos[1] + this.size[1]
      return out
    }

    // default vertical slots
    out[0] = is_input
      ? this.pos[0] + offset
      : this.pos[0] + this.size[0] + 1 - offset
    out[1] =
      this.pos[1] +
      (slot_number + 0.7) * LiteGraph.NODE_SLOT_HEIGHT +
      (this.constructor.slot_start_y || 0)
    return out
  }

  /** @inheritdoc */
  snapToGrid(snapTo: number): boolean {
    return this.pinned ? false : snapPoint(this.pos, snapTo)
  }

  /** @see {@link snapToGrid} */
  alignToGrid(): void {
    this.snapToGrid(LiteGraph.CANVAS_GRID_SIZE)
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
    this.graph?.canvasAction(c => c.setDirty(dirty_foreground, dirty_background))
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
    if (!this.graph || !this.graph.list_of_graphcanvas) return

    const list = this.graph.list_of_graphcanvas

    for (let i = 0; i < list.length; ++i) {
      const c = list[i]
      // releasing somebody elses capture?!
      if (!v && c.node_capturing_input != this) continue

      // change
      c.node_capturing_input = v ? this : null
    }
  }

  get collapsed() {
    return !!this.flags.collapsed
  }

  get collapsible() {
    return !this.pinned && this.constructor.collapsable !== false
  }

  /**
   * Toggle node collapse (makes it smaller on the canvas)
   */
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
      this.setSize([
        Math.max(this.size[0], prefSize[0]),
        Math.max(this.size[1], prefSize[1]),
      ])
    }
    this.setDirtyCanvas(true, true)
  }

  get pinned() {
    return !!this.flags.pinned
  }

  /**
   * Prevents the node being accidentally moved or resized by mouse interaction.
   * Toggles pinned state if no value is provided.
   */
  pin(v?: boolean): void {
    if (this.graph) {
      this.graph._version++
    }
    this.flags.pinned = v ?? !this.flags.pinned
    this.resizable = !this.pinned
    // Delete the flag if unpinned, so that we don't get unnecessary
    // flags.pinned = false in serialized object.
    if (!this.pinned) delete this.flags.pinned
  }

  unpin(): void {
    this.pin(false)
  }

  localToScreen(x: number, y: number, dragAndScale: DragAndScale): Point {
    return [
      (x + this.pos[0]) * dragAndScale.scale + dragAndScale.offset[0],
      (y + this.pos[1]) * dragAndScale.scale + dragAndScale.offset[1],
    ]
  }

  get width() {
    return this.collapsed
      ? this._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH
      : this.size[0]
  }

  get height() {
    // @ts-expect-error Not impl.
    return this.collapsed ? LiteGraph.NODE_COLLAPSED_HEIGHT : this.size[1]
  }

  drawBadges(ctx: CanvasRenderingContext2D, { gap = 2 } = {}): void {
    const badgeInstances = this.badges.map(badge =>
      badge instanceof LGraphBadge ? badge : badge())
    const isLeftAligned = this.badgePosition === BadgePosition.TopLeft

    let currentX = isLeftAligned
      ? 0
      : this.width - badgeInstances.reduce((acc, badge) => acc + badge.getWidth(ctx) + gap, 0)
    const y = -(LiteGraph.NODE_TITLE_HEIGHT + gap)

    for (const badge of badgeInstances) {
      badge.draw(ctx, currentX, y - badge.height)
      currentX += badge.getWidth(ctx) + gap
    }
  }

  /**
   * Attempts to gracefully bypass this node in all of its connections by reconnecting all links.
   *
   * Each input is checked against each output.  This is done on a matching index basis, i.e. input 3 -> output 3.
   * If there are any input links remaining,
   * and {@link flags}.{@link INodeFlags.keepAllLinksOnBypass keepAllLinksOnBypass} is `true`,
   * each input will check for outputs that match, and take the first one that matches
   * `true`: Try the index matching first, then every input to every output.
   * `false`: Only matches indexes, e.g. input 3 to output 3.
   *
   * If {@link flags}.{@link INodeFlags.keepAllLinksOnBypass keepAllLinksOnBypass} is `undefined`, it will fall back to
   * the static {@link keepAllLinksOnBypass}.
   * @returns `true` if any new links were established, otherwise `false`.
   * @todo Decision: Change API to return array of new links instead?
   */
  connectInputToOutput(): boolean {
    const { inputs, outputs, graph } = this
    if (!inputs || !outputs) return

    const { _links } = graph
    let madeAnyConnections = false

    // First pass: only match exactly index-to-index
    for (const [index, input] of inputs.entries()) {
      const output = outputs[index]
      if (!output || !LiteGraph.isValidConnection(input.type, output.type)) continue

      const inLink = _links.get(input.link)
      const inNode = graph.getNodeById(inLink?.origin_id)
      if (!inNode) continue

      bypassAllLinks(output, inNode, inLink)
    }
    // Configured to only use index-to-index matching
    if (!(this.flags.keepAllLinksOnBypass ?? LGraphNode.keepAllLinksOnBypass))
      return madeAnyConnections

    // Second pass: match any remaining links
    for (const input of inputs) {
      const inLink = _links.get(input.link)
      const inNode = graph.getNodeById(inLink?.origin_id)
      if (!inNode) continue

      for (const output of outputs) {
        if (!LiteGraph.isValidConnection(input.type, output.type)) continue

        bypassAllLinks(output, inNode, inLink)
        break
      }
    }
    return madeAnyConnections

    function bypassAllLinks(output: INodeOutputSlot, inNode: LGraphNode, inLink: LLink) {
      const outLinks = output.links
        ?.map(x => _links.get(x))
        .filter(x => !!x)
      if (!outLinks?.length) return

      for (const outLink of outLinks) {
        const outNode = graph.getNodeById(outLink.target_id)
        if (!outNode) return

        const result = inNode.connect(
          inLink.origin_slot,
          outNode,
          outLink.target_slot,
          inLink.parentId,
        )
        madeAnyConnections ||= !!result
      }
    }
  }
}
