import type { LinkTuple } from '@comfyorg/comfy-multi-player'
import { defineStore } from 'pinia'
import {
  getCurrentScope,
  onScopeDispose,
  reactive,
  shallowRef,
  toRaw
} from 'vue'
import type { Doc as YDoc } from 'yjs'

import {
  definitionOwnerMaps,
  ownerLinksMap,
  semanticDocs
} from '@/stores/semanticDoc'
import type { LocalUpdateOrigin } from '@/stores/semanticDoc'
import { toOwningGraphId } from '@/types/graphScopeId'
import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'
import { parseLinkId } from '@/types/linkId'
import type { LinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { isFloatingTopology } from '@/types/linkTopology'
import type { NodeId } from '@/types/nodeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'

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
export interface EndpointUpdateError {
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
 * Endpoint slot keys are `${owningGraphId}:${nodeId}:${slot}`; slot is numeric
 * so the separator is unambiguous for any node id. Target (input side) and
 * origin (output side) keys are branded separately so a key built for one
 * index cannot be looked up in the other.
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
  /** Non-floating link ids per owner, projected from the semantic document. */
  idsByOwner: Map<OwningGraphId, Set<LinkId>>
  /** Floating link ids per owner; reroute-chain state that never enters the document. */
  floatingIdsByOwner: Map<OwningGraphId, Set<LinkId>>
  targetIndex: Map<TargetSlotKey, LinkTopology>
  originIndex: OriginIndex
}

function localOrigin(context?: RemoteMutationContext): LocalUpdateOrigin {
  return context
    ? { source: 'local', actor: context.actor, opId: context.opId }
    : { source: 'local' }
}

/** The document's `LinkTuple` for a non-floating topology. */
function linkTuple(topology: LinkTopology): LinkTuple {
  return [
    topology.id,
    topology.originNodeId,
    topology.originSlot,
    topology.targetNodeId,
    topology.targetSlot,
    topology.type
  ]
}

function sameTuple(value: unknown, tuple: LinkTuple): boolean {
  return (
    Array.isArray(value) &&
    value.length === tuple.length &&
    tuple.every((part, index) => value[index] === part)
  )
}

/**
 * Recovers the `byId` key of a link from its semantic-document key. Links
 * minted by LiteGraph carry numeric ids and are stored under
 * `String(id)`; links pasted through the CRDT `insert_workflow` op keep the
 * namespaced string id the host assigned (`insert:<op>:<path>:link:<n>`),
 * which LiteGraph and this store carry verbatim. Both must round-trip, or
 * membership silently drops the pasted links while `byId` still holds them.
 */
function linkIdFromDocKey(key: string): LinkId {
  return parseLinkId(key) ?? (key as unknown as LinkId)
}

function addOwnerId(
  index: Map<OwningGraphId, Set<LinkId>>,
  owningGraphId: OwningGraphId,
  id: LinkId
): void {
  const ownerIds = index.get(owningGraphId)
  if (ownerIds) ownerIds.add(id)
  else index.set(owningGraphId, reactive(new Set([id])))
}

function removeOwnerId(
  index: Map<OwningGraphId, Set<LinkId>>,
  owningGraphId: OwningGraphId,
  id: LinkId
): void {
  const ownerIds = index.get(owningGraphId)
  if (!ownerIds) return
  ownerIds.delete(id)
  if (ownerIds.size === 0) index.delete(owningGraphId)
}

const EMPTY_LINKS: ReadonlySet<LinkTopology> = new Set()

/**
 * A link is keyed by its target input slot only when that slot uniquely
 * identifies it. Floating links (either endpoint unassigned) can share an
 * input slot with a real link and are not queried by target.
 */
function hasUniqueTarget(topology: LinkTopology): boolean {
  return !isFloatingTopology(topology)
}

/**
 * Link topology store, partitioned by root and owning graph. At most one live
 * link can target a given input slot, so the target index answers the dominant
 * query ("is this input connected, and by what?") in one lookup. The root
 * bucket's link-id map is the identity authority; owner and slot maps are
 * derived indexes.
 *
 * Non-floating link membership is projected from the root graph's semantic
 * Yjs document (`semanticDocs`): `idsByOwner` is derived by observing the
 * `links` root and every `definitions.<owner>.links` map, and local
 * placement/displacement writes the `LinkTuple` under those keys with a local
 * origin. Floating topologies are reroute-chain state, not links; they stay in
 * the store-local `floatingIdsByOwner` and never touch the document.
 * See docs/architecture/link-topology-store.md.
 */
export const useLinkStore = defineStore('link', () => {
  const roots = reactive(new Map<RootGraphId, RootTopologyBucket>())
  const unobserveByRoot = new Map<RootGraphId, () => void>()
  const revision = shallowRef(0)

  function getRevision(): number {
    return revision.value
  }

  /**
   * Invalidates {@link LinkMap}'s revision-keyed cache without registering,
   * replacing, or removing any topology.
   *
   * A topology can be registered here (bumping `revision` itself) before it
   * has a live LiteGraph facade: `materializeLinkAdapter` adopts a facade
   * lazily, on a later reconcile pass, and that adoption does not itself
   * change any store state. If something reads `graph.links` in the gap
   * between those two steps — e.g. a CRDT `connect` mutation's own commit,
   * checking whether the slot it just displaced still names the old link —
   * `LinkMap` caches "no facade yet" against the CURRENT revision, and
   * nothing tells it to recompute once the facade actually lands, because
   * adoption alone never touches `revision`. Call this right after adoption
   * so the next `graph.links` read is guaranteed to see it.
   */
  function notifyAdapterAdopted(): void {
    revision.value++
  }

  function observeRoot(
    rootGraphId: RootGraphId,
    bucket: RootTopologyBucket
  ): void {
    unobserveByRoot.set(
      rootGraphId,
      semanticDocs.projectMembership(rootGraphId, 'links', {
        add: (owningGraphId, key) =>
          addOwnerId(bucket.idsByOwner, owningGraphId, linkIdFromDocKey(key)),
        remove: (owningGraphId, key) =>
          removeOwnerId(
            bucket.idsByOwner,
            owningGraphId,
            linkIdFromDocKey(key)
          ),
        resetDefinitionOwners: () => {
          for (const owningGraphId of [...bucket.idsByOwner.keys()]) {
            if ((owningGraphId as string) !== (rootGraphId as string))
              bucket.idsByOwner.delete(owningGraphId)
          }
        }
      })
    )
  }

  function dropRoot(rootGraphId: RootGraphId): boolean {
    unobserveByRoot.get(rootGraphId)?.()
    unobserveByRoot.delete(rootGraphId)
    return roots.delete(rootGraphId)
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      for (const rootGraphId of [...unobserveByRoot.keys()])
        dropRoot(rootGraphId)
    })
  }

  function rootBucket(rootGraphId: RootGraphId): RootTopologyBucket {
    const existing = roots.get(rootGraphId)
    if (existing) return existing
    const created = reactive<RootTopologyBucket>({
      byId: new Map(),
      idsByOwner: new Map(),
      floatingIdsByOwner: new Map(),
      targetIndex: new Map(),
      originIndex: new Map()
    })
    roots.set(rootGraphId, created)
    observeRoot(rootGraphId, created)
    return created
  }

  /** Runs `fn` as one local document transaction for `rootGraphId`. */
  function transact(
    rootGraphId: RootGraphId,
    context: RemoteMutationContext | undefined,
    fn: (doc: YDoc) => void
  ): void {
    semanticDocs.transactLocal(rootGraphId, localOrigin(context), fn)
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

  /**
   * Places a link whose target availability has already been validated. A
   * non-floating topology is written to its owner's `links` map when the key
   * is absent or names different endpoints, so registering a link that a
   * merged remote frame already placed is a pure local materialisation.
   */
  function placeValidated(
    bucket: RootTopologyBucket,
    rootGraphId: RootGraphId,
    doc: YDoc,
    topology: LinkTopology
  ): LinkTopology {
    const placed = reactive(topology)
    bucket.byId.set(placed.id, placed)
    if (isFloatingTopology(topology)) {
      addOwnerId(bucket.floatingIdsByOwner, placed.graphId, placed.id)
    } else {
      const links = ownerLinksMap(doc, rootGraphId, placed.graphId, true)
      const key = String(placed.id)
      const tuple = linkTuple(topology)
      if (!sameTuple(links.get(key), tuple)) links.set(key, tuple)
    }
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
   * @returns The registered topology. Re-registering the same raw topology
   * under the same owner returns the incumbent; `undefined` means a distinct
   * topology occupies its ID or non-floating target slot.
   */
  function registerLink(
    scope: GraphScope,
    topology: LinkTopology,
    context?: RemoteMutationContext
  ): LinkTopology | undefined {
    const incumbent = roots.get(scope.rootGraphId)?.byId.get(topology.id)
    if (
      toRaw(incumbent) === toRaw(topology) &&
      incumbent?.graphId === scope.owningGraphId
    )
      return incumbent
    return replaceLink(scope, undefined, topology, context)
  }

  /** Atomically replaces an expected target occupant with a new link. */
  function replaceLink(
    scope: GraphScope,
    expected: LinkTopology | undefined,
    replacement: LinkTopology,
    context?: RemoteMutationContext
  ): LinkTopology | undefined {
    const bucket = roots.get(scope.rootGraphId)
    if (expected && (!bucket || !ownsPlacement(scope, bucket, expected))) {
      return undefined
    }

    const incumbent = bucket?.byId.get(replacement.id)
    if (incumbent) {
      console.error(
        `Link ${replacement.id} belongs to graph ${incumbent.graphId}; graph ${scope.owningGraphId} cannot overwrite it.`
      )
      return undefined
    }
    if (hasUniqueTarget(replacement)) {
      const key = targetKey(
        scope.owningGraphId,
        replacement.targetNodeId,
        replacement.targetSlot
      )
      const existing = bucket?.targetIndex.get(key)
      if (toRaw(existing) !== toRaw(expected)) {
        console.error(`Link target slot ${key} is already occupied`)
        return undefined
      }
    }

    const targetBucket = bucket ?? rootBucket(scope.rootGraphId)
    const owned = Object.assign(replacement, { graphId: scope.owningGraphId })
    let placed: LinkTopology | undefined
    transact(scope.rootGraphId, context, (doc) => {
      if (expected) displace(targetBucket, scope.rootGraphId, doc, expected)
      placed = placeValidated(targetBucket, scope.rootGraphId, doc, owned)
    })
    revision.value++
    return placed
  }

  /**
   * Removes a link placement that has already been validated, deleting a
   * non-floating topology's key from its owner's `links` map.
   */
  function displace(
    bucket: RootTopologyBucket,
    rootGraphId: RootGraphId,
    doc: YDoc,
    topology: LinkTopology
  ): void {
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
    if (isFloatingTopology(topology)) {
      removeOwnerId(bucket.floatingIdsByOwner, topology.graphId, topology.id)
    } else {
      ownerLinksMap(doc, rootGraphId, topology.graphId, false)?.delete(
        String(topology.id)
      )
    }
    unindexOrigin(bucket, topology)
  }

  function deleteLink(
    scope: GraphScope,
    topology: LinkTopology,
    context?: RemoteMutationContext
  ): boolean {
    const bucket = roots.get(scope.rootGraphId)
    if (!bucket || !ownsPlacement(scope, bucket, topology)) return false
    transact(scope.rootGraphId, context, (doc) =>
      displace(bucket, scope.rootGraphId, doc, topology)
    )
    if (bucket.byId.size === 0) dropRoot(scope.rootGraphId)
    revision.value++
    return true
  }

  function ownsPlacement(
    scope: GraphScope,
    bucket: RootTopologyBucket,
    topology: LinkTopology
  ): boolean {
    return (
      topology.graphId === scope.owningGraphId &&
      toRaw(bucket.byId.get(topology.id)) === toRaw(topology)
    )
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
      if (!bucket || !ownsPlacement(scope, bucket, topology)) {
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
    removals: readonly LinkTopology[] = [],
    context?: RemoteMutationContext
  ): EndpointUpdateResult<LinkTopology[]> {
    const error = validateEndpointUpdates(scope, updates, removals)
    if (error) return { ok: false, error }

    const bucket = rootBucket(scope.rootGraphId)
    let value: LinkTopology[] = []
    transact(scope.rootGraphId, context, (doc) => {
      for (const { topology } of updates)
        displace(bucket, scope.rootGraphId, doc, topology)
      for (const topology of removals)
        displace(bucket, scope.rootGraphId, doc, topology)

      value = updates.map(({ topology, patch }) => {
        Object.assign(reactive(topology), patchedEndpoints(topology, patch))
        return placeValidated(bucket, scope.rootGraphId, doc, topology)
      })
    })
    if (bucket.byId.size === 0) dropRoot(scope.rootGraphId)
    revision.value++
    return { ok: true, value }
  }

  /** Applies one endpoint patch atomically. */
  function updateEndpoint(
    scope: GraphScope,
    topology: LinkTopology,
    patch: EndpointPatch,
    context?: RemoteMutationContext
  ): EndpointUpdateResult<LinkTopology> {
    const result = updateEndpoints(scope, [{ topology, patch }], [], context)
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

  /**
   * Iterates every registered topology owned by a graph: document-projected
   * links first, then floating topologies. A document key without a
   * registered topology (a merged remote frame the store has not
   * materialised yet) is skipped.
   */
  function* graphTopologies(scope: GraphScope): Generator<LinkTopology> {
    const bucket = roots.get(scope.rootGraphId)
    if (!bucket) return
    const ids = [
      ...(bucket.idsByOwner.get(scope.owningGraphId) ?? []),
      ...(bucket.floatingIdsByOwner.get(scope.owningGraphId) ?? [])
    ]
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

  /**
   * Drops every link of the root graph, clearing link membership from the
   * semantic document (root `links` and each definition's `links`) so a later
   * bucket for the same root does not re-seed stale ids.
   */
  function clearGraph(graphId: RootGraphId): void {
    if (!roots.has(graphId) && !semanticDocs.has(graphId)) return
    transact(graphId, undefined, (doc) => {
      ownerLinksMap(doc, graphId, toOwningGraphId(graphId), true).clear()
      for (const [, links] of definitionOwnerMaps(doc, 'links')) links.clear()
    })
    if (dropRoot(graphId)) revision.value++
  }

  function clearOwner(
    scope: GraphScope,
    context?: RemoteMutationContext
  ): void {
    const bucket = roots.get(scope.rootGraphId)
    if (!bucket) return
    const ids = [
      ...(bucket.idsByOwner.get(scope.owningGraphId) ?? []),
      ...(bucket.floatingIdsByOwner.get(scope.owningGraphId) ?? [])
    ]
    if (ids.length === 0) return
    transact(scope.rootGraphId, context, (doc) => {
      for (const id of ids) {
        const topology = bucket.byId.get(id)
        if (topology) displace(bucket, scope.rootGraphId, doc, topology)
      }
    })
    if (bucket.byId.size === 0) dropRoot(scope.rootGraphId)
    revision.value++
  }

  return {
    registerLink,
    replaceLink,
    updateEndpoint,
    updateEndpoints,
    validateEndpointUpdates,
    deleteLink,
    isInputSlotConnected,
    getInputSlotLink,
    isOutputSlotConnected,
    getOutputSlotLinks,
    getTopology,
    graphTopologies,
    getRevision,
    notifyAdapterAdopted,
    clearOwner,
    clearGraph
  }
})
