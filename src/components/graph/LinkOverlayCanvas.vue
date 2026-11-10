<template>
  <canvas
    ref="canvasRef"
    class="pointer-events-none absolute inset-0 size-full"
  />
</template>

<script setup lang="ts">
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'

import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'

const { canvas } = defineProps<{
  canvas: LGraphCanvas
}>()

const emit = defineEmits<{
  ready: [canvas: HTMLCanvasElement]
  dispose: []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

function matchMainCanvasSize(mainCanvas: HTMLCanvasElement) {
  const el = canvasRef.value
  if (!el) return

  if (el.width !== mainCanvas.width || el.height !== mainCanvas.height) {
    el.width = mainCanvas.width
    el.height = mainCanvas.height
  }
}

watch(
  () => canvas,
  (canvas, _, onCleanup) => {
    onCleanup(
      onCanvasFrame(canvas.canvas, 'update', () =>
        matchMainCanvasSize(canvas.canvas)
      )
    )
  },
  { immediate: true }
)

onMounted(() => {
  if (canvasRef.value) emit('ready', canvasRef.value)
})

onBeforeUnmount(() => {
  emit('dispose')
})
</script>
