import type { ContextMenu } from "./ContextMenu"
import type { LGraphNode, NodeId } from "./LGraphNode"
import type { LinkDirection, RenderShape } from "./types/globalEnums"
import type { LinkId, LLink } from "./LLink"
import type { Reroute, RerouteId } from "./Reroute"

export type Dictionary<T> = { [key: string]: T }

/** Allows all properties to be null.  The same as `Partial<T>`, but adds null instead of undefined. */
export type NullableProperties<T> = {
  [P in keyof T]: T[P] | null
}

export type CanvasColour = string | CanvasGradient | CanvasPattern

/** An object containing a set of child objects */
export interface Parent<TChild> {
  /** All objects owned by the parent object. */
  readonly children?: ReadonlySet<TChild>
}

/**
 * An object that can be positioned, selected, and moved.
 *
 * May contain other {@link Positionable} objects.
 */
export interface Positionable extends Parent<Positionable> {
  id: NodeId | RerouteId | number
  /** Position in graph coordinates.  Default: 0,0 */
  pos: Point
  /** true if this object is part of the selection, otherwise false. */
  selected?: boolean

  /** See {@link IPinnable.pinned} */
  readonly pinned?: boolean

  /**
   * Adds a delta to the current position.
   * @param deltaX X value to add to current position
   * @param deltaY Y value to add to current position
   * @param skipChildren If true, any child objects like group contents will not be moved
   */
  move(deltaX: number, deltaY: number, skipChildren?: boolean): void

  /**
   * Snaps this item to a grid.
   *
   * Position values are rounded to the nearest multiple of {@link snapTo}.
   * @param snapTo The size of the grid to align to
   * @returns `true` if it moved, or `false` if the snap was rejected (e.g. `pinned`)
   */
  snapToGrid(snapTo: number): boolean

  /**
   * Cached position & size as `x, y, width, height`.
   * @readonly See {@link move}
   */
  readonly boundingRect: ReadOnlyRect

  /** Called whenever the item is selected */
  onSelected?(): void
  /** Called whenever the item is deselected */
  onDeselected?(): void
}

/**
 * An object that can be pinned.
 *
 * Prevents the object being accidentally moved or resized by mouse interaction.
 */
export interface IPinnable {
  pinned: boolean
  pin(value?: boolean): void
  unpin(): void
}

/**
 * Contains a list of links, reroutes, and nodes.
 */
export interface LinkNetwork {
  links: Map<LinkId, LLink>
  reroutes: Map<RerouteId, Reroute>
  getNodeById(id: NodeId): LGraphNode | null
}

/** Contains a cached 2D canvas path and a centre point, with an optional forward angle. */
export interface LinkSegment {
  /** Link / reroute ID */
  readonly id: LinkId | RerouteId
  /** The {@link id} of the reroute that this segment starts from (output side), otherwise `undefined`.  */
  readonly parentId?: RerouteId

  /** The last canvas 2D path that was used to render this segment */
  path?: Path2D
  /** Centre point of the {@link path}.  Calculated during render only - can be inaccurate */
  readonly _pos: Float32Array
  /**
   * Y-forward along the {@link path} from its centre point, in radians.
   * `undefined` if using circles for link centres.
   * Calculated during render only - can be inaccurate.
   */
  _centreAngle?: number

  /** Output node ID */
  readonly origin_id: NodeId
  /** Output slot index */
  readonly origin_slot: number
}

export interface IInputOrOutput {
  // If an input, this will be defined
  input?: INodeInputSlot
  // If an output, this will be defined
  output?: INodeOutputSlot
}

export interface IFoundSlot extends IInputOrOutput {
  // Slot index
  slot: number
  // Centre point of the rendered slot connection
  link_pos: Point
}

/** A point represented as `[x, y]` co-ordinates */
export type Point = [x: number, y: number] | Float32Array | Float64Array

/** A size represented as `[width, height]` */
export type Size = [width: number, height: number] | Float32Array | Float64Array

/** A very firm array */
type ArRect = [x: number, y: number, width: number, height: number]

