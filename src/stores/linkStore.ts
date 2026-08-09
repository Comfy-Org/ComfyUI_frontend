import { defineStore } from 'pinia'
import { reactive, ref, toRaw } from 'vue'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { isFloatingTopology } from '@/types/linkTopology'
import type { NodeId } from '@/types/nodeId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'

/**
 * Endpoint slot keys are `${nodeId}:${slot}`; slot is numeric so the
 * separator is unambiguous for any node id. Target (input side) and origin
 * (output side) keys are branded separately so a key built for one index
 * cannot be looked up in the other.
 */
type TargetSlotKey = string & { readonly __brand: 'TargetSlotKey' }
type OriginSlotKey = string & { readonly __brand: 'OriginSlotKey' }

function targetKey(nodeId: NodeId, slot: number): TargetSlotKey {
  return `${nodeId}:${slot}` as TargetSlotKey
}

function originKey(nodeId: NodeId, slot: number): OriginSlotKey {
  return `${nodeId}:${slot}` as OriginSlotKey
}

type OriginIndex = Map<OriginSlotKey, Set<LinkTopology>>

interface GraphTopologyBucket {
  byId: Map<LinkId, LinkTopology>
  targetIndex: Map<TargetSlotKey, LinkTopology>
  originIndex: OriginIndex
  unkeyedLinks: Set<LinkTopology>
}

type TopologyBuckets = Map<RootGraphId, Map<OwningGraphId, GraphTopologyBucket>>

const EMPTY_LINKS: ReadonlySet<LinkTopology> = new Set()

/**
 * A link is keyed by its target input slot only when that slot uniquely
 * identifies it: floating links (either endpoint unassigned) can share an
 * input slot with a real link, and SUBGRAPH_OUTPUT_ID is a constant shared by
 * every subgraph definition. Neither is queried by target.
 */
function hasUniqueTarget(topology: LinkTopology): boolean {
  return (
    topology.originNodeId !== UNASSIGNED_NODE_ID &&
    topology.targetNodeId !== UNASSIGNED_NODE_ID &&
    topology.targetNodeId !== SUBGRAPH_OUTPUT_ID
  )
}

/**
 * Link topology store, partitioned by root and owning graph. At most one live link can target
 * a given input slot — litegraph disconnects the previous link before
 * connecting a new one — so the target is the natural primary key and the
 * dominant query ("is this input connected, and by what?") is one lookup.
 * Links without a unique target live in a per-graph side collection.
 */
