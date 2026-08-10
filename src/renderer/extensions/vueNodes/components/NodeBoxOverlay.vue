<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { useTemplateRef } from 'vue'

import { drawNodeBoxes } from '@/renderer/core/canvas/nodeBoxRenderer'
import type { NodeBox } from '@/renderer/core/canvas/nodeBoxRenderer'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import type { Bounds } from '@/renderer/core/layout/types'

const { getBoxes } = defineProps<{
  /** Boxes to draw, in graph space. Called once per frame. */
  getBoxes: () => Iterable<NodeBox>
}>()

const { camera } = useTransformState()
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')

/** Visible region in graph space, from the inverse of the camera transform. */
function viewportBounds(width: number, height: number): Bounds {
  const scale = camera.z || 1
  return {
    x: -camera.x,
    y: -camera.y,
    width: width / scale,
    height: height / scale
  }
}

useRafFn(() => {
  const el = canvasRef.value
  if (!el) return

  const dpr = window.devicePixelRatio || 1
  const width = el.clientWidth
  const height = el.clientHeight
  if (!width || !height) return

  const pixelWidth = Math.round(width * dpr)
  const pixelHeight = Math.round(height * dpr)
  if (el.width !== pixelWidth || el.height !== pixelHeight) {
    el.width = pixelWidth
    el.height = pixelHeight
  }

  const ctx = el.getContext('2d')
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  drawNodeBoxes(ctx, getBoxes(), camera, viewportBounds(width, height), {
    // Matches the node surface colour so a zoomed-out graph reads the same as
    // a zoomed-in one.
    defaultColor:
      getComputedStyle(el).getPropertyValue('--node-box-color').trim() ||
      '#353535'
  })
})
</script>

<template>
  <!--
    Stands in for the node layer while zoomed out past legibility. Owned and
    drawn by the renderer, so a zoomed-out graph does not depend on the canvas
    renderer being present.
  -->
  <canvas
    ref="canvasRef"
    data-testid="node-box-overlay"
    class="pointer-events-none absolute inset-0 size-full [--node-box-color:var(--color-zinc-700)]"
  />
</template>
