<template>
  <div class="selection-toolbox-container" :style="style" v-show="visible">
    <Toolbar>
      <template #start>
        <Button label="Select All" />
      </template>
    </Toolbar>
  </div>
</template>

<script setup lang="ts">
import { createBounds } from '@comfyorg/litegraph'
import type { LGraphCanvas } from '@comfyorg/litegraph'
import Button from 'primevue/button'
import Toolbar from 'primevue/toolbar'
import { ref, watch } from 'vue'

import { useAbsolutePosition } from '@/composables/element/useAbsolutePosition'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useCanvasStore } from '@/stores/graphStore'

const canvasStore = useCanvasStore()
const { style, updatePosition } = useAbsolutePosition()

const visible = ref(false)

const positionSelectionToolbox = (canvas: LGraphCanvas) => {
  const selectedItems = canvas.selectedItems
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
      positionSelectionToolbox(canvas)
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

    positionSelectionToolbox(canvasStore.canvas as LGraphCanvas)
  }
)
</script>
