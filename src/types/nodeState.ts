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
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

/**
 * The fields the renderer draws. Selection, execution, errors, geometry, widget
 * values and links live elsewhere — see docs/architecture/node-data-store.md.
 */
export interface NodeState {
  flags: INodeFlags
  /** Owning (sub)graph id — partitioning + locator ids. */
  graphId: UUID
  readonly id: NodeId
  /** The node's own `shallowReactive` array; slots are still class instances. */
  inputs: INodeInputSlot[]
  mode: LGraphEventMode
  /** @see {@link inputs} */
  outputs: INodeOutputSlot[]
  title: string
  type: string
  bgcolor?: string
  color?: string
  resizable?: boolean
  shape?: RenderShape
  showAdvanced?: boolean
  titleMode?: TitleMode
}
