/**
 * Graph Mutation Command System - Type Definitions
 *
 * Defines command types for graph mutation operations with CRDT support.
 * Each command represents an atomic operation that can be applied, undone, and synchronized.
 */
import type { GroupId } from '@/lib/litegraph/src/LGraphGroup'
import type { LinkId } from '@/lib/litegraph/src/LLink'
import type { RerouteId } from '@/lib/litegraph/src/Reroute'
import type { SubgraphId } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'

export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E }

export interface CreateNodeParams {
  type: string
  properties?: Record<string, any>
  title?: string
  id?: NodeId // Support custom ID for loading workflows
}

export interface UpdateNodePropertyParams {
  nodeId: NodeId
  property: string
  value: any
}

export interface UpdateNodeTitleParams {
  nodeId: NodeId
  title: string
}

export interface ChangeNodeModeParams {
  nodeId: NodeId
  mode: number
}

export interface ConnectParams {
  sourceNodeId: NodeId
  sourceSlot: number | string
  targetNodeId: NodeId
  targetSlot: number | string
}

export interface DisconnectParams {
  nodeId: NodeId
  slot: number | string
  slotType: 'input' | 'output'
  targetNodeId?: NodeId
}

export interface CreateGroupParams {
  title?: string
  size?: [number, number]
  color?: string
  fontSize?: number
}

export interface UpdateGroupTitleParams {
  groupId: GroupId
  title: string
}

