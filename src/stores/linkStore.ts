import { defineStore } from 'pinia'
import { reactive, toRaw } from 'vue'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'
import type { LinkTopology, UnownedLinkTopology } from '@/types/linkTopology'
import { isFloatingTopology } from '@/types/linkTopology'
import type { NodeId } from '@/types/nodeId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'

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

function targetKey(
  graphId: OwningGraphId,
  nodeId: NodeId,
  slot: number
): TargetSlotKey {
  return `${graphId}:${nodeId}:${slot}` as TargetSlotKey
}

function originKey(
  graphId: OwningGraphId,
  nodeId: NodeId,
  slot: number
): OriginSlotKey {
  return `${graphId}:${nodeId}:${slot}` as OriginSlotKey
}

type OriginIndex = Map<OriginSlotKey, Set<LinkTopology>>

interface RootTopologyBucket {
  byId: Map<LinkId, LinkTopology>
  idsByOwner: Map<OwningGraphId, Set<LinkId>>
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
 * lookup. The topology set tracks registration ownership; slot maps are
 * derived query indexes. The root bucket is the sole link-id authority.
 */
export const useLinkStore = defineStore('link', () => {
  const roots = reactive(new Map<RootGraphId, RootTopologyBucket>())

  function rootBucket(rootGraphId: RootGraphId): RootTopologyBucket {
    const existing = roots.get(rootGraphId)
    if (existing) return existing
    const created = reactive<RootTopologyBucket>({
      byId: new Map(),
      idsByOwner: new Map(),
      targetIndex: new Map(),
      originIndex: new Map()
    })
    roots.set(rootGraphId, created)
    return created
  }

  function indexOrigin(
    bucket: RootTopologyBucket,
    topology: LinkTopology
  ): void {
    if (isFloatingTopology(topology)) return
    const key = originKey(
      topology.graphId,
      topology.originNodeId,
      topology.originSlot
    )
    const existing = bucket.originIndex.get(key)
    if (existing) {
      existing.add(toRaw(topology))
      return
    }
    bucket.originIndex.set(key, reactive(new Set([toRaw(topology)])))
  }

  function unindexOrigin(
    bucket: RootTopologyBucket,
    topology: LinkTopology
  ): void {
    const key = originKey(
      topology.graphId,
      topology.originNodeId,
      topology.originSlot
    )
    const links = bucket.originIndex.get(key)
    if (!links?.delete(toRaw(topology))) return
    if (!links.size) bucket.originIndex.delete(key)
  }

  /** Places a link whose target availability has already been validated. */
  function placeValidated(
    bucket: RootTopologyBucket,
    topology: LinkTopology
  ): LinkTopology {
    const placed = reactive(topology)
    bucket.byId.set(placed.id, placed)
    const ownerIds = bucket.idsByOwner.get(placed.graphId)
    if (ownerIds) ownerIds.add(placed.id)
    else bucket.idsByOwner.set(placed.graphId, reactive(new Set([placed.id])))
    if (hasUniqueTarget(topology)) {
      const key = targetKey(
        topology.graphId,
        topology.targetNodeId,
        topology.targetSlot
      )
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
    topology: LinkTopology | UnownedLinkTopology
  ): LinkTopology | undefined {
    const bucket = rootBucket(scope.rootGraphId)
    const incumbent = bucket.byId.get(topology.id)
    if (toRaw(incumbent) === toRaw(topology)) return incumbent
    if (incumbent) return undefined
    const owned = Object.assign(topology, { graphId: scope.owningGraphId })
    if (hasUniqueTarget(owned)) {
      const key = targetKey(owned.graphId, owned.targetNodeId, owned.targetSlot)
      const existing = bucket.targetIndex.get(key)
      if (existing && toRaw(existing) !== toRaw(owned)) {
        console.error(`Link target slot ${key} is already occupied`)
        return undefined
      }
    }
    return placeValidated(bucket, owned)
  }

  /** Removes a link's placement; only the registered topology may vacate it. */
  function displace(bucket: RootTopologyBucket, topology: LinkTopology) {
    if (toRaw(bucket.byId.get(topology.id)) !== toRaw(topology)) return false
    if (hasUniqueTarget(topology)) {
      const key = targetKey(
        topology.graphId,
        topology.targetNodeId,
        topology.targetSlot
      )
      if (toRaw(bucket.targetIndex.get(key)) === toRaw(topology)) {
        bucket.targetIndex.delete(key)
      }
    }
    bucket.byId.delete(topology.id)
    const ownerIds = bucket.idsByOwner.get(topology.graphId)
    ownerIds?.delete(topology.id)
    if (ownerIds?.size === 0) bucket.idsByOwner.delete(topology.graphId)
    unindexOrigin(bucket, topology)
    return true
  }

  function deleteLink(scope: GraphScope, topology: LinkTopology): boolean {
    const bucket = roots.get(scope.rootGraphId)
    if (!bucket || !displace(bucket, topology)) return false
    if (bucket.byId.size === 0) roots.delete(scope.rootGraphId)
    return true
  }

  function ownsPlacement(
    bucket: RootTopologyBucket,
    topology: LinkTopology
  ): boolean {
    return toRaw(bucket.byId.get(topology.id)) === toRaw(topology)
  }

  function validateEndpointUpdates(
    scope: GraphScope,
    updates: readonly EndpointUpdate[],
    vacating: readonly LinkTopology[] = []
  ): EndpointUpdateError | undefined {
    const bucket = roots.get(scope.rootGraphId)
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

      const key = targetKey(
        topology.graphId,
        final.targetNodeId,
        final.targetSlot
      )
      if (finalOwners.has(key)) {
        return {
          code: 'duplicate-target',
          message: `Multiple links target input slot ${final.targetNodeId}:${final.targetSlot}`
        }
      }
      finalOwners.add(key)

      const incumbent = bucket?.targetIndex.get(key)
      if (incumbent && !participants.includes(toRaw(incumbent))) {
        return {
          code: 'occupied-target',
          message: `Link target slot ${final.targetNodeId}:${final.targetSlot} is already occupied`
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

    const bucket = rootBucket(scope.rootGraphId)
    for (const { topology } of updates) displace(bucket, topology)
    for (const topology of removals) displace(bucket, topology)

    const value = updates.map(({ topology, patch }) => {
      Object.assign(reactive(topology), patchedEndpoints(topology, patch))
      return placeValidated(bucket, topology)
    })
    if (bucket.byId.size === 0) roots.delete(scope.rootGraphId)
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
    return (
      roots
        .get(scope.rootGraphId)
        ?.targetIndex.has(targetKey(scope.owningGraphId, nodeId, slot)) ?? false
    )
  }

  function getInputSlotLink(
    scope: GraphScope,
    nodeId: NodeId,
    slot: number
  ): LinkTopology | undefined {
    return roots
      .get(scope.rootGraphId)
      ?.targetIndex.get(targetKey(scope.owningGraphId, nodeId, slot))
  }

  function isOutputSlotConnected(
    scope: GraphScope,
    nodeId: NodeId,
    slot: number
  ): boolean {
    return (
      roots
        .get(scope.rootGraphId)
        ?.originIndex.has(originKey(scope.owningGraphId, nodeId, slot)) ?? false
    )
  }

  function getOutputSlotLinks(
    scope: GraphScope,
    nodeId: NodeId,
    slot: number
  ): ReadonlySet<LinkTopology> {
    return (
      roots
        .get(scope.rootGraphId)
        ?.originIndex.get(originKey(scope.owningGraphId, nodeId, slot)) ??
      EMPTY_LINKS
    )
  }

  /** Iterates every registered topology owned by a graph. */
  function* graphTopologies(scope: GraphScope): Generator<LinkTopology> {
    const bucket = roots.get(scope.rootGraphId)
    const ids = bucket?.idsByOwner.get(scope.owningGraphId)
    if (!bucket || !ids) return
    for (const id of ids) {
      const topology = bucket.byId.get(id)
      if (topology) yield topology
    }
  }

  function getTopology(
    rootGraphId: RootGraphId,
    id: LinkId
  ): LinkTopology | undefined {
    return roots.get(rootGraphId)?.byId.get(id)
  }

  function clearGraph(graphId: RootGraphId): void {
    roots.delete(graphId)
  }

  function clearOwner(scope: GraphScope): void {
    const bucket = roots.get(scope.rootGraphId)
    const ids = bucket?.idsByOwner.get(scope.owningGraphId)
    if (!bucket || !ids) return
    for (const id of [...ids]) {
      const topology = bucket.byId.get(id)
      if (topology) displace(bucket, topology)
    }
    if (bucket.byId.size === 0) roots.delete(scope.rootGraphId)
  }

  return {
    registerLink,
    updateEndpoint,
    updateEndpoints,
    deleteLink,
    isInputSlotConnected,
    getInputSlotLink,
    isOutputSlotConnected,
    getOutputSlotLinks,
    getTopology,
    graphTopologies,
    clearOwner,
    clearGraph
  }
})
