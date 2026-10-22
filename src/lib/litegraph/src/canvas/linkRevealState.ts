import type { RootGraphId } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

interface ActiveReveal {
  owner: object
  linkIds: ReadonlySet<LinkId>
}

const revealsByKind = {
  hover: new Map<RootGraphId, ActiveReveal>(),
  drag: new Map<RootGraphId, ActiveReveal>()
} as const

export type LinkRevealKind = keyof typeof revealsByKind

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
  kind: LinkRevealKind = 'hover'
): boolean {
  const next = new Set(linkIds)
  if (next.size === 0) return clearRevealedLinks(owner)

  const revealsByRoot = revealsByKind[kind]
  const previous = revealsByRoot.get(rootGraphId)
  revealsByRoot.set(rootGraphId, { owner, linkIds: next })
  return !previous || !setsEqual(previous.linkIds, next)
}

export function clearRevealedLinks(owner: object): boolean {
  let changed = false
  for (const revealsByRoot of Object.values(revealsByKind)) {
    for (const [rootGraphId, reveal] of revealsByRoot) {
      if (reveal.owner !== owner) continue
      revealsByRoot.delete(rootGraphId)
      changed = true
    }
  }
  return changed
}

export function clearRootLinkReveals(rootGraphId: RootGraphId): boolean {
  const hoverCleared = revealsByKind.hover.delete(rootGraphId)
  const dragCleared = revealsByKind.drag.delete(rootGraphId)
  return hoverCleared || dragCleared
}

export function isLinkRevealed(
  rootGraphId: RootGraphId,
  linkId: LinkId
): boolean {
  return (
    revealsByKind.hover.get(rootGraphId)?.linkIds.has(linkId) === true ||
    revealsByKind.drag.get(rootGraphId)?.linkIds.has(linkId) === true
  )
}
