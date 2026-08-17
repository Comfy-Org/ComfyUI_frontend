import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
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
 * each interior node's own streaming preview state.
 *
 * Deliberately independent of `previewExposureStore` and the link-promotion
 * system: it exists so any interior node currently producing a live preview
 * (e.g. a second KSampler nobody promoted) still shows on the expanded host,
 * loosely analogous to how `nodeLocationProgressStates` bubbles up execution
 * progress regardless of promotion — though unlike that store, this only
 * looks at the host's immediate interior nodes and does not recurse into
 * nested subgraphs.
 */
export function useAmbientSubgraphPreviews(
  lgraphNode: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const nodeOutputStore = useNodeOutputStore()
  const previewExposureStore = usePreviewExposureStore()

  const ambientPreviews = computed((): PromotedPreview[] => {
    const node = toValue(lgraphNode)
    if (!(node instanceof SubgraphNode)) return []
    if (node.isDetached) return []

    const { subgraph } = node
    const suppressedNodeIds = previewExposureStore.getSuppressedAmbientNodeIds(
      node.rootGraph.id,
      String(node.id)
    )

    // `subgraph.nodes` (`LGraph._nodes`) is a plain, non-reactive array, so
    // interior node add/remove while collapsed isn't tracked here; the next
    // WS preview frame (nodeOutputs/nodePreviewImages change) self-heals it.
    return subgraph.nodes.flatMap((interiorNode): PromotedPreview[] => {
      // Nested subgraph hosts derive their own previews independently.
      if (interiorNode instanceof SubgraphNode) return []
      if (interiorNode.hideOutputImages) return []
      if (suppressedNodeIds.has(interiorNode.id)) return []

      const locatorId = createNodeLocatorId(subgraph.id, interiorNode.id)
      if (!locatorId) return []

      // Only ever populated by live execution/streaming frames, never by
      // static input data, so no isInputPreviewOutput-style guard is needed.
      if (!nodeOutputStore.nodePreviewImages[locatorId]?.length) return []

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
