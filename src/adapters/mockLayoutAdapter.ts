/**
 * Mock Layout Adapter
 *
 * Simple in-memory implementation for testing without CRDT overhead.
 */
import type { LayoutOperation } from '@/types/layoutOperations'
import type { NodeId, NodeLayout } from '@/types/layoutTypes'

import type { AdapterChange, LayoutAdapter } from './layoutAdapter'

/**
 * Mock implementation for testing
 */
export class MockLayoutAdapter implements LayoutAdapter {
  private nodes = new Map<NodeId, NodeLayout>()
  private operations: LayoutOperation[] = []
  private changeCallbacks = new Set<(change: AdapterChange) => void>()
  private currentActor?: string

  setNode(nodeId: NodeId, layout: NodeLayout): void {
    this.nodes.set(nodeId, { ...layout })
    this.notifyChange({
      type: 'set',
      nodeIds: [nodeId],
      actor: this.currentActor
    })
  }

  getNode(nodeId: NodeId): NodeLayout | null {
    const layout = this.nodes.get(nodeId)
    return layout ? { ...layout } : null
  }

  deleteNode(nodeId: NodeId): void {
    const existed = this.nodes.delete(nodeId)
    if (existed) {
      this.notifyChange({
        type: 'delete',
        nodeIds: [nodeId],
        actor: this.currentActor
      })
    }
  }

  getAllNodes(): Map<NodeId, NodeLayout> {
    // Return a copy to prevent external mutations
    const copy = new Map<NodeId, NodeLayout>()
    for (const [id, layout] of this.nodes) {
      copy.set(id, { ...layout })
    }
    return copy
  }

  clear(): void {
    const nodeIds = Array.from(this.nodes.keys())
    this.nodes.clear()
    this.operations = []

    if (nodeIds.length > 0) {
      this.notifyChange({
        type: 'clear',
        nodeIds,
        actor: this.currentActor
      })
    }
  }

  addOperation(operation: LayoutOperation): void {
    this.operations.push({ ...operation })
  }

  getOperationsSince(timestamp: number): LayoutOperation[] {
    return this.operations
      .filter((op) => op.timestamp > timestamp)
      .map((op) => ({ ...op }))
  }

  getOperationsByActor(actor: string): LayoutOperation[] {
    return this.operations
      .filter((op) => op.actor === actor)
      .map((op) => ({ ...op }))
  }

  subscribe(callback: (change: AdapterChange) => void): () => void {
    this.changeCallbacks.add(callback)
    return () => this.changeCallbacks.delete(callback)
  }

  transaction(fn: () => void, actor?: string): void {
    const previousActor = this.currentActor
    this.currentActor = actor
    try {
      fn()
    } finally {
      this.currentActor = previousActor
    }
  }

  // Mock network sync methods
  getStateVector(): Uint8Array {
    return new Uint8Array([1, 2, 3]) // Mock data
  }

  getStateAsUpdate(): Uint8Array {
    // Simple serialization for testing
    const json = JSON.stringify({
      nodes: Array.from(this.nodes.entries()),
      operations: this.operations
    })
    return new TextEncoder().encode(json)
  }

  applyUpdate(update: Uint8Array): void {
    // Simple deserialization for testing
    const json = new TextDecoder().decode(update)
    const data = JSON.parse(json) as {
      nodes: Array<[NodeId, NodeLayout]>
      operations: LayoutOperation[]
    }

    this.nodes.clear()
    for (const [id, layout] of data.nodes) {
      this.nodes.set(id, layout)
    }
    this.operations = data.operations
  }

  private notifyChange(change: AdapterChange): void {
    this.changeCallbacks.forEach((callback) => {
      try {
        callback(change)
      } catch (error) {
        console.error('Error in mock adapter change callback:', error)
      }
    })
  }
}
