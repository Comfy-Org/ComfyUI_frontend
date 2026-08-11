import { defineStore } from 'pinia'
import { reactive, toRaw } from 'vue'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import type { GraphScope, RootGraphId } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { isFloatingTopology } from '@/types/linkTopology'
import type { NodeId } from '@/types/nodeId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'

import { createGraphScopedBuckets } from './graphScopedBuckets'

export type EndpointPatch = Partial<
  Pick<
    LinkTopology,
    'originNodeId' | 'originSlot' | 'targetNodeId' | 'targetSlot'
  >
>

export interface EndpointUpdate {
  topology: LinkTopology
  patch: EndpointPatch
}
interface EndpointUpdateError {
  code:
    | 'duplicate-topology'
    | 'unowned-topology'
    | 'duplicate-target'
    | 'occupied-target'
  message: string
}

type EndpointUpdateResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: EndpointUpdateError }

function patchedEndpoints(
  topology: LinkTopology,
  patch: EndpointPatch
): EndpointPatch {
  return {
    originNodeId: patch.originNodeId ?? topology.originNodeId,
    originSlot: patch.originSlot ?? topology.originSlot,
    targetNodeId: patch.targetNodeId ?? topology.targetNodeId,
    targetSlot: patch.targetSlot ?? topology.targetSlot
  }
}
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
}

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
 * Link topology store, partitioned by root and owning graph. At most one live
 * link can target a given input slot — litegraph disconnects the previous
 * link before connecting a new one — so the target is the natural primary key
 * and the dominant query ("is this input connected, and by what?") is one
 * lookup. The id index is the sole ownership authority; slot indexes are
 * derived query indexes.
 */
