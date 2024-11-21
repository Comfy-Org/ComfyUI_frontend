import type {
  ISlotType,
  Dictionary,
  INodeFlags,
  INodeInputSlot,
  INodeOutputSlot,
  Point,
  Size,
} from "../interfaces"
import type { LGraph, LGraphState } from "../LGraph"
import type { IGraphGroupFlags, LGraphGroup } from "../LGraphGroup"
import type { LGraphNode, NodeId } from "../LGraphNode"
import type { LiteGraph } from "../litegraph"
import type { LinkId, LLink } from "../LLink"
import type { RerouteId } from "../Reroute"
import type { TWidgetValue } from "../types/widgets"
import type { RenderShape } from "./globalEnums"

/**
 * An object that implements custom pre-serialization logic via {@link Serialisable.asSerialisable}.
 */
export interface Serialisable<SerialisableObject> {
  /**
   * Prepares this object for serialization.
   * Creates a partial shallow copy of itself, with only the properties that should be serialised.
   * @returns An object that can immediately be serialized to JSON.
   */
  asSerialisable(): SerialisableObject
}

export interface SerialisableGraph {
  /** Schema version.  @remarks Version bump should add to const union, which is used to narrow type during deserialise. */
  version: 0 | 1
  config: LGraph["config"]
  state: LGraphState
  groups?: ISerialisedGroup[]
  nodes?: ISerialisedNode[]
  links?: SerialisableLLink[]
  reroutes?: SerialisableReroute[]
  extra?: Record<any, any>
}

/** Serialised LGraphNode */
export interface ISerialisedNode {
  title?: string
  id: NodeId
  type?: string
  pos?: Point
  size?: Size
  flags?: INodeFlags
  order?: number
  mode?: number
  outputs?: INodeOutputSlot[]
  inputs?: INodeInputSlot[]
  properties?: Dictionary<unknown>
  shape?: RenderShape
  boxcolor?: string
  color?: string
  bgcolor?: string
  showAdvanced?: boolean
  widgets_values?: TWidgetValue[]
}

/**
 * Original implementation from static litegraph.d.ts
 * Maintained for backwards compat
 */
export type ISerialisedGraph<
  TNode = ReturnType<LGraphNode["serialize"]>,
  TLink = ReturnType<LLink["serialize"]>,
  TGroup = ReturnType<LGraphGroup["serialize"]>,
> = {
  last_node_id: NodeId
  last_link_id: number
  nodes: TNode[]
  links: TLink[]
  groups: TGroup[]
  config: LGraph["config"]
  version: typeof LiteGraph.VERSION
  extra?: Record<any, any>
}

/** Serialised LGraphGroup */
export interface ISerialisedGroup {
  id: number
  title: string
  bounding: number[]
  color: string
  font_size: number
  flags?: IGraphGroupFlags
}

export type TClipboardLink = [
  targetRelativeIndex: number,
  originSlot: number,
  nodeRelativeIndex: number,
  targetSlot: number,
  targetNodeId: NodeId,
]

/** Items copied from the canvas */
export interface ClipboardItems {
  nodes?: ISerialisedNode[]
  groups?: ISerialisedGroup[]
  reroutes?: SerialisableReroute[]
  links?: SerialisableLLink[]
}

/** @deprecated */
export interface IClipboardContents {
  nodes?: ISerialisedNode[]
  links?: TClipboardLink[]
}

export interface SerialisableReroute {
  id: RerouteId
  parentId?: RerouteId
  pos: Point
  linkIds: LinkId[]
}

export interface SerialisableLLink {
  /** Link ID */
  id: LinkId
  /** Output node ID */
  origin_id: NodeId
  /** Output slot index */
  origin_slot: number
  /** Input node ID */
  target_id: NodeId
  /** Input slot index */
  target_slot: number
  /** Data type of the link */
  type: ISlotType
  /** ID of the last reroute (from input to output) that this link passes through, otherwise `undefined` */
  parentId?: RerouteId
}
