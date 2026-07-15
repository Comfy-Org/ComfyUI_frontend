import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { BadgeData } from '@/types/badgeData'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

const EMPTY_BADGES: readonly BadgeData[] = []

/**
 * Node badge store, holding each node's system-computed badge rows in
 * root-graph-scoped buckets keyed by `NodeId`. The badge system replaces
 * a node's rows wholesale, so the array a read returns is stable until
 * the next write. Extension badges live on `node.badges`, not here.
 */
export const useNodeBadgeStore = defineStore('nodeBadge', () => {
  const buckets = ref(new Map<UUID, Map<NodeId, readonly BadgeData[]>>())

  function graphBucket(graphId: UUID): Map<NodeId, readonly BadgeData[]> {
    const existing = buckets.value.get(graphId)
    if (existing) return existing
    const next = reactive(new Map<NodeId, readonly BadgeData[]>())
    buckets.value.set(graphId, next)
    return next
  }

  /**
   * Replaces a registered node's rows wholesale; refused for unregistered
   * nodes so a late effect flush cannot re-create a bucket key
   * `unregisterNode` just deleted.
   */
  function setBadges(
    graphId: UUID,
    nodeId: NodeId,
    rows: readonly BadgeData[]
  ): void {
    const bucket = buckets.value.get(graphId)
    if (!bucket?.has(nodeId)) return
    bucket.set(nodeId, rows)
  }

  /** A node's rows; the returned array is stable until the next write. */
  function getBadges(graphId: UUID, nodeId: NodeId): readonly BadgeData[] {
    return buckets.value.get(graphId)?.get(nodeId) ?? EMPTY_BADGES
  }

  /** Registers a node; a registered node's rows are system-maintained. */
  function registerNode(graphId: UUID, nodeId: NodeId): void {
    const bucket = graphBucket(graphId)
    if (!bucket.has(nodeId)) bucket.set(nodeId, EMPTY_BADGES)
  }

  function unregisterNode(graphId: UUID, nodeId: NodeId): void {
    const bucket = buckets.value.get(graphId)
    if (!bucket) return
    bucket.delete(nodeId)
    if (bucket.size === 0) buckets.value.delete(graphId)
  }

  /** The registered nodes of a graph bucket; reads are tracked. */
  function registeredNodeIds(graphId: UUID): NodeId[] {
    // Track bucket membership so a miss wakes when a workflow load
    // creates the bucket under a graph id no reader has observed yet.
    void buckets.value.size
    return [...(buckets.value.get(graphId)?.keys() ?? [])]
  }

  function clearGraph(graphId: UUID): void {
    for (const nodeId of registeredNodeIds(graphId)) {
      unregisterNode(graphId, nodeId)
    }
  }

  return {
    setBadges,
    getBadges,
    registerNode,
    unregisterNode,
    registeredNodeIds,
    clearGraph
  }
})
