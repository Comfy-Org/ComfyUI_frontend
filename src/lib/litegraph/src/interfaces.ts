import type { GroupId } from '@/types/groupId'
import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'
import type { RerouteId } from '@/types/rerouteId'
import type { SlotIndex } from '@/types/slotId'

import type { LinkDirection, RenderShape } from './types/globalEnums'

export type Dictionary<T> = { [key: string]: T }

/** Allows all properties to be null.  The same as `Partial<T>`, but adds null instead of undefined. */
export type NullableProperties<T> = {
  [P in keyof T]: T[P] | null
}

/**
 * If {@link T} is `null` or `undefined`, evaluates to {@link Result}. Otherwise, evaluates to {@link T}.
 * Useful for functions that return e.g. `undefined` when a param is nullish.
 */
export type WhenNullish<T, Result> =
  | (T & {})
  | (T extends null ? Result : T extends undefined ? Result : T & {})

/** A type with each of the {@link Properties} made optional. */
export type OptionalProps<T, Properties extends keyof T> = Omit<
  T,
  Properties
> & { [K in Properties]?: T[K] }

/** A type with each of the {@link Properties} marked as required. */
export type RequiredProps<T, Properties extends keyof T> = Omit<
  T,
  Properties
> & { [K in Properties]-?: T[K] }

/** Bitwise AND intersection of two types; returns a new, non-union type that includes only properties that exist on both types. */
export type SharedIntersection<T1, T2> = {
  [P in keyof T1 as P extends keyof T2 ? P : never]: T1[P]
} & {
  [P in keyof T2 as P extends keyof T1 ? P : never]: T2[P]
}

export type CanvasColour = string | CanvasGradient | CanvasPattern

export interface ColorStop {
  readonly offset: number
  readonly color: readonly [r: number, g: number, b: number]
}

/**
 * Any object that has a {@link boundingRect}.
 */
export interface HasBoundingRect {
  /**
   * A rectangle that represents the outer edges of the item.
   *
   * Used for various calculations, such as overlap, selective rendering, and click checks.
   * For most items, this is cached position & size as `x, y, width, height`.
   * Some items (such as nodes and slots) may extend above and/or to the left of their {@link pos}.
   * @readonly
   * @see {@link move}
   */
  readonly boundingRect: ReadOnlyRect
}

/** An object containing a set of child objects */
interface Parent<TChild> {
  /** All objects owned by the parent object. */
  readonly children?: ReadonlySet<TChild>
}

/**
 * An object that can be positioned, selected, and moved.
 *
 * May contain other {@link Positionable} objects.
 */
export interface Positionable extends Parent<Positionable>, HasBoundingRect {
  readonly id: NodeId | RerouteId | GroupId
  /**
   * Position in graph coordinates. This may be the top-left corner,
   * the centre, or another point depending on concrete type.
   * @default 0,0
   */
  readonly pos: Point
  readonly size?: Size
  /** true if this object is part of the selection, otherwise false. */
  selected?: boolean

  /** See {@link IPinnable.pinned} */
  readonly pinned?: boolean

  /**
   * When explicitly set to `false`, no options to delete this item will be provided.
   * @default undefined (true)
   */
  readonly removable?: boolean

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

  /** Called whenever the item is selected */
  onSelected?(): void
  /** Called whenever the item is deselected */
  onDeselected?(): void
}

/**
 * A color option to customize the color of {@link LGraphNode} or {@link LGraphGroup}.
 * @see {@link LGraphCanvas.node_colors}
 */
export interface ColorOption {
  color: string
  bgcolor: string
  groupcolor: string
}

/**
 * An object that can be colored with a {@link ColorOption}.
 */
export interface IColorable {
  setColorOption(colorOption: ColorOption | null): void
  getColorOption(): ColorOption | null
}

/**
 * An object that can be pinned.
 *
 * Prevents the object being accidentally moved or resized by mouse interaction.
 */
