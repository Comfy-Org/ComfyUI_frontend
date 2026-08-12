import { setRevealedLinks } from '@/renderer/core/canvas/links/linkVisibilityState'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

interface SlotNoodlePreviewOptions {
  nodeId?: NodeId
  index: number
  type: 'input' | 'output'
}

export function useSlotNoodlePreview(options: SlotNoodlePreviewOptions) {
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

  function revealNoodles(): void {
    if (setRevealedLinks(hiddenLinkIds())) app.canvas?.setDirty(false, true)
  }

  function hideNoodles(): void {
    if (setRevealedLinks([])) app.canvas?.setDirty(false, true)
  }

  return { revealNoodles, hideNoodles }
}
