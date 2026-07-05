import { defineStore } from 'pinia'
import { reactive, ref, toRaw } from 'vue'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'

import type { LinkTopology } from '@/types/linkTopology'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

export type EndpointPatch = Partial<
  Pick<
    LinkTopology,
    'originNodeId' | 'originSlot' | 'targetNodeId' | 'targetSlot'
  >
>

type TargetIndex = Map<UUID, Map<string, LinkTopology>>
type UnkeyedLinks = Map<UUID, Set<LinkTopology>>

/** Slot is numeric so the last separator is unambiguous for any node id. */
function targetKey(nodeId: NodeId, slot: number): string {
  return `${nodeId}:${slot}`
}

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

  function graphTargets(graphId: UUID): Map<string, LinkTopology> {
    const existing = targetIndex.value.get(graphId)
    if (existing) return existing
    const next = reactive(new Map<string, LinkTopology>())
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
    return targets.get(key)
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

  function clearGraph(graphId: UUID): void {
    targetIndex.value.delete(graphId)
    unkeyedLinks.value.delete(graphId)
  }

  return {
    registerLink: place,
    updateEndpoint,
    deleteLink: displace,
    isInputSlotConnected,
    getInputSlotLink,
    clearGraph
  }
})
