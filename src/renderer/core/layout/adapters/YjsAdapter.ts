/**
 * Yjs Layout Adapter
 *
 * Implements the LayoutAdapter interface using Yjs as the CRDT backend.
 * Provides efficient local state management with future collaboration support.
 */
import * as Y from 'yjs'

import type { LayoutOperation } from '@/renderer/core/layout/types'
import type {
  Bounds,
  NodeId,
  NodeLayout,
  Point
} from '@/renderer/core/layout/types'

import type { AdapterChange, LayoutAdapter } from './layoutAdapter'

/**
 * Yjs implementation of the layout adapter
 */
export class YjsLayoutAdapter implements LayoutAdapter {
  private ydoc: Y.Doc
  private ynodes: Y.Map<Y.Map<unknown>>
  private yoperations: Y.Array<LayoutOperation>
  private changeCallbacks = new Set<(change: AdapterChange) => void>()

  constructor() {
    this.ydoc = new Y.Doc()
    this.ynodes = this.ydoc.getMap('nodes')
    this.yoperations = this.ydoc.getArray('operations')

    // Set up change observation
    this.ynodes.observe((event, transaction) => {
      const change: AdapterChange = {
        type: 'set', // Yjs doesn't distinguish set/delete in observe
        nodeIds: [],
        actor: transaction.origin as string | undefined
      }

      // Collect affected node IDs
      event.changes.keys.forEach((changeType, key) => {
        change.nodeIds.push(key)
        if (changeType.action === 'delete') {
          change.type = 'delete'
        }
      })

      // Notify subscribers
      this.notifyChange(change)
    })
  }

  /**
   * Set a node's layout data
   */
  setNode(nodeId: NodeId, layout: NodeLayout): void {
    const ynode = this.layoutToYNode(layout)
    this.ynodes.set(nodeId, ynode)
  }

  /**
   * Get a node's layout data
   */
  getNode(nodeId: NodeId): NodeLayout | null {
    const ynode = this.ynodes.get(nodeId)
    return ynode ? this.yNodeToLayout(ynode) : null
  }

  /**
   * Delete a node
   */
  deleteNode(nodeId: NodeId): void {
    this.ynodes.delete(nodeId)
  }

  /**
   * Get all nodes
   */
  getAllNodes(): Map<NodeId, NodeLayout> {
    const result = new Map<NodeId, NodeLayout>()
    for (const [nodeId] of this.ynodes) {
      const ynode = this.ynodes.get(nodeId)
      if (ynode) {
        result.set(nodeId, this.yNodeToLayout(ynode))
      }
    }
    return result
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    this.ynodes.clear()
  }

  /**
   * Add an operation to the log
   */
  addOperation(operation: LayoutOperation): void {
    this.yoperations.push([operation])
  }

  /**
   * Get operations since a timestamp
   */
  getOperationsSince(timestamp: number): LayoutOperation[] {
    const operations: LayoutOperation[] = []
    this.yoperations.forEach((op) => {
      if (op && op.timestamp > timestamp) {
        operations.push(op)
      }
    })
    return operations
  }

  /**
   * Get operations by a specific actor
   */
  getOperationsByActor(actor: string): LayoutOperation[] {
    const operations: LayoutOperation[] = []
    this.yoperations.forEach((op) => {
      if (op && op.actor === actor) {
        operations.push(op)
      }
    })
    return operations
  }

  /**
   * Subscribe to changes
   */
  subscribe(callback: (change: AdapterChange) => void): () => void {
    this.changeCallbacks.add(callback)
    return () => this.changeCallbacks.delete(callback)
  }

  /**
   * Transaction support for atomic updates
   */
  transaction(fn: () => void, actor?: string): void {
    this.ydoc.transact(fn, actor)
  }

  /**
   * Get the current state vector for sync
   */
  getStateVector(): Uint8Array {
    return Y.encodeStateVector(this.ydoc)
  }

  /**
   * Get state as update for sending to peers
   */
  getStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.ydoc)
  }

  /**
   * Apply updates from remote peers
   */
  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.ydoc, update)
  }

  /**
   * Convert layout to Yjs structure
   */
  private layoutToYNode(layout: NodeLayout): Y.Map<unknown> {
    const ynode = new Y.Map<unknown>()
    ynode.set('id', layout.id)
    ynode.set('position', layout.position)
    ynode.set('size', layout.size)
    ynode.set('zIndex', layout.zIndex)
    ynode.set('visible', layout.visible)
    ynode.set('bounds', layout.bounds)
    return ynode
  }

  /**
   * Convert Yjs structure to layout
   */
  private yNodeToLayout(ynode: Y.Map<unknown>): NodeLayout {
    return {
      id: ynode.get('id') as string,
      position: ynode.get('position') as Point,
      size: ynode.get('size') as { width: number; height: number },
      zIndex: ynode.get('zIndex') as number,
      visible: ynode.get('visible') as boolean,
      bounds: ynode.get('bounds') as Bounds
    }
  }

  /**
   * Notify all change subscribers
   */
  private notifyChange(change: AdapterChange): void {
    this.changeCallbacks.forEach((callback) => {
      try {
        callback(change)
      } catch (error) {
        console.error('Error in adapter change callback:', error)
      }
    })
  }
}
