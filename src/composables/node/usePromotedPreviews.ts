import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

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
 * Reads from the host-scoped {@link usePreviewExposureStore}, the canonical
 * post-ADR-0009 source for display-only preview promotion.
 */
export function usePromotedPreviews(
  lgraphNode: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const previewExposureStore = usePreviewExposureStore()
  const nodeOutputStore = useNodeOutputStore()

  const promotedPreviews = computed((): PromotedPreview[] => {
    const node = toValue(lgraphNode)
    if (!(node instanceof SubgraphNode)) return []

    const rootGraphId = node.rootGraph.id
    const hostLocator = String(node.id)
    const legacyHostLocator = createNodeLocatorId(rootGraphId, node.id)

    const instanceExposures = previewExposureStore.getExposures(
      rootGraphId,
      hostLocator
    )
    let exposures = instanceExposures
    if (!exposures.length) {
      const legacyExposures = previewExposureStore.getExposures(
        rootGraphId,
        legacyHostLocator
      )
      if (legacyExposures.length) {
        previewExposureStore.setExposures(
          rootGraphId,
          hostLocator,
          legacyExposures
        )
        exposures = legacyExposures
      }
    }

    const exposurePairs = exposures.map((exposure) => ({
      exposureName: exposure.name,
      sourceNodeId: exposure.sourceNodeId,
      sourceWidgetName: exposure.sourcePreviewName
    }))

    if (!exposurePairs.length) return []

    const previews: PromotedPreview[] = []
    const hostNodesByLocator = new Map<string, SubgraphNode>([
      [hostLocator, node]
    ])

    const resolveNestedHost = (
      rootGraphId: UUID,
      currentHostLocator: string,
      sourceNodeId: string
    ) => {
      const currentHost = hostNodesByLocator.get(currentHostLocator)
      const sourceNode = currentHost?.subgraph.getNodeById(sourceNodeId)
      if (!(sourceNode instanceof SubgraphNode)) return undefined

      const nestedHostLocator = `${currentHostLocator}:${sourceNode.id}`
      const legacyNestedHostLocator = createNodeLocatorId(
        rootGraphId,
        sourceNode.id
      )
      const nestedExposures = previewExposureStore.getExposures(
        rootGraphId,
        nestedHostLocator
      )
      if (!nestedExposures.length) {
        const definitionExposures = previewExposureStore.getExposures(
          rootGraphId,
          String(sourceNode.id)
        )
        const legacyExposures = definitionExposures.length
          ? definitionExposures
          : previewExposureStore.getExposures(
              rootGraphId,
              legacyNestedHostLocator
            )
        if (legacyExposures.length) {
          previewExposureStore.setExposures(
            rootGraphId,
            nestedHostLocator,
            legacyExposures
          )
        }
      }
      hostNodesByLocator.set(nestedHostLocator, sourceNode)
      return { rootGraphId, hostNodeLocator: nestedHostLocator }
    }

    for (const pair of exposurePairs) {
      const resolved = previewExposureStore.resolveChain(
        rootGraphId,
        hostLocator,
        pair.exposureName,
        resolveNestedHost
      )
      const leaf = resolved?.leaf ?? {
        sourceNodeId: pair.sourceNodeId,
        sourcePreviewName: pair.sourceWidgetName
      }
      const leafHostLocator =
        resolved?.steps.at(-1)?.hostNodeLocator ?? hostLocator
      const leafHost = hostNodesByLocator.get(leafHostLocator) ?? node
      const interiorNode = leafHost.subgraph.getNodeById(leaf.sourceNodeId)
      if (!interiorNode) continue

      // Read from reactive refs to establish Vue dependency tracking.
      // getNodeImageUrls reads from non-reactive app.nodeOutputs /
      // app.nodePreviewImages, so without this access the computed
      // would never re-evaluate.
      const locatorId = createNodeLocatorId(
        leafHost.subgraph.id,
        leaf.sourceNodeId
      )
      const reactiveOutputs = nodeOutputStore.nodeOutputs[locatorId]
      const reactivePreviews = nodeOutputStore.nodePreviewImages[locatorId]
      const leafExecutionId = `${leafHostLocator}:${leaf.sourceNodeId}`
      const reactiveExecutionOutputs =
        nodeOutputStore.getNodeOutputByExecutionId?.(leafExecutionId)
      const reactiveExecutionPreviews =
        nodeOutputStore.getNodePreviewImagesByExecutionId?.(leafExecutionId)
      if (
        !reactiveOutputs?.images?.length &&
        !reactivePreviews?.length &&
        !reactiveExecutionOutputs?.images?.length &&
        !reactiveExecutionPreviews?.length
      )
        continue

      const urls =
        nodeOutputStore.getNodeImageUrlsByExecutionId?.(
          leafExecutionId,
          interiorNode
        ) ?? nodeOutputStore.getNodeImageUrls(interiorNode)
      if (!urls?.length) continue

      const type =
        interiorNode.previewMediaType === 'video'
          ? 'video'
          : interiorNode.previewMediaType === 'audio'
            ? 'audio'
            : 'image'

      previews.push({
        sourceNodeId: leaf.sourceNodeId,
        sourceWidgetName: leaf.sourcePreviewName,
        type,
        urls
      })
    }

    return previews
  })

  return { promotedPreviews }
}
