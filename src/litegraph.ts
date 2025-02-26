import type { LabelPosition, SlotDirection, SlotShape, SlotType } from "./draw"
import type { ConnectingLink, Point } from "./interfaces"
import type {
  CanvasColour,
  ColorOption,
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
  IOptionalSlotData,
  ISlotType,
  KeysOfType,
  MethodNames,
  PickByType,
  Rect,
  Rect32,
  Size,
} from "./interfaces"
import type { CanvasEventDetail } from "./types/events"
import type { RenderShape, TitleMode } from "./types/globalEnums"
import type { IWidget } from "./types/widgets"

import { ContextMenu } from "./ContextMenu"
import { CurveEditor } from "./CurveEditor"
import { DragAndScale } from "./DragAndScale"
import { LGraph } from "./LGraph"
import { BadgePosition, LGraphBadge } from "./LGraphBadge"
import { LGraphCanvas, type LGraphCanvasState } from "./LGraphCanvas"
import { LGraphGroup } from "./LGraphGroup"
import { LGraphNode } from "./LGraphNode"
import { LiteGraphGlobal } from "./LiteGraphGlobal"
import { LLink } from "./LLink"
import { loadPolyfills } from "./polyfills"

export const LiteGraph = new LiteGraphGlobal()
export {
  ContextMenu,
  CurveEditor,
  DragAndScale,
  LGraph,
  LGraphCanvas,
  LGraphCanvasState,
  LGraphGroup,
  LGraphNode,
  LLink,
}
export {
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
  IOptionalSlotData,
  ISlotType,
  KeysOfType,
  MethodNames,
  PickByType,
  Rect,
  Rect32,
  Size,
}
export { isColorable } from "./utils/type"
export { IWidget }
export { BadgePosition, LGraphBadge }
export { LabelPosition, SlotDirection, SlotShape, SlotType }
export { CanvasPointer } from "./CanvasPointer"
export { strokeShape } from "./draw"
export { createBounds } from "./measure"
export { Reroute } from "./Reroute"
export { CanvasItem, EaseFunction, LGraphEventMode, LinkMarkerShape, RenderShape, TitleMode } from "./types/globalEnums"
export type {
  ISerialisedGraph,
  SerialisableGraph,
  SerialisableLLink,
} from "./types/serialisation"

export function clamp(v: number, a: number, b: number): number {
  return a > v ? a : b < v ? b : v
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
  parentMenu: ContextMenu | undefined,
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

/** https://github.com/jagenjo/litegraph.js/blob/master/guides/README.md#lgraphnode */

export interface LGraphNodeConstructor<T extends LGraphNode = LGraphNode> {
  title: string
  type?: string
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
  new (): T
}

// End backwards compat
