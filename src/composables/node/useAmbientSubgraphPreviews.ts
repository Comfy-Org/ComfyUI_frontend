import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import type { PromotedPreview } from './usePromotedPreviews'
import { getPreviewMediaType } from './usePromotedPreviews'

/**
 * Synthetic `sourceWidgetName` for ambient previews, so they share
 * {@link PromotedPreview}'s shape (and the render list's dedup/key logic)
 * without implying a real promoted widget exists.
 */
const AMBIENT_PREVIEW_NAME = '$$ambient-preview'

/**
 * Live-execution previews for a SubgraphNode host, derived directly from
 * each interior node's own output/preview state.
 *
 * Deliberately independent of `previewExposureStore` and the link-promotion
 * system: it exists so any interior node currently producing output (e.g. a
 * second KSampler nobody promoted) still shows on the collapsed host, the
 * same way `nodeLocationProgressStates` bubbles up execution progress
 * regardless of promotion.
 */
export function useAmbientSubgraphPreviews(
  lgraphNode: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const nodeOutputStore = useNodeOutputStore()

  const ambientPreviews = computed((): PromotedPreview[] => {
    const node = toValue(lgraphNode)
    if (!(node instanceof SubgraphNode)) return []
    if (node.isDetached) return []

    const { subgraph } = node

    return subgraph.nodes.flatMap((interiorNode): PromotedPreview[] => {
      // Nested subgraph hosts derive their own previews independently.
      if (interiorNode instanceof SubgraphNode) return []
      if (interiorNode.hideOutputImages) return []

      const locatorId = createNodeLocatorId(subgraph.id, interiorNode.id)
      if (!locatorId) return []

      // Touch reactive sources for Vue tracking; getNodeImageUrls reads
      // non-reactive app state.
      const hasReactiveOutputs =
        nodeOutputStore.nodeOutputs[locatorId]?.images?.length ||
        nodeOutputStore.nodePreviewImages[locatorId]?.length
      if (!hasReactiveOutputs) return []

      const urls = nodeOutputStore.getNodeImageUrls(interiorNode)
      if (!urls?.length) return []

      return [
        {
          sourceNodeId: interiorNode.id,
          sourceWidgetName: AMBIENT_PREVIEW_NAME,
          type: getPreviewMediaType(interiorNode),
          urls
        }
      ]
    })
  })

  return { ambientPreviews }
}
