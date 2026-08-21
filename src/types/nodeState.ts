import type { INodeFlags } from '@/lib/litegraph/src/interfaces'
import type {
  InputSlotDescriptor,
  OutputSlotDescriptor
} from '@/lib/litegraph/src/node/slotDescriptorView'
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
  inputs: InputSlotDescriptor[]
  mode: LGraphEventMode
  outputs: OutputSlotDescriptor[]
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
