import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { UUID } from '@/utils/uuid'
import type { NodeExecutionOutput } from '@comfyorg/api-client/executionTypes'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  getPreviewExposureHostLocator,
  usePreviewExposureStore
} from '@/stores/previewExposureStore'
import type { AugmentedResultItem } from '@/utils/resultItem'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import {
  appendNodeExecutionId,
  createNodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import type { NodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'

type PromotedOutput = {
  type: 'image' | 'video' | 'audio'
  items: AugmentedResultItem[]
}
type PromotedLivePreview = { type: 'preview'; url: string }
type PromotedContent = PromotedOutput | PromotedLivePreview

type PromotedPreview = PromotedContent & {
  sourceNodeId: NodeId
  sourceWidgetName: string
}

function getPreviewMediaType(node: LGraphNode): PromotedOutput['type'] {
  const media = node.previewMediaType
  return media === 'video' || media === 'audio' ? media : 'image'
}

export function usePromotedPreviews(
  lgraphNode: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const previewExposureStore = usePreviewExposureStore()
  const nodeOutputStore = useNodeOutputStore()

  function toPromotedContent(
    node: LGraphNode,
    previews: string[] | undefined,
    outputs: NodeExecutionOutput | undefined
  ): PromotedContent | undefined {
    const url = previews?.at(-1)
    if (url) return { type: 'preview', url }
    if (!outputs) return undefined
    const items = nodeOutputStore.getNodeOutputItems(node, outputs)
    if (items.length) return { type: getPreviewMediaType(node), items }
    return undefined
  }

  function readPromotedContent(
    leafHost: SubgraphNode,
    sourceNodeId: NodeId,
    executionId: NodeExecutionId,
    interiorNode: LGraphNode
  ): PromotedContent | undefined {
    const locatorId = createNodeLocatorId(leafHost.subgraph.id, sourceNodeId)
    return (
      toPromotedContent(
        interiorNode,
        nodeOutputStore.getNodePreviewImagesByExecutionId(executionId),
        nodeOutputStore.getNodeOutputByExecutionId(executionId)
      ) ??
      toPromotedContent(
        interiorNode,
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
        interiorNode
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
