import type { INodeFlags } from '@/lib/litegraph/src/interfaces'
import type {
  LGraphEventMode,
  RenderShape,
  TitleMode
} from '@/lib/litegraph/src/types/globalEnums'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

/**
 * The shell state of a node: the single source of truth for the fields the
 * renderer draws (title, mode, flags, colours, shape, …). Held as one plain
 * object per node in {@link useNodeDataStore}; the {@link LGraphNode} adopts the
 * store's reactive proxy as its `_state`, so class, store, and renderer agree.
 *
 * Excluded by design (owned elsewhere; see docs/architecture/node-data-store.md):
 * selected, executing, hasErrors, position/size, widget values, links, inputs,
 * outputs.
 */
export interface NodeState {
  bgcolor?: string
  color?: string
  flags: INodeFlags
  /** Owning (sub)graph id — partitioning + locator ids. */
  graphId: UUID
  id: NodeId
  mode: LGraphEventMode
  resizable?: boolean
  shape?: RenderShape
  showAdvanced?: boolean
  title: string
  titleMode?: TitleMode
  type: string
}
