import { setRevealedLinks } from '@/lib/litegraph/src/canvas/linkBadges'
import type { LinkId } from '@/lib/litegraph/src/LLink'
import { app } from '@/scripts/app'

interface SlotNoodlePreviewOptions {
  nodeId: string
  index: number
  type: 'input' | 'output'
}

/**
 * Reveals the noodles of a slot's hidden links while it is hovered. Socket hover
 * lives in Vue (the dots are DOM, not canvas), so this is the slot-side analogue
 * of the badge hover handled in `LGraphCanvas.processMouseMove`.
 */
export function useSlotNoodlePreview(options: SlotNoodlePreviewOptions) {
  function hiddenLinkIds(): LinkId[] {
    const graph = app.canvas?.graph
    const node = graph?.getNodeById(options.nodeId)
    if (!graph || !node) return []
    // Derive from the links themselves rather than `slot.links`/`slot.link`,
    // which can miss links created through dynamic/autogrow inputs.
    const ids: LinkId[] = []
    for (const link of graph.links.values()) {
      if (!link.hidden) continue
      const onSlot =
        options.type === 'output'
          ? link.origin_id === node.id && link.origin_slot === options.index
          : link.target_id === node.id && link.target_slot === options.index
      if (onSlot) ids.push(link.id)
    }
    return ids
  }

  function revealNoodles(): void {
    if (setRevealedLinks(hiddenLinkIds())) app.canvas?.setDirty(false, true)
  }

  function hideNoodles(): void {
    if (setRevealedLinks([])) app.canvas?.setDirty(false, true)
  }

  return { revealNoodles, hideNoodles }
}
