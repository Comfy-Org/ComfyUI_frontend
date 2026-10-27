import type { INodeFlags } from '@comfyorg/graph-model/interfaces'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@comfyorg/graph-model/slots'
import type {
  LGraphEventMode,
  RenderShape,
  TitleMode
} from '@comfyorg/graph-model/globalEnums'
import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'
import type { UUID } from '@/utils/uuid'

export type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'

/**
 * The fields the renderer draws. Selection, execution, errors, geometry, widget
 * values and links live elsewhere — see docs/architecture/node-data-store.md.
 */
export interface NodeState {
  flags: INodeFlags
  /** Owning (sub)graph id — partitioning + locator ids. */
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
