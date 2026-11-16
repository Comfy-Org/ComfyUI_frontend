import type { INodeFlags } from './interfaces'
import type { INodeInputSlot, INodeOutputSlot } from './slots'
import type { LGraphEventMode, RenderShape, TitleMode } from './globalEnums'
import type { ISerialisedNode } from './serialisation'
import type { NodeId } from './nodeId'
import type { NodeProperty } from './nodeProperty'
import type { UUID } from './uuid'

export type { NodeProperty } from './nodeProperty'

export interface NodeState {
  flags: INodeFlags

  graphId: UUID
  readonly id: NodeId
  inputs: INodeInputSlot[]
  lastSerialization?: ISerialisedNode
  mode: LGraphEventMode
  outputs: INodeOutputSlot[]
  properties: Record<string, NodeProperty | undefined>
  title: string
  type: string
  bgcolor?: string
  boxcolor?: string
  color?: string
  resizable?: boolean
  shape?: RenderShape
  showAdvanced?: boolean
  titleMode?: TitleMode
}