export const useLinkStore = defineStore('link', () => {
  const buckets = createGraphScopedBuckets<GraphTopologyBucket>({
    createBucket: () =>
      reactive<GraphTopologyBucket>({
        byId: new Map(),
        targetIndex: new Map(),
        originIndex: new Map()
      }),
    isEmpty: ({ byId }) => byId.size === 0
  })

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
    }
    indexOrigin(bucket, placed)
    return placed
  }

  /**
   * Registers a link under its current endpoints. The first registration for
   * a link id or target slot wins — a duplicate stays detached instead of
   * clobbering the incumbent — and re-registering the already-registered
   * topology is a no-op.
   * @returns The store-held reactive state when `topology` holds the
   * registration afterwards, otherwise `undefined`.
   */
  function registerLink(
    scope: GraphScope,
    topology: LinkTopology
  ): LinkTopology | undefined {
    const bucket = buckets.getOrCreate(scope)
    const existingId = bucket.byId.get(topology.id)
    if (existingId && toRaw(existingId) !== toRaw(topology)) {
      console.error(`Link id ${topology.id} is already registered`)
      return undefined
    }
    if (hasUniqueTarget(topology)) {
      const key = targetKey(topology.targetNodeId, topology.targetSlot)
      const existing = bucket.targetIndex.get(key)
      if (existing && toRaw(existing) !== toRaw(topology)) {
        console.error(`Link target slot ${key} is already occupied`)
        return undefined
      }
    }
    return placeValidated(bucket, topology)
  }

  /** Removes a link's placement; only the registered topology may vacate it. */
  function displace(bucket: GraphTopologyBucket, topology: LinkTopology) {
    if (toRaw(bucket.byId.get(topology.id)) !== toRaw(topology)) return false
    if (hasUniqueTarget(topology)) {
      const key = targetKey(topology.targetNodeId, topology.targetSlot)
      if (toRaw(bucket.targetIndex.get(key)) === toRaw(topology)) {
        bucket.targetIndex.delete(key)
      }
    }
    bucket.byId.delete(topology.id)
    unindexOrigin(bucket, topology)
    return true
  }

  function deleteLink(scope: GraphScope, topology: LinkTopology): boolean {
    const bucket = buckets.get(scope)
    if (!bucket || !displace(bucket, topology)) return false
    buckets.prune(scope, bucket)
    return true
  }

  function ownsPlacement(
    bucket: GraphTopologyBucket,
    topology: LinkTopology
  ): boolean {
    return toRaw(bucket.byId.get(topology.id)) === toRaw(topology)
  }

  function validateEndpointUpdates(
    scope: GraphScope,
    updates: readonly EndpointUpdate[],
    vacating: readonly LinkTopology[] = []
  ): EndpointUpdateError | undefined {
    const bucket = buckets.get(scope)
    const participants = [
      ...updates.map(({ topology }) => toRaw(topology)),
      ...vacating.map((topology) => toRaw(topology))
    ]
    if (new Set(participants).size !== participants.length) {
      return {
        code: 'duplicate-topology',
        message: 'A link topology may only appear once in an endpoint batch'
      }
    }

    for (const topology of participants) {
      if (!bucket || !ownsPlacement(bucket, topology)) {
        return {
          code: 'unowned-topology',
          message: `Link ${topology.id} does not own its current placement`
        }
      }
    }

    const finalOwners = new Set<TargetSlotKey>()
    for (const { topology, patch } of updates) {
      const final = { ...toRaw(topology), ...patchedEndpoints(topology, patch) }
      if (!hasUniqueTarget(final)) continue

      const key = targetKey(final.targetNodeId, final.targetSlot)
      if (finalOwners.has(key)) {
        return {
          code: 'duplicate-target',
          message: `Multiple links target input slot ${key}`
        }
      }
      finalOwners.add(key)

      const incumbent = bucket?.targetIndex.get(key)
      if (incumbent && !participants.includes(toRaw(incumbent))) {
        return {
          code: 'occupied-target',
          message: `Link target slot ${key} is already occupied`
        }
      }
    }
  }

  /** Atomically validates and applies endpoint updates and removals. */
  function updateEndpoints(
    scope: GraphScope,
    updates: readonly EndpointUpdate[],
    removals: readonly LinkTopology[] = []
  ): EndpointUpdateResult<LinkTopology[]> {
    const error = validateEndpointUpdates(scope, updates, removals)
    if (error) return { ok: false, error }

    const bucket = buckets.getOrCreate(scope)
    for (const { topology } of updates) displace(bucket, topology)
    for (const topology of removals) displace(bucket, topology)

    const value = updates.map(({ topology, patch }) => {
      Object.assign(reactive(topology), patchedEndpoints(topology, patch))
      return placeValidated(bucket, topology)
    })
    buckets.prune(scope, bucket)
    return { ok: true, value }
  }

  /** Applies one endpoint patch atomically. */
  function updateEndpoint(
    scope: GraphScope,
    topology: LinkTopology,
    patch: EndpointPatch
  ): EndpointUpdateResult<LinkTopology> {
    const result = updateEndpoints(scope, [{ topology, patch }])
    return result.ok ? { ok: true, value: result.value[0] } : result
  }

  function isInputSlotConnected(
    scope: GraphScope,
    nodeId: NodeId,
    slot: number
  ): boolean {
    return buckets.get(scope)?.targetIndex.has(targetKey(nodeId, slot)) ?? false
  }

  function getInputSlotLink(
    scope: GraphScope,
    nodeId: NodeId,
    slot: number
  ): LinkTopology | undefined {
    return buckets.get(scope)?.targetIndex.get(targetKey(nodeId, slot))
  }

  function isOutputSlotConnected(
    scope: GraphScope,
    nodeId: NodeId,
    slot: number
  ): boolean {
    return buckets.get(scope)?.originIndex.has(originKey(nodeId, slot)) ?? false
  }

  function getOutputSlotLinks(
    scope: GraphScope,
    nodeId: NodeId,
    slot: number
  ): ReadonlySet<LinkTopology> {
    return (
      buckets.get(scope)?.originIndex.get(originKey(nodeId, slot)) ??
      EMPTY_LINKS
    )
  }

  /** Iterates every registered topology owned by a graph. */
  function* graphTopologies(scope: GraphScope): Generator<LinkTopology> {
    const byId = buckets.get(scope)?.byId
    if (byId) yield* byId.values()
  }

  function getLink(scope: GraphScope, linkId: LinkTopology['id']) {
    return buckets.get(scope)?.byId.get(linkId)
  }

  function clearGraph(graphId: RootGraphId): void {
    buckets.clearRoot(graphId)
  }

  function clearOwner(scope: GraphScope): void {
    buckets.clearOwner(scope)
  }

  return {
    registerLink,
    updateEndpoint,
    updateEndpoints,
    validateEndpointUpdates,
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
