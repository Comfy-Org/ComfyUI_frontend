import { defineStore } from 'pinia'
import { computed, reactive, toRaw } from 'vue'
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
  interface RootRerouteBucket {
    chains: Map<RerouteId, RerouteChain>
    idsByOwner: Map<OwningGraphId, Set<RerouteId>>
    membershipByOwner: Map<
      OwningGraphId,
      ComputedRef<Map<RerouteId, RerouteMembership>>
    >
  }

  const roots = reactive(new Map<RootGraphId, RootRerouteBucket>())

  function rootBucket(rootGraphId: RootGraphId): RootRerouteBucket {
    const existing = roots.get(rootGraphId)
    if (existing) return existing
    const created: RootRerouteBucket = {
      chains: reactive(new Map()),
      idsByOwner: reactive(new Map()),
      membershipByOwner: new Map()
    }
    roots.set(rootGraphId, created)
    return created
  }

  /**
   * Builds the reverse index from the links' parentId chains: a link is a
   * member of exactly the reroutes on the chain walked from its terminal
   * reroute upstream. A link with an unassigned endpoint is floating.
   */
  function buildMembershipIndex(
    scope: GraphScope
  ): Map<RerouteId, RerouteMembership> {
    const chains = roots.get(scope.rootGraphId)?.chains
    const index = new Map<
      RerouteId,
      { linkIds: Set<LinkId>; floatingLinkIds: Set<LinkId> }
    >()
    for (const topology of useLinkStore().graphTopologies(scope)) {
      const floating = isFloatingTopology(topology)
      const visited = new Set<RerouteId>()
      let rerouteId = topology.parentId
      while (rerouteId !== undefined && !visited.has(rerouteId)) {
        const parent = chains?.get(rerouteId)
        if (!parent || parent.graphId !== scope.owningGraphId) break
        visited.add(rerouteId)
        let entry = index.get(rerouteId)
        if (!entry) {
          entry = { linkIds: new Set(), floatingLinkIds: new Set() }
          index.set(rerouteId, entry)
        }
        const members = floating ? entry.floatingLinkIds : entry.linkIds
        members.add(topology.id)
        rerouteId = parent.parentId
      }
    }
    return index
  }

  function graphMembership(
    scope: GraphScope,
    bucket: RootRerouteBucket
  ): ComputedRef<Map<RerouteId, RerouteMembership>> {
    const existing = bucket.membershipByOwner.get(scope.owningGraphId)
    if (existing) return existing
    const next = computed(() => buildMembershipIndex(scope))
    bucket.membershipByOwner.set(scope.owningGraphId, next)
    return next
  }

  function getMembership(
    scope: GraphScope,
    rerouteId: RerouteId
  ): RerouteMembership {
    const bucket = roots.get(scope.rootGraphId)
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
  ): RerouteChain | undefined {
    const existingBucket = roots.get(scope.rootGraphId)
    const existing = existingBucket?.chains.get(chain.id)
    if (
      existing &&
      toRaw(existing) === toRaw(chain) &&
      existing.graphId === scope.owningGraphId
    )
      return existing
    if (existing) {
      console.error(
        `[rerouteStore] Reroute ${chain.id} belongs to graph ${existing.graphId}; graph ${scope.owningGraphId} cannot overwrite it.`
      )
      return undefined
    }
    const bucket = existingBucket ?? rootBucket(scope.rootGraphId)
    const owned = Object.assign(chain, { graphId: scope.owningGraphId })
    bucket.chains.set(owned.id, owned)
    const ownerIds = bucket.idsByOwner.get(scope.owningGraphId)
    if (ownerIds) ownerIds.add(owned.id)
    else
      bucket.idsByOwner.set(scope.owningGraphId, reactive(new Set([owned.id])))
    return bucket.chains.get(owned.id)
  }

  function getReroute(
    scope: GraphScope,
    rerouteId: RerouteId
  ): RerouteChain | undefined {
    const chain = roots.get(scope.rootGraphId)?.chains.get(rerouteId)
    return chain?.graphId === scope.owningGraphId ? chain : undefined
  }

  function* graphChains(scope: GraphScope): Generator<RerouteChain> {
    const bucket = roots.get(scope.rootGraphId)
    const ids = bucket?.idsByOwner.get(scope.owningGraphId)
    if (!bucket || !ids) return
    for (const id of ids) {
      const chain = bucket.chains.get(id)
      if (chain) yield chain
    }
  }

  /** Removes a chain's registration; only the registered state may vacate it. */
  function deleteReroute(scope: GraphScope, chain: RerouteChain): boolean {
    const bucket = roots.get(scope.rootGraphId)
    if (!bucket) return false
    if (chain.graphId !== scope.owningGraphId) return false
    if (toRaw(bucket.chains.get(chain.id)) !== toRaw(chain)) return false
    if (!bucket.chains.delete(chain.id)) return false
    const ownerIds = bucket.idsByOwner.get(chain.graphId)
    ownerIds?.delete(chain.id)
    if (ownerIds?.size === 0) {
      bucket.idsByOwner.delete(chain.graphId)
      bucket.membershipByOwner.delete(chain.graphId)
    }
    if (bucket.chains.size === 0) roots.delete(scope.rootGraphId)
    return true
  }

  function clearGraph(graphId: RootGraphId): void {
    roots.delete(graphId)
  }

  function clearOwner(scope: GraphScope): void {
    const bucket = roots.get(scope.rootGraphId)
    const ids = bucket?.idsByOwner.get(scope.owningGraphId)
    if (!bucket || !ids) return
    for (const id of ids) bucket.chains.delete(id)
    bucket.idsByOwner.delete(scope.owningGraphId)
    bucket.membershipByOwner.delete(scope.owningGraphId)
    if (bucket.chains.size === 0) roots.delete(scope.rootGraphId)
  }

  return {
    registerReroute,
    getReroute,
    graphChains,
    deleteReroute,
    getMembership,
    clearOwner,
    clearGraph
  }
})
