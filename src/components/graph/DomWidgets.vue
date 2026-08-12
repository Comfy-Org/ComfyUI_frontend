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
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

const domWidgetStore = useDomWidgetStore()

const widgetStates = computed(() => [...domWidgetStore.widgetStates.values()])

// Track canvas viewport and selected-node bounds between frames.
// lgCanvas.ds.offset, ds.scale, and node.pos/size are non-reactive plain
// props — Vue watchers in DomWidget won't fire unless widgetState.pos gets
// a new array identity. We force reassignment whenever these change so the
// downstream watcher re-runs updatePosition / updateDomClipping.
const lastViewport = { offsetX: Number.NaN, offsetY: Number.NaN, scale: Number.NaN }
const lastSelected = {
  id: undefined as string | number | undefined,
  posX: 0,
  posY: 0,
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

  const selectedNode = Object.values(lgCanvas.selected_nodes ?? {})[0]
  const selectedNodeId = selectedNode?.id
  const selectedPosX = selectedNode ? selectedNode.pos[0] : 0
  const selectedPosY = selectedNode ? selectedNode.pos[1] : 0
  const selectedWidth = selectedNode ? selectedNode.size[0] : 0
  const selectedHeight = selectedNode ? selectedNode.size[1] : 0
  const selectionChanged =
    lastSelected.id !== selectedNodeId ||
    (!!selectedNode &&
      (lastSelected.posX !== selectedPosX ||
        lastSelected.posY !== selectedPosY ||
        lastSelected.width !== selectedWidth ||
        lastSelected.height !== selectedHeight))
  lastSelected.id = selectedNodeId
  lastSelected.posX = selectedPosX
  lastSelected.posY = selectedPosY
  lastSelected.width = selectedWidth
  lastSelected.height = selectedHeight

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

      const newZIndex = getDomWidgetZIndex(posNode, currentGraph)
      if (widgetState.zIndex !== newZIndex) {
        widgetState.zIndex = newZIndex
      }

      const newReadonly = lgCanvas.read_only
      if (widgetState.readonly !== newReadonly) {
        widgetState.readonly = newReadonly
      }

      const newComputedDisabled = widget.computedDisabled ?? false
      if (widgetState.computedDisabled !== newComputedDisabled) {
        widgetState.computedDisabled = newComputedDisabled
      }
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
