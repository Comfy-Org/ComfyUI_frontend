/**
 * Layout System - Type Definitions
 *
 * This file contains all type definitions for the layout system
 * that manages node positions, bounds, spatial data, and operations.
 */
import type { ComputedRef, Ref } from 'vue'

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
export type LinkId = string
export type RerouteId = string

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
  id: string
  path: Path2D
  bounds: Bounds
  centerPos: Point
  sourceNodeId: NodeId
  targetNodeId: NodeId
  sourceSlot: number
  targetSlot: number
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

// Mutation types (legacy - for compatibility)
export type LayoutMutationType =
  | 'moveNode'
  | 'resizeNode'
  | 'setNodeZIndex'
  | 'createNode'
  | 'deleteNode'
  | 'batch'

export interface LayoutMutation {
  type: LayoutMutationType
  timestamp: number
  source: 'canvas' | 'vue' | 'external'
}

export interface MoveNodeMutation extends LayoutMutation {
  type: 'moveNode'
  nodeId: NodeId
  position: Point
  previousPosition?: Point
}

export interface ResizeNodeMutation extends LayoutMutation {
  type: 'resizeNode'
  nodeId: NodeId
  size: Size
  previousSize?: Size
}

export interface SetNodeZIndexMutation extends LayoutMutation {
  type: 'setNodeZIndex'
  nodeId: NodeId
  zIndex: number
  previousZIndex?: number
}

export interface CreateNodeMutation extends LayoutMutation {
  type: 'createNode'
  nodeId: NodeId
  layout: NodeLayout
}

export interface DeleteNodeMutation extends LayoutMutation {
  type: 'deleteNode'
  nodeId: NodeId
  previousLayout?: NodeLayout
}

export interface BatchMutation extends LayoutMutation {
  type: 'batch'
  mutations: AnyLayoutMutation[]
}

// Union type for all mutations
export type AnyLayoutMutation =
  | MoveNodeMutation
  | ResizeNodeMutation
  | SetNodeZIndexMutation
  | CreateNodeMutation
  | DeleteNodeMutation
  | BatchMutation

// CRDT Operation Types
/**
 * Base operation interface that all operations extend
 */
export interface BaseOperation {
  /** Unique operation ID for deduplication */
  id?: string
  /** Timestamp for ordering operations */
  timestamp: number
  /** Actor who performed the operation (for CRDT) */
  actor: string
  /** Source system that initiated the operation */
  source: 'canvas' | 'vue' | 'external'
  /** Node this operation affects */
  nodeId: NodeId
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

/**
 * Move node operation
 */
export interface MoveNodeOperation extends BaseOperation {
  type: 'moveNode'
  position: Point
  previousPosition: Point
}

/**
 * Resize node operation
 */
export interface ResizeNodeOperation extends BaseOperation {
  type: 'resizeNode'
  size: { width: number; height: number }
  previousSize: { width: number; height: number }
}

/**
 * Set node z-index operation
 */
export interface SetNodeZIndexOperation extends BaseOperation {
  type: 'setNodeZIndex'
  zIndex: number
  previousZIndex: number
}

/**
 * Create node operation
 */
export interface CreateNodeOperation extends BaseOperation {
  type: 'createNode'
  layout: NodeLayout
}

/**
 * Delete node operation
 */
export interface DeleteNodeOperation extends BaseOperation {
  type: 'deleteNode'
  previousLayout: NodeLayout
}

/**
 * Set node visibility operation
 */
export interface SetNodeVisibilityOperation extends BaseOperation {
  type: 'setNodeVisibility'
  visible: boolean
  previousVisible: boolean
}

/**
 * Batch update operation for atomic multi-property changes
 */
export interface BatchUpdateOperation extends BaseOperation {
  type: 'batchUpdate'
  updates: Partial<NodeLayout>
  previousValues: Partial<NodeLayout>
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

// Legacy alias for compatibility
export type AnyLayoutOperation = LayoutOperation

/**
 * Type guards for operations
 */
export const isBaseOperation = (op: unknown): op is BaseOperation => {
  return (
    typeof op === 'object' &&
    op !== null &&
    'timestamp' in op &&
    'actor' in op &&
    'source' in op &&
    'nodeId' in op
  )
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
  source: 'canvas' | 'vue' | 'external'
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
  updateSlotLayout(key: string, layout: SlotLayout): void
  updateRerouteLayout(rerouteId: RerouteId, layout: RerouteLayout): void

  // Delete methods for cleanup
  deleteLinkLayout(linkId: LinkId): void
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
  setSource(source: 'canvas' | 'vue' | 'external'): void
  setActor(actor: string): void
  getCurrentSource(): 'canvas' | 'vue' | 'external'
  getCurrentActor(): string
}

// Simplified mutation API
export interface LayoutMutations {
  // Single node operations (synchronous, CRDT-ready)
  moveNode(nodeId: NodeId, position: Point): void
  resizeNode(nodeId: NodeId, size: Size): void
  setNodeZIndex(nodeId: NodeId, zIndex: number): void

  // Lifecycle operations
  createNode(nodeId: NodeId, layout: Partial<NodeLayout>): void
  deleteNode(nodeId: NodeId): void

  // Stacking operations
  bringNodeToFront(nodeId: NodeId): void

  // Source tracking
  setSource(source: 'canvas' | 'vue' | 'external'): void
  setActor(actor: string): void // For CRDT
}

// CRDT-ready operation log (for future CRDT integration)
export interface OperationLog {
  operations: LayoutOperation[]
  addOperation(operation: LayoutOperation): void
  getOperationsSince(timestamp: number): LayoutOperation[]
  getOperationsByActor(actor: string): LayoutOperation[]
}
