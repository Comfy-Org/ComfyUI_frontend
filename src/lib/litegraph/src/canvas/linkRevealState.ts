import type { RootGraphId } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

interface ActiveReveal {
  owner: object
  linkIds: ReadonlySet<LinkId>
}

const revealsByRoot = new Map<RootGraphId, ActiveReveal>()

function setsEqual(first: ReadonlySet<LinkId>, second: ReadonlySet<LinkId>) {
  return (
    first.size === second.size &&
    [...first].every((linkId) => second.has(linkId))
  )
}

export function setRevealedLinks(
  rootGraphId: RootGraphId,
  linkIds: Iterable<LinkId>,
  owner: object
): boolean {
  const next = new Set(linkIds)
  if (next.size === 0) return clearRevealedLinks(owner)

  const previous = revealsByRoot.get(rootGraphId)
  revealsByRoot.set(rootGraphId, { owner, linkIds: next })
  return !previous || !setsEqual(previous.linkIds, next)
}

export function clearRevealedLinks(owner: object): boolean {
  let changed = false
  for (const [rootGraphId, reveal] of revealsByRoot) {
    if (reveal.owner !== owner) continue
    revealsByRoot.delete(rootGraphId)
    changed = true
  }
  return changed
}

export function clearRootLinkReveals(rootGraphId: RootGraphId): boolean {
  return revealsByRoot.delete(rootGraphId)
}

export function isLinkRevealed(
  rootGraphId: RootGraphId,
  linkId: LinkId
): boolean {
  return revealsByRoot.get(rootGraphId)?.linkIds.has(linkId) ?? false
}
