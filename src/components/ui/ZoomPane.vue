<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

const zoomPane = useTemplateRef('zoomPane')

const zoom = ref(1.0)
const panX = ref(0.0)
const panY = ref(0.0)

function handleWheel(e: WheelEvent) {
  zoom.value -= e.deltaY
  //TODO apply pan relative to mouse coords?
}
let dragging = false
function handleDown(e: PointerEvent) {
  const zoomPaneEl = zoomPane.value
  if (!zoomPaneEl) return
  zoomPaneEl.setPointerCapture(e.pointerId)
  dragging = true
}
function handleMove(e: PointerEvent) {
  if (!dragging) return
  panX.value += e.movementX
  panY.value += e.movementY
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
    class="contain-content"
    @wheel="handleWheel"
    @pointerdown.prevent="handleDown"
    @pointermove="handleMove"
    @pointerup="dragging = false"
  >
    <slot :style="{ transform }" />
  </div>
</template>
