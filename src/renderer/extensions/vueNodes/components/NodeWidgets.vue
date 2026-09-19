<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.widgets', 'Node Widgets Error') }}
  </div>
  <WidgetGrid
    v-else
    v-bind="widgetModel"
    :node-id="nodeData?.id"
    :class="canEditNodes ? 'pointer-events-auto' : 'pointer-events-none'"
    :inert="!canEditNodes"
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
  processedWidgetModel?: {
    processedWidgets: ProcessedWidget[]
    nodeType: string
    canSelectInputs: boolean
  }
}

const { nodeData, widgetIds, processedWidgetModel } =
  defineProps<NodeWidgetsProps>()

const { shouldHandleNodePointerEvents, canEditNodes, forwardEventToCanvas } =
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

const fallbackWidgetModel = useProcessedWidgets(
  () => nodeData,
  () => widgetIds
)
const widgetModel = computed(
  () =>
    processedWidgetModel ?? {
      processedWidgets: fallbackWidgetModel.processedWidgets.value,
      nodeType: fallbackWidgetModel.nodeType.value,
      canSelectInputs: fallbackWidgetModel.canSelectInputs.value
    }
)
</script>
