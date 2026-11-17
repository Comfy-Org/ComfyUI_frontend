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
   * True if `a` and `b` are the same node, group, slot, widget or graph-scope handle; `false` for anything else.
   * There is one such handle per entity, so `a === b` gives the same answer for two of them.
   */
  sameEntity(a: unknown, b: unknown): boolean
  readonly defs: DefRegistry
  /**
   * A node's title, mode or color was set by the user or a pack, in the graphs `options.scope` names. A load, undo or
   * redo is not reported, except each saved mode or color unlike a new node's; re-read nodes in `onWorkflowLoaded`.
   */
  onNodeChanged(
    listener: (event: NodeChangeEvent) => void,
    options?: NodeChangeOptions
  ): Unsubscribe
  /**
   * A node was moved, under either renderer. A pack sees its own moves too, and a load, undo or redo reports each
   * node it places, first at its saved x and y 10, then at its saved position.
   */
  onNodeMoved(listener: (event: NodeMoveEvent) => void): Unsubscribe
  /** A drag of nodes or other canvas items ended. */
  onNodeDragEnd(listener: () => void): Unsubscribe
  /** True while the user drags a link, resizes a node or drags a widget. */
  isInteracting(): boolean
  /**
   * The view on the graph panned or zoomed. Hiding the canvas menu or entering builder mode after the first
   * listener subscribed silences it until every listener has left and one subscribes again.
   */
  onViewportChanged(listener: () => void): Unsubscribe
  /** The nodes selected in the graph on screen changed. Passes them in the graph's order. */
  onSelectionChanged(
    listener: (nodes: readonly NodeHandle[]) => void
  ): Unsubscribe
  /** The node the backend is running, in the open document, or `undefined`. */
  executingNode(): NodeHandle | undefined
  /** The node a backend execution id such as `'12:5'` names in the open document. */
  executionNode(id: string): NodeHandle | undefined
  /** Fires when `executingNode()` changes, including to `undefined`. */
  onExecutingNodeChanged(
    listener: (node: NodeHandle | undefined) => void
  ): Unsubscribe
  /**
   * Fires after every workflow load, undo and redo, with the open document. After a load, a listener's edit is the
   * first undo step; after an undo or redo, it is part of the restored state and keeps redo.
   */
  onWorkflowLoaded(
    listener: (document: DocumentHandle | undefined) => void
  ): Unsubscribe
  /** An open document became the one on screen. */
  onDocumentActivated(listener: (document: DocumentHandle) => void): Unsubscribe
  /**
   * An open document was closed, or replaced when the host reloaded its changed file. Its handle reports
   * `isDeleted` from then on; a reloaded file opens as a new document.
   */
  onDocumentClosed(listener: (document: DocumentHandle) => void): Unsubscribe
  /** The open documents, opening a workflow, and files the host cannot read. */
  readonly workflow: WorkflowHandle
  /** Running the workflow, and hearing runs start, finish and fail. */
  readonly queue: QueueHandle
  /** Declaring, reading, writing and watching settings. */
  readonly settings: SettingsHandle
  /** Text the pack keeps in the current user's data on the server. */
  readonly storage: StorageHandle
  /** Commands, their default keys, and notifications. */
  readonly commands: CommandsHandle
  /** Calls to the backend and the messages it sends. */
  readonly backend: BackendHandle
  /** The model files the backend lists. */
  readonly models: ModelsHandle
  /** What a pack adds to the app around the graph. */
  readonly ui: UiHandle
  /** Translations a pack adds to the app's messages. */
  readonly localization: LocalizationHandle
  /** The machine the backend runs on. */
  readonly system: SystemHandle
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
   * handle applies, every undo, redo and load, and some of the editor's own changes. It stays the same while none of
   * these happens, and never goes back to a value it has left.
   */
  readonly version: number | undefined
  /** The selected nodes of the graph on screen, in the graph's order. */
  selection(): readonly NodeHandle[]
  /** The selected groups of the graph on screen, in the graph's draw order. */
  groupSelection(): readonly GroupHandle[]
  /**
   * Selects exactly these nodes; an empty list clears the selection. `false`,
   * and nothing changes, if one is gone or not on screen.
   */
  select(nodes: readonly NodeHandle[]): boolean
  /** Pans the view so the node is in its middle; `false` if it is gone or not on screen. */
  centerOn(node: NodeHandle): boolean
  /** Where the pointer last was over the canvas, in graph space, or `undefined` before there is a canvas. */
  pointerPosition(): Point | undefined
  /** Zooms the view about its center; 1 is unzoomed. Clamped to the zoom the canvas allows. */
  setZoom(scale: number): void
  /** Pans the view by `delta` screen pixels, the same at every zoom. */
  panBy(delta: Point): void

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
  /** The supplies a prompt would use in the graph on screen, by the inputs they feed in the graph's order; none before there is one. */
  resolvedSupplies(): readonly ResolvedSupply[]
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
  /**
   * The supplies a prompt would use in this graph, by the inputs they feed in the graph's order.
   * `undefined` while there is no such graph.
   */
  resolvedSupplies(): readonly ResolvedSupply[] | undefined
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
 * Each change is one undo step, or part of `graph.batch`'s; after an undo or redo, until the user's next action, the next undo or redo, or one second after the restore, whichever comes first, it joins the restored state.
 * A change is `false` once the node is gone, and an unusable argument throws first. A node whose type is not installed saves only its mode and position.
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
  /** The node's widgets. */
  readonly widgets: WidgetCollection
  /** The node's rectangle on the page; `undefined` when its graph is not on screen. */
  getScreenRect(): Bounds | undefined
  /** Where a slot sits, in graph space; `undefined` if the node has no slot there. */
  getSlotPosition(side: SlotSide, index: number): Point | undefined

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
  /** Pans the view so the group is in its middle; `false` if it is gone or not on screen. */
  centerOn(): boolean
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
  /**
   * Makes every input of `type` a widget `def` renders. A type the host or a
   * pack already defines throws a `TypeError`. The disposer removes it.
   */
  defineWidgetType(type: string, def: WidgetTypeDef): Unsubscribe
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
  /**
   * A node is leaving its graph: removed, rebuilt by a load, undo or redo of its document, or its tab closed; its handle still reads it unless its tab is not on screen.
   * Opening another document leaves the nodes of the one before in its tab: they hear this when that tab closes.
   */
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
  /** Adds the widget `def` describes to each node of the type as it is made. */
  addWidget(def: WidgetDef): void
  /** Hides the widget named `name` on each node of the type as it is made. */
  hideWidget(name: string): void
  /**
   * Feeds inputs that no link feeds, of the nodes of a node's graph, when a prompt is built.
   * One that throws or answers wrongly is reported and feeds nothing.
   */
  setSupply(supply: Supplier): void
  /**
   * Leaves inputs out of a node's entry in each prompt built; the saved workflow keeps them.
   * One that throws or answers wrongly is reported and leaves nothing out.
   */
  onPromptSerialize(
    callback: (node: NodeHandle) => PromptInputProjection | void
  ): void
  /** The server sent a preview image while running a node. */
  onPreview(callback: (node: NodeHandle, frame: PreviewFrame) => void): void
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
  /** Widgets each node of the type gets as it is made, after its inputs. Saved only with `setSerializeWidgets(true)`. */
  readonly widgets?: readonly WidgetDef[]
  /**
   * With `execution: 'frontend'`, says what each output stands for when a prompt is built.
   * One that throws or answers wrongly is reported, and the node is built as if it had none.
   */
  readonly resolve?: Resolver
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

