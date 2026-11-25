export type ApiVersion = readonly [major: number, minor: number, patch: number]

/** Ends one registration. Safe to call more than once. */
export type Unsubscribe = () => void

/**
 * A pack's identity: `[project] name` and `version` of its `pyproject.toml`, as the backend verified them; against a
 * backend that does not check packs, `folder:` and the folder name as served, and `undefined`.
 */
export interface PackId {
  readonly id: string
  readonly version: string | undefined
}

export interface Comfy {
  getApiVersion(): ApiVersion
  /** Register from `import.meta`; calls for the same pack return the same `PackId`.
   * Throws `TypeError` for an invalid module URL, an unrecognized pack when verification is available, or an id naming a node field. */
  registerPack(meta: { readonly url: string }): PackId
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

  /**
   * The graph on screen, and the way to every node in the open document. Each call reads the graph on screen then;
   * a handle it gives edits the handle's own graph wherever the user goes.
   */
  readonly graph: GraphHandle
  /**
   * True if `a` and `b` are the same node, group, slot or graph-scope handle; `false` for anything else.
   * There is one such handle per entity, so `a === b` gives the same answer for two of them.
   */
  sameEntity(a: unknown, b: unknown): boolean
  readonly defs: DefRegistry
}

/** The graph on screen at each call: the root graph, or the subgraph the user opened. An argument a member cannot use throws a `TypeError`. */
export interface GraphHandle {
  /** The id of the graph on screen, or `undefined` before there is one. */
  readonly id: string | undefined
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
   * Grows when the open document changed since the last reading, whichever of its graphs is on screen: on every edit a
   * handle applies, every undo, redo and load, and some of the editor's own changes. No reading repeats an earlier one.
   */
  readonly version: number | undefined
  /**
   * Adds a node of a registered type to the graph on screen, placed before it joins.
   * `undefined` before there is a graph, or if no such type is registered.
   */
  add(type: string, init?: NodeInit): NodeHandle | undefined
  /**
   * Runs `edits` now as one undo step, which re-reads the whole graph once, and returns its result; an `async` function throws a `TypeError`.
   * Edits made before a throw stay; edits after it returns are not in the step. Loop inside one batch.
   */
  batch<T>(edits: () => T): T
  /** Every link in the graph on screen, in id order; none before there is one. */
  links(): readonly LinkInfo[]
  /** The groups in the graph on screen, in draw order; none before there is one. */
  groups(): readonly GroupHandle[]
}

/** One particular graph: the root graph, or a subgraph definition. */
export interface GraphScopeHandle {
  readonly id: string
  /**
   * True while the graph is gone, and every other read is `undefined`. An undo or redo that brings the graph
   * back may restore the handle, or may retire it; then take a fresh one from `root()` or `subgraphs()`.
   */
  readonly isDeleted: boolean
  /** A subgraph's name. `undefined` for the root graph. */
  readonly name: string | undefined
  node(id: string): NodeHandle | undefined
  nodes(): readonly NodeHandle[] | undefined
  /** The groups in this graph, in draw order. */
  groups(): readonly GroupHandle[] | undefined
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
  readonly type?: string | readonly string[]
}

/**
 * Each change is one undo step, or part of `graph.batch`'s, and is `false` once the node is gone; an unusable
 * argument throws first. A node whose type is not installed saves only its mode and position.
 */
export interface NodeHandle {
  /** The node's id. Another document will use the same ids. */
  readonly id: string
  /** The id of the graph the node is in. With `id`, this names the node. */
  readonly graphId: string
  /**
   * True while the node is gone, and every other read is `undefined`. An undo or redo that brings the node
   * back may restore the handle, or may retire it; then take a fresh one from its graph.
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
  /** A copy of one saved property. `undefined` if there is none, or it cannot be read or saved. */
  getProperty(name: string): unknown
  /** A copy of the node's saved properties. `undefined` if they cannot be saved. */
  getProperties(): Readonly<Record<string, unknown>> | undefined
  /** The top-left corner of the node's body, in graph space. */
  getPosition(): Point | undefined
  /** The size of the node's body, title bar excluded, even when collapsed. */
  getSize(): Size | undefined
  /** The rectangle the node occupies in graph space, title bar included. */
  getBounds(): Bounds | undefined

