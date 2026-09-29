import type { LinkId } from '@/types/linkId'
import type { RerouteId } from '@/types/rerouteId'
import type { SlotIndex } from '@/types/slotId'
import type { WidgetId } from '@/types/widgetId'

import type { LGraphNode } from '../LGraphNode'
import type { LLink } from '../LLink'
import type { IWidgetLocator, ISlotType, INodeSlot, Point } from '../interfaces'
import type { SubgraphInput } from '../subgraph/SubgraphInput'
import type { LinkDirection } from './globalEnums'
import type { IBaseWidget } from './widgets'

interface IInputOrOutput {
  // If an input, this will be defined
  input?: INodeInputSlot | null
  // If an output, this will be defined
  output?: INodeOutputSlot | null
}

export interface IFoundSlot extends IInputOrOutput {
  // Slot index
  slot: SlotIndex
  // Centre point of the rendered slot connection
  link_pos: Point
}

export interface INodeInputSlot extends INodeSlot {
  /**
   * @deprecated Id of the link targeting this slot, derived from the link
   * store by a warning getter. Read via `node.isInputConnected(slot)` /
   * `node.getInputLink(slot)`; mutate via `node.connect()` /
   * `node.disconnectInput()`.
   */
  link?: LinkId | null
  widget?: IWidgetLocator
  widgetId?: WidgetId
  alwaysVisible?: boolean

  /**
   * Internal use only; API is not finalised and may change at any time.
   */
  _widget?: IBaseWidget
}

export interface IWidgetInputSlot extends INodeInputSlot {
  widget: IWidgetLocator
}

export interface INodeOutputSlot extends INodeSlot {
  /**
   * @deprecated Ids of the links leaving this slot, derived from the link
   * store by a warning getter. Read via `node.isOutputConnected(slot)` /
   * `node.getOutputNodes(slot)`; mutate via `node.connect()` /
   * `node.disconnectOutput()`.
   */
  links?: LinkId[] | null
  _data?: unknown
  slot_index?: SlotIndex
}

export interface ISubgraphInput extends INodeInputSlot {
  _listenerController?: AbortController
  _subgraphSlot: SubgraphInput
}

export type INodeSlotContextItem = [
  string,
  ISlotType,
  Partial<INodeInputSlot & INodeOutputSlot>
]

export interface ConnectingLink extends IInputOrOutput {
  node: LGraphNode
  slot: SlotIndex
  pos: Point
  direction?: LinkDirection
  afterRerouteId?: RerouteId
  /** The first reroute on a chain */
  firstRerouteId?: RerouteId
  /** The link being moved, or `undefined` if creating a new link. */
  link?: LLink
}
