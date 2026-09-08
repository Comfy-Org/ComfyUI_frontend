import type {
  INodeFlags,
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type {
  LGraphEventMode,
  RenderShape,
  TitleMode
} from '@/lib/litegraph/src/types/globalEnums'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

export type NodeProperty = string | number | boolean | object | null

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
