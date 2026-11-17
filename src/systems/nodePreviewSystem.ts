import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { NodeExecutionOutput } from '@comfyorg/api-client/executionTypes'
import { supportsVirtualCanvasImagePreview } from '@/composables/node/canvasImagePreviewTypes'
import { isMediaPreviewWidgetName } from '@/core/graph/subgraph/preview/mediaPreviewName'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { isVideoOutput } from '@/utils/litegraphUtil'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { isAudioResult, isVideoResult } from '@/utils/resultItem'

type NodePreviewMediaType = 'image' | 'video' | 'audio'

export interface NodePreviewMedia {
  readonly type: NodePreviewMediaType
  readonly items: AugmentedResultItem[]
}

/** A node's derived preview: its latest live frame and its output media of one type. */
export interface NodePreview {
  readonly liveUrl: string | undefined
  readonly media: NodePreviewMedia | undefined
}

interface NodePreviewContent {
  readonly outputs: NodeExecutionOutput | undefined
  readonly liveUrls: readonly string[] | undefined
}

interface NodePreviewSources extends NodePreviewContent {
  readonly items: readonly AugmentedResultItem[]
  readonly mediaTypeHint: LGraphNode['previewMediaType']
  readonly hasVideoInput: boolean
}

function isImageItem(item: AugmentedResultItem): boolean {
  return item.mediaType === 'images'
}

const ITEMS_OF_TYPE: Record<
  NodePreviewMediaType,
  (item: AugmentedResultItem) => boolean
> = {
  image: isImageItem,
  video: isVideoResult,
  audio: isAudioResult
}

function previewMediaType({
  outputs,
  items,
  mediaTypeHint,
  hasVideoInput
}: NodePreviewSources): NodePreviewMediaType {
  if (isVideoOutput(outputs)) return 'video'
  if (
    mediaTypeHint === 'image' ||
    mediaTypeHint === 'video' ||
    mediaTypeHint === 'audio'
  )
    return mediaTypeHint
  if (!mediaTypeHint && hasVideoInput) return 'video'
  if (items.some(isImageItem)) return 'image'
  if (items.some(isVideoResult)) return 'video'
  if (items.some(isAudioResult)) return 'audio'
  return 'image'
}

/** Chooses one media type for a node's outputs and keeps only the items of that type. */
export function computeNodePreview(sources: NodePreviewSources): NodePreview {
  const type = previewMediaType(sources)
  const items = sources.items.filter(ITEMS_OF_TYPE[type])
  return {
    liveUrl: sources.liveUrls?.at(-1),
    media: items.length ? { type, items } : undefined
  }
}

/** The preview `node` shows for the given content, such as one instance's outputs. */
export function nodePreviewOf(
  node: LGraphNode,
  content: NodePreviewContent
): NodePreview {
  return computeNodePreview({
    ...content,
    items: content.outputs
      ? useNodeOutputStore().getNodeOutputItems(node, content.outputs)
      : [],
    mediaTypeHint: node.previewMediaType,
    hasVideoInput: node.inputs.some((input) => input.type === 'VIDEO')
  })
}

const previewComputeds = new WeakMap<LGraphNode, ComputedRef<NodePreview>>()

/**
 * A node's preview from its own outputs and live frames, memoized per node
 * instance and recomputed when they change.
 */
export function nodePreview(node: LGraphNode): NodePreview {
  let preview = previewComputeds.get(node)
  if (!preview) {
    const store = useNodeOutputStore()
    preview = computed(() =>
      nodePreviewOf(node, {
        outputs: store.getNodeOutputs(node),
        liveUrls: store.getNodePreviews(node)
      })
    )
    previewComputeds.set(node, preview)
  }
  return preview.value
}

/** Whether `node` can show a media preview, whether or not the canvas has drawn one yet. */
export function canHavePreview(node: LGraphNode): boolean {
  return (
    supportsVirtualCanvasImagePreview(node) ||
    !!node.widgets?.some((widget) => isMediaPreviewWidgetName(widget.name)) ||
    !!useNodeOutputStore().getNodeOutputs(node)?.images?.length
  )
}