/** A widget's value, as the workflow saves it. */
export type WidgetValue = string | number | boolean | object | null

/**
 * A node's widgets, in the order the node shows them. On a deleted node every
 * read is `undefined` and every change does nothing and returns `false` or `undefined`.
 */
export interface WidgetCollection extends Iterable<WidgetHandle> {
  readonly length: number | undefined
  get(name: string): WidgetHandle | undefined
  /** The widget at `index`. A negative index counts back from the end. */
  at(index: number): WidgetHandle | undefined
  all(): readonly WidgetHandle[] | undefined
  names(): readonly string[] | undefined
  /** Adds a widget after the others. A name the node already has throws a `TypeError`. */
  add(def: WidgetDef): WidgetHandle | undefined
  /** Removes the widget. `false` if the node has none by that name. */
  remove(name: string): boolean
  /** Puts the widgets in this order. `names` names every widget once. `false` if the node is gone. */
  reorder(names: readonly string[]): boolean
  /**
   * Moves one widget to `index`, clamped to the end of the list; a negative index throws.
   * `false` if the node has no widget by that name.
   */
  move(name: string, index: number): boolean
  /** Adds a widget whose element the pack fills. A name the node already has throws a `TypeError`. */
  mount(def: MountDef): WidgetHandle | undefined
  /** Adds a widget the pack draws on its own canvas. A name the node already has throws a `TypeError`. */
  canvas(def: CanvasDef): CanvasHandle | undefined
}

/**
 * One widget, named by its node and its name. On a deleted widget every read
 * is `undefined` and every change does nothing and returns `false`.
 */
export interface WidgetHandle {
  readonly name: string
  /** True while the node has no widget by this name. */
  readonly isDeleted: boolean
  /** The widget's type, e.g. `number` or `combo`. */
  readonly widgetType: string | undefined

  /** A frozen copy of the value. `undefined` too if the workflow cannot save it. */
  getValue(): WidgetValue | undefined
  /** Commits a value as a user's edit does: the widget's callbacks run, and it is one undo step. */
  setValue(value: WidgetValue): boolean
  /** A frozen copy of the options. An option that is a function is left out. */
  getOptions(): Readonly<WidgetOptions> | undefined
  setOption(key: string, value: WidgetValue): boolean
  setLabel(label: string): boolean
  isHidden(): boolean | undefined
  /** Hides or shows the widget and every widget linked to it. */
  setHidden(hidden: boolean): boolean
  isDisabled(): boolean | undefined
  setDisabled(disabled: boolean): boolean
  /** False if the widget is kept out of its node's saved values; a node saves none unless `isSerializingWidgets()`. */
  isSerialized(): boolean | undefined
  /**
   * Fixes the height the widget takes on its node, in graph units (under Vue nodes, at least that), and grows the
   * node to fit; the widget no longer shares the node's free height.
   */
  setHeight(height: number): boolean
  /** The widgets linked to this one, such as a seed's control. */
  linked(): readonly WidgetHandle[] | undefined
  /** Links these widgets of the same node to this one, in place of any linked before. */
  setLinked(names: readonly string[]): boolean

