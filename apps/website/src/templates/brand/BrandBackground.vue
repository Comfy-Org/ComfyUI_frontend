<script setup lang="ts">
import {
  useEventListener,
  useIntersectionObserver,
  useRafFn
} from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
}

const canvasEl = ref<HTMLCanvasElement | null>(null)

let dpr =
  typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1

const nodes: Node[] = Array.from({ length: 14 }, () => ({
  x: Math.random(),
  y: Math.random(),
  vx: (Math.random() - 0.5) * 0.0005,
  vy: (Math.random() - 0.5) * 0.0005
}))

let ctx: CanvasRenderingContext2D | null = null

function draw() {
  const el = canvasEl.value
  if (!el || !ctx) return
  const w = el.width
  const h = el.height
  ctx.clearRect(0, 0, w, h)

  for (const n of nodes) {
    n.x += n.vx
    n.y += n.vy
    if (n.x < 0 || n.x > 1) n.vx *= -1
    if (n.y < 0 || n.y > 1) n.vy *= -1
  }

  ctx.strokeStyle = 'rgba(242, 255, 89, 0.18)'
  ctx.lineWidth = dpr
  const max = Math.min(w, h) * 0.22
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const dx = (a.x - b.x) * w
      const dy = (a.y - b.y) * h
      const d = Math.hypot(dx, dy)
      if (d < max) {
        ctx.globalAlpha = 1 - d / max
        ctx.beginPath()
        ctx.moveTo(a.x * w, a.y * h)
        const mx = ((a.x + b.x) / 2) * w
        ctx.bezierCurveTo(mx, a.y * h, mx, b.y * h, b.x * w, b.y * h)
        ctx.stroke()
      }
    }
  }

  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(242, 255, 89, 0.9)'
  for (const n of nodes) {
    ctx.beginPath()
    ctx.arc(n.x * w, n.y * h, 2.5 * dpr, 0, Math.PI * 2)
    ctx.fill()
  }
}

// Resizing clears the canvas bitmap, so repaint immediately afterwards to keep
// the field visible even when the RAF loop is paused (off screen or
// reduced-motion). Also refresh dpr in case the window moved to another display.
function resize() {
  const el = canvasEl.value
  if (!el) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  el.width = el.offsetWidth * dpr
  el.height = el.offsetHeight * dpr
  draw()
}

const { pause, resume } = useRafFn(draw, { immediate: false })

// Only animate while the field is on screen, and honour reduced-motion by
// painting a single static frame instead of looping.
useIntersectionObserver(canvasEl, ([entry]) => {
  if (prefersReducedMotion()) return
  if (entry?.isIntersecting) resume()
  else pause()
})

useEventListener('resize', resize)

onMounted(() => {
  ctx = canvasEl.value?.getContext('2d') ?? null
  resize()
})
</script>

<template>
  <canvas
    ref="canvasEl"
    aria-hidden="true"
    class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-screen w-full"
  />
</template>
