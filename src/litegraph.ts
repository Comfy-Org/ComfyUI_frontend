import type { Point, ConnectingLink } from "./interfaces"
import type {
  INodeSlot,
  INodeInputSlot,
  INodeOutputSlot,
  CanvasColour,
  Direction,
  IBoundaryNodes,
  IContextMenuOptions,
  IContextMenuValue,
  IFoundSlot,
  IInputOrOutput,
  INodeFlags,
  IOptionalSlotData,
  ISlotType,
  KeysOfType,
  MethodNames,
  PickByType,
  Rect,
  Rect32,
  Size,
} from "./interfaces"
import type { SlotShape, LabelPosition, SlotDirection, SlotType } from "./draw"
import type { IWidget } from "./types/widgets"
import type { RenderShape, TitleMode } from "./types/globalEnums"
import type { CanvasEventDetail } from "./types/events"
import { LiteGraphGlobal } from "./LiteGraphGlobal"
import { loadPolyfills } from "./polyfills"

import { LGraph } from "./LGraph"
import { LGraphCanvas, type LGraphCanvasState } from "./LGraphCanvas"
import { DragAndScale } from "./DragAndScale"
import { LGraphNode } from "./LGraphNode"
import { LGraphGroup } from "./LGraphGroup"
import { LLink } from "./LLink"
import { ContextMenu } from "./ContextMenu"
import { CurveEditor } from "./CurveEditor"
import { LGraphBadge, BadgePosition } from "./LGraphBadge"

export const LiteGraph = new LiteGraphGlobal()
export {
  LGraph,
  LGraphCanvas,
  LGraphCanvasState,
  DragAndScale,
  LGraphNode,
  LGraphGroup,
  LLink,
  ContextMenu,
  CurveEditor,
}
export {
  INodeSlot,
  INodeInputSlot,
  INodeOutputSlot,
  ConnectingLink,
  CanvasColour,
  Direction,
  IBoundaryNodes,
  IContextMenuOptions,
  IContextMenuValue,
  IFoundSlot,
  IInputOrOutput,
  INodeFlags,
  IOptionalSlotData,
  ISlotType,
  KeysOfType,
  MethodNames,
  PickByType,
  Rect,
  Rect32,
  Size,
}
export { IWidget }
export { LGraphBadge, BadgePosition }
export { SlotShape, LabelPosition, SlotDirection, SlotType }
export { EaseFunction, LinkMarkerShape, LGraphEventMode } from "./types/globalEnums"
export type {
  SerialisableGraph,
  SerialisableLLink,
  ISerialisedGraph,
} from "./types/serialisation"
export { CanvasPointer } from "./CanvasPointer"
export { createBounds } from "./measure"

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

export interface LiteGraphCanvasGroupEvent
  extends CustomEvent<{
    subType: "group-double-click"
    originalEvent: MouseEvent
    group: LGraphGroup
  }> {}

/** https://github.com/jagenjo/litegraph.js/blob/master/guides/README.md#lgraphnode */

export interface LGraphNodeConstructor<T extends LGraphNode = LGraphNode> {
  title?: string
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
