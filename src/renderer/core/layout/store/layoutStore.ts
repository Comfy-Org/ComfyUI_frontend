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

import { toGroupId } from '@/types/groupId'
import type { GroupId } from '@/types/groupId'
import { removeNodeTitleHeight } from '@/renderer/core/layout/utils/nodeSizeUtil'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import type { UUID } from '@/utils/uuid'

import { ACTOR_CONFIG } from '@/renderer/core/layout/constants'
import { LayoutSource } from '@/renderer/core/layout/types'
import type {
  BatchUpdateBoundsOperation,
  CreateNodeOperation,
  CreateRerouteOperation,
  DeleteNodeOperation,
  DeleteRerouteOperation,
  GroupLayout,
  LayoutChange,
  LayoutOperation,
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
  pointInBounds
} from '@/renderer/core/layout/utils/layoutMath'
import { makeLinkSegmentKey } from '@/renderer/core/layout/utils/layoutUtils'
import {
  layoutToYGroup,
  setYGroupRect,
  layoutToYNode,
  yGroupToLayout,
  yNodeGeometry,
  yNodeToLayout
} from '@/renderer/core/layout/utils/mappers'
import type {
  GroupLayoutMap,
  NodeLayoutMap
} from '@/renderer/core/layout/utils/mappers'
import { SpatialIndexManager } from '@/renderer/core/spatial/SpatialIndex'

const logger = log.getLogger('LayoutStore')

type ScopedLayoutKey = string & { readonly __brand: 'ScopedLayoutKey' }

/** Yjs surfaces its own keys as raw strings; brand them back on the way in. */
function toScopedLayoutKey(key: string): ScopedLayoutKey {
  return key as ScopedLayoutKey
}

function makeScopedLayoutKey(
  graphId: UUID,
  localId: number | string
): ScopedLayoutKey {
  return toScopedLayoutKey(graphId + ':' + localId)
}

