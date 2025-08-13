/**
 * Layout Store - Single Source of Truth
 *
 * Uses Yjs for efficient local state management and future collaboration.
 * CRDT ensures conflict-free operations for both single and multi-user scenarios.
 */
import log from 'loglevel'
import { type ComputedRef, type Ref, computed, customRef } from 'vue'
import * as Y from 'yjs'

import type {
  AnyLayoutOperation,
  Bounds,
  LayoutChange,
  LayoutStore,
  NodeId,
  NodeLayout,
  Point
} from '@/types/layoutTypes'

// Create logger for layout store
const logger = log.getLogger('layout-store')
// In dev mode, always show debug logs
if (import.meta.env.DEV) {
  logger.setLevel('debug')
}

class LayoutStoreImpl implements LayoutStore {
  // Yjs document and shared data structures
  private ydoc = new Y.Doc()
  private ynodes: Y.Map<Y.Map<unknown>> // Maps nodeId -> Y.Map containing NodeLayout data
  private yoperations: Y.Array<AnyLayoutOperation> // Operation log

  // Vue reactivity layer
  private version = 0
  private currentSource: 'canvas' | 'vue' | 'external' = 'external'
  private currentActor = `user-${Math.random().toString(36).substr(2, 9)}` // Random actor ID

  // Change listeners
  private changeListeners = new Set<(change: LayoutChange) => void>()

  // CustomRef cache and trigger functions
  private nodeRefs = new Map<NodeId, Ref<NodeLayout | null>>()
  private nodeTriggers = new Map<NodeId, () => void>()

  // Spatial index cache
  private spatialQueryCache = new Map<string, NodeId[]>()

  constructor() {
    // Initialize Yjs data structures
    this.ynodes = this.ydoc.getMap('nodes')
    this.yoperations = this.ydoc.getArray('operations')

    // Listen for Yjs changes and trigger Vue reactivity
    this.ynodes.observe((event) => {
      this.version++
      this.spatialQueryCache.clear()

      // Trigger all affected node refs
      event.changes.keys.forEach((_change, key) => {
        const trigger = this.nodeTriggers.get(key)
        if (trigger) {
          logger.debug(`Yjs change detected for node ${key}, triggering ref`)
          trigger()
        }
      })
    })

    // Debug: Log layout operations
    if (localStorage.getItem('layout-debug') === 'true') {
      this.yoperations.observe((event) => {
        const operations: AnyLayoutOperation[] = []
        event.changes.added.forEach((item) => {
          const content = item.content.getContent()
          if (Array.isArray(content) && content.length > 0) {
            operations.push(content[0] as AnyLayoutOperation)
          }
        })
        console.log('Layout Operation:', operations)
      })
    }
  }

