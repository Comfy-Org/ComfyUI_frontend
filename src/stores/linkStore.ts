import { defineStore } from 'pinia'
import { computed, reactive, ref, toRaw } from 'vue'
import type { ComputedRef } from 'vue'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import type { LinkTopology } from '@/types/linkTopology'
import { isFloatingTopology } from '@/types/linkTopology'
import type { NodeId } from '@/types/nodeId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

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

  /** Places a validated link under its current endpoints. */
  function place(graphId: UUID, topology: LinkTopology): LinkTopology {
    if (hasUniqueTarget(topology)) {
      const key = targetKey(topology.targetNodeId, topology.targetSlot)
      const targets = graphTargets(graphId)
      const existing = targets.get(key)
      if (existing && toRaw(existing) !== toRaw(topology)) {
        throw new Error('Link target slot ' + key + ' is already occupied')
      }
      targets.set(key, topology)
    } else {
      graphUnkeyed(graphId).add(topology)
    }
    return reactive(topology)
  }

  /**
   * Registers a link under its current endpoints. The first registration for
   * a target slot wins — a duplicate stays detached instead of clobbering the
   * incumbent — and re-registering the already-registered topology is a no-op.
   * @returns The store-held reactive state when `topology` holds the
   * registration afterwards, otherwise `undefined`.
   */
  function registerLink(
    graphId: UUID,
    topology: LinkTopology
  ): LinkTopology | undefined {
    if (hasUniqueTarget(topology)) {
      const key = targetKey(topology.targetNodeId, topology.targetSlot)
      const existing = graphTargets(graphId).get(key)
      if (existing && toRaw(existing) !== toRaw(topology)) return undefined
    }
    return place(graphId, topology)
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

  function ownsPlacement(graphId: UUID, topology: LinkTopology): boolean {
    if (!hasUniqueTarget(topology)) {
      return unkeyedLinks.value.get(graphId)?.has(topology) ?? false
    }
    const key = targetKey(topology.targetNodeId, topology.targetSlot)
    return toRaw(targetIndex.value.get(graphId)?.get(key)) === toRaw(topology)
  }

  function validateEndpointUpdates(
    graphId: UUID,
    updates: readonly EndpointUpdate[],
    vacating: readonly LinkTopology[] = []
  ): void {
    const participants = [
      ...updates.map(({ topology }) => toRaw(topology)),
      ...vacating.map((topology) => toRaw(topology))
    ]
    if (new Set(participants).size !== participants.length) {
      throw new Error(
        'A link topology may only appear once in an endpoint batch'
      )
    }

    for (const topology of participants) {
      if (!ownsPlacement(graphId, topology)) {
        throw new Error(
          'Link ' + topology.id + ' does not own its current placement'
        )
      }
    }

    const finalOwners = new Set<TargetSlotKey>()
    for (const { topology, patch } of updates) {
      const final = { ...toRaw(topology), ...patch }
      if (!hasUniqueTarget(final)) continue

      const key = targetKey(final.targetNodeId, final.targetSlot)
      if (finalOwners.has(key)) {
        throw new Error('Multiple links target input slot ' + key)
      }
      finalOwners.add(key)

      const incumbent = targetIndex.value.get(graphId)?.get(key)
      if (incumbent && !participants.includes(toRaw(incumbent))) {
        throw new Error('Link target slot ' + key + ' is already occupied')
      }
    }
  }

  /** Atomically validates and applies endpoint updates. */
  function updateEndpoints(
    graphId: UUID,
    updates: readonly EndpointUpdate[]
  ): LinkTopology[] {
    validateEndpointUpdates(graphId, updates)
    for (const { topology } of updates) displace(graphId, topology)

    return updates.map(({ topology, patch }) => {
      Object.assign(reactive(topology), patch)
      return place(graphId, topology)
    })
  }

  /** Applies one endpoint patch atomically. */
  function updateEndpoint(
    graphId: UUID,
    topology: LinkTopology,
    patch: EndpointPatch
  ): LinkTopology {
    return updateEndpoints(graphId, [{ topology, patch }])[0]
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
   * Spans both collections `graphTopologies` yields. Floating links are
   * skipped: link queries return fully-assigned links only, matching the
   * `output.links` mirror this index replaces.
   */
  function buildOutputIndex(graphId: UUID): OriginIndex {
    const index: OriginIndex = new Map()
    for (const topology of graphTopologies(graphId)) {
      if (isFloatingTopology(topology)) continue
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
    registerLink,
    updateEndpoint,
    updateEndpoints,
    validateEndpointUpdates,
    deleteLink: displace,
    isInputSlotConnected,
    getInputSlotLink,
    isOutputSlotConnected,
    getOutputSlotLinks,
    graphTopologies,
    clearGraph
  }
})
