<template>
  <!-- Create a new stacking context for widgets to avoid z-index issues -->
  <div class="isolate">
    <DomWidget
      v-for="widgetState in widgetStates"
      :key="widgetState.widget.id"
      :widget-state="widgetState"
      @update:widget-value="widgetState.widget.value = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { computed } from 'vue'

import DomWidget from '@/components/graph/widgets/DomWidget.vue'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useCanvasStore } from '@/stores/graphStore'

const domWidgetStore = useDomWidgetStore()

const widgetStates = computed(() => [...domWidgetStore.widgetStates.values()])

const updateWidgets = () => {
  const lgCanvas = canvasStore.canvas
  if (!lgCanvas) return

  const lowQuality = lgCanvas.low_quality
  const currentGraph = lgCanvas.graph

  for (const widgetState of widgetStates.value) {
    const widget = widgetState.widget

    // Early exit for non-visible widgets
    if (!widget.isVisible()) {
      widgetState.visible = false
      continue
    }

    // Check if the widget's node is in the current graph
    const node = widget.node
    const isInCorrectGraph = currentGraph?.nodes.includes(node)

    widgetState.visible =
      !!isInCorrectGraph &&
      lgCanvas.isNodeVisible(node) &&
      !(widget.options.hideOnZoom && lowQuality)

    if (widgetState.visible && node) {
      const margin = widget.margin
      widgetState.pos = [node.pos[0] + margin, node.pos[1] + margin + widget.y]
      widgetState.size = [
        (widget.width ?? node.width) - margin * 2,
        (widget.computedHeight ?? 50) - margin * 2
      ]
      // TODO: optimize this logic as it's O(n), where n is the number of nodes
      widgetState.zIndex = lgCanvas.graph?.nodes.indexOf(node) ?? -1
      widgetState.readonly = lgCanvas.read_only
    }
  }
}

const canvasStore = useCanvasStore()
whenever(
  () => canvasStore.canvas,
  (canvas) =>
    (canvas.onDrawForeground = useChainCallback(
      canvas.onDrawForeground,
      updateWidgets
    )),
  { immediate: true }
)
</script>
