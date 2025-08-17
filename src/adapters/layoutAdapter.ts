/**
 * Layout Adapter Interface
 *
 * Abstracts the underlying CRDT implementation to allow for different
 * backends (Yjs, Automerge, etc.) and easier testing.
 */
import type { LayoutOperation } from '@/types/layoutOperations'
import type { NodeId, NodeLayout } from '@/types/layoutTypes'

/**
 * Change event emitted by the adapter
 */
export interface AdapterChange {
  /** Type of change */
  type: 'set' | 'delete' | 'clear'
  /** Affected node IDs */
  nodeIds: NodeId[]
  /** Actor who made the change */
  actor?: string
}

/**
 * Layout adapter interface for CRDT abstraction
 */
export interface LayoutAdapter {
  /**
   * Set a node's layout data
   */
  setNode(nodeId: NodeId, layout: NodeLayout): void

  /**
   * Get a node's layout data
   */
  getNode(nodeId: NodeId): NodeLayout | null

  /**
   * Delete a node
   */
  deleteNode(nodeId: NodeId): void

  /**
   * Get all nodes
   */
  getAllNodes(): Map<NodeId, NodeLayout>

  /**
   * Clear all nodes
   */
  clear(): void

  /**
   * Add an operation to the log
   */
  addOperation(operation: LayoutOperation): void

  /**
   * Get operations since a timestamp
   */
  getOperationsSince(timestamp: number): LayoutOperation[]

  /**
   * Get operations by a specific actor
   */
  getOperationsByActor(actor: string): LayoutOperation[]

  /**
   * Subscribe to changes
   */
  subscribe(callback: (change: AdapterChange) => void): () => void

  /**
   * Transaction support for atomic updates
   */
  transaction(fn: () => void, actor?: string): void

  /**
   * Network sync methods (for future use)
   */
  getStateVector(): Uint8Array
  getStateAsUpdate(): Uint8Array
  applyUpdate(update: Uint8Array): void
}
