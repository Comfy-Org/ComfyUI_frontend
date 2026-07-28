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
 * The shell state of a node: the single source of truth for the fields the
 * renderer draws (title, mode, flags, colours, shape, slots, …). Held as one
 * plain object per node in {@link useNodeDataStore}; the {@link LGraphNode}
 * adopts the store's reactive proxy as its `_state`, so class, store, and
 * renderer agree.
 *
 * Excluded by design (owned elsewhere; see docs/architecture/node-data-store.md):
 * selected, executing, hasErrors, position/size, widget values, links.
 */
export interface NodeState {
  bgcolor?: string
  color?: string
  flags: INodeFlags
  /** Owning (sub)graph id — partitioning + locator ids. */
  graphId: UUID
  id: NodeId
  /**
   * The node's own `shallowReactive` slot array, so the renderer tracks slot
   * add / remove / reorder. Slot objects are still class instances
   * (`NodeInputSlot`); extracting their data into plain rows is a later phase.
   */
  inputs: INodeInputSlot[]
  mode: LGraphEventMode
  outputs: INodeOutputSlot[]
  resizable?: boolean
  shape?: RenderShape
  showAdvanced?: boolean
  title: string
  titleMode?: TitleMode
  type: string
}
