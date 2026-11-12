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
