/**
 * Layout System - Type Definitions
 *
 * This file contains all type definitions for the layout system
 * that manages node positions, bounds, spatial data, and operations.
 */
import type { GroupId } from '@/types/groupId'
import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'
import type { RerouteId } from '@/types/rerouteId'
import type { SlotDirection, SlotId, SlotIndex } from '@/types/slotId'
import type { UUID } from '@/utils/uuid'

// Enum for layout source types
export enum LayoutSource {
  Canvas = 'canvas',
  Vue = 'vue',
  DOM = 'dom',
  External = 'external'
}

// Basic geometric types
export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface NodeBoundsUpdate {
  bounds: Bounds
  nodeId: NodeId
}

export type { LinkId }
export type { NodeId }
export type { RerouteId }
export type { SlotId }

// Layout data structures
export interface NodeLayout {
  id: NodeId
  position: Point
  size: Size
  zIndex: number
  visible: boolean
  // Computed bounds for hit testing
  bounds: Bounds
}

export interface SlotLayout {
  nodeId: NodeId
  index: SlotIndex
  type: SlotDirection
  position: Point
  bounds: Bounds
}

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
 * A group's geometry. Unlike {@link NodeLayout} there is no zIndex or spatial
 * index: groups draw beneath nodes in insertion order and are hit-tested by the
 * canvas against their own bounds, so nothing queries them positionally.
 */
export interface GroupLayout {
  id: GroupId
  position: Point
  size: Size
}

export interface RerouteLayout {
  id: RerouteId
  position: Point
  radius: number
  bounds: Bounds
}

/**
 * Meta-only base for all operations - contains common fields
 */
interface OperationMeta {
  /** Unique operation ID for deduplication */
  id?: string
  /** Timestamp for ordering operations */
  timestamp: number
  /** Actor who performed the operation (for CRDT) */
  actor: string
  /** Source system that initiated the operation */
  source: LayoutSource
  graphId: UUID
  /** Operation type discriminator */
  type: OperationType
}

export type LayoutOperationResult = 'applied' | 'no-op' | 'rejected'

/**
 * Entity-specific base types for proper type discrimination
 */
type NodeOpBase = OperationMeta & {
  entity: 'node'
  nodeId: NodeId
}
type RerouteOpBase = OperationMeta & {
  entity: 'reroute'
  rerouteId: RerouteId
}

/**
 * Operation type discriminator for type narrowing
 */
type OperationType =
  | 'moveNode'
  | 'resizeNode'
  | 'setNodeZIndex'
  | 'createNode'
  | 'deleteNode'
  | 'setNodeVisibility'
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
  size: { width: number; height: number }
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
  layout: NodeLayout
  type: 'createNode'
}

/**
 * Delete node operation
 */
export interface DeleteNodeOperation extends NodeOpBase {
  type: 'deleteNode'
}

/**
 * Set node visibility operation
 */
interface SetNodeVisibilityOperation extends NodeOpBase {
  type: 'setNodeVisibility'
  visible: boolean
}

/**
 * Batch update operation for atomic multi-property changes
 */
export interface BatchUpdateBoundsOperation extends OperationMeta {
  bounds: Record<NodeId, Bounds>
  entity: 'node'
  nodeIds: NodeId[]
  type: 'batchUpdateBounds'
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
  position: Point
  type: 'moveReroute'
}

type GroupOpBase = OperationMeta & {
  entity: 'group'
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
  position: Point
  size: Size
  type: 'setGroupBounds'
}

interface DeleteGroupOperation extends GroupOpBase {
  type: 'deleteGroup'
}

interface ClearGraphOperation extends OperationMeta {
  entity: 'graph'
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
  | SetNodeVisibilityOperation
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
