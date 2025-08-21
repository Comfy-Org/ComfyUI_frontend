/**
 * Layout Store - Single Source of Truth
 *
 * Uses Yjs for efficient local state management and future collaboration.
 * CRDT ensures conflict-free operations for both single and multi-user scenarios.
 */
import { type ComputedRef, type Ref, computed, customRef } from 'vue'
import * as Y from 'yjs'

import { ACTOR_CONFIG } from '@/renderer/core/layout/constants'
import type {
  CreateNodeOperation,
  DeleteNodeOperation,
  LayoutOperation,
  MoveNodeOperation,
  ResizeNodeOperation,
  SetNodeZIndexOperation
} from '@/renderer/core/layout/types'
import type {
  Bounds,
  LayoutChange,
  LayoutStore,
  LinkId,
  LinkLayout,
  NodeId,
  NodeLayout,
  Point,
  RerouteId,
  RerouteLayout,
  SlotLayout
} from '@/renderer/core/layout/types'
import { SpatialIndexManager } from '@/renderer/core/spatial/SpatialIndex'

class LayoutStoreImpl implements LayoutStore {
  // Yjs document and shared data structures
  private ydoc = new Y.Doc()
  private ynodes: Y.Map<Y.Map<unknown>> // Maps nodeId -> Y.Map containing NodeLayout data
  private yoperations: Y.Array<LayoutOperation> // Operation log

  // Vue reactivity layer
  private version = 0
  private currentSource: 'canvas' | 'vue' | 'external' =
    ACTOR_CONFIG.DEFAULT_SOURCE
  private currentActor = `${ACTOR_CONFIG.USER_PREFIX}${Math.random()
    .toString(36)
    .substring(2, 2 + ACTOR_CONFIG.ID_LENGTH)}`

  // Change listeners
  private changeListeners = new Set<(change: LayoutChange) => void>()

  // CustomRef cache and trigger functions
  private nodeRefs = new Map<NodeId, Ref<NodeLayout | null>>()
  private nodeTriggers = new Map<NodeId, () => void>()

  // New data structures for hit testing
  private linkLayouts = new Map<LinkId, LinkLayout>()
  private slotLayouts = new Map<string, SlotLayout>()
  private rerouteLayouts = new Map<RerouteId, RerouteLayout>()

  // Spatial index managers
  private spatialIndex: SpatialIndexManager // For nodes
  private linkSpatialIndex: SpatialIndexManager // For links
  private slotSpatialIndex: SpatialIndexManager // For slots
  private rerouteSpatialIndex: SpatialIndexManager // For reroutes

  constructor() {
    // Initialize Yjs data structures
    this.ynodes = this.ydoc.getMap('nodes')
    this.yoperations = this.ydoc.getArray('operations')

    // Initialize spatial index managers
    this.spatialIndex = new SpatialIndexManager()
    this.linkSpatialIndex = new SpatialIndexManager()
    this.slotSpatialIndex = new SpatialIndexManager()
    this.rerouteSpatialIndex = new SpatialIndexManager()

    // Listen for Yjs changes and trigger Vue reactivity
    this.ynodes.observe((event) => {
      this.version++

      // Trigger all affected node refs
      event.changes.keys.forEach((_change, key) => {
        const trigger = this.nodeTriggers.get(key)
        if (trigger) {
          trigger()
        }
      })
    })
  }