  /**
   * Runs after a commit leaves a value other than the last commit's, with copies of both. Not while a workflow
   * loads or an undo or redo restores it, the restore's `onWorkflowLoaded` listeners included.
   */
  on(
    event: 'change',
    listener: (
      value: WidgetValue | undefined,
      previous: WidgetValue | undefined
    ) => void
  ): Unsubscribe
  /**
   * Runs after each commit not made by `setValue`, such as a click on a button, and not while a workflow loads.
   * On a DOM widget (a mount, canvas, declared type or text area) the host's commit runs it twice.
   */
  on(
    event: 'activate',
    listener: (value: WidgetValue | undefined) => void
  ): Unsubscribe
  /** Runs once when the widget is removed from its node; for a mount, canvas or declared type also when the node is deleted. */
  on(event: 'removed', listener: () => void): Unsubscribe
  /** Runs each time a prompt is built (queueing, Export, Export (API), sharing), to send another value in that prompt only. */
  on(
    event: 'beforeSerialize',
    listener: (event: WidgetSerializeEvent) => void
  ): Unsubscribe
}

/** A widget's value about to be sent in a prompt the app builds. */
export interface WidgetSerializeEvent {
  /** Where the value goes: a prompt, whether queued or exported. The saved workflow cannot be changed. */
  readonly context: 'prompt'
  /** A copy of what is sent unless a listener replaces it. */
  readonly value: WidgetValue | undefined
  /** Sends `value` in its place. Called during the listener; the last call wins. */
  setSerializedValue(value: WidgetValue): void
}

/** What a widget is created from. */
export interface WidgetDef {
  readonly type: string
  /** May be empty; the Vue canvas does not show a widget with an empty name. */
  readonly name: string
  readonly value?: WidgetValue
  readonly options?: WidgetOptions
  /** `false` keeps the value out of the saved workflow. `options.serialize` decides the prompt. */
  readonly serialize?: boolean
  readonly disabled?: boolean
  readonly hidden?: boolean
}

/** Options the host's widgets read. A widget type may read others. */
export interface WidgetOptions {
  readonly [key: string]: unknown
  /** A combo's choices: a list, or a function (called with no arguments) or getter returning one, read each time. */
  readonly values?: unknown
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly step2?: number
  readonly precision?: number
  readonly multiline?: boolean
  readonly placeholder?: string
  readonly read_only?: boolean
  readonly on?: string
  readonly off?: string
  /** `false` keeps the value out of the prompt. */
  readonly serialize?: boolean
  readonly property?: string
  readonly socketless?: boolean
  readonly canvasOnly?: boolean
  readonly hideInPanel?: boolean
  readonly hidden?: boolean
  readonly disabled?: boolean
  readonly nodeType?: string
  readonly iconClass?: string
  readonly useGrouping?: boolean
  readonly showThumbnails?: boolean
  readonly showItemNavigators?: boolean
}

/** What a mounted or canvas widget holds. `null` is held as `''`, as the host holds a missing value. */
export type MountedData = WidgetValue

/** A widget whose element the pack fills with its own tools. */
export interface MountDef {
  readonly name: string
  /** Called once, with the element mounted on the node. A throw is reported. */
  render(container: HTMLElement, value: MountedValue): void
  /**
   * Called once when the host releases the widget, which relies on the host fix #23520 in `main`
   * (#23476: before it, a widget removed before its node had it called again). A throw is reported.
   */
  destroy?(): void
  /** The height the widget takes on its node, in graph units (under Vue nodes, at least that); omit to share the free space. */
  readonly height?: number
  /** Defaults to `true`: a placeholder is drawn instead at low zoom. */
  readonly hideOnZoom?: boolean
  /** Whether the value is saved in the workflow. Defaults to whether `defaultValue` is given. */
  readonly serialize?: boolean
  /** Whether the value is sent in the prompt. Defaults to `serialize`. */
  readonly sendToPrompt?: boolean
  /** The value before one is set or loaded. */
  readonly defaultValue?: MountedData
}

/** The value a mounted widget holds. Once the widget is off its node, `get` is `undefined` and `set` is `false`. */
export interface MountedValue {
  /** A frozen copy of the value. */
  get(): MountedData | undefined
  /** Commits a value as `WidgetHandle.setValue` does, to this widget only, not one added later under its name. */
  set(value: MountedData): boolean
  /** Runs when the value changes other than through `set`, as when a workflow loads. */
  onChange(listener: (value: MountedData | undefined) => void): Unsubscribe
}

