import { GroupId } from '@/lib/litegraph/src/LGraphGroup'
import { LinkId } from '@/lib/litegraph/src/LLink'
import type { RerouteId } from '@/lib/litegraph/src/Reroute'
import { SubgraphId } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { NodeId } from '@/schemas/comfyWorkflowSchema'

export interface AddNodeParams {
  type: string
  pos?: [number, number]
  properties?: Record<string, any>
  title?: string
}

export interface ConnectParams {
  sourceNodeId: NodeId
  sourceSlot: number | string
  targetNodeId: NodeId
  targetSlot: number | string
}

export interface CreateGroupParams {
  title?: string
  pos?: [number, number]
  size?: [number, number]
  color?: string
  fontSize?: number
}

export interface AddRerouteParams {
  pos: [number, number]
  linkId?: LinkId
  parentRerouteId?: RerouteId
}

export interface AddNodeInputParams {
  nodeId: NodeId
  name: string
  type: string
  extra_info?: Record<string, any>
}

export interface AddNodeOutputParams {
  nodeId: NodeId
  name: string
  type: string
  extra_info?: Record<string, any>
}

export interface CreateSubgraphParams {
  selectedItems: Set<any>
}

export interface ClipboardData {
  nodes: any[]
  connections: any[]
  isCut: boolean
}

export interface ValidationResult {
  valid: boolean
  errors?: ValidationError[]
  warnings?: ValidationWarning[]
}

export interface ValidationError {
  code: string
  message: string
  field?: string
}

export interface ValidationWarning {
  code: string
  message: string
}

export interface IGraphMutationService {
  // Node operations
  addNode(params: AddNodeParams): Promise<NodeId>
  removeNode(nodeId: NodeId): Promise<void>
  updateNodeProperty(
    nodeId: NodeId,
    property: string,
    value: any
  ): Promise<void>
  updateNodeTitle(nodeId: NodeId, title: string): Promise<void>
  changeNodeMode(nodeId: NodeId, mode: number): Promise<void>
  cloneNode(nodeId: NodeId, pos?: [number, number]): Promise<NodeId>

  connect(params: ConnectParams): Promise<LinkId>
  disconnect(
    nodeId: NodeId,
    slot: number | string,
    slotType: 'input' | 'output',
    targetNodeId?: NodeId
  ): Promise<boolean>
  disconnectInput(nodeId: NodeId, slot: number | string): Promise<boolean>
  disconnectOutput(nodeId: NodeId, slot: number | string): Promise<boolean>
  disconnectOutputTo(
    nodeId: NodeId,
    slot: number | string,
    targetNodeId: NodeId
  ): Promise<boolean>
  disconnectLink(linkId: LinkId): Promise<void>

  createGroup(params: CreateGroupParams): Promise<GroupId>
  removeGroup(groupId: GroupId): Promise<void>
  updateGroupTitle(groupId: GroupId, title: string): Promise<void>
  moveGroup(groupId: GroupId, deltaX: number, deltaY: number): Promise<void>
  addNodesToGroup(groupId: GroupId, nodeIds: NodeId[]): Promise<void>
  recomputeGroupNodes(groupId: GroupId): Promise<void>

  addReroute(params: AddRerouteParams): Promise<RerouteId>
  removeReroute(rerouteId: RerouteId): Promise<void>

  addNodes(nodes: AddNodeParams[]): Promise<NodeId[]>
  removeNodes(nodeIds: NodeId[]): Promise<void>
  duplicateNodes(
    nodeIds: NodeId[],
    offset?: [number, number]
  ): Promise<NodeId[]>

  copyNodes(nodeIds: NodeId[]): Promise<void>
  cutNodes(nodeIds: NodeId[]): Promise<void>
  pasteNodes(position?: [number, number]): Promise<NodeId[]>
  getClipboard(): ClipboardData | null
  clearClipboard(): void
  hasClipboardContent(): boolean

  addSubgraphNodeInput(params: AddNodeInputParams): Promise<number>
  addSubgraphNodeOutput(params: AddNodeOutputParams): Promise<number>
  removeSubgraphNodeInput(nodeId: NodeId, slot: number): Promise<void>
  removeSubgraphNodeOutput(nodeId: NodeId, slot: number): Promise<void>

  createSubgraph(params: CreateSubgraphParams): Promise<{
    subgraph: any
    node: any
  }>
  unpackSubgraph(subgraphNodeId: NodeId): Promise<void>
  addSubgraphInput(
    subgraphId: SubgraphId,
    name: string,
    type: string
  ): Promise<void>
  addSubgraphOutput(
    subgraphId: SubgraphId,
    name: string,
    type: string
  ): Promise<void>
  removeSubgraphInput(subgraphId: SubgraphId, index: number): Promise<void>
  removeSubgraphOutput(subgraphId: SubgraphId, index: number): Promise<void>

  clearGraph(): Promise<void>

  bypassNode(nodeId: NodeId): Promise<void>
  unbypassNode(nodeId: NodeId): Promise<void>

  transaction<T>(fn: () => Promise<T>): Promise<T>

  undo(): Promise<void>
  redo(): Promise<void>
}
