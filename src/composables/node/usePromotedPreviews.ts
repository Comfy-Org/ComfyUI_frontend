import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { usePromotionStore } from '@/stores/promotionStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'

interface PromotedPreview {
  /** Source node id resolved on the host's interior subgraph. */
  sourceNodeId: string
  /** Canonical preview name on the source widget (typically `$$`-prefixed). */
  sourceWidgetName: string
  type: 'image' | 'video' | 'audio'
  urls: string[]
}

/**
 * Returns reactive preview media exposed by a host SubgraphNode.
 *
 * Reads first from the host-scoped {@link usePreviewExposureStore} (the
 * canonical post-ADR-0009 source). Falls back to the legacy promotion-store
 * `$$`-prefixed entries when no exposures have been migrated yet — the
 * configure-time flush will normalize both into the exposure store on next
 * load.
 */
export function usePromotedPreviews(
  lgraphNode: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const previewExposureStore = usePreviewExposureStore()
  const promotionStore = usePromotionStore()
  const nodeOutputStore = useNodeOutputStore()

  const promotedPreviews = computed((): PromotedPreview[] => {
    const node = toValue(lgraphNode)
    if (!(node instanceof SubgraphNode)) return []

    const rootGraphId = node.rootGraph.id
    const hostLocator = createNodeLocatorId(rootGraphId, node.id)

    const exposures = previewExposureStore.getExposures(
      rootGraphId,
      hostLocator
    )

    const exposurePairs = exposures.length
      ? exposures.map((exposure) => ({
          sourceNodeId: exposure.sourceNodeId,
          sourceWidgetName: exposure.sourcePreviewName
        }))
      : promotionStore
          .getPromotions(rootGraphId, node.id)
          .filter((entry) => entry.sourceWidgetName.startsWith('$$'))
          .map((entry) => ({
            sourceNodeId: entry.sourceNodeId,
            sourceWidgetName: entry.sourceWidgetName
          }))

    if (!exposurePairs.length) return []

    const previews: PromotedPreview[] = []

    for (const pair of exposurePairs) {
      const interiorNode = node.subgraph.getNodeById(pair.sourceNodeId)
      if (!interiorNode) continue

      // Read from both reactive refs to establish Vue dependency
      // tracking. getNodeImageUrls reads from non-reactive
      // app.nodeOutputs / app.nodePreviewImages, so without this
      // access the computed would never re-evaluate.
      const locatorId = createNodeLocatorId(node.subgraph.id, pair.sourceNodeId)
      const reactiveOutputs = nodeOutputStore.nodeOutputs[locatorId]
      const reactivePreviews = nodeOutputStore.nodePreviewImages[locatorId]
      if (!reactiveOutputs?.images?.length && !reactivePreviews?.length)
        continue

      const urls = nodeOutputStore.getNodeImageUrls(interiorNode)
      if (!urls?.length) continue

      const type =
        interiorNode.previewMediaType === 'video'
          ? 'video'
          : interiorNode.previewMediaType === 'audio'
            ? 'audio'
            : 'image'

      previews.push({
        sourceNodeId: pair.sourceNodeId,
        sourceWidgetName: pair.sourceWidgetName,
        type,
        urls
      })
    }

    return previews
  })

  return { promotedPreviews }
}
