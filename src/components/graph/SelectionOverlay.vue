<!-- This component is used to bound the selected items on the canvas. -->
<template>
  <div
    class="selection-overlay-container pointer-events-none z-40"
    :class="{
      'show-border': showBorder
    }"
    :style="style"
    v-show="visible"
  >
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { createBounds } from '@comfyorg/litegraph'
import type { LGraphCanvas } from '@comfyorg/litegraph'
import { ref, watch } from 'vue'

import { useAbsolutePosition } from '@/composables/element/useAbsolutePosition'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useCanvasStore } from '@/stores/graphStore'

const canvasStore = useCanvasStore()
const { style, updatePosition } = useAbsolutePosition()

const visible = ref(false)
const showBorder = ref(false)

const positionSelectionOverlay = (canvas: LGraphCanvas) => {
  const selectedItems = canvas.selectedItems
  showBorder.value = selectedItems.size > 1

  if (!selectedItems.size) {
    visible.value = false
    return
  }

  visible.value = true
  const bounds = createBounds(selectedItems)
  updatePosition({
    pos: [bounds[0], bounds[1]],
    size: [bounds[2], bounds[3]]
  })
}

// Register listener on canvas creation.
watch(
  () => canvasStore.canvas,
  (canvas: LGraphCanvas | null) => {
    if (!canvas) return

    canvas.onSelectionChange = useChainCallback(canvas.onSelectionChange, () =>
      positionSelectionOverlay(canvas)
    )
  },
  { immediate: true }
)

watch(
  () => {
    const canvas = canvasStore.canvas
    if (!canvas) return null
    return {
      scale: canvas.ds.state.scale,
      offset: [canvas.ds.state.offset[0], canvas.ds.state.offset[1]]
    }
  },
  (state) => {
    if (!state) return

    positionSelectionOverlay(canvasStore.canvas as LGraphCanvas)
  }
)

watch(
  () => canvasStore.canvas?.state?.draggingItems,
  (draggingItems) => {
    visible.value = !draggingItems
    if (draggingItems === false) {
      positionSelectionOverlay(canvasStore.canvas as LGraphCanvas)
    }
  }
)
</script>

<style scoped>
.selection-overlay-container > * {
  pointer-events: auto;
}

.show-border {
  @apply border-dashed rounded-md border-2 border-[var(--border-color)];
}
</style>
