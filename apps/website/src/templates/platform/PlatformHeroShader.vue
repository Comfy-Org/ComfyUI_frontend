<script setup lang="ts">
import {
  useEventListener,
  useIntersectionObserver,
  useRafFn
} from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

const canvasEl = ref<HTMLCanvasElement | null>(null)

let context: CanvasRenderingContext2D | null = null
let elapsed = 0
let lastPhase = -1

function smoothstep(start: number, end: number, value: number) {
  const progress = Math.min(1, Math.max(0, (value - start) / (end - start)))
  return progress * progress * (3 - 2 * progress)
}

function hash(row: number, column: number, phase: number) {
  const value = Math.sin(row * 12.9898 + column * 78.233 + phase * 37.719)
  return value * 43758.5453 - Math.floor(value * 43758.5453)
}

function glyphFor(
  row: number,
  column: number,
  rowCount: number,
  phase: number
) {
  const edgeDistance = Math.min(row, rowCount - row - 1)
  const edgeGlyphs = ['=', '*', '#', '%', '+']
  if (edgeDistance < 3) {
    return edgeGlyphs[Math.floor(hash(row, column, phase) * edgeGlyphs.length)]
  }
  return hash(row, column, 0) > 0.92 ? '%' : '@'
}

function alphaAt(x: number, y: number, width: number, height: number) {
  const horizontal = smoothstep(width * 0.08, width * 0.48, x)
  const top = smoothstep(0, height * 0.14, y)
  const bottom = smoothstep(0, height * 0.14, height - y)
  return horizontal * top * bottom
}

function draw(phase: number) {
  const canvas = canvasEl.value
  if (!canvas || !context) return
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const width = canvas.width / dpr
  const height = canvas.height / dpr
  const fontSize = width < 640 ? 11 : 13
  const cellWidth = fontSize * 1.15
  const rowHeight = fontSize * 1.45
  const columnCount = Math.ceil(width / cellWidth) + 4
  const rowCount = Math.ceil(height / rowHeight)
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, width, height)
  context.fillStyle = getComputedStyle(canvas).color
  context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  for (let row = 0; row < rowCount; row++) {
    const jitter = Math.round((hash(row, phase, phase) - 0.5) * 18)
    for (let column = -2; column < columnCount; column++) {
      if (hash(row, column, phase) < 0.08) continue
      const x = column * cellWidth + cellWidth / 2 + jitter
      const y = row * rowHeight + rowHeight / 2
      const alpha = alphaAt(x, y, width, height)
      if (alpha <= 0) continue
      context.globalAlpha = alpha * 0.56
      context.fillText(glyphFor(row, column, rowCount, phase), x, y)
    }
  }

  context.globalAlpha = 1
}

function resize() {
  const canvas = canvasEl.value
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const width = Math.round(canvas.clientWidth * dpr)
  const height = Math.round(canvas.clientHeight * dpr)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  draw(Math.max(lastPhase, 0))
}

const { pause, resume } = useRafFn(
  ({ delta }) => {
    elapsed += Math.min(delta, 100)
    const phase = Math.floor(elapsed / 120)
    if (phase === lastPhase) return
    lastPhase = phase
    draw(phase)
  },
  { immediate: false }
)

useIntersectionObserver(canvasEl, ([entry]) => {
  if (prefersReducedMotion()) return
  if (entry?.isIntersecting) resume()
  else pause()
})

useEventListener('resize', resize)

onMounted(() => {
  context = canvasEl.value?.getContext('2d') ?? null
  resize()
})
</script>

<template>
  <canvas
    ref="canvasEl"
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 z-0 size-full text-primary-comfy-canvas"
  />
</template>
