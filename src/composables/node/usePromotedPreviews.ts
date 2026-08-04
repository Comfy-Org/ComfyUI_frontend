import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import { CANVAS_IMAGE_PREVIEW_WIDGET } from '@/composables/node/canvasImagePreviewTypes'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import type { UUID } from '@/utils/uuid'
import { isVideoOutput } from '@/utils/litegraphUtil'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import type { NodeId } from '@/types/nodeId'
import {
  appendNodeExecutionId,
  createNodeLocatorId
} from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'

interface PromotedPreview {
  sourceNodeId: NodeId
  sourceWidgetName: string
  type: 'image' | 'video' | 'audio'
  urls: string[]
}

const PREVIEW_TYPES_BY_MEDIA = {
  video: 'video',
  audio: 'audio'
} as const satisfies Partial<Record<string, PromotedPreview['type']>>

function getPreviewMediaType(
  node: LGraphNode,
  output: ExecutedWsMessage['output'] | undefined
): PromotedPreview['type'] {
  if (isVideoOutput(output)) return 'video'

  const media = node.previewMediaType
  if (media && media in PREVIEW_TYPES_BY_MEDIA) {
    return PREVIEW_TYPES_BY_MEDIA[media as keyof typeof PREVIEW_TYPES_BY_MEDIA]
  }
  return 'image'
}

export function usePromotedPreviews(
  lgraphNode: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const previewExposureStore = usePreviewExposureStore()
  const nodeOutputStore = useNodeOutputStore()

  /** Touches reactive sources for Vue tracking; `getNodeImageUrls` reads non-reactive app state. */
  function readReactivePreviewUrls(
    leafHost: SubgraphNode,
    leafSourceNodeId: NodeId,
    leafExecutionId: NodeExecutionId,
    interiorNode: LGraphNode,
    { liveOnly = false }: { liveOnly?: boolean } = {}
  ): string[] | undefined {
    const locatorId = createNodeLocatorId(
      leafHost.subgraph.id,
      leafSourceNodeId
    )
    if (!locatorId) return undefined

    const reactivePreviews = nodeOutputStore.nodePreviewImages[locatorId]
    const reactiveExecutionPreviews =
      nodeOutputStore.getNodePreviewImagesByExecutionId(leafExecutionId)
    const hasLiveSource =
      reactivePreviews?.length || reactiveExecutionPreviews?.length

    if (liveOnly) {
      if (!hasLiveSource) return undefined
    } else {
      const reactiveOutputs = nodeOutputStore.nodeOutputs[locatorId]
      const reactiveExecutionOutputs =
        nodeOutputStore.getNodeOutputByExecutionId(leafExecutionId)
      const hasAnySource =
        hasLiveSource ||
        reactiveOutputs?.images?.length ||
        reactiveExecutionOutputs?.images?.length
      if (!hasAnySource) return undefined
    }

    return (
      nodeOutputStore.getNodeImageUrlsByExecutionId(
        leafExecutionId,
        interiorNode
      ) ?? nodeOutputStore.getNodeImageUrls(interiorNode)
    )
  }

  function readOutputForMediaType(
    leafHost: SubgraphNode,
    leafSourceNodeId: NodeId,
    leafExecutionId: NodeExecutionId
  ): ExecutedWsMessage['output'] | undefined {
    const byExecutionId =
      nodeOutputStore.getNodeOutputByExecutionId(leafExecutionId)
    if (byExecutionId) return byExecutionId

    const locatorId = createNodeLocatorId(
      leafHost.subgraph.id,
      leafSourceNodeId
    )
    return locatorId ? nodeOutputStore.nodeOutputs[locatorId] : undefined
  }

  const promotedPreviews = computed((): PromotedPreview[] => {
    const node = toValue(lgraphNode)
    if (!(node instanceof SubgraphNode)) return []
    if (node.isDetached) return []

    const rootGraphId = node.rootGraph.id
    const hostLocator = String(node.id)
    const exposures = previewExposureStore.getExposures(
      rootGraphId,
      hostLocator
    )

    const hostNodesByLocator = new Map<string, SubgraphNode>([
      [hostLocator, node]
    ])

    function resolveNestedHost(
      rootGraphId: UUID,
      currentHostLocator: string,
      sourceNodeId: NodeId
    ) {
      const currentHost = hostNodesByLocator.get(currentHostLocator)
      const sourceNode = currentHost?.subgraph.getNodeById(sourceNodeId)
      if (!(sourceNode instanceof SubgraphNode)) return undefined

      const pathLocator = `${currentHostLocator}:${sourceNode.id}`
      const definitionLocator = String(sourceNode.id)
      const hasPathExposures =
        previewExposureStore.getExposures(rootGraphId, pathLocator).length > 0
      const nestedHostLocator = hasPathExposures
        ? pathLocator
        : definitionLocator
      hostNodesByLocator.set(nestedHostLocator, sourceNode)
      return { rootGraphId, hostNodeLocator: nestedHostLocator }
    }

    const explicit = exposures.flatMap((exposure): PromotedPreview[] => {
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

      const leafExecutionId = appendNodeExecutionId(
        leafHostLocator,
        leaf.sourceNodeId
      )
      if (!leafExecutionId) return []

      const urls = readReactivePreviewUrls(
        leafHost,
        leaf.sourceNodeId,
        leafExecutionId,
        interiorNode
      )
      if (!urls?.length) return []

      return [
        {
          sourceNodeId: leaf.sourceNodeId,
          sourceWidgetName: leaf.sourcePreviewName,
          type: getPreviewMediaType(
            interiorNode,
            readOutputForMediaType(leafHost, leaf.sourceNodeId, leafExecutionId)
          ),
          urls
        }
      ]
    })

    const exposedSourceIds = new Set(
      exposures.map((exposure) => exposure.sourceNodeId)
    )
    const unexposed = node.subgraph.nodes.filter(
      (interiorNode) =>
        !exposedSourceIds.has(interiorNode.id) &&
        !interiorNode.isSubgraphNode() &&
        !previewExposureStore.isSourceExplicitlyRemoved(
          rootGraphId,
          hostLocator,
          interiorNode.id
        )
    )
    const implicit = unexposed.flatMap((interiorNode): PromotedPreview[] => {
      const leafExecutionId = appendNodeExecutionId(
        hostLocator,
        interiorNode.id
      )
      if (!leafExecutionId) return []

      const urls = readReactivePreviewUrls(
        node,
        interiorNode.id,
        leafExecutionId,
        interiorNode,
        { liveOnly: true }
      )
      if (!urls?.length) return []

      return [
        {
          sourceNodeId: interiorNode.id,
          sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET,
          type: getPreviewMediaType(
            interiorNode,
            readOutputForMediaType(node, interiorNode.id, leafExecutionId)
          ),
          urls
        }
      ]
    })

    return [...explicit, ...implicit]
  })

  return { promotedPreviews }
}
