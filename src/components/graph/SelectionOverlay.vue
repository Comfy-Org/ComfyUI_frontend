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
import { whenever } from '@vueuse/core'
import { onUnmounted, provide, readonly, ref, watch } from 'vue'

import { useHybridPositioning } from '@/composables/canvas/useHybridPositioning'
import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { createBounds } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/stores/graphStore'
import { SelectionOverlayInjectionKey } from '@/types/selectionOverlayTypes'

const canvasStore = useCanvasStore()
const { style, updatePosition, isTransforming } = useHybridPositioning()
const { getSelectableItems } = useSelectedLiteGraphItems()

const visible = ref(false)
const showBorder = ref(false)
// Increment counter to notify child components of position/visibility change
// This does not include viewport changes.
const overlayUpdateCount = ref(0)
provide(SelectionOverlayInjectionKey, {
  visible: readonly(visible),
  updateCount: readonly(overlayUpdateCount)
})

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

whenever(
  () => canvasStore.getCanvas().state.selectionChanged,
  () => {
    requestAnimationFrame(() => {
      positionSelectionOverlay()
      overlayUpdateCount.value++
      canvasStore.getCanvas().state.selectionChanged = false
    })
  },
  { immediate: true }
)

// For testing: uncomment this line to use old absolute-only positioning
// canvasStore.getCanvas().ds.onChanged = positionSelectionOverlay

// Clean up on unmount
onUnmounted(() => {
  // Hybrid positioning handles its own cleanup
  // If testing with old method, clean up:
  // canvasStore.getCanvas().ds.onChanged = null
})

watch(
  () => canvasStore.canvas?.state?.draggingItems,
  (draggingItems) => {
    // Don't hide during canvas transform - only when dragging nodes
    if (isTransforming.value) {
      return
    }

    // Litegraph draggingItems state can end early before the bounding boxes of
    // the selected items are updated. Delay to make sure we put the overlay in
    // the correct position.
    // https://github.com/Comfy-Org/ComfyUI_frontend/issues/2656
    if (draggingItems === false) {
      requestAnimationFrame(() => {
        visible.value = true
        positionSelectionOverlay()
        overlayUpdateCount.value++
      })
    } else {
      // Selection change update to visible state is delayed by a frame. Here
      // we also delay a frame so that the order of events is correct when
      // the initial selection and dragging happens at the same time.
      requestAnimationFrame(() => {
        visible.value = false
        overlayUpdateCount.value++
      })
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