  /**
   * Get or create a customRef for a node layout
   */
  getNodeLayoutRef(nodeId: NodeId): Ref<NodeLayout | null> {
    let nodeRef = this.nodeRefs.get(nodeId)

    if (!nodeRef) {
      nodeRef = customRef<NodeLayout | null>((track, trigger) => {
        // Store the trigger so we can call it when Yjs changes
        this.nodeTriggers.set(nodeId, trigger)

        return {
          get: () => {
            track()
            const ynode = this.ynodes.get(nodeId)
            const layout = ynode ? this.yNodeToLayout(ynode) : null
            return layout
          },
          set: (newLayout: NodeLayout | null) => {
            if (newLayout === null) {
              // Delete operation
              const existing = this.ynodes.get(nodeId)
              if (existing) {
                this.applyOperation({
                  type: 'deleteNode',
                  nodeId,
                  timestamp: Date.now(),
                  source: this.currentSource,
                  actor: this.currentActor,
                  previousLayout: this.yNodeToLayout(existing)
                })
              }
            } else {
              // Update operation - detect what changed
              const existing = this.ynodes.get(nodeId)
              if (!existing) {
                // Create operation
                this.applyOperation({
                  type: 'createNode',
                  nodeId,
                  layout: newLayout,
                  timestamp: Date.now(),
                  source: this.currentSource,
                  actor: this.currentActor
                })
              } else {
                const existingLayout = this.yNodeToLayout(existing)

                // Check what properties changed
                if (
                  existingLayout.position.x !== newLayout.position.x ||
                  existingLayout.position.y !== newLayout.position.y
                ) {
                  this.applyOperation({
                    type: 'moveNode',
                    nodeId,
                    position: newLayout.position,
                    previousPosition: existingLayout.position,
                    timestamp: Date.now(),
                    source: this.currentSource,
                    actor: this.currentActor
                  })
                }
                if (
                  existingLayout.size.width !== newLayout.size.width ||
                  existingLayout.size.height !== newLayout.size.height
                ) {
                  this.applyOperation({
                    type: 'resizeNode',
                    nodeId,
                    size: newLayout.size,
                    previousSize: existingLayout.size,
                    timestamp: Date.now(),
                    source: this.currentSource,
                    actor: this.currentActor
                  })
                }
                if (existingLayout.zIndex !== newLayout.zIndex) {
                  this.applyOperation({
                    type: 'setNodeZIndex',
                    nodeId,
                    zIndex: newLayout.zIndex,
                    previousZIndex: existingLayout.zIndex,
                    timestamp: Date.now(),
                    source: this.currentSource,
                    actor: this.currentActor
                  })
                }
              }
            }
            trigger()
          }
        }
      })

      this.nodeRefs.set(nodeId, nodeRef)
    }

    return nodeRef
  }

  /**
   * Get nodes within bounds (reactive)
   */
  getNodesInBounds(bounds: Bounds): ComputedRef<NodeId[]> {
    return computed(() => {
      // Touch version for reactivity
      void this.version

      const result: NodeId[] = []
      for (const [nodeId] of this.ynodes) {
        const ynode = this.ynodes.get(nodeId)
        if (ynode) {
          const layout = this.yNodeToLayout(ynode)
          if (layout && this.boundsIntersect(layout.bounds, bounds)) {
            result.push(nodeId)
          }
        }
      }
      return result
    })
  }

  /**
   * Get all nodes as a reactive map
   */
  getAllNodes(): ComputedRef<ReadonlyMap<NodeId, NodeLayout>> {
    return computed(() => {
      // Touch version for reactivity
      void this.version

      const result = new Map<NodeId, NodeLayout>()
      for (const [nodeId] of this.ynodes) {
        const ynode = this.ynodes.get(nodeId)
        if (ynode) {
          const layout = this.yNodeToLayout(ynode)
          if (layout) {
            result.set(nodeId, layout)
          }
        }
      }
      return result
    })
  }

  /**
   * Get current version for change detection
   */
  getVersion(): ComputedRef<number> {
    return computed(() => this.version)
  }

  /**
   * Query node at point (non-reactive for performance)
   */
  queryNodeAtPoint(point: Point): NodeId | null {
    const nodes: Array<[NodeId, NodeLayout]> = []

    for (const [nodeId] of this.ynodes) {
      const ynode = this.ynodes.get(nodeId)
      if (ynode) {
        const layout = this.yNodeToLayout(ynode)
        if (layout) {
          nodes.push([nodeId, layout])
        }
      }
    }

    // Sort by zIndex (top to bottom)
    nodes.sort(([, a], [, b]) => b.zIndex - a.zIndex)

    for (const [nodeId, layout] of nodes) {
      if (this.pointInBounds(point, layout.bounds)) {
        return nodeId
      }
    }

    return null
  }

  /**
   * Query nodes in bounds (non-reactive for performance)
   */
  queryNodesInBounds(bounds: Bounds): NodeId[] {
    return this.spatialIndex.query(bounds)
  }

  /**
   * Update link layout data
   */
  updateLinkLayout(linkId: LinkId, layout: LinkLayout): void {
    const existing = this.linkLayouts.get(linkId)

    if (existing) {
      // Update spatial index
      this.linkSpatialIndex.update(linkId, layout.bounds)
    } else {
      // Insert into spatial index
      this.linkSpatialIndex.insert(linkId, layout.bounds)
    }

    this.linkLayouts.set(linkId, layout)
  }

  /**
   * Delete link layout data
   */
  deleteLinkLayout(linkId: LinkId): void {
    const deleted = this.linkLayouts.delete(linkId)
    if (deleted) {
      // Remove from spatial index
      this.linkSpatialIndex.remove(linkId)
    }
  }

