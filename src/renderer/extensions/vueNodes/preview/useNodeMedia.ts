import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { NodeMedia } from '@/renderer/extensions/vueNodes/types/nodeMedia'
import { shouldHideLinkedCoreMediaInputPreview } from '@/renderer/extensions/vueNodes/utils/linkedCoreMediaUtils'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { isVideoOutput } from '@/utils/litegraphUtil'

interface NodeMediaSource {
  node: MaybeRefOrGetter<LGraphNode | null>
  locatorId: MaybeRefOrGetter<NodeLocatorId | undefined>
  hidden: MaybeRefOrGetter<boolean>
  videoInput: MaybeRefOrGetter<boolean>
  widgetIds: MaybeRefOrGetter<readonly WidgetId[]>
}

const VIDEO_PREVIEW_WIDGET_TYPES = new Set(['videoedit', 'videoconcat'])

export function useNodeMedia(source: NodeMediaSource) {
  const outputs = useNodeOutputStore()
  const widgets = useWidgetValueStore()
  const output = computed(() => {
    const id = toValue(source.locatorId)
    return id ? outputs.nodeOutputs[id] : undefined
  })
  const visibleNode = computed(() => {
    const node = toValue(source.node)
    const data = output.value
    if (
      !node ||
      !data?.images?.length ||
      node.hideOutputImages ||
      toValue(source.hidden)
    )
      return
    if (
      node instanceof SubgraphNode ||
      shouldHideLinkedCoreMediaInputPreview(node, data)
    )
      return
    return node
  })
  const mediaType = computed(() => {
    const node = visibleNode.value
    const data = output.value
    if (!node || !data) return
    return isVideoOutput(data) ||
      node.previewMediaType === 'video' ||
      (!node.previewMediaType && toValue(source.videoInput))
      ? 'video'
      : 'image'
  })
  const hasVideoWidget = computed(() =>
    toValue(source.widgetIds).some((id) =>
      VIDEO_PREVIEW_WIDGET_TYPES.has(widgets.getWidget(id)?.type ?? '')
    )
  )

  return computed<NodeMedia | undefined>(() => {
    const node = visibleNode.value
    const type = mediaType.value
    if (!node || !type || (type === 'video' && hasVideoWidget.value)) return
    const urls = outputs.getNodeImageUrls(node)
    return urls?.length ? { type, urls } : undefined
  })
}
