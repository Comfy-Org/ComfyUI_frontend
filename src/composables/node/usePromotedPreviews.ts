import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { usePromotionStore } from '@/stores/promotionStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'

interface PromotedPreview {
  sourceNodeId: string
  sourceWidgetName: string
  type: 'image' | 'video' | 'audio'
  urls: string[]
}

/**
 * Returns reactive preview media from promoted `$$` pseudo-widgets
 * on a SubgraphNode. Each promoted preview interior node produces
 * a separate entry so they render independently.
 */
export function usePromotedPreviews(
  lgraphNode: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const promotionStore = usePromotionStore()
  const nodeOutputStore = useNodeOutputStore()

  const promotedPreviews = computed((): PromotedPreview[] => {
    const node = toValue(lgraphNode)
    if (!(node instanceof SubgraphNode)) return []

    const entries = promotionStore.getPromotions(node.rootGraph.id, node.id)
    const pseudoEntries = entries.filter((e) =>
      e.sourceWidgetName.startsWith('$$')
    )
    if (!pseudoEntries.length) return []

    const previews: PromotedPreview[] = []

    for (const entry of pseudoEntries) {
      const interiorNode = node.subgraph.getNodeById(entry.sourceNodeId)
      if (!interiorNode) continue

      // Read from both reactive refs to establish Vue dependency
      // tracking. getNodeImageUrls reads from non-reactive
      // app.nodeOutputs / app.nodePreviewImages, so without this
      // access the computed would never re-evaluate.
      const locatorId = createNodeLocatorId(
        node.subgraph.id,
        entry.sourceNodeId
      )
      const reactiveOutputs = nodeOutputStore.nodeOutputs[locatorId]
      const reactivePreviews = nodeOutputStore.nodePreviewImages[locatorId]
      console.warn('[PROMOTED-PREVIEW]', {
        locatorId,
        hasOutputs: !!reactiveOutputs?.images?.length,
        hasPreviews: !!reactivePreviews?.length,
        entry
      })
      if (!reactiveOutputs?.images?.length && !reactivePreviews?.length)
        continue

      const urls = nodeOutputStore.getNodeImageUrls(interiorNode)
      console.warn(
        '[PROMOTED-PREVIEW] urls:',
        urls?.length,
        'type:',
        interiorNode.previewMediaType
      )
      if (!urls?.length) continue

      const type =
        interiorNode.previewMediaType === 'video'
          ? 'video'
          : interiorNode.previewMediaType === 'audio'
            ? 'audio'
            : 'image'

      previews.push({
        sourceNodeId: entry.sourceNodeId,
        sourceWidgetName: entry.sourceWidgetName,
        type,
        urls
      })
    }

    return previews
  })

  return { promotedPreviews }
}
