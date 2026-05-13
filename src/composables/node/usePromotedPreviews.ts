import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'

interface PromotedPreview {
  /** Source node id resolved on the host's interior subgraph. */
  sourceNodeId: string
  /** Canonical preview name on the source widget (typically `$$`-prefixed). */
  sourceWidgetName: string
  type: 'image' | 'video' | 'audio'
  urls: string[]
}

const PREVIEW_TYPES_BY_MEDIA = {
  video: 'video',
  audio: 'audio'
} as const satisfies Partial<Record<string, PromotedPreview['type']>>

function getPreviewMediaType(node: LGraphNode): PromotedPreview['type'] {
  const media = node.previewMediaType
  if (media && media in PREVIEW_TYPES_BY_MEDIA) {
    return PREVIEW_TYPES_BY_MEDIA[media as keyof typeof PREVIEW_TYPES_BY_MEDIA]
  }
  return 'image'
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

  /**
   * Returns the exposures registered under `primaryLocator`. Falls back to
   * `legacyLocators` (in order); on first hit, copies them onto the primary
   * key so subsequent reads find them directly.
   */
  function loadOrMigrateExposures(
    rootGraphId: UUID,
    primaryLocator: string,
    ...legacyLocators: string[]
  ): readonly PreviewExposure[] {
    const primary = previewExposureStore.getExposures(
      rootGraphId,
      primaryLocator
    )
    if (primary.length) return primary
    for (const legacy of legacyLocators) {
      const found = previewExposureStore.getExposures(rootGraphId, legacy)
      if (!found.length) continue
      previewExposureStore.setExposures(rootGraphId, primaryLocator, found)
      return found
    }
    return primary
  }

  /**
   * Reads from reactive output sources to establish Vue dependency tracking,
   * then returns the resolved image URLs (or undefined when nothing is
   * available). `getNodeImageUrls` itself reads from non-reactive
   * `app.nodeOutputs` / `app.nodePreviewImages`, so without these reads the
   * computed would never re-evaluate.
   */
  function readReactivePreviewUrls(
    leafHost: SubgraphNode,
    leafSourceNodeId: string,
    leafExecutionId: string,
    interiorNode: LGraphNode
  ): string[] | undefined {
    const locatorId = createNodeLocatorId(
      leafHost.subgraph.id,
      leafSourceNodeId
    )
    const reactiveOutputs = nodeOutputStore.nodeOutputs[locatorId]
    const reactivePreviews = nodeOutputStore.nodePreviewImages[locatorId]
    const reactiveExecutionOutputs =
      nodeOutputStore.getNodeOutputByExecutionId?.(leafExecutionId)
    const reactiveExecutionPreviews =
      nodeOutputStore.getNodePreviewImagesByExecutionId?.(leafExecutionId)
    const hasAnySource =
      reactiveOutputs?.images?.length ||
      reactivePreviews?.length ||
      reactiveExecutionOutputs?.images?.length ||
      reactiveExecutionPreviews?.length
    if (!hasAnySource) return undefined
    return (
      nodeOutputStore.getNodeImageUrlsByExecutionId?.(
        leafExecutionId,
        interiorNode
      ) ?? nodeOutputStore.getNodeImageUrls(interiorNode)
    )
  }

  const promotedPreviews = computed((): PromotedPreview[] => {
    const node = toValue(lgraphNode)
    if (!(node instanceof SubgraphNode)) return []

    const rootGraphId = node.rootGraph.id
    const hostLocator = String(node.id)
    const exposures = loadOrMigrateExposures(
      rootGraphId,
      hostLocator,
      createNodeLocatorId(rootGraphId, node.id)
    )
    if (!exposures.length) return []

    const hostNodesByLocator = new Map<string, SubgraphNode>([
      [hostLocator, node]
    ])

    function resolveNestedHost(
      rootGraphId: UUID,
      currentHostLocator: string,
      sourceNodeId: string
    ) {
      const currentHost = hostNodesByLocator.get(currentHostLocator)
      const sourceNode = currentHost?.subgraph.getNodeById(sourceNodeId)
      if (!(sourceNode instanceof SubgraphNode)) return undefined

      const nestedHostLocator = `${currentHostLocator}:${sourceNode.id}`
      hostNodesByLocator.set(nestedHostLocator, sourceNode)
      loadOrMigrateExposures(
        rootGraphId,
        nestedHostLocator,
        String(sourceNode.id),
        createNodeLocatorId(rootGraphId, sourceNode.id)
      )
      return { rootGraphId, hostNodeLocator: nestedHostLocator }
    }

    return exposures.flatMap((exposure): PromotedPreview[] => {
      const resolved = previewExposureStore.resolveChain(
        rootGraphId,
        hostLocator,
        exposure.name,
        resolveNestedHost
      )
      const leaf = resolved?.leaf ?? {
        sourceNodeId: exposure.sourceNodeId,
        sourcePreviewName: exposure.sourcePreviewName
      }
      const leafHostLocator =
        resolved?.steps.at(-1)?.hostNodeLocator ?? hostLocator
      const leafHost = hostNodesByLocator.get(leafHostLocator) ?? node
      const interiorNode = leafHost.subgraph.getNodeById(leaf.sourceNodeId)
      if (!interiorNode) return []

      const urls = readReactivePreviewUrls(
        leafHost,
        leaf.sourceNodeId,
        `${leafHostLocator}:${leaf.sourceNodeId}`,
        interiorNode
      )
      if (!urls?.length) return []

      return [
        {
          sourceNodeId: leaf.sourceNodeId,
          sourceWidgetName: leaf.sourcePreviewName,
          type: getPreviewMediaType(interiorNode),
          urls
        }
      ]
    })
  })

  return { promotedPreviews }
}
