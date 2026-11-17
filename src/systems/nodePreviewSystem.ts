import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { NodeExecutionOutput } from '@comfyorg/api-client/executionTypes'
import { supportsVirtualCanvasImagePreview } from '@/composables/node/canvasImagePreviewTypes'
import {
  CANVAS_IMAGE_PREVIEW_WIDGET,
  isMediaPreviewWidgetName
} from '@/core/graph/subgraph/preview/mediaPreviewName'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWidgetPreviewDisplayStore } from '@/stores/widgetPreviewDisplayStore'
import { isVideoOutput } from '@/utils/litegraphUtil'
import { createNodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { isAudioResult, isImageResult, isVideoResult } from '@/utils/resultItem'

interface MediaContext {
  readonly prefersVideo: boolean
}

const MEDIA_KINDS = [
  {
    type: 'image',
    matches: (item: AugmentedResultItem, context: MediaContext) =>
      isImageResult(item) &&
      !context.prefersVideo &&
      !isVideoResult(item) &&
      !isAudioResult(item)
  },
  { type: 'video', matches: isVideoResult },
  { type: 'audio', matches: isAudioResult }
] as const

type NodePreviewMediaType = (typeof MEDIA_KINDS)[number]['type']

/** One independently rendered piece of a node preview. */
export type NodePreviewPart =
  | { readonly kind: 'live'; readonly source: string; readonly url: string }
  | {
      readonly kind: 'media'
      readonly type: NodePreviewMediaType
      readonly items: AugmentedResultItem[]
    }

export type NodeMediaPart = Extract<NodePreviewPart, { kind: 'media' }>
type NodeLivePart = Extract<NodePreviewPart, { kind: 'live' }>

interface NodePreviewContent {
  readonly source: string
  readonly outputs: NodeExecutionOutput | undefined
  readonly liveUrls: readonly string[] | undefined
}

interface NodePreviewSources extends NodePreviewContent {
  readonly items: readonly AugmentedResultItem[]
  readonly mediaTypeHint: LGraphNode['previewMediaType']
  readonly hasVideoInput: boolean
}

function prefersVideo({
  items,
  outputs,
  mediaTypeHint,
  hasVideoInput
}: NodePreviewSources): boolean {
  return (
    (isVideoOutput(outputs) && items.some(isVideoResult)) ||
    mediaTypeHint === 'video' ||
    (!mediaTypeHint && hasVideoInput)
  )
}

function mediaParts(sources: NodePreviewSources): NodeMediaPart[] {
  const context = { prefersVideo: prefersVideo(sources) }
  const kindOf = (item: AugmentedResultItem) =>
    MEDIA_KINDS.find((kind) => kind.matches(item, context))?.type
  return MEDIA_KINDS.flatMap(({ type }): NodeMediaPart[] => {
    const items = sources.items.filter((item) => kindOf(item) === type)
    return items.length ? [{ kind: 'media', type, items }] : []
  })
}

/** Splits a node's live frame and outputs into parts: the live frame first, then one part per media kind. */
export function computeNodePreview(
  sources: NodePreviewSources
): NodePreviewPart[] {
  const url = sources.liveUrls?.at(-1)
  const live: NodeLivePart[] = url
    ? [{ kind: 'live', source: sources.source, url }]
    : []
  return [...live, ...mediaParts(sources)]
}

/** The preview `node` shows for the given content, such as one instance's outputs. */
export function nodePreviewOf(
  node: LGraphNode,
  content: NodePreviewContent
): NodePreviewPart[] {
  return computeNodePreview({
    ...content,
    items: content.outputs
      ? useNodeOutputStore().getNodeOutputItems(node, content.outputs)
      : [],
    mediaTypeHint: node.previewMediaType,
    hasVideoInput: node.inputs.some((input) => input.type === 'VIDEO')
  })
}

const previewComputeds = new WeakMap<
  LGraphNode,
  ComputedRef<NodePreviewPart[]>
>()

/**
 * A node's preview from its own outputs and live frames, memoized per node
 * instance and recomputed when they change.
 */
export function nodePreview(node: LGraphNode): readonly NodePreviewPart[] {
  let preview = previewComputeds.get(node)
  if (!preview) {
    const store = useNodeOutputStore()
    preview = computed(() =>
      nodePreviewOf(node, {
        source: String(node.id),
        outputs: store.getNodeOutputs(node),
        liveUrls: store.getNodePreviews(node)
      })
    )
    previewComputeds.set(node, preview)
  }
  return preview.value
}

function innermostLiveParts(
  sources: ReadonlyArray<{ executionId: string; urls: readonly string[] }>
): NodeLivePart[] {
  return sources.flatMap(({ executionId, urls }): NodeLivePart[] => {
    const url = urls.at(-1)
    const hasInnerSource = sources.some((other) =>
      other.executionId.startsWith(`${executionId}:`)
    )
    return url && !hasInnerSource
      ? [{ kind: 'live', source: executionId, url }]
      : []
  })
}

/**
 * The live frames running inside a subgraph node, one part per interior
 * source not in `shownElsewhere`. A node whose instance path is unknown shows
 * the latest frame any interior node sent it, unless a source is shown elsewhere.
 */
export function activityInside(
  node: LGraphNode,
  shownElsewhere: ReadonlySet<string>
): NodeLivePart[] {
  const store = useNodeOutputStore()
  if (node.graph && node.graph === node.graph.rootGraph)
    return innermostLiveParts(
      store.getPreviewImagesInside(createNodeExecutionId([node.id]))
    ).filter(({ source }) => !shownElsewhere.has(source))
  const url = store.getNodePreviews(node)?.at(-1)
  return url && !shownElsewhere.size
    ? [{ kind: 'live', source: String(node.id), url }]
    : []
}

/** Whether `node` can show a media preview, whether or not the canvas has drawn one yet. */
export function canHavePreview(node: LGraphNode): boolean {
  return (
    supportsVirtualCanvasImagePreview(node) ||
    !!node.widgets?.some((widget) => isMediaPreviewWidgetName(widget.name)) ||
    !!useNodeOutputStore().getNodeOutputs(node)?.images?.length
  )
}

/** How a preview region shows: by its content, reserved before content arrives, or not at all. */
export type PreviewDisplay = 'auto' | 'shown' | 'hidden'

function previewDisplayId(node: LGraphNode, name: string) {
  return node.graph
    ? widgetId(node.graph.rootGraph.id, node.id, name)
    : undefined
}

/** The display the user chose for `node`'s preview `name`, or `auto` when they chose none. */
export function chosenPreviewDisplay(
  node: LGraphNode,
  name = CANVAS_IMAGE_PREVIEW_WIDGET,
  id = previewDisplayId(node, name)
): PreviewDisplay {
  return (id && useWidgetPreviewDisplayStore().get(id)?.mode) || 'auto'
}

/**
 * How `node`'s preview `name` shows: the user's choice, else hidden when an
 * extension hides output images. `id` overrides the preview's identity.
 */
export function previewDisplay(
  node: LGraphNode,
  name = CANVAS_IMAGE_PREVIEW_WIDGET,
  id = previewDisplayId(node, name)
): PreviewDisplay {
  const chosen = chosenPreviewDisplay(node, name, id)
  if (chosen !== 'auto') return chosen
  return node.hideOutputImages ? 'hidden' : 'auto'
}

/** Records the user's display choice for `node`'s preview `name`; `auto` clears it. */
export function setPreviewDisplay(
  node: LGraphNode,
  display: PreviewDisplay,
  name = CANVAS_IMAGE_PREVIEW_WIDGET
): void {
  const id = previewDisplayId(node, name)
  if (!id) return
  useWidgetPreviewDisplayStore().set(
    id,
    display === 'auto' ? undefined : { mode: display }
  )
}
