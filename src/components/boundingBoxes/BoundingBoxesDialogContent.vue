<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <BoundingBoxesEditor
      v-model="modelValue"
      :node-id="nodeId"
      :widget="widget"
      fullscreen
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'

import BoundingBoxesEditor from '@/components/boundingBoxes/BoundingBoxesEditor.vue'
import { locateWidgetNode } from '@/composables/widgetHistoryScope'
import type { BoundingBox } from '@/types/boundingBoxes'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { nodeId, widget, close } = defineProps<{
  nodeId: NodeId
  widget: SimplifiedWidget
  close: () => void
}>()

const location = locateWidgetNode(widget, nodeId)
const graph = location?.graph
const node = location ? graph?.getNodeById(location.nodeId) : undefined
const liveWidget = node?.widgets?.find((w) => w.name === widget.name)

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
  set: (boxes) => widget.callback?.(boxes)
})
</script>
