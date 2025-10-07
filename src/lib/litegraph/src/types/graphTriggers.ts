import type { NodeSlotType } from './globalEnums'

interface NodePropertyChangedEvent {
  type: 'node:property:changed'
  nodeId: string | number
  property: string
  oldValue: unknown
  newValue: unknown
}

interface NodeSlotErrorsChangedEvent {
  type: 'node:slot-errors:changed'
  nodeId: string | number
}

interface NodeSlotLinksChangedEvent {
  type: 'node:slot-links:changed'
  nodeId: string | number
  slotType: NodeSlotType
  slotIndex: number
  connected: boolean
  linkId: number
}

export type LGraphTriggerEvent =
  | NodePropertyChangedEvent
  | NodeSlotErrorsChangedEvent
  | NodeSlotLinksChangedEvent

export type LGraphTriggerAction = LGraphTriggerEvent['type']

export type LGraphTriggerParam<A extends LGraphTriggerAction> = Extract<
  LGraphTriggerEvent,
  { type: A }
>

export type LGraphTriggerHandler = (event: LGraphTriggerEvent) => void
