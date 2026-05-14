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

/**
 * Single source of truth for actions accepted by `LGraph.trigger()`.
 * Both the runtime allowlist (`LGraphTriggerActions`) and the static type
 * (`LGraphTriggerAction`) derive from this tuple — adding a new action is
 * a one-place change. Keep in lockstep with {@link LGraphTriggerEvent}.
 */
export const LGraphTriggerActions = [
  'node:property:changed',
  'node:slot-errors:changed',
  'node:slot-links:changed',
  'node:slot-label:changed'
] as const satisfies readonly LGraphTriggerEvent['type'][]

export type LGraphTriggerAction = (typeof LGraphTriggerActions)[number]

export type LGraphTriggerParam<A extends LGraphTriggerAction> = Extract<
  LGraphTriggerEvent,
  { type: A }
>

export type LGraphTriggerHandler = (event: LGraphTriggerEvent) => void
