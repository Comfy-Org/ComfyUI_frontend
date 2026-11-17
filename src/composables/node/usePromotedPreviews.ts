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
import { executionIdToNodeLocatorId } from '@/utils/graphTraversalUtil'
import { nodePreviewOf } from '@/systems/nodePreviewSystem'
import type { NodePreviewPart } from '@/systems/nodePreviewSystem'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import {
  appendNodeExecutionId,
  createNodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import type { NodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'

type PromotedPreview = {
  name: string
  sourceNodeId: NodeId
  sourceWidgetName: string
  parts: NodePreviewPart[]
}

export function usePromotedPreviews(
  lgraphNode: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const previewExposureStore = usePreviewExposureStore()
  const nodeOutputStore = useNodeOutputStore()

  function toPromotedParts(
    node: LGraphNode,
    source: NodeExecutionId,
    liveUrls: string[] | undefined,
    outputs: NodeExecutionOutput | undefined
  ): NodePreviewPart[] {
    const parts = nodePreviewOf(node, { source, outputs, liveUrls })
    const live = parts.filter((part) => part.kind === 'live')
    return live.length ? live : parts
  }

  function readPromotedParts(
    leafHost: SubgraphNode,
    sourceNodeId: NodeId,
    executionId: NodeExecutionId,
    interiorNode: LGraphNode
  ): NodePreviewPart[] {
    const locatorId = createNodeLocatorId(leafHost.subgraph.id, sourceNodeId)
    if (
      executionIdToNodeLocatorId(leafHost.rootGraph, executionId) !== locatorId
    )
      return toPromotedParts(
        interiorNode,
        executionId,
        nodeOutputStore.nodePreviewImages[locatorId],
        nodeOutputStore.nodeOutputs[locatorId]
      )
    return toPromotedParts(
      interiorNode,
      executionId,
      nodeOutputStore.getNodePreviewImagesByExecutionId(executionId),
      nodeOutputStore.getNodeOutputByExecutionId(executionId)
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

      const parts = readPromotedParts(
        leafHost,
        leaf.sourceNodeId,
        leafExecutionId,
        interiorNode
      )
      if (!parts.length) return []

      return [
        {
          name: exposure.name,
          sourceNodeId: leaf.sourceNodeId,
          sourceWidgetName: leaf.sourcePreviewName,
          parts
        }
      ]
    })
  })

  return { promotedPreviews }
}
