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
  /** Node types: their definitions, and the hooks a pack adds to them. */
  readonly defs: DefRegistry
  /** Every change a pack makes to the document. */
  readonly edit: Edits
}

/** The graph on screen. An argument a member cannot use throws a `TypeError`. */
export interface GraphHandle extends GraphHandleEdits {
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
  /**
   * Advances with each `comfy.edit` call that is applied and when nodes or links come or go; host moves,
   * colors and widget values leave it, and undo or a load sets it back. A different reading means a change.
   */
  readonly version: number | undefined
}

/** One particular graph: the root graph, or a subgraph definition. */
export interface GraphScopeHandle extends GraphScopeHandleMembers {
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

export interface NodeHandle extends NodeHandleEdits {
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

/**
 * The one place a pack changes the document. Each call is one undo step, or part of `batch`'s;
 * a node whose type is not installed saves only its mode and position.
 */
export interface Edits {
  /**
   * Changes the fields `patch` names; an unusable one throws first. False if the node
   * is gone (nothing changed) or kept a property's old value (the rest applied).
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
   * Changes the fields `patch` names on a slot; not a subgraph node's. Throws first for a taken name or
   * a missing widget. A load gives back some fields of a slot the node's type makes (see `SlotPatch`).
   */
  updateSlot(slot: InputSlotHandle, patch: InputSlotPatch): boolean
  updateSlot(slot: OutputSlotHandle, patch: SlotPatch): boolean
  /** Adds an input after the others; not to a subgraph node. `undefined` if the node is gone. */
  addInput(
    node: NodeHandle,
    name: string,
    type: SlotType,
    options?: SlotOptions
  ): InputSlotHandle | undefined
  /** Adds an output after the others; not to a subgraph node. `undefined` if the node is gone. */
  addOutput(
    node: NodeHandle,
    name: string,
    type: SlotType,
    options?: SlotOptions
  ): OutputSlotHandle | undefined
  /** Removes a slot and its links; not a subgraph node's. False if it is gone. */
  removeSlot(slot: InputSlotHandle | OutputSlotHandle): boolean
  /**
   * Puts a node's inputs or outputs in the order `names` gives, with their links.
   * Names each slot once. A load puts slots the node's type makes back in its order.
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
   * Runs `edits` now as one undo step, which re-reads the whole graph once, and returns its result.
   * Edits made before a throw stay; edits after it returns are not in the step. Loop inside one batch.
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
  /** Saved properties, by name. Each value is stored as the workflow saves it; `undefined` deletes one. */
  readonly properties?: Readonly<Record<string, unknown>>
  /** Not saved: a load gives the type's own. `false` throws on a Note, MarkdownNote or PrimitiveNode. */
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

/** Each edit method, and each edit of `inputs` and `outputs`, is a call to `comfy.edit`; `addBadge` is not an edit. */
export interface NodeHandleEdits {
  setTitle(title: string): boolean
  setMode(mode: NodeMode): boolean
  setCollapsed(collapsed: boolean): boolean
  setColor(color: string | undefined): boolean
  setBgColor(color: string | undefined): boolean
  setShape(shape: NodeShape): boolean
  /** `undefined` deletes the property. A name that is not a string throws a `TypeError`. */
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
   * Adds a badge until the disposer is called or undo rebuilds the node. Under Vue nodes, a badge added
   * or removed after the node is first drawn shows or goes only when its badges are next recomputed.
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

/**
 * What `updateSlot` changes; a subgraph node's slots take no patch. A load gives a slot its type
 * makes its name, type, shape, localizedName, widget and place back, and brings a removed one back.
 */
export interface SlotPatch {
  readonly name?: string
  readonly label?: string | null
  readonly localizedName?: string | null
  /** An output's links take the new type; an input's link is kept. */
  readonly type?: SlotType
  /** The dot's color when the slot is connected. */
  readonly color?: string | null
  readonly colorWhenUnconnected?: string | null
  readonly shape?: SlotShape | null
  /** The slot's center relative to the node's body; not for a widget's socket. */
  readonly position?: Point | null
  /** The direction links leave the slot in. */
  readonly direction?: SlotDirection | null
}

export interface InputSlotPatch extends SlotPatch {
  /** The node's widget this input is the socket of, which no other input may be; `null` for none. */
  readonly widget?: string | null
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

/** Node types: read their definitions, define new ones, and extend those the host registers. */
export interface DefRegistry {
  /**
   * Calls `apply` once for each node type `selector` picks, now and as types
   * register; its hooks reach the nodes that join a graph after this call, not those already there.
   * Unsubscribing removes them.
   */
  extend(
    selector: DefSelector,
    apply: (builder: NodeDefBuilder) => void
  ): Unsubscribe
  /** Registers a node type the pack owns. Unsubscribing unregisters it. */
  define(definition: NodeDefinition): Unsubscribe
  /** A copy of a node type's definition, or `undefined` if there is none. */
  get(type: string): NodeDef | undefined
  has(type: string): boolean
  /** Every node definition, in the order its type first registered. */
  all(): readonly NodeDef[]
  /** Reloads the node definitions. Resolves `false` if the host did not apply them; rejects if fetching failed. */
  refresh(): Promise<boolean>
  /** Calls `listener` after each reload of the node definitions, whoever asked. */
  onRefreshed(listener: () => void): Unsubscribe
  /** The colour links of a data type are drawn in, or `undefined` if nothing colours the type. */
  typeColor(type: string): string | undefined
  /**
   * Colours the links of a data type the palette leaves uncoloured, such as one
   * the pack introduces. A type's newest colour wins until it is unsubscribed.
   */
  setTypeColor(type: string, color: string): Unsubscribe
  /** The colours of an entry of the node colour menu, such as `red`. */
  nodeColor(name: string): NodeColor | undefined
  /** True if an output of `outputType` may link to an input of `inputType`. */
  isTypeCompatible(outputType: string, inputType: string): boolean
}

export interface NodeColor {
  readonly color: string
  readonly bgColor: string
  readonly groupColor: string
}

/**
 * Picks node types: by type name, by any of several names, by a pattern the
 * name matches, by category, or by a test of the definition.
 */
export type DefSelector =
  | string
  | readonly string[]
  | RegExp
  | { readonly category: string | RegExp }
  | ((def: NodeDef) => boolean)

/**
 * Extends one node type. Its methods throw a `TypeError` once the callback
 * given to `extend` returns. Hooks run for nodes in a graph that joined after the extension was made, in the order added.
 */
export interface NodeDefBuilder {
  /** The definition of the type being extended. */
  readonly def: NodeDef
  /** A node of the type joined a graph. */
  onCreated(callback: (node: NodeHandle, event: NodeCreatedEvent) => void): void
  /** A node took saved state. A node configured before it joined a graph hears this once it joins. */
  onConfigured(
    callback: (
      node: NodeHandle,
      data: Readonly<Record<string, unknown>>
    ) => void
  ): void
  /** A node is leaving its graph, removed or rebuilt by a load, undo or redo; its handle still reads it. */
  onRemoved(callback: (node: NodeHandle) => void): void
  /** The server finished running a node. */
  onExecuted(
    callback: (node: NodeHandle, result: ExecutionResult) => void
  ): void
  /**
   * Adds fields to a node as it is saved, and back through `onConfigured`.
   * Fields the node saves itself are refused, and the whole result with them.
   */
  onSerialize(
    callback: (node: NodeHandle) => Readonly<Record<string, unknown>> | void
  ): void
  onResized(callback: (node: NodeHandle, size: Size) => void): void
  /** A link to or from one of a node's slots was made, removed, or restored with saved state. */
  onConnectionsChanged(
    callback: (node: NodeHandle, event: ConnectionChangeEvent) => void
  ): void
  /** A link is about to be made to or from a node. Returning `false` refuses it. */
  onBeforeConnect(
    callback: (node: NodeHandle, event: BeforeConnectEvent) => boolean | void
  ): void
  /** One of a node's properties was set, or restored from a saved workflow. */
  onPropertyChanged(
    callback: (node: NodeHandle, event: PropertyChangeEvent) => void
  ): void
  /** The pointer entered or left a node. Called by the canvas renderer, not by Vue nodes. */
  onHover(callback: (node: NodeHandle, hovering: boolean) => void): void
  /** A node was double-clicked. Called by the canvas renderer, not by Vue nodes. */
  onDoubleClick(callback: (node: NodeHandle) => void): void
  /** Adds an entry to the context menu of the type's nodes. */
  addMenuItem(item: NodeMenuItem): void
}

/** An entry of a node's context menu. It needs `run`, `items`, or both. */
export interface NodeMenuItem {
  /** The text, or a function of the node that gives it. */
  readonly label: string | ((node: NodeHandle) => string)
  /** Shown only when this returns `true`. */
  when?(node: NodeHandle): boolean
  run?(node: NodeHandle): void
  /** A submenu, or a function of the node that gives one. An empty one is not shown. */
  readonly items?:
    | readonly NodeSubMenuItem[]
    | ((node: NodeHandle) => readonly NodeSubMenuItem[])
  /** Lower comes first; none counts as 0. Ties keep the order they were added in. */
  readonly order?: number
}

export interface NodeSubMenuItem {
  readonly label: string
  run(node: NodeHandle): void
}

export interface NodeCreatedEvent {
  /**
   * True while loading, and for a node configured before it joined. A pasted or
   * duplicated node joins first; `onConfigured` then gives its saved state.
   */
  readonly restored: boolean
  /** True while a workflow is loaded or imported, or rebuilt by undo, redo or a subgraph conversion. */
  readonly loading: boolean
}

export interface ConnectionChangeEvent {
  readonly side: 'input' | 'output'
  /** The slot's index when the link changed. */
  readonly index: number
  /**
   * The slot's name, also when it was removed with its link. Removing a slot linked
   * to a subgraph's input or output names the slot now at `index`, or that subgraph slot.
   */
  readonly name: string
  readonly connected: boolean
  /** The node at the other end of the link; `undefined` for a subgraph's own input or output, which is no node. */
  readonly peerNodeId: string | undefined
  readonly peerIndex: number | undefined
}

export interface BeforeConnectEvent {
  /** Which of the node's own slots the link would use. */
  readonly side: 'input' | 'output'
  readonly index: number
}

export interface PropertyChangeEvent {
  readonly name: string
  /** A frozen copy of the new value, as a workflow would save it. */
  readonly value: unknown
  /**
   * Stores `value` instead, frozen, as a workflow would save it; the last call wins. Throws a
   * `TypeError` for `undefined` or a value a workflow cannot save, and once the hook has returned.
   */
  setValue(value: unknown): void
  /** Keeps the property's earlier value, or a restored one. Throws a `TypeError` once the hook has returned. */
  reject(): void
}

export interface ExecutionResult {
  readonly text: readonly string[]
  /** The images the node output, as the server describes them. */
  readonly images: readonly Readonly<Record<string, unknown>>[]
  /** A copy of everything the server sent for the node. */
  readonly raw: Readonly<Record<string, unknown>>
}

export interface NodeDef {
  readonly type: string
  readonly title: string
  readonly category: string
  readonly description: string
  readonly inputs: readonly NodeDefInput[]
  readonly outputs: readonly NodeDefOutput[]
  /** The hidden inputs the server fills in, as the type declares them. */
  readonly hidden: Readonly<Record<string, unknown>>
  readonly isOutputNode: boolean
}

export interface NodeDefInput {
  readonly name: string
  readonly type: string
  /** The name the editor shows, in the user's language. */
  readonly localizedName: string
  /** The choices of a combo input, in the server's order. */
  readonly values?: readonly (string | number)[]
  /** The options the input declares, such as `default`, `min` and `max`. */
  readonly options: Readonly<Record<string, unknown>>
}

export interface NodeDefOutput {
  readonly name: string
  readonly type: string
}

/** A node type a pack owns. */
export interface NodeDefinition {
  readonly type: string
  /** Defaults to `type`, as does `''`. */
  readonly title?: string
  readonly category?: string
  readonly description?: string
  readonly inputs?: readonly NodeDefinitionSlot[]
  readonly outputs?: readonly NodeDefinitionSlot[]
  /** `'frontend'`, the default, leaves the node out of the prompt; `'backend'` sends it as its type. */
  readonly execution?: 'backend' | 'frontend'
  onCreated?(node: NodeHandle, event: NodeCreatedEvent): void
  onConfigured?(node: NodeHandle, data: Readonly<Record<string, unknown>>): void
  onRemoved?(node: NodeHandle): void
  onSerialize?(node: NodeHandle): Readonly<Record<string, unknown>> | void
  onConnectionsChanged?(node: NodeHandle, event: ConnectionChangeEvent): void
  onPropertyChanged?(node: NodeHandle, event: PropertyChangeEvent): void
}

export interface NodeDefinitionSlot {
  readonly name: string
  readonly type: string
}