export interface IPinnable {
  readonly pinned: boolean
  pin(value?: boolean): void
  unpin(): void
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
  readonly _pos: Point
  /**
   * Y-forward along the {@link path} from its centre point, in radians.
   * `undefined` if using circles for link centres.
   * Calculated during render only - can be inaccurate.
   */
  _centreAngle?: number

  /** Whether the link is currently being moved. @internal */
  _dragging?: boolean

  /** Output node ID */
  readonly origin_id: NodeId | undefined
  /** Output slot index */
  readonly origin_slot: SlotIndex | undefined
}

/** A point represented as `[x, y]` co-ordinates */
export type Point = [x: number, y: number]

/** A size represented as `[width, height]` */
export type Size = [width: number, height: number]

/** A rectangle starting at top-left coordinates `[x, y, width, height]` */
export type Rect =
  | [x: number, y: number, width: number, height: number]
  | Float64Array

/** A rectangle starting at top-left coordinates `[x, y, width, height]` that will not be modified */
export type ReadOnlyRect =
  | readonly [x: number, y: number, width: number, height: number]
  | ReadOnlyTypedArray<Float64Array>

export type ReadOnlyTypedArray<T extends Float64Array> = Omit<
  Readonly<T>,
  'fill' | 'copyWithin' | 'reverse' | 'set' | 'sort' | 'subarray'
>

/** Union of property names that are of type Match */
type KeysOfType<T, Match> = Exclude<
  { [P in keyof T]: T[P] extends Match ? P : never }[keyof T],
  undefined
>

/** The names of all (optional) methods and functions in T */
export type MethodNames<T> = KeysOfType<
  T,
  ((...args: unknown[]) => unknown) | undefined
>

export type Direction = 'top' | 'bottom' | 'left' | 'right'

/** Resize handle positions (compass points) */
export type CompassCorners = 'NE' | 'SE' | 'SW' | 'NW'

/**
 * A value that represents a specific data / slot type, e.g. `STRING`.
 *
 * Multiple allowed types may be comma-delimited or stored as an array.
 */
export type ISlotType = number | string | string[]

export interface INodeSlot extends HasBoundingRect {
  /**
   * The name of the slot in English.
   * Will be included in the serialized data.
   */
  name: string
  /**
   * The localized name of the slot to display in the UI.
   * Takes higher priority than {@link name} if set.
   * Will be included in the serialized data.
   */
  localized_name?: string
  /**
   * The name of the slot to display in the UI, modified by the user.
   * Takes higher priority than {@link display_name} if set.
   * Will be included in the serialized data.
   */
  label?: string

  type: ISlotType
  dir?: LinkDirection
  removable?: boolean
  shape?: RenderShape
  color_off?: CanvasColour
  color_on?: CanvasColour
  locked?: boolean
  nameLocked?: boolean
  pos?: Point
  slot_index?: SlotIndex
  /** @remarks Automatically calculated; not included in serialisation. */
  boundingRect: ReadOnlyRect
  /**
   * Whether the slot has errors. It is **not** serialized.
   */
  hasErrors?: boolean
}

export interface INodeFlags {
  skip_repeated_outputs?: boolean
  allow_interaction?: boolean
  pinned?: boolean
  collapsed?: boolean
  /** Configuration setting for {@link LGraphNode.connectInputToOutput} */
  keepAllLinksOnBypass?: boolean
  /** Node is in ghost placement mode (semi-transparent, following cursor) */
  ghost?: boolean
}

/**
 * A widget that is linked to a slot.
 *
 * This is set by the ComfyUI_frontend logic. See
 * https://github.com/Comfy-Org/ComfyUI_frontend/blob/b80e0e1a3c74040f328c4e344326c969c97f67e0/src/extensions/core/widgetInputs.ts#L659
 */
export interface IWidgetLocator {
  name: string
  type?: string
}

export interface DefaultConnectionColors {
  getConnectedColor(type: ISlotType): CanvasColour
  getDisconnectedColor(type: ISlotType): CanvasColour
}

export type { SlotIndex } from '@/types/slotId'
