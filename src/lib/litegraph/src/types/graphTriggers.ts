import type { NodeId } from '../LGraphNode'
import type { NodeSlotType } from './globalEnums'

interface NodePropertyChangedEvent {
  type: 'node:property:changed'
  nodeId: NodeId
  property: string
  oldValue: unknown
  newValue: unknown
}

interface NodeSlotErrorsChangedEvent {
  type: 'node:slot-errors:changed'
  nodeId: NodeId
}

interface NodeSlotLinksChangedEvent {
  type: 'node:slot-links:changed'
  nodeId: NodeId
  slotType: NodeSlotType
  slotIndex: number
  connected: boolean
  linkId: number
}

interface NodeSlotLabelChangedEvent {
  type: 'node:slot-label:changed'
  nodeId: NodeId
  slotType?: NodeSlotType
}

export type LGraphTriggerEvent =
  | NodePropertyChangedEvent
  | NodeSlotErrorsChangedEvent
  | NodeSlotLinksChangedEvent
  | NodeSlotLabelChangedEvent

export type LGraphTriggerAction = LGraphTriggerEvent['type']

export type LGraphTriggerParam<A extends LGraphTriggerAction> = Extract<
  LGraphTriggerEvent,
  { type: A }
>

export type LGraphTriggerHandler = (event: LGraphTriggerEvent) => void
