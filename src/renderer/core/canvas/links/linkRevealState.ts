/**
 * Transient hidden-link reveal state, scoped by root graph and reference-
 * counted per owner token. Each reveal source (a canvas, a Vue slot scope)
 * holds its own set of revealed links; a link stays revealed while any owner
 * holds it, so one source releasing cannot clear another source's reveal, and
 * equal link ids in different workflows never collide.
 */
import type { LinkId } from '@/lib/litegraph/src/LLink'

type OwnerToken = object

const EMPTY: ReadonlySet<LinkId> = new Set()

const revealCounts = new Map<string, Map<LinkId, number>>()
const ownerHoldings = new Map<OwnerToken, Map<string, ReadonlySet<LinkId>>>()

function acquire(rootId: string, linkId: LinkId): boolean {
  let counts = revealCounts.get(rootId)
  if (!counts) {
    counts = new Map()
    revealCounts.set(rootId, counts)
  }
  const next = (counts.get(linkId) ?? 0) + 1
  counts.set(linkId, next)
  return next === 1
}

function release(rootId: string, linkId: LinkId): boolean {
  const counts = revealCounts.get(rootId)
  const current = counts?.get(linkId)
  if (!counts || current === undefined) return false
  if (current > 1) {
    counts.set(linkId, current - 1)
    return false
  }
  counts.delete(linkId)
  if (counts.size === 0) revealCounts.delete(rootId)
  return true
}

/**
 * Replaces the links `owner` reveals in `rootId` with `linkIds`.
 * @returns `true` when the effective revealed set changed.
 */
export function setRevealedLinks(
  rootId: string,
  linkIds: Iterable<LinkId>,
  owner: OwnerToken
): boolean {
  const next = new Set(linkIds)
  const holdings = ownerHoldings.get(owner)
  const previous = holdings?.get(rootId) ?? EMPTY
  if (
    next.size === previous.size &&
    [...next].every((id) => previous.has(id))
  ) {
    return false
  }

  let changed = false
  for (const id of previous) {
    if (!next.has(id) && release(rootId, id)) changed = true
  }
  for (const id of next) {
    if (!previous.has(id) && acquire(rootId, id)) changed = true
  }

  if (next.size === 0) {
    holdings?.delete(rootId)
    if (holdings?.size === 0) ownerHoldings.delete(owner)
  } else {
    const target = holdings ?? new Map<string, ReadonlySet<LinkId>>()
    target.set(rootId, next)
    ownerHoldings.set(owner, target)
  }
  return changed
}

/**
 * Releases every reveal `owner` holds, across all roots.
 * @returns `true` when the effective revealed set changed.
 */
export function clearRevealedLinks(owner: OwnerToken): boolean {
  const holdings = ownerHoldings.get(owner)
  if (!holdings) return false
  let changed = false
  for (const [rootId, linkIds] of holdings) {
    for (const id of linkIds) {
      if (release(rootId, id)) changed = true
    }
  }
  ownerHoldings.delete(owner)
  return changed
}

/** Clears all reveal state across roots and owners; test bootstrap only. */
export function resetLinkReveals(): void {
  revealCounts.clear()
  ownerHoldings.clear()
}

export function isLinkRevealed(rootId: string, linkId: LinkId): boolean {
  return (revealCounts.get(rootId)?.get(linkId) ?? 0) > 0
}
