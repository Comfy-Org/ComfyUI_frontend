export type ApiVersion = readonly [major: number, minor: number, patch: number]

/** Ends one registration. Safe to call more than once. */
export type Unsubscribe = () => void

/** The V4 node API: everything a pack can do. */
export interface Comfy {
  getApiVersion(): ApiVersion
  /**
   * True if this API is `version` or newer. `version` is written `v4.0.0`:
   * three numbers, with the `v` optional. Anything else throws a `TypeError`.
   */
  isApiVersionAtLeast(version: string): boolean
  /**
   * Runs `listener` once the app is set up, before the first workflow loads;
   * on the next microtask if it already is.
   */
  onReady(listener: () => void): Unsubscribe

  /** The graph on screen, and the way to every node in the open document. */
  readonly graph: GraphHandle
  /**
   * True if `a` and `b` are handles to the same entity. There is one handle
   * per entity, so `a === b` gives the same answer for two handles.
   */
  sameEntity(a: unknown, b: unknown): boolean
}

/** The graph on screen. An argument a member cannot use throws a `TypeError`. */
export interface GraphHandle {
  /** The id of the graph on screen, or `undefined` before there is one. */
  readonly id: string | undefined
  /** The node with this id in the graph on screen. */
  node(id: string): NodeHandle | undefined
  /** Every node in the graph on screen, in the graph's own order. */
  nodes(): readonly NodeHandle[]
  nodesOfType(type: string): readonly NodeHandle[]
  /** The nodes a query selects: the root graph's first, then each subgraph's. */
  queryNodes(query?: NodeQuery): readonly NodeHandle[]
  /** The root graph of the open document. */
  root(): GraphScopeHandle | undefined
  /** Every subgraph definition in the open document. */
  subgraphs(): readonly GraphScopeHandle[]
}

/** One particular graph: the root graph, or a subgraph definition. */
export interface GraphScopeHandle {
  readonly id: string
  /**
   * True while the entity is gone, and every other read is `undefined`. Undo
   * restores it only if no undo or redo has finished since it went.
   */
  readonly isDeleted: boolean
  /** A subgraph's name. `undefined` for the root graph. */
  readonly name: string | undefined
  /** The node with this id in this graph. */
  node(id: string): NodeHandle | undefined
  nodes(): readonly NodeHandle[] | undefined
}

/**
 * `'visible'` is the graph on screen. `'root-and-subgraphs'` is the root graph
 * and every subgraph definition, each counted once however often it is placed.
 */
export type NodeQueryScope = 'visible' | 'root-and-subgraphs'

/** Every field narrows the result, and they combine. */
export interface NodeQuery {
  /** Defaults to `'visible'`. */
  readonly scope?: NodeQueryScope
  /** One type, or any of several. */
  readonly type?: string | readonly string[]
}

export interface NodeHandle {
  /** The node's id. Another document will use the same ids. */
  readonly id: string
  /** The id of the graph the node is in. With `id`, this names the node. */
  readonly graphId: string
  /**
   * True while the entity is gone, and every other read is `undefined`. Undo
   * restores it only if no undo or redo has finished since it went.
   */
  readonly isDeleted: boolean
  /** The registered type, e.g. `KSampler`. A subgraph node's is its subgraph's id. */
  readonly type: string | undefined
  /** The backend class the node runs as, or its `type` when it has none. */
  readonly comfyClass: string | undefined

  getTitle(): string | undefined
  /** `undefined` too for a mode that has no name here. */
  getMode(): NodeMode | undefined
  isCollapsed(): boolean | undefined
  isPinned(): boolean | undefined
  /** The title-bar color, or `undefined` for the default. */
  getColor(): string | undefined
  /** The body color, or `undefined` for the default. */
  getBgColor(): string | undefined
  /** A copy of one saved property. `undefined` if there is none, or it cannot be saved. */
  getProperty(name: string): unknown
  /** A copy of the node's saved properties. `undefined` if they cannot be saved. */
  getProperties(): Readonly<Record<string, unknown>> | undefined
  /** The top-left corner of the node's body, in graph space. */
  getPosition(): Point | undefined
  /** The size of the node's body, title bar excluded, even when collapsed. */
  getSize(): Size | undefined
  /** The rectangle the node occupies in graph space, title bar included. */
  getBounds(): Bounds | undefined
}

export type NodeMode = 'always' | 'never' | 'bypass' | 'on-event' | 'on-trigger'

