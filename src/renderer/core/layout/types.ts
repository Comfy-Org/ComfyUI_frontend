/**
 * Layout System - Type Definitions
 *
 * This file contains all type definitions for the layout system
 * that manages node positions, bounds, spatial data, and operations.
 */
import type { ComputedRef, Ref } from 'vue'

// Enum for layout source types
export enum LayoutSource {
  Canvas = 'canvas',
  Vue = 'vue',
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

// ID types for type safety
export type NodeId = string
export type SlotId = string
export type ConnectionId = string
export type LinkId = number // Aligned with Litegraph's numeric LinkId
export type RerouteId = number // Aligned with Litegraph's numeric RerouteId

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
  index: number
  type: 'input' | 'output'
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

export interface RerouteLayout {
  id: RerouteId
  position: Point
  radius: number
  bounds: Bounds
}

export interface ConnectionLayout {
  id: ConnectionId
  sourceSlot: SlotId
  targetSlot: SlotId
  // Control points for curved connections
  controlPoints?: Point[]
}

// CRDT Operation Types

/**
 * Meta-only base for all operations - contains common fields
 */
export interface OperationMeta {
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
export type NodeOpBase = OperationMeta & { entity: 'node'; nodeId: NodeId }
export type LinkOpBase = OperationMeta & { entity: 'link'; linkId: LinkId }
export type RerouteOpBase = OperationMeta & {
  entity: 'reroute'
  rerouteId: RerouteId
}

/**
 * Operation type discriminator for type narrowing
 */
export type OperationType =
  | 'moveNode'
  | 'resizeNode'
  | 'setNodeZIndex'
  | 'createNode'
  | 'deleteNode'
  | 'setNodeVisibility'
  | 'batchUpdate'
  | 'createLink'
  | 'deleteLink'
  | 'createReroute'
  | 'deleteReroute'
  | 'moveReroute'

/**
 * Move node operation
 */
export interface MoveNodeOperation extends NodeOpBase {
  type: 'moveNode'
  position: Point
  previousPosition: Point
}

/**
 * Resize node operation
 */
export interface ResizeNodeOperation extends NodeOpBase {
  type: 'resizeNode'
  size: { width: number; height: number }
  previousSize: { width: number; height: number }
}

/**
 * Set node z-index operation
 */
export interface SetNodeZIndexOperation extends NodeOpBase {
  type: 'setNodeZIndex'
  zIndex: number
  previousZIndex: number
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
  previousLayout: NodeLayout
}

/**
 * Set node visibility operation
 */
export interface SetNodeVisibilityOperation extends NodeOpBase {
  type: 'setNodeVisibility'
  visible: boolean
  previousVisible: boolean
}

/**
 * Batch update operation for atomic multi-property changes
 */
export interface BatchUpdateOperation extends NodeOpBase {
  type: 'batchUpdate'
  updates: Partial<NodeLayout>
  previousValues: Partial<NodeLayout>
}

/**
 * Create link operation
 */
export interface CreateLinkOperation extends LinkOpBase {
  type: 'createLink'
  sourceNodeId: NodeId
  sourceSlot: number
  targetNodeId: NodeId
  targetSlot: number
}

/**
 * Delete link operation
 */
export interface DeleteLinkOperation extends LinkOpBase {
  type: 'deleteLink'
}

/**
 * Create reroute operation
 */
export interface CreateRerouteOperation extends RerouteOpBase {
  type: 'createReroute'
  position: Point
  parentId?: RerouteId
  linkIds: LinkId[]
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
  previousPosition: Point
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
  | BatchUpdateOperation
  | CreateLinkOperation
  | DeleteLinkOperation
  | CreateRerouteOperation
  | DeleteRerouteOperation
  | MoveRerouteOperation

// Legacy alias for compatibility
export type AnyLayoutOperation = LayoutOperation

/**
 * Type guards for operations
 */
export const isOperationMeta = (op: unknown): op is OperationMeta => {
  return (
    typeof op === 'object' &&
    op !== null &&
    'timestamp' in op &&
    'actor' in op &&
    'source' in op &&
    'type' in op
  )
}

/**
 * Entity-specific helper functions
 */
export const isNodeOperation = (op: LayoutOperation): boolean => {
  return 'entity' in op && (op as any).entity === 'node'
}

export const isLinkOperation = (op: LayoutOperation): boolean => {
  return 'entity' in op && (op as any).entity === 'link'
}

export const isRerouteOperation = (op: LayoutOperation): boolean => {
  return 'entity' in op && (op as any).entity === 'reroute'
}

export const isMoveNodeOperation = (
  op: LayoutOperation
): op is MoveNodeOperation => op.type === 'moveNode'

export const isResizeNodeOperation = (
  op: LayoutOperation
): op is ResizeNodeOperation => op.type === 'resizeNode'

export const isCreateNodeOperation = (
  op: LayoutOperation
): op is CreateNodeOperation => op.type === 'createNode'

export const isDeleteNodeOperation = (
  op: LayoutOperation
): op is DeleteNodeOperation => op.type === 'deleteNode'

export const isSetNodeVisibilityOperation = (
  op: LayoutOperation
): op is SetNodeVisibilityOperation => op.type === 'setNodeVisibility'

export const isBatchUpdateOperation = (
  op: LayoutOperation
): op is BatchUpdateOperation => op.type === 'batchUpdate'

export const isCreateLinkOperation = (
  op: LayoutOperation
): op is CreateLinkOperation => op.type === 'createLink'

export const isDeleteLinkOperation = (
  op: LayoutOperation
): op is DeleteLinkOperation => op.type === 'deleteLink'

export const isCreateRerouteOperation = (
  op: LayoutOperation
): op is CreateRerouteOperation => op.type === 'createReroute'

export const isDeleteRerouteOperation = (
  op: LayoutOperation
): op is DeleteRerouteOperation => op.type === 'deleteReroute'

export const isMoveRerouteOperation = (
  op: LayoutOperation
): op is MoveRerouteOperation => op.type === 'moveReroute'

/**
 * Helper function to get affected node IDs from any operation
 * Useful for change notifications and cache invalidation
 */
export const getAffectedNodeIds = (op: LayoutOperation): NodeId[] => {
  switch (op.type) {
    case 'moveNode':
    case 'resizeNode':
    case 'setNodeZIndex':
    case 'createNode':
    case 'deleteNode':
    case 'setNodeVisibility':
    case 'batchUpdate':
      return [(op as NodeOpBase).nodeId]
    case 'createLink': {
      const createLink = op as CreateLinkOperation
      return [createLink.sourceNodeId, createLink.targetNodeId]
    }
    case 'deleteLink':
      // Link deletion doesn't directly affect nodes
      return []
    case 'createReroute':
    case 'deleteReroute':
    case 'moveReroute':
      // Reroute operations don't directly affect nodes
      return []
    default:
      return []
  }
}

/**
 * Operation application interface
 */
export interface OperationApplicator<
  T extends LayoutOperation = LayoutOperation
> {
  canApply(operation: T): boolean
  apply(operation: T): void
  reverse(operation: T): void
}

/**
 * Operation serialization for network/storage
 */
export interface OperationSerializer {
  serialize(operation: LayoutOperation): string
  deserialize(data: string): LayoutOperation
}

/**
 * Conflict resolution strategy
 */
export interface ConflictResolver {
  resolve(op1: LayoutOperation, op2: LayoutOperation): LayoutOperation[]
}

// Change notification types
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
  queryRerouteAtPoint(point: Point): RerouteLayout | null
  queryItemsInBounds(bounds: Bounds): {
    nodes: NodeId[]
    links: LinkId[]
    slots: string[]
    reroutes: RerouteId[]
  }

