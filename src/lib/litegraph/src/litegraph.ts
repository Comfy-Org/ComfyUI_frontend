import type { ContextMenu } from './ContextMenu'
import type { LGraphNode } from './LGraphNode'
import { LiteGraphGlobal } from './LiteGraphGlobal'
import type { ConnectingLink, Point } from './interfaces'
import type { IContextMenuOptions, INodeSlot, Size } from './interfaces'
import { loadPolyfills } from './polyfills'
import type { CanvasEventDetail } from './types/events'
import type { RenderShape, TitleMode } from './types/globalEnums'

// Must remain above LiteGraphGlobal (circular dependency due to abstract factory behaviour in `configure`)
export { Subgraph } from './subgraph/Subgraph'

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
  node: LGraphNode
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LiteGraphCanvasEvent extends CustomEvent<CanvasEventDetail> {}

export interface LGraphNodeConstructor<T extends LGraphNode = LGraphNode> {
  new (title: string, type?: string): T

  title: string
  type?: string // TODO: to be, or not to be--that is the question
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

export { InputIndicators } from './canvas/InputIndicators'
export { LinkConnector } from './canvas/LinkConnector'
export { isOverNodeInput, isOverNodeOutput } from './canvas/measureSlots'
export { CanvasPointer } from './CanvasPointer'
export * as Constants from './constants'
export { SUBGRAPH_INPUT_ID, SUBGRAPH_OUTPUT_ID } from './constants'
export { ContextMenu } from './ContextMenu'
export { CurveEditor } from './CurveEditor'
export { DragAndScale } from './DragAndScale'
export { LabelPosition, SlotDirection, SlotShape, SlotType } from './draw'
export { strokeShape } from './draw'
export { Rectangle } from './infrastructure/Rectangle'
export { RecursionError } from './infrastructure/RecursionError'
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
  Size
} from './interfaces'
export { LGraph } from './LGraph'
export {
  BadgePosition,
  LGraphBadge,
  type LGraphBadgeOptions
} from './LGraphBadge'
export { LGraphCanvas, type LGraphCanvasState } from './LGraphCanvas'
export { LGraphGroup } from './LGraphGroup'
export { LGraphNode, type NodeId } from './LGraphNode'
export { type LinkId, LLink } from './LLink'
export { createBounds } from './measure'
export { Reroute, type RerouteId } from './Reroute'
export {
  type ExecutableLGraphNode,
  ExecutableNodeDTO,
  type ExecutionId
} from './subgraph/ExecutableNodeDTO'
export { SubgraphNode } from './subgraph/SubgraphNode'
export type { CanvasPointerEvent } from './types/events'
export {
  CanvasItem,
  EaseFunction,
  LGraphEventMode,
  LinkDirection,
  LinkMarkerShape,
  RenderShape,
  TitleMode
} from './types/globalEnums'
export type {
  ExportedSubgraph,
  ExportedSubgraphInstance,
  ExportedSubgraphIONode,
  ISerialisedGraph,
  ISerialisedNode,
  SerialisableGraph,
  SerialisableLLink,
  SubgraphIO
} from './types/serialisation'
export type { IWidget } from './types/widgets'
export { isColorable } from './utils/type'
export { createUuidv4 } from './utils/uuid'
export type { UUID } from './utils/uuid'
export { truncateText } from './utils/textUtils'
export { getWidgetStep } from './utils/widget'
export { distributeSpace, type SpaceRequest } from './utils/spaceDistribution'
export { BaseSteppedWidget } from './widgets/BaseSteppedWidget'
export { BaseWidget } from './widgets/BaseWidget'
export { BooleanWidget } from './widgets/BooleanWidget'
export { ButtonWidget } from './widgets/ButtonWidget'
export { ComboWidget } from './widgets/ComboWidget'
export { KnobWidget } from './widgets/KnobWidget'
export { LegacyWidget } from './widgets/LegacyWidget'
export { NumberWidget } from './widgets/NumberWidget'
export { SliderWidget } from './widgets/SliderWidget'
export { TextWidget } from './widgets/TextWidget'
export { isComboWidget } from './widgets/widgetMap'
// Additional test-specific exports
export { LGraphButton, type LGraphButtonOptions } from './LGraphButton'
export { MovingOutputLink } from './canvas/MovingOutputLink'
export { ToOutputRenderLink } from './canvas/ToOutputRenderLink'
export { ToInputFromIoNodeLink } from './canvas/ToInputFromIoNodeLink'
export type { TWidgetType, IWidgetOptions } from './types/widgets'
export {
  findUsedSubgraphIds,
  getDirectSubgraphIds,
  isSubgraphInput,
  isSubgraphOutput
} from './subgraph/subgraphUtils'
export { NodeInputSlot } from './node/NodeInputSlot'
export { NodeOutputSlot } from './node/NodeOutputSlot'
export { inputAsSerialisable, outputAsSerialisable } from './node/slotUtils'
export { MovingInputLink } from './canvas/MovingInputLink'
export { ToInputRenderLink } from './canvas/ToInputRenderLink'
export { LiteGraphGlobal } from './LiteGraphGlobal'
