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

// Must remain above LiteGraphGlobal (circular dependency due to abstract factory behaviour in `configure`)
export { Subgraph } from "./subgraph/Subgraph"

import { LiteGraphGlobal } from "./LiteGraphGlobal"
import { loadPolyfills } from "./polyfills"

export const LiteGraph = new LiteGraphGlobal()

// Load legacy polyfills
loadPolyfills()

// Backwards compat

// Type definitions for litegraph.js 0.7.0
// Project: litegraph.js
// Definitions by: NateScarlet <https://github.com/NateScarlet>
/** @deprecated Use {@link Point} instead. */
export type Vector2 = Point
/** @deprecated Use {@link Rect} instead. */
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
  resizeHandleSize?: number
  resizeEdgeSize?: number
}

// End backwards compat

export { InputIndicators } from "./canvas/InputIndicators"
export { LinkConnector } from "./canvas/LinkConnector"
export { isOverNodeInput, isOverNodeOutput } from "./canvas/measureSlots"
export { CanvasPointer } from "./CanvasPointer"
export * as Constants from "./constants"
export { ContextMenu } from "./ContextMenu"
export { CurveEditor } from "./CurveEditor"
export { DragAndScale } from "./DragAndScale"
export { LabelPosition, SlotDirection, SlotShape, SlotType } from "./draw"
export { strokeShape } from "./draw"
export { Rectangle } from "./infrastructure/Rectangle"
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
  Size,
} from "./interfaces"
export { LGraph } from "./LGraph"
export { BadgePosition, LGraphBadge, type LGraphBadgeOptions } from "./LGraphBadge"
export { LGraphCanvas, type LGraphCanvasState } from "./LGraphCanvas"
export { LGraphGroup } from "./LGraphGroup"
export { LGraphNode, type NodeId } from "./LGraphNode"
export { type LinkId, LLink } from "./LLink"
export { clamp, createBounds } from "./measure"
export { Reroute, type RerouteId } from "./Reroute"
export { type ExecutableLGraphNode, ExecutableNodeDTO, type ExecutionId } from "./subgraph/ExecutableNodeDTO"
export { SubgraphNode } from "./subgraph/SubgraphNode"
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
  ExportedSubgraph,
  ExportedSubgraphInstance,
  ExportedSubgraphIONode,
  ISerialisedGraph,
  SerialisableGraph,
  SerialisableLLink,
  SubgraphIO,
} from "./types/serialisation"
export type { IWidget } from "./types/widgets"
export { isColorable } from "./utils/type"
export { createUuidv4 } from "./utils/uuid"
export { BaseSteppedWidget } from "./widgets/BaseSteppedWidget"
export { BaseWidget } from "./widgets/BaseWidget"
export { BooleanWidget } from "./widgets/BooleanWidget"
export { ButtonWidget } from "./widgets/ButtonWidget"
export { ComboWidget } from "./widgets/ComboWidget"
export { KnobWidget } from "./widgets/KnobWidget"
export { LegacyWidget } from "./widgets/LegacyWidget"
export { NumberWidget } from "./widgets/NumberWidget"
export { SliderWidget } from "./widgets/SliderWidget"
export { TextWidget } from "./widgets/TextWidget"
export { isComboWidget } from "./widgets/widgetMap"
