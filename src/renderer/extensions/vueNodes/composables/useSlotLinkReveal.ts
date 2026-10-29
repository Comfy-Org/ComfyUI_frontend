import { onScopeDispose } from 'vue'

import {
  clearRevealedLinks,
  setRevealedLinks
} from '@comfyorg/litegraph/canvas/linkRevealState'
import type { LinkRevealKind } from '@comfyorg/litegraph/canvas/linkRevealState'
import { app } from '@/scripts/app'
import { useLinkPresentationStore } from '@comfyorg/graph-state/linkPresentationStore'
import { useLinkStore } from '@comfyorg/graph-state/linkStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

interface SlotLinkRevealOptions {
  nodeId?: NodeId
  index: number
  type: 'input' | 'output'
  kind?: LinkRevealKind
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
    if (setRevealedLinks(scope.rootGraphId, linkIds, owner, options.kind)) {
      app.canvas.setDirty(false, true)
    }
  }

  function unrevealLinks(): void {
    if (clearRevealedLinks(owner)) app.canvas.setDirty(false, true)
  }

  onScopeDispose(unrevealLinks)

  return { revealLinks, unrevealLinks }
}
