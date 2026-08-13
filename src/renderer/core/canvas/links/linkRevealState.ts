import type { LinkId } from '@/lib/litegraph/src/LLink'

let revealedLinkIds: ReadonlySet<LinkId> = new Set()

export function setRevealedLinks(linkIds: Iterable<LinkId>): boolean {
  const next = new Set(linkIds)
  if (
    next.size === revealedLinkIds.size &&
    [...next].every((id) => revealedLinkIds.has(id))
  ) {
    return false
  }

  revealedLinkIds = next
  return true
}

export function addRevealedLinks(linkIds: Iterable<LinkId>): boolean {
  const next = new Set(revealedLinkIds)
  for (const linkId of linkIds) next.add(linkId)
  return setRevealedLinks(next)
}

export function removeRevealedLinks(linkIds: Iterable<LinkId>): boolean {
  const next = new Set(revealedLinkIds)
  for (const linkId of linkIds) next.delete(linkId)
  return setRevealedLinks(next)
}

export function isLinkRevealed(linkId: LinkId): boolean {
  return revealedLinkIds.has(linkId)
}
