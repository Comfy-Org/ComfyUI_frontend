/**
 * Layout System - Type Definitions
 *
 * This file contains all type definitions for the layout system
 * that manages node positions, bounds, spatial data, and operations.
 */
import type { ComputedRef, Ref } from 'vue'

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
  nodeId: NodeId
  bounds: Bounds
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
  /** Operation type discriminator */
  type: OperationType
}

/**
 * Entity-specific base types for proper type discrimination
 */
type NodeOpBase = OperationMeta & { entity: 'node'; nodeId: NodeId }
type RerouteOpBase = OperationMeta & {
  entity: 'reroute'
  graphId: UUID
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
  entity: 'node'
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
  entity: 'group'
  graphId: UUID
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

export interface LayoutChange {
  type: 'create' | 'update' | 'delete'
  nodeIds: NodeId[]
  timestamp: number
  source: LayoutSource
  operation: LayoutOperation
}

// Store interfaces
export interface LayoutStore {
  // CustomRef accessors for shared write access
  getNodeLayoutRef(nodeId: NodeId): Ref<NodeLayout | null>
  getNodesInBounds(bounds: Bounds): ComputedRef<NodeId[]>
  getAllNodes(): ComputedRef<ReadonlyMap<NodeId, NodeLayout>>
  getAllGroups(
    rootGraphId: UUID
  ): ComputedRef<ReadonlyMap<GroupId, GroupLayout>>
  getGroupLayout(rootGraphId: UUID, groupId: GroupId): GroupLayout | null
  getVersion(): ComputedRef<number>

  // Spatial queries (non-reactive)
  queryNodeAtPoint(point: Point): NodeId | null
  queryNodesInBounds(bounds: Bounds): NodeId[]

  // Hit testing queries for links, slots, and reroutes
  queryLinkAtPoint(point: Point, ctx?: CanvasRenderingContext2D): LinkId | null
  queryLinkSegmentAtPoint(
    point: Point,
    ctx?: CanvasRenderingContext2D
  ): { linkId: LinkId; rerouteId: RerouteId | null } | null
  querySlotAtPoint(point: Point): SlotLayout | null
  queryRerouteAtPoint(rootGraphId: UUID, point: Point): RerouteLayout | null
  queryItemsInBounds(
    rootGraphId: UUID,
    bounds: Bounds
  ): {
    nodes: NodeId[]
    links: LinkId[]
    slots: SlotId[]
    reroutes: RerouteId[]
  }

  // Update methods for link, slot, and reroute layouts
  updateLinkLayout(linkId: LinkId, layout: LinkLayout): void
  updateLinkSegmentLayout(
    linkId: LinkId,
    rerouteId: RerouteId | null,
    layout: Omit<LinkSegmentLayout, 'linkId' | 'rerouteId'>
  ): void
  updateSlotLayout(key: SlotId, layout: SlotLayout): void
  updateRerouteLayout(
    rootGraphId: UUID,
    rerouteId: RerouteId,
    layout: RerouteLayout
  ): void

  // Delete methods for cleanup
  deleteLinkLayout(linkId: LinkId): void
  deleteLinkSegmentLayout(linkId: LinkId, rerouteId: RerouteId | null): void
  deleteSlotLayout(key: SlotId): void
  clearAllSlotLayouts(): void

  // Get layout data
  getLinkLayout(linkId: LinkId): LinkLayout | null
  getSlotLayout(key: SlotId): SlotLayout | null
  getRerouteLayout(
    rootGraphId: UUID,
    rerouteId: RerouteId
  ): RerouteLayout | null

  // Returns all slot layout keys currently tracked by the store
  getAllSlotKeys(): SlotId[]

  // Direct mutation API (CRDT-ready)
  applyOperation(operation: LayoutOperation): void

  // Change subscription
  onChange(callback: (change: LayoutChange) => void): () => void
  onNodeChange(
    nodeId: NodeId,
    callback: (change: LayoutChange) => void
  ): () => void

  /** @see {@link LayoutStoreImpl.clearViewGeometry} */
  clearViewGeometry(): void

  // Source and actor management
  setSource(source: LayoutSource): void
  setActor(actor: string): void
  getCurrentSource(): LayoutSource
  getCurrentActor(): string

  // Batch updates
  batchUpdateNodeBounds(updates: NodeBoundsUpdate[]): void

  batchUpdateSlotLayouts(
    updates: Array<{ key: SlotId; layout: SlotLayout }>
  ): void
}
