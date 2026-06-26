<template>
  <div
    v-show="selectionRect !== null"
    data-testid="selection-rectangle"
    class="pointer-events-none absolute z-9999 border border-blue-400 bg-blue-500/20"
    :style="rectangleStyle"
  />
</template>

<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { computed, ref } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { RectEdges } from '@/utils/mathUtil'
import {
  clampRectToBounds,
  getRectFromPoints,
  hasRectArea
} from '@/utils/mathUtil'

const canvasStore = useCanvasStore()

const selectionRect = ref<RectEdges | null>(null)

useRafFn(() => {
  const canvas = canvasStore.canvas
  if (!canvas) {
    selectionRect.value = null
    return
  }

  const { pointer, dragging_rectangle } = canvas

  if (dragging_rectangle && pointer.eDown && pointer.eMove) {
    const canvasBounds = canvas.canvas.getBoundingClientRect()
    const dragBounds = getRectFromPoints(
      {
        x: pointer.eDown.clientX - canvasBounds.left,
        y: pointer.eDown.clientY - canvasBounds.top
      },
      {
        x: pointer.eMove.clientX - canvasBounds.left,
        y: pointer.eMove.clientY - canvasBounds.top
      }
    )
    const clippedBounds = clampRectToBounds(
      dragBounds,
      getCanvasPanelBounds(canvas.canvas)
    )

    selectionRect.value = hasRectArea(clippedBounds) ? clippedBounds : null
  } else {
    selectionRect.value = null
  }
})

const rectangleStyle = computed(() => {
  const rect = selectionRect.value
  if (!rect) return {}

  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.right - rect.left}px`,
    height: `${rect.bottom - rect.top}px`
  }
})

function getCanvasPanelBounds(canvas: HTMLCanvasElement): RectEdges {
  const canvasBounds = canvas.getBoundingClientRect()
  const panel = document.querySelector('.graph-canvas-panel')
  const panelBounds =
    panel instanceof HTMLElement ? panel.getBoundingClientRect() : canvasBounds

  return {
    left: panelBounds.left - canvasBounds.left,
    top: panelBounds.top - canvasBounds.top,
    right: panelBounds.right - canvasBounds.left,
    bottom: panelBounds.bottom - canvasBounds.top
  }
}
</script>
