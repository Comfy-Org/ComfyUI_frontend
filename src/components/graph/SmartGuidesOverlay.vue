<template>
  <canvas
    ref="guideCanvas"
    class="pointer-events-none absolute inset-0 z-1 size-full text-2xs text-primary"
  />
</template>

<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'

import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { drawSmartGuides } from '@/renderer/core/canvas/smartGuides/drawSmartGuides'
import { activeGuides } from '@/renderer/core/canvas/smartGuides/smartGuidesState'
import type { SmartGuide } from '@comfyorg/graph-model/arrange/snapSolver'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

const canvasStore = useCanvasStore()
const { canvasToScreen, syncWithCanvas } = useTransformState()
const guideCanvas = useTemplateRef('guideCanvas')
let drawn: readonly SmartGuide[] = []

watch(
  () => canvasStore.canvas,
  (canvas, _, onCleanup) => {
    if (!canvas) return
    onCleanup(onCanvasFrame(canvas, 'present', () => present(canvas)))
  },
  { immediate: true }
)

function present(canvas: LGraphCanvas) {
  const el = guideCanvas.value
  const ctx = el?.getContext('2d')
  const guides = activeGuides.value
  if (!el || !ctx || (!guides.length && !drawn.length)) return

  const { width, height } = canvas.canvas
  const resized = el.width !== width || el.height !== height
  if (resized) {
    el.width = width
    el.height = height
  }
  if (resized || !drawn.length) {
    const style = getComputedStyle(el)
    ctx.strokeStyle = ctx.fillStyle = style.color
    ctx.font = style.font
  }
  drawn = guides

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (!guides.length) return

  const pixelRatio = width / (el.clientWidth || 1)
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  syncWithCanvas(canvas)
  drawSmartGuides(ctx, guides, canvasToScreen)
}
</script>