export const useLinkStore = defineStore('link', () => {
  const buckets = ref<TopologyBuckets>(new Map())

  function getBucket(scope: GraphScope): GraphTopologyBucket | undefined {
    return buckets.value.get(scope.rootGraphId)?.get(scope.owningGraphId)
  }

  function graphBucket(scope: GraphScope): GraphTopologyBucket {
    let owners = buckets.value.get(scope.rootGraphId)
    if (!owners) {
      owners = reactive(new Map<OwningGraphId, GraphTopologyBucket>())
      buckets.value.set(scope.rootGraphId, owners)
    }
    const existing = owners.get(scope.owningGraphId)
    if (existing) return existing
    const next = reactive<GraphTopologyBucket>({
      byId: new Map(),
      targetIndex: new Map(),
      originIndex: new Map(),
      unkeyedLinks: new Set()
    })
    owners.set(scope.owningGraphId, next)
    return next
  }

  function pruneBucket(scope: GraphScope, bucket: GraphTopologyBucket): void {
    if (bucket.byId.size) return
    const owners = buckets.value.get(scope.rootGraphId)
    if (owners?.get(scope.owningGraphId) !== bucket) return
    owners.delete(scope.owningGraphId)
    if (!owners.size && buckets.value.get(scope.rootGraphId) === owners) {
      buckets.value.delete(scope.rootGraphId)
    }
  }

  function indexOrigin(
    bucket: GraphTopologyBucket,
    topology: LinkTopology
  ): void {
    if (isFloatingTopology(topology)) return
    const key = originKey(topology.originNodeId, topology.originSlot)
    const existing = bucket.originIndex.get(key)
    if (existing) {
      existing.add(toRaw(topology))
      return
    }
    bucket.originIndex.set(key, reactive(new Set([toRaw(topology)])))
  }

  function unindexOrigin(
    bucket: GraphTopologyBucket,
    topology: LinkTopology
  ): void {
    const key = originKey(topology.originNodeId, topology.originSlot)
    const links = bucket.originIndex.get(key)
    if (!links?.delete(toRaw(topology))) return
    if (!links.size) bucket.originIndex.delete(key)
  }

  /** Places a link whose target availability has already been validated. */
  function placeValidated(
    bucket: GraphTopologyBucket,
    topology: LinkTopology
  ): LinkTopology {
    const placed = reactive(topology)
    bucket.byId.set(topology.id, placed)
    if (hasUniqueTarget(topology)) {
      const key = targetKey(topology.targetNodeId, topology.targetSlot)
      bucket.targetIndex.set(key, placed)
    } else {
      bucket.unkeyedLinks.add(placed)
    }
    indexOrigin(bucket, placed)
    return placed
  }

  /**
   * Registers a link under its current endpoints. The first registration for
   * a target slot wins — a duplicate stays detached instead of clobbering the
   * incumbent — and re-registering the already-registered topology is a no-op.
   * @returns The store-held reactive state when `topology` holds the
   * registration afterwards, otherwise `undefined`.
   */
  function registerLink(
    scope: GraphScope,
    topology: LinkTopology
  ): LinkTopology | undefined {
    const bucket = graphBucket(scope)
    const existingId = bucket.byId.get(topology.id)
    if (existingId && toRaw(existingId) !== toRaw(topology)) return undefined
    if (hasUniqueTarget(topology)) {
      const key = targetKey(topology.targetNodeId, topology.targetSlot)
      const existing = bucket.targetIndex.get(key)
      if (existing && toRaw(existing) !== toRaw(topology)) return undefined
    }
    return placeValidated(bucket, topology)
  }

  /** Removes a link's placement; only the registered topology may vacate it. */
  function displace(scope: GraphScope, topology: LinkTopology): boolean {
    const bucket = getBucket(scope)
    if (!bucket || toRaw(bucket.byId.get(topology.id)) !== toRaw(topology)) {
      return false
    }
    if (bucket.unkeyedLinks.delete(topology)) {
      bucket.byId.delete(topology.id)
      unindexOrigin(bucket, topology)
      return true
    }
    const key = targetKey(topology.targetNodeId, topology.targetSlot)
    if (toRaw(bucket.targetIndex.get(key)) !== toRaw(topology)) return false
    if (!bucket.targetIndex.delete(key)) return false
    bucket.byId.delete(topology.id)
    unindexOrigin(bucket, topology)
    return true
  }

  function deleteLink(scope: GraphScope, topology: LinkTopology): boolean {
    const bucket = getBucket(scope)
    if (!bucket || !displace(scope, topology)) return false
    pruneBucket(scope, bucket)
    return true
  }

  function isInputSlotConnected(
    scope: GraphScope,
    nodeId: NodeId,
    slot: number
  ): boolean {
    return getBucket(scope)?.targetIndex.has(targetKey(nodeId, slot)) ?? false
  }

  function getInputSlotLink(
    scope: GraphScope,
    nodeId: NodeId,
    slot: number
  ): LinkTopology | undefined {
    return getBucket(scope)?.targetIndex.get(targetKey(nodeId, slot))
  }

  function isOutputSlotConnected(
    scope: GraphScope,
    nodeId: NodeId,
    slot: number
  ): boolean {
    return getBucket(scope)?.originIndex.has(originKey(nodeId, slot)) ?? false
  }

  function getOutputSlotLinks(
    scope: GraphScope,
    nodeId: NodeId,
    slot: number
  ): ReadonlySet<LinkTopology> {
    return (
      getBucket(scope)?.originIndex.get(originKey(nodeId, slot)) ?? EMPTY_LINKS
    )
  }

  /** Iterates every registered topology owned by a graph. */
  function* graphTopologies(scope: GraphScope): Generator<LinkTopology> {
    const byId = getBucket(scope)?.byId
    if (byId) yield* byId.values()
  }

  function getLink(scope: GraphScope, linkId: LinkTopology['id']) {
    return getBucket(scope)?.byId.get(linkId)
  }

  function clearGraph(graphId: RootGraphId): void {
    buckets.value.delete(graphId)
  }

  function clearOwner(scope: GraphScope): void {
    const owners = buckets.value.get(scope.rootGraphId)
    if (!owners) return
    owners.delete(scope.owningGraphId)
    if (!owners.size) buckets.value.delete(scope.rootGraphId)
  }

  return {
    registerLink,
    deleteLink,
    isInputSlotConnected,
    getInputSlotLink,
    isOutputSlotConnected,
    getOutputSlotLinks,
    graphTopologies,
    getLink,
    clearOwner,
    clearGraph
  }
})
