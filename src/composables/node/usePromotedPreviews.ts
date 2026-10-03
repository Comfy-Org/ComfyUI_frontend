import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  getPreviewExposureHostLocator,
  usePreviewExposureStore
} from '@/stores/previewExposureStore'
import type { NodeId } from '@/types/nodeId'
import {
  appendNodeExecutionId,
  createNodeLocatorId
} from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { UUID } from '@/utils/uuid'
import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'

import { CANVAS_IMAGE_PREVIEW_WIDGET } from './canvasImagePreviewTypes'

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

function getPreviewMediaType(node: LGraphNode): PromotedPreview['type'] {
  const media = node.previewMediaType
  if (media && media in PREVIEW_TYPES_BY_MEDIA) {
    return PREVIEW_TYPES_BY_MEDIA[media as keyof typeof PREVIEW_TYPES_BY_MEDIA]
  }
  return 'image'
}

export interface ExposureLeaf {
  leafHost: SubgraphNode
  leafSourceNodeId: NodeId
  leafExecutionId: NodeExecutionId
  sourcePreviewName: string
}

/**
 * Follows an exposure chain through nested subgraph hosts to the interior
 * node that actually renders the preview, mirroring the execution-id scheme
 * the output stores are keyed by.
 */
export function resolveExposureLeaf(
  host: SubgraphNode,
  exposure: PreviewExposure
): ExposureLeaf | undefined {
  const previewExposureStore = usePreviewExposureStore()
  const rootGraphId = host.rootGraph.id
  const hostLocator = getPreviewExposureHostLocator(host)
  if (!hostLocator) return undefined

  const hostNodesByLocator = new Map<string, SubgraphNode>([
    [hostLocator, host]
  ])
  const hostExecutionsByLocator = new Map<string, string>([
    [hostLocator, String(host.id)]
  ])

  const resolveNestedHost = (
    nestedRootGraphId: UUID,
    currentHostLocator: string,
    sourceNodeId: NodeId
  ) => {
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
    return {
      rootGraphId: nestedRootGraphId,
      hostNodeLocator: nestedHostLocator
    }
  }

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
  const leafHostLocator = resolved?.steps.at(-1)?.hostNodeLocator ?? hostLocator
  const leafHost = hostNodesByLocator.get(leafHostLocator) ?? host
  const leafHostExecutionId =
    hostExecutionsByLocator.get(leafHostLocator) ?? String(host.id)
  const leafExecutionId = appendNodeExecutionId(
    leafHostExecutionId,
    leaf.sourceNodeId
  )
  if (!leafExecutionId) return undefined
  return {
    leafHost,
    leafSourceNodeId: leaf.sourceNodeId,
    leafExecutionId,
    sourcePreviewName: leaf.sourcePreviewName
  }
}

/**
 * Freshest URLs for an exposed preview: live previews win over executed
 * outputs, which win over the interior node's own canvas image state — the
 * virtual `$$canvas-image-preview` keeps its last frame on the node, not in
 * the output stores. Touches reactive sources for Vue tracking;
 * `getNodeImageUrls` reads non-reactive app state.
 *
 * `includeCompletedOutputs: false` drops the executed-output channels, leaving
 * only the live-preview and canvas-image channels. The classic-renderer host
 * rows use this: completed `/api/view` files survive temp-image pruning but
 * 404 once pruned, which would strand those rows on a dead URL.
 */
export function readExposedPreviewUrls(
  nodeOutputStore: ReturnType<typeof useNodeOutputStore>,
  leaf: ExposureLeaf,
  interiorNode: LGraphNode,
  includeCompletedOutputs = true
): string[] | undefined {
  const locatorId = createNodeLocatorId(
    leaf.leafHost.subgraph.id,
    leaf.leafSourceNodeId
  )
  if (!locatorId) return undefined

  const reactivePreviews = nodeOutputStore.nodePreviewImages[locatorId]
  const reactiveExecutionPreviews =
    nodeOutputStore.getNodePreviewImagesByExecutionId(leaf.leafExecutionId)
  const reactiveOutputs = includeCompletedOutputs
    ? nodeOutputStore.nodeOutputs[locatorId]
    : undefined
  const reactiveExecutionOutputs = includeCompletedOutputs
    ? nodeOutputStore.getNodeOutputByExecutionId(leaf.leafExecutionId)
    : undefined
  const canvasImageUrls =
    leaf.sourcePreviewName === CANVAS_IMAGE_PREVIEW_WIDGET
      ? (interiorNode.imgs ?? [])
          .map((image) => image.src)
          .filter((src): src is string => Boolean(src))
      : []
  const hasAnySource =
    reactivePreviews?.length ||
    reactiveExecutionPreviews?.length ||
    canvasImageUrls.length ||
    (includeCompletedOutputs &&
      (reactiveOutputs?.images?.length ||
        reactiveExecutionOutputs?.images?.length))
  if (!hasAnySource) return undefined

  if (reactiveExecutionPreviews?.length) return reactiveExecutionPreviews
  if (reactivePreviews?.length) return reactivePreviews
  if (includeCompletedOutputs) {
    const completedOutputs =
      nodeOutputStore.getNodeImageUrlsByExecutionId(
        leaf.leafExecutionId,
        interiorNode
      ) ?? nodeOutputStore.getNodeImageUrls(interiorNode)
    if (completedOutputs?.length) return completedOutputs
  }
  return canvasImageUrls.length ? canvasImageUrls : undefined
}

export function usePromotedPreviews(
  lgraphNode: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const previewExposureStore = usePreviewExposureStore()
  const nodeOutputStore = useNodeOutputStore()

  const promotedPreviews = computed((): PromotedPreview[] => {
    const node = toValue(lgraphNode)
    if (!(node instanceof SubgraphNode)) return []
    if (node.isDetached) return []

    const hostLocator = getPreviewExposureHostLocator(node)
    if (!hostLocator) return []
    const exposures = previewExposureStore.getExposures(
      node.rootGraph.id,
      hostLocator
    )
    if (!exposures.length) return []

    return exposures.flatMap((exposure): PromotedPreview[] => {
      const leaf = resolveExposureLeaf(node, exposure)
      if (!leaf) return []
      const interiorNode = leaf.leafHost.subgraph.getNodeById(
        leaf.leafSourceNodeId
      )
      if (!interiorNode) return []

      const urls = readExposedPreviewUrls(nodeOutputStore, leaf, interiorNode)
      if (!urls?.length) return []

      return [
        {
          sourceNodeId: leaf.leafSourceNodeId,
          sourceWidgetName: leaf.sourcePreviewName,
          type: getPreviewMediaType(interiorNode),
          urls
        }
      ]
    })
  })

  return { promotedPreviews }
}