interface Point {
  readonly x: number
  readonly y: number
}

interface Size {
  readonly width: number
  readonly height: number
}

export interface Bounds extends Point, Size {}

export interface Comfy {
  /** Every change a pack makes to the document. */
  readonly edit: Edits
}

export interface NodeHandle extends NodeHandleEdits {}

export interface GraphHandle extends GraphHandleEdits {
  /**
   * Changes whenever the graph on screen does, edits through this API
   * included. Compare two readings; the number itself means nothing.
   */
  readonly version: number | undefined
}

/**
 * The one place a pack changes the document; every handle edit method calls
 * one of these. Each call is one undo step, or part of `batch`'s.
 */
export interface Edits {
  /**
   * Changes the fields `patch` names. An unusable field throws a `TypeError`
   * before anything changes. False, changing nothing, if the node is gone.
   */
  updateNode(node: NodeHandle, patch: NodePatch): boolean
  /** Removes the node and its links. False if it is gone or cannot be removed. */
  removeNode(node: NodeHandle): boolean
  /**
   * Adds a node of a registered type to `graph`, placed before it joins.
   * `undefined` if the graph is gone or no such type is registered.
   */
  addNode(
    graph: GraphScopeHandle,
    type: string,
    init?: NodeInit
  ): NodeHandle | undefined
  /**
   * Changes the fields `patch` names on a slot. A name another slot on its side
   * has, or a widget the node lacks, throws first. False if the slot is gone.
   */
  updateSlot(slot: InputSlotHandle, patch: InputSlotPatch): boolean
  updateSlot(slot: OutputSlotHandle, patch: SlotPatch): boolean
  /** Adds an input after the others. `undefined` if the node is gone. */
  addInput(
    node: NodeHandle,
    name: string,
    type: SlotType,
    options?: SlotOptions
  ): InputSlotHandle | undefined
  /** Adds an output after the others. `undefined` if the node is gone. */
  addOutput(
    node: NodeHandle,
    name: string,
    type: SlotType,
    options?: SlotOptions
  ): OutputSlotHandle | undefined
  /** Removes a slot and its links. False if it is gone. */
  removeSlot(slot: InputSlotHandle | OutputSlotHandle): boolean
  /**
   * Puts a node's inputs or outputs in the order `names` gives, moving their
   * links with them. `names` must name each slot once.
   */
  reorderSlots(
    node: NodeHandle,
    side: SlotSide,
    names: readonly string[]
  ): boolean
  /**
   * Links an output to an input of the same graph. `undefined` if either is
   * gone or the host refuses the link, as for types that do not match.
   */
  connect(
    output: OutputSlotHandle,
    input: InputSlotHandle
  ): LinkInfo | undefined
  /** Removes an input's link, or an output's links, to `target` only if given. */
  disconnect(
    slot: InputSlotHandle | OutputSlotHandle,
    target?: NodeHandle
  ): boolean
  /**
   * Moves every link of an output to another output of its node, keeping the
   * links' ids, and gives the links moved. Their types are not checked again.
   */
  moveLinks(
    from: OutputSlotHandle,
    to: OutputSlotHandle
  ): readonly LinkInfo[] | undefined
  /**
   * Runs `edits` now, as one undo step, and returns what it returns. Edits it
   * made before throwing stay. Edits after it returns are not in the step.
   */
  batch<T>(edits: () => T): T
}

/** What `updateNode` changes. A field left out stays as it is. */
export interface NodePatch {
  readonly title?: string
  readonly mode?: NodeMode
  readonly collapsed?: boolean
  /** The title-bar color. `undefined` restores the default. */
  readonly color?: string | undefined
  /** The body color. `undefined` restores the default. */
  readonly bgColor?: string | undefined
  readonly shape?: NodeShape
  /** Saved properties, by name. Each value is stored as the workflow saves it. */
  readonly properties?: Readonly<Record<string, unknown>>
  /** Whether the node saves its widget values in the workflow. */
  readonly serializeWidgets?: boolean
  /** The top-left corner of the node's body, in graph space. */
  readonly position?: Point
  /** The size of the node's body, title bar excluded. */
  readonly size?: Size
  /** Resizes the node to fit them, once. A later resize is not held to them. */
  readonly sizeConstraints?: SizeConstraints
  /** Not saved. A pinned node cannot be resized; unpinning brings this back. */
  readonly resizable?: boolean
}