/** A widget the pack draws on a canvas element of its own. */
export interface CanvasDef {
  readonly name: string
  /**
   * Draws the widget, in CSS pixels. Called when the widget is mounted, when
   * its element is resized, on `redraw()`, and when its value changes.
   */
  draw(
    context: CanvasRenderingContext2D,
    size: readonly [width: number, height: number],
    theme: CanvasTheme,
    value: MountedValue | undefined
  ): void
  /** The primary button went down. The node underneath does not see it. */
  onPointerDown?(event: CanvasPointerEvent): void
  /** The pointer moved, during a drag or not. */
  onPointerMove?(event: CanvasPointerEvent): void
  onPointerUp?(event: CanvasPointerEvent): void
  /** As for `MountDef`: the canvas's height on its node, in graph units. */
  readonly height?: number
  /** As for `MountDef`. `draw` receives the value only when this is given. */
  readonly defaultValue?: MountedData
  readonly serialize?: boolean
  readonly sendToPrompt?: boolean
}

export interface CanvasHandle {
  readonly widget: WidgetHandle
  /** Draws the canvas again now. Does nothing before it is mounted or after it is released. */
  redraw(): void
}

/** A pointer event on a canvas widget, at the position `draw` uses. */
export interface CanvasPointerEvent {
  readonly x: number
  readonly y: number
  readonly event: PointerEvent
}

/** The theme's colors for a canvas widget, read again for every draw. */
export interface CanvasTheme {
  readonly surface: string
  readonly surfaceHovered: string
  readonly border: string
  readonly text: string
  readonly textSecondary: string
}

/** How every input of a declared widget type is shown. */
export interface WidgetTypeDef {
  /**
   * Fills the widget's element for the input named `name`. Return a teardown
   * to run once when the host releases the widget (as `MountDef.destroy`, #23520). A throw is reported.
   */
  render(
    container: HTMLElement,
    value: WidgetTypeValue,
    name: string,
    context: WidgetTypeContext
  ): Unsubscribe | void
  /** Used when the input's declaration gives no default it can hold. */
  readonly defaultValue?: MountedData
  /** As for `MountDef`: the widget's height on its node, in graph units. */
  readonly height?: number
  /** The least height the node gives the widget, in graph units. */
  readonly minHeight?: number
  /** Defaults to `true`: the value is saved and sent. */
  readonly serialize?: boolean
}

/** The value a declared widget holds. */
export type WidgetTypeValue = MountedValue

export interface WidgetTypeContext {
  /** A frozen copy of the options the input was declared with. `undefined` if they cannot be saved. */
  getOptions(): Readonly<Record<string, unknown>> | undefined
}

/** Which graphs `onNodeChanged` hears: the graph on screen by default. */
export interface NodeChangeOptions {
  readonly scope?: NodeQueryScope
}

/** `to` is what the node's matching read returns after the change. */
export type NodeChangeEvent =
  | NodeChangeOf<'title' | 'color' | 'bgColor', string>
  | NodeChangeOf<'mode', NodeMode>

interface NodeChangeOf<TProperty extends string, TValue> {
  readonly node: NodeHandle
  /** The id of the graph the node is in. */
  readonly graphId: string
  readonly property: TProperty
  readonly to: TValue | undefined
}

export interface NodeMoveEvent {
  readonly node: NodeHandle
  /** The node's new top-left corner, in graph space. */
  readonly position: Point
}

/** One open workflow: an editing session, from opening it until closing it. */
export interface DocumentHandle {
  /**
   * The same through undo, redo and tab switches; a reopened workflow, or one
   * reloaded from disk, gets a new one. It means nothing after a page reload, so do not save it.
   */
  readonly id: string
  /** True once the document is closed, and every other read is `undefined`. */
  readonly isDeleted: boolean
  /** The file name, without its directory or extension. */
  readonly name: string | undefined
  /** Where the workflow is saved, or `undefined` while it has never been saved. */
  readonly path: string | undefined
}

/** Parsed ComfyUI workflow JSON. */
export type WorkflowData = Readonly<Record<string, unknown>>

/** An argument a member cannot use throws a `TypeError`. */
export interface WorkflowHandle {
  /** The open document on screen, or `undefined` before there is one. */
  current(): DocumentHandle | undefined
  /** The id of `current()`. */
  documentId(): string | undefined
  /** A frozen copy of the open document's workflow, as it would be saved. */
  snapshot(): WorkflowData | undefined
  /**
   * Opens `data` as a new document on screen, leaving the one before open in its tab; the graph gets a new id if another open document holds `data.id`.
   * Resolves `false` if it is not a workflow or the host did not load it. Data that is not an object throws a `TypeError`.
   */
  open(data: WorkflowData): Promise<boolean>
  /** `value` with `%date:…%` and `%Node.widget%` expanded in the open document. */
  applyTextReplacements(value: string): string | undefined
  /** Asks `importer` for a workflow when a file the host cannot read is opened or dropped. */
  registerImporter(importer: WorkflowImporter): Unsubscribe
  /** A frozen copy of `key` in the `extra` the document's workflow saves; `undefined` if absent or closed. */
  getExtra(document: DocumentHandle | undefined, key: string): unknown
  /**
   * Writes `key` in the on-screen document's `extra` as one undo step; `undefined` deletes it. False for any
   * other document, and while a graph loads or an undo or redo restores it, the restore's `onWorkflowLoaded` included.
   * The keys are one namespace with the editor's own and every pack's, so prefix yours.
   */
  setExtra(
    document: DocumentHandle | undefined,
    key: string,
    value: unknown
  ): boolean
}

