import type {
  Size2D,
  Point2D as Point,
  Size2D as Size,
  Bounds
} from '@comfyorg/shared-frontend-utils/geometry'
import type { NodeLayout, GroupLayout } from '@comfyorg/graph-model/layout'
/**
 * Layout System - Type Definitions
 *
 * This file contains all type definitions for the layout system
 * that manages node positions, bounds, spatial data, and operations.
 */
import type { GroupId } from '@comfyorg/graph-model/groupId'
import type { LinkId } from '@comfyorg/graph-model/linkId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { RerouteId } from '@comfyorg/graph-model/rerouteId'
import type { UUID } from '@comfyorg/graph-model/uuid'

// Enum for layout source types
export enum LayoutSource {
  Canvas = 'canvas',
  Vue = 'vue'
}

export type { NodeId } from '@comfyorg/graph-model/nodeId'

export interface LinkLayout {
  id: LinkId
  path: Path2D
  bounds: Bounds
  centerPos: Point
  sourceNodeId: NodeId
  targetNodeId: NodeId
  sourceSlot: number
  targetSlot: number
}

// Layout for individual link segments (for precise hit-testing)
export interface LinkSegmentLayout {
  linkId: LinkId
  rerouteId: RerouteId | null // null for final segment to target
  path: Path2D
  bounds: Bounds
  centerPos: Point
}

/**
 * Meta-only base for all operations - contains common fields
 */
interface OperationMeta {
  /** Timestamp for ordering operations */
  timestamp: number
  /** Actor who performed the operation (for CRDT) */
  actor?: string
  /** Originating semantic op identity when applied by a remote follower. */
  opId?: string
  /** Source system that initiated the operation */
  source: LayoutSource
  graphId: UUID
  /** Operation type discriminator */
  type: OperationType
}

type NodeOpBase = OperationMeta & { nodeId: NodeId }
type RerouteOpBase = OperationMeta & { rerouteId: RerouteId }

/**
 * Operation type discriminator for type narrowing
 */
type OperationType =
  | 'moveNode'
  | 'resizeNode'
  | 'setNodeZIndex'
  | 'createNode'
  | 'deleteNode'
  | 'batchUpdateBounds'
  | 'createReroute'
  | 'deleteReroute'
  | 'moveReroute'
  | 'createGroup'
  | 'setGroupBounds'
  | 'deleteGroup'
  | 'clearGraph'

/**
 * Move node operation
 */
export interface MoveNodeOperation extends NodeOpBase {
  type: 'moveNode'
  position: Point
}

/**
 * Resize node operation
 */
export interface ResizeNodeOperation extends NodeOpBase {
  type: 'resizeNode'
  size: Size2D
}

/**
 * Set node z-index operation
 */
export interface SetNodeZIndexOperation extends NodeOpBase {
  type: 'setNodeZIndex'
  zIndex: number
}

/**
 * Create node operation
 */
export interface CreateNodeOperation extends NodeOpBase {
  type: 'createNode'
  layout: NodeLayout
}

/**
 * Delete node operation
 */
export interface DeleteNodeOperation extends NodeOpBase {
  type: 'deleteNode'
}

/**
 * Batch update operation for atomic multi-property changes
 */
export interface BatchUpdateBoundsOperation extends OperationMeta {
  type: 'batchUpdateBounds'
  nodeIds: NodeId[]
  bounds: Record<NodeId, Bounds>
}

/**
 * Create reroute operation
 */
export interface CreateRerouteOperation extends RerouteOpBase {
  type: 'createReroute'
  position: Point
}

/**
 * Delete reroute operation
 */
export interface DeleteRerouteOperation extends RerouteOpBase {
  type: 'deleteReroute'
}

/**
 * Move reroute operation
 */
export interface MoveRerouteOperation extends RerouteOpBase {
  type: 'moveReroute'
  position: Point
}

type GroupOpBase = OperationMeta & {
  groupId: GroupId
}

interface CreateGroupOperation extends GroupOpBase {
  type: 'createGroup'
  layout: GroupLayout
}

/**
 * Groups move and resize as one Rectangle, so a single bounds operation keeps
 * position and size from ever being written apart.
 */
export interface SetGroupBoundsOperation extends GroupOpBase {
  type: 'setGroupBounds'
  position: Point
  size: Size
}

interface DeleteGroupOperation extends GroupOpBase {
  type: 'deleteGroup'
}

interface ClearGraphOperation extends OperationMeta {
  type: 'clearGraph'
}

/**
 * Union of all operation types
 */
export type LayoutOperation =
  | MoveNodeOperation
  | ResizeNodeOperation
  | SetNodeZIndexOperation
  | CreateNodeOperation
  | DeleteNodeOperation
  | BatchUpdateBoundsOperation
  | CreateRerouteOperation
  | DeleteRerouteOperation
  | MoveRerouteOperation
  | CreateGroupOperation
  | SetGroupBoundsOperation
  | DeleteGroupOperation
  | ClearGraphOperation

export interface LayoutChange {
  type: 'create' | 'update' | 'delete'
  nodeIds: NodeId[]
  sizeChangedNodeIds: NodeId[]
  timestamp: number
  source: LayoutSource
  operation: LayoutOperation
}