export type NodeShape = 'default' | 'box' | 'round' | 'circle' | 'card'

/** Limits in graph units, each zero or more. */
export interface SizeConstraints {
  readonly minWidth?: number
  readonly minHeight?: number
  readonly maxWidth?: number
  readonly maxHeight?: number
  /** Sets the height to what the node's slots and widgets need. */
  readonly autoHeight?: boolean
}

export interface NodeSnapshot {
  readonly id: string
  readonly type: string
  readonly title: string | undefined
  readonly mode: NodeMode | undefined
  readonly collapsed: boolean
  readonly pinned: boolean
  readonly color: string | undefined
  readonly bgColor: string | undefined
  readonly shape: NodeShape
  readonly position: Point
  readonly size: Size
}

/** A label on a node's title bar. */
export interface BadgeDef {
  readonly text: string
  /** The text color. */
  readonly color?: string
  readonly bgColor?: string
  /** Called when the user clicks the badge. */
  onClick?(): void
}

/** Each edit method is `comfy.edit.updateNode` or `removeNode` on this node. */
export interface NodeHandleEdits {
  setTitle(title: string): boolean
  setMode(mode: NodeMode): boolean
  setCollapsed(collapsed: boolean): boolean
  setColor(color: string | undefined): boolean
  setBgColor(color: string | undefined): boolean
  setShape(shape: NodeShape): boolean
  /** A name that is not a string throws a `TypeError`. */
  setProperty(name: string, value: unknown): boolean
  setSerializeWidgets(serialize: boolean): boolean
  isSerializingWidgets(): boolean | undefined
  setPosition(position: Point): boolean
  setSize(size: Size): boolean
  setSizeConstraints(constraints: SizeConstraints): boolean
  setResizable(resizable: boolean): boolean
  /** False while the node is pinned, or after `setResizable(false)`. */
  isResizable(): boolean | undefined
  remove(): boolean
  /** The node's state now, frozen. */
  snapshot(): NodeSnapshot | undefined
  readonly inputs: SlotCollection<InputSlotHandle>
  readonly outputs: SlotCollection<OutputSlotHandle>
  /**
   * Adds a badge until the disposer is called or the node is rebuilt, as undo
   * rebuilds it. A function is called each time the badge is drawn.
   */
  addBadge(badge: BadgeDef | (() => BadgeDef)): Unsubscribe
}

/** How `addNode` starts a node. */
export interface NodeInit {
  /** The type's own title when left out. */
  readonly title?: string
  /** The top-left corner of the node's body, in graph space. */
  readonly position?: Point
}

/** A link between two slots, as plain data at the moment it was read. */
export interface LinkInfo {
  readonly id: string
  /** In a subgraph, a link from the subgraph's own input has that input's node id. */
  readonly sourceNodeId: string
  /** The output's id; a slot handle with it is the same slot. */
  readonly sourceSlotId: string | undefined
  /** The output's position on its node; it shifts when slots are added or removed. */
  readonly sourceIndex: number
  readonly targetNodeId: string
  readonly targetSlotId: string | undefined
  readonly targetIndex: number
  readonly type: string
}

/** Each edit method is a call to `comfy.edit` on the graph on screen. */
export interface GraphHandleEdits {
  /** `comfy.edit.addNode` on the graph on screen. */
  add(type: string, init?: NodeInit): NodeHandle | undefined
  /** `comfy.edit.batch`. */
  batch<T>(edits: () => T): T
  /** Every link in the graph on screen, in id order. */
  links(): readonly LinkInfo[] | undefined
  /** The groups in the graph on screen, in draw order. */
  groups(): readonly GroupHandle[] | undefined
}

export interface GraphScopeHandle extends GraphScopeHandleMembers {}

export interface GraphScopeHandleMembers {
  /** The groups in this graph, in draw order. */
  groups(): readonly GroupHandle[] | undefined
}

/** A group: a titled rectangle. Which nodes it holds follows from where they are. */
export interface GroupHandle {
  /** The group's id in its graph. */
  readonly id: string
  /** True while the group is gone, and every other read is `undefined`. */
  readonly isDeleted: boolean
  getTitle(): string | undefined
  /** The color the group is drawn in. */
  getColor(): string | undefined
  /** The group's rectangle in graph space, title bar included. */
  getBounds(): Bounds | undefined
  /** The nodes whose center is inside the group now, in the graph's order. */
  nodes(): readonly NodeHandle[] | undefined
}

