<template>
  <canvas
    ref="guideCanvas"
    class="pointer-events-none absolute inset-0 z-1 size-full text-2xs text-primary"
  />
</template>

<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'

import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'

import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
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
  for (const guide of guides) drawGuide(ctx, guide)
}

function stroke(
  ctx: CanvasRenderingContext2D,
  from: Point2D,
  to: Point2D,
  lineWidth: number
) {
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
}

function drawGuide(ctx: CanvasRenderingContext2D, guide: SmartGuide) {
  if (guide.kind === 'wire') {
    ctx.lineCap = 'round'
    stroke(ctx, canvasToScreen(guide.from), canvasToScreen(guide.to), 3)
    ctx.lineCap = 'butt'
    return
  }
  if (guide.kind === 'line') {
    const { axis, at, from, to } = guide
    const [start, end] =
      axis === 'x'
        ? [
            { x: at, y: from },
            { x: at, y: to }
          ]
        : [
            { x: from, y: at },
            { x: to, y: at }
          ]
    stroke(ctx, canvasToScreen(start), canvasToScreen(end), 1)
    return
  }
  const { axis, from, to, cross } = guide
  const [start, end, middle] =
    axis === 'x'
      ? [
          { x: from, y: cross },
          { x: to, y: cross },
          { x: (from + to) / 2, y: cross }
        ]
      : [
          { x: cross, y: from },
          { x: cross, y: to },
          { x: cross, y: (from + to) / 2 }
        ]
  stroke(ctx, canvasToScreen(start), canvasToScreen(end), 1)
  const label = canvasToScreen(middle)
  ctx.textAlign = 'center'
  ctx.fillText(
    String(Math.round(to - from)),
    axis === 'x' ? label.x : label.x + 14,
    axis === 'x' ? label.y - 4 : label.y + 4
  )
}
</script>
