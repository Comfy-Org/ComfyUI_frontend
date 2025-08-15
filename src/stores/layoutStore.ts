/**
 * Layout Store - Single Source of Truth
 *
 * Uses Yjs for efficient local state management and future collaboration.
 * CRDT ensures conflict-free operations for both single and multi-user scenarios.
 */
import log from 'loglevel'
import { type ComputedRef, type Ref, computed, customRef } from 'vue'
import * as Y from 'yjs'

import { ACTOR_CONFIG, DEBUG_CONFIG } from '@/constants/layout'
import { SpatialIndexManager } from '@/services/spatialIndexManager'
import type {
  BatchUpdateSlotsOperation,
  CreateNodeOperation,
  CreateSlotOperation,
  DeleteNodeOperation,
  DeleteSlotOperation,
  LayoutOperation,
  MoveNodeOperation,
  ResizeNodeOperation,
  SetNodeZIndexOperation,
  UpdateSlotOperation
} from '@/types/layoutOperations'
import type {
  Bounds,
  LayoutChange,
  LayoutStore,
  NodeId,
  NodeLayout,
  Point,
  SlotId,
  SlotLayout
} from '@/types/layoutTypes'

// Create logger for layout store
const logger = log.getLogger(DEBUG_CONFIG.STORE_LOGGER_NAME)
// In dev mode, always show debug logs
if (import.meta.env.DEV) {
  logger.setLevel('debug')
}

class LayoutStoreImpl implements LayoutStore {
  // Yjs document and shared data structures
  private ydoc = new Y.Doc()
  private ynodes: Y.Map<Y.Map<unknown>> // Maps nodeId -> Y.Map containing NodeLayout data
  private yslots: Y.Map<Y.Map<unknown>> // Maps slotId -> Y.Map containing SlotLayout data
  private yoperations: Y.Array<LayoutOperation> // Operation log

  // Vue reactivity layer
  private version = 0
  private currentSource: 'canvas' | 'vue' | 'external' =
    ACTOR_CONFIG.DEFAULT_SOURCE
  private currentActor = `${ACTOR_CONFIG.USER_PREFIX}${Math.random()
    .toString(36)
    .substr(2, ACTOR_CONFIG.ID_LENGTH)}`

  // Change listeners
  private changeListeners = new Set<(change: LayoutChange) => void>()

  // CustomRef cache and trigger functions
  private nodeRefs = new Map<NodeId, Ref<NodeLayout | null>>()
  private nodeTriggers = new Map<NodeId, () => void>()
  private slotRefs = new Map<SlotId, Ref<SlotLayout | null>>()
  private slotTriggers = new Map<SlotId, () => void>()

  // Spatial index manager
  private spatialIndex: SpatialIndexManager

