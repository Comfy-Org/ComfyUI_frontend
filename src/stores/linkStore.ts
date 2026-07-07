import { defineStore } from 'pinia'
import { computed, reactive, ref, toRaw } from 'vue'
import type { ComputedRef } from 'vue'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import type { LinkTopology } from '@/types/linkTopology'
import type { NodeId } from '@/types/nodeId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

export type EndpointPatch = Partial<
  Pick<
    LinkTopology,
    'originNodeId' | 'originSlot' | 'targetNodeId' | 'targetSlot'
  >
>

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

type TargetIndex = Map<UUID, Map<TargetSlotKey, LinkTopology>>
type UnkeyedLinks = Map<UUID, Set<LinkTopology>>
type OriginIndex = Map<OriginSlotKey, Set<LinkTopology>>

const EMPTY_LINKS: ReadonlySet<LinkTopology> = new Set()

/**
 * A link is keyed by its target input slot only when that slot uniquely
 * identifies it: floating links (either endpoint unassigned) can share an
 * input slot with a real link, and SUBGRAPH_OUTPUT_ID is a constant shared by
 * every subgraph in a root bucket. Neither is queried by target.
 */
function hasUniqueTarget(topology: LinkTopology): boolean {
  return (
    topology.originNodeId !== UNASSIGNED_NODE_ID &&
    topology.targetNodeId !== UNASSIGNED_NODE_ID &&
    topology.targetNodeId !== SUBGRAPH_OUTPUT_ID
  )
}

/**
 * Link topology store, keyed by link target. At most one live link can target
 * a given input slot — litegraph disconnects the previous link before
 * connecting a new one — so the target is the natural primary key and the
 * dominant query ("is this input connected, and by what?") is one lookup.
 * Links without a unique target live in a per-graph side collection.
 */
export const useLinkStore = defineStore('link', () => {
  const targetIndex = ref<TargetIndex>(new Map())
  const unkeyedLinks = ref<UnkeyedLinks>(new Map())
  const outputIndexes = new Map<UUID, ComputedRef<OriginIndex>>()

  function graphTargets(graphId: UUID): Map<TargetSlotKey, LinkTopology> {
    const existing = targetIndex.value.get(graphId)
    if (existing) return existing
    const next = reactive(new Map<TargetSlotKey, LinkTopology>())
    targetIndex.value.set(graphId, next)
    return next
  }

  function graphUnkeyed(graphId: UUID): Set<LinkTopology> {
    const existing = unkeyedLinks.value.get(graphId)
    if (existing) return existing
    const next = reactive(new Set<LinkTopology>())
    unkeyedLinks.value.set(graphId, next)
    return next
  }

  /**
   * Places a link under its current endpoints. The first registration for a
   * target slot wins; re-placing the already-registered topology is a no-op.
   * @returns The store-held reactive state when `topology` holds a
   * registration afterwards — callers keep it as their live state object so
   * later field writes are tracked — otherwise `undefined`.
   */
  function place(
    graphId: UUID,
    topology: LinkTopology
  ): LinkTopology | undefined {
    if (!hasUniqueTarget(topology)) {
      graphUnkeyed(graphId).add(topology)
      return reactive(topology)
    }
    const targets = graphTargets(graphId)
    const key = targetKey(topology.targetNodeId, topology.targetSlot)
    const existing = targets.get(key)
    if (existing && toRaw(existing) !== toRaw(topology)) return undefined
    targets.set(key, topology)
    return reactive(topology)
  }

  /** Removes a link's placement; only the registered topology may vacate it. */
  function displace(graphId: UUID, topology: LinkTopology): boolean {
    if (unkeyedLinks.value.get(graphId)?.delete(topology)) return true
    const targets = targetIndex.value.get(graphId)
    if (!targets) return false
    const key = targetKey(topology.targetNodeId, topology.targetSlot)
    if (toRaw(targets.get(key)) !== toRaw(topology)) return false
    return targets.delete(key)
  }

  /**
   * Applies an endpoint patch and re-places the link under its new target.
   * @returns The store-held reactive state when the link holds a
   * registration afterwards, otherwise `undefined`.
   */
  function updateEndpoint(
    graphId: UUID,
    topology: LinkTopology,
    patch: EndpointPatch
  ): LinkTopology | undefined {
    displace(graphId, topology)
    const live = reactive(topology)
    if (patch.originNodeId !== undefined) live.originNodeId = patch.originNodeId
    if (patch.originSlot !== undefined) live.originSlot = patch.originSlot
    if (patch.targetNodeId !== undefined) live.targetNodeId = patch.targetNodeId
    if (patch.targetSlot !== undefined) live.targetSlot = patch.targetSlot
    return place(graphId, topology)
  }

  function isInputSlotConnected(
    graphId: UUID,
    nodeId: NodeId,
    slot: number
  ): boolean {
    return targetIndex.value.get(graphId)?.has(targetKey(nodeId, slot)) ?? false
  }

  function getInputSlotLink(
    graphId: UUID,
    nodeId: NodeId,
    slot: number
  ): LinkTopology | undefined {
    return targetIndex.value.get(graphId)?.get(targetKey(nodeId, slot))
  }

  /**
   * Reverse index over origin endpoints, keyed `${originNodeId}:${originSlot}`.
   * Spans both collections `graphTopologies` yields, so a link whose target is
   * floating still indexes its assigned origin. Links with an unassigned origin
   * have no output slot to report and are skipped.
   */
  function buildOutputIndex(graphId: UUID): OriginIndex {
    const index: OriginIndex = new Map()
    for (const topology of graphTopologies(graphId)) {
      if (topology.originNodeId === UNASSIGNED_NODE_ID) continue
      const key = originKey(topology.originNodeId, topology.originSlot)
      const links = index.get(key) ?? new Set<LinkTopology>()
      links.add(topology)
      index.set(key, links)
    }
    return index
  }

  function outputIndex(graphId: UUID): ComputedRef<OriginIndex> {
    const existing = outputIndexes.get(graphId)
    if (existing) return existing
    const next = computed(() => buildOutputIndex(graphId))
    outputIndexes.set(graphId, next)
    return next
  }

  function isOutputSlotConnected(
    graphId: UUID,
    nodeId: NodeId,
    slot: number
  ): boolean {
    return outputIndex(graphId).value.has(originKey(nodeId, slot))
  }

  function getOutputSlotLinks(
    graphId: UUID,
    nodeId: NodeId,
    slot: number
  ): ReadonlySet<LinkTopology> {
    return (
      outputIndex(graphId).value.get(originKey(nodeId, slot)) ?? EMPTY_LINKS
    )
  }

  /** Iterates every registered topology in a graph's bucket. */
  function* graphTopologies(graphId: UUID): Generator<LinkTopology> {
    const targets = targetIndex.value.get(graphId)
    if (targets) yield* targets.values()
    const unkeyed = unkeyedLinks.value.get(graphId)
    if (unkeyed) yield* unkeyed.values()
  }

  function clearGraph(graphId: UUID): void {
    targetIndex.value.delete(graphId)
    unkeyedLinks.value.delete(graphId)
    outputIndexes.delete(graphId)
  }

  return {
    registerLink: place,
    updateEndpoint,
    deleteLink: displace,
    isInputSlotConnected,
    getInputSlotLink,
    isOutputSlotConnected,
    getOutputSlotLinks,
    graphTopologies,
    clearGraph
  }
})
