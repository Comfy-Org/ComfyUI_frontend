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
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { BoundingBox } from '@comfyorg/graph-model/boundingBoxes'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import {
  setWidgetValue,
  widgetLive,
  widgetValue
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'

const { nodeId, widgetId, close } = defineProps<{
  nodeId: NodeId
  widgetId: WidgetId
  close: () => void
}>()

const live = widgetLive(widgetId)
const graph: LGraph | null | undefined = live?.node.graph

const listeners = new AbortController()
graph?.rootGraph.events.addEventListener('configuring', close, {
  signal: listeners.signal
})
graph?.events.addEventListener(
  'node:removed',
  ({ detail }) => {
    if (detail.node === live?.node) close()
  },
  { signal: listeners.signal }
)
onMounted(() => {
  if (!live) close()
})
onBeforeUnmount(() => listeners.abort())

const modelValue = computed<BoundingBox[]>({
  get: () => {
    const value = widgetValue(widgetId)
    return Array.isArray(value) ? value : []
  },
  set: (boxes) => setWidgetValue(widgetId, boxes)
})
</script>
