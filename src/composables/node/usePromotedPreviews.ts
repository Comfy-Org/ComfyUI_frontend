import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { UUID } from '@/utils/uuid'
import type { NodeExecutionOutput } from '@/platform/remote/comfyui/execution/types'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  getPreviewExposureHostLocator,
  usePreviewExposureStore
} from '@/stores/previewExposureStore'
import { parseNodeOutput } from '@/stores/resultItemParsing'
import type { NodeId } from '@/types/nodeId'
import {
  appendNodeExecutionId,
  createNodeLocatorId
} from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { AugmentedResultItem } from '@/utils/resultItem'

type PromotedOutput = { type: 'image' | 'video'; items: AugmentedResultItem[] }
type PromotedLivePreview = { type: 'preview'; url: string }
type PromotedContent = PromotedOutput | PromotedLivePreview

type PromotedPreview = PromotedContent & {
  sourceNodeId: NodeId
  sourceWidgetName: string
}

const PREVIEW_TYPES_BY_MEDIA = {
  video: 'video'
} as const satisfies Partial<Record<string, PromotedOutput['type']>>

function getPreviewMediaType(node: LGraphNode): PromotedOutput['type'] {
  const media = node.previewMediaType
  if (media && media in PREVIEW_TYPES_BY_MEDIA) {
    return PREVIEW_TYPES_BY_MEDIA[media as keyof typeof PREVIEW_TYPES_BY_MEDIA]
  }
  return 'image'
}

function toPromotedContent(
  sourceNodeId: NodeId,
  mediaType: PromotedOutput['type'],
  previews: string[] | undefined,
  outputs: NodeExecutionOutput | undefined
): PromotedContent | undefined {
  const url = previews?.at(-1)
  if (url) return { type: 'preview', url }
  const items = parseNodeOutput(sourceNodeId, outputs)
  if (items.length) return { type: mediaType, items }
  return undefined
}

export function usePromotedPreviews(
  lgraphNode: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const previewExposureStore = usePreviewExposureStore()
  const nodeOutputStore = useNodeOutputStore()

  function readPromotedContent(
    leafHost: SubgraphNode,
    sourceNodeId: NodeId,
    executionId: NodeExecutionId,
    mediaType: PromotedOutput['type']
  ): PromotedContent | undefined {
    const locatorId = createNodeLocatorId(leafHost.subgraph.id, sourceNodeId)
    return (
      toPromotedContent(
        sourceNodeId,
        mediaType,
        nodeOutputStore.getNodePreviewImagesByExecutionId(executionId),
        nodeOutputStore.getNodeOutputByExecutionId(executionId)
      ) ??
      toPromotedContent(
        sourceNodeId,
        mediaType,
        nodeOutputStore.nodePreviewImages[locatorId],
        nodeOutputStore.nodeOutputs[locatorId]
      )
    )
  }

  const promotedPreviews = computed((): PromotedPreview[] => {
    const node = toValue(lgraphNode)
    if (!(node instanceof SubgraphNode)) return []
    if (node.isDetached) return []

    const rootGraphId = node.rootGraph.id
    const hostLocator = getPreviewExposureHostLocator(node)
    if (!hostLocator) return []
    const exposures = previewExposureStore.getExposures(
      rootGraphId,
      hostLocator
    )
    if (!exposures.length) return []

    const hostNodesByLocator = new Map<string, SubgraphNode>([
      [hostLocator, node]
    ])
    const hostExecutionsByLocator = new Map<string, string>([
      [hostLocator, String(node.id)]
    ])

    function resolveNestedHost(
      rootGraphId: UUID,
      currentHostLocator: string,
      sourceNodeId: NodeId
    ) {
      const currentHost = hostNodesByLocator.get(currentHostLocator)
      const sourceNode = currentHost?.subgraph.getNodeById(sourceNodeId)
      if (!(sourceNode instanceof SubgraphNode)) return undefined

      const nestedHostLocator = getPreviewExposureHostLocator(sourceNode)
      if (!nestedHostLocator) return undefined
      const currentExecutionId = hostExecutionsByLocator.get(currentHostLocator)
      if (!currentExecutionId) return undefined
      hostNodesByLocator.set(nestedHostLocator, sourceNode)
      hostExecutionsByLocator.set(
        nestedHostLocator,
        `${currentExecutionId}:${sourceNode.id}`
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
      const leafHostExecutionId =
        hostExecutionsByLocator.get(leafHostLocator) ?? String(node.id)
      const interiorNode = leafHost.subgraph.getNodeById(leaf.sourceNodeId)
      if (!interiorNode) return []

      const leafExecutionId = appendNodeExecutionId(
        leafHostExecutionId,
        leaf.sourceNodeId
      )
      if (!leafExecutionId) return []

      const content = readPromotedContent(
        leafHost,
        leaf.sourceNodeId,
        leafExecutionId,
        getPreviewMediaType(interiorNode)
      )
      if (!content) return []

      return [
        {
          ...content,
          sourceNodeId: leaf.sourceNodeId,
          sourceWidgetName: leaf.sourcePreviewName
        }
      ]
    })
  })

  return { promotedPreviews }
}