export interface WorkflowImportContext {
  readonly name: string
  /** The MIME type the browser gives the file, or `''`. */
  readonly type: string
}

export type WorkflowImportResult =
  | { readonly workflow: WorkflowData | string }
  | { readonly prompt: WorkflowData | string }

/** Reads a workflow or prompt from a file the host cannot read itself. */
export interface WorkflowImporter {
  /** Names the importer in error reports; no two importers share one. */
  readonly id: string
  /** Offered files of these MIME types or extensions; every file when neither is given. */
  readonly mimeTypes?: readonly string[]
  readonly extensions?: readonly string[]
  /** Files larger than this are not offered. */
  readonly maxBytes: number
  enabled?(): boolean | Promise<boolean>
  /** Returns nothing to decline the file. A throw is reported and the next importer is asked. */
  parse(
    bytes: Uint8Array,
    context: WorkflowImportContext
  ):
    | WorkflowImportResult
    | null
    | undefined
    | Promise<WorkflowImportResult | null | undefined>
}

export interface RunOptions {
  /** Run only these nodes and what feeds them: live handles of the open document, at least one. */
  readonly nodes?: readonly NodeHandle[]
}

export interface RunSubmission {
  readonly promptId: string
  /** How many backend nodes the prompt holds; a partial run executes only those its targets need. */
  readonly nodeCount: number
}

export interface RunSubmittedEvent {
  /** The prompts the backend accepted, in the order they were sent. */
  readonly promptIds: readonly string[]
  readonly submissions: readonly RunSubmission[]
}

/** An argument a member cannot use throws a `TypeError`. */
export interface QueueHandle {
  /**
   * Queues the workflow as Run does: `true` once this call's prompts are submitted, and when a request fails with
   * no answer from the backend. `false` if a node it names is gone, or the call was folded into a run, refused, given node errors or stopped.
   * Rejects, as Run does, when the prompt cannot be built (a widget's own `serializeValue` throws).
   */
  run(options?: RunOptions): Promise<boolean>
  /** Called as each run starts, before its prompt is built. A function it returns is called once that run is sent or refused. */
  onBeforeRun(listener: () => (() => void) | void): Unsubscribe
  /** Once for each run the backend accepted a prompt from. A run whose every prompt was refused fires only `onRejected`. */
  onAfterRun(listener: (event: RunSubmittedEvent) => void): Unsubscribe
  /** The backend refused a prompt. */
  onRejected(listener: () => void): Unsubscribe
  /** How many prompts are waiting or running, as the backend last said. */
  pending(): number
  onPendingChanged(listener: (pending: number) => void): Unsubscribe
  /** Cancels the prompt that is running. The rest of the queue stays. */
  interrupt(): Promise<void>
  /** A run was interrupted, by anyone. */
  onInterrupted(listener: () => void): Unsubscribe
  /** Turns automatic queuing off, and leaves the run in progress alone. */
  disableAutoQueue(): void
}

/** Answers, by output index or name, what the outputs it names stand for. Must not change the graph. */
export type Resolver = (
  view: ResolveView
) => Readonly<Record<string, OutputResolution>>

/** What a resolver sees: its node, and the other nodes of its graph. */
export interface ResolveView {
  readonly self: ResolvedNodeView
  /** The nodes of `type` in the resolved node's own graph, in the graph's order. */
  nodesOfType(type: string): readonly ResolvedNodeView[]
}

/** An output left out of the prompt, standing for whatever feeds an input, or a value. */
export type OutputResolution =
  | { readonly omit: true }
  | { readonly forwardTo: InputRef }
  | { readonly literal: WidgetValue }

/** An input of a node in the same graph as the node that names it. */
export interface InputRef {
  readonly nodeId: string
  readonly input: number
}

/** A frozen view of a node while a prompt is built. Its properties, groups, inputs and outputs are read when first asked for. */
export interface ResolvedNodeView {
  readonly id: string
  readonly type: string
  /** `undefined` for a mode that has no name here. */
  readonly mode: NodeMode | undefined
  readonly color: string | undefined
  /** A copy of the node's saved properties. */
  readonly properties: Readonly<Record<string, unknown>>
  /** The groups that hold the node's center, in draw order. */
  readonly groups: readonly GroupMembership[]
  readonly inputs: readonly OwnInput[]
  readonly outputs: readonly OwnOutput[]
  /** A copy of the value of the node's widget with this name; `undefined` if it has none or it cannot be saved. */
  widgetValue(name: string): WidgetValue | undefined
  /** The input at this index, or the first with this name; `undefined` if there is none. */
  input(ref: string | number): InputRef | undefined
}

