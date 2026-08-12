import { reactive } from 'vue'

import type { LinkId } from '@/lib/litegraph/src/LLink'

interface LinkVisibilityState {
  revealedLinkIds: Set<LinkId>
}

const state = reactive<LinkVisibilityState>({
  revealedLinkIds: new Set()
})

export function setRevealedLinks(linkIds: Iterable<LinkId>): boolean {
  const next = new Set(linkIds)
  if (
    next.size === state.revealedLinkIds.size &&
    [...next].every((id) => state.revealedLinkIds.has(id))
  ) {
    return false
  }

  state.revealedLinkIds = next
  return true
}

export function isLinkRevealed(linkId: LinkId): boolean {
  return state.revealedLinkIds.has(linkId)
}
