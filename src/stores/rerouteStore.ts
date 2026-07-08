import { defineStore } from 'pinia'
import { computed, reactive, ref, toRaw } from 'vue'
import type { ComputedRef } from 'vue'

import { useLinkStore } from '@/stores/linkStore'
import type { LinkId } from '@/types/linkId'
import { isFloatingTopology } from '@/types/linkTopology'
import type { RerouteChain } from '@/types/rerouteChain'
import type { RerouteId } from '@/types/rerouteId'
import type { UUID } from '@/utils/uuid'

/** The links whose chains pass through a reroute, split by link liveness. */
export interface RerouteMembership {
  linkIds: ReadonlySet<LinkId>
  floatingLinkIds: ReadonlySet<LinkId>
}

export const EMPTY_MEMBERSHIP: Readonly<RerouteMembership> = {
  linkIds: new Set(),
  floatingLinkIds: new Set()
} as const

/**
 * Reroute chain store, holding each reroute's chain state (parent pointer
 * and floating slot marker) in root-graph-scoped buckets keyed by
 * `RerouteId`. Link membership is not stored; it is derived from the links'
 * parentId chains. See docs/architecture/reroute-chain-store.md.
 */
export const useRerouteStore = defineStore('reroute', () => {
  const chains = ref(new Map<UUID, Map<RerouteId, RerouteChain>>())
  const membershipIndexes = new Map<
    UUID,
    ComputedRef<Map<RerouteId, RerouteMembership>>
  >()

  function graphChains(graphId: UUID): Map<RerouteId, RerouteChain> {
    const existing = chains.value.get(graphId)
    if (existing) return existing
    const next = reactive(new Map<RerouteId, RerouteChain>())
    chains.value.set(graphId, next)
    return next
  }

  /**
   * Builds the reverse index from the links' parentId chains: a link is a
   * member of exactly the reroutes on the chain walked from its terminal
   * reroute upstream. A link with an unassigned endpoint is floating.
   */
  function buildMembershipIndex(
    graphId: UUID
  ): Map<RerouteId, RerouteMembership> {
    const bucket = chains.value.get(graphId)
    const index = new Map<
      RerouteId,
      { linkIds: Set<LinkId>; floatingLinkIds: Set<LinkId> }
    >()
    for (const topology of useLinkStore().graphTopologies(graphId)) {
      const floating = isFloatingTopology(topology)
      const visited = new Set<RerouteId>()
      let rerouteId = topology.parentId
      while (rerouteId !== undefined && !visited.has(rerouteId)) {
        visited.add(rerouteId)
        let entry = index.get(rerouteId)
        if (!entry) {
          entry = { linkIds: new Set(), floatingLinkIds: new Set() }
          index.set(rerouteId, entry)
        }
        const members = floating ? entry.floatingLinkIds : entry.linkIds
        members.add(topology.id)
        rerouteId = bucket?.get(rerouteId)?.parentId
      }
    }
    return index
  }

  function graphMembership(
    graphId: UUID
  ): ComputedRef<Map<RerouteId, RerouteMembership>> {
    const existing = membershipIndexes.get(graphId)
    if (existing) return existing
    const next = computed(() => buildMembershipIndex(graphId))
    membershipIndexes.set(graphId, next)
    return next
  }

  function getMembership(
    graphId: UUID,
    rerouteId: RerouteId
  ): RerouteMembership {
    return graphMembership(graphId).value.get(rerouteId) ?? EMPTY_MEMBERSHIP
  }

  /**
   * Registers a reroute's chain state.
   *
   * Refuses to overwrite a registration held by a different chain: silent
   * last-wins would let a throwaway graph hijack a live reroute's entry,
   * leaving the live owner unable to update or vacate it. The refused caller
   * keeps its own (untracked) chain. To hand an id to another chain, the
   * registered owner must vacate first via {@link deleteReroute}.
   *
   * @returns The store-held reactive state — callers keep it as their live
   * state object so later field writes are tracked — or `chain` unchanged
   * when registration was refused.
   */
  function registerReroute(graphId: UUID, chain: RerouteChain): RerouteChain {
    const bucket = graphChains(graphId)
    const existing = bucket.get(chain.id)
    if (existing && toRaw(existing) !== toRaw(chain)) {
      console.warn(
        `[rerouteStore] Reroute ${chain.id} is already registered in graph ${graphId}; refusing to overwrite the live registration.`
      )
      return chain
    }
    bucket.set(chain.id, chain)
    return bucket.get(chain.id)!
  }

  function getReroute(
    graphId: UUID,
    rerouteId: RerouteId
  ): RerouteChain | undefined {
    return chains.value.get(graphId)?.get(rerouteId)
  }

  /** Removes a chain's registration; only the registered state may vacate it. */
  function deleteReroute(graphId: UUID, chain: RerouteChain): boolean {
    const bucket = chains.value.get(graphId)
    if (!bucket) return false
    if (toRaw(bucket.get(chain.id)) !== toRaw(chain)) return false
    return bucket.delete(chain.id)
  }

  function clearGraph(graphId: UUID): void {
    chains.value.delete(graphId)
    membershipIndexes.delete(graphId)
  }

  return {
    registerReroute,
    getReroute,
    deleteReroute,
    getMembership,
    clearGraph
  }
})
