import { defineStore } from 'pinia'
import { computed, reactive, ref, toRaw } from 'vue'
import type { ComputedRef } from 'vue'

import { useLinkStore } from '@/stores/linkStore'
import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'
import { isFloatingTopology } from '@/types/linkTopology'
import type { RerouteChain } from '@/types/rerouteChain'
import type { RerouteId } from '@/types/rerouteId'

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
 * and floating slot marker) in root-and-owner-scoped buckets keyed by
 * `RerouteId`. Link membership is not stored; it is derived from the links'
 * parentId chains. See docs/architecture/reroute-chain-store.md.
 */
export const useRerouteStore = defineStore('reroute', () => {
  interface RerouteBucket {
    chains: Map<RerouteId, RerouteChain>
    membership?: () => ComputedRef<Map<RerouteId, RerouteMembership>>
  }

  const buckets = ref(new Map<RootGraphId, Map<OwningGraphId, RerouteBucket>>())

  function getBucket(scope: GraphScope): RerouteBucket | undefined {
    return buckets.value.get(scope.rootGraphId)?.get(scope.owningGraphId)
  }

  function graphBucket(scope: GraphScope): RerouteBucket {
    let owners = buckets.value.get(scope.rootGraphId)
    if (!owners) {
      owners = reactive(new Map<OwningGraphId, RerouteBucket>())
      buckets.value.set(scope.rootGraphId, owners)
    }
    const existing = owners.get(scope.owningGraphId)
    if (existing) return existing
    const next: RerouteBucket = {
      chains: reactive(new Map<RerouteId, RerouteChain>())
    }
    owners.set(scope.owningGraphId, next)
    return next
  }

  function pruneBucket(scope: GraphScope, bucket: RerouteBucket): void {
    if (bucket.chains.size) return
    const owners = buckets.value.get(scope.rootGraphId)
    if (owners?.get(scope.owningGraphId) !== bucket) return
    owners.delete(scope.owningGraphId)
    if (!owners.size && buckets.value.get(scope.rootGraphId) === owners) {
      buckets.value.delete(scope.rootGraphId)
    }
  }

  function graphChains(scope: GraphScope): Map<RerouteId, RerouteChain> {
    return graphBucket(scope).chains
  }

  /**
   * Builds the reverse index from the links' parentId chains: a link is a
   * member of exactly the reroutes on the chain walked from its terminal
   * reroute upstream. A link with an unassigned endpoint is floating.
   */
  function buildMembershipIndex(
    scope: GraphScope
  ): Map<RerouteId, RerouteMembership> {
    const chains = getBucket(scope)?.chains
    const index = new Map<
      RerouteId,
      { linkIds: Set<LinkId>; floatingLinkIds: Set<LinkId> }
    >()
    for (const topology of useLinkStore().graphTopologies(scope)) {
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
        rerouteId = chains?.get(rerouteId)?.parentId
      }
    }
    return index
  }

  function graphMembership(
    scope: GraphScope,
    bucket: RerouteBucket
  ): ComputedRef<Map<RerouteId, RerouteMembership>> {
    if (bucket.membership) return bucket.membership()
    const next = computed(() => buildMembershipIndex(scope))
    bucket.membership = () => next
    return next
  }

  function getMembership(
    scope: GraphScope,
    rerouteId: RerouteId
  ): RerouteMembership {
    const bucket = getBucket(scope)
    if (!bucket) return EMPTY_MEMBERSHIP
    return (
      graphMembership(scope, bucket).value.get(rerouteId) ?? EMPTY_MEMBERSHIP
    )
  }

  /**
   * Registers a reroute's chain state.
   * @returns The store-held reactive state — callers keep it as their live
   * state object so later field writes are tracked.
   */
  function registerReroute(
    scope: GraphScope,
    chain: RerouteChain
  ): RerouteChain {
    const bucket = graphChains(scope)
    const existing = bucket.get(chain.id)
    if (existing && toRaw(existing) !== toRaw(chain)) {
      console.warn(
        `[rerouteStore] Reroute ${chain.id} is already registered in graph ${scope.owningGraphId}; refusing to overwrite the live registration.`
      )
      return existing
    }
    bucket.set(chain.id, chain)
    return bucket.get(chain.id)!
  }

  function getReroute(
    scope: GraphScope,
    rerouteId: RerouteId
  ): RerouteChain | undefined {
    return getBucket(scope)?.chains.get(rerouteId)
  }

  /** Removes a chain's registration; only the registered state may vacate it. */
  function deleteReroute(scope: GraphScope, chain: RerouteChain): boolean {
    const bucket = getBucket(scope)
    if (!bucket) return false
    if (toRaw(bucket.chains.get(chain.id)) !== toRaw(chain)) return false
    if (!bucket.chains.delete(chain.id)) return false
    pruneBucket(scope, bucket)
    return true
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
    registerReroute,
    getReroute,
    deleteReroute,
    getMembership,
    clearOwner,
    clearGraph
  }
})
