import log from 'loglevel'
import { computed, ref, shallowReactive } from 'vue'
import type { ComputedRef } from 'vue'
import * as Y from 'yjs'

import { toGroupId } from '@/types/groupId'
import { toNodeId } from '@/types/nodeId'
import type { GroupId } from '@/types/groupId'
import { removeNodeTitleHeight } from '@/renderer/core/layout/utils/nodeSizeUtil'
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
  Size,
  SlotOffset,
  SlotOffsetMode
} from '@/renderer/core/layout/types'
import type { SlotDirection, SlotIndex } from '@/types/slotId'
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
  yNodeToLayout
} from '@/renderer/core/layout/utils/mappers'
import type {
  GroupLayoutMap,
  NodeLayoutMap,
  StoredRect
} from '@/renderer/core/layout/utils/mappers'
import { SpatialIndexManager } from '@/renderer/core/spatial/SpatialIndex'

/** Top-level map keys touched by a batch of deep Yjs events. */
function collectEventKeys(
  events: readonly Y.YEvent<Y.AbstractType<unknown>>[]
): Set<string> {
  const keys = new Set<string>()
  for (const event of events) {
    if (event.path.length === 0 && event instanceof Y.YMapEvent) {
      event.changes.keys.forEach((_change, key) => keys.add(key))
    } else if (typeof event.path[0] === 'string') {
      keys.add(event.path[0])
    }
  }
  return keys
}

function createLayoutChange(operation: LayoutOperation): LayoutChange {
  return {
    type: 'update',
    nodeIds: [],
    sizeChangedNodeIds: [],
    timestamp: operation.timestamp,
    source: operation.source,
    operation
  }
}

function isNodeRect(value: unknown): value is StoredRect {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((coordinate) => typeof coordinate === 'number')
  )
}

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

interface BatchUpdateBoundsOptions {
  boundsIncludeTitleHeight?: boolean
  source: LayoutSource
}

interface SlotOffsetSnapshot {
  mode: SlotOffsetMode
  byDirection: Record<SlotDirection, Map<SlotIndex, Point>>
}

function isSlotOffsetSnapshotEqual(
  current: SlotOffsetSnapshot,
  next: SlotOffsetSnapshot
): boolean {
  if (current.mode !== next.mode) return false

  for (const direction of ['input', 'output'] as const) {
    const currentOffsets = current.byDirection[direction]
    const nextOffsets = next.byDirection[direction]
    if (currentOffsets.size !== nextOffsets.size) return false
    for (const [index, point] of nextOffsets) {
      const currentPoint = currentOffsets.get(index)
      if (!currentPoint || !isPointEqual(currentPoint, point)) return false
    }
  }
  return true
}

class LayoutStoreImpl {
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
  private _nodeGeometryVersion = 0
  private _contentSizeVersion = 0
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

  private nodeRevisions = shallowReactive(new Map<ScopedLayoutKey, number>())
  private pendingGeometryGraphIds = new Set<UUID>()
  private geometryListeners = new Set<(graphIds: ReadonlySet<UUID>) => void>()
  private pendingGeometryChanges: ReadonlySet<UUID>[] = []
  private isGeometryDispatchQueued = false

  // New data structures for hit testing
  private linkLayouts = new Map<LinkId, LinkLayout>()
  private linkSegmentLayouts = new Map<string, LinkSegmentLayout>() // Internal string key: ${linkId}:${rerouteId ?? 'final'}
  private slotOffsets = new Map<ScopedLayoutKey, SlotOffsetSnapshot>()
  private contentSizes = new Map<ScopedLayoutKey, Size>()
  private rerouteLayouts = new Map<ScopedLayoutKey, RerouteLayout>()

  // Spatial index managers
  private linkSegmentSpatialIndex: SpatialIndexManager<string> // For link segments (single index for all link geometry)
  private rerouteSpatialIndex: SpatialIndexManager<ScopedLayoutKey> // For reroutes

  private highestZIndex = 0

  // Vue dragging state for selection toolbox (public ref for direct mutation)
  public isDraggingVueNodes = ref(false)
  // Vue resizing state to prevent drag from activating during resize
  public isResizingVueNodes = ref(false)

  /**
   * Number of tracked nodes, without materialising their layouts.
   * Callers that only need a count or emptiness check should prefer this over
   * `getAllNodes()`, which rebuilds the full layout map on every access.
   */
  get nodeCount(): number {
    return this.ynodes.size
  }

