<template>
  <div
    v-show="isVisible"
    data-testid="selection-rectangle"
    class="pointer-events-none absolute z-9999 border border-blue-400 bg-blue-500/20"
    :style="rectangleStyle"
  />
</template>

<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { computed, ref } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { clipRectToBounds } from '@/utils/mathUtil'
import type { RectEdges } from '@/utils/mathUtil'

const { panelEl } = defineProps<{
  /** Clip surface owned by the caller; the rectangle renders unclipped when absent. */
  panelEl?: HTMLElement
}>()

const canvasStore = useCanvasStore()

const selectionRect = ref<{
  x: number
  y: number
  w: number
  h: number
} | null>(null)
const panelBounds = ref<RectEdges>()

useRafFn(() => {
  const canvas = canvasStore.canvas
  if (!canvas) return

  const { pointer, dragging_rectangle } = canvas

  if (dragging_rectangle && pointer.eDown && pointer.eMove) {
    if (!selectionRect.value) {
      panelBounds.value = getCanvasPanelBounds(canvas.canvas)
    }
    const x = pointer.eDown.safeOffsetX
    const y = pointer.eDown.safeOffsetY
    const w = pointer.eMove.safeOffsetX - x
    const h = pointer.eMove.safeOffsetY - y

    selectionRect.value = { x, y, w, h }
  } else {
    selectionRect.value = null
    panelBounds.value = undefined
  }
})

const isVisible = computed(() => selectionRect.value !== null)

function getCanvasPanelBounds(
  canvasEl: HTMLCanvasElement
): RectEdges | undefined {
  if (!panelEl) return undefined

  const panel = panelEl.getBoundingClientRect()
  const canvas = canvasEl.getBoundingClientRect()
  return {
    left: panel.left - canvas.left,
    top: panel.top - canvas.top,
    right: panel.right - canvas.left,
    bottom: panel.bottom - canvas.top
  }
}

const rectangleStyle = computed(() => {
  const rect = selectionRect.value
  if (!rect) return {}

  const edges: RectEdges = {
    left: rect.w >= 0 ? rect.x : rect.x + rect.w,
    top: rect.h >= 0 ? rect.y : rect.y + rect.h,
    right: rect.w >= 0 ? rect.x + rect.w : rect.x,
    bottom: rect.h >= 0 ? rect.y + rect.h : rect.y
  }
  const bounds = panelBounds.value
  const { left, top, right, bottom } = bounds
    ? clipRectToBounds(edges, bounds)
    : edges

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${right - left}px`,
    height: `${bottom - top}px`
  }
})
</script>
