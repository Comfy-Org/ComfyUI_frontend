import { onScopeDispose } from 'vue'

import {
  clearRevealedLinks,
  setRevealedLinks
} from '@/renderer/core/canvas/links/linkRevealState'
import { app } from '@/scripts/app'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'

interface SlotLinkRevealOptions {
  nodeId?: NodeId
  index: number
  type: 'input' | 'output'
}

export function useSlotLinkReveal(options: SlotLinkRevealOptions) {
  const owner = {}

  function hiddenLinkIds() {
    const graph = app.canvas?.graph
    if (!graph || options.nodeId === undefined) return []

    return useLinkPresentationStore()
      .graphHiddenLinkIds(graphScopeOf(graph))
      .filter((linkId) => {
        const link = graph.getLink(linkId)
        if (!link) return false
        return options.type === 'output'
          ? link.origin_id === options.nodeId &&
              link.origin_slot === options.index
          : link.target_id === options.nodeId &&
              link.target_slot === options.index
      })
  }

  function revealLinks(): void {
    const rootGraphId = app.canvas?.graph?.rootGraph.id
    if (rootGraphId === undefined) return
    if (setRevealedLinks(rootGraphId, hiddenLinkIds(), owner)) {
      app.canvas?.setDirty(false, true)
    }
  }

  function unrevealLinks(): void {
    if (clearRevealedLinks(owner)) app.canvas?.setDirty(false, true)
  }

  onScopeDispose(unrevealLinks)

  return { revealLinks, unrevealLinks }
}