  setTitle(title: string): boolean
  setMode(mode: NodeMode): boolean
  setCollapsed(collapsed: boolean): boolean
  /** The title-bar color; `undefined` or `null` restores the default. */
  setColor(color: string | null | undefined): boolean
  /** The body color; `undefined` or `null` restores the default. */
  setBgColor(color: string | null | undefined): boolean
  setShape(shape: NodeShape): boolean
  /**
   * Stores a copy of `value` as the workflow saves it; `undefined` deletes it. A value the workflow cannot save
   * unchanged, or the name `cnr_id`, `aux_id` or `ver`, throws a `TypeError`. `false` if a pack's hook kept the old value.
   */
  setProperty(name: string, value: unknown): boolean
  /** Not saved: a load gives the type's own. `serialize` must be a boolean; `false` throws a `TypeError` on a node whose type says its widget values are the user's content. */
  setSerializeWidgets(serialize: boolean): boolean
  isSerializingWidgets(): boolean | undefined
  /** The top-left corner of the node's body, in graph space. Pass `{ x, y }`: a `Bounds` is refused for its extra fields. */
  setPosition(position: Point): boolean
  /** The size of the node's body, title bar excluded. */
  setSize(size: Size): boolean
  /**
   * Requests one size that fits them, once. A resize callback that runs during the call may set another size, which stands,
   * and a later resize is not held to them.
   */
  setSizeConstraints(constraints: SizeConstraints): boolean
  /** Not saved. A pinned node cannot be resized, and unpinning makes it resizable whatever was chosen. */
  setResizable(resizable: boolean): boolean
  /** Removes the node and its links. `false` too if it cannot be removed. */
  remove(): boolean
  /** The node's state now, frozen. */
  snapshot(): NodeSnapshot | undefined
  readonly inputs: SlotCollection<InputSlotHandle>
  readonly outputs: SlotCollection<OutputSlotHandle>
  /**
   * Adds a badge until the disposer is called or undo rebuilds the node; not an edit. Under Vue nodes, a badge
   * added or removed after the node is first drawn shows or goes only when its badges are next recomputed (#24163).
   */
  addBadge(badge: BadgeDef | (() => BadgeDef)): Unsubscribe
}

/** `'never'` mutes the node and `'bypass'` passes its inputs through; the host's other modes read as `undefined`. */
export type NodeMode = 'always' | 'never' | 'bypass'

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

export interface Bounds extends Point, Size {}

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
  onClick?(): void
}

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

/** A group: a titled rectangle. Which nodes it holds follows from where they are. */
export interface GroupHandle {
  /** The group's id in its graph. */
  readonly id: string
  /**
   * True while the group is gone, and every other read is `undefined`. An undo or redo that brings the
   * group back may restore the handle, or may retire it; then take a fresh one from its graph.
   */
  readonly isDeleted: boolean
  getTitle(): string | undefined
  getColor(): string | undefined
  /** The group's rectangle in graph space, title bar included. */
  getBounds(): Bounds | undefined
  /** The nodes whose center is inside the group now, in the graph's order. */
  nodes(): readonly NodeHandle[] | undefined
  /**
   * Moves and resizes the group, as one undo step; the nodes inside do not move, and a size below the
   * editor's minimum group size is raised to it. `false` if the group is gone. Width and height are zero or more.
   */
  setBounds(bounds: Bounds): boolean
}

export type SlotSide = 'input' | 'output'

/** A slot id, else a slot name, else a position on the node. */
export type SlotRef = string | { readonly index: number }

