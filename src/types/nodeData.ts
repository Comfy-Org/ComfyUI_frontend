import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type { LGraphBadge } from '@/lib/litegraph/src/litegraph'
import type { TitleMode } from '@/lib/litegraph/src/types/globalEnums'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { NodeId } from '@/types/nodeId'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { SafeControlWidget } from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'

export interface WidgetSlotMetadata {
  index: number
  linked: boolean
  originNodeId?: NodeId
  originOutputName?: string
  type: string
}

export type Badges = (LGraphBadge | (() => LGraphBadge))[]

export interface SafeWidgetData {
  widgetId?: WidgetId
  nodeId?: NodeId
  name: string
  type: string
  callback?: ((value: unknown) => void) | undefined
  controlWidget?: SafeControlWidget
  hasLayoutSize?: boolean
  isDOMWidget?: boolean
  options?: {
    canvasOnly?: boolean
    advanced?: boolean
    hidden?: boolean
    read_only?: boolean
    values?: unknown
  }
  spec?: InputSpec
  slotMetadata?: WidgetSlotMetadata
  sourceExecutionId?: NodeExecutionId
  sourceWidgetName?: string
  tooltip?: string
}

export interface NodeDataState {
  executing: boolean
  id: NodeId
  mode: number
  selected: boolean
  title: string
  type: string
  apiNode?: boolean
  badges?: Badges
  bgcolor?: string
  color?: string
  flags?: {
    collapsed?: boolean
    ghost?: boolean
    pinned?: boolean
  }
  hasErrors?: boolean
  inputs?: INodeInputSlot[]
  outputs?: INodeOutputSlot[]
  resizable?: boolean
  shape?: number
  showAdvanced?: boolean
  subgraphId?: string | null
  titleMode?: TitleMode
  widgets?: SafeWidgetData[]
}

export type NodeDataStateInit = Omit<NodeDataState, 'id'> & {
  id?: NodeId
}

export type NodeDataPatch = Partial<Omit<NodeDataState, 'id'>>
