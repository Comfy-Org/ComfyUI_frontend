<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.widgets', 'Node Widgets Error') }}
  </div>
  <WidgetGrid
    v-else
    :processed-widgets
    :node-type
    :can-select-inputs
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
import { onErrorCaptured, ref } from 'vue'

import type { NodeState } from '@/types/nodeState'
import type { WidgetId } from '@/types/widgetId'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { useProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'

interface NodeWidgetsProps {
  nodeData?: NodeState
  widgetIds?: readonly WidgetId[]
}

const { nodeData, widgetIds } = defineProps<NodeWidgetsProps>()

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

const { canSelectInputs, nodeType, processedWidgets } = useProcessedWidgets(
  () => nodeData,
  () => widgetIds
)

// Tracks widget-row growth that the node-level RO can't see
if (nodeData?.id != null) {
  useVueElementTracking(nodeData.id, 'widgets-grid')
}
</script>
