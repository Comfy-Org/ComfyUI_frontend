<script setup lang="ts">
import { computed } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import WidgetItem from './WidgetItem.vue'

const {
  nodeId,
  widgetName,
  isDraggable = false,
  hiddenFavoriteIndicator = false,
  showNodeName = false,
  parents = [],
  isShownOnParents = false
} = defineProps<{
  nodeId: NodeId
  widgetName: string
  isDraggable?: boolean
  hiddenFavoriteIndicator?: boolean
  showNodeName?: boolean
  parents?: SubgraphNode[]
  isShownOnParents?: boolean
}>()

const emit = defineEmits<{
  'update:widgetValue': [value: string | number | boolean | object]
}>()

const canvasStore = useCanvasStore()

const node = computed(() => canvasStore.canvas?.graph?.getNodeById(nodeId))

const widget = computed(() =>
  node.value?.widgets?.find((w) => w.name === widgetName)
)
</script>

<template>
  <WidgetItem
    v-if="node && widget"
    :node="node"
    :widget="widget"
    :is-draggable="isDraggable"
    :hidden-favorite-indicator="hiddenFavoriteIndicator"
    :show-node-name="showNodeName"
    :parents="parents"
    :is-shown-on-parents="isShownOnParents"
    @update:widget-value="emit('update:widgetValue', $event)"
  />
</template>