  /**
   * Get or create a customRef for a node layout
   */
  getNodeLayoutRef(nodeId: NodeId): Ref<NodeLayout | null> {
    let nodeRef = this.nodeRefs.get(nodeId)

    if (!nodeRef) {
      logger.debug(`Creating new layout ref for node ${nodeId}`)

      nodeRef = customRef<NodeLayout | null>((track, trigger) => {
        // Store the trigger so we can call it when Yjs changes
        this.nodeTriggers.set(nodeId, trigger)

        return {
          get: () => {
            track()
            const ynode = this.ynodes.get(nodeId)
            const layout = ynode ? this.yNodeToLayout(ynode) : null
            logger.debug(`Layout ref GET for node ${nodeId}:`, {
              position: layout?.position,
              hasYnode: !!ynode,
              version: this.version
            })
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
            logger.debug(`Layout ref SET triggering for node ${nodeId}`)
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
    // Check cache first
    const cacheKey = `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`
    const cached = this.spatialQueryCache.get(cacheKey)
    if (cached) return cached

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

    // Cache result
    this.spatialQueryCache.set(cacheKey, result)
    return result
  }

  /**
   * Apply a layout operation using Yjs transactions
   */
  applyOperation(operation: AnyLayoutOperation): void {
    logger.debug(`applyOperation called:`, {
      type: operation.type,
      nodeId: operation.nodeId,
      operation
    })

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

      switch (operation.type) {
        case 'moveNode':
          this.handleMoveNode(operation, change)
          break

        case 'resizeNode':
          this.handleResizeNode(operation, change)
          break

        case 'setNodeZIndex':
          this.handleSetNodeZIndex(operation, change)
          break

        case 'createNode':
          this.handleCreateNode(operation, change)
          break

        case 'deleteNode':
          this.handleDeleteNode(operation, change)
          break
      }
    }, this.currentActor) // Use actor as transaction origin

    // Update version and clear cache
    this.version++
    this.spatialQueryCache.clear()

    // Manually trigger affected node refs after transaction
    // This is needed because Yjs observers don't fire for property changes
    change.nodeIds.forEach((nodeId) => {
      const trigger = this.nodeTriggers.get(nodeId)
      if (trigger) {
        logger.debug(
          `Manually triggering ref for node ${nodeId} after operation`
        )
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
    logger.debug('Initializing layout store from LiteGraph', {
      nodeCount: nodes.length,
      nodes: nodes.map((n) => ({ id: n.id, pos: n.pos }))
    })

    this.ydoc.transact(() => {
      this.ynodes.clear()
      this.nodeRefs.clear()
      this.nodeTriggers.clear()

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
        logger.debug(
          `Initialized node ${layout.id} at position:`,
          layout.position
        )
      })
    }, 'initialization')

    logger.debug('Layout store initialization complete', {
      totalNodes: this.ynodes.size
    })
  }

  // Operation handlers
  private handleMoveNode(
    operation: AnyLayoutOperation,
    change: LayoutChange
  ): void {
    if (operation.type !== 'moveNode') return

    logger.debug(`handleMoveNode called for ${operation.nodeId}`, {
      newPosition: operation.position
    })

    const ynode = this.ynodes.get(operation.nodeId)
    if (!ynode) {
      logger.warn(`No ynode found for ${operation.nodeId}`)
      return
    }

    // Update position in Yjs map
    ynode.set('position', {
      x: operation.position.x,
      y: operation.position.y
    })

    // Update bounds
    const size = ynode.get('size') as { width: number; height: number }
    ynode.set('bounds', {
      x: operation.position.x,
      y: operation.position.y,
      width: size.width,
      height: size.height
    })

    change.nodeIds.push(operation.nodeId)
  }

  private handleResizeNode(
    operation: AnyLayoutOperation,
    change: LayoutChange
  ): void {
    if (operation.type !== 'resizeNode') return

    const ynode = this.ynodes.get(operation.nodeId)
    if (!ynode) return

    // Update size in Yjs map
    ynode.set('size', {
      width: operation.size.width,
      height: operation.size.height
    })

    // Update bounds
    const position = ynode.get('position') as Point
    ynode.set('bounds', {
      x: position.x,
      y: position.y,
      width: operation.size.width,
      height: operation.size.height
    })

    change.nodeIds.push(operation.nodeId)
  }

  private handleSetNodeZIndex(
    operation: AnyLayoutOperation,
    change: LayoutChange
  ): void {
    if (operation.type !== 'setNodeZIndex') return

    const ynode = this.ynodes.get(operation.nodeId)
    if (!ynode) return

    ynode.set('zIndex', operation.zIndex)
    change.nodeIds.push(operation.nodeId)
  }

  private handleCreateNode(
    operation: AnyLayoutOperation,
    change: LayoutChange
  ): void {
    if (operation.type !== 'createNode') return

    const ynode = this.layoutToYNode(operation.layout)
    this.ynodes.set(operation.nodeId, ynode)

    change.type = 'create'
    change.nodeIds.push(operation.nodeId)
  }

  private handleDeleteNode(
    operation: AnyLayoutOperation,
    change: LayoutChange
  ): void {
    if (operation.type !== 'deleteNode') return

    const hadNode = this.ynodes.has(operation.nodeId)
    this.ynodes.delete(operation.nodeId)

    if (hadNode) {
      this.nodeRefs.delete(operation.nodeId)
      this.nodeTriggers.delete(operation.nodeId)
      change.type = 'delete'
      change.nodeIds.push(operation.nodeId)
    }
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
  getOperationsSince(timestamp: number): AnyLayoutOperation[] {
    const operations: AnyLayoutOperation[] = []
    this.yoperations.forEach((op) => {
      if (op && (op as AnyLayoutOperation).timestamp > timestamp) {
        operations.push(op as AnyLayoutOperation)
      }
    })
    return operations
  }

  getOperationsByActor(actor: string): AnyLayoutOperation[] {
    const operations: AnyLayoutOperation[] = []
    this.yoperations.forEach((op) => {
      if (op && (op as AnyLayoutOperation).actor === actor) {
        operations.push(op as AnyLayoutOperation)
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
export type { LayoutStore } from '@/types/layoutTypes'
