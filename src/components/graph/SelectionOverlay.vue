<!-- This component is used to bound the selected items on the canvas. -->
<template>
  <div
    v-show="visible"
    class="selection-overlay-container pointer-events-none z-40"
    :class="{
      'show-border': showBorder
    }"
    :style="style"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { createBounds } from '@comfyorg/litegraph'
import { whenever } from '@vueuse/core'
import { onUnmounted, ref, watch } from 'vue'

import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { useAbsolutePosition } from '@/composables/element/useAbsolutePosition'
import { useCanvasStore } from '@/stores/graphStore'

const canvasStore = useCanvasStore()
const { style, updatePosition } = useAbsolutePosition()
const { getSelectableItems } = useSelectedLiteGraphItems()

const visible = ref(false)
const showBorder = ref(false)

const positionSelectionOverlay = () => {
  const selectableItems = getSelectableItems()
  showBorder.value = selectableItems.size > 1

  if (!selectableItems.size) {
    visible.value = false
    return
  }

  visible.value = true
  const bounds = createBounds(selectableItems)

  if (bounds) {
    updatePosition({
      pos: [bounds[0], bounds[1]],
      size: [bounds[2], bounds[3]]
    })
  }
}

let rafId: number | null = null

const throttledPositionUpdate = () => {
  if (rafId !== null) return // Already scheduled - skip redundant calls

  rafId = requestAnimationFrame(() => {
    positionSelectionOverlay()
    rafId = null
  })
}

whenever(
  () => canvasStore.getCanvas().state.selectionChanged,
  () => {
    requestAnimationFrame(() => {
      positionSelectionOverlay()
      canvasStore.getCanvas().state.selectionChanged = false
    })
  },
  { immediate: true }
)

const canvas = canvasStore.getCanvas()
if (canvas?.ds) {
  canvas.ds.onChanged = throttledPositionUpdate
}

watch(
  () => canvasStore.canvas?.state?.draggingItems,
  (draggingItems) => {
    // Litegraph draggingItems state can end early before the bounding boxes of
    // the selected items are updated. Delay to make sure we put the overlay in
    // the correct position.
    // https://github.com/Comfy-Org/ComfyUI_frontend/issues/2656
    if (draggingItems === false) {
      requestAnimationFrame(() => {
        visible.value = true
        throttledPositionUpdate() // Use throttled version here too
      })
    } else {
      // Selection change update to visible state is delayed by a frame. Here
      // we also delay a frame so that the order of events is correct when
      // the initial selection and dragging happens at the same time.
      requestAnimationFrame(() => {
        visible.value = false
      })
    }
  }
)

// **PROPER CLEANUP**: Cancel pending animation frame on component unmount
onUnmounted(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
  }
})
</script>

<style scoped>
.selection-overlay-container > * {
  pointer-events: auto;
}

.show-border {
  @apply border-dashed rounded-md border-2 border-[var(--border-color)];
}
</style>
