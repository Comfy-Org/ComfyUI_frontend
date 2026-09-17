import type {
  ISerialisableNodeInput,
  ISerialisableNodeOutput
} from '@/lib/litegraph/src/types/serialisation'
import type { GraphScope } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { NodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import type { WidgetValue } from '@/types/simplifiedWidget'

export interface SemanticNodePayload extends Record<string, unknown> {
  id: string | number
  type: string
}
export interface SemanticLinkPayload {
  id: number
  originNodeId: string | number
  originSlot: number
  targetNodeId: string | number
  targetSlot: number
  type: string | number
  /** Final semantic slot records after the shared applier handled this link. */
  originOutputs?: readonly ISerialisableNodeOutput[]
  targetInputs?: readonly ISerialisableNodeInput[]
}
interface SemanticNodeLayout {
  position: { x: number; y: number }
  size: { width: number; height: number }
}
/**
 * Renderer-owned layout mutation port. Semantic state never imports the
 * renderer or writes position into the shared follower Y.Doc.
 */
export interface SemanticLayoutMutationPort {
  createNode(
    scope: GraphScope,
    nodeId: NodeId,
    layout: SemanticNodeLayout,
    context: RemoteMutationContext
  ): void
  deleteNodes(
    scope: GraphScope,
    nodeIds: readonly NodeId[],
    context: RemoteMutationContext
  ): void
}
export interface PreparedWidgetEntry {
  name: string
  value: WidgetValue
  type: string
}

export interface PreparedNode {
  state: NodeState
  layout: SemanticNodeLayout
  widgets: PreparedWidgetEntry[]
  widgetsAuthoritative: boolean
}