export type SlotSide = 'input' | 'output'

/** A slot id, else a slot name, else a position on the node. */
export type SlotRef = string | { readonly index: number }

export type SlotShape = 'default' | 'optional' | 'list' | 'directional'

export type SlotDirection = 'none' | 'up' | 'down' | 'left' | 'right' | 'center'

/** A slot type. Several names make a slot that accepts any of them. */
export type SlotType = string | readonly string[]

/** What `updateSlot` changes. `null` or `undefined` clears a field that can be cleared. */
export interface SlotPatch {
  readonly name?: string
  readonly label?: string | null
  readonly localizedName?: string | null
  /** An output's links take the new type; an input's link is kept. */
  readonly type?: SlotType
  /** The dot's color when the slot is connected. */
  readonly color?: string | null
  readonly colorWhenUnconnected?: string | null
  readonly shape?: SlotShape
  /** The slot's center relative to the node's body. */
  readonly position?: Point | null
  /** The direction links leave the slot in. */
  readonly direction?: SlotDirection | null
}

export interface InputSlotPatch extends SlotPatch {
  /** The node's widget this input is the socket form of. */
  readonly widget?: string
}

export interface SlotOptions {
  readonly shape?: SlotShape
  /** Inputs only: the node's widget this input is the socket form of. */
  readonly widget?: string
}

export interface SlotSnapshot {
  readonly id: string
  readonly index: number
  readonly name: string
  readonly type: string
  readonly label: string | undefined
  readonly localizedName: string | undefined
  readonly position: Point | undefined
  readonly direction: SlotDirection | undefined
  readonly shape: SlotShape
  readonly isConnected: boolean
}

/** One slot of a node. Undo and redo rebuild slots, so a handle does not outlive them. */
export interface SlotHandle {
  /** Stays the same for as long as the slot does. */
  readonly id: string
  /** True once the slot is gone; every other read is then `undefined`. */
  readonly isDeleted: boolean
  /** The slot's position on its node. It shifts when slots are added or removed. */
  readonly index: number | undefined
  readonly name: string | undefined
  readonly type: string | undefined
  readonly label: string | undefined
  readonly isConnected: boolean | undefined
  snapshot(): SlotSnapshot | undefined
}

export interface InputSlotHandle extends SlotHandle {
  /** The type the link into this input carries. */
  readonly connectedType: string | undefined
  readonly isWidgetInput: boolean | undefined
  link(): LinkInfo | undefined
  source():
    | { readonly nodeId: string; readonly outputIndex: number }
    | undefined
  /** `comfy.edit.updateSlot(this, patch)`. */
  modify(patch: InputSlotPatch): boolean
  /** `comfy.edit.disconnect(this)`. */
  disconnect(): boolean
}

export interface OutputSlotHandle extends SlotHandle {
  links(): readonly LinkInfo[] | undefined
  targets():
    | readonly { readonly nodeId: string; readonly inputIndex: number }[]
    | undefined
  /** `comfy.edit.updateSlot(this, patch)`. */
  modify(patch: SlotPatch): boolean
  /** `comfy.edit.connect` to the input `input` names on the node with this id in this slot's graph. */
  connectTo(targetNodeId: string, input: SlotRef): LinkInfo | undefined
  /** `comfy.edit.disconnect`, from the node with this id in this slot's graph, or from all. */
  disconnect(targetNodeId?: string): boolean
  /** `comfy.edit.moveLinks` to the output `target` names on this node. */
  moveLinksTo(target: SlotRef): readonly LinkInfo[] | undefined
}

/** A node's inputs or outputs. Reads are `undefined` once the node is gone. */
export interface SlotCollection<THandle> {
  readonly length: number | undefined
  at(index: number): THandle | undefined
  all(): readonly THandle[] | undefined
  /** `undefined` too when more than one slot has the name. */
  byName(name: string): THandle | undefined
  byId(id: string): THandle | undefined
  names(): readonly string[] | undefined
  [Symbol.iterator](): Iterator<THandle>
  /** `comfy.edit.addInput` or `addOutput` on this node. */
  add(name: string, type: SlotType, options?: SlotOptions): THandle | undefined
  /** `comfy.edit.removeSlot` on the slot `ref` names. False if none does. */
  remove(ref: SlotRef): boolean
  /** `comfy.edit.reorderSlots` on this node and side. */
  reorder(names: readonly string[]): boolean
}