export interface OwnInput {
  readonly index: number
  readonly name: string
  /** The name the editor shows: the label, else the localized name, else the name. */
  readonly label: string
  /** The type the link into the input carries; `undefined` with no link. */
  readonly connectedType: string | undefined
  /** The node the link comes from; in a subgraph, the subgraph's input node for its own input. */
  readonly sourceNodeId: string | undefined
}

export interface OwnOutput {
  readonly index: number
  readonly name: string
  /** The name the editor shows: the label, else the localized name, else the name. */
  readonly label: string
  readonly type: string
}

export interface GroupMembership {
  readonly id: string
  readonly title: string
}

/** Names the inputs a node feeds, and from what. Not asked for a muted or bypassed node. Must not change the graph. */
export type Supplier = (view: SupplyView) => readonly SuppliedEdge[]

export interface SupplyView {
  readonly self: ResolvedNodeView
  /** Every input of the node's graph that no link feeds, of nodes other than frontend and subgraph nodes, in the graph's order. */
  unconnectedInputs(): readonly UnconnectedInput[]
}

/** An input that no link feeds, and its node. */
export interface UnconnectedInput {
  readonly nodeId: string
  readonly nodeType: string
  readonly nodeTitle: string
  /** `undefined` for a mode that has no name here. */
  readonly nodeMode: NodeMode | undefined
  readonly nodeColor: string | undefined
  /** The groups that hold the node's center, in draw order. */
  readonly nodeGroups: readonly GroupMembership[]
  /** A copy of the node's saved properties. */
  readonly nodeProperties: Readonly<Record<string, unknown>>
  /** The input's index on its node. */
  readonly input: number
  readonly name: string
  /** The name the editor shows: the label, else the localized name, else the name. */
  readonly label: string
  readonly type: string
  /** True for the socket form of a widget. */
  readonly isWidgetInput: boolean
}

/** An input a supplier feeds, from one of its own outputs or from whatever feeds one of its own inputs. */
export interface SuppliedEdge {
  /** One of `unconnectedInputs()`. */
  readonly to: InputRef
  readonly from: { readonly output: number } | { readonly forwardInput: number }
  /** The highest claim on an input feeds it, and equal highest claims feed nothing. Defaults to 0. */
  readonly priority?: number
}

/** The claim that feeds an input, with its source in the graph. */
export interface ResolvedSupply {
  readonly supplierNodeId: string
  readonly to: InputRef
  readonly from: ResolvedSource
}

/** Where a supply comes from in its own graph, once resolved frontend nodes are followed. */
export type ResolvedSource =
  | {
      readonly kind: 'output'
      readonly nodeId: string
      readonly output: number
    }
  | { readonly kind: 'literal' }
  | { readonly kind: 'omitted' }

export interface PromptInputProjection {
  /** Names of the node's inputs and widgets, as the prompt names them. */
  readonly omitInputs: readonly string[]
}

export interface PreviewFrame {
  readonly blob: Blob
}

/** A setting's value as the settings file holds it. A value read is a frozen copy. */
export type SettingValue =
  | string
  | number
  | boolean
  | null
  | readonly SettingValue[]
  | { readonly [key: string]: SettingValue }

/** Core's settings and the pack's own. */
export interface SettingsHandle {
  /**
   * Adds a setting to the settings panel for the life of the page. A value the
   * user stored under its id is kept. An id already declared throws.
   */
  declare(setting: SettingDef): void
  /** The value, else the default; `undefined` for an undeclared id holding nothing. */
  get(id: string): SettingValue | undefined
  /**
   * Applies `value` at once. Rejects if the server cannot be reached; resolves once it answers,
   * even if it refused to save the value.
   */
  set(id: string, value: SettingValue): Promise<void>
  /** Calls `listener` after a declared setting's value changes, and when it is declared. */
  onChange(
    id: string,
    listener: (
      value: SettingValue | undefined,
      previous: SettingValue | undefined
    ) => void
  ): Unsubscribe
}

/** The control the settings panel shows. */
export type SettingType =
  | 'boolean'
  | 'number'
  | 'slider'
  | 'combo'
  | 'text'
  | 'color'

export interface SettingDef {
  /** Shared with core and every pack, and the key the value is saved under: `MyPack.size`. */
  readonly id: string
  readonly name: string
  readonly type: SettingType
  /** A boolean; a number for `number` and `slider`; a string, or a number for `combo`. */
  readonly defaultValue: string | number | boolean
  readonly tooltip?: string
  /** Where the panel lists the setting. Defaults to the id split on dots. */
  readonly category?: readonly string[]
  /** The choices of a `combo`. */
  readonly options?: readonly SettingOption[]
  /** The range of a `number` or `slider`. */
  readonly attrs?: SettingAttrs
  /** Called with copies after the value changes, and once when the setting is declared. */
  readonly onChange?: (
    value: SettingValue | undefined,
    previous: SettingValue | undefined
  ) => void
}

