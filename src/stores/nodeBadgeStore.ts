import { defineStore } from 'pinia'
import { reactive, ref, toRaw } from 'vue'

import { BADGE_KIND_ORDER } from '@/types/badgeData'
import type { BadgeData, BadgeKind } from '@/types/badgeData'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

const EMPTY_BADGES: readonly BadgeData[] = []

function kindRank(kind: BadgeKind): number {
  return BADGE_KIND_ORDER.indexOf(kind)
}

/**
 * Node badge store, holding each node's badge rows in root-graph-scoped
 * buckets keyed by `NodeId`. Rows are plain {@link BadgeData}; reads are
 * ordered by kind (core, credits, extension), not insertion. The badge
 * system rewrites its kinds wholesale; extension rows are appended and
 * removed individually. See docs/architecture/node-badge-store.md.
 */
export const useNodeBadgeStore = defineStore('nodeBadge', () => {
  const buckets = ref(new Map<UUID, Map<NodeId, BadgeData[]>>())

  function graphBucket(graphId: UUID): Map<NodeId, BadgeData[]> {
    const existing = buckets.value.get(graphId)
    if (existing) return existing
    const next = reactive(new Map<NodeId, BadgeData[]>())
    buckets.value.set(graphId, next)
    return next
  }

  /**
   * A registered node's rows; `undefined` for unregistered nodes so row
   * writes cannot re-create a bucket key `unregisterNode` just deleted.
   */
  function registeredRows(
    graphId: UUID,
    nodeId: NodeId
  ): BadgeData[] | undefined {
    return buckets.value.get(graphId)?.get(nodeId)
  }

  /**
   * Appends a badge row to a registered node; refused otherwise.
   * @returns The store-held reactive row — callers keep it as their live
   * state object so later field writes are tracked and identity-checked
   * deletes match — or `undefined` when the node is not registered.
   */
  function registerBadge(
    graphId: UUID,
    nodeId: NodeId,
    badge: BadgeData
  ): BadgeData | undefined {
    const rows = registeredRows(graphId, nodeId)
    if (!rows) return undefined
    rows.push(badge)
    return rows.at(-1)!
  }

  /** Removes a badge row; only the registered row may vacate it. */
  function deleteBadge(
    graphId: UUID,
    nodeId: NodeId,
    badge: BadgeData
  ): boolean {
    const rows = buckets.value.get(graphId)?.get(nodeId)
    if (!rows) return false
    const index = rows.findIndex((row) => toRaw(row) === toRaw(badge))
    if (index === -1) return false
    rows.splice(index, 1)
    return true
  }

  /**
   * Replaces every row of one kind; the system's recompute write path.
   * Refused for unregistered nodes.
   */
  function setBadgesOfKind(
    graphId: UUID,
    nodeId: NodeId,
    kind: BadgeKind,
    badges: BadgeData[]
  ): void {
    const rows = registeredRows(graphId, nodeId)
    if (!rows) return
    const kept = rows.filter((row) => row.kind !== kind)
    rows.splice(0, rows.length, ...kept, ...badges)
  }

  /** A node's rows in kind display order (core, credits, extension). */
  function getBadges(graphId: UUID, nodeId: NodeId): readonly BadgeData[] {
    const rows = buckets.value.get(graphId)?.get(nodeId)
    if (!rows) return EMPTY_BADGES
    return [...rows].sort((a, b) => kindRank(a.kind) - kindRank(b.kind))
  }

  /** Registers a node; a registered node's rows are system-maintained. */
  function registerNode(graphId: UUID, nodeId: NodeId): void {
    const bucket = graphBucket(graphId)
    if (!bucket.has(nodeId)) bucket.set(nodeId, reactive([]))
  }

  function unregisterNode(graphId: UUID, nodeId: NodeId): void {
    buckets.value.get(graphId)?.delete(nodeId)
  }

  /** The registered nodes of a graph bucket; reads are tracked. */
  function registeredNodeIds(graphId: UUID): NodeId[] {
    return [...(buckets.value.get(graphId)?.keys() ?? [])]
  }

  function clearGraph(graphId: UUID): void {
    buckets.value.delete(graphId)
  }

  return {
    registerBadge,
    deleteBadge,
    setBadgesOfKind,
    getBadges,
    registerNode,
    unregisterNode,
    registeredNodeIds,
    clearGraph
  }
})