  /**
   * Update slot layout data
   */
  updateSlotLayout(key: string, layout: SlotLayout): void {
    const existing = this.slotLayouts.get(key)

    if (existing) {
      // Update spatial index
      this.slotSpatialIndex.update(key, layout.bounds)
    } else {
      // Insert into spatial index
      this.slotSpatialIndex.insert(key, layout.bounds)
    }

    this.slotLayouts.set(key, layout)
  }

  /**
   * Delete slot layout data
   */
  deleteSlotLayout(key: string): void {
    const deleted = this.slotLayouts.delete(key)
    if (deleted) {
      // Remove from spatial index
      this.slotSpatialIndex.remove(key)
    }
  }

  /**
   * Delete all slot layouts for a node
   */
  deleteNodeSlotLayouts(nodeId: NodeId): void {
    const keysToDelete: string[] = []
    for (const [key, layout] of this.slotLayouts) {
      if (layout.nodeId === nodeId) {
        keysToDelete.push(key)
      }
    }
    for (const key of keysToDelete) {
      this.slotLayouts.delete(key)
      // Remove from spatial index
      this.slotSpatialIndex.remove(key)
    }
  }

  /**
   * Update reroute layout data
   */
  updateRerouteLayout(rerouteId: RerouteId, layout: RerouteLayout): void {
    const existing = this.rerouteLayouts.get(rerouteId)

    if (existing) {
      // Update spatial index
      this.rerouteSpatialIndex.update(rerouteId, layout.bounds)
    } else {
      // Insert into spatial index
      this.rerouteSpatialIndex.insert(rerouteId, layout.bounds)
    }

    this.rerouteLayouts.set(rerouteId, layout)
  }

  /**
   * Delete reroute layout data
   */
  deleteRerouteLayout(rerouteId: RerouteId): void {
    const deleted = this.rerouteLayouts.delete(rerouteId)
    if (deleted) {
      // Remove from spatial index
      this.rerouteSpatialIndex.remove(rerouteId)
    }
  }

  /**
   * Get link layout data
   */
  getLinkLayout(linkId: LinkId): LinkLayout | null {
    return this.linkLayouts.get(linkId) || null
  }

  /**
   * Get slot layout data
   */
  getSlotLayout(key: string): SlotLayout | null {
    return this.slotLayouts.get(key) || null
  }

  /**
   * Get reroute layout data
   */
  getRerouteLayout(rerouteId: RerouteId): RerouteLayout | null {
    return this.rerouteLayouts.get(rerouteId) || null
  }

  /**
   * Query link at point
   */
  queryLinkAtPoint(
    point: Point,
    ctx?: CanvasRenderingContext2D
  ): LinkId | null {
    // Use spatial index to get candidate links
    const searchArea = {
      x: point.x - 10, // Tolerance for line width
      y: point.y - 10,
      width: 20,
      height: 20
    }
    const candidateLinkIds = this.linkSpatialIndex.query(searchArea)

    // Precise hit test only on candidates
    for (const linkId of candidateLinkIds) {
      const linkLayout = this.linkLayouts.get(linkId)
      if (!linkLayout) continue

      if (ctx && linkLayout.path) {
        // Save and set appropriate line width for hit testing
        const oldLineWidth = ctx.lineWidth
        ctx.lineWidth = 10 // Hit test tolerance

        const hit = ctx.isPointInStroke(linkLayout.path, point.x, point.y)
        ctx.lineWidth = oldLineWidth

        if (hit) return linkId
      } else if (this.pointInBounds(point, linkLayout.bounds)) {
        // Fallback to bounding box test
        return linkId
      }
    }

    return null
  }

  /**
   * Query slot at point
   */
  querySlotAtPoint(point: Point): SlotLayout | null {
    // Use spatial index to get candidate slots
    const searchArea = {
      x: point.x - 10, // Tolerance for slot size
      y: point.y - 10,
      width: 20,
      height: 20
    }
    const candidateSlotKeys = this.slotSpatialIndex.query(searchArea)

    // Check precise bounds for candidates
    for (const key of candidateSlotKeys) {
      const slotLayout = this.slotLayouts.get(key)
      if (slotLayout && this.pointInBounds(point, slotLayout.bounds)) {
        return slotLayout
      }
    }
    return null
  }

