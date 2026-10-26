import { defineStore } from 'pinia'
import { markRaw, reactive } from 'vue'

import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'
import { toLinkTieId } from '@/types/linkTie'
import type { LinkTie, LinkTieDraft, LinkTieId } from '@/types/linkTie'

interface OwnedTies {
  readonly ties: readonly LinkTie[]
  readonly byLink: ReadonlyMap<LinkId, readonly LinkTie[]>
}

const NO_TIES: OwnedTies = { ties: [], byLink: new Map() }

function indexTies(ties: readonly LinkTie[]): OwnedTies {
  const byLink = new Map<LinkId, LinkTie[]>()
  for (const tie of ties) {
    for (const linkId of tie.linkIds) {
      const onLink = byLink.get(linkId)
      if (onLink) onLink.push(tie)
      else byLink.set(linkId, [tie])
    }
  }
  return markRaw({ ties, byLink })
}

/** Each tie with its links replaced by `relink(linkId)`; ties left without links are dropped. */
export function relinkLinkTies(
  ties: readonly LinkTie[],
  relink: (linkId: LinkId) => readonly LinkId[]
): LinkTie[] {
  return ties.flatMap((tie) => {
    const linkIds = [...new Set(tie.linkIds.flatMap(relink))]
    return linkIds.length ? [{ ...tie, linkIds }] : []
  })
}

/**
 * Link ties per graph, partitioned by root graph and owning graph. The durable
 * source of `extra.linkTies` in the wire format.
 */
export const useLinkTieStore = defineStore('linkTie', () => {
  const roots = reactive(new Map<RootGraphId, Map<OwningGraphId, OwnedTies>>())

  function owned(scope: GraphScope): OwnedTies {
    return roots.get(scope.rootGraphId)?.get(scope.owningGraphId) ?? NO_TIES
  }

  function getTies(scope: GraphScope): readonly LinkTie[] {
    return owned(scope).ties
  }

  /** The graph's ties indexed by the links they hold. */
  function getTiesByLink(
    scope: GraphScope
  ): ReadonlyMap<LinkId, readonly LinkTie[]> {
    return owned(scope).byLink
  }

  function setTies(scope: GraphScope, ties: readonly LinkTie[]): void {
    const owners = roots.get(scope.rootGraphId)
    const entry = indexTies(ties)
    if (ties.length && owners) owners.set(scope.owningGraphId, entry)
    else if (ties.length)
      roots.set(scope.rootGraphId, new Map([[scope.owningGraphId, entry]]))
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

  /** Takes the links out of their ties, dropping ties left empty. */
  function releaseLinks(scope: GraphScope, linkIds: Iterable<LinkId>): void {
    const { byLink, ties } = owned(scope)
    const released = new Set([...linkIds].filter((id) => byLink.has(id)))
    if (!released.size) return
    setTies(
      scope,
      relinkLinkTies(ties, (id) => (released.has(id) ? [] : [id]))
    )
  }

  function clearGraph(rootGraphId: RootGraphId): void {
    roots.delete(rootGraphId)
  }

  function clearOwner(scope: GraphScope): void {
    setTies(scope, [])
  }

  return {
    getTies,
    getTiesByLink,
    setTies,
    addTie,
    moveTie,
    removeTie,
    releaseLinks,
    clearGraph,
    clearOwner
  }
})
