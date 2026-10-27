import type { SerializedNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeSlotType } from '@comfyorg/graph-model/globalEnums'

interface NodePropertyChangedEvent {
  type: 'node:property:changed'
  nodeId: SerializedNodeId
  property: string
  oldValue: unknown
  newValue: unknown
}

interface NodeSlotLabelChangedEvent {
  type: 'node:slot-label:changed'
  nodeId: SerializedNodeId
  slotType?: NodeSlotType
}

export type LGraphTriggerEvent =
  | NodePropertyChangedEvent
  | NodeSlotLabelChangedEvent

export const LGraphTriggerActions = [
  'node:property:changed',
  'node:slot-label:changed'
] as const satisfies readonly LGraphTriggerEvent['type'][]

export type LGraphTriggerAction = (typeof LGraphTriggerActions)[number]

export type LGraphTriggerParam<A extends LGraphTriggerAction> = Extract<
  LGraphTriggerEvent,
  { type: A }
>

export type LGraphTriggerHandler = (event: LGraphTriggerEvent) => void