  /**
   * Query reroute at point
   */
  queryRerouteAtPoint(point: Point): RerouteLayout | null {
    // Use spatial index to get candidate reroutes
    const maxRadius = 20 // Maximum expected reroute radius
    const searchArea = {
      x: point.x - maxRadius,
      y: point.y - maxRadius,
      width: maxRadius * 2,
      height: maxRadius * 2
    }
    const candidateRerouteIds = this.rerouteSpatialIndex.query(searchArea)

    // Check precise distance for candidates
    for (const rerouteId of candidateRerouteIds) {
      const rerouteLayout = this.rerouteLayouts.get(rerouteId)
      if (rerouteLayout) {
        const dx = point.x - rerouteLayout.position.x
        const dy = point.y - rerouteLayout.position.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance <= rerouteLayout.radius) {
          return rerouteLayout
        }
      }
    }
    return null
  }

  /**
   * Query all items in bounds
   */
  queryItemsInBounds(bounds: Bounds): {
    nodes: NodeId[]
    links: LinkId[]
    slots: string[]
    reroutes: RerouteId[]
  } {
    return {
      nodes: this.queryNodesInBounds(bounds),
      links: this.linkSpatialIndex.query(bounds), // Use spatial index for links
      slots: this.slotSpatialIndex.query(bounds), // Use spatial index for slots
      reroutes: this.rerouteSpatialIndex.query(bounds) // Use spatial index for reroutes
    }
  }

  /**
   * Apply a layout operation using Yjs transactions
   */
  applyOperation(operation: LayoutOperation): void {
    // Create change object outside transaction so we can use it after
    const change: LayoutChange = {
      type: 'update',
      nodeIds: [],
      timestamp: operation.timestamp,
      source: operation.source,
      operation
    }

    // Use Yjs transaction for atomic updates
    this.ydoc.transact(() => {
      // Add operation to log
      this.yoperations.push([operation])

      // Apply the operation
      this.applyOperationInTransaction(operation, change)
    }, this.currentActor)

    // Post-transaction updates
    this.finalizeOperation(change)
  }

  /**
   * Apply operation within a transaction
   */
  private applyOperationInTransaction(
    operation: LayoutOperation,
    change: LayoutChange
  ): void {
    switch (operation.type) {
      case 'moveNode':
        this.handleMoveNode(operation as MoveNodeOperation, change)
        break
      case 'resizeNode':
        this.handleResizeNode(operation as ResizeNodeOperation, change)
        break
      case 'setNodeZIndex':
        this.handleSetNodeZIndex(operation as SetNodeZIndexOperation, change)
        break
      case 'createNode':
        this.handleCreateNode(operation as CreateNodeOperation, change)
        break
      case 'deleteNode':
        this.handleDeleteNode(operation as DeleteNodeOperation, change)
        break
    }
  }

  /**
   * Finalize operation after transaction
   */
  private finalizeOperation(change: LayoutChange): void {
    // Update version
    this.version++

    // Manually trigger affected node refs after transaction
    // This is needed because Yjs observers don't fire for property changes
    change.nodeIds.forEach((nodeId) => {
      const trigger = this.nodeTriggers.get(nodeId)
      if (trigger) {
        trigger()
      }
    })

    // Notify listeners (after transaction completes)
    setTimeout(() => this.notifyChange(change), 0)
  }

  /**
   * Subscribe to layout changes
   */
  onChange(callback: (change: LayoutChange) => void): () => void {
    this.changeListeners.add(callback)
    return () => this.changeListeners.delete(callback)
  }

  /**
   * Set the current operation source
   */
  setSource(source: 'canvas' | 'vue' | 'external'): void {
    this.currentSource = source
  }

  /**
   * Set the current actor (for CRDT)
   */
  setActor(actor: string): void {
    this.currentActor = actor
  }

  /**
   * Get the current operation source
   */
  getCurrentSource(): 'canvas' | 'vue' | 'external' {
    return this.currentSource
  }

  /**
   * Get the current actor
   */
  getCurrentActor(): string {
    return this.currentActor
  }

  /**
   * Initialize store with existing nodes
   */
  initializeFromLiteGraph(
    nodes: Array<{ id: string; pos: [number, number]; size: [number, number] }>
  ): void {
    this.ydoc.transact(() => {
      this.ynodes.clear()
      this.nodeRefs.clear()
      this.nodeTriggers.clear()
      this.spatialIndex.clear()
      this.linkSpatialIndex.clear()
      this.slotSpatialIndex.clear()
      this.rerouteSpatialIndex.clear()
      this.linkLayouts.clear()
      this.slotLayouts.clear()
      this.rerouteLayouts.clear()

      nodes.forEach((node, index) => {
        const layout: NodeLayout = {
          id: node.id.toString(),
          position: { x: node.pos[0], y: node.pos[1] },
          size: { width: node.size[0], height: node.size[1] },
          zIndex: index,
          visible: true,
          bounds: {
            x: node.pos[0],
            y: node.pos[1],
            width: node.size[0],
            height: node.size[1]
          }
        }

        this.ynodes.set(layout.id, this.layoutToYNode(layout))

        // Add to spatial index
        this.spatialIndex.insert(layout.id, layout.bounds)
      })
    }, 'initialization')
  }

  // Operation handlers
  private handleMoveNode(
    operation: MoveNodeOperation,
    change: LayoutChange
  ): void {
    const ynode = this.ynodes.get(operation.nodeId)
    if (!ynode) {
      return
    }

    const size = ynode.get('size') as { width: number; height: number }
    ynode.set('position', operation.position)
    this.updateNodeBounds(ynode, operation.position, size)

    // Update spatial index
    this.spatialIndex.update(operation.nodeId, {
      x: operation.position.x,
      y: operation.position.y,
      width: size.width,
      height: size.height
    })

    change.nodeIds.push(operation.nodeId)
  }

  private handleResizeNode(
    operation: ResizeNodeOperation,
    change: LayoutChange
  ): void {
    const ynode = this.ynodes.get(operation.nodeId)
    if (!ynode) return

    const position = ynode.get('position') as Point
    ynode.set('size', operation.size)
    this.updateNodeBounds(ynode, position, operation.size)

    // Update spatial index
    this.spatialIndex.update(operation.nodeId, {
      x: position.x,
      y: position.y,
      width: operation.size.width,
      height: operation.size.height
    })

    change.nodeIds.push(operation.nodeId)
  }

  private handleSetNodeZIndex(
    operation: SetNodeZIndexOperation,
    change: LayoutChange
  ): void {
    const ynode = this.ynodes.get(operation.nodeId)
    if (!ynode) return

    ynode.set('zIndex', operation.zIndex)
    change.nodeIds.push(operation.nodeId)
  }

  private handleCreateNode(
    operation: CreateNodeOperation,
    change: LayoutChange
  ): void {
    const ynode = this.layoutToYNode(operation.layout)
    this.ynodes.set(operation.nodeId, ynode)

    // Add to spatial index
    this.spatialIndex.insert(operation.nodeId, operation.layout.bounds)

    change.type = 'create'
    change.nodeIds.push(operation.nodeId)
  }

  private handleDeleteNode(
    operation: DeleteNodeOperation,
    change: LayoutChange
  ): void {
    if (!this.ynodes.has(operation.nodeId)) return

    this.ynodes.delete(operation.nodeId)
    this.nodeRefs.delete(operation.nodeId)
    this.nodeTriggers.delete(operation.nodeId)

    // Remove from spatial index
    this.spatialIndex.remove(operation.nodeId)

    // Clean up associated slot layouts
    this.deleteNodeSlotLayouts(operation.nodeId)

    change.type = 'delete'
    change.nodeIds.push(operation.nodeId)
  }

  /**
   * Update node bounds helper
   */
  private updateNodeBounds(
    ynode: Y.Map<unknown>,
    position: Point,
    size: { width: number; height: number }
  ): void {
    ynode.set('bounds', {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height
    })
  }

  // Helper methods
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

  private notifyChange(change: LayoutChange): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(change)
      } catch (error) {
        console.error('Error in layout change listener:', error)
      }
    })
  }

  private pointInBounds(point: Point, bounds: Bounds): boolean {
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    )
  }

  private boundsIntersect(a: Bounds, b: Bounds): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    )
  }

  // CRDT-specific methods
  getOperationsSince(timestamp: number): LayoutOperation[] {
    const operations: LayoutOperation[] = []
    this.yoperations.forEach((op) => {
      if (op && op.timestamp > timestamp) {
        operations.push(op)
      }
    })
    return operations
  }

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
   * Get the Yjs document for network sync (future feature)
   */
  getYDoc(): Y.Doc {
    return this.ydoc
  }

  /**
   * Apply updates from remote peers (future feature)
   */
  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.ydoc, update)
  }

  /**
   * Get state as update for sending to peers (future feature)
   */
  getStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.ydoc)
  }
}

// Create singleton instance
export const layoutStore = new LayoutStoreImpl()

// Export types for convenience
export type { LayoutStore } from '@/renderer/core/layout/types'
