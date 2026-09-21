<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.widgets', 'Node Widgets Error') }}
  </div>
  <WidgetGrid
    v-else
    :processed-widgets="resolvedProcessedWidgets"
    :node-type="resolvedNodeType"
    :can-select-inputs="resolvedCanSelectInputs"
    :node-id="nodeData?.id"
    :class="
      shouldHandleNodePointerEvents
        ? 'pointer-events-auto'
        : 'pointer-events-none'
    "
    @pointerdown.capture="handleBringToFront"
    @pointerdown="handleWidgetPointerEvent"
    @pointermove="handleWidgetPointerEvent"
    @pointerup="handleWidgetPointerEvent"
  />
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref } from 'vue'

import type { ProcessedWidget } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import type { NodeState } from '@/types/nodeState'
import type { WidgetId } from '@/types/widgetId'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { useProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'

interface NodeWidgetsProps {
  nodeData?: NodeState
  widgetIds?: readonly WidgetId[]
  processedWidgets?: ProcessedWidget[]
  nodeType?: string
  canSelectInputs?: boolean
}

const {
  nodeData,
  widgetIds,
  processedWidgets: suppliedProcessedWidgets,
  nodeType: suppliedNodeType,
  canSelectInputs: suppliedCanSelectInputs
} = defineProps<NodeWidgetsProps>()

const { shouldHandleNodePointerEvents, forwardEventToCanvas } =
  useCanvasInteractions()
const { bringNodeToFront } = useNodeZIndex()

function handleWidgetPointerEvent(event: PointerEvent) {
  if (shouldHandleNodePointerEvents.value) return
  event.stopPropagation()
  forwardEventToCanvas(event)
}

function handleBringToFront() {
  if (nodeData?.id != null) {
    bringNodeToFront(nodeData.id)
  }
}

// Error boundary implementation
const renderError = ref<string | null>(null)

const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

const {
  canSelectInputs: computedCanSelectInputs,
  nodeType: computedNodeType,
  processedWidgets: computedProcessedWidgets
} = useProcessedWidgets(
  () => nodeData,
  () => widgetIds
)
const resolvedProcessedWidgets = computed(
  () => suppliedProcessedWidgets ?? computedProcessedWidgets.value
)
const resolvedNodeType = computed(
  () => suppliedNodeType ?? computedNodeType.value
)
const resolvedCanSelectInputs = computed(
  () => suppliedCanSelectInputs ?? computedCanSelectInputs.value
)
</script>
