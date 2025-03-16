<template>
  <!-- Create a new stacking context for widgets to avoid z-index issues -->
  <div class="isolate">
    <DomWidget
      v-for="widget in widgets"
      :key="widget.id"
      :widget="widget"
      :widget-state="domWidgetStore.widgetStates.get(widget.id)"
      @update:widget-value="widget.value = $event"
    />
  </div>
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import { computed, watch } from 'vue'

import DomWidget from '@/components/graph/widgets/DomWidget.vue'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { BaseDOMWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useCanvasStore } from '@/stores/graphStore'

const domWidgetStore = useDomWidgetStore()
const widgets = computed(() =>
  Array.from(
    domWidgetStore.widgetInstances.values() as Iterable<
      BaseDOMWidget<string | object>
    >
  )
)

const DEFAULT_MARGIN = 10
const updateWidgets = () => {
  const lgCanvas = canvasStore.canvas
  if (!lgCanvas) return

  const lowQuality = lgCanvas.low_quality
  for (const widget of domWidgetStore.widgetInstances.values()) {
    const node = widget.node as LGraphNode
    const widgetState = domWidgetStore.widgetStates.get(widget.id)

    if (!widgetState) continue

    const visible =
      lgCanvas.isNodeVisible(node) &&
      !(widget.options.hideOnZoom && lowQuality) &&
      widget.isVisible()

    widgetState.visible = visible
    if (visible) {
      const margin = widget.options.margin ?? DEFAULT_MARGIN
      widgetState.pos = [node.pos[0] + margin, node.pos[1] + margin + widget.y]
      widgetState.size = [
        (widget.width ?? node.width) - margin * 2,
        (widget.computedHeight ?? 50) - margin * 2
      ]
      // TODO: optimize this logic as it's O(n), where n is the number of nodes
      widgetState.zIndex = lgCanvas.graph.nodes.indexOf(node)
      widgetState.readonly = lgCanvas.read_only
    }
  }
}

const canvasStore = useCanvasStore()
watch(
  () => canvasStore.canvas,
  (lgCanvas) => {
    if (!lgCanvas) return

    lgCanvas.onDrawForeground = useChainCallback(
      lgCanvas.onDrawForeground,
      () => {
        updateWidgets()
      }
    )
  }
)
</script>