/** A rectangle starting at top-left coordinates `[x, y, width, height]` */
export type Rect = ArRect | Float32Array | Float64Array

/** A rectangle starting at top-left coordinates `[x, y, width, height]`.  Requires functions exclusive to `TypedArray`. */
export type Rect32 = Float32Array

/** A point represented as `[x, y]` co-ordinates that will not be modified */
export type ReadOnlyPoint =
  | readonly [x: number, y: number]
  | ReadOnlyTypedArray<Float32Array>
  | ReadOnlyTypedArray<Float64Array>

/** A rectangle starting at top-left coordinates `[x, y, width, height]` that will not be modified */
export type ReadOnlyRect =
  | readonly [x: number, y: number, width: number, height: number]
  | ReadOnlyTypedArray<Float32Array>
  | ReadOnlyTypedArray<Float64Array>

type TypedArrays =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

type TypedBigIntArrays = BigInt64Array | BigUint64Array
type ReadOnlyTypedArray<T extends TypedArrays | TypedBigIntArrays> =
  Omit<T, "fill" | "copyWithin" | "reverse" | "set" | "sort" | "subarray">

/** Union of property names that are of type Match */
export type KeysOfType<T, Match> = { [P in keyof T]: T[P] extends Match ? P : never }[keyof T]

/** A new type that contains only the properties of T that are of type Match */
export type PickByType<T, Match> = { [P in keyof T]: Extract<T[P], Match> }

/** The names of all (optional) methods and functions in T */
export type MethodNames<T> = KeysOfType<T, ((...args: any) => any) | undefined>

export interface IBoundaryNodes {
  top: LGraphNode
  right: LGraphNode
  bottom: LGraphNode
  left: LGraphNode
}

export type Direction = "top" | "bottom" | "left" | "right"

export interface IOptionalSlotData<TSlot extends INodeInputSlot | INodeOutputSlot> {
  content: string
  value: TSlot
  className?: string
}

export type ISlotType = number | string

export interface INodeSlot {
  name: string
  type: ISlotType
  dir?: LinkDirection
  removable?: boolean
  shape?: RenderShape
  not_subgraph_input?: boolean
  color_off?: CanvasColour
  color_on?: CanvasColour
  label?: string
  locked?: boolean
  nameLocked?: boolean
  pos?: Point
  widget?: unknown
}

export interface INodeFlags {
  skip_repeated_outputs?: boolean
  allow_interaction?: boolean
  pinned?: boolean
  collapsed?: boolean
  /** Configuration setting for {@link LGraphNode.connectInputToOutput} */
  keepAllLinksOnBypass?: boolean
}

export interface INodeInputSlot extends INodeSlot {
  link: LinkId | null
  not_subgraph_input?: boolean
}

export interface INodeOutputSlot extends INodeSlot {
  links: LinkId[] | null
  _data?: unknown
  slot_index?: number
  not_subgraph_output?: boolean
}

/** Links */
export interface ConnectingLink extends IInputOrOutput {
  node: LGraphNode
  slot: number
  pos: Point
  direction?: LinkDirection
  afterRerouteId?: RerouteId
}

interface IContextMenuBase {
  title?: string
  className?: string
  callback?(
    value?: unknown,
    options?: unknown,
    event?: MouseEvent,
    previous_menu?: ContextMenu,
    node?: LGraphNode,
  ): void | boolean
}

/** ContextMenu */
export interface IContextMenuOptions extends IContextMenuBase {
  ignore_item_callbacks?: boolean
  parentMenu?: ContextMenu
  event?: MouseEvent
  extra?: unknown
  scroll_speed?: number
  left?: number
  top?: number
  scale?: number
  node?: LGraphNode
  autoopen?: boolean
}

export interface IContextMenuValue extends IContextMenuBase {
  value?: string
  content: string
  has_submenu?: boolean
  disabled?: boolean
  submenu?: IContextMenuSubmenu
  property?: string
  type?: string
  slot?: IFoundSlot
}

export interface IContextMenuSubmenu extends IContextMenuOptions {
  options: ConstructorParameters<typeof ContextMenu>[0]
}
