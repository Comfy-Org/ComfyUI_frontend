import type { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'

import type { ContextMenu } from './ContextMenu'
import type { LGraphNode } from './LGraphNode'
import type { LLink } from './LLink'
import type { Reroute } from './Reroute'
import type { SubgraphInput } from './subgraph/SubgraphInput'
import type { SubgraphInputNode } from './subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from './subgraph/SubgraphOutputNode'
import type { LinkDirection } from './types/globalEnums'
import type { IBaseWidget } from './types/widgets'

// Re-export pure types from the types directory for backwards compatibility
export type {
  CanvasColour,
  CompassCorners,
  Direction,
  Point,
  ReadOnlyRect,
  ReadOnlyTypedArray,
  Rect,
  Size
} from '../types/geometry'

export type { LinkId, NodeId, RerouteId } from '../types/ids'

export type {
  HasBoundingRect,
  INodeFlags,
  INodeSlotBase,
  ISlotType,
  IWidgetLocator
} from '../types/slots'

export type {
  Dictionary,
  MethodNames,
  NullableProperties,
  OptionalProps,
  RequiredProps,
  SharedIntersection,
  WhenNullish
} from '../types/utility'

// Import types we need locally
import type { CanvasColour, Point, Size } from '../types/geometry'
import type { LinkId, NodeId, RerouteId } from '../types/ids'
import type {
  HasBoundingRect,
  INodeInputSlotBase,
  INodeOutputSlotBase,
  INodeSlotBase,
  ISlotType,
  IWidgetLocator
} from '../types/slots'

export interface NewNodePosition {
  node: LGraphNode
  newPos: {
    x: number
    y: number
  }
}

export interface IBoundaryNodes {
  top: LGraphNode
  right: LGraphNode
  bottom: LGraphNode
  left: LGraphNode
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
  readonly id: NodeId | RerouteId | number
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

export interface ReadonlyLinkNetwork {
  readonly links: ReadonlyMap<LinkId, LLink>
  readonly reroutes: ReadonlyMap<RerouteId, Reroute>
  readonly floatingLinks: ReadonlyMap<LinkId, LLink>
  getNodeById(id: NodeId | null | undefined): LGraphNode | null
  getLink(id: null | undefined): undefined
  getLink(id: LinkId | null | undefined): LLink | undefined
  getReroute(parentId: null | undefined): undefined
  getReroute(parentId: RerouteId | null | undefined): Reroute | undefined

  readonly inputNode?: SubgraphInputNode
  readonly outputNode?: SubgraphOutputNode
}

/**
 * Contains a list of links, reroutes, and nodes.
 */
export interface LinkNetwork extends ReadonlyLinkNetwork {
  readonly links: Map<LinkId, LLink>
  readonly reroutes: Map<RerouteId, Reroute>
  addFloatingLink(link: LLink): LLink
  removeReroute(id: number): unknown
  removeFloatingLink(link: LLink): void
}

/**
 * Locates graph items.
 */
export interface ItemLocator {
  getNodeOnPos(x: number, y: number, nodeList?: LGraphNode[]): LGraphNode | null
  getRerouteOnPos(x: number, y: number): Reroute | undefined
  getIoNodeOnPos?(
    x: number,
    y: number
  ): SubgraphInputNode | SubgraphOutputNode | undefined
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
  readonly origin_slot: number | undefined
}

interface IInputOrOutput {
  // If an input, this will be defined
  input?: INodeInputSlot | null
  // If an output, this will be defined
  output?: INodeOutputSlot | null
}

export interface IFoundSlot extends IInputOrOutput {
  // Slot index
  slot: number
  // Centre point of the rendered slot connection
  link_pos: Point
}

/**
 * Full slot interface with runtime-dependent properties.
 * Extends the base slot from types/slots.ts with LLink reference.
 */
export interface INodeSlot extends INodeSlotBase {
  /**
   * A list of floating link IDs that are connected to this slot.
   * This is calculated at runtime; it is **not** serialized.
   */
  _floatingLinks?: Set<LLink>
}

/**
 * Full input slot interface with runtime-dependent properties.
 */
export interface INodeInputSlot extends INodeInputSlotBase, INodeSlot {
  /**
   * Internal use only; API is not finalised and may change at any time.
   */
  _widget?: IBaseWidget
}

export interface IWidgetInputSlot extends INodeInputSlot {
  widget: IWidgetLocator
}

/**
 * Full output slot interface with runtime-dependent properties.
 */
export interface INodeOutputSlot extends INodeOutputSlotBase, INodeSlot {}

/** Links */
export interface ConnectingLink extends IInputOrOutput {
  node: LGraphNode
  slot: number
  pos: Point
  direction?: LinkDirection
  afterRerouteId?: RerouteId
  /** The first reroute on a chain */
  firstRerouteId?: RerouteId
  /** The link being moved, or `undefined` if creating a new link. */
  link?: LLink
}

interface IContextMenuBase {
  title?: string
  className?: string
}

/** ContextMenu */
export interface IContextMenuOptions<
  TValue = unknown,
  TExtra = unknown
> extends IContextMenuBase {
  ignore_item_callbacks?: boolean
  parentMenu?: ContextMenu<TValue>
  event?: MouseEvent
  extra?: TExtra
  /** @deprecated Context menu scrolling is now controlled by the browser */
  scroll_speed?: number
  left?: number
  top?: number
  /** @deprecated Context menus no longer scale using transform */
  scale?: number
  node?: LGraphNode
  autoopen?: boolean
  callback?(
    value?: string | IContextMenuValue<TValue>,
    options?: unknown,
    event?: MouseEvent,
    previous_menu?: ContextMenu<TValue>,
    extra?: unknown
  ): void | boolean | Promise<void | boolean>
}

export interface IContextMenuValue<
  TValue = unknown,
  TExtra = unknown,
  TCallbackValue = unknown
> extends IContextMenuBase {
  value?: TValue
  content: string | undefined
  has_submenu?: boolean
  disabled?: boolean
  submenu?: IContextMenuSubmenu<TValue>
  property?: string
  type?: string
  slot?: IFoundSlot
  callback?(
    this: ContextMenuDivElement<TValue>,
    value?: TCallbackValue,
    options?: unknown,
    event?: MouseEvent,
    previous_menu?: ContextMenu<TValue>,
    extra?: TExtra
  ): void | boolean | Promise<void | boolean>
}

interface IContextMenuSubmenu<
  TValue = unknown
> extends IContextMenuOptions<TValue> {
  options: ConstructorParameters<typeof ContextMenu<TValue>>[0]
}

export interface ContextMenuDivElement<
  TValue = unknown
> extends HTMLDivElement {
  value?: string | IContextMenuValue<TValue>
  onclick_callback?: never
}

export type INodeSlotContextItem = [
  string,
  ISlotType,
  Partial<INodeInputSlot & INodeOutputSlot>
]

export interface DefaultConnectionColors {
  getConnectedColor(type: ISlotType): CanvasColour
  getDisconnectedColor(type: ISlotType): CanvasColour
}

export interface ISubgraphInput extends INodeInputSlot {
  _listenerController?: AbortController
  _subgraphSlot: SubgraphInput
}

/**
 * An object that can be hovered over.
 */
export interface Hoverable extends HasBoundingRect {
  readonly boundingRect: Rectangle
  isPointerOver: boolean

  containsPoint(point: Point): boolean

  onPointerMove(e: CanvasPointerEvent): void
  onPointerEnter?(e?: CanvasPointerEvent): void
  onPointerLeave?(e?: CanvasPointerEvent): void
}

/**
 * Callback for panel widget value changes.
 */
export type PanelWidgetCallback = (
  name: string | undefined,
  value: TWidgetValue,
  options: PanelWidgetOptions
) => void

/**
 * Options for panel widgets.
 */
export interface PanelWidgetOptions {
  label?: string
  type?: string
  widget?: string
  values?: Array<string | IContextMenuValue<unknown, unknown, unknown> | null>
  callback?: PanelWidgetCallback
}

/**
 * A button element with optional options property.
 */
export interface PanelButton extends HTMLButtonElement {
  options?: unknown
}

/**
 * A widget element with options and value properties.
 */
export interface PanelWidget extends HTMLDivElement {
  options?: PanelWidgetOptions
  value?: TWidgetValue
}

/**
 * A dialog panel created by LGraphCanvas.createPanel().
 * Extends HTMLDivElement with additional properties and methods for panel management.
 */
export interface Panel extends HTMLDivElement {
  header: HTMLElement
  title_element: HTMLSpanElement
  content: HTMLDivElement
  alt_content: HTMLDivElement
  footer: HTMLDivElement
  node?: LGraphNode
  onOpen?: () => void
  onClose?: () => void
  close(): void
  toggleAltContent(force?: boolean): void
  toggleFooterVisibility(force?: boolean): void
  clear(): void
  addHTML(code: string, classname?: string, on_footer?: boolean): HTMLDivElement
  addButton(name: string, callback: () => void, options?: unknown): PanelButton
  addSeparator(): void
  addWidget(
    type: string,
    name: string,
    value: TWidgetValue,
    options?: PanelWidgetOptions,
    callback?: PanelWidgetCallback
  ): PanelWidget
  inner_showCodePad?(property: string): void
}