  // Update methods for link, slot, and reroute layouts
  updateLinkLayout(linkId: LinkId, layout: LinkLayout): void
  updateLinkSegmentLayout(
    linkId: LinkId,
    rerouteId: RerouteId | null,
    layout: Omit<LinkSegmentLayout, 'linkId' | 'rerouteId'>
  ): void
  updateSlotLayout(key: string, layout: SlotLayout): void
  updateRerouteLayout(rerouteId: RerouteId, layout: RerouteLayout): void

  // Delete methods for cleanup
  deleteLinkLayout(linkId: LinkId): void
  deleteLinkSegmentLayout(linkId: LinkId, rerouteId: RerouteId | null): void
  deleteSlotLayout(key: string): void
  deleteNodeSlotLayouts(nodeId: NodeId): void
  deleteRerouteLayout(rerouteId: RerouteId): void

  // Get layout data
  getLinkLayout(linkId: LinkId): LinkLayout | null
  getSlotLayout(key: string): SlotLayout | null
  getRerouteLayout(rerouteId: RerouteId): RerouteLayout | null

  // Direct mutation API (CRDT-ready)
  applyOperation(operation: LayoutOperation): void

  // Change subscription
  onChange(callback: (change: LayoutChange) => void): () => void

  // Initialization
  initializeFromLiteGraph(
    nodes: Array<{ id: string; pos: [number, number]; size: [number, number] }>
  ): void

  // Source and actor management
  setSource(source: LayoutSource): void
  setActor(actor: string): void
  getCurrentSource(): LayoutSource
  getCurrentActor(): string
}

// CRDT-ready operation log (for future CRDT integration)
export interface OperationLog {
  operations: LayoutOperation[]
  addOperation(operation: LayoutOperation): void
  getOperationsSince(timestamp: number): LayoutOperation[]
  getOperationsByActor(actor: string): LayoutOperation[]
}
