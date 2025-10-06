import type { NodeSlotType } from './globalEnums'

interface NodePropertyChangedEvent {
  nodeId: string | number
  property: string
  oldValue: unknown
  newValue: unknown
}

interface NodeSlotErrorsChangedEvent {
  nodeId: string | number
}

interface NodeSlotLinksChangedEvent {
  nodeId: string | number
  slotType: NodeSlotType
  slotIndex: number
  connected: boolean
  linkId: number
}

type LGraphTriggerEventMap = {
  'node:property:changed': NodePropertyChangedEvent
  'node:slot-errors:changed': NodeSlotErrorsChangedEvent
  'node:slot-links:changed': NodeSlotLinksChangedEvent
}

export type LGraphTriggerAction = keyof LGraphTriggerEventMap

export type LGraphTriggerParam<A extends LGraphTriggerAction> =
  A extends keyof LGraphTriggerEventMap ? LGraphTriggerEventMap[A] : unknown

export type LGraphTriggerHandler = {
  <A extends LGraphTriggerAction>(action: A, param: LGraphTriggerParam<A>): void
  (action: string, param: unknown): void
}