  constructor() {
    // Initialize Yjs data structures
    this.ynodes = this.ydoc.getMap('nodes')
    this.yslots = this.ydoc.getMap('slots')
    this.yoperations = this.ydoc.getArray('operations')

    // Initialize spatial index manager
    this.spatialIndex = new SpatialIndexManager()

    // Listen for Yjs changes and trigger Vue reactivity
    this.ynodes.observe((event) => {
      this.version++

      // Trigger all affected node refs
      event.changes.keys.forEach((_change, key) => {
        const trigger = this.nodeTriggers.get(key)
        if (trigger) {
          logger.debug(`Yjs change detected for node ${key}, triggering ref`)
          trigger()
        }
      })
    })

    // Listen for slot changes
    this.yslots.observe((event) => {
      this.version++

      // Trigger all affected slot refs
      event.changes.keys.forEach((_change, key) => {
        const trigger = this.slotTriggers.get(key)
        if (trigger) {
          logger.debug(`Yjs change detected for slot ${key}, triggering ref`)
          trigger()
        }
      })
    })

    // Debug: Log layout operations
    if (localStorage.getItem(DEBUG_CONFIG.LAYOUT_DEBUG_KEY) === 'true') {
      this.yoperations.observe((event) => {
        const operations: LayoutOperation[] = []
        event.changes.added.forEach((item) => {
          const content = item.content.getContent()
          if (Array.isArray(content) && content.length > 0) {
            operations.push(content[0] as LayoutOperation)
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
   * Get or create a customRef for a slot layout
   */
  getSlotLayoutRef(slotId: SlotId): Ref<SlotLayout | null> {
    let slotRef = this.slotRefs.get(slotId)

    if (!slotRef) {
      logger.debug(`Creating new layout ref for slot ${slotId}`)

      slotRef = customRef<SlotLayout | null>((track, trigger) => {
        // Store the trigger so we can call it when Yjs changes
        this.slotTriggers.set(slotId, trigger)

        return {
          get: () => {
            track()
            const yslot = this.yslots.get(slotId)
            const layout = yslot ? this.ySlotToLayout(yslot) : null
            logger.debug(`Layout ref GET for slot ${slotId}:`, {
              position: layout?.position,
              hasYslot: !!yslot,
              version: this.version
            })
            return layout
          },
          set: (newLayout: SlotLayout | null) => {
            if (newLayout === null) {
              // Delete operation
              const existing = this.yslots.get(slotId)
              if (existing) {
                this.applyOperation({
                  type: 'deleteSlot',
                  slotId,
                  timestamp: Date.now(),
                  source: this.currentSource,
                  actor: this.currentActor,
                  previousLayout: this.ySlotToLayout(existing)
                })
              }
            } else {
              // Update or create operation
              const existing = this.yslots.get(slotId)
              if (!existing) {
                // Create operation
                this.applyOperation({
                  type: 'createSlot',
                  slotId,
                  layout: newLayout,
                  timestamp: Date.now(),
                  source: this.currentSource,
                  actor: this.currentActor
                })
              } else {
                const existingLayout = this.ySlotToLayout(existing)
                // Update position if changed
                if (
                  existingLayout.position.x !== newLayout.position.x ||
                  existingLayout.position.y !== newLayout.position.y
                ) {
                  this.applyOperation({
                    type: 'updateSlot',
                    slotId,
                    position: newLayout.position,
                    previousPosition: existingLayout.position,
                    timestamp: Date.now(),
                    source: this.currentSource,
                    actor: this.currentActor
                  })
                }
              }
            }
            logger.debug(`Layout ref SET triggering for slot ${slotId}`)
            trigger()
          }
        }
      })

      this.slotRefs.set(slotId, slotRef)
    }

    return slotRef
  }

  /**
   * Get slots for a specific node (reactive)
   */
  getNodeSlots(nodeId: NodeId): ComputedRef<SlotLayout[]> {
    return computed(() => {
      // Touch version for reactivity
      void this.version

      const result: SlotLayout[] = []
      for (const [slotId] of this.yslots) {
        const yslot = this.yslots.get(slotId)
        if (yslot) {
          const layout = this.ySlotToLayout(yslot)
          if (layout && layout.nodeId === nodeId) {
            result.push(layout)
          }
        }
      }
      // Sort by type and index
      result.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'input' ? -1 : 1
        }
        return a.index - b.index
      })
      return result
    })
  }

  /**
   * Get all slots as a reactive map
   */
  getAllSlots(): ComputedRef<ReadonlyMap<SlotId, SlotLayout>> {
    return computed(() => {
      // Touch version for reactivity
      void this.version

      const result = new Map<SlotId, SlotLayout>()
      for (const [slotId] of this.yslots) {
        const yslot = this.yslots.get(slotId)
        if (yslot) {
          const layout = this.ySlotToLayout(yslot)
          if (layout) {
            result.set(slotId, layout)
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
   * Query slot at point (non-reactive for performance)
   */
  querySlotAtPoint(point: Point): SlotId | null {
    // First find the node at the point
    const nodeId = this.queryNodeAtPoint(point)
    if (!nodeId) return null

    // Then check slots for that node
    for (const [slotId] of this.yslots) {
      const yslot = this.yslots.get(slotId)
      if (yslot) {
        const slot = this.ySlotToLayout(yslot)
        if (slot && slot.nodeId === nodeId) {
          const ynode = this.ynodes.get(nodeId)
          if (ynode) {
            const node = this.yNodeToLayout(ynode)
            // Convert slot relative position to absolute
            const absoluteX = node.position.x + slot.position.x
            const absoluteY = node.position.y + slot.position.y
            // Check if point is within slot radius (typically 10-15 pixels)
            const slotRadius = 15
            const dx = point.x - absoluteX
            const dy = point.y - absoluteY
            if (dx * dx + dy * dy <= slotRadius * slotRadius) {
              return slotId
            }
          }
        }
      }
    }
    return null
  }

  /**
   * Apply a layout operation using Yjs transactions
   */
  applyOperation(operation: LayoutOperation): void {
    const entityId =
      'nodeId' in operation
        ? operation.nodeId
        : 'slotId' in operation
          ? (operation as any).slotId
          : 'unknown'

    logger.debug(`applyOperation called:`, {
      type: operation.type,
      entityId,
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
      case 'createSlot':
        this.handleCreateSlot(operation as CreateSlotOperation, change)
        break
      case 'updateSlot':
        this.handleUpdateSlot(operation as UpdateSlotOperation, change)
        break
      case 'deleteSlot':
        this.handleDeleteSlot(operation as DeleteSlotOperation, change)
        break
      case 'batchUpdateSlots':
        this.handleBatchUpdateSlots(
          operation as BatchUpdateSlotsOperation,
          change
        )
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
      this.spatialIndex.clear()

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
    operation: MoveNodeOperation,
    change: LayoutChange
  ): void {
    const ynode = this.ynodes.get(operation.nodeId)
    if (!ynode) {
      logger.warn(`No ynode found for ${operation.nodeId}`)
      return
    }

    logger.debug(`Moving node ${operation.nodeId}`, operation.position)

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

    change.type = 'delete'
    change.nodeIds.push(operation.nodeId)
  }

  // Slot operation handlers
  private handleCreateSlot(
    operation: CreateSlotOperation,
    change: LayoutChange
  ): void {
    const yslot = this.layoutToYSlot(operation.layout)
    this.yslots.set(operation.slotId, yslot)

    change.type = 'create'
    // Track the affected node
    change.nodeIds.push(operation.layout.nodeId)
  }

  private handleUpdateSlot(
    operation: UpdateSlotOperation,
    change: LayoutChange
  ): void {
    const yslot = this.yslots.get(operation.slotId)
    if (!yslot) {
      logger.warn(`No yslot found for ${operation.slotId}`)
      return
    }

    logger.debug(`Updating slot ${operation.slotId}`, operation.position)
    yslot.set('position', operation.position)

    // Track the affected node
    const nodeId = yslot.get('nodeId') as string
    if (nodeId) {
      change.nodeIds.push(nodeId)
    }
  }

  private handleDeleteSlot(
    operation: DeleteSlotOperation,
    change: LayoutChange
  ): void {
    const yslot = this.yslots.get(operation.slotId)
    if (!yslot) return

    // Track the affected node before deletion
    const nodeId = yslot.get('nodeId') as string

    this.yslots.delete(operation.slotId)
    this.slotRefs.delete(operation.slotId)
    this.slotTriggers.delete(operation.slotId)

    change.type = 'delete'
    if (nodeId) {
      change.nodeIds.push(nodeId)
    }
  }

  private handleBatchUpdateSlots(
    operation: BatchUpdateSlotsOperation,
    change: LayoutChange
  ): void {
    // Delete all existing slots for this node
    const slotsToDelete: string[] = []
    for (const [slotId] of this.yslots) {
      const yslot = this.yslots.get(slotId)
      if (yslot && yslot.get('nodeId') === operation.nodeId) {
        slotsToDelete.push(slotId)
      }
    }

    slotsToDelete.forEach((slotId) => {
      this.yslots.delete(slotId)
      this.slotRefs.delete(slotId)
      this.slotTriggers.delete(slotId)
    })

    // Add new slots
    operation.slots.forEach((slotLayout) => {
      const yslot = this.layoutToYSlot(slotLayout)
      this.yslots.set(slotLayout.id, yslot)
    })

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

  private layoutToYSlot(layout: SlotLayout): Y.Map<unknown> {
    const yslot = new Y.Map<unknown>()
    yslot.set('id', layout.id)
    yslot.set('nodeId', layout.nodeId)
    yslot.set('position', layout.position)
    yslot.set('type', layout.type)
    yslot.set('index', layout.index)
    return yslot
  }

  private ySlotToLayout(yslot: Y.Map<unknown>): SlotLayout {
    return {
      id: yslot.get('id') as string,
      nodeId: yslot.get('nodeId') as string,
      position: yslot.get('position') as Point,
      type: yslot.get('type') as 'input' | 'output',
      index: yslot.get('index') as number
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
export type { LayoutStore } from '@/types/layoutTypes'