  /**
   * Counter bumped when the Yjs-backed node, link and reroute maps change, for
   * use as a cache key.
   *
   * Scope is exactly those maps. Link and reroute *geometry* live in plain
   * Maps that are mutated without bumping this.
   * Anything deriving node geometry from this should also read that geometry
   * from this store, so key and data stay consistent.
   *
   * Local per-peer counter, not a CRDT document version: two peers holding
   * identical layouts will hold different values, so it is not meaningful to
   * compare across peers.
   */
  get layoutVersion(): number {
    return this.version.value
  }

  /**
   * Counter bumped only when node geometry changes: a node is added or
   * removed, or an existing node's position, size or bounds is written.
   *
   * `layoutVersion` counts operations, so it also moves for changes nothing
   * renders from geometry - `setNodeZIndex` alone fires on every widget
   * pointerdown. Consumers that rebuild geometry-derived state should key on
   * this instead, or they repaint for edits that cannot move a pixel.
   *
   * Backed by `observeDeep`, so it covers writes that never touch a top-level
   * key - a move mutates fields inside a node's own map - and therefore also
   * covers remote changes arriving through `applyUpdate`, which run no local
   * operation handler.
   */
  get nodeGeometryVersion(): number {
    return this._nodeGeometryVersion
  }

  /** Non-reactive revision for measured Vue content dimensions. */
  get contentSizeVersion(): number {
    return this._contentSizeVersion
  }

