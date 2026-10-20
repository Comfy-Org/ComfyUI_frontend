import type { RootGraphId } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

interface ActiveReveal {
  owner: object
  linkIds: ReadonlySet<LinkId>
}

const revealsBySource = {
  hover: new Map<RootGraphId, ActiveReveal>(),
  drag: new Map<RootGraphId, ActiveReveal>()
}

function setsEqual(first: ReadonlySet<LinkId>, second: ReadonlySet<LinkId>) {
  return (
    first.size === second.size &&
    [...first].every((linkId) => second.has(linkId))
  )
}

export function setRevealedLinks(
  rootGraphId: RootGraphId,
  linkIds: Iterable<LinkId>,
  owner: object,
  source: 'hover' | 'drag' = 'hover'
): boolean {
  const next = new Set(linkIds)
  if (next.size === 0) return clearRevealedLinks(owner)

  const revealsByRoot = revealsBySource[source]
  const previous = revealsByRoot.get(rootGraphId)
  revealsByRoot.set(rootGraphId, { owner, linkIds: next })
  return !previous || !setsEqual(previous.linkIds, next)
}

export function clearRevealedLinks(owner: object): boolean {
  let changed = false
  for (const revealsByRoot of Object.values(revealsBySource)) {
    for (const [rootGraphId, reveal] of revealsByRoot) {
      if (reveal.owner !== owner) continue
      revealsByRoot.delete(rootGraphId)
      changed = true
    }
  }
  return changed
}

export function clearRootLinkReveals(rootGraphId: RootGraphId): boolean {
  const hoverCleared = revealsBySource.hover.delete(rootGraphId)
  const dragCleared = revealsBySource.drag.delete(rootGraphId)
  return hoverCleared || dragCleared
}

export function isLinkRevealed(
  rootGraphId: RootGraphId,
  linkId: LinkId
): boolean {
  return (
    revealsBySource.hover.get(rootGraphId)?.linkIds.has(linkId) === true ||
    revealsBySource.drag.get(rootGraphId)?.linkIds.has(linkId) === true
  )
}
