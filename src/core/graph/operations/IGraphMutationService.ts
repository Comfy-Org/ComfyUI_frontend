import type { GraphMutationError } from '@/core/graph/operations/GraphMutationError'
import type {
  AddNodeInputParams,
  AddNodeOutputParams,
  AddNodesToGroupParams,
  AddRerouteParams,
  ChangeNodeModeParams,
  ConnectParams,
  CreateGroupParams,
  CreateNodeParams,
  CreateSubgraphParams,
  DisconnectParams,
  GraphMutationOperation,
  NodeInputSlotParams,
  Result,
  SubgraphIndexParams,
  SubgraphNameTypeParams,
  UpdateGroupTitleParams,
  UpdateNodePropertyParams,
  UpdateNodeTitleParams
} from '@/core/graph/operations/types'
import type { GroupId } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LinkId } from '@/lib/litegraph/src/LLink'
import type { RerouteId } from '@/lib/litegraph/src/Reroute'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'

export interface IGraphMutationService {
  applyOperation(
    operation: GraphMutationOperation
  ): Promise<Result<any, GraphMutationError>>

  createNode(
    params: CreateNodeParams
  ): Promise<Result<NodeId, GraphMutationError>>

  getNodeById(nodeId: NodeId): LGraphNode

  removeNode(nodeId: NodeId): Promise<Result<void, GraphMutationError>>

  updateNodeProperty(
    params: UpdateNodePropertyParams
  ): Promise<Result<void, GraphMutationError>>

  updateNodeTitle(
    params: UpdateNodeTitleParams
  ): Promise<Result<void, GraphMutationError>>

  changeNodeMode(
    params: ChangeNodeModeParams
  ): Promise<Result<void, GraphMutationError>>

  cloneNode(nodeId: NodeId): Promise<Result<NodeId, GraphMutationError>>

  connect(params: ConnectParams): Promise<Result<LinkId, GraphMutationError>>

  disconnect(
    params: DisconnectParams
  ): Promise<Result<boolean, GraphMutationError>>

  disconnectLink(linkId: LinkId): Promise<Result<void, GraphMutationError>>

  createGroup(
    params: CreateGroupParams
  ): Promise<Result<GroupId, GraphMutationError>>

  removeGroup(groupId: GroupId): Promise<Result<void, GraphMutationError>>

  updateGroupTitle(
    params: UpdateGroupTitleParams
  ): Promise<Result<void, GraphMutationError>>

  addNodesToGroup(
    params: AddNodesToGroupParams
  ): Promise<Result<void, GraphMutationError>>

  recomputeGroupNodes(
    groupId: GroupId
  ): Promise<Result<void, GraphMutationError>>

  addReroute(
    params: AddRerouteParams
  ): Promise<Result<RerouteId, GraphMutationError>>

  removeReroute(rerouteId: RerouteId): Promise<Result<void, GraphMutationError>>

  copyNodes(nodeIds: NodeId[]): Promise<Result<void, GraphMutationError>>

  cutNodes(nodeIds: NodeId[]): Promise<Result<void, GraphMutationError>>

  pasteNodes(): Promise<Result<NodeId[], GraphMutationError>>

  addSubgraphNodeInput(
    params: AddNodeInputParams
  ): Promise<Result<number, GraphMutationError>>

  addSubgraphNodeOutput(
    params: AddNodeOutputParams
  ): Promise<Result<number, GraphMutationError>>

  removeSubgraphNodeInput(
    params: NodeInputSlotParams
  ): Promise<Result<void, GraphMutationError>>

  removeSubgraphNodeOutput(
    params: NodeInputSlotParams
  ): Promise<Result<void, GraphMutationError>>

  createSubgraph(params: CreateSubgraphParams): Promise<
    Result<
      {
        subgraph: any
        node: any
      },
      GraphMutationError
    >
  >

  unpackSubgraph(
    subgraphNodeId: NodeId
  ): Promise<Result<void, GraphMutationError>>

  addSubgraphInput(
    params: SubgraphNameTypeParams
  ): Promise<Result<void, GraphMutationError>>

  addSubgraphOutput(
    params: SubgraphNameTypeParams
  ): Promise<Result<void, GraphMutationError>>

  removeSubgraphInput(
    params: SubgraphIndexParams
  ): Promise<Result<void, GraphMutationError>>

  removeSubgraphOutput(
    params: SubgraphIndexParams
  ): Promise<Result<void, GraphMutationError>>

  clearGraph(): Promise<Result<void, GraphMutationError>>

  bypassNode(nodeId: NodeId): Promise<Result<void, GraphMutationError>>

  unbypassNode(nodeId: NodeId): Promise<Result<void, GraphMutationError>>

  undo(): Promise<Result<void, GraphMutationError>>

  redo(): Promise<Result<void, GraphMutationError>>
}
