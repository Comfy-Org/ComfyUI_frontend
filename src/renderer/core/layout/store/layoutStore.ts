/**
 * Layout Store - Single Source of Truth
 *
 * Uses Yjs for efficient local state management and future collaboration.
 * CRDT ensures conflict-free operations for both single and multi-user scenarios.
 */
import log from 'loglevel'
import { computed, customRef, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import * as Y from 'yjs'

import type { GroupId } from '@/lib/litegraph/src/LGraphGroup'
import { removeNodeTitleHeight } from '@/renderer/core/layout/utils/nodeSizeUtil'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import type { UUID } from '@/utils/uuid'

import { ACTOR_CONFIG } from '@/renderer/core/layout/constants'
import { LayoutSource } from '@/renderer/core/layout/types'
import type {
  BatchUpdateBoundsOperation,
  Bounds,
  CreateNodeOperation,
  CreateRerouteOperation,
  DeleteNodeOperation,
  DeleteRerouteOperation,
  GroupLayout,
  LayoutChange,
  LayoutOperation,
  LayoutStore,
  LinkId,
  LinkLayout,
  LinkSegmentLayout,
  MoveNodeOperation,
  MoveRerouteOperation,
  NodeBoundsUpdate,
  NodeId,
  NodeLayout,
  Point,
  RerouteId,
  RerouteLayout,
  ResizeNodeOperation,
  SetGroupBoundsOperation,
  SetNodeZIndexOperation,
  SlotId,
  SlotLayout
} from '@/renderer/core/layout/types'
import {
  isBoundsEqual,
  isPointEqual
} from '@/renderer/core/layout/utils/geometry'
import {
  REROUTE_RADIUS,
  boundsIntersect,
  pointInBounds
} from '@/renderer/core/layout/utils/layoutMath'
import { makeLinkSegmentKey } from '@/renderer/core/layout/utils/layoutUtils'
import {
  layoutToYGroup,
  setYGroupRect,
  layoutToYNode,
  yGroupToLayout,
  yNodeToLayout
} from '@/renderer/core/layout/utils/mappers'
import type {
  GroupLayoutMap,
  NodeLayoutMap
} from '@/renderer/core/layout/utils/mappers'
import { SpatialIndexManager } from '@/renderer/core/spatial/SpatialIndex'

type YEventChange = {
  action: 'add' | 'update' | 'delete'
  oldValue: unknown
}

const logger = log.getLogger('LayoutStore')

type ScopedLayoutKey = string & { readonly __brand: 'ScopedLayoutKey' }

function makeScopedLayoutKey(graphId: UUID, localId: number): ScopedLayoutKey {
  return (graphId + ':' + localId) as ScopedLayoutKey
}

function parseLayoutKey(key: string): { graphId: UUID; localId: number } {
  const separatorIndex = key.lastIndexOf(':')
  return {
    graphId: key.slice(0, separatorIndex) as UUID,
    localId: Number(key.slice(separatorIndex + 1))
  }
}

interface RerouteData {
  id: RerouteId
  position: Point
}

// Generic typed Y.Map interface
interface TypedYMap<T> {
  get<K extends keyof T>(key: K): T[K] | undefined
  get<K extends keyof T>(key: K, defaultValue: T[K]): T[K]
}

class LayoutStoreImpl implements LayoutStore {
  private static readonly REROUTE_DEFAULTS: RerouteData = {
    id: toRerouteId(0),
    position: { x: 0, y: 0 }
  }

  // Yjs document and shared data structures
  private ydoc = new Y.Doc()
  private ynodes: Y.Map<NodeLayoutMap> // Maps nodeId -> NodeLayoutMap containing NodeLayout data
  private yreroutes: Y.Map<Y.Map<unknown>> // Maps rerouteId -> Y.Map containing reroute data
  private ygroups: Y.Map<GroupLayoutMap> // Maps groupId -> GroupLayoutMap containing GroupLayout data

  // Vue reactivity layer
  private version = ref(0)
  private currentSource: LayoutSource =
    ACTOR_CONFIG.DEFAULT_SOURCE as LayoutSource
  private currentActor = `${ACTOR_CONFIG.USER_PREFIX}${Math.random()
    .toString(36)
    .substring(2, 2 + ACTOR_CONFIG.ID_LENGTH)}`

  // Change listeners
  private changeListeners = new Set<(change: LayoutChange) => void>()
  private nodeChangeListeners = new Map<
    NodeId,
    Set<(change: LayoutChange) => void>
  >()
  private pendingGlobalChanges: LayoutChange[] = []
  private isGlobalDispatchQueued = false

  // CustomRef cache and trigger functions
  private nodeRefs = new Map<NodeId, Ref<NodeLayout | null>>()
  private nodeTriggers = new Map<NodeId, () => void>()

  // New data structures for hit testing
  private linkLayouts = new Map<LinkId, LinkLayout>()
  private linkSegmentLayouts = new Map<string, LinkSegmentLayout>() // Internal string key: ${linkId}:${rerouteId ?? 'final'}
  private slotLayouts = new Map<SlotId, SlotLayout>()
  private rerouteLayouts = new Map<ScopedLayoutKey, RerouteLayout>()

  // Spatial index managers
  private spatialIndex: SpatialIndexManager<NodeId> // For nodes
  private linkSegmentSpatialIndex: SpatialIndexManager<string> // For link segments (single index for all link geometry)
  private slotSpatialIndex: SpatialIndexManager<SlotId> // For slots
  private rerouteSpatialIndex: SpatialIndexManager<ScopedLayoutKey> // For reroutes

  // Vue dragging state for selection toolbox (public ref for direct mutation)
  public isDraggingVueNodes = ref(false)
  // Vue resizing state to prevent drag from activating during resize
  public isResizingVueNodes = ref(false)

  /**
   * Flag indicating slot positions are pending sync after graph reconfiguration.
   * When true, link rendering should be skipped to avoid drawing with stale positions.
   */
  private _pendingSlotSync = false

  get pendingSlotSync(): boolean {
    return this._pendingSlotSync
  }

  get hasSlotLayouts(): boolean {
    return this.slotLayouts.size > 0
  }

  setPendingSlotSync(value: boolean): void {
    this._pendingSlotSync = value
  }

  constructor() {
    // Initialize Yjs data structures
    this.ynodes = this.ydoc.getMap('nodes')
    this.yreroutes = this.ydoc.getMap('reroutes')
    this.ygroups = this.ydoc.getMap('groups')

    // Initialize spatial index managers
    this.spatialIndex = new SpatialIndexManager<NodeId>()
    this.linkSegmentSpatialIndex = new SpatialIndexManager<string>() // Single index for all link geometry
    this.slotSpatialIndex = new SpatialIndexManager<SlotId>()
    this.rerouteSpatialIndex = new SpatialIndexManager<ScopedLayoutKey>()

    // Listen for Yjs changes and trigger Vue reactivity
    this.ynodes.observe((event: Y.YMapEvent<NodeLayoutMap>) => {
      this.version.value++

      // Trigger all affected node refs
      event.changes.keys.forEach((_change: YEventChange, key: string) => {
        const trigger = this.nodeTriggers.get(toNodeId(key))
        if (trigger) {
          trigger()
        }
      })
    })

    this.ygroups.observeDeep(() => {
      this.version.value++
    })

    // Listen for reroute changes and update spatial indexes
    this.yreroutes.observe((event: Y.YMapEvent<Y.Map<unknown>>) => {
      this.version.value++
      event.changes.keys.forEach((change, rerouteIdStr) => {
        this.handleRerouteChange(change, rerouteIdStr)
      })
    })
  }

  private getRerouteField<K extends keyof RerouteData>(
    yreroute: Y.Map<unknown>,
    field: K,
    defaultValue: RerouteData[K] = LayoutStoreImpl.REROUTE_DEFAULTS[field]
  ): RerouteData[K] {
    const typedReroute = yreroute as TypedYMap<RerouteData>
    const value = typedReroute.get(field)
    return value ?? defaultValue
  }

  /**
   * Get or create a customRef for a node layout
   */
  getNodeLayoutRef(nodeId: NodeId): Ref<NodeLayout | null> {
    const nodeKey = nodeId
    let nodeRef = this.nodeRefs.get(nodeKey)

    if (!nodeRef) {
      nodeRef = customRef<NodeLayout | null>((track, trigger) => {
        this.nodeTriggers.set(nodeKey, trigger)

        return {
          get: () => {
            track()
            const ynode = this.ynodes.get(nodeKey)
            const layout = ynode ? yNodeToLayout(ynode) : null
            return layout
          },
          set: (newLayout: NodeLayout | null) => {
            // No caller assigns null through this ref; deletion goes through
            // layoutMutations.deleteNode, which carries a graphId.
            if (newLayout === null) return

            // Update operation - detect what changed
            const existing = this.ynodes.get(nodeKey)
            if (!existing) {
              // Create operation
              this.applyOperation({
                type: 'createNode',
                entity: 'node',
                nodeId,
                layout: newLayout,
                timestamp: Date.now(),
                source: this.currentSource,
                actor: this.currentActor
              })
            } else {
              const existingLayout = yNodeToLayout(existing)

              // Check what properties changed
              if (
                existingLayout.position.x !== newLayout.position.x ||
                existingLayout.position.y !== newLayout.position.y
              ) {
                this.applyOperation({
                  type: 'moveNode',
                  entity: 'node',
                  nodeId,
                  position: newLayout.position,
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
                  entity: 'node',
                  nodeId,
                  size: newLayout.size,
                  timestamp: Date.now(),
                  source: this.currentSource,
                  actor: this.currentActor
                })
              }
              if (existingLayout.zIndex !== newLayout.zIndex) {
                this.applyOperation({
                  type: 'setNodeZIndex',
                  entity: 'node',
                  nodeId,
                  zIndex: newLayout.zIndex,
                  timestamp: Date.now(),
                  source: this.currentSource,
                  actor: this.currentActor
                })
              }
            }
            trigger()
          }
        }
      })

      this.nodeRefs.set(nodeKey, nodeRef)
    }

    return nodeRef
  }

  /**
   * Get nodes within bounds (reactive)
   */
  getNodesInBounds(bounds: Bounds): ComputedRef<NodeId[]> {
    return computed(() => {
      // Touch version for reactivity
      void this.version.value

      const result: NodeId[] = []
      for (const [rawNodeId, ynode] of this.ynodes) {
        const nodeId = toNodeId(rawNodeId)
        const layout = yNodeToLayout(ynode)
        if (boundsIntersect(layout.bounds, bounds)) {
          result.push(nodeId)
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
      void this.version.value

      const result = new Map<NodeId, NodeLayout>()
      for (const [rawNodeId, ynode] of this.ynodes) {
        const nodeId = toNodeId(rawNodeId)
        const layout = yNodeToLayout(ynode)
        result.set(nodeId, layout)
      }
      return result
    })
  }

  /**
   * Get all groups as a reactive map
   */
  getAllGroups(
    rootGraphId: UUID
  ): ComputedRef<ReadonlyMap<GroupId, GroupLayout>> {
    return computed(() => {
      void this.version.value

      const result = new Map<GroupId, GroupLayout>()
      for (const [key, ygroup] of this.ygroups) {
        const parsed = parseLayoutKey(key)
        if (parsed.graphId !== rootGraphId) continue
        result.set(parsed.localId, yGroupToLayout(ygroup, parsed.localId))
      }
      return result
    })
  }

  getGroupLayout(rootGraphId: UUID, groupId: GroupId): GroupLayout | null {
    const ygroup = this.ygroups.get(makeScopedLayoutKey(rootGraphId, groupId))
    return ygroup ? yGroupToLayout(ygroup, groupId) : null
  }

  /**
   * Get current version for change detection
   */
  getVersion(): ComputedRef<number> {
    return computed(() => this.version.value)
  }

  /**
   * Query node at point (non-reactive for performance)
   */
  queryNodeAtPoint(point: Point): NodeId | null {
    const nodes: Array<[NodeId, NodeLayout]> = []

    for (const [rawNodeId, ynode] of this.ynodes) {
      const nodeId = toNodeId(rawNodeId)
      const layout = yNodeToLayout(ynode)
      nodes.push([nodeId, layout])
    }

    // Sort by zIndex (top to bottom)
    nodes.sort(([, a], [, b]) => b.zIndex - a.zIndex)

    for (const [nodeId, layout] of nodes) {
      if (pointInBounds(point, layout.bounds)) {
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
   * Update link layout data (for geometry/debug, no separate spatial index)
   */
  updateLinkLayout(linkId: LinkId, layout: LinkLayout): void {
    const existing = this.linkLayouts.get(linkId)

    if (
      existing &&
      isBoundsEqual(existing.bounds, layout.bounds) &&
      isPointEqual(existing.centerPos, layout.centerPos)
    ) {
      if (layout.path) {
        existing.path = layout.path
      }
      return
    }

    this.linkLayouts.set(linkId, { ...layout, id: linkId })
  }

  /**
   * Delete link layout data
   */
  deleteLinkLayout(linkId: LinkId): void {
    const deleted = this.linkLayouts.delete(linkId)
    if (deleted) {
      this.cleanupLinkSegments(linkId)
    }
  }
  /**
   * Update slot layout data
   */
  updateSlotLayout(key: SlotId, layout: SlotLayout): void {
    const existing = this.slotLayouts.get(key)

    if (existing) {
      // Short-circuit if geometry is unchanged
      if (
        isPointEqual(existing.position, layout.position) &&
        isBoundsEqual(existing.bounds, layout.bounds)
      ) {
        return
      }
      // Update spatial index
      this.slotSpatialIndex.update(key, layout.bounds)
    } else {
      // Insert into spatial index
      this.slotSpatialIndex.insert(key, layout.bounds)
    }

    this.slotLayouts.set(key, layout)
  }

  /**
   * Batch update slot layouts and spatial index in one pass
   */
  batchUpdateSlotLayouts(
    updates: Array<{ key: SlotId; layout: SlotLayout }>
  ): void {
    if (!updates.length) return

    // Update spatial index and map entries (skip unchanged)
    for (const { key, layout } of updates) {
      const existing = this.slotLayouts.get(key)

      if (existing) {
        // Short-circuit if geometry is unchanged
        if (
          isPointEqual(existing.position, layout.position) &&
          isBoundsEqual(existing.bounds, layout.bounds)
        ) {
          continue
        }
        this.slotSpatialIndex.update(key, layout.bounds)
      } else {
        this.slotSpatialIndex.insert(key, layout.bounds)
      }
      this.slotLayouts.set(key, layout)
    }
  }

  /**
   * Delete slot layout data
   */
  deleteSlotLayout(key: SlotId): void {
    const deleted = this.slotLayouts.delete(key)
    if (deleted) {
      // Remove from spatial index
      this.slotSpatialIndex.remove(key)
    }
  }

  /**
   * Clear all slot layouts and their spatial index (O(1) operations)
   * Used when switching rendering modes (Vue ↔ LiteGraph)
   */
  clearAllSlotLayouts(): void {
    this.slotLayouts.clear()
    this.slotSpatialIndex.clear()
  }

  /**
   * Update reroute layout data
   */
  updateRerouteLayout(
    rootGraphId: UUID,
    rerouteId: RerouteId,
    layout: RerouteLayout
  ): void {
    const rerouteKey = makeScopedLayoutKey(rootGraphId, rerouteId)
    const existing = this.rerouteLayouts.get(rerouteKey)

    if (!existing) {
      logger.debug('Adding reroute layout:', {
        rerouteId,
        position: layout.position,
        bounds: layout.bounds
      })
    }

    if (existing) {
      // Update spatial index
      this.rerouteSpatialIndex.update(rerouteKey, layout.bounds)
    } else {
      // Insert into spatial index
      this.rerouteSpatialIndex.insert(rerouteKey, layout.bounds)
    }

    this.rerouteLayouts.set(rerouteKey, layout)
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
  getSlotLayout(key: SlotId): SlotLayout | null {
    return this.slotLayouts.get(key) || null
  }

  /**
   * Get reroute layout data
   */
  getRerouteLayout(
    rootGraphId: UUID,
    rerouteId: RerouteId
  ): RerouteLayout | null {
    return (
      this.rerouteLayouts.get(makeScopedLayoutKey(rootGraphId, rerouteId)) ??
      null
    )
  }

  /**
   * Returns all slot layout keys currently tracked by the store.
   * Useful for global passes without relying on spatial queries.
   */
  getAllSlotKeys(): SlotId[] {
    return Array.from(this.slotLayouts.keys())
  }

  /**
   * Update link segment layout data
   */
  updateLinkSegmentLayout(
    linkId: LinkId,
    rerouteId: RerouteId | null,
    layout: Omit<LinkSegmentLayout, 'linkId' | 'rerouteId'>
  ): void {
    const key = makeLinkSegmentKey(linkId, rerouteId)
    const existing = this.linkSegmentLayouts.get(key)

    if (
      existing &&
      isBoundsEqual(existing.bounds, layout.bounds) &&
      isPointEqual(existing.centerPos, layout.centerPos)
    ) {
      if (layout.path) {
        existing.path = layout.path
      }
      return
    }

    const fullLayout: LinkSegmentLayout = {
      ...layout,
      linkId,
      rerouteId
    }

    if (!existing) {
      logger.debug('Adding link segment:', {
        linkId,
        rerouteId,
        bounds: layout.bounds,
        hasPath: !!layout.path
      })
    }

    if (existing) {
      this.linkSegmentSpatialIndex.update(key, layout.bounds)
    } else {
      this.linkSegmentSpatialIndex.insert(key, layout.bounds)
    }

    this.linkSegmentLayouts.set(key, fullLayout)
  }

  /**
   * Delete link segment layout data
   */
  deleteLinkSegmentLayout(linkId: LinkId, rerouteId: RerouteId | null): void {
    const key = makeLinkSegmentKey(linkId, rerouteId)
    const deleted = this.linkSegmentLayouts.delete(key)
    if (deleted) {
      this.linkSegmentSpatialIndex.remove(key)
    }
  }
  /**
   * Query link segment at point (returns structured data)
   */
  queryLinkSegmentAtPoint(
    point: Point,
    ctx?: CanvasRenderingContext2D
  ): { linkId: LinkId; rerouteId: RerouteId | null } | null {
    // Determine tolerance from current canvas state (if available)
    // - Use the caller-provided ctx.lineWidth (LGraphCanvas sets this to connections_width + padding)
    // - Fall back to a sensible default when ctx is not provided
    const hitWidth = ctx?.lineWidth ?? 10
    const halfSize = Math.max(10, hitWidth) // keep a minimum window for spatial index

    // Use spatial index to get candidate segments
    const searchArea = {
      x: point.x - halfSize,
      y: point.y - halfSize,
      width: halfSize * 2,
      height: halfSize * 2
    }
    const candidateKeys = this.linkSegmentSpatialIndex.query(searchArea)

    if (candidateKeys.length > 0) {
      logger.debug('Checking link segments at point:', {
        point,
        candidateCount: candidateKeys.length,
        tolerance: hitWidth
      })
    }

    // Precise hit test only on candidates
    for (const key of candidateKeys) {
      const segmentLayout = this.linkSegmentLayouts.get(key)
      if (!segmentLayout) continue

      if (ctx && segmentLayout.path) {
        // Match LiteGraph behavior: hit test uses device pixel ratio for coordinates
        const dpi =
          (typeof window !== 'undefined' && window?.devicePixelRatio) || 1
        const hit = ctx.isPointInStroke(
          segmentLayout.path,
          point.x * dpi,
          point.y * dpi
        )

        if (hit) {
          logger.debug('Link segment hit:', {
            linkId: segmentLayout.linkId,
            rerouteId: segmentLayout.rerouteId,
            point
          })
          return {
            linkId: segmentLayout.linkId,
            rerouteId: segmentLayout.rerouteId
          }
        }
      } else if (pointInBounds(point, segmentLayout.bounds)) {
        // Fallback to bounding box test
        return {
          linkId: segmentLayout.linkId,
          rerouteId: segmentLayout.rerouteId
        }
      }
    }

    return null
  }

  /**
   * Query link at point (derived from segment query)
   */
  queryLinkAtPoint(
    point: Point,
    ctx?: CanvasRenderingContext2D
  ): LinkId | null {
    // Invoke segment query and return just the linkId
    const segment = this.queryLinkSegmentAtPoint(point, ctx)
    return segment ? segment.linkId : null
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
      if (slotLayout && pointInBounds(point, slotLayout.bounds)) {
        return slotLayout
      }
    }
    return null
  }

  /**
   * Query reroute at point
   */
  queryRerouteAtPoint(rootGraphId: UUID, point: Point): RerouteLayout | null {
    // Use spatial index to get candidate reroutes
    const maxRadius = 20 // Maximum expected reroute radius
    const searchArea = {
      x: point.x - maxRadius,
      y: point.y - maxRadius,
      width: maxRadius * 2,
      height: maxRadius * 2
    }
    const candidateRerouteKeys = this.rerouteSpatialIndex.query(searchArea)

    if (candidateRerouteKeys.length > 0) {
      logger.debug('Checking reroutes at point:', {
        point,
        candidateCount: candidateRerouteKeys.length
      })
    }

    // Check precise distance for candidates
    for (const rerouteKey of candidateRerouteKeys) {
      const parsed = parseLayoutKey(rerouteKey)
      if (parsed.graphId !== rootGraphId) continue
      const rerouteLayout = this.rerouteLayouts.get(rerouteKey)
      if (rerouteLayout) {
        const dx = point.x - rerouteLayout.position.x
        const dy = point.y - rerouteLayout.position.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance <= rerouteLayout.radius) {
          logger.debug('Reroute hit:', {
            rerouteId: rerouteLayout.id,
            position: rerouteLayout.position,
            distance
          })
          return rerouteLayout
        }
      }
    }
    return null
  }

  /**
   * Query all items in bounds
   */
  queryItemsInBounds(
    rootGraphId: UUID,
    bounds: Bounds
  ): {
    nodes: NodeId[]
    links: LinkId[]
    slots: SlotId[]
    reroutes: RerouteId[]
  } {
    // Query segments and union their linkIds
    const segmentKeys = this.linkSegmentSpatialIndex.query(bounds)
    const linkIds = new Set<LinkId>()
    for (const key of segmentKeys) {
      const segment = this.linkSegmentLayouts.get(key)
      if (segment) {
        linkIds.add(segment.linkId)
      }
    }

    return {
      nodes: this.queryNodesInBounds(bounds),
      links: Array.from(linkIds),
      slots: this.slotSpatialIndex.query(bounds),
      reroutes: this.rerouteSpatialIndex
        .query(bounds)
        .map(parseLayoutKey)
        .filter((key) => key.graphId === rootGraphId)
        .map((key) => toRerouteId(key.localId))
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
      case 'batchUpdateBounds':
        this.handleBatchUpdateBounds(operation, change)
        break
      case 'createReroute':
        this.handleCreateReroute(operation, change)
        break
      case 'deleteReroute':
        this.handleDeleteReroute(operation, change)
        break
      case 'moveReroute':
        this.handleMoveReroute(operation, change)
        break
      case 'createGroup':
        this.ygroups.set(
          makeScopedLayoutKey(operation.graphId, operation.groupId),
          layoutToYGroup(operation.layout)
        )
        change.type = 'create'
        break
      case 'setGroupBounds':
        this.handleSetGroupBounds(operation)
        break
      case 'deleteGroup':
        this.ygroups.delete(
          makeScopedLayoutKey(operation.graphId, operation.groupId)
        )
        change.type = 'delete'
        break
    }
  }

  /**
   * Finalize operation after transaction
   */
  private finalizeOperation(change: LayoutChange): void {
    // Update version
    this.version.value++

    // Manually trigger affected node refs after transaction
    // This is needed because Yjs observers don't fire for property changes
    change.nodeIds.forEach((nodeId) => {
      const trigger = this.nodeTriggers.get(nodeId)
      if (trigger) {
        trigger()
      }
    })

    // Keep node-scoped listeners synchronous for immediate local feedback,
    // but queue global listener fan-out to avoid blocking hot paths.
    this.notifyNodeChange(change)
    this.queueGlobalChange(change)
  }

  /**
   * Subscribe to layout changes
   */
  onChange(callback: (change: LayoutChange) => void): () => void {
    this.changeListeners.add(callback)
    return () => this.changeListeners.delete(callback)
  }

  onNodeChange(
    nodeId: NodeId,
    callback: (change: LayoutChange) => void
  ): () => void {
    const listenersForNode = this.nodeChangeListeners.get(nodeId) ?? new Set()
    listenersForNode.add(callback)
    this.nodeChangeListeners.set(nodeId, listenersForNode)

    return () => {
      const existingListeners = this.nodeChangeListeners.get(nodeId)
      if (!existingListeners) return

      existingListeners.delete(callback)
      if (existingListeners.size === 0) {
        this.nodeChangeListeners.delete(nodeId)
      }
    }
  }

  /**
   * Set the current operation source
   */
  setSource(source: LayoutSource): void {
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
  getCurrentSource(): LayoutSource {
    return this.currentSource
  }

  /**
   * Get the current actor
   */
  getCurrentActor(): string {
    return this.currentActor
  }

  /**
   * Clean up refs and triggers for a node when its Vue component unmounts.
   * This should be called from the component's onUnmounted hook.
   */
  cleanupNodeRef(nodeId: NodeId): void {
    this.nodeRefs.delete(nodeId)
    this.nodeTriggers.delete(nodeId)
  }

  /**
   * Drops everything, including node entries. Only correct when no graph is
   * attached — nodes normally leave the store via `LGraph.remove`.
   */
  reset(): void {
    this.ydoc.transact(() => {
      this.ynodes.clear()
      this.ygroups.clear()
      this.yreroutes.clear()
      this.spatialIndex.clear()
    }, 'initialization')
    this.clearViewGeometry()
  }

  /**
   * Drops the geometry that belongs to the graph being left: slot and link
   * layouts, and the spatial indexes over them. Node, group and reroute
   * entries are not touched — those live with the entity itself.
   */
  clearViewGeometry(): void {
    this.ydoc.transact(() => {
      // Note: We intentionally do NOT clear nodeRefs and nodeTriggers here.
      // Vue components may already hold references to these refs, and clearing
      // them would break the reactivity chain. The refs will be reused when
      // nodes are recreated, and stale refs will be cleaned up over time.
      this.nodeChangeListeners.clear()
      this.linkSegmentSpatialIndex.clear()
      this.slotSpatialIndex.clear()
      this.linkLayouts.clear()
      this.linkSegmentLayouts.clear()
      this.slotLayouts.clear()
      // Reroute layouts outlive active-graph switches.
      this.pendingGlobalChanges = []
      this.isGlobalDispatchQueued = false

      this.nodeTriggers.forEach((trigger) => trigger())
    }, 'initialization')
  }

  // Operation handlers
  private handleMoveNode(
    operation: MoveNodeOperation,
    change: LayoutChange
  ): void {
    const { nodeId } = operation
    const ynode = this.ynodes.get(String(nodeId))
    if (!ynode) {
      return
    }

    const size = yNodeToLayout(ynode).size
    const newBounds = {
      x: operation.position.x,
      y: operation.position.y,
      width: size.width,
      height: size.height
    }

    // Update spatial index FIRST, synchronously to prevent race conditions
    // Hit detection queries can run before CRDT updates complete
    this.spatialIndex.update(nodeId, newBounds)

    // Then update CRDT
    ynode.set('rect', [
      operation.position.x,
      operation.position.y,
      size.width,
      size.height
    ])

    change.nodeIds.push(nodeId)
  }

  private handleResizeNode(
    operation: ResizeNodeOperation,
    change: LayoutChange
  ): void {
    const { nodeId } = operation
    const ynode = this.ynodes.get(String(nodeId))
    if (!ynode) return

    const position = yNodeToLayout(ynode).position
    const newBounds = {
      x: position.x,
      y: position.y,
      width: operation.size.width,
      height: operation.size.height
    }

    // Update spatial index FIRST, synchronously to prevent race conditions
    // Hit detection queries can run before CRDT updates complete
    this.spatialIndex.update(nodeId, newBounds)

    // Then update CRDT
    ynode.set('rect', [
      position.x,
      position.y,
      operation.size.width,
      operation.size.height
    ])

    change.nodeIds.push(nodeId)
  }

  private handleSetGroupBounds(operation: SetGroupBoundsOperation): void {
    const ygroup = this.ygroups.get(
      makeScopedLayoutKey(operation.graphId, operation.groupId)
    )
    if (!ygroup) return

    setYGroupRect(ygroup, operation.position, operation.size)
  }

  private handleSetNodeZIndex(
    operation: SetNodeZIndexOperation,
    change: LayoutChange
  ): void {
    const { nodeId } = operation
    const ynode = this.ynodes.get(String(nodeId))
    if (!ynode) return

    ynode.set('zIndex', operation.zIndex)
    change.nodeIds.push(nodeId)
  }

  private handleCreateNode(
    operation: CreateNodeOperation,
    change: LayoutChange
  ): void {
    const { nodeId } = operation
    const ynode = layoutToYNode(operation.layout)
    this.ynodes.set(String(nodeId), ynode)

    // Add to spatial index
    this.spatialIndex.insert(nodeId, operation.layout.bounds)

    change.type = 'create'
    change.nodeIds.push(nodeId)
  }

  private handleDeleteNode(
    operation: DeleteNodeOperation,
    change: LayoutChange
  ): void {
    const { nodeId } = operation
    const nodeKey = String(nodeId)
    if (!this.ynodes.has(nodeKey)) return

    this.ynodes.delete(nodeKey)
    // Note: We intentionally do NOT delete nodeRefs and nodeTriggers here.
    // During undo/redo, Vue components may still hold references to the old ref.
    // If we delete the trigger, Vue won't be notified when the node is re-created.
    // The trigger will be called in finalizeOperation to notify Vue of the change.
    // We also intentionally do NOT delete slot layouts here for the same reason,
    // and cleanup is handled by onUnmounted in useSlotElementTracking.
    // Remove from spatial index
    this.spatialIndex.remove(nodeId)
    // Link geometry is cleaned up per-link by LLink.disconnect as the node's
    // connections are severed, so nothing to do here.

    change.type = 'delete'
    change.nodeIds.push(nodeId)
  }

  private handleBatchUpdateBounds(
    operation: BatchUpdateBoundsOperation,
    change: LayoutChange
  ): void {
    const spatialUpdates: Array<{ nodeId: NodeId; bounds: Bounds }> = []

    for (const nodeId of operation.nodeIds) {
      const bounds = operation.bounds[nodeId]
      const ynode = this.ynodes.get(String(nodeId))
      if (!ynode || !bounds) continue

      ynode.set('rect', [bounds.x, bounds.y, bounds.width, bounds.height])

      spatialUpdates.push({ nodeId, bounds })
      change.nodeIds.push(nodeId)
    }

    // Batch update spatial index for better performance
    if (spatialUpdates.length > 0) {
      this.spatialIndex.batchUpdate(spatialUpdates)
    }

    if (change.nodeIds.length) {
      change.type = 'update'
    }
  }

  private handleCreateReroute(
    operation: CreateRerouteOperation,
    change: LayoutChange
  ): void {
    const rerouteData = new Y.Map<unknown>()
    rerouteData.set('id', operation.rerouteId)
    rerouteData.set('position', operation.position)

    const rerouteKey = makeScopedLayoutKey(
      operation.graphId,
      operation.rerouteId
    )
    this.yreroutes.set(rerouteKey, rerouteData)
    change.type = 'create'
  }

  private handleDeleteReroute(
    operation: DeleteRerouteOperation,
    change: LayoutChange
  ): void {
    const rerouteKey = makeScopedLayoutKey(
      operation.graphId,
      operation.rerouteId
    )
    if (!this.yreroutes.has(rerouteKey)) return

    this.yreroutes.delete(rerouteKey)
    this.rerouteLayouts.delete(rerouteKey)
    this.rerouteSpatialIndex.remove(rerouteKey)
    change.type = 'delete'
  }

  private handleMoveReroute(
    operation: MoveRerouteOperation,
    change: LayoutChange
  ): void {
    const rerouteKey = makeScopedLayoutKey(
      operation.graphId,
      operation.rerouteId
    )
    const yreroute = this.yreroutes.get(rerouteKey)
    if (!yreroute) return

    yreroute.set('position', operation.position)
    this.updateRerouteLayout(
      operation.graphId,
      operation.rerouteId,
      this.createRerouteLayout(operation.rerouteId, operation.position)
    )
    change.type = 'update'
  }

  /**
   * Clean up all segment layouts for a link
   */
  private cleanupLinkSegments(linkId: LinkId): void {
    const linkPrefix = `${linkId}:`
    const keysToDelete: string[] = []
    for (const [key] of this.linkSegmentLayouts) {
      if (key.startsWith(linkPrefix)) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.linkSegmentLayouts.delete(key)
      this.linkSegmentSpatialIndex.remove(key)
    }
  }

  /**
   * Handle reroute change events
   */
  private handleRerouteChange(change: YEventChange, key: string): void {
    const parsed = parseLayoutKey(key)
    const graphId = parsed.graphId
    const rerouteId = toRerouteId(parsed.localId)

    if (change.action === 'delete') {
      this.rerouteLayouts.delete(key as ScopedLayoutKey)
      this.rerouteSpatialIndex.remove(key as ScopedLayoutKey)
      return
    }

    const rerouteData = this.yreroutes.get(key)
    if (!rerouteData) return
    const position = this.getRerouteField(rerouteData, 'position')
    this.updateRerouteLayout(
      graphId,
      rerouteId,
      this.createRerouteLayout(rerouteId, position)
    )
  }

  /**
   * Create reroute layout from position
   */
  private createRerouteLayout(
    rerouteId: RerouteId,
    position: Point
  ): RerouteLayout {
    return {
      id: rerouteId,
      position,
      radius: REROUTE_RADIUS,
      bounds: {
        x: position.x - REROUTE_RADIUS,
        y: position.y - REROUTE_RADIUS,
        width: REROUTE_RADIUS * 2,
        height: REROUTE_RADIUS * 2
      }
    }
  }

  // Helper methods

  private queueGlobalChange(change: LayoutChange): void {
    if (this.changeListeners.size === 0) return

    this.pendingGlobalChanges.push(change)
    if (this.isGlobalDispatchQueued) return

    this.isGlobalDispatchQueued = true
    queueMicrotask(() => {
      this.flushQueuedGlobalChanges()
    })
  }

  private flushQueuedGlobalChanges(): void {
    this.isGlobalDispatchQueued = false
    if (this.pendingGlobalChanges.length === 0) return

    const queuedChanges = this.pendingGlobalChanges
    this.pendingGlobalChanges = []

    queuedChanges.forEach((queuedChange) => {
      this.notifyChange(queuedChange)
    })
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

  private notifyNodeChange(change: LayoutChange): void {
    for (const nodeId of new Set(change.nodeIds)) {
      const listeners = this.nodeChangeListeners.get(nodeId)
      if (!listeners) continue

      listeners.forEach((listener) => {
        try {
          listener(change)
        } catch (error) {
          console.error('Error in node-scoped layout change listener:', error)
        }
      })
    }
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

  /**
   * Batch update node bounds using Yjs transaction for atomicity.
   */
  batchUpdateNodeBounds(updates: NodeBoundsUpdate[]): void {
    if (updates.length === 0) return

    const originalSource = this.currentSource
    const shouldNormalizeHeights = originalSource === LayoutSource.DOM
    this.currentSource = LayoutSource.Vue

    const nodeIds: NodeId[] = []
    const boundsRecord: BatchUpdateBoundsOperation['bounds'] = {}

    for (const { nodeId, bounds } of updates) {
      if (!this.ynodes.has(String(nodeId))) continue

      boundsRecord[nodeId] = shouldNormalizeHeights
        ? { ...bounds, height: removeNodeTitleHeight(bounds.height) }
        : bounds
      nodeIds.push(nodeId)
    }

    if (!nodeIds.length) {
      this.currentSource = originalSource
      return
    }

    const operation: BatchUpdateBoundsOperation = {
      type: 'batchUpdateBounds',
      entity: 'node',
      nodeIds,
      bounds: boundsRecord,
      timestamp: Date.now(),
      source: this.currentSource,
      actor: this.currentActor
    }

    this.applyOperation(operation)

    this.currentSource = originalSource
  }
}

// Create singleton instance
export const layoutStore = new LayoutStoreImpl()
