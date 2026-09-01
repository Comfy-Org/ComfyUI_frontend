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
import { getDomWidgetZIndex } from '@/components/graph/widgets/domWidgetZIndex'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { findFirstNode } from '@/lib/litegraph/src/utils/collections'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

const domWidgetStore = useDomWidgetStore()

const widgetStates = computed(() => [...domWidgetStore.widgetStates.values()])

// Track canvas viewport and selected-node bounds between frames.
// lgCanvas.ds.offset, ds.scale, and node.renderArea are non-reactive plain
// values, so widgetState.pos needs a new identity to rerun downstream work.
const lastViewport = {
  offsetX: Number.NaN,
  offsetY: Number.NaN,
  scale: Number.NaN
}
const lastSelected = {
  id: undefined as string | number | undefined,
  x: 0,
  y: 0,
  width: 0,
  height: 0
}

const updateWidgets = () => {
  const lgCanvas = canvasStore.canvas
  if (!lgCanvas) return

  const lowQuality = lgCanvas.low_quality
  const currentGraph = lgCanvas.graph

  const viewportOffsetX = lgCanvas.ds.offset[0]
  const viewportOffsetY = lgCanvas.ds.offset[1]
  const viewportScale = lgCanvas.ds.scale
  const viewportChanged =
    lastViewport.offsetX !== viewportOffsetX ||
    lastViewport.offsetY !== viewportOffsetY ||
    lastViewport.scale !== viewportScale
  lastViewport.offsetX = viewportOffsetX
  lastViewport.offsetY = viewportOffsetY
  lastViewport.scale = viewportScale

  const selectedNode = findFirstNode(lgCanvas.selectedItems)
  const selectedNodeId = selectedNode?.id
  const selectedArea = selectedNode?.renderArea
  const selectionChanged =
    lastSelected.id !== selectedNodeId ||
    (!!selectedArea &&
      (lastSelected.x !== selectedArea[0] ||
        lastSelected.y !== selectedArea[1] ||
        lastSelected.width !== selectedArea[2] ||
        lastSelected.height !== selectedArea[3]))
  lastSelected.id = selectedNodeId
  lastSelected.x = selectedArea?.[0] ?? 0
  lastSelected.y = selectedArea?.[1] ?? 0
  lastSelected.width = selectedArea?.[2] ?? 0
  lastSelected.height = selectedArea?.[3] ?? 0

  for (const widgetState of widgetStates.value) {
    const widget = widgetState.widget

    if (!widget.isVisible() || !widgetState.active) {
      widgetState.visible = false
      continue
    }

    const posNode = widget.node

    const isInCorrectGraph = posNode.graph === currentGraph
    const nodeVisible = lgCanvas.isNodeVisible(posNode)

    widgetState.visible =
      isInCorrectGraph &&
      nodeVisible &&
      !(widget.options.hideOnZoom && lowQuality)

    if (widgetState.visible) {
      const margin = widget.margin
      const newPosX = posNode.pos[0] + margin
      const newPosY = posNode.pos[1] + margin + widget.y
      if (
        viewportChanged ||
        selectionChanged ||
        widgetState.pos[0] !== newPosX ||
        widgetState.pos[1] !== newPosY
      ) {
        widgetState.pos = [newPosX, newPosY]
      }

      const newWidth = (widget.width ?? posNode.width) - margin * 2
      const newHeight = (widget.computedHeight ?? 50) - margin * 2
      if (
        widgetState.size[0] !== newWidth ||
        widgetState.size[1] !== newHeight
      ) {
        widgetState.size = [newWidth, newHeight]
      }

      widgetState.zIndex = getDomWidgetZIndex(posNode, currentGraph)
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
