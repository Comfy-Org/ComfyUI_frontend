<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

type Point = { x: number; y: number }

const zoomPane = useTemplateRef('zoomPane')

const zoom = ref(1.0)
const panX = ref(0.0)
const panY = ref(0.0)

const activePointers = new Map<number, Point>()

function zoomAt(zoomDelta: number, clientX: number, clientY: number) {
  const zoomPaneEl = zoomPane.value
  if (!zoomPaneEl || (zoomDelta > 0 ? zoom.value > 1200 : zoom.value < -500))
    return

  zoom.value += zoomDelta
  const { x, y, width, height } = zoomPaneEl.getBoundingClientRect()
  const offsetX = clientX - x - width / 2
  const offsetY = clientY - y - height / 2
  const scaler = 1.1 ** (zoomDelta / 30)

  panY.value = panY.value * scaler - offsetY * (scaler - 1)
  panX.value = panX.value * scaler - offsetX * (scaler - 1)
}

function handleWheel(e: WheelEvent) {
  zoomAt(-e.deltaY, e.clientX, e.clientY)
}

function handleDown(e: PointerEvent) {
  if (e.button !== 0 && e.button !== 1) return

  const zoomPaneEl = zoomPane.value
  if (!zoomPaneEl) return
  zoomPaneEl.parentElement?.focus()

  zoomPaneEl.setPointerCapture(e.pointerId)
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function pinch(previous: Point, current: Point, anchor: Point) {
  const previousDistance = distance(previous, anchor)
  if (previousDistance === 0) return

  const previousCenter = midpoint(previous, anchor)
  const center = midpoint(current, anchor)
  panX.value += center.x - previousCenter.x
  panY.value += center.y - previousCenter.y

  const ratio = distance(current, anchor) / previousDistance
  zoomAt((30 * Math.log(ratio)) / Math.log(1.1), center.x, center.y)
}

function handleMove(e: PointerEvent) {
  const previous = activePointers.get(e.pointerId)
  if (!previous) return

  const current = { x: e.clientX, y: e.clientY }
  const anchor = [...activePointers].find(([id]) => id !== e.pointerId)?.[1]
  activePointers.set(e.pointerId, current)

  if (activePointers.size > 2) return
  if (anchor) {
    pinch(previous, current, anchor)
    return
  }
  panX.value += current.x - previous.x
  panY.value += current.y - previous.y
}

function handleUp(e: PointerEvent) {
  activePointers.delete(e.pointerId)
}

const transform = computed(() => {
  const scale = 1.1 ** (zoom.value / 30)
  const matrix = [scale, 0, 0, scale, panX.value, panY.value]
  return `matrix(${matrix.join(',')})`
})
</script>
<template>
  <div
    ref="zoomPane"
    class="touch-none place-content-center contain-size"
    @wheel="handleWheel"
    @pointerdown.prevent="handleDown"
    @pointermove="handleMove"
    @pointerup="handleUp"
    @pointercancel="handleUp"
  >
    <slot :style="{ transform }" />
  </div>
</template>
