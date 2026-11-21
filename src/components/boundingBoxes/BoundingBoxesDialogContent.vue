<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <BoundingBoxesEditor
      v-model="modelValue"
      :node-id="nodeId"
      :widget-id="widgetId"
      fullscreen
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'

import BoundingBoxesEditor from '@/components/boundingBoxes/BoundingBoxesEditor.vue'
import { locateWidgetNode } from '@/composables/widgetHistoryScope'
import type { BoundingBox } from '@comfyorg/graph-model/boundingBoxes'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { useWidgetView } from '@/renderer/extensions/vueNodes/widgets/useWidgetView'

const { nodeId, widgetId, close } = defineProps<{
  nodeId: NodeId
  widgetId: WidgetId
  close: () => void
}>()

const widget = useWidgetView(() => widgetId)
const location = locateWidgetNode(widget.value, nodeId)
const graph = location?.graph
const node = location ? graph?.getNodeById(location.nodeId) : undefined
const liveWidget = node?.widgets?.find((w) => w.name === widget.value.name)

const listeners = new AbortController()
graph?.rootGraph.events.addEventListener('configuring', close, {
  signal: listeners.signal
})
graph?.events.addEventListener(
  'node:removed',
  ({ detail }) => {
    if (detail.node === node) close()
  },
  { signal: listeners.signal }
)
onMounted(() => {
  if (!liveWidget) close()
})
onBeforeUnmount(() => listeners.abort())

const modelValue = computed<BoundingBox[]>({
  get: () => {
    const value = liveWidget?.value
    return Array.isArray(value) ? value : []
  },
  set: (boxes) => widget.value.setValue(boxes)
})
</script>