/** A choice saved and shown as one string, or a saved value with its label. */
export type SettingOption =
  | string
  | { readonly value: string | number; readonly label: string }

export interface SettingAttrs {
  readonly min?: number
  readonly max?: number
  readonly step?: number
}

/** A name is a relative path such as `MyPack/presets.json`: no empty, `.` or `..` segment. */
export interface StorageHandle {
  /** `ok` is false when the server could not be read; `text` is `undefined` when nothing is stored. */
  get(name: string): Promise<StoredText>
  /** Stores `text` under `name`, replacing what was there. `false` if the server did not store it. */
  set(name: string, text: string): Promise<boolean>
  /** `true` once nothing is stored under `name`; `false` if the server did not remove it. */
  remove(name: string): Promise<boolean>
  /** Every name stored under `folder`, as `get` takes it; `undefined` if the server could not list them. */
  list(folder: string): Promise<readonly string[] | undefined>
}

export type StoredText =
  | { readonly ok: true; readonly text: string | undefined }
  | { readonly ok: false }

export interface CommandsHandle {
  /**
   * Adds a command for the life of the page. An id already registered throws.
   * `false` if another command holds the key by default; the command is added without it.
   */
  register(command: CommandDef): boolean
  /** Runs a command by id. Resolves `false` if no command has that id. */
  run(id: string): Promise<boolean>
  /** Shows a toast. */
  notify(notification: NotifyDef): void
}

export interface CommandDef {
  /** Shared with core and every pack: `MyPack.doTheThing`. */
  readonly id: string
  /** A function is called each time the host shows the label; one that throws or gives no string shows the id. */
  readonly label: string | (() => string)
  /** The host shows a failure to the user, as for any command. */
  readonly run: () => void | Promise<void>
  /** The default key. A key the user binds to the command wins. */
  readonly keybinding?: KeyCombo
  /** `'canvas'` limits the key to the graph, so typing in a field does not run it. */
  readonly scope?: 'canvas'
}

/** `meta`, Cmd on macOS, is the same key to the host as `ctrl`. */
export interface KeyCombo {
  readonly key: string
  readonly ctrl?: boolean
  readonly alt?: boolean
  readonly shift?: boolean
  readonly meta?: boolean
}

export interface NotifyDef {
  /** Defaults to `'info'`. */
  readonly severity?: 'success' | 'info' | 'warn' | 'error'
  readonly summary: string
  readonly detail?: string
  /** Milliseconds before it closes. Omitted, it stays until the user closes it. */
  readonly life?: number
}

/** A route starts with exactly one `/`. */
export interface BackendHandle {
  /** The URL of an API route, such as `/view?filename=a.png`, under the host's base path. */
  url(route: string): string
  /** The URL of a file the server serves outside its API, such as `/extensions/MyPack/icon.png`. */
  assetUrl(route: string): string
  /**
   * Calls an API route with the host's credentials. Resolves with the response
   * whatever its status, and rejects as `fetch` does when the server cannot be reached.
   */
  fetch(route: string, init?: RequestInit): Promise<Response>
  /** Calls `listener` with a frozen copy of each payload the backend sends as `event`. */
  on(event: string, listener: (detail: unknown) => void): Unsubscribe
}

export interface ModelsHandle {
  /**
   * The model names in a folder such as `loras`, each once, in the backend's order.
   * An unknown folder lists none; `undefined` if the server could not list them.
   */
  list(folder: string): Promise<readonly string[] | undefined>
}

/** The pack renders a contribution's content into the element it is given. */
export interface UiHandle {
  /** Adds a tab to the sidebar until the returned function removes it. An id already there throws. */
  addSidebarTab(tab: SidebarTabDef): Unsubscribe
  /** Shows a readout in the top bar until `remove()`. An id already shown throws. */
  addTopBarBadge(badge: BadgeContribution): ChromeItemHandle<BadgeContribution>
  /** Adds a button to the action bar until `remove()`. An id already shown throws. */
  addActionBarButton(
    button: ButtonContribution
  ): ChromeItemHandle<ButtonContribution>
  /** Opens a dialog, or raises the one already open under `key`. */
  showDialog(dialog: DialogDef): DialogHandle
  /** Shows a menu at the pointer. It closes when an item is chosen or the user clicks away. */
  showMenu(menu: MenuDef): void
  /** Asks the user for text. Resolves `undefined` if they cancel. */
  prompt(prompt: PromptDef): Promise<string | undefined>
  /** Mounts a panel over the graph view. `undefined` before the app has a graph view. */
  mountViewportPanel(panel: ViewportPanelDef): ViewportPanelHandle | undefined
}

export interface SidebarTabDef {
  /** Unique across core and every pack: `MyPack.assets`. */
  readonly id: string
  readonly title: string
  /** An icon class, such as `icon-[lucide--activity]`. */
  readonly icon?: string
  readonly tooltip?: string
  /** Fills the tab's panel each time the tab is shown. */
  render(container: HTMLElement): void
  /** Called when the panel is taken down, once after each `render`. */
  destroy?(): void
}