export type SlotShape = 'default' | 'optional' | 'list' | 'directional'

export type SlotDirection = 'none' | 'up' | 'down' | 'left' | 'right' | 'center'

/** A slot type. Several names make a slot that accepts any of them. */
export type SlotType = string | readonly string[]

/**
 * What `modify` changes; a subgraph node's slots take no patch. A load gives a slot its type
 * makes its name, type, shape, localizedName, widget and place back, and brings a removed one back.
 */
export interface SlotPatch {
  /** A name no other slot on the node's side has, or `''`, which several may have. */
  readonly name?: string
  readonly label?: string | null
  readonly localizedName?: string | null
  /** An output's links take the new type; an input's link is kept. */
  readonly type?: SlotType
  /** The dot's color when the slot is connected; the canvas renderer draws it, Vue nodes not yet (#24161). */
  readonly color?: string | null
  /** The dot's color when the slot is not connected; as for `color` (#24161). */
  readonly colorWhenUnconnected?: string | null
  /** The canvas renderer draws each shape; Vue nodes draw `'directional'` as a circle until #24161 lands. */
  readonly shape?: SlotShape | null
  /** The slot's center relative to the node's body; not for a widget's socket. */
  readonly position?: Point | null
  /** The direction links leave the slot in, in either renderer; only the canvas renderer moves the label for it. */
  readonly direction?: SlotDirection | null
}

export interface InputSlotPatch extends SlotPatch {
  /** The node's widget this input is the socket of, which no other input may be; `null` for none, which also drops the position the widget gave it. */
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
  /**
   * Changes the fields `patch` names; not a subgraph node's. A taken name or a missing widget throws first.
   * `false`, changing nothing, while the document is shared with other participants.
   */
  modify(patch: InputSlotPatch): boolean
  disconnect(): boolean
}

export interface OutputSlotHandle extends SlotHandle {
  links(): readonly LinkInfo[] | undefined
  targets():
    | readonly { readonly nodeId: string; readonly inputIndex: number }[]
    | undefined
  /**
   * Changes the fields `patch` names; not a subgraph node's. A taken name throws first.
   * `false`, changing nothing, while the document is shared with other participants.
   */
  modify(patch: SlotPatch): boolean
  /**
   * Links this output to the input `input` names on the node with this id in this slot's graph.
   * `undefined` if either is gone or the host refuses the link, as for types that do not match.
   */
  connectTo(targetNodeId: string, input: SlotRef): LinkInfo | undefined
  /** Removes this output's links to the node with this id in this slot's graph, or all its links. */
  disconnect(targetNodeId?: string): boolean
  /**
   * Moves every link of this output to the output `target` names on this node, keeping the links' ids, and gives
   * the links moved. Their types are not checked again. `undefined` while the document is shared with other participants.
   */
  moveLinksTo(target: SlotRef): readonly LinkInfo[] | undefined
}

/** A node's inputs or outputs. Reads are `undefined` once the node is gone. */
export interface SlotCollection<THandle> {
  readonly length: number | undefined
  /** The slot at `index`. A negative index counts back from the end. */
  at(index: number): THandle | undefined
  all(): readonly THandle[] | undefined
  /** `undefined` too when more than one slot has the name. */
  byName(name: string): THandle | undefined
  byId(id: string): THandle | undefined
  names(): readonly string[] | undefined
  [Symbol.iterator](): Iterator<THandle>
  /** Adds a slot after the others; not to a subgraph node. `undefined` if the node is gone or its document is shared. */
  add(name: string, type: SlotType, options?: SlotOptions): THandle | undefined
  /**
   * Removes the slot `ref` names, and its links; not a subgraph node's. `false` if none does or the document is shared.
   * A name two slots share throws a `TypeError`: pass `{ index }` or the slot's id to pick one.
   */
  remove(ref: SlotRef): boolean
  /**
   * Puts the slots in the order `names` gives, with their links; names each slot once. Refused on a subgraph node's
   * outputs, and on its inputs while its subgraph is placed more than once; `false` in a shared document. A load restores a type's order.
   */
  reorder(names: readonly string[]): boolean
}

