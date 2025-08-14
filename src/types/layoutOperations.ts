/**
 * Layout Operation Types
 *
 * Defines the operation interface for the CRDT-based layout system.
 * Each operation is immutable and contains all information needed for:
 * - Application (forward)
 * - Undo/redo (reverse)
 * - Conflict resolution (CRDT)
 * - Debugging (actor, timestamp, source)
 */
import type { NodeId, NodeLayout, Point } from './layoutTypes'

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
