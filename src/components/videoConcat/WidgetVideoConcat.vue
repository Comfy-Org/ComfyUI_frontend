<template>
  <div class="w-full" :data-widget-name="widget.name">
    <VideoConcatPanel :clips="orderedClips" @reorder="reorder" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import VideoConcatPanel from '@/components/videoConcat/VideoConcatPanel.vue'
import { useVideoConcatClips } from '@/composables/videoConcat/useVideoConcatClips'
import { useVideoConcatOrder } from '@/composables/videoConcat/useVideoConcatOrder'
import type { VideoConcatValue } from '@comfyorg/graph-model/widgets'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { useWidgetHostNode } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetHostNode'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { useWidgetView } from '@/renderer/extensions/vueNodes/widgets/useWidgetView'

const { widgetId, nodeId } = defineProps<{
  widgetId: WidgetId
  nodeId: NodeId
}>()

const widget = useWidgetView(() => widgetId)
const source = computed(() => {
  const options = widget.value.options
  return 'source' in options && typeof options.source === 'string'
    ? options.source
    : ''
})

const modelValue = defineModel<VideoConcatValue>({
  default: () => ({})
})

const node = useWidgetHostNode(
  () => nodeId,
  () => widget.value.nodeLocatorId
)

const clips = useVideoConcatClips(node, () => source.value)

const { orderedClips, reorder } = useVideoConcatOrder(modelValue, clips)
</script>
