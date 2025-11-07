<template>
  <div
    id="maskEditor_brush"
    :style="{
      position: 'absolute',
      opacity: brushOpacity,
      width: `${brushSize}px`,
      height: `${brushSize}px`,
      left: `${brushLeft}px`,
      top: `${brushTop}px`,
      borderRadius: borderRadius,
      pointerEvents: 'none',
      zIndex: 1000
    }"
  >
    <div
      id="maskEditor_brushPreviewGradient"
      :style="{
        display: gradientVisible ? 'block' : 'none',
        background: gradientBackground
      }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { BrushShape } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

const { containerRef } = defineProps<{
  containerRef?: HTMLElement
}>()

const store = useMaskEditorStore()

const brushOpacity = computed(() => {
  return store.brushVisible ? '1' : '0'
})

const brushRadius = computed(() => {
  return store.brushSettings.size * store.zoomRatio
})

const brushSize = computed(() => {
  return brushRadius.value * 2
})

const brushLeft = computed(() => {
  const dialogRect = containerRef?.getBoundingClientRect()
  const dialogOffsetLeft = dialogRect?.left || 0
  return (
    store.cursorPoint.x +
    store.panOffset.x -
    brushRadius.value -
    dialogOffsetLeft
  )
})

const brushTop = computed(() => {
  const dialogRect = containerRef?.getBoundingClientRect()
  const dialogOffsetTop = dialogRect?.top || 0
  return (
    store.cursorPoint.y +
    store.panOffset.y -
    brushRadius.value -
    dialogOffsetTop
  )
})

const borderRadius = computed(() => {
  return store.brushSettings.type === BrushShape.Rect ? '0%' : '50%'
})

const gradientVisible = computed(() => {
  return store.brushPreviewGradientVisible
})

const gradientBackground = computed(() => {
  const hardness = store.brushSettings.hardness

  if (hardness === 1) {
    return 'rgba(255, 0, 0, 0.5)'
  }

  const midStop = hardness * 100
  const outerStop = 100

  return `radial-gradient(
    circle,
    rgba(255, 0, 0, 0.5) 0%,
    rgba(255, 0, 0, 0.25) ${midStop}%,
    rgba(255, 0, 0, 0) ${outerStop}%
  )`
})
</script>
