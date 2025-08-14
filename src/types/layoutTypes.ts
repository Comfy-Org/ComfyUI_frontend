/**
 * Layout System - Type Definitions
 *
 * This file contains all type definitions for the layout system
 * that manages node positions, bounds, and spatial data.
 */
import type { ComputedRef, Ref } from 'vue'

import type { LayoutOperation } from './layoutOperations'

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
  id: SlotId
  nodeId: NodeId
  position: Point // Relative to node
  type: 'input' | 'output'
  index: number
}

export interface ConnectionLayout {
  id: ConnectionId
  sourceSlot: SlotId
  targetSlot: SlotId
  // Control points for curved connections
  controlPoints?: Point[]
}

// Mutation types
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
  // Node accessors
  getNodeLayoutRef(nodeId: NodeId): Ref<NodeLayout | null>
  getNodesInBounds(bounds: Bounds): ComputedRef<NodeId[]>
  getAllNodes(): ComputedRef<ReadonlyMap<NodeId, NodeLayout>>

  // Slot accessors
  getSlotLayoutRef(slotId: SlotId): Ref<SlotLayout | null>
  getNodeSlots(nodeId: NodeId): ComputedRef<SlotLayout[]>
  getAllSlots(): ComputedRef<ReadonlyMap<SlotId, SlotLayout>>

  // Version tracking
  getVersion(): ComputedRef<number>

  // Spatial queries (non-reactive)
  queryNodeAtPoint(point: Point): NodeId | null
  queryNodesInBounds(bounds: Bounds): NodeId[]
  querySlotAtPoint(point: Point): SlotId | null

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

// Re-export operation types from dedicated operations file
export type {
  LayoutOperation as AnyLayoutOperation,
  BaseOperation,
  BaseSlotOperation,
  MoveNodeOperation,
  ResizeNodeOperation,
  SetNodeZIndexOperation,
  CreateNodeOperation,
  DeleteNodeOperation,
  SetNodeVisibilityOperation,
  BatchUpdateOperation,
  CreateSlotOperation,
  UpdateSlotOperation,
  DeleteSlotOperation,
  BatchUpdateSlotsOperation,
  OperationType,
  OperationApplicator,
  OperationSerializer,
  ConflictResolver
} from './layoutOperations'

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