export interface DefRegistry {
  /** Replays `apply` for matching types and later registrations; hooks affect newly joined nodes until disposed.
   * Pass the `registerPack` result to scope these hooks and their saved fields to that pack. */
  extend(
    packId: PackId,
    selector: DefSelector,
    apply: (builder: NodeDefBuilder) => void
  ): Unsubscribe
  /**
   * Registers a node type the pack owns; its nodes are made with `properties.cnr_id` (and `ver`) of the pack, each
   * when a workflow can save it, and a workflow that saved any of them keeps its own. Unsubscribing unregisters it.
   */
  define(packId: PackId, definition: NodeDefinition): Unsubscribe
  /** A copy of a node type's definition, or `undefined` if there is none. */
  get(type: string): NodeDef | undefined
  has(type: string): boolean
  /** Every node definition, in the order its type first registered. */
  all(): readonly NodeDef[]
  /** Reloads the node definitions. Resolves `false` if the server refused them and nothing changed; rejects if fetching failed. */
  refresh(): Promise<boolean>
  /** Calls `listener` after each reload of the node definitions, whoever asked. */
  onRefreshed(listener: () => void): Unsubscribe
  /** The color links of a data type are drawn in, or `undefined` if nothing colors the type. */
  typeColor(type: string): string | undefined
  /**
   * Colors the links of a data type the palette leaves uncolored, such as one
   * the pack introduces. A type's newest color wins until it is unsubscribed.
   */
  setTypeColor(type: string, color: string): Unsubscribe
  /** The colors of an entry of the node color menu, such as `red`. */
  nodeColor(name: string): NodeColor | undefined
  isTypeCompatible(outputType: string, inputType: string): boolean
}

export interface NodeColor {
  readonly color: string
  readonly bgColor: string
  readonly groupColor: string
}

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
  readonly def: NodeDef
  /** A node of the type joined a graph. While a load is about to give it its saved state, an edit to it answers `false`. */
  onCreated(callback: (node: NodeHandle, event: NodeCreatedEvent) => void): void
  /**
   * A node took saved state: `data` is the saved node, with the fields legacy extensions saved on it and, over both,
   * this pack's own `onSerialize` fields; no other pack's. A node that had not joined a graph hears it on joining.
   */
  onConfigured(
    callback: (
      node: NodeHandle,
      data: Readonly<Record<string, unknown>>
    ) => void
  ): void
  /** A node is leaving its graph, removed or rebuilt by a load, undo or redo; its handle still reads it, unless a load of another document ended it. */
  onRemoved(callback: (node: NodeHandle) => void): void
  /** The server finished running a node. */
  onExecuted(
    callback: (node: NodeHandle, result: ExecutionResult) => void
  ): void
  /**
   * Saves fields under the pack's own entry of the node's `extensions` (a later hook wins); `onConfigured` gives them
   * back. Any field name is the pack's own; a result naming `extensions` is refused whole.
   */
  onSerialize(
    callback: (node: NodeHandle) => Readonly<Record<string, unknown>> | void
  ): void
  onResized(callback: (node: NodeHandle, size: Size) => void): void
  /** A link to or from one of a node's slots was made, removed, or restored with saved state. */
  onConnectionsChanged(
    callback: (node: NodeHandle, event: ConnectionChangeEvent) => void
  ): void
  /** A link is about to be made to or from a node. Returning `false` refuses it, as does a hook that removes or moves either end. */
  onBeforeConnect(
    callback: (node: NodeHandle, event: BeforeConnectEvent) => boolean | void
  ): void
  /** One of a node's properties was set, or restored from a saved workflow. */
  onPropertyChanged(
    callback: (node: NodeHandle, event: PropertyChangeEvent) => void
  ): void
  /** The pointer entered or left a node, in either renderer. */
  onHover(callback: (node: NodeHandle, hovering: boolean) => void): void
  /** A node was double-clicked in the canvas renderer, and under Vue nodes once #24162 lands; not on a widget or slot. */
  onDoubleClick(callback: (node: NodeHandle) => void): void
  /** A browser drag is over a node, in either renderer, not in app mode. Returning `true` marks the node as the drop target. */
  onDragOver(
    callback: (node: NodeHandle, event: DragEvent) => boolean | void
  ): void
  /**
   * A browser drop on a node, which the editor awaits; `true` claims it from the editor. Not asked if the type's own
   * handling claims it. Canvas asks the drop target; Vue nodes, any node dropped on; app mode, none.
   */
  onDrop(
    callback: (
      node: NodeHandle,
      event: DragEvent
    ) => boolean | void | Promise<boolean | void>
  ): void
  addMenuItem(item: NodeMenuItem): void
}

