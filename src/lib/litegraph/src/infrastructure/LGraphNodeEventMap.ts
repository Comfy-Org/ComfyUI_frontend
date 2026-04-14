import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  ISlotType,
  Size
} from '@/lib/litegraph/src/interfaces'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export const NodeEvent = {
  NODE_CREATED: 'node-created',
  CONFIGURED: 'configured',
  CONNECTIONS_CHANGE: 'connections-change',
  WIDGET_CHANGED: 'widget-changed',
  ADDED: 'added',
  REMOVED: 'removed',
  RESIZE: 'resize',
  EXECUTED: 'executed'
} as const

export type LGraphNodeEventMap = {
  [NodeEvent.NODE_CREATED]: never
  [NodeEvent.CONFIGURED]: { serialisedNode: ISerialisedNode }
  [NodeEvent.CONNECTIONS_CHANGE]: {
    type: ISlotType
    index: number
    isConnected: boolean
    link: LLink | null | undefined
    inputOrOutput: INodeInputSlot | INodeOutputSlot
  }
  [NodeEvent.WIDGET_CHANGED]: {
    name: string
    value: unknown
    oldValue: unknown
    widget: IBaseWidget
  }
  [NodeEvent.ADDED]: { graph: LGraph }
  [NodeEvent.REMOVED]: never
  [NodeEvent.RESIZE]: { size: Size }
  [NodeEvent.EXECUTED]: { output: Record<string, unknown> }
}
