import { onScopeDispose } from 'vue'

import {
  clearRevealedLinks,
  setRevealedLinks
} from '@/lib/litegraph/src/canvas/linkRevealState'
import { app } from '@/scripts/app'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'

interface SlotLinkRevealOptions {
  nodeId?: NodeId
  index: number
  type: 'input' | 'output'
}

export function useSlotLinkReveal(options: SlotLinkRevealOptions) {
  const owner = {}

  function revealLinks(): void {
    const graph = app.canvas.graph
    if (!graph || options.nodeId === undefined) return

    const scope = graphScopeOf(graph)
    const linkStore = useLinkStore()
    const presentationStore = useLinkPresentationStore()
    const links =
      options.type === 'output'
        ? [
            ...linkStore.getOutputSlotLinks(
              scope,
              options.nodeId,
              options.index
            )
          ]
        : [linkStore.getInputSlotLink(scope, options.nodeId, options.index)]
    const linkIds = links.flatMap((link) =>
      link && presentationStore.getPresentation(scope, link.id)?.hidden
        ? [link.id]
        : []
    )
    if (setRevealedLinks(scope.rootGraphId, linkIds, owner)) {
      app.canvas.setDirty(false, true)
    }
  }

  function unrevealLinks(): void {
    if (clearRevealedLinks(owner)) app.canvas.setDirty(false, true)
  }

  onScopeDispose(unrevealLinks)

  return { revealLinks, unrevealLinks }
}