/** An entry of a node's context menu. It needs `run`, `items`, or both. */
export interface NodeMenuItem {
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
  readonly side: SlotSide
  /** The slot's index when the link changed. */
  readonly index: number
  /**
   * The slot's name, also when it was removed with its link. When the removed slot was linked to a
   * subgraph's input or output, the name may be stale.
   */
  readonly name: string
  readonly connected: boolean
  /** The node at the other end of the link; `undefined` for a subgraph's own input or output, which is no node. */
  readonly peerNodeId: string | undefined
  readonly peerIndex: number | undefined
}

export interface BeforeConnectEvent {
  /** Which of the node's own slots the link would use. */
  readonly side: SlotSide
  readonly index: number
}

export interface PropertyChangeEvent {
  readonly name: string
  /** A frozen copy of the new value, as a workflow would save it. */
  readonly value: unknown
  /** Stores a detached workflow-savable value; the last call wins, and a load keeps its restored value.
   * Throws `TypeError` for an unsavable value, a reserved pack property or a call after the hook returns. */
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
  readonly outputs?: readonly NodeDefinitionOutput[]
  /** `'frontend'`, the default, leaves the node out of the prompt; `'backend'` sends it as its type. */
  readonly execution?: 'backend' | 'frontend'
  readonly presentation?: NodePresentation
  onCreated?(node: NodeHandle, event: NodeCreatedEvent): void
  /** `data` is the saved node with this pack's own fields, as `NodeDefBuilder.onConfigured` gives it. */
  onConfigured?(node: NodeHandle, data: Readonly<Record<string, unknown>>): void
  onRemoved?(node: NodeHandle): void
  /** Saves fields under the pack's entry, as `NodeDefBuilder.onSerialize` does. */
  onSerialize?(node: NodeHandle): Readonly<Record<string, unknown>> | void
  onConnectionsChanged?(node: NodeHandle, event: ConnectionChangeEvent): void
  onPropertyChanged?(node: NodeHandle, event: PropertyChangeEvent): void
}

export interface NodeDefinitionSlot {
  readonly name: string
  readonly type: string
}

export interface NodeDefinitionOutput extends NodeDefinitionSlot {
  /** How the host draws the output's dot; `'default'` is its own choice. A load keeps it. */
  readonly shape?: SlotShape
}

/** How the host draws a defined type's nodes, in both renderers. Any other field is refused. */
export interface NodePresentation {
  /** `'hidden'` draws the nodes without a title bar. */
  readonly title?: 'default' | 'hidden'
  /**
   * `false` stops the user resizing the nodes; pinning stops it too. Unpinning a node makes it
   * resizable again, as the host does, and a load or undo sets it back to `false`.
   */
  readonly resizable?: boolean
  /** `false` stops the user collapsing the nodes. `setCollapsed` can still collapse one. */
  readonly collapsible?: boolean
}