/** A UUID never contains `:`, so the first one always ends the graph id. */
function parseLayoutKey(key: string): { graphId: UUID; localId: string } {
  const separatorIndex = key.indexOf(':')
  return {
    graphId: key.slice(0, separatorIndex) as UUID,
    localId: key.slice(separatorIndex + 1)
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

class LayoutStore {
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
    ScopedLayoutKey,
    Set<(change: LayoutChange) => void>
  >()
  private pendingGlobalChanges: LayoutChange[] = []
  private isGlobalDispatchQueued = false
  private geometryChangeListeners = new Set<
    (graphIds: ReadonlySet<UUID>) => void
  >()
  private pendingGeometryGraphIds = new Set<UUID>()

  // CustomRef cache and trigger functions
  private nodeRefs = new Map<ScopedLayoutKey, Ref<NodeLayout | null>>()
  private nodeTriggers = new Map<ScopedLayoutKey, () => void>()

  // New data structures for hit testing
  private linkLayouts = new Map<LinkId, LinkLayout>()
  private linkSegmentLayouts = new Map<string, LinkSegmentLayout>() // Internal string key: ${linkId}:${rerouteId ?? 'final'}
  private slotLayouts = new Map<SlotId, SlotLayout>()
  private rerouteLayouts = new Map<ScopedLayoutKey, RerouteLayout>()

  // Spatial index managers
  private linkSegmentSpatialIndex: SpatialIndexManager<string> // For link segments (single index for all link geometry)
  private slotSpatialIndex: SpatialIndexManager<SlotId> // For slots
  private rerouteSpatialIndex: SpatialIndexManager<ScopedLayoutKey> // For reroutes

  private highestZIndex = 0

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
    this.linkSegmentSpatialIndex = new SpatialIndexManager<string>() // Single index for all link geometry
    this.slotSpatialIndex = new SpatialIndexManager<SlotId>()
    this.rerouteSpatialIndex = new SpatialIndexManager<ScopedLayoutKey>()

    this.ydoc.on('afterTransaction', () => {
      if (this.pendingGeometryGraphIds.size === 0) return

      const graphIds = new Set(this.pendingGeometryGraphIds)
      this.pendingGeometryGraphIds.clear()
      this.notifyGeometryChange(graphIds)
    })

    this.ynodes.observeDeep((events) => {
      const nodeKeys = new Set<string>()
      for (const event of events) {
        if (event.path.length === 0 && event instanceof Y.YMapEvent) {
          event.changes.keys.forEach((_change, key) => nodeKeys.add(key))
        } else if (typeof event.path[0] === 'string') {
          nodeKeys.add(event.path[0])
        }
      }
      if (nodeKeys.size === 0) return

      for (const key of nodeKeys) {
        const ynode = this.ynodes.get(key)
        if (ynode) {
          const { zIndex } = yNodeToLayout(ynode)
          this.highestZIndex = Math.max(this.highestZIndex, zIndex)
        }
        this.nodeTriggers.get(toScopedLayoutKey(key))?.()
      }
      this.version.value++
      for (const key of nodeKeys) {
        this.pendingGeometryGraphIds.add(parseLayoutKey(key).graphId)
      }
    })

    this.ygroups.observeDeep((events) => {
      for (const event of events) {
        if (event.path.length === 0 && event instanceof Y.YMapEvent) {
          event.changes.keys.forEach((_change, key) => {
            this.pendingGeometryGraphIds.add(parseLayoutKey(key).graphId)
          })
        } else if (typeof event.path[0] === 'string') {
          this.pendingGeometryGraphIds.add(parseLayoutKey(event.path[0]).graphId)
        }
      }
      this.version.value++
    })

    this.yreroutes.observeDeep((events) => {
      const rerouteKeys = new Set<string>()
      for (const event of events) {
        if (event.path.length === 0 && event instanceof Y.YMapEvent) {
          event.changes.keys.forEach((_change, key) => rerouteKeys.add(key))
        } else if (typeof event.path[0] === 'string') {
          rerouteKeys.add(event.path[0])
        }
      }
      if (rerouteKeys.size === 0) return

      for (const key of rerouteKeys) this.projectReroute(toScopedLayoutKey(key))
      this.version.value++
      for (const key of rerouteKeys) {
        this.pendingGeometryGraphIds.add(parseLayoutKey(key).graphId)
      }
    })
  }

  private getRerouteField<K extends keyof RerouteData>(
    yreroute: Y.Map<unknown>,
    field: K,
    defaultValue: RerouteData[K] = LayoutStore.REROUTE_DEFAULTS[field]
  ): RerouteData[K] {
    const typedReroute = yreroute as TypedYMap<RerouteData>
    const value = typedReroute.get(field)
    return value ?? defaultValue
  }

  getNodeLayout(rootGraphId: UUID, nodeId: NodeId): NodeLayout | null {
    const ynode = this.ynodes.get(makeScopedLayoutKey(rootGraphId, nodeId))
    return ynode ? yNodeToLayout(ynode) : null
  }

  /**
   * Get or create a customRef for a node layout
   */
  getNodeLayoutRef(rootGraphId: UUID, nodeId: NodeId): Ref<NodeLayout | null> {
    const nodeKey = makeScopedLayoutKey(rootGraphId, nodeId)
    let nodeRef = this.nodeRefs.get(nodeKey)

    if (!nodeRef) {
      nodeRef = customRef<NodeLayout | null>((track, trigger) => {
        this.nodeTriggers.set(nodeKey, trigger)

        return {
          get: () => {
            track()
            return this.getNodeLayout(rootGraphId, nodeId)
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
                graphId: rootGraphId,
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
                  graphId: rootGraphId,
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
                  graphId: rootGraphId,
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
                  graphId: rootGraphId,
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
        const groupId = toGroupId(Number(parsed.localId))
        result.set(groupId, yGroupToLayout(ygroup, groupId))
      }
      return result
    })
  }

  getGroupLayout(rootGraphId: UUID, groupId: GroupId): GroupLayout | null {
    const ygroup = this.ygroups.get(makeScopedLayoutKey(rootGraphId, groupId))
    return ygroup ? yGroupToLayout(ygroup, groupId) : null
  }

  get geometryVersion(): number {
    return this.version.value
  }

  readNodeRect(rootGraphId: UUID, nodeId: NodeId, out: Float64Array): boolean {
    const ynode = this.ynodes.get(makeScopedLayoutKey(rootGraphId, nodeId))
    if (!ynode) return false
    const { position, size } = yNodeGeometry(ynode)

    out[0] = position.x
    out[1] = position.y
    out[2] = size.width
    out[3] = size.height
    return true
  }

  /**
   * Get current version for change detection
   */
  getVersion(): ComputedRef<number> {
    return computed(() => this.version.value)
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
   * Apply a layout operation using Yjs transactions
   */
  applyOperation(operation: LayoutOperation): void {
    // Create change object outside transaction so we can use it after
    const change: LayoutChange = {
      type: 'update',
      nodeIds: [],
      sizeChangedNodeIds: [],
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
      case 'clearGraph':
        this.handleClearGraph(operation.graphId, change)
        break
    }
  }

  private handleClearGraph(graphId: UUID, change: LayoutChange): void {
    const prefix = graphId + ':'

    for (const key of [...this.ynodes.keys()]) {
      if (!key.startsWith(prefix)) continue
      this.ynodes.delete(key)
      change.nodeIds.push(toNodeId(parseLayoutKey(key).localId))
    }
    for (const key of [...this.ygroups.keys()]) {
      if (key.startsWith(prefix)) this.ygroups.delete(key)
    }
    for (const key of [...this.yreroutes.keys()]) {
      if (key.startsWith(prefix)) this.yreroutes.delete(key)
    }

    change.type = 'delete'
  }

  /**
   * Finalize operation after transaction
   */
  private finalizeOperation(change: LayoutChange): void {
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

  onGeometryChange(callback: (graphIds: ReadonlySet<UUID>) => void): () => void {
    this.geometryChangeListeners.add(callback)
    return () => this.geometryChangeListeners.delete(callback)
  }

  onNodeChange(
    rootGraphId: UUID,
    nodeId: NodeId,
    callback: (change: LayoutChange) => void
  ): () => void {
    const nodeKey = makeScopedLayoutKey(rootGraphId, nodeId)
    const listenersForNode = this.nodeChangeListeners.get(nodeKey) ?? new Set()
    listenersForNode.add(callback)
    this.nodeChangeListeners.set(nodeKey, listenersForNode)

    return () => {
      const existingListeners = this.nodeChangeListeners.get(nodeKey)
      if (!existingListeners) return

      existingListeners.delete(callback)
      if (existingListeners.size === 0) {
        this.nodeChangeListeners.delete(nodeKey)
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

  /** Allocates store-local stacking order, independent of `LGraph._nodes`. */
  allocateZIndex(): number {
    return ++this.highestZIndex
  }

  cleanupNodeRef(rootGraphId: UUID, nodeId: NodeId): void {
    const nodeKey = makeScopedLayoutKey(rootGraphId, nodeId)
    this.nodeRefs.delete(nodeKey)
    this.nodeTriggers.delete(nodeKey)
  }

  /** Drops entity layout owned by a root graph and its subgraph definitions. */
  clearGraph(rootGraphId: UUID): void {
    this.applyOperation({
      type: 'clearGraph',
      entity: 'graph',
      graphId: rootGraphId,
      timestamp: Date.now(),
      source: this.currentSource,
      actor: this.currentActor
    })
  }

  /** Test-only full reset; attached graph entities become desynchronized. */
  resetForTests(): void {
    this.highestZIndex = 0
    this.ydoc.transact(() => {
      this.ynodes.clear()
      this.ygroups.clear()
      this.yreroutes.clear()
      this.rerouteLayouts.clear()
      this.rerouteSpatialIndex.clear()
    }, 'initialization')
    this.clearViewGeometry()
  }

  /**
   * Clears view geometry and subscriptions; entity geometry has separate
   * lifecycle cleanup.
   */
  clearViewGeometry(): void {
    this.ydoc.transact(() => {
      // Preserve refs held by components so reactivity survives view changes.
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
    const ynode = this.ynodes.get(
      makeScopedLayoutKey(operation.graphId, nodeId)
    )
    if (!ynode) {
      return
    }

    ynode.set('position', { ...operation.position })

    change.nodeIds.push(nodeId)
  }

  private handleResizeNode(
    operation: ResizeNodeOperation,
    change: LayoutChange
  ): void {
    const { nodeId } = operation
    const ynode = this.ynodes.get(
      makeScopedLayoutKey(operation.graphId, nodeId)
    )
    if (!ynode) return

    const { size } = yNodeGeometry(ynode)
    if (
      size.width !== operation.size.width ||
      size.height !== operation.size.height
    ) {
      change.sizeChangedNodeIds.push(nodeId)
    }

    ynode.set('size', { ...operation.size })

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
    const ynode = this.ynodes.get(
      makeScopedLayoutKey(operation.graphId, nodeId)
    )
    if (!ynode) return

    ynode.set('zIndex', operation.zIndex)
    this.highestZIndex = Math.max(this.highestZIndex, operation.zIndex)
    change.nodeIds.push(nodeId)
  }

  private handleCreateNode(
    operation: CreateNodeOperation,
    change: LayoutChange
  ): void {
    const { nodeId } = operation
    const ynode = layoutToYNode(operation.layout)
    this.ynodes.set(makeScopedLayoutKey(operation.graphId, nodeId), ynode)
    this.highestZIndex = Math.max(this.highestZIndex, operation.layout.zIndex)


    change.type = 'create'
    change.nodeIds.push(nodeId)
  }

  private handleDeleteNode(
    operation: DeleteNodeOperation,
    change: LayoutChange
  ): void {
    const { nodeId } = operation
    const nodeKey = makeScopedLayoutKey(operation.graphId, nodeId)
    if (!this.ynodes.has(nodeKey)) return

    this.ynodes.delete(nodeKey)
    // nodeRefs, nodeTriggers and slot layouts outlive the delete: undo/redo
    // re-creates the node against the refs components already hold.
    // Link geometry is cleaned up per-link by LLink.disconnect as the node's
    // connections are severed, so nothing to do here.

    change.type = 'delete'
    change.nodeIds.push(nodeId)
  }

  private handleBatchUpdateBounds(
    operation: BatchUpdateBoundsOperation,
    change: LayoutChange
  ): void {
    for (const nodeId of operation.nodeIds) {
      const bounds = operation.bounds[nodeId]
      const ynode = this.ynodes.get(
        makeScopedLayoutKey(operation.graphId, nodeId)
      )
      if (!ynode || !bounds) continue

      const { size } = yNodeGeometry(ynode)
      if (
        size.width !== bounds.width ||
        size.height !== bounds.height
      ) {
        change.sizeChangedNodeIds.push(nodeId)
      }
      ynode.set('position', { x: bounds.x, y: bounds.y })
      ynode.set('size', { width: bounds.width, height: bounds.height })

      change.nodeIds.push(nodeId)
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
  private projectReroute(key: ScopedLayoutKey): void {
    const parsed = parseLayoutKey(key)
    const graphId = parsed.graphId
    const rerouteId = toRerouteId(Number(parsed.localId))

    const rerouteData = this.yreroutes.get(key)
    if (!rerouteData) {
      this.rerouteLayouts.delete(key)
      this.rerouteSpatialIndex.remove(key)
      return
    }

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
    const { graphId } = change.operation
    for (const nodeId of new Set(change.nodeIds)) {
      const listeners = this.nodeChangeListeners.get(
        makeScopedLayoutKey(graphId, nodeId)
      )
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

  private notifyGeometryChange(graphIds: ReadonlySet<UUID>): void {
    this.geometryChangeListeners.forEach((listener) => {
      try {
        listener(graphIds)
      } catch (error) {
        console.error('Error in geometry change listener:', error)
      }
    })
  }

  /** Sync seam: remote peers exchange document updates through these three. */
  getYDoc(): Y.Doc {
    return this.ydoc
  }

  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.ydoc, update)
  }

  getStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.ydoc)
  }

  /**
   * Batch update node bounds using Yjs transaction for atomicity.
   */
  batchUpdateNodeBounds(rootGraphId: UUID, updates: NodeBoundsUpdate[]): void {
    if (updates.length === 0) return

    const originalSource = this.currentSource
    const shouldNormalizeHeights = originalSource === LayoutSource.DOM
    this.currentSource = LayoutSource.Vue

    const nodeIds: NodeId[] = []
    const boundsRecord: BatchUpdateBoundsOperation['bounds'] = {}

    for (const { nodeId, bounds } of updates) {
      if (!this.ynodes.has(makeScopedLayoutKey(rootGraphId, nodeId))) continue

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
      graphId: rootGraphId,
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
export const layoutStore = new LayoutStore()
