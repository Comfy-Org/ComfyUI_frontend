import type {
  ISlotType,
  Dictionary,
  INodeFlags,
  INodeInputSlot,
  INodeOutputSlot,
  Point,
  Rect,
  Size,
} from '@/interfaces'
import type { LGraph } from '@/LGraph'
import type { IGraphGroupFlags, LGraphGroup } from '@/LGraphGroup'
import type { LGraphNode, NodeId } from '@/LGraphNode'
import type { LiteGraph } from '@/litegraph'
import type { LinkId, LLink } from '@/LLink'
import type { TWidgetValue } from '@/types/widgets'
import { RenderShape } from './globalEnums'

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

/** Contains serialised graph elements */
export type ISerialisedGraph<
  TNode = ReturnType<LGraphNode['serialize']>,
  TLink = ReturnType<LLink['serialize']>,
  TGroup = ReturnType<LGraphGroup['serialize']>,
> = {
  last_node_id: LGraph['last_node_id']
  last_link_id: LGraph['last_link_id']
  last_reroute_id?: LGraph['last_reroute_id']
  nodes: TNode[]
  links: TLink[]
  groups: TGroup[]
  config: LGraph['config']
  version: typeof LiteGraph.VERSION
  extra?: unknown
}

/** Serialised LGraphGroup */
export interface ISerialisedGroup {
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

/** */
export interface IClipboardContents {
  nodes?: ISerialisedNode[]
  links?: TClipboardLink[]
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
}
