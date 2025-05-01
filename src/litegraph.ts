import type { ContextMenu } from "./ContextMenu"
import type { ConnectingLink, Point } from "./interfaces"
import type {
  IContextMenuOptions,
  INodeSlot,
  Size,
} from "./interfaces"
import type { LGraphNode } from "./LGraphNode"
import type { CanvasEventDetail } from "./types/events"
import type { RenderShape, TitleMode } from "./types/globalEnums"

import { LiteGraphGlobal } from "./LiteGraphGlobal"
import { loadPolyfills } from "./polyfills"

export const LiteGraph = new LiteGraphGlobal()

export function clamp(v: number, a: number, b: number): number {
  return a > v ? a : (b < v ? b : v)
}

// Load legacy polyfills
loadPolyfills()

// Backwards compat

// Type definitions for litegraph.js 0.7.0
// Project: litegraph.js
// Definitions by: NateScarlet <https://github.com/NateScarlet>
export type Vector2 = Point
export type Vector4 = [number, number, number, number]

export interface IContextMenuItem {
  content: string
  callback?: ContextMenuEventListener
  /** Used as innerHTML for extra child element */
  title?: string
  disabled?: boolean
  has_submenu?: boolean
  submenu?: {
    options: IContextMenuItem[]
  } & IContextMenuOptions
  className?: string
}

export type ContextMenuEventListener = (
  value: IContextMenuItem,
  options: IContextMenuOptions,
  event: MouseEvent,
  parentMenu: ContextMenu<unknown> | undefined,
  node: LGraphNode,
) => boolean | void

export interface LinkReleaseContext {
  node_to?: LGraphNode
  node_from?: LGraphNode
  slot_from: INodeSlot
  type_filter_in?: string
  type_filter_out?: string
}

export interface LinkReleaseContextExtended {
  links: ConnectingLink[]
}

export interface LiteGraphCanvasEvent extends CustomEvent<CanvasEventDetail> {}

export interface LGraphNodeConstructor<T extends LGraphNode = LGraphNode> {
  new (title: string, type?: string): T

  title: string
  type: string
  size?: Size
  min_height?: number
  slot_start_y?: number
  widgets_info?: any
  collapsable?: boolean
  color?: string
  bgcolor?: string
  shape?: RenderShape
  title_mode?: TitleMode
  title_color?: string
  title_text_color?: string
  keepAllLinksOnBypass: boolean
  nodeData: any
}

// End backwards compat

export { InputIndicators } from "./canvas/InputIndicators"
export { isOverNodeInput, isOverNodeOutput } from "./canvas/measureSlots"
export { CanvasPointer } from "./CanvasPointer"
export { ContextMenu } from "./ContextMenu"
export { CurveEditor } from "./CurveEditor"
export { DragAndScale } from "./DragAndScale"
export { LabelPosition, SlotDirection, SlotShape, SlotType } from "./draw"
export { strokeShape } from "./draw"
export type {
  CanvasColour,
  ColorOption,
  ConnectingLink,
  Direction,
  IBoundaryNodes,
  IColorable,
  IContextMenuOptions,
  IContextMenuValue,
  IFoundSlot,
  IInputOrOutput,
  INodeFlags,
  INodeInputSlot,
  INodeOutputSlot,
  INodeSlot,
  ISlotType,
  KeysOfType,
  LinkNetwork,
  LinkSegment,
  MethodNames,
  PickByType,
  Point,
  Positionable,
  ReadonlyLinkNetwork,
  ReadOnlyPoint,
  ReadOnlyRect,
  Rect,
  Rect32,
  Size,
} from "./interfaces"
export { LGraph } from "./LGraph"
export { BadgePosition, LGraphBadge, type LGraphBadgeOptions } from "./LGraphBadge"
export { LGraphCanvas, type LGraphCanvasState } from "./LGraphCanvas"
export { LGraphGroup } from "./LGraphGroup"
export { LGraphNode, type NodeId } from "./LGraphNode"
export { type LinkId, LLink } from "./LLink"
export { createBounds } from "./measure"
export { Reroute, type RerouteId } from "./Reroute"
export type { CanvasPointerEvent } from "./types/events"
export {
  CanvasItem,
  EaseFunction,
  LGraphEventMode,
  LinkMarkerShape,
  RenderShape,
  TitleMode,
} from "./types/globalEnums"
export type {
  ISerialisedGraph,
  SerialisableGraph,
  SerialisableLLink,
} from "./types/serialisation"
export type { IWidget } from "./types/widgets"
export { isColorable } from "./utils/type"
export { createUuidv4 } from "./utils/uuid"
