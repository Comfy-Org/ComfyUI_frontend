import { defineStore } from 'pinia'

import type { LinkId, LLink } from '@/lib/litegraph/src/LLink'
import type { Reroute, RerouteId } from '@/lib/litegraph/src/Reroute'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

interface LinkStoreTopology {
  links: ReadonlyMap<LinkId, LLink>
  floatingLinks: ReadonlyMap<LinkId, LLink>
  reroutes: ReadonlyMap<RerouteId, Reroute>
}

const EMPTY_TOPOLOGY: Readonly<LinkStoreTopology> = Object.freeze({
  links: new Map(),
  floatingLinks: new Map(),
  reroutes: new Map()
})

/**
 * Graph-scoped topology store (Pinia).
 *
 * This store owns no mutation logic and is rehydrated from graph lifecycle
 * boundaries (`clear` and `configure`). The `ReadonlyMap` fields are live
 * projections of mutable graph state, not immutable snapshots.
 *
 * Each graph/subgraph registers its own topology keyed by graph UUID.
 */
export const useLinkStore = defineStore('link', () => {
  // Intentionally non-reactive: used as an imperative graph lookup boundary,
  // not as UI-driven reactive state.
  const topologies = new Map<UUID, LinkStoreTopology>()

  function rehydrate(graphId: UUID, topology: LinkStoreTopology) {
    topologies.set(graphId, topology)
  }

  function getTopology(graphId: UUID): LinkStoreTopology {
    return topologies.get(graphId) ?? EMPTY_TOPOLOGY
  }

  function getLink(
    graphId: UUID,
    id: LinkId | null | undefined
  ): LLink | undefined {
    if (id == null) return undefined
    return topologies.get(graphId)?.links.get(id)
  }

  function getFloatingLink(
    graphId: UUID,
    id: LinkId | null | undefined
  ): LLink | undefined {
    if (id == null) return undefined
    return topologies.get(graphId)?.floatingLinks.get(id)
  }

  function getReroute(
    graphId: UUID,
    id: RerouteId | null | undefined
  ): Reroute | undefined {
    if (id == null) return undefined
    return topologies.get(graphId)?.reroutes.get(id)
  }

  function clearGraph(graphId: UUID) {
    topologies.delete(graphId)
  }

  return {
    rehydrate,
    getTopology,
    getLink,
    getFloatingLink,
    getReroute,
    clearGraph
  }
})
