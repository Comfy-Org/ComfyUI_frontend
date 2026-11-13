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
  /**
   * Adds a badge until the disposer is called or the node is rebuilt, as undo
   * rebuilds it. A function is called each time the badge is drawn.
   */
  addBadge(badge: BadgeDef | (() => BadgeDef)): Unsubscribe
}
