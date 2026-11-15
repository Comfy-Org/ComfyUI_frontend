import type {
  ContextMenu,
  LGraphNode
} from '@comfyorg/graph-model/entityRegistry'

import { LiteGraphGlobal } from './LiteGraphGlobal'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import type { ConnectingLink } from '@comfyorg/graph-model/slots'
import type { IContextMenuOptions } from './types/contextMenu'
import { registerLiteGraphInstance } from './litegraphInstance'
import { loadPolyfills } from './polyfills'
import type { CanvasEventDetail } from '@comfyorg/graph-model/events'

// Must remain above LiteGraphGlobal (circular dependency due to abstract factory behaviour in `configure`)
export { Subgraph } from './subgraph/Subgraph'

export const LiteGraph = new LiteGraphGlobal()
registerLiteGraphInstance(LiteGraph)

// Load legacy polyfills
loadPolyfills()

// Backwards compat

// Type definitions for litegraph.js 0.7.0
// Project: litegraph.js
// Definitions by: NateScarlet <https://github.com/NateScarlet>
/** @deprecated Use {@link Point} instead. */
export type Vector2 = Point

interface IContextMenuItem {
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

type ContextMenuEventListener = (
  value: IContextMenuItem,
  options: IContextMenuOptions,
  event: MouseEvent,
  parentMenu: ContextMenu | undefined,
  node: LGraphNode
) => boolean | void

export interface LinkReleaseContextExtended {
  links: ConnectingLink[]
}

export interface LiteGraphCanvasEvent extends CustomEvent<CanvasEventDetail> {}

// End backwards compat

export type { CanvasInteractionModeReader } from '@comfyorg/graph-model/CanvasInteractionMode'
export { LinkConnector } from './canvas/LinkConnector'
export { isOverNodeInput, isOverNodeOutput } from './canvas/measureSlots'
export { CanvasPointer } from './CanvasPointer'
export * as Constants from './constants'
export { SUBGRAPH_INPUT_ID } from './constants'
export { ContextMenu } from './ContextMenu'

export { DragAndScale } from './DragAndScale'

export { Rectangle } from './infrastructure/Rectangle'
export type { SubgraphEventMap } from '@comfyorg/graph-model/SubgraphEventMap'
export type {
  CanvasColour,
  ColorOption,
  INodeSlot,
  ISlotType,
  Positionable,
  SlotIndex
} from '@comfyorg/graph-model/interfaces'
export type {
  PointTuple as Point,
  SizeTuple as Size
} from '@comfyorg/shared-frontend-utils/geometry'
export type {
  IContextMenuOptions,
  IContextMenuValue
} from './types/contextMenu'
export type { LinkNetwork } from '@comfyorg/graph-model/linkNetwork'
export type {
  INodeInputSlot,
  INodeOutputSlot
} from '@comfyorg/graph-model/slots'
export {
  LGraph,
  type LGraphTriggerAction,
  type LGraphTriggerParam,
  type GraphAddOptions,
  type SubgraphId
} from './LGraph'
export type { LGraphTriggerEvent } from '@comfyorg/graph-model/graphTriggers'
export { LGraphBadge } from './LGraphBadge'
export { LGraphCanvas } from './LGraphCanvas'
export { LGraphGroup } from './LGraphGroup'
export type { GroupId } from '@comfyorg/graph-model/groupId'
export { LGraphNode } from './LGraphNode'
export { LLink } from './LLink'
export { createBounds } from './measure'
export { Reroute, type RerouteId } from './Reroute'
export {
  type ExecutableLGraphNode,
  ExecutableNodeDTO,
  type ExecutionId
} from './subgraph/ExecutableNodeDTO'
export { SubgraphNode } from './subgraph/SubgraphNode'
export type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
export {
  EaseFunction,
  LGraphEventMode,
  LinkDirection,
  LinkMarkerShape,
  RenderShape
} from '@comfyorg/graph-model/globalEnums'
export type {
  ExportedSubgraph,
  ExportedSubgraphInstance,
  ISerialisedGraph,
  ISerialisedNode,
  SerialisableGraph
} from '@comfyorg/graph-model/serialisation'
export type { IWidget } from '@comfyorg/graph-model/widgets'
export { isColorable } from './utils/type'
export { createUuidv4 } from '@/utils/uuid'
export type { UUID } from '@/utils/uuid'
export { truncateText } from './utils/textUtils'
export {
  evaluateInput,
  getWidgetStep,
  resolveNodeRootGraphId
} from './utils/widget'
export { distributeSpace, type SpaceRequest } from './utils/spaceDistribution'

export { BaseWidget } from './widgets/BaseWidget'

export { LegacyWidget } from './widgets/LegacyWidget'

export { isComboWidget } from './widgets/widgetMap'
export { isAssetWidget } from './widgets/widgetMap'
// Additional test-specific exports
export { LGraphButton } from './LGraphButton'
export { MovingOutputLink } from './canvas/MovingOutputLink'
export { ToOutputRenderLink } from './canvas/ToOutputRenderLink'
export { ToInputFromIoNodeLink } from './canvas/ToInputFromIoNodeLink'
export type {
  TWidgetType,
  TWidgetValue,
  IWidgetOptions
} from '@comfyorg/graph-model/widgets'
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
export type { CreateNodeOptions } from './LiteGraphGlobal'

type RegisteredLinkReleaseContextExtended = LinkReleaseContextExtended

declare module '@comfyorg/graph-model/entityRegistry' {
  interface LinkReleaseContextExtended extends RegisteredLinkReleaseContextExtended {}
}
export type { LGraphNodeConstructor } from './types/nodeConstructor'
