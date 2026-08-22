import { onScopeDispose } from 'vue'

import {
  addRevealedLinks,
  removeRevealedLinks
} from '@/renderer/core/canvas/links/linkRevealState'
import { app } from '@/scripts/app'
import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'

interface SlotLinkRevealOptions {
  nodeId?: NodeId
  index: number
  type: 'input' | 'output'
}

export function useSlotLinkReveal(options: SlotLinkRevealOptions) {
  let ownedLinkIds: ReadonlySet<LinkId> = new Set()

  function hiddenLinkIds() {
    const graph = app.canvas?.graph
    if (!graph || options.nodeId === undefined) return []

    return [...graph.links.values()]
      .filter((link) => link.hidden)
      .filter((link) =>
        options.type === 'output'
          ? link.origin_id === options.nodeId &&
            link.origin_slot === options.index
          : link.target_id === options.nodeId &&
            link.target_slot === options.index
      )
      .map((link) => link.id)
  }

  function revealLinks(): void {
    ownedLinkIds = new Set(hiddenLinkIds())
    if (addRevealedLinks(ownedLinkIds)) app.canvas?.setDirty(false, true)
  }

  function unrevealLinks(): void {
    if (removeRevealedLinks(ownedLinkIds)) app.canvas?.setDirty(false, true)
    ownedLinkIds = new Set()
  }

  onScopeDispose(unrevealLinks)

  return { revealLinks, unrevealLinks }
}