  constructor() {
    // Initialize Yjs data structures
    this.ynodes = this.ydoc.getMap('nodes')
    this.yreroutes = this.ydoc.getMap('reroutes')
    this.ygroups = this.ydoc.getMap('groups')

    // Initialize spatial index managers
    this.linkSegmentSpatialIndex = new SpatialIndexManager<string>() // Single index for all link geometry
    this.rerouteSpatialIndex = new SpatialIndexManager<ScopedLayoutKey>()

    // Deep observers so nested field writes (ynode.set('rect', ...)) fire
    // for both local operations and externally-applied updates.
    this.ynodes.observeDeep((events) => {
      if (
        events.some(
          (event) =>
            (event.target === this.ynodes && event.changes.keys.size > 0) ||
            event.changes.keys.has('rect')
        )
      ) {
        this._nodeGeometryVersion++
      }

      for (const key of collectEventKeys(events)) {
        const nodeKey = toScopedLayoutKey(key)
        const ynode = this.ynodes.get(nodeKey)
        const zIndex = ynode?.get('zIndex')
        if (typeof zIndex === 'number') {
          this.highestZIndex = Math.max(this.highestZIndex, zIndex)
        }
        if (ynode) this.triggerNodeLayout(nodeKey)
        else this.nodeRevisions.delete(nodeKey)
        this.pendingGeometryGraphIds.add(parseLayoutKey(key).graphId)
      }
    })

    this.ygroups.observeDeep((events) => {
      for (const key of collectEventKeys(events)) {
        this.pendingGeometryGraphIds.add(parseLayoutKey(key).graphId)
      }
    })

    this.yreroutes.observeDeep((events) => {
      for (const key of collectEventKeys(events)) {
        this.projectReroute(toScopedLayoutKey(key))
        this.pendingGeometryGraphIds.add(parseLayoutKey(key).graphId)
      }
    })

    this.ydoc.on('afterTransaction', () => {
      if (this.pendingGeometryGraphIds.size === 0) return
      this.version.value++
      const graphIds: ReadonlySet<UUID> = new Set(this.pendingGeometryGraphIds)
      this.pendingGeometryGraphIds.clear()
      this.queueGeometryChange(graphIds)
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

  getNodeLayout(rootGraphId: UUID, nodeId: NodeId): NodeLayout | null {
    const ynode = this.ynodes.get(makeScopedLayoutKey(rootGraphId, nodeId))
    return ynode ? yNodeToLayout(ynode) : null
  }

  private triggerNodeLayout(nodeKey: ScopedLayoutKey): void {
    this.nodeRevisions.set(nodeKey, (this.nodeRevisions.get(nodeKey) ?? 0) + 1)
  }

  getNodeLayoutRef(
    rootGraphId: UUID,
    nodeId: NodeId
  ): ComputedRef<NodeLayout | null> {
    const nodeKey = makeScopedLayoutKey(rootGraphId, nodeId)
    return computed(() => {
      void this.nodeRevisions.get(nodeKey)
      return this.getNodeLayout(rootGraphId, nodeId)
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
    const rect = this.ynodes
      .get(makeScopedLayoutKey(rootGraphId, nodeId))
      ?.get('rect')
    if (!isNodeRect(rect)) return false

    out[0] = rect[0]
    out[1] = rect[1]
    out[2] = rect[2]
    out[3] = rect[3]
    return true
  }

  contentSizeOf(rootGraphId: UUID, nodeId: NodeId): Size | undefined {
    return this.contentSizes.get(makeScopedLayoutKey(rootGraphId, nodeId))
  }

  reportContentSize(rootGraphId: UUID, nodeId: NodeId, size: Size): void {
    const key = makeScopedLayoutKey(rootGraphId, nodeId)
    const previous = this.contentSizes.get(key)
    if (previous?.width === size.width && previous.height === size.height)
      return
    this.contentSizes.set(key, size)
    this._contentSizeVersion++
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

  updateNodeSlotOffsets(
    graphId: UUID,
    nodeId: NodeId,
    offsets: readonly SlotOffset[],
    mode: SlotOffsetMode
  ): void {
    const key = makeScopedLayoutKey(graphId, nodeId)
    const byDirection: Record<SlotDirection, Map<SlotIndex, Point>> = {
      input: new Map(),
      output: new Map()
    }
    for (const offset of offsets) {
      byDirection[offset.type].set(offset.index, offset.position)
    }
    const next = { mode, byDirection }
    const current = this.slotOffsets.get(key)
    if (current && isSlotOffsetSnapshotEqual(current, next)) return

    this.slotOffsets.set(key, next)
    if (current?.mode === mode || offsets.length > 0) {
      this.queueGeometryChange(new Set([graphId]))
    }
  }

  getSlotOffset(
    graphId: UUID,
    nodeId: NodeId,
    index: SlotIndex,
    type: SlotDirection,
    mode: SlotOffsetMode
  ): Point | null {
    const offsets = this.slotOffsets.get(makeScopedLayoutKey(graphId, nodeId))
    return offsets?.mode === mode
      ? (offsets.byDirection[type].get(index) ?? null)
      : null
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
    const stamped = this.stampActor(operation)
    const change = createLayoutChange(stamped)
    let applied = false
    this.ydoc.transact(() => {
      applied = this.applyOperationInTransaction(stamped, change)
    }, this.currentActor)
    if (!applied) return

    this.finalizeOperation(change)
  }

  /** Applies several operations in one Yjs transaction. */
  applyOperations(operations: readonly LayoutOperation[]): void {
    if (operations.length === 0) return

    const appliedChanges: LayoutChange[] = []
    this.ydoc.transact(() => {
      for (const operation of operations) {
        const stamped = this.stampActor(operation)
        const change = createLayoutChange(stamped)
        if (this.applyOperationInTransaction(stamped, change)) {
          appliedChanges.push(change)
        }
      }
    }, this.currentActor)

    for (const change of appliedChanges) this.finalizeOperation(change)
  }

  /** Stamps this session's actor on operations that carry none. */
  private stampActor(operation: LayoutOperation): LayoutOperation {
    return operation.actor === undefined
      ? { ...operation, actor: this.currentActor }
      : operation
  }

  /**
   * Apply operation within a transaction.
   * @returns Whether the operation changed store state.
   */
  private applyOperationInTransaction(
    operation: LayoutOperation,
    change: LayoutChange
  ): boolean {
    switch (operation.type) {
      case 'moveNode':
        return this.handleMoveNode(operation, change)
      case 'resizeNode':
        return this.handleResizeNode(operation, change)
      case 'setNodeZIndex':
        return this.handleSetNodeZIndex(operation, change)
      case 'createNode':
        return this.handleCreateNode(operation, change)
      case 'deleteNode':
        return this.handleDeleteNode(operation, change)
      case 'batchUpdateBounds':
        return this.handleBatchUpdateBounds(operation, change)
      case 'createReroute':
        return this.handleCreateReroute(operation, change)
      case 'deleteReroute':
        return this.handleDeleteReroute(operation, change)
      case 'moveReroute':
        return this.handleMoveReroute(operation, change)
      case 'createGroup': {
        const groupKey = makeScopedLayoutKey(
          operation.graphId,
          operation.groupId
        )
        if (this.ygroups.has(groupKey)) return false
        this.ygroups.set(groupKey, layoutToYGroup(operation.layout))
        change.type = 'create'
        return true
      }
      case 'setGroupBounds':
        return this.handleSetGroupBounds(operation)
      case 'deleteGroup': {
        const groupKey = makeScopedLayoutKey(
          operation.graphId,
          operation.groupId
        )
        if (!this.ygroups.has(groupKey)) return false
        this.ygroups.delete(groupKey)
        change.type = 'delete'
        return true
      }
      case 'clearGraph':
        return this.handleClearGraph(operation.graphId, change)
    }
  }

  private handleClearGraph(graphId: UUID, change: LayoutChange): boolean {
    const prefix = graphId + ':'
    let deleted = false

    for (const key of [...this.ynodes.keys()]) {
      if (!key.startsWith(prefix)) continue
      this.ynodes.delete(key)
      change.nodeIds.push(toNodeId(parseLayoutKey(key).localId))
      deleted = true
    }
    for (const key of this.contentSizes.keys()) {
      if (!key.startsWith(prefix)) continue
      this.contentSizes.delete(key)
      this._contentSizeVersion++
    }
    for (const key of this.slotOffsets.keys()) {
      if (key.startsWith(prefix)) this.slotOffsets.delete(key)
    }
    for (const key of [...this.ygroups.keys()]) {
      if (!key.startsWith(prefix)) continue
      this.ygroups.delete(key)
      deleted = true
    }
    for (const key of [...this.yreroutes.keys()]) {
      if (!key.startsWith(prefix)) continue
      this.yreroutes.delete(key)
      deleted = true
    }

    change.type = 'delete'
    return deleted
  }

  /**
   * Finalize operation after transaction. Version bumps and node-ref
   * triggers happen in the Yjs observers, which fire for local and
   * external updates alike.
   */
  private finalizeOperation(change: LayoutChange): void {
    this.queueChange(change)
  }

  /**
   * Subscribe to layout changes
   */
  onChange(callback: (change: LayoutChange) => void): () => void {
    this.changeListeners.add(callback)
    return () => this.changeListeners.delete(callback)
  }

  /**
   * Subscribe to per-transaction geometry notifications. Fires once per Yjs
   * transaction with the set of graph ids whose node, group, or reroute
   * geometry changed — including changes that touch no node (group- or
   * reroute-only edits).
   */
  onGeometryChange(
    callback: (graphIds: ReadonlySet<UUID>) => void
  ): () => void {
    this.geometryListeners.add(callback)
    return () => this.geometryListeners.delete(callback)
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
   * Claims a stacking order above every node the store has seen. Stacking is
   * the store's own sequence, independent of a node's position in
   * {@link LGraph._nodes}.
   */
  allocateZIndex(): number {
    return ++this.highestZIndex
  }

  /** Drops entity layout owned by a root graph and its subgraph definitions. */
  clearGraph(rootGraphId: UUID): void {
    this.applyOperation({
      type: 'clearGraph',
      graphId: rootGraphId,
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })
  }

  /**
   * Test-only escape hatch: drops everything, including entity entries that
   * production drops through `detachGraphLayouts`. Calling it with a
   * graph attached desyncs the store from every entity in it.
   */
  resetForTests(): void {
    this.highestZIndex = 0
    this.ydoc.transact(() => {
      this.ynodes.clear()
      this.ygroups.clear()
      this.yreroutes.clear()
      this.rerouteLayouts.clear()
      this.rerouteSpatialIndex.clear()
      this.slotOffsets.clear()
    }, 'initialization')
    this.clearViewGeometry()
  }

  /**
   * Drops view-local link geometry and the listeners and queues bound to the
   * graph being left. Entity geometry leaves through `detachGraphLayouts`.
   */
  clearViewGeometry(): void {
    this.ydoc.transact(() => {
      this.nodeChangeListeners.clear()
      this.linkSegmentSpatialIndex.clear()
      this.linkLayouts.clear()
      this.linkSegmentLayouts.clear()
      if (this.contentSizes.size > 0) {
        this.contentSizes.clear()
        this._contentSizeVersion++
      }
      this.slotOffsets.clear()
      // Reroute layouts outlive active-graph switches.
      this.pendingGlobalChanges = []
      this.isGlobalDispatchQueued = false
      this.pendingGeometryChanges = []
      this.isGeometryDispatchQueued = false
    }, 'initialization')
  }

  // Operation handlers
  private handleMoveNode(
    operation: MoveNodeOperation,
    change: LayoutChange
  ): boolean {
    const { nodeId } = operation
    const ynode = this.ynodes.get(
      makeScopedLayoutKey(operation.graphId, nodeId)
    )
    if (!ynode) return false

    const size = yNodeToLayout(ynode).size

    ynode.set('rect', [
      operation.position.x,
      operation.position.y,
      size.width,
      size.height
    ])

    change.nodeIds.push(nodeId)
    return true
  }

  private handleResizeNode(
    operation: ResizeNodeOperation,
    change: LayoutChange
  ): boolean {
    const { nodeId } = operation
    const ynode = this.ynodes.get(
      makeScopedLayoutKey(operation.graphId, nodeId)
    )
    if (!ynode) return false

    const rect = ynode.get('rect')
    if (!isNodeRect(rect)) return false
    if (rect[2] !== operation.size.width || rect[3] !== operation.size.height) {
      change.sizeChangedNodeIds.push(nodeId)
    }

    ynode.set('rect', [
      rect[0],
      rect[1],
      operation.size.width,
      operation.size.height
    ])

    change.nodeIds.push(nodeId)
    return true
  }

  private handleSetGroupBounds(operation: SetGroupBoundsOperation): boolean {
    const ygroup = this.ygroups.get(
      makeScopedLayoutKey(operation.graphId, operation.groupId)
    )
    if (!ygroup) return false

    setYGroupRect(ygroup, operation.position, operation.size)
    return true
  }

  private handleSetNodeZIndex(
    operation: SetNodeZIndexOperation,
    change: LayoutChange
  ): boolean {
    const { nodeId } = operation
    const ynode = this.ynodes.get(
      makeScopedLayoutKey(operation.graphId, nodeId)
    )
    if (!ynode) return false

    ynode.set('zIndex', operation.zIndex)
    this.highestZIndex = Math.max(this.highestZIndex, operation.zIndex)
    change.nodeIds.push(nodeId)
    return true
  }

  private handleCreateNode(
    operation: CreateNodeOperation,
    change: LayoutChange
  ): boolean {
    const { nodeId } = operation
    const nodeKey = makeScopedLayoutKey(operation.graphId, nodeId)
    if (this.ynodes.has(nodeKey)) return false

    this.ynodes.set(nodeKey, layoutToYNode(operation.layout))
    this.highestZIndex = Math.max(this.highestZIndex, operation.layout.zIndex)

    change.type = 'create'
    change.nodeIds.push(nodeId)
    return true
  }

  private handleDeleteNode(
    operation: DeleteNodeOperation,
    change: LayoutChange
  ): boolean {
    const { nodeId } = operation
    const nodeKey = makeScopedLayoutKey(operation.graphId, nodeId)
    if (!this.ynodes.has(nodeKey)) return false

    this.ynodes.delete(nodeKey)
    if (this.contentSizes.delete(nodeKey)) this._contentSizeVersion++
    this.slotOffsets.delete(nodeKey)
    // Link geometry is cleaned up per-link by LLink.disconnect as the node's
    // connections are severed, so nothing to do here.

    change.type = 'delete'
    change.nodeIds.push(nodeId)
    return true
  }

  private handleBatchUpdateBounds(
    operation: BatchUpdateBoundsOperation,
    change: LayoutChange
  ): boolean {
    for (const nodeId of operation.nodeIds) {
      const bounds = operation.bounds[nodeId]
      const ynode = this.ynodes.get(
        makeScopedLayoutKey(operation.graphId, nodeId)
      )
      if (!ynode || !bounds) continue

      const rect = ynode.get('rect')
      if (
        isNodeRect(rect) &&
        (rect[2] !== bounds.width || rect[3] !== bounds.height)
      ) {
        change.sizeChangedNodeIds.push(nodeId)
      }
      ynode.set('rect', [bounds.x, bounds.y, bounds.width, bounds.height])

      change.nodeIds.push(nodeId)
    }

    if (change.nodeIds.length) {
      change.type = 'update'
    }
    return change.nodeIds.length > 0
  }

  private handleCreateReroute(
    operation: CreateRerouteOperation,
    change: LayoutChange
  ): boolean {
    const rerouteKey = makeScopedLayoutKey(
      operation.graphId,
      operation.rerouteId
    )
    if (this.yreroutes.has(rerouteKey)) return false

    const rerouteData = new Y.Map<unknown>()
    rerouteData.set('id', operation.rerouteId)
    rerouteData.set('position', operation.position)

    this.yreroutes.set(rerouteKey, rerouteData)
    change.type = 'create'
    return true
  }

  private handleDeleteReroute(
    operation: DeleteRerouteOperation,
    change: LayoutChange
  ): boolean {
    const rerouteKey = makeScopedLayoutKey(
      operation.graphId,
      operation.rerouteId
    )
    if (!this.yreroutes.has(rerouteKey)) return false

    this.yreroutes.delete(rerouteKey)
    this.rerouteLayouts.delete(rerouteKey)
    this.rerouteSpatialIndex.remove(rerouteKey)
    change.type = 'delete'
    return true
  }

  private handleMoveReroute(
    operation: MoveRerouteOperation,
    change: LayoutChange
  ): boolean {
    const rerouteKey = makeScopedLayoutKey(
      operation.graphId,
      operation.rerouteId
    )
    const yreroute = this.yreroutes.get(rerouteKey)
    if (!yreroute) return false

    yreroute.set('position', operation.position)
    change.type = 'update'
    return true
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
   * Projects a reroute's spatial-index entry from the current map state,
   * rather than trusting an event's action, so replayed or externally
   * applied updates converge to the same projection.
   */
  private projectReroute(key: ScopedLayoutKey): void {
    const rerouteData = this.yreroutes.get(key)
    if (!rerouteData) {
      this.rerouteLayouts.delete(key)
      this.rerouteSpatialIndex.remove(key)
      return
    }

    const parsed = parseLayoutKey(key)
    const rerouteId = toRerouteId(Number(parsed.localId))
    const position = this.getRerouteField(rerouteData, 'position')
    this.updateRerouteLayout(
      parsed.graphId,
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

  private queueChange(change: LayoutChange): void {
    const { graphId } = change.operation
    const hasNodeListener = change.nodeIds.some((nodeId) =>
      this.nodeChangeListeners.has(makeScopedLayoutKey(graphId, nodeId))
    )
    if (this.changeListeners.size === 0 && !hasNodeListener) return

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
      this.notifyNodeChange(queuedChange)
      this.notifyChange(queuedChange)
    })
  }

  private queueGeometryChange(graphIds: ReadonlySet<UUID>): void {
    if (this.geometryListeners.size === 0) return
    this.pendingGeometryChanges.push(graphIds)
    if (this.isGeometryDispatchQueued) return

    this.isGeometryDispatchQueued = true
    queueMicrotask(() => {
      this.isGeometryDispatchQueued = false
      const changes = this.pendingGeometryChanges
      this.pendingGeometryChanges = []
      for (const change of changes) {
        for (const listener of this.geometryListeners) {
          try {
            listener(change)
          } catch (error) {
            console.error('Error in layout geometry listener:', error)
          }
        }
      }
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

  /**
   * Batch update node bounds using Yjs transaction for atomicity.
   */
  batchUpdateNodeBounds(
    rootGraphId: UUID,
    updates: NodeBoundsUpdate[],
    options: BatchUpdateBoundsOptions
  ): void {
    if (updates.length === 0) return

    const { source, boundsIncludeTitleHeight = false } = options
    const nodeIds: NodeId[] = []
    const boundsRecord: BatchUpdateBoundsOperation['bounds'] = {}

    for (const { nodeId, bounds } of updates) {
      if (!this.ynodes.has(makeScopedLayoutKey(rootGraphId, nodeId))) continue

      boundsRecord[nodeId] = boundsIncludeTitleHeight
        ? { ...bounds, height: removeNodeTitleHeight(bounds.height) }
        : bounds
      nodeIds.push(nodeId)
    }

    if (!nodeIds.length) return

    this.applyOperation({
      type: 'batchUpdateBounds',
      graphId: rootGraphId,
      nodeIds,
      bounds: boundsRecord,
      timestamp: Date.now(),
      source,
      actor: this.currentActor
    })
  }
}

// Create singleton instance
export const layoutStore = new LayoutStoreImpl()
