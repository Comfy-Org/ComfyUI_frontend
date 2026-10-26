import { defineStore } from 'pinia'
import { reactive } from 'vue'

import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'
import { toLinkTieId } from '@/types/linkTie'
import type { LinkTie, LinkTieDraft, LinkTieId } from '@/types/linkTie'

const NO_TIES: readonly LinkTie[] = []

/** Each tie cut down to the links that pass `keep`; ties left empty are dropped. */
export function restrictLinkTies(
  ties: readonly LinkTie[],
  keep: (linkId: LinkId) => boolean
): LinkTie[] {
  return ties.flatMap((tie) => {
    const linkIds = tie.linkIds.filter(keep)
    if (!linkIds.length) return []
    return [linkIds.length === tie.linkIds.length ? tie : { ...tie, linkIds }]
  })
}

/**
 * Link ties per graph, partitioned by root graph and owning graph. The durable
 * source of `extra.linkTies` in the wire format.
 */
export const useLinkTieStore = defineStore('linkTie', () => {
  const roots = reactive(
    new Map<RootGraphId, Map<OwningGraphId, readonly LinkTie[]>>()
  )

  function getTies(scope: GraphScope): readonly LinkTie[] {
    return roots.get(scope.rootGraphId)?.get(scope.owningGraphId) ?? NO_TIES
  }

  function setTies(scope: GraphScope, ties: readonly LinkTie[]): void {
    const owners = roots.get(scope.rootGraphId)
    if (ties.length && owners) owners.set(scope.owningGraphId, ties)
    else if (ties.length)
      roots.set(scope.rootGraphId, new Map([[scope.owningGraphId, ties]]))
    else owners?.delete(scope.owningGraphId)
    if (owners?.size === 0) roots.delete(scope.rootGraphId)
  }

  function addTie(scope: GraphScope, draft: LinkTieDraft): LinkTie {
    const ties = getTies(scope)
    const id = toLinkTieId(Math.max(0, ...ties.map((tie) => tie.id)) + 1)
    const tie = { ...draft, id }
    setTies(scope, [...ties, tie])
    return tie
  }

  function moveTie(
    scope: GraphScope,
    id: LinkTieId,
    pos: LinkTie['pos']
  ): void {
    setTies(
      scope,
      getTies(scope).map((tie) => (tie.id === id ? { ...tie, pos } : tie))
    )
  }

  function removeTie(scope: GraphScope, id: LinkTieId): void {
    setTies(
      scope,
      getTies(scope).filter((tie) => tie.id !== id)
    )
  }

  /** Takes the links out of their ties and returns the part of each tie that held them. */
  function releaseLinks(
    scope: GraphScope,
    linkIds: Iterable<LinkId>
  ): LinkTie[] {
    const released = new Set(linkIds)
    const ties = getTies(scope)
    const taken = restrictLinkTies(ties, (id) => released.has(id))
    if (taken.length)
      setTies(
        scope,
        restrictLinkTies(ties, (id) => !released.has(id))
      )
    return taken
  }

  function clearGraph(rootGraphId: RootGraphId): void {
    roots.delete(rootGraphId)
  }

  function clearOwner(scope: GraphScope): void {
    setTies(scope, NO_TIES)
  }

  return {
    getTies,
    setTies,
    addTie,
    moveTie,
    removeTie,
    releaseLinks,
    clearGraph,
    clearOwner
  }
})