export interface AddNodesToGroupParams {
  groupId: GroupId
  nodeIds: NodeId[]
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

export interface NodeInputSlotParams {
  nodeId: NodeId
  slot: number
}

export interface SubgraphNameTypeParams {
  subgraphId: SubgraphId
  name: string
  type: string
}

export interface SubgraphIndexParams {
  subgraphId: SubgraphId
  index: number
}

export enum CommandOrigin {
  Local = 'local'
}

export type GraphMutationOperation =
  | createNodeCommand
  | RemoveNodeCommand
  | UpdateNodePropertyCommand
  | UpdateNodeTitleCommand
  | ChangeNodeModeCommand
  | CloneNodeCommand
  | BypassNodeCommand
  | UnbypassNodeCommand
  | ConnectCommand
  | DisconnectCommand
  | DisconnectLinkCommand
  | CreateGroupCommand
  | RemoveGroupCommand
  | UpdateGroupTitleCommand
  | AddNodesToGroupCommand
  | RecomputeGroupNodesCommand
  | AddRerouteCommand
  | RemoveRerouteCommand
  | CopyNodesCommand
  | CutNodesCommand
  | PasteNodesCommand
  | CreateSubgraphCommand
  | UnpackSubgraphCommand
  | AddSubgraphNodeInputCommand
  | AddSubgraphNodeOutputCommand
  | RemoveSubgraphNodeInputCommand
  | RemoveSubgraphNodeOutputCommand
  | AddSubgraphInputCommand
  | AddSubgraphOutputCommand
  | RemoveSubgraphInputCommand
  | RemoveSubgraphOutputCommand
  | ClearGraphCommand
  | bypassNodeCommand
  | unbypassNodeCommand
  | undoCommand
  | redoCommand

interface GraphOpBase {
  /** Timestamp for ordering commands */
  timestamp: number
  /** Origin of the command */
  origin: CommandOrigin
}

export interface createNodeCommand extends GraphOpBase {
  type: 'createNode'
  params: CreateNodeParams
}

export interface RemoveNodeCommand extends GraphOpBase {
  type: 'removeNode'
  params: NodeId
}

export interface UpdateNodePropertyCommand extends GraphOpBase {
  type: 'updateNodeProperty'
  params: UpdateNodePropertyParams
}

export interface UpdateNodeTitleCommand extends GraphOpBase {
  type: 'updateNodeTitle'
  params: UpdateNodeTitleParams
}

export interface ChangeNodeModeCommand extends GraphOpBase {
  type: 'changeNodeMode'
  params: ChangeNodeModeParams
}

export interface CloneNodeCommand extends GraphOpBase {
  type: 'cloneNode'
  params: NodeId
}

export interface BypassNodeCommand extends GraphOpBase {
  type: 'bypassNode'
  params: NodeId
}

export interface UnbypassNodeCommand extends GraphOpBase {
  type: 'unbypassNode'
  params: NodeId
}

export interface ConnectCommand extends GraphOpBase {
  type: 'connect'
  params: ConnectParams
}

export interface DisconnectCommand extends GraphOpBase {
  type: 'disconnect'
  params: DisconnectParams
}

export interface DisconnectLinkCommand extends GraphOpBase {
  type: 'disconnectLink'
  params: LinkId
}

export interface CreateGroupCommand extends GraphOpBase {
  type: 'createGroup'
  params: CreateGroupParams
}

export interface RemoveGroupCommand extends GraphOpBase {
  type: 'removeGroup'
  params: GroupId
}

export interface UpdateGroupTitleCommand extends GraphOpBase {
  type: 'updateGroupTitle'
  params: UpdateGroupTitleParams
}

export interface AddNodesToGroupCommand extends GraphOpBase {
  type: 'addNodesToGroup'
  params: AddNodesToGroupParams
}

export interface RecomputeGroupNodesCommand extends GraphOpBase {
  type: 'recomputeGroupNodes'
  params: GroupId
}

// Reroute Commands
export interface AddRerouteCommand extends GraphOpBase {
  type: 'addReroute'
  params: AddRerouteParams
}

export interface RemoveRerouteCommand extends GraphOpBase {
  type: 'removeReroute'
  params: RerouteId
}

export interface CopyNodesCommand extends GraphOpBase {
  type: 'copyNodes'
  nodeIds: NodeId[]
}

export interface CutNodesCommand extends GraphOpBase {
  type: 'cutNodes'
  params: NodeId[]
}

export interface PasteNodesCommand extends GraphOpBase {
  type: 'pasteNodes'
}

export interface CreateSubgraphCommand extends GraphOpBase {
  type: 'createSubgraph'
  params: CreateSubgraphParams
}

export interface UnpackSubgraphCommand extends GraphOpBase {
  type: 'unpackSubgraph'
  params: NodeId
}

export interface AddSubgraphNodeInputCommand extends GraphOpBase {
  type: 'addSubgraphNodeInput'
  params: AddNodeInputParams
}

export interface AddSubgraphNodeOutputCommand extends GraphOpBase {
  type: 'addSubgraphNodeOutput'
  params: AddNodeOutputParams
}

export interface RemoveSubgraphNodeInputCommand extends GraphOpBase {
  type: 'removeSubgraphNodeInput'
  params: NodeInputSlotParams
}

export interface RemoveSubgraphNodeOutputCommand extends GraphOpBase {
  type: 'removeSubgraphNodeOutput'
  params: NodeInputSlotParams
}

export interface AddSubgraphInputCommand extends GraphOpBase {
  type: 'addSubgraphInput'
  params: SubgraphNameTypeParams
}

export interface AddSubgraphOutputCommand extends GraphOpBase {
  type: 'addSubgraphOutput'
  params: SubgraphNameTypeParams
}

export interface RemoveSubgraphInputCommand extends GraphOpBase {
  type: 'removeSubgraphInput'
  params: SubgraphIndexParams
}

export interface RemoveSubgraphOutputCommand extends GraphOpBase {
  type: 'removeSubgraphOutput'
  params: SubgraphIndexParams
}

export interface ClearGraphCommand extends GraphOpBase {
  type: 'clearGraph'
}

export interface bypassNodeCommand extends GraphOpBase {
  type: 'bypassNode'
  params: NodeId
}

export interface unbypassNodeCommand extends GraphOpBase {
  type: 'unbypassNode'
  params: NodeId
}

export interface undoCommand extends GraphOpBase {
  type: 'undo'
}

export interface redoCommand extends GraphOpBase {
  type: 'redo'
}