export interface BadgeContribution {
  /** Unique among badges: `MyPack.monitor`. */
  readonly id: string
  readonly text: string
  readonly label?: string
  readonly variant?: 'info' | 'warning' | 'error'
  readonly tooltip?: string
}

export interface ButtonContribution {
  /** Unique among buttons: `MyPack.open`. */
  readonly id: string
  /** An icon class, such as `icon-[lucide--camera]`. */
  readonly icon: string
  readonly label?: string
  readonly tooltip?: string
  /** Called on a click, with the click's event. */
  run(event?: MouseEvent): void
}

/** What a pack keeps of a badge or button it added. */
export interface ChromeItemHandle<T> {
  /** Replaces the fields given. `false` once removed, and nothing changes. */
  update(changes: Partial<Omit<T, 'id'>>): boolean
  /** Takes the item away. Safe to call more than once. */
  remove(): void
}

export interface DialogDef {
  /** Names the dialog among those packs open: `MyPack.settings`. */
  readonly key: string
  readonly title?: string
  /** Fills the dialog when it opens. */
  render(container: HTMLElement): void
  /** Called when the dialog closes. */
  destroy?(): void
}

export interface DialogHandle {
  /** Closes the dialog if it is still open. */
  close(): void
}

export interface MenuDef {
  readonly items: readonly MenuItemDef[]
  readonly title?: string
  /** The click that asked for the menu; the menu opens at its pointer. */
  readonly event: MouseEvent
}

export interface MenuItemDef {
  readonly label: string
  /** Shown, but cannot be chosen. */
  readonly disabled?: boolean
  /** A menu that opens from this item. An item has a submenu or `run`, not both. */
  readonly submenu?: readonly MenuItemDef[]
  run?(): void
}

export interface PromptDef {
  /** What is asked for, such as "Strength". */
  readonly label: string
  /** The text the field starts with. */
  readonly value?: string
  readonly placeholder?: string
}

export type ViewportPanelAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

/** A panel over the graph view that stays put as the graph pans and zooms. */
export interface ViewportPanelDef {
  /** Unique among mounted panels: `MyPack.progress`. */
  readonly id: string
  /** The panel's accessible name. */
  readonly ariaLabel: string
  /** The edge or corner the panel sits against. Defaults to `'top-left'`. */
  readonly anchor?: ViewportPanelAnchor
  /** Pixels in from the anchored side, or along from the centre. */
  readonly offsetX?: number
  /** Pixels in from the anchored top or bottom. */
  readonly offsetY?: number
  /** Pixels. */
  readonly width?: number
  /** Pixels. */
  readonly maxHeight?: number
  /** Fills the panel once, while it is in the document. */
  render(container: HTMLElement): void
  /** Called once when the panel is removed, before it leaves the document. */
  destroy?(): void
}

export interface ViewportPanelHandle {
  /** Removes the panel. Safe to call more than once. */
  remove(): void
}

export interface LocalizationHandle {
  /**
   * Merges `catalog.messages` into the app's messages for `locale`, for the life of the page.
   * A later catalog wins. A locale the app does not ship throws.
   */
  registerCatalog(locale: string, catalog: LocalizationCatalog): void
}

/** A message, or a group of them by key. `null` leaves the key to the fallback locale. */
export type LocalizationMessage =
  | string
  | null
  | { readonly [key: string]: LocalizationMessage }

export interface LocalizationCatalog {
  /** Keyed as the app's own messages: `nodeDefs`, `commands`, `settings` and the rest. */
  readonly messages: { readonly [key: string]: LocalizationMessage }
}

export interface SystemHandle {
  /** One reading of the backend's memory and devices; `undefined` if the server could not be read. */
  monitor(): Promise<SystemMonitorSnapshot | undefined>
}

export interface SystemMonitorSnapshot {
  readonly cpu: SystemMonitorCpu
  /** The backend's RAM. */
  readonly memory: SystemMonitorMemory
  /** Empty: the backend reports no disks. */
  readonly volumes: readonly SystemMonitorVolume[]
  /** The backend's devices other than the CPU. */
  readonly accelerators: readonly SystemMonitorAccelerator[]
}

export interface SystemMonitorCpu {
  /** `null`: the backend reports no CPU load. */
  readonly utilization_percent: number | null
}

/** Bytes. */
export interface SystemMonitorMemory {
  readonly total: number
  readonly available: number
}

export interface SystemMonitorVolume extends SystemMonitorMemory {
  readonly id: string
  readonly label: string
}

export interface SystemMonitorAccelerator {
  /** The device's name, which the backend gives each device. */
  readonly id: string
  readonly name: string
  /** Bytes. */
  readonly memory_total: number
  /** Bytes. */
  readonly memory_available: number
  /** `null`: the backend reports no device load. */
  readonly utilization_percent: number | null
  /** `null`: the backend reports no temperature. */
  readonly temperature_c: number | null
}
